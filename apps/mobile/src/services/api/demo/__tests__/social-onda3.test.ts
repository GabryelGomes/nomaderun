/**
 * @jest-environment node
 *
 * T7.3.7 — pares de demonstração da E8 na onda 3: Realtime dos aplausos (`kudos`) e o recap semanal
 * (`POST /weekly-recap` e `rpc('weekly_recap')`), pelos repositórios reais no modo demonstração, sem rede.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { distanceMeters } from '@/domain/geo';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { listCrewFeed, reactToFeedItem, subscribeKudosCounts, type KudosCounts } from '../../feed-repo';
import { listPrivacyZones } from '../../privacy-zones-repo';
import { getWeeklyRecap } from '../../recap-repo';
import { createDemoClient, setDemoClient } from '..';
import { DEMO_LIVE_KUDO_MS, FEED_ROUTE_MAX_POINTS } from '../social';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z');
jest.setTimeout(30_000);
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

const flush = () => new Promise((r) => setImmediate(r));

describe('Realtime dos aplausos (demonstração, revisão M4)', () => {
  it('cada reação sai como os contadores absolutos do item, sem quem reagiu, iguais aos do RPC', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    const page = expectOk(await listCrewFeed());
    const changes: KudosCounts[] = [];
    const statuses: string[] = [];
    const sub = expectOk(subscribeKudosCounts((c) => changes.push(c), (s) => statuses.push(s)));
    await flush();
    expect(statuses).toContain('SUBSCRIBED');
    const mate = page.items.find((i) => !i.you && i.myReaction === null)!;
    const put = expectOk(await reactToFeedItem(mate.id, 'bora'));
    const swap = expectOk(await reactToFeedItem(mate.id, 'fogo'));
    const off = expectOk(await reactToFeedItem(mate.id, null));
    expect(changes.map((c) => c.itemId)).toEqual([mate.id, mate.id, mate.id]);
    expect(changes.map((c) => c.kudos)).toEqual([put.kudos, swap.kudos, off.kudos]);
    expect(off.kudos).toEqual(mate.kudos);
    for (const c of changes) expect(Object.keys(c)).toEqual(['itemId', 'kudos']);
    sub.unsubscribe();
  });

  it('um colega aplaude ao vivo a corrida mais recente, uma vez, e o feed conta igual', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      setDemoClient(createDemoClient({ clock: () => NOW }));
      const before = expectOk(await listCrewFeed());
      const mine = before.items.find((i) => i.you)!;
      const changes: KudosCounts[] = [];
      const sub = expectOk(subscribeKudosCounts((c) => changes.push(c)));
      await flush();
      jest.advanceTimersByTime(DEMO_LIVE_KUDO_MS + 10);
      await flush();
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({ itemId: mine.id, kudos: { ...mine.kudos, bora: mine.kudos.bora + 1 } });
      const after = expectOk(await listCrewFeed());
      expect(after.items.find((i) => i.id === mine.id)!.kudos).toEqual(changes[0].kudos);
      // não repete
      expectOk(await listCrewFeed());
      jest.advanceTimersByTime(DEMO_LIVE_KUDO_MS * 3);
      await flush();
      expect(changes).toHaveLength(1);
      sub.unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('recap semanal de demonstração', () => {
  it('POST /weekly-recap: semana de segunda a domingo, números coerentes e rotas cortadas fora das zonas', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    const r = expectOk(await getWeeklyRecap());
    expect(r.weekStart).toBe('2026-10-19');
    expect(r.weekEnd).toBe('2026-10-25');
    expect(r.final).toBe(false);
    expect(r.isDemo).toBe(true);
    expect(r.dayMeters).toHaveLength(7);
    expect(r.meters).toBeCloseTo(r.dayMeters.reduce((s, m) => s + m, 0), 0);
    expect(r.runs).toBeGreaterThan(0);
    expect(r.routes.length).toBeGreaterThan(0);
    expect(r.routes.length).toBeLessThanOrEqual(Math.min(3, r.runs));
    // nenhum ponto desenhado dentro das zonas de privacidade da conta de demonstração
    const zones = expectOk(await listPrivacyZones());
    expect(zones.length).toBeGreaterThan(0);
    for (const route of r.routes) {
      const pts = route.pieces.flat();
      expect(pts.length).toBeLessThanOrEqual(FEED_ROUTE_MAX_POINTS);
      for (const p of pts) for (const z of zones) expect(distanceMeters(p, z)).toBeGreaterThan(z.radiusM);
    }
  });

  it('semana pedida e semana vazia', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    const old = expectOk(await getWeeklyRecap('2025-01-08'));
    expect(old.weekStart).toBe('2025-01-06'); // a segunda da semana pedida
    expect(old.runs).toBe(0);
    expect(old.routes).toEqual([]);
    const fn = expectOk(await getWeeklyRecap('2026-10-19'));
    expect(fn.weekStart).toBe('2026-10-19');
    expect(fn.final).toBe(false);
  });
});
