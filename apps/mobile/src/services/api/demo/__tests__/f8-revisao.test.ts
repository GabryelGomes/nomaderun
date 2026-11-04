/**
 * @jest-environment node
 *
 * F8 · D (E9): pares de demonstração das correções da revisão (migration 20261104120300) — o eco da crew respeita
 * "mostrar mapa no feed" (M2) e só conta colega do mesmo tipo de conta (B5); `faction_activity()` sem sessão só
 * devolve o time do selo (B1), e o parser do app aceita os dois formatos (com e sem contagens).
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { getCrewEcho } from '../../crews-repo';
import { parseFactionActivity } from '../../faction-activity-repo';
import { createDemoClient, setDemoClient } from '..';
import type { Row } from '../db';
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

function login() {
  const client = createDemoClient({ clock: () => NOON_BRT });
  setDemoClient(client);
  return client;
}

const matesOf = (db: ReturnType<typeof login>['db']) => {
  const crewId = db.crewOf(DEMO_USER_ID);
  return db.tables.crew_members
    .filter((m: Row) => m.crew_id === crewId && m.user_id !== DEMO_USER_ID)
    .map((m: Row) => String(m.user_id));
};

describe('M2 — eco da crew respeita "mostrar mapa no feed" (demonstração)', () => {
  it('o colega que esconde o mapa sai do eco; todos escondendo, sem eco', async () => {
    const { db } = login();
    const first = expectOk(await getCrewEcho());
    if (!first || !first.available) throw new Error('esperava eco');
    const hidden = db.tables.profiles.find((p: Row) => p.username === first.mateUsername);
    if (!hidden) throw new Error('colega do eco não encontrado');
    DEMO_RPC_HANDLERS.set_feed_settings(db, String(hidden.id), { p_show_map: false });
    const second = expectOk(await getCrewEcho());
    expect(second && second.available ? second.mateUsername : null).not.toBe(first.mateUsername);
    for (const id of matesOf(db)) DEMO_RPC_HANDLERS.set_feed_settings(db, id, { p_show_map: false });
    expect(expectOk(await getCrewEcho())).toBeNull();
  });
});

describe('B5 — eco só com colega do mesmo tipo de conta (demonstração)', () => {
  it('colega que não é de demonstração não entra; o eco vem marcado como demonstração', async () => {
    const { db } = login();
    const echo = expectOk(await getCrewEcho());
    if (!echo || !echo.available) throw new Error('esperava eco');
    expect(echo.isDemo).toBe(true);
    for (const id of matesOf(db)) {
      const p = db.profile(id);
      if (p) p.is_demo = false;
    }
    expect(expectOk(await getCrewEcho())).toBeNull();
  });
});

describe('B1 — parser de faction_activity nos dois formatos', () => {
  it('sem contagens (sem sessão, servidor novo): selo do servidor, validado', () => {
    const p = parseFactionActivity({ needsBoost: 'owls', isDemo: false });
    expect(p).toMatchObject({ available: true, counts: null, total: null, needsBoost: 'owls', isDemo: false });
    expect(parseFactionActivity({ needsBoost: 'lobos', isDemo: false }).needsBoost).toBeNull();
    expect(parseFactionActivity({ needsBoost: null }).needsBoost).toBeNull();
    expect(parseFactionActivity(null)).toMatchObject({ counts: null, needsBoost: null, isDemo: false });
  });

  it('com contagens (sessão, ou servidor antigo sem sessão): o selo sai das contagens pela regra do domain', () => {
    const p = parseFactionActivity({ counts: { striders: 3, coyotes: 3, owls: 1, volt: 2 }, needsBoost: 'volt', isDemo: false });
    expect(p.counts).toEqual({ striders: 3, coyotes: 3, owls: 1, volt: 2 });
    expect(p.total).toBe(9);
    expect(p.needsBoost).toBe('owls');
  });
});
