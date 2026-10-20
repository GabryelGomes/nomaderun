import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { circleRing } from '@/components/territory-map.layers';
import { distanceMeters } from '@/domain/geo';
import { emptyRankingText, rankingQuery, scopesFor } from '@/features/screens/club-ranking';

import { getDistrictLabel, getMyRecentZoneId, rankCrews, rankFactions, rankRunners } from '../leaderboard-repo';
import { addPrivacyZone, isPrivacyLimitError, listPrivacyZones, removePrivacyZone, toPrivacyZone, validatePrivacyZone } from '../privacy-zones-repo';
import { getInvalidStretches, mergeRanges } from '../track-repo';

type AnyFn = (...args: any[]) => any;
const result: { data: unknown; error: unknown } = { data: [], error: null };
const calls: [string, unknown[]][] = [];
const query: Record<string, AnyFn> & { then: AnyFn } = {
  then: (res: AnyFn, rej: AnyFn) => Promise.resolve(result).then(res, rej),
} as never;
for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'insert', 'delete']) {
  query[m] = jest.fn<AnyFn>((...args: unknown[]) => {
    calls.push([m, args]);
    return query;
  });
}
query.single = jest.fn<AnyFn>(async () => result);
const mockRpc = jest.fn<AnyFn>();
const mockFrom = jest.fn<AnyFn>((t: string) => {
  calls.push(['from', [t]]);
  return query;
});
jest.mock('../supabase', () => ({ requireSupabase: () => ({ from: mockFrom, rpc: mockRpc }), getSupabase: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  result.data = [];
  result.error = null;
});

const me = { id: 'u1', city: 'Goiânia', faction: 'owls' as const, district: '87a8c0e24ffffff' };

describe('filtros dos rankings do Clube (P-25)', () => {
  it('quadro + escopo + período viram os parâmetros das RPCs', () => {
    expect(rankingQuery('individual', 'geral', 'season', me)).toEqual({ period: 'season', scope: 'general', value: null, limit: 20 });
    expect(rankingQuery('individual', 'cidade', 'week', me)).toEqual({ period: 'week', scope: 'city', value: 'Goiânia', limit: 20 });
    expect(rankingQuery('crews', 'time', 'week', me)).toEqual({ period: 'week', scope: 'faction', value: 'owls', limit: 20 });
    expect(rankingQuery('faccoes', 'distrito', 'season', me)).toEqual({ period: 'season', scope: 'district', value: me.district, limit: 20 });
    // times não têm "Meu time": cai no geral
    expect(scopesFor('faccoes')).not.toContain('time');
    expect(rankingQuery('faccoes', 'time', 'season', me)?.scope).toBe('general');
  });

  it('sem cidade/distrito não consulta e explica o porquê', () => {
    const none = { ...me, city: null, district: null };
    expect(rankingQuery('individual', 'cidade', 'season', none)).toBeNull();
    expect(rankingQuery('crews', 'distrito', 'week', none)).toBeNull();
    expect(emptyRankingText('individual', 'cidade', 'season', none)).toMatch(/cidade natal/);
    expect(emptyRankingText('individual', 'distrito', 'season', none)).toMatch(/distrito/);
    expect(emptyRankingText('individual', 'geral', 'week', none)).toMatch(/semana/);
    expect(emptyRankingText('individual', 'geral', 'season', none)).toMatch(/temporada/);
  });

  it('chama ranking_runners/crews/factions com p_period, p_scope, p_value', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ position: 1, user_id: 'u', username: 'ana', faction: 'owls', city: 'Goiânia', crew_tag: 'PCE', rp: '40', meters: 900, runs: 2 }], error: null });
    const r = await rankRunners({ period: 'week', scope: 'district', value: me.district, limit: 20 });
    expect(mockRpc).toHaveBeenLastCalledWith('ranking_runners', { p_period: 'week', p_scope: 'district', p_value: me.district, p_limit: 20 });
    expect(r).toMatchObject({ ok: true, data: [{ username: 'ana', rp: 40, crewTag: 'PCE' }] });

    mockRpc.mockResolvedValueOnce({ data: [{ position: 1, crew_id: 'c', name: 'Pace', tag: 'PCE', faction: 'owls', rp: 10, members: 3 }], error: null });
    expect(await rankCrews({ period: 'season', scope: 'general', value: 'ignorado' })).toMatchObject({ ok: true, data: [{ crewId: 'c', members: 3 }] });
    expect(mockRpc).toHaveBeenLastCalledWith('ranking_crews', { p_period: 'season', p_scope: 'general', p_value: null, p_limit: 50 });

    mockRpc.mockResolvedValueOnce({ data: [{ position: 1, faction: 'volt', rp: 5, runners: 1, zones: 2 }, { position: 2, faction: 'x', rp: 0 }], error: null });
    const f = await rankFactions({ period: 'week', scope: 'faction', value: 'owls' });
    expect(mockRpc).toHaveBeenLastCalledWith('ranking_factions', { p_period: 'week', p_scope: 'general', p_value: null });
    expect(f).toMatchObject({ ok: true, data: [{ faction: 'volt', zones: 2 }] });

    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'VALIDATION: escopo inválido' } });
    expect(await rankRunners({ period: 'week', scope: 'city', value: 'X' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('nome do distrito e zona mais recente do usuário', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'Jardim Goiás', error: null });
    expect(await getDistrictLabel('87a8c0e24ffffff')).toEqual({ ok: true, data: 'Jardim Goiás' });
    expect(mockRpc).toHaveBeenLastCalledWith('district_label', { p_district: '87a8c0e24ffffff' });
    result.data = [{ zone_id: '89a8c0e24a3ffff' }];
    expect(await getMyRecentZoneId('u1')).toEqual({ ok: true, data: '89a8c0e24a3ffff' });
    expect(calls).toEqual(expect.arrayContaining([['from', ['activity_zones']], ['eq', ['user_id', 'u1']]]));
    result.data = [];
    expect(await getMyRecentZoneId('u1')).toEqual({ ok: true, data: null });
  });
});

describe('zonas de privacidade (RN-010, P-27)', () => {
  it('valida antes de ir ao servidor', () => {
    expect(validatePrivacyZone({ lat: -16.7, lng: -49.2 })).toBeNull();
    expect(validatePrivacyZone({ lat: -16.7, lng: -49.2, label: 'x'.repeat(41) })).toMatch(/40/);
    expect(validatePrivacyZone({ lat: 95, lng: -49.2 })).toMatch(/ponto/);
    expect(validatePrivacyZone({ lat: NaN, lng: 0 })).toMatch(/ponto/);
    expect(validatePrivacyZone({ lat: 0, lng: 0, radiusM: 20 })).toMatch(/50 a 1000/);
  });

  it('lista, cadastra com raio padrão 200 m, remove e reconhece o limite do banco', async () => {
    result.data = [{ id: 'z1', label: 'Casa', lat: -16.7, lng: -49.2, radius_m: 200, created_at: '2026-10-20T10:00:00Z' }];
    expect(await listPrivacyZones()).toMatchObject({ ok: true, data: [{ id: 'z1', label: 'Casa', radiusM: 200 }] });
    result.data = { id: 'z2', label: null, lat: -16.71, lng: -49.21, radius_m: 200, created_at: null };
    const added = await addPrivacyZone({ label: '  ', lat: -16.71, lng: -49.21 });
    expect(query.insert).toHaveBeenCalledWith({ label: null, lat: -16.71, lng: -49.21, radius_m: 200 });
    expect(added).toMatchObject({ ok: true, data: { id: 'z2', label: null } });
    result.data = null;
    result.error = { code: 'P0001', message: 'PRIVACY_ZONES_LIMIT: no máximo 3 zonas de privacidade' };
    const limit = await addPrivacyZone({ label: 'Trabalho', lat: -16.7, lng: -49.2 });
    expect(limit.ok).toBe(false);
    if (!limit.ok) {
      expect(isPrivacyLimitError(limit.error)).toBe(true);
      expect(limit.error.message).toBe('No máximo 3 zonas de privacidade.');
    }
    result.error = null;
    expect(await removePrivacyZone('z1')).toEqual({ ok: true, data: undefined });
    expect(calls).toEqual(expect.arrayContaining([['eq', ['id', 'z1']]]));
    expect(toPrivacyZone({ id: 'z', lat: '1', lng: '2' })).toMatchObject({ lat: 1, lng: 2, radiusM: 200, label: null });
  });

  it('o círculo do mapa web tem o raio pedido', () => {
    const c = { lat: -16.7097, lng: -49.2388 };
    for (const p of circleRing(c, 200)) expect(Math.abs(distanceMeters(c, p) - 200)).toBeLessThan(3);
  });
});

describe('trechos inválidos em cinza (P-20)', () => {
  it('junta trechos encostados e descarta inválidos', () => {
    expect(mergeRanges([{ fromSeq: 50, toSeq: 60 }, { fromSeq: 10, toSeq: 20 }, { fromSeq: 21, toSeq: 30 }, { fromSeq: 5, toSeq: 2 }, { fromSeq: 55, toSeq: 70 }])).toEqual([
      { fromSeq: 10, toSeq: 30 },
      { fromSeq: 50, toSeq: 70 },
    ]);
  });

  it('busca os pontos de cada trecho pelo seq (com o ponto anterior)', async () => {
    result.data = [
      { seq: 9, lat: -16.7, lng: -49.2 },
      { seq: 10, lat: -16.701, lng: -49.201 },
    ];
    const r = await getInvalidStretches('a1', [{ fromSeq: 10, toSeq: 12 }]);
    expect(calls).toEqual(expect.arrayContaining([['from', ['activity_points']], ['eq', ['activity_id', 'a1']], ['gte', ['seq', 9]], ['lte', ['seq', 12]]]));
    expect(r).toEqual({ ok: true, data: [[{ lat: -16.7, lng: -49.2 }, { lat: -16.701, lng: -49.201 }]] });
    expect(await getInvalidStretches('a1', [])).toEqual({ ok: true, data: [] });
  });
});
