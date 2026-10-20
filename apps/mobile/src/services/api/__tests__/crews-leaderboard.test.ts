import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createCrew, joinCrew, normalizeCrewTag, removeCrewMember, validateCrewName, validateCrewTag, validateInviteCode } from '../crews-repo';
import { getCityRanking, getIndividualRanking, toCityRow, toIndividual } from '../leaderboard-repo';

type AnyFn = (...args: any[]) => any;
const result: { data: unknown; error: unknown; count?: number } = { data: [], error: null };
const calls: [string, unknown[]][] = [];
const query: Record<string, AnyFn> & { then: AnyFn } = {
  then: (res: AnyFn, rej: AnyFn) => Promise.resolve(result).then(res, rej),
} as never;
for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'delete', 'in', 'ilike']) {
  query[m] = jest.fn<AnyFn>((...args: unknown[]) => {
    calls.push([m, args]);
    return query;
  });
}
query.single = jest.fn<AnyFn>(async () => result);
query.maybeSingle = jest.fn<AnyFn>(async () => result);
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
  delete result.count;
});

describe('sigla e nome da crew (RF-011)', () => {
  it('sigla de 3 a 5 letras, vira maiúscula', () => {
    expect(normalizeCrewTag(' flr ')).toBe('FLR');
    expect(validateCrewTag('flr')).toBeNull();
    expect(validateCrewTag('ABCDE')).toBeNull();
    expect(validateCrewTag('AB')).toMatch(/3 a 5/);
    expect(validateCrewTag('ABCDEF')).toMatch(/3 a 5/);
    expect(validateCrewTag('AB1')).toMatch(/3 a 5/);
    expect(validateCrewTag('ÁBC')).toMatch(/3 a 5/);
    expect(validateCrewTag('')).toMatch(/Informe/);
  });

  it('nome de 3 a 30 e código de convite', () => {
    expect(validateCrewName('ab')).toMatch(/pelo menos 3/);
    expect(validateCrewName('x'.repeat(31))).toMatch(/no máximo 30/);
    expect(validateCrewName('Flamboyant Runners')).toBeNull();
    expect(validateInviteCode('A1B2C3D4')).toBeNull();
    expect(validateInviteCode('a-b')).not.toBeNull();
  });
});

describe('crews-repo', () => {
  it('cria com nome e sigla normalizados (o servidor define líder e facção)', async () => {
    result.data = { id: 'c1', name: 'Pace', tag: 'PCE', faction: 'volt', invite_code: 'ABCD1234', leader_id: 'u1' };
    const r = await createCrew('  Pace ', 'pce');
    expect(query.insert).toHaveBeenCalledWith({ name: 'Pace', tag: 'PCE' });
    expect(r).toMatchObject({ ok: true, data: { id: 'c1', inviteCode: 'ABCD1234', leaderId: 'u1' } });
  });

  it('entrar por código usa join_crew e mostra o erro do servidor em pt-BR', async () => {
    mockRpc.mockResolvedValueOnce({ data: { crewId: 'c1', name: 'Pace', tag: 'PCE' }, error: null });
    expect(await joinCrew(' abcd1234 ')).toMatchObject({ ok: true, data: { crewId: 'c1' } });
    expect(mockRpc).toHaveBeenCalledWith('join_crew', { p_code: 'ABCD1234' });
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'CREW_FACTION_MISMATCH: a crew precisa ser da mesma facção do corredor' } });
    expect(await joinCrew('X')).toMatchObject({ ok: false, error: { detail: 'CREW_FACTION_MISMATCH', message: 'A crew precisa ser da mesma facção do corredor.' } });
  });

  it('remover membro que a RLS não deixou apagar vira erro', async () => {
    result.count = 0;
    const r = await removeCrewMember('c1', 'u2');
    expect(r.ok).toBe(false);
    result.count = 1;
    expect((await removeCrewMember('c1', 'u2')).ok).toBe(true);
  });
});

describe('leaderboard-repo', () => {
  it('converte as linhas das views', () => {
    expect(toIndividual({ position: 1, user_id: 'u', username: 'ana', faction: 'owls', city: 'Goiânia', crew_tag: null, rp: 10, meters: 2000, runs: 1 })).toMatchObject({ position: 1, faction: 'owls', crewTag: null, meters: 2000 });
    expect(toCityRow({ position: 2, city: 'Anápolis', rp: 5, active_runners: 3, eligible: false, score: null })).toEqual({ position: 2, city: 'Anápolis', rp: 5, activeRunners: 3, eligible: false, score: null });
    expect(toCityRow({ position: 1, city: 'X', rp: 400, active_runners: 25, eligible: true, score: '80.00' }).score).toBe(80);
  });

  it('filtra o individual por cidade/time/crew', async () => {
    result.data = [];
    await getIndividualRanking({ city: 'Goiânia', faction: 'volt', crewTag: 'PCE', limit: 5 });
    expect(calls).toEqual(expect.arrayContaining([['from', ['leaderboard_individual']], ['eq', ['city', 'Goiânia']], ['eq', ['faction', 'volt']], ['eq', ['crew_tag', 'PCE']], ['limit', [5]]]));
    await getCityRanking();
    expect(calls).toEqual(expect.arrayContaining([['from', ['leaderboard_cities']]]));
  });
});
