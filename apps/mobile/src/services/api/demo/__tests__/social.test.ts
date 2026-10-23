/**
 * @jest-environment node
 *
 * Pares de demonstração da E8 (T7.2.5): feed da crew, reações e `record_share`, pelos repositórios reais
 * (`getSupabase()` no modo demonstração), sem rede.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { distanceMeters } from '@/domain/geo';
import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { listCrewFeed, reactToFeedItem, type FeedPage } from '../../feed-repo';
import { recordShare } from '../../share-repo';
import { createDemoClient, setDemoClient } from '..';
import { FEED_ROUTE_MAX_POINTS, thinPieces } from '../social';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z');
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

describe('feed da crew de demonstração', () => {
  let page: FeedPage;
  const client = createDemoClient({ clock: () => NOW });

  beforeAll(async () => {
    setDemoClient(client);
    page = expectOk(await listCrewFeed());
  });

  it('6 corridas da crew, da mais recente para a mais antiga, todas marcadas como demonstração', () => {
    expect(page.crew).toMatchObject({ name: 'Flamboyant Runners', tag: 'FLR', faction: 'striders' });
    expect(page.items).toHaveLength(6);
    expect(page.items.filter((i) => i.you)).toHaveLength(3);
    expect(page.items.every((i) => i.isDemo)).toBe(true);
    const created = page.items.map((i) => Date.parse(i.createdAt));
    expect([...created].sort((a, b) => b - a)).toEqual(created);
    expect(page.nextBefore).toBeNull();
  });

  it('sem hora no item: só a data local', () => {
    for (const i of page.items) expect(i.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rota cortada: nenhum ponto dentro da zona de privacidade, nem perto do começo e do fim; ≤ 80 pontos', () => {
    const zone = client.db.tables.privacy_zones.find((z) => z.user_id === DEMO_USER_ID)!;
    const center = { lat: Number(zone.lat), lng: Number(zone.lng) };
    for (const item of page.items) {
      if (!item.route) continue;
      const pts = item.route.pieces.flat();
      expect(pts.length).toBeLessThanOrEqual(FEED_ROUTE_MAX_POINTS);
      // Precisão 4 da polyline ≈ 8 m de erro; a folga mínima do corte é 25 m.
      if (item.you) for (const p of pts) expect(distanceMeters(p, center)).toBeGreaterThan(Number(zone.radius_m) + 10);
      if (item.activityId) {
        const raw = client.db.pointsOf(item.activityId);
        const start = { lat: Number(raw[0].lat), lng: Number(raw[0].lng) };
        const end = { lat: Number(raw[raw.length - 1].lat), lng: Number(raw[raw.length - 1].lng) };
        for (const p of pts) {
          expect(distanceMeters(p, start)).toBeGreaterThan(140);
          expect(distanceMeters(p, end)).toBeGreaterThan(140);
        }
      }
    }
    expect(page.items.some((i) => i.route)).toBe(true);
  });

  it('colega da crew não recebe o id da corrida de outra pessoa', () => {
    for (const i of page.items.filter((x) => !x.you)) expect(i.activityId).toBeNull();
  });

  it('"Bora!": põe, troca e tira a reação; o contador acompanha', async () => {
    const mate = page.items.find((i) => !i.you)!;
    const before = mate.reactions.bora;
    const put = expectOk(await reactToFeedItem(mate.id, 'bora'));
    expect(put.myReaction).toBe('bora');
    expect(put.reactions.bora).toBe(before + 1);
    const swap = expectOk(await reactToFeedItem(mate.id, 'fogo'));
    expect(swap.reactions.bora).toBe(before);
    expect(swap.myReaction).toBe('fogo');
    const off = expectOk(await reactToFeedItem(mate.id, null));
    expect(off.myReaction).toBeNull();
    const again = expectOk(await listCrewFeed());
    expect(again.items.find((i) => i.id === mate.id)!.myReaction).toBeNull();
  });

  it('ninguém reage à própria corrida; item fora do feed não existe', async () => {
    const mine = page.items.find((i) => i.you)!;
    const self = await reactToFeedItem(mine.id, 'bora');
    expect(!self.ok && self.error.detail).toBe('KUDOS_SELF');
    const missing = await reactToFeedItem('feed-que-nao-existe', 'bora');
    expect(!missing.ok && missing.error.code).toBe('NOT_FOUND');
  });

  it('teto de 200 reações por dia (KUDOS_LIMIT)', async () => {
    const mate = page.items.find((i) => !i.you)!;
    let last: Awaited<ReturnType<typeof reactToFeedItem>> | null = null;
    for (let i = 0; i < 205 && (!last || last.ok); i++) last = await reactToFeedItem(mate.id, i % 2 ? 'bora' : 'raio');
    expect(last && !last.ok && last.error.detail).toBe('KUDOS_LIMIT');
  });

  it('paginação por cursor', async () => {
    const first = expectOk(await listCrewFeed({ limit: 4 }));
    expect(first.items).toHaveLength(4);
    expect(first.nextBefore).not.toBeNull();
    const second = expectOk(await listCrewFeed({ before: first.nextBefore, limit: 4 }));
    expect(second.items).toHaveLength(2);
    expect(second.nextBefore).toBeNull();
    expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(6);
  });

  it('record_share só para a própria corrida', async () => {
    const mine = page.items.find((i) => i.you && i.activityId)!;
    expect(expectOk(await recordShare(mine.activityId!))).toEqual({ recorded: true, completedMissions: 0 });
    const other = await recordShare('demo-revisao-1');
    expect(!other.ok && other.error.code).toBe('NOT_FOUND');
  });
});

describe('feed fora de crew e afinamento da rota', () => {
  it('conta nova sem crew: crew nula e lista vazia (estado "Entre numa crew")', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'vazio' }));
    expect(expectOk(await listCrewFeed())).toEqual({ crew: null, items: [], nextBefore: null });
  });

  it('thinPieces mantém as pontas de cada pedaço e respeita o teto', () => {
    const line = (n: number, lat: number) => Array.from({ length: n }, (_, i) => ({ lat, lng: -49 + i * 0.0001 }));
    const pieces = [line(300, -16.7), line(100, -16.71)];
    const thin = thinPieces(pieces);
    expect(thin.reduce((n, p) => n + p.length, 0)).toBeLessThanOrEqual(FEED_ROUTE_MAX_POINTS);
    thin.forEach((p, i) => {
      expect(p[0]).toEqual(pieces[i][0]);
      expect(p[p.length - 1]).toEqual(pieces[i][pieces[i].length - 1]);
    });
    expect(thinPieces([line(5, 0)])).toEqual([line(5, 0)]);
  });
});
