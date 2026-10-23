/**
 * @jest-environment node
 *
 * T7.1.18 — isolamento do modo demonstração (D-77): nada da demonstração se mistura com uma conta real.
 *  - caches de zonas e perfil e a fila offline usam chaves/arquivos próprios;
 *  - na web, a fila da demonstração nem toca o localStorage;
 *  - o transporte real recusa enviar em nome de um usuário `demo-…`;
 *  - com `EXPO_PUBLIC_DEMO=1`, a URL e a chave do Supabase são ignoradas.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createDemoClient } from '@/services/api/demo';
import { isBackendConfigured, isDemoMode, parseDemoFlag, readEnv } from '@/services/api/env';
import { cacheKey as profileKey } from '@/services/api/profile-cache';
import { cacheKey as profileKeyWeb } from '@/services/api/profile-cache.web';
import { cacheKey as zonesKey } from '@/services/api/zones-cache';
import { cacheKey as zonesKeyWeb } from '@/services/api/zones-cache.web';
import { DEMO_QUEUE_DB_NAME, QUEUE_DB_NAME, queueDbName } from '@/services/offline/queue';
import { DEMO_QUEUE_KEY, queueKey } from '@/services/offline/queue.web';
import { createSupabaseTransport, DEMO_ISOLATION } from '@/services/sync/transport';

const SRC = join(__dirname, '..');

describe('chaves e arquivos separados', () => {
  it('cache de zonas e de perfil (nativo e web)', () => {
    expect(zonesKey(false)).toBe('nomade.zones.v1');
    expect(profileKey(false)).toBe('nomade.profile.v1');
    for (const [real, demo] of [
      [zonesKey(false), zonesKey(true)],
      [profileKey(false), profileKey(true)],
      [zonesKeyWeb(false), zonesKeyWeb(true)],
      [profileKeyWeb(false), profileKeyWeb(true)],
    ]) {
      expect(demo).not.toBe(real);
      expect(demo).toContain('.demo.');
    }
    // Sem a variável, o app real continua com as chaves de sempre (nenhum cache existente se perde).
    expect(isDemoMode()).toBe(false);
    expect(zonesKey()).toBe('nomade.zones.v1');
  });

  it('fila offline: outro banco SQLite e outra chave na web', () => {
    expect(queueDbName(false)).toBe(QUEUE_DB_NAME);
    expect(queueDbName(true)).toBe(DEMO_QUEUE_DB_NAME);
    expect(DEMO_QUEUE_DB_NAME).not.toBe(QUEUE_DB_NAME);
    expect(queueKey(false)).toBe('nomade.queue.v1');
    expect(queueKey(true)).toBe(DEMO_QUEUE_KEY);
  });
});

describe('fila da web no modo demonstração', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('fica só na memória: não lê nem grava o localStorage da conta real', async () => {
    const storage = { getItem: jest.fn(() => JSON.stringify({ runs: [{ id: 'real' }], points: {} })), setItem: jest.fn(), removeItem: jest.fn() };
    (globalThis as { localStorage?: unknown }).localStorage = storage;
    let getQueueStore: typeof import('@/services/offline/queue.web').getQueueStore = () => {
      throw new Error('módulo não carregado');
    };
    jest.isolateModules(() => {
      jest.doMock('@/services/api/env', () => ({ isDemoMode: () => true }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      getQueueStore = require('@/services/offline/queue.web').getQueueStore;
    });
    const store = getQueueStore();
    await store.createRun({ id: 'demo-run', userId: 'demo-corredor', mission: 'livre', ghostPace: null, startedAt: 1, simulated: true }, 1);
    expect((await store.listRuns()).map((r) => r.id)).toEqual(['demo-run']);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('transporte real recusa usuário de demonstração', () => {
  const body = { activityId: 'a', deviceId: 'd', fromSeq: 0, toSeq: 0, points: [], signature: 's' };

  it('cliente real com sessão demo-… não chama a function', async () => {
    const invoke = jest.fn(async () => ({ data: { accepted: 1, duplicates: 0, lastSeq: 0 }, error: null }));
    const client = { functions: { invoke }, auth: { getSession: async () => ({ data: { session: { user: { id: 'demo-corredor' } } } }), refreshSession: async () => ({ data: { session: null }, error: null }) } };
    const t = createSupabaseTransport(() => client as never);
    for (const r of [await t.ingest(body), await t.finish({ activityId: 'a', lastSeq: 0 }), await t.registerDevice({ deviceId: 'd', secret: 's', platform: 'web' })]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe(DEMO_ISOLATION);
    }
    expect(invoke).not.toHaveBeenCalled();
  });

  it('cliente real com usuário real segue normal', async () => {
    const invoke = jest.fn(async () => ({ data: { accepted: 1, duplicates: 0, lastSeq: 0 }, error: null }));
    const client = { functions: { invoke }, auth: { getSession: async () => ({ data: { session: { user: { id: '6f1c0a52-0000-4000-8000-000000000001' } } } }) } };
    expect((await createSupabaseTransport(() => client as never).ingest(body)).ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('o cliente de demonstração (em memória) é aceito: a corrida simulada fecha nele', async () => {
    const demo = createDemoClient({ clock: () => Date.parse('2026-10-23T12:00:00Z') });
    const r = await createSupabaseTransport(() => demo as never).registerDevice({ deviceId: 'd1', secret: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=', platform: 'web' });
    expect(r).toEqual({ ok: true, data: { deviceId: 'd1' } });
  });
});

describe('ligar o modo demonstração', () => {
  it('só "1" ou "true" ligam', () => {
    expect(parseDemoFlag('1')).toBe(true);
    expect(parseDemoFlag(' TRUE ')).toBe(true);
    expect(parseDemoFlag('0')).toBe(false);
    expect(parseDemoFlag('')).toBe(false);
    expect(parseDemoFlag(undefined)).toBe(false);
  });

  it('com a variável, URL, chave e login social do Supabase são ignorados', () => {
    const e = readEnv({
      EXPO_PUBLIC_DEMO: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://projeto-real.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'chave-real',
      EXPO_PUBLIC_AUTH_PROVIDERS: 'google',
    });
    expect(e).toEqual({ supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true });
    expect(isBackendConfigured(e)).toBe(true);
    const real = readEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://projeto-real.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'chave-real' });
    expect(real.demo).toBe(false);
    expect(real.supabaseUrl).toBe('https://projeto-real.supabase.co');
  });

  it('a costura é uma só: só supabase.ts decide entre o cliente real e o de demonstração', () => {
    const seam = readFileSync(join(SRC, 'services', 'api', 'supabase.ts'), 'utf8');
    expect(seam).toMatch(/if \(isDemoMode\(env\)\) return asSupabaseClient\(getDemoClient\(\)\);/);
  });
});
