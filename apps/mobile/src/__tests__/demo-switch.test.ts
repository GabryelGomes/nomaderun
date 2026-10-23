/**
 * @jest-environment node
 *
 * T7.2.10 — interruptor do modo demonstração em tempo de execução (`enterDemo`/`exitDemo`, D-77).
 * Aceite: entrar → correr → sair, e nenhum dado da demonstração sobra em cache, fila, chave do aparelho
 * ou store; a conta real (sessão, caches, fila e chave) não é tocada; nenhum `fetch` em todo o caminho.
 *
 * Só o armazenamento nativo é do teste (SQLite do Node no lugar do expo-sqlite, mapas no lugar do kv-store e
 * do SecureStore); a fila, o sync, o transporte, os caches, os repositórios e as stores são os do app.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { DEMO_CENTER } from '@/demo/demo-data';
import { DEMO_USER_ID } from '@/demo/world';

// expo-sqlite: cada nome de arquivo vira um SQLite do Node em memória (a fila real e a da demonstração).
jest.mock('expo-sqlite', () => {
  const dbs = new Map<string, unknown>();
  return {
    __dbs: dbs,
    openDatabaseAsync: async (name: string) => {
      if (!dbs.has(name)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { openNodeSqlite } = require('@/services/offline/__tests__/helpers/node-sqlite-db');
        dbs.set(name, openNodeSqlite());
      }
      return dbs.get(name);
    },
  };
});
// kv-store dos caches de zonas e perfil.
jest.mock('expo-sqlite/kv-store', () => {
  const kv = new Map<string, string>();
  return {
    __esModule: true,
    __kv: kv,
    default: {
      getItem: async (k: string) => kv.get(k) ?? null,
      setItem: async (k: string, v: string) => void kv.set(k, v),
      removeItem: async (k: string) => void kv.delete(k),
    },
  };
});
// Chave HMAC do aparelho (no app, SecureStore).
jest.mock('@/services/signing/key-storage', () => {
  const keys = new Map<string, string>();
  return {
    __keys: keys,
    keyStorage: {
      get: async (k: string) => keys.get(k) ?? null,
      set: async (k: string, v: string) => void keys.set(k, v),
      remove: async (k: string) => void keys.delete(k),
    },
  };
});
// GPS em segundo plano: sair com uma corrida da demonstração gravando precisa parar a tarefa.
jest.mock('@/services/location/tracker', () => ({ stopBackgroundUpdates: jest.fn(async () => undefined) }));
// O mock do jest-expo não gera UUID nem bytes: a corrida e a chave precisam de valores de verdade.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
  getRandomBytes: (n: number) => new Uint8Array(jest.requireActual<typeof import('node:crypto')>('node:crypto').randomBytes(n)),
}));

/* eslint-disable import/first */
import { loadProfile } from '@/features/auth/session-controller';
import { confirmRun, endRun, recordPoints, refreshLocalRuns, startRecording, wireSyncEvents } from '@/features/run/run-controller';
import { nearestNeutral, simulationRoute } from '@/features/run/simulation';
import * as authRepo from '@/services/api/auth-repo';
import { getDemoClient, isDemoClient } from '@/services/api/demo';
import { isBackendConfigured } from '@/services/api/env';
import { cacheKey as profileKey } from '@/services/api/profile-cache';
import { getSupabase } from '@/services/api/supabase';
import { cacheKey as zonesKey } from '@/services/api/zones-cache';
import { bboxAround } from '@/services/api/zones-repo';
import { enterDemo, exitDemo, isDemoActive, isDemoBuild, onDemoSwitch } from '@/services/demo-mode';
import { DEMO_QUEUE_DB_NAME, getQueueStore, QUEUE_DB_NAME } from '@/services/offline/queue';
import { createSqliteStore, type SqlDb } from '@/services/offline/sqlite-store';
import type { NewPoint } from '@/services/offline/types';
import { storageKey } from '@/services/signing/device-key';
import { getSyncEngine } from '@/services/sync/sync-service';
import { createSupabaseTransport, MODE_SWITCHED } from '@/services/sync/transport';
import { useGame } from '@/store/game-store';
import { useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
/* eslint-enable import/first */

const { __dbs: dbs } = jest.requireMock<{ __dbs: Map<string, SqlDb> }>('expo-sqlite');
const { __kv: kv } = jest.requireMock<{ __kv: Map<string, string> }>('expo-sqlite/kv-store');
const { __keys: keys } = jest.requireMock<{ __keys: Map<string, string> }>('@/services/signing/key-storage');
const { stopBackgroundUpdates } = jest.requireMock<{ stopBackgroundUpdates: jest.Mock }>('@/services/location/tracker');

const REAL_USER = '7d1f0f8e-0000-4000-8000-000000000001';
const REAL_RUN = 'b0b0b0b0-0000-4000-8000-000000000001';

const realFetch = globalThis.fetch;
const realXhr = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
const network = jest.fn((..._args: unknown[]) => {
  throw new Error('rede proibida no modo demonstração');
});

/**
 * O que a camada de features registra (pedido à E6a, `docs/QA.md` §16): zerar as stores a cada troca.
 * O teste usa o mesmo ouvinte que o app deve usar.
 */
const switches: boolean[] = [];
const resetStores = (active: boolean) => {
  switches.push(active);
  useGame.getState().resetForSignOut();
  useSession.getState().reset();
  useZones.getState().reset();
  useNotifications.getState().reset();
};
const offSwitch = onDemoSwitch(resetStores);
const relayed = jest.fn();

const realQueue = () => createSqliteStore(async () => dbs.get(QUEUE_DB_NAME)!);
const countRows = async (name: string) => {
  const db = dbs.get(name);
  if (!db) return { runs: 0, points: 0 };
  const runs = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM runs', []);
  const points = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM points', []);
  return { runs: runs?.n ?? 0, points: points?.n ?? 0 };
};
const demoKeys = () => [...kv.keys()].filter((k) => k.includes('.demo.'));

beforeAll(async () => {
  globalThis.fetch = network as unknown as typeof fetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = network;

  // A conta real que já estava neste aparelho: fila com uma corrida pendente, caches e chave HMAC.
  const queue = getQueueStore();
  await queue.createRun({ id: REAL_RUN, userId: REAL_USER, mission: 'livre', ghostPace: null, startedAt: 1, simulated: false }, 1);
  await queue.appendPoints(REAL_RUN, [{ lat: -16.7, lng: -49.2, t: 1, accuracy: 5, speed: 3, altitude: 750, mocked: false, steps: 2 }]);
  kv.set('nomade.zones.v1', '{"real":true}');
  kv.set('nomade.profile.v1', `{"id":"${REAL_USER}"}`);
  keys.set(storageKey(REAL_USER), '{"deviceId":"real","secret":"real","registered":true}');
  // O espelho fila → store se liga uma vez por processo, antes de qualquer troca (como no app).
  wireSyncEvents();
  getSyncEngine().subscribe(relayed);
});

afterAll(async () => {
  offSwitch();
  if (isDemoActive()) await exitDemo();
  globalThis.fetch = realFetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = realXhr;
});

describe('interruptor do modo demonstração', () => {
  it('desligado por padrão: sem servidor configurado e sem demonstração', () => {
    expect(isDemoBuild()).toBe(false);
    expect(isDemoActive()).toBe(false);
    expect(getSupabase()).toBeNull();
    expect(isBackendConfigured()).toBe(false);
  });

  it('sair sem ter entrado não faz nada', async () => {
    expect(await exitDemo()).toBe(false);
    expect(switches).toEqual([]);
  });

  it('entrar liga o servidor em memória, zera as stores e avisa uma vez', async () => {
    useGame.getState().completeOnboarding('Conta real', 'owls');
    expect(await enterDemo()).toBe(true);
    expect(await enterDemo()).toBe(false);
    expect(switches).toEqual([true]);
    expect(isDemoActive()).toBe(true);
    expect(isBackendConfigured()).toBe(true);
    expect(isDemoClient(getSupabase())).toBe(true);
    expect(useGame.getState().name).toBe('Corredor');
    expect(useGame.getState().faction).toBeNull();
  });

  it('a conta real ficou intacta ao entrar', async () => {
    expect(await countRows(QUEUE_DB_NAME)).toEqual({ runs: 1, points: 1 });
    expect(kv.get('nomade.zones.v1')).toBe('{"real":true}');
    expect(keys.has(storageKey(REAL_USER))).toBe(true);
    // A fila da demonstração é outro arquivo e não enxerga a corrida real.
    expect(await getQueueStore().listRuns()).toEqual([]);
    expect(dbs.has(DEMO_QUEUE_DB_NAME)).toBe(true);
  });

  it('correr na demonstração: perfil, zonas, corrida e resultado oficial, tudo no aparelho', async () => {
    const s = await authRepo.getCurrentSession();
    expect(s.ok && s.data?.userId).toBe(DEMO_USER_ID);
    useSession.getState().setSession(s.ok ? s.data : null);
    const profile = await loadProfile();
    expect(profile.ok && profile.data.faction).toBe('striders');

    await useZones.getState().loadBbox(bboxAround(DEMO_CENTER, 2500));
    const zones = useZones.getState().zones;
    const route = simulationRoute(nearestNeutral(zones));
    const outbound = route.slice(0, Math.ceil(route.length / 2));
    const t0 = Date.now() - outbound.length * 1000 - 60_000;
    const points: NewPoint[] = outbound.map((p, i) => ({ ...p, t: t0 + i * 1000, accuracy: 5, speed: 3.2, altitude: 750, mocked: false, steps: 3 }));

    const runId = await startRecording({ userId: DEMO_USER_ID, mission: 'livre', ghostPace: null, simulated: true, startedAt: points[0].t });
    for (let i = 0; i < points.length; i += 250) await recordPoints(runId, points.slice(i, i + 250));
    await endRun(runId, points[points.length - 1].t);
    const out = await confirmRun(runId, 5000);
    expect(out?.status).toBe('synced');
    expect(out?.official?.zones.some((z) => z.outcome === 'conquered')).toBe(true);
    await refreshLocalRuns(DEMO_USER_ID);
    expect(useGame.getState().localRuns.map((r) => r.id)).toContain(runId);
    // Os ouvintes do sync ligados antes da troca recebem os eventos do motor novo.
    expect(relayed).toHaveBeenCalledWith(expect.objectContaining({ id: runId, state: 'synced' }), expect.anything());

    // A demonstração deixou rastros no aparelho (o teste de saída precisa deles para valer).
    expect((await countRows(DEMO_QUEUE_DB_NAME)).runs).toBe(1);
    expect(kv.has(zonesKey(true))).toBe(true);
    expect(kv.has(profileKey(true))).toBe(true);
    expect(keys.has(storageKey(DEMO_USER_ID))).toBe(true);
  });

  it('sair apaga fila, caches, chave e stores da demonstração e volta à conta real', async () => {
    const demoClient = getDemoClient();
    const staleTransport = createSupabaseTransport();
    expect(await exitDemo()).toBe(true);
    expect(switches).toEqual([true, false]);
    expect(isDemoActive()).toBe(false);
    expect(getSupabase()).toBeNull();

    // Nada da demonstração sobra.
    expect(await countRows(DEMO_QUEUE_DB_NAME)).toEqual({ runs: 0, points: 0 });
    expect(demoKeys()).toEqual([]);
    expect(keys.has(storageKey(DEMO_USER_ID))).toBe(false);
    expect(useGame.getState().localRuns).toEqual([]);
    expect(useGame.getState().faction).toBeNull();
    expect(useSession.getState().session).toBeNull();
    expect(useSession.getState().profile).toBeNull();
    expect(Object.keys(useZones.getState().zones)).toEqual([]);
    expect(useNotifications.getState().items).toEqual([]);
    // O mundo em memória foi descartado: entrar de novo cria outro.
    expect(getDemoClient()).not.toBe(demoClient);

    // A conta real continua como estava.
    expect(await countRows(QUEUE_DB_NAME)).toEqual({ runs: 1, points: 1 });
    expect((await realQueue().getRun(REAL_RUN))?.state).toBe('recording');
    expect((await getQueueStore().listRuns()).map((r) => r.id)).toEqual([REAL_RUN]);
    expect(kv.get('nomade.zones.v1')).toBe('{"real":true}');
    expect(kv.get('nomade.profile.v1')).toBe(`{"id":"${REAL_USER}"}`);
    expect(keys.has(storageKey(REAL_USER))).toBe(true);

    // Um envio da demonstração que ainda estava em andamento não vai para o servidor do outro modo.
    const late = await staleTransport.finish({ activityId: 'x' } as never);
    expect(late.ok === false && late.error.code).toBe(MODE_SWITCHED);
    expect(await staleTransport.refreshSession()).toBe(false);
  });

  it('o motor antigo da demonstração não repassa eventos depois da troca', async () => {
    await enterDemo();
    const demoEngine = getSyncEngine();
    const store = getQueueStore();
    await exitDemo();
    relayed.mockClear();
    await store.createRun({ id: 'demo-tardia', userId: DEMO_USER_ID, mission: 'livre', ghostPace: null, startedAt: 1, simulated: true }, 1);
    // Sem pontos: o motor marca como falha e emite o evento, que não pode chegar ao espelho da conta real.
    await demoEngine.syncRun('demo-tardia');
    expect(relayed).not.toHaveBeenCalled();
    expect(useGame.getState().localRuns).toEqual([]);
  });

  it('entrar de novo começa limpo, mesmo com sobra de uma demonstração interrompida', async () => {
    expect((await countRows(DEMO_QUEUE_DB_NAME)).runs).toBe(1);
    stopBackgroundUpdates.mockClear();
    await enterDemo();
    expect(await getQueueStore().listRuns()).toEqual([]);
    // A sobra estava "gravando": a tarefa de GPS em segundo plano é parada junto.
    expect(stopBackgroundUpdates).toHaveBeenCalledTimes(1);
    await exitDemo();
    expect(await countRows(DEMO_QUEUE_DB_NAME)).toEqual({ runs: 0, points: 0 });
    expect(switches).toEqual([true, false, true, false, true, false]);
  });

  it('trocas seguidas não se intercalam', async () => {
    const order = await Promise.all([enterDemo(), exitDemo(), enterDemo(), exitDemo()]);
    expect(order).toEqual([true, true, true, true]);
    expect(isDemoActive()).toBe(false);
  });

  it('nenhum fetch nem XMLHttpRequest foi usado', () => {
    expect(network).not.toHaveBeenCalled();
  });
});
