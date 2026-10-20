import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { bboxAround, bboxParam, clampBbox, fetchZoneDetail, fetchZonesInBbox, subscribeZones, toServerZone } from '../zones-repo';

type AnyFn = (...args: any[]) => any;
const invoke = jest.fn<AnyFn>();
const removeChannel = jest.fn<AnyFn>();
let realtimeHandler: ((p: { new?: Record<string, unknown> }) => void) | null = null;
const channel = {
  on: jest.fn<AnyFn>((_e: string, _f: unknown, cb: typeof realtimeHandler) => {
    realtimeHandler = cb;
    return channel;
  }),
  subscribe: jest.fn<AnyFn>((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return channel;
  }),
};
const mockClient = { functions: { invoke }, channel: jest.fn<AnyFn>(() => channel), removeChannel };
jest.mock('../supabase', () => ({ requireSupabase: () => mockClient, getSupabase: () => mockClient }));


const H3 = '89a8c0e24a3ffff';

beforeEach(() => {
  jest.clearAllMocks();
  realtimeHandler = null;
});

describe('zones-repo', () => {
  it('converte o formato das functions (camelCase, ms)', () => {
    const z = toServerZone({ id: H3, name: 'Parque Flamboyant', city: 'Goiânia', owner: 'striders', influence: { striders: 1240, coyotes: 812 }, shield: 2, attacker: 'coyotes', attackStartedAt: 1000, blocked: false });
    expect(z.zone).toEqual({ id: H3, owner: 'striders', influence: { striders: 1240, coyotes: 812, owls: 0, volt: 0 }, shield: 2, attacker: 'coyotes', attackStartedAt: 1000, blocked: false });
    expect(z.meta).toEqual({ name: 'Parque Flamboyant', city: 'Goiânia' });
  });

  it('converte a linha do Realtime (snake_case, ISO) e ignora atacante sem ataque', () => {
    const z = toServerZone({ id: H3, name: null, owner: 'xx', influence: null, attacker: 'owls', attack_started_at: null });
    expect(z.zone.owner).toBeNull();
    expect(z.zone.attacker).toBeNull();
    expect(z.zone.attackStartedAt).toBeNull();
    expect(z.meta.name).toBeNull();
    expect(toServerZone({ id: H3, attack_started_at: '2026-10-20T12:00:00.000Z', attacker: 'owls' }).zone.attackStartedAt).toBe(Date.parse('2026-10-20T12:00:00.000Z'));
  });

  it('limita a caixa a 1 grau por lado (regra do servidor)', () => {
    const b = clampBbox({ minLng: -51, minLat: -18, maxLng: -48, maxLat: -16 });
    expect(b.maxLng - b.minLng).toBeLessThanOrEqual(1);
    expect(b.maxLat - b.minLat).toBeLessThanOrEqual(1);
    const around = bboxAround({ lat: -16.7, lng: -49.24 }, 2000);
    expect(around.minLat).toBeLessThan(-16.7);
    expect(around.maxLng).toBeGreaterThan(-49.24);
    expect(bboxParam({ minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 })).toBe('1.000000,2.000000,3.000000,4.000000');
  });

  it('GET /zones?bbox= devolve as zonas convertidas', async () => {
    invoke.mockResolvedValue({ data: { zones: [{ id: H3, name: 'X', owner: 'volt', influence: { volt: 50 }, shield: 0, attacker: null, attackStartedAt: null, blocked: false }] }, error: null });
    const r = await fetchZonesInBbox({ minLng: -49.25, minLat: -16.72, maxLng: -49.22, maxLat: -16.7 });
    expect(invoke).toHaveBeenCalledWith('zones?bbox=-49.250000%2C-16.720000%2C-49.220000%2C-16.700000', { method: 'GET', body: undefined });
    expect(r).toMatchObject({ ok: true, data: [{ zone: { id: H3, owner: 'volt' }, meta: { name: 'X' } }] });
  });

  it('sem internet vira erro NETWORK', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to fetch' } });
    const r = await fetchZonesInBbox({ minLng: 0, minLat: 0, maxLng: 0.1, maxLat: 0.1 });
    expect(r).toMatchObject({ ok: false, error: { code: 'NETWORK' } });
  });

  it('GET /zone?id= traz corredores e eventos', async () => {
    invoke.mockResolvedValue({
      data: { id: H3, name: 'Parque', owner: 'striders', influence: {}, shield: 1, attacker: null, attackStartedAt: null, blocked: false, updatedAt: 5, topRunners: [{ username: 'ana', faction: 'striders', rp: 120 }], events: [{ type: 'captured', faction: 'striders', from: 'coyotes', at: 9 }] },
      error: null,
    });
    const r = await fetchZoneDetail(H3);
    expect(invoke).toHaveBeenCalledWith(`zone?id=${H3}`, { method: 'GET', body: undefined });
    expect(r).toMatchObject({ ok: true, data: { updatedAt: 5, topRunners: [{ username: 'ana', rp: 120 }], events: [{ type: 'captured', from: 'coyotes', at: 9 }] } });
  });

  it('Realtime entrega as linhas convertidas e cancela o canal', () => {
    const got: string[] = [];
    const statuses: string[] = [];
    const sub = subscribeZones((z) => got.push(`${z.zone.id}:${z.zone.owner}`), (s) => statuses.push(s));
    expect(sub.ok).toBe(true);
    realtimeHandler?.({ new: { id: H3, owner: 'owls' } });
    realtimeHandler?.({ new: {} });
    expect(got).toEqual([`${H3}:owls`]);
    expect(statuses).toEqual(['SUBSCRIBED']);
    if (sub.ok) sub.data.unsubscribe();
    expect(removeChannel).toHaveBeenCalled();
  });
});
