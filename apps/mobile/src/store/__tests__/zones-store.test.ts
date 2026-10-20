import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { emptyInfluence, newZone, type Zone } from '@/domain/territory';
import { AppError, fail, ok } from '@/services/api/errors';
import type { ServerZone } from '@/services/api/zones-repo';

import { mergeServerZones, setZonesApi, useZones } from '../zones-store';

jest.mock('@/services/api/zones-cache', () => ({ readCachedZones: async () => null, writeCachedZones: async () => undefined }));
jest.mock('@/services/api/supabase', () => ({ requireSupabase: () => { throw new Error('sem rede nos testes'); }, getSupabase: () => null }));

type AnyFn = (...args: any[]) => any;
const A = '89a8c0e24a3ffff';
const B = '89a8c0e24a7ffff';
const owned = (id: string, owner: Zone['owner']): Zone => ({ ...newZone(id), owner, influence: { ...emptyInfluence(), ...(owner ? { [owner]: 100 } : {}) } });
const server = (id: string, owner: Zone['owner'], name: string | null = null): ServerZone => ({ zone: owned(id, owner), meta: { name, city: null } });

const fetchZonesInBbox = jest.fn<AnyFn>();
const writeCache = jest.fn<AnyFn>(async () => undefined);
const readCache = jest.fn<AnyFn>(async () => null);
let realtime: ((z: ServerZone) => void) | null = null;
const unsubscribe = jest.fn<AnyFn>();
const subscribeZones = jest.fn<AnyFn>((onZone: (z: ServerZone) => void, onStatus?: (s: string) => void) => {
  realtime = onZone;
  onStatus?.('SUBSCRIBED');
  return ok({ unsubscribe });
});

const bbox = { minLng: -49.25, minLat: -16.72, maxLng: -49.22, maxLat: -16.7 };

beforeEach(() => {
  jest.clearAllMocks();
  setZonesApi({ fetchZonesInBbox, subscribeZones, writeCache, readCache });
  useZones.getState().reset();
  realtime = null;
});

describe('zones-store', () => {
  it('upsertZones mescla sem apagar zonas que já estavam', () => {
    useZones.getState().upsertZones({ [A]: owned(A, 'striders') });
    useZones.getState().upsertZones({ [B]: owned(B, 'volt') });
    useZones.getState().upsertZones({ [A]: owned(A, 'coyotes') });
    const { zones } = useZones.getState();
    expect(Object.keys(zones).sort()).toEqual([A, B]);
    expect(zones[A].owner).toBe('coyotes');
    expect(writeCache).toHaveBeenCalled();
  });

  it('loadBbox mescla o resultado, guarda nomes e salva o cache', async () => {
    useZones.getState().upsertZones({ [B]: owned(B, 'volt') });
    fetchZonesInBbox.mockResolvedValue(ok([server(A, 'striders', 'Parque Flamboyant')]));
    await useZones.getState().loadBbox(bbox);
    const s = useZones.getState();
    expect(fetchZonesInBbox).toHaveBeenCalledWith(bbox);
    expect(s.zones[A].owner).toBe('striders');
    expect(s.zones[B].owner).toBe('volt');
    expect(s.meta[A].name).toBe('Parque Flamboyant');
    expect(s.loading).toBe(false);
    expect(s.offline).toBe(false);
    expect(s.lastLoadedAt).not.toBeNull();
  });

  it('sem internet mantém o último mapa e marca offline', async () => {
    fetchZonesInBbox.mockResolvedValueOnce(ok([server(A, 'striders')]));
    await useZones.getState().loadBbox(bbox);
    fetchZonesInBbox.mockResolvedValueOnce(fail(new AppError('NETWORK', 'Sem conexão')));
    await useZones.getState().loadBbox(bbox);
    const s = useZones.getState();
    expect(s.zones[A].owner).toBe('striders');
    expect(s.offline).toBe(true);
    expect(s.error?.code).toBe('NETWORK');
  });

  it('descarta a resposta de uma carga antiga quando outra mais nova já começou', async () => {
    let resolveOld: (v: unknown) => void = () => undefined;
    fetchZonesInBbox.mockImplementationOnce(() => new Promise((r) => (resolveOld = r)));
    fetchZonesInBbox.mockResolvedValueOnce(ok([server(A, 'volt')]));
    const old = useZones.getState().loadBbox(bbox);
    await useZones.getState().loadBbox(bbox);
    resolveOld(ok([server(A, 'owls')]));
    await old;
    expect(useZones.getState().zones[A].owner).toBe('volt');
  });

  it('Realtime troca o dono e não apaga o nome conhecido quando a linha vem sem nome', async () => {
    fetchZonesInBbox.mockResolvedValue(ok([server(A, 'striders', 'Parque')]));
    await useZones.getState().loadBbox(bbox);
    const stop = useZones.getState().subscribe();
    expect(useZones.getState().live).toBe(true);
    realtime?.(server(A, 'coyotes', null));
    expect(useZones.getState().zones[A].owner).toBe('coyotes');
    expect(useZones.getState().meta[A].name).toBe('Parque');
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(useZones.getState().live).toBe(false);
  });

  it('assinatura com contagem de referências: um só canal para várias telas', () => {
    const s1 = useZones.getState().subscribe();
    const s2 = useZones.getState().subscribe();
    expect(subscribeZones).toHaveBeenCalledTimes(1);
    s1();
    s1();
    expect(unsubscribe).not.toHaveBeenCalled();
    s2();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('hydrate lê o cache só quando o store está vazio', async () => {
    readCache.mockResolvedValueOnce({ savedAt: 1, zones: { [A]: owned(A, 'owls') }, meta: { [A]: { name: 'Salvo', city: null } } });
    await useZones.getState().hydrate();
    expect(useZones.getState().zones[A].owner).toBe('owls');
    expect(useZones.getState().meta[A].name).toBe('Salvo');
  });

  it('mergeServerZones é puro', () => {
    const before = { zones: { [A]: owned(A, 'volt') }, meta: {} };
    const after = mergeServerZones(before, [server(B, 'owls', 'Novo')]);
    expect(Object.keys(before.zones)).toEqual([A]);
    expect(Object.keys(after.zones).sort()).toEqual([A, B]);
  });
});
