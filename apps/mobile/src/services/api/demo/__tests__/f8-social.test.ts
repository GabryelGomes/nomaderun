/**
 * @jest-environment node
 *
 * F8 · C2: pares de demonstração da migration 20261104120200 — `faction_activity()` sem sessão (D-91), a moldura
 * "Recruta" concedida em `choose_faction`, o `activityId` só no item do próprio feed, o nome da zona com a
 * referência (`withNearRef`) e o texto único dos avisos de zona (`zoneNoticeText`).
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { zoneNoticeText, zonePlaceName } from '@/domain/reminders';
import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { fetchOwnedCosmetics } from '../../engagement-repo';
import { getFactionActivity } from '../../faction-activity-repo';
import { toFeedItem } from '../../feed-repo';
import { toServerZone } from '../../zones-repo';
import { withNearRef } from '../../zone-name';
import { createDemoClient, setDemoClient } from '..';
import { DEMO_RPC_HANDLERS } from '../rpc';
/* eslint-enable import/first */

const NOON_BRT = Date.parse('2026-10-23T15:00:00Z');
const realFetch = globalThis.fetch;
const fetchSpy = jest.fn(() => Promise.reject(new Error('rede proibida no modo demonstração')));

beforeAll(() => {
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  expect(fetchSpy).not.toHaveBeenCalled();
});

function expectOk<T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(`esperava ok, veio erro: ${r.error.message}`);
  return r.data;
}

describe('C2 — faction_activity sem sessão (escolha do time antes da conta)', () => {
  it('responde sem login, só com as 4 contagens, marcada como demonstração', async () => {
    const client = createDemoClient({ clock: () => NOON_BRT });
    setDemoClient(client);
    await client.auth.signOut();
    const raw = DEMO_RPC_HANDLERS.faction_activity(client.db, null, {}) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['counts', 'isDemo', 'total', 'windowDays']);
    const fa = expectOk(await getFactionActivity());
    if (!fa.available) throw new Error('esperava disponível');
    expect(Object.keys(fa.counts).sort()).toEqual(['coyotes', 'owls', 'striders', 'volt']);
    expect(fa.isDemo).toBe(true);
    expect(fa.since).toBe(0);
  });
});

describe('C2 — moldura "Recruta" vem do servidor', () => {
  it('quem já tem time começa com ela; choose_faction concede de forma idempotente', async () => {
    const client = createDemoClient({ clock: () => NOON_BRT });
    setDemoClient(client);
    expect((await fetchOwnedCosmetics())?.map((c) => c.id)).toContain('moldura-recruta');
    const me = client.db.profile(DEMO_USER_ID)!;
    client.db.tables.user_cosmetics = client.db.tables.user_cosmetics.filter((c) => c.user_id !== DEMO_USER_ID);
    const first = DEMO_RPC_HANDLERS.choose_faction(client.db, DEMO_USER_ID, { p_faction: me.faction }) as Record<string, unknown>;
    const again = DEMO_RPC_HANDLERS.choose_faction(client.db, DEMO_USER_ID, { p_faction: me.faction }) as Record<string, unknown>;
    expect(first.recruitFrame).toEqual({ id: 'moldura-recruta', unlockedNow: true });
    expect(again.recruitFrame).toEqual({ id: 'moldura-recruta', unlockedNow: false });
    expect(client.db.tables.user_cosmetics.filter((c) => c.user_id === DEMO_USER_ID && c.cosmetic_id === 'moldura-recruta')).toHaveLength(1);
  });
});

describe('C2 — activityId só no item da própria pessoa', () => {
  it('o parser aceita o id só quando you = true', () => {
    expect(toFeedItem({ id: 'f1', you: true, activityId: 'a-1' }).activityId).toBe('a-1');
    expect(toFeedItem({ id: 'f2', you: false, activityId: 'a-2' }).activityId).toBeNull();
    expect(toFeedItem({ id: 'f3', you: true }).activityId).toBeNull();
    expect(toFeedItem({ id: 'f4', you: true, activityId: 'x y;' }).activityId).toBeNull();
  });
});

describe('C2 — nome da zona com a referência do servidor', () => {
  it('"Jardim Goiás 59" + "perto do Estádio" = "Jardim Goiás · perto do Estádio"; sem referência, como veio', () => {
    expect(withNearRef('Jardim Goiás 59', 'perto do Estádio')).toBe('Jardim Goiás · perto do Estádio');
    expect(withNearRef('Jardim Goiás 59', null)).toBe('Jardim Goiás 59');
    expect(withNearRef('Jardim Goiás · perto do Lago', 'perto do Estádio')).toBe('Jardim Goiás · perto do Lago');
    expect(withNearRef('Jardim Goiás 59', '<script>')).toBe('Jardim Goiás 59');
    expect(toServerZone({ id: 'z', name: 'Setor Sul 3', nearRef: 'perto do Parque Areião' }).meta.name).toBe('Setor Sul · perto do Parque Areião');
    expect(toServerZone({ id: 'z', name: 'Setor Sul 3', near_ref: 'perto do Parque Areião' }).meta.name).toBe('Setor Sul · perto do Parque Areião');
    expect(toServerZone({ id: 'z', name: null }).meta.name).toBeNull();
  });
});

describe('C2 — avisos de zona num formato só', () => {
  it('título em caixa de frase, zona sem número e "até 02h30"', () => {
    const until = Date.parse('2026-11-05T05:30:00Z'); // 02h30 em Brasília
    expect(zoneNoticeText('invasion', { place: zonePlaceName('Parque Flamboyant'), team: 'Urban Coyotes', until })).toEqual({
      title: 'Alerta de invasão',
      body: 'Os Urban Coyotes estão pintando suas ruas em Parque Flamboyant. Defenda até 02h30.',
    });
    expect(zoneNoticeText('territory_lost', { place: zonePlaceName('Vila Redenção 9'), team: 'Night Owls' }).body).toBe(
      'Vila Redenção agora é dos Night Owls. Corra lá para pintar de volta.',
    );
  });

  it('a central de demonstração usa o mesmo formato (sem "Invasão!" nem "próximas 24h")', async () => {
    const client = createDemoClient({ clock: () => NOON_BRT });
    setDemoClient(client);
    const { data } = await client.from('notifications').select('*');
    const zone = ((data ?? []) as Record<string, unknown>[]).filter((n) => n.type === 'invasion' || n.type === 'territory_lost');
    expect(zone.length).toBeGreaterThan(0);
    for (const n of zone) {
      expect(String(n.title)).not.toMatch(/Invasão!|!/);
      expect(String(n.body)).not.toMatch(/próximas 24h|\s\d+(\/\d+)?(\.| agora)/);
    }
    const inv = zone.find((n) => n.type === 'invasion');
    if (inv) expect(String(inv.body)).toMatch(/Defenda até \d{2}h\d{2}\.$/);
  });
});
