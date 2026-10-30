/**
 * @jest-environment node
 *
 * F8 · A2: pares de demonstração de `faction_activity()` (D-96), `crew_echo()` e `extras.milestones`, pela costura
 * real dos repositórios (`getSupabase()` com `EXPO_PUBLIC_DEMO=1`), sem rede.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { factionNeedingBoost } from '@/domain/faction-activity';
import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { paintMilestonesOf } from '../../activities-repo';
import { getCrewEcho, parseCrewEcho } from '../../crews-repo';
import { getFactionActivity, parseFactionActivity } from '../../faction-activity-repo';
import { createDemoClient, setDemoClient } from '..';
import { msOf, type Row } from '../db';
import { withPaintMilestones } from '../f8';
/* eslint-enable import/first */

const NOON_BRT = Date.parse('2026-10-23T15:00:00Z');
const NIGHT_BRT = Date.parse('2026-10-24T02:00:00Z'); // 23h em Brasília
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

function login(now: number) {
  const client = createDemoClient({ clock: () => now });
  setDemoClient(client);
  return client;
}

describe('D-96 — faction_activity na demonstração', () => {
  it('só contagens dos 4 times, marcadas como demonstração, e o selo pela regra do domain', async () => {
    login(NOON_BRT);
    const fa = expectOk(await getFactionActivity());
    if (!fa.available) throw new Error('esperava disponível');
    expect(Object.keys(fa.counts).sort()).toEqual(['coyotes', 'owls', 'striders', 'volt']);
    expect(fa.total).toBe(Object.values(fa.counts).reduce((a, b) => a + b, 0));
    expect(fa.total).toBeGreaterThan(0);
    expect(fa.isDemo).toBe(true);
    expect(fa.needsBoost).toBe(factionNeedingBoost(fa.counts));
  });

  it('parser: lixo vira zero, nunca número inventado', () => {
    const p = parseFactionActivity({ counts: { striders: '3', owls: -2, volt: 'x' }, isDemo: false });
    expect(p.counts).toEqual({ striders: 3, coyotes: 0, owls: 0, volt: 0 });
    expect(p.total).toBe(3);
    expect(p.needsBoost).toBeNull();
    expect(p.isDemo).toBe(false);
  });
});

describe('eco da crew na demonstração', () => {
  it('de dia: um colega da crew, contagem pequena e janela do aviso 07h–22h; à noite: nada', async () => {
    login(NOON_BRT);
    const echo = expectOk(await getCrewEcho());
    expect(echo).not.toBeNull();
    if (!echo || !echo.available) throw new Error('esperava eco');
    expect(echo.mateUsername.length).toBeGreaterThan(0);
    expect(echo.cells).toBeGreaterThanOrEqual(2);
    expect(echo.isDemo).toBe(true);
    expect(echo.day).toBe('2026-10-22');
    expect(new Date(echo.notifyFrom).toISOString()).toBe('2026-10-23T10:00:00.000Z');
    expect(new Date(echo.notifyUntil).toISOString()).toBe('2026-10-24T01:00:00.000Z');
    login(NIGHT_BRT);
    expect(expectOk(await getCrewEcho())).toBeNull();
  });

  it('parser: sem colega ou sem trecho não é eco', () => {
    expect(parseCrewEcho(null)).toBeNull();
    expect(parseCrewEcho({ mate: {}, cells: 3 })).toBeNull();
    expect(parseCrewEcho({ mate: { username: 'rafa' }, cells: 0 })).toBeNull();
    expect(parseCrewEcho({ day: '2026-10-22', mate: { username: 'rafa' }, cells: 3, othersCount: 1, totalCells: 4 })?.totalCells).toBe(4);
  });
});

describe('marcos da pintura (extras.milestones) na demonstração', () => {
  it('primeiro trecho 1 vez na vida (a corrida mais antiga) e idempotente; parser do app', async () => {
    const client = login(NOON_BRT);
    const db = client.db;
    const mine = db.tables.activities
      .filter((a: Row) => a.user_id === DEMO_USER_ID && a.scored === true)
      .sort((a: Row, b: Row) => (msOf(a.ended_at) ?? 0) - (msOf(b.ended_at) ?? 0));
    expect(mine.length).toBeGreaterThan(1);
    const newest = withPaintMilestones(db, DEMO_USER_ID, { activityId: mine[mine.length - 1].id } as Row);
    const oldest = withPaintMilestones(db, DEMO_USER_ID, { activityId: mine[0].id } as Row);
    const mNew = paintMilestonesOf(newest);
    const mOld = paintMilestonesOf(oldest);
    expect(mOld?.cells).toBeGreaterThan(0);
    expect(mOld?.firstPaint).toBe(true);
    expect(mNew?.firstPaint).toBe(false);
    // repetir devolve o mesmo (guardado em activities.v2_extras)
    expect(paintMilestonesOf(withPaintMilestones(db, DEMO_USER_ID, { activityId: mine[0].id } as Row))).toEqual(mOld);
    expect((mine[0].v2_extras as Row).milestones).toEqual(mOld);
  });

  it('parser: servidor antigo (sem milestones) → null; recorde só quando maior que o anterior', () => {
    expect(paintMilestonesOf({ extras: { contract: 2 } })).toBeNull();
    expect(paintMilestonesOf({ extras: { milestones: { firstPaint: false, cells: 30, cellsRecord: { value: 30, previous: 20 } } } })).toEqual({
      firstPaint: false,
      cells: 30,
      cellsRecord: { value: 30, previous: 20 },
    });
    expect(paintMilestonesOf({ extras: { milestones: { firstPaint: false, cells: 30, cellsRecord: { value: 10, previous: 20 } } } })?.cellsRecord).toBeNull();
  });
});
