/**
 * @jest-environment node
 *
 * T7.1.18 — aceite do modo demonstração (D-77): o fluxo entrar → correr com a simulação → resumo oficial
 * roda inteiro pelo código do app (session-controller, run-controller, fila, sync assinado com HMAC,
 * transporte, repositórios) contra o servidor de demonstração, SEM NENHUM `fetch`.
 * Só o relógio, a fila (memória) e a chave do aparelho (memória) são do teste.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';

import { DEMO_CENTER } from '@/demo/demo-data';
import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});
// O mock do jest-expo não gera UUID: a corrida precisa de um id de verdade.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
  getRandomBytes: (n: number) => new Uint8Array(jest.requireActual<typeof import('node:crypto')>('node:crypto').randomBytes(n)),
}));
// Sem kv-store nativo no Jest: o cache das zonas é só conveniência.
jest.mock('@/services/api/zones-cache', () => ({ readCachedZones: async () => null, writeCachedZones: async () => undefined }));
jest.mock('@/services/api/profile-cache', () => ({ readCachedProfile: async () => null, writeCachedProfile: async () => undefined }));

/* eslint-disable import/first */
import { loadProfile } from '@/features/auth/session-controller';
import { confirmRun, endRun, loadPlayerProgress, recordPoints, startRecording } from '@/features/run/run-controller';
import { nearestNeutral, simulationRoute } from '@/features/run/simulation';
import * as authRepo from '@/services/api/auth-repo';
import { createDemoClient, setDemoClient } from '@/services/api/demo';
import { isBackendConfigured } from '@/services/api/env';
import * as notificationsRepo from '@/services/api/notifications-repo';
import { bboxAround } from '@/services/api/zones-repo';
import { createMemoryStore } from '@/services/offline/memory-store';
import { setQueueStore } from '@/services/offline/queue';
import type { NewPoint } from '@/services/offline/types';
import { newDeviceKey, type DeviceKey } from '@/services/signing/device-key';
import { createSyncEngine } from '@/services/sync/sync-engine';
import { setSyncEngine } from '@/services/sync/sync-service';
import { createSupabaseTransport } from '@/services/sync/transport';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
/* eslint-enable import/first */

const T0 = Date.parse('2026-10-23T09:00:00Z');
let clock = T0;

const realFetch = globalThis.fetch;
const realXhr = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
const network = jest.fn((..._args: unknown[]) => {
  throw new Error('rede proibida no modo demonstração');
});

beforeAll(() => {
  globalThis.fetch = network as unknown as typeof fetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = network;
  setDemoClient(createDemoClient({ clock: () => clock }));
  // A fila do run-controller e a do sync são a mesma, como no app.
  const store = createMemoryStore();
  setQueueStore(store);
  const keys = new Map<string, DeviceKey>();
  const deps = { randomUUID: () => randomUUID(), randomBytes: (n: number) => new Uint8Array(randomBytes(n)) };
  const fresh = (u: string) => {
    const k = newDeviceKey(deps);
    keys.set(u, k);
    return k;
  };
  setSyncEngine(
    createSyncEngine({
      store,
      transport: createSupabaseTransport(),
      platform: 'web',
      now: () => clock,
      keys: {
        load: async (u) => keys.get(u) ?? fresh(u),
        save: async (u, k) => void keys.set(u, k),
        regenerate: async (u) => fresh(u),
      },
    }),
  );
});

afterAll(() => {
  globalThis.fetch = realFetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = realXhr;
  setSyncEngine(null);
  setQueueStore(null);
  setDemoClient(null);
});

describe('modo demonstração: entrar → correr (simulação) → resumo oficial, sem rede', () => {
  it('o app considera que há servidor e a sessão de demonstração já está aberta', async () => {
    expect(isBackendConfigured()).toBe(true);
    const s = await authRepo.getCurrentSession();
    expect(s.ok && s.data?.userId).toBe(DEMO_USER_ID);
  });

  it('entrar: sair e entrar de novo com qualquer senha volta ao corredor de demonstração', async () => {
    const sub = authRepo.onAuthChange((event, session) => {
      if (event === 'SIGNED_OUT') useSession.getState().setSession(null);
      else if (session) useSession.getState().setSession(session);
    });
    await authRepo.signOut();
    const res = await authRepo.signIn('qualquer@exemplo.invalid', 'qualquer-senha');
    expect(res.ok).toBe(true);
    await new Promise((r) => setImmediate(r));
    expect(useSession.getState().status).toBe('signedIn');
    const profile = await loadProfile();
    expect(profile.ok && profile.data.faction).toBe('striders');
    // Como o app ao abrir: XP, confiança, sequência e ritmos das últimas corridas vêm do servidor.
    expect((await loadPlayerProgress(DEMO_USER_ID)).ok).toBe(true);
    sub?.unsubscribe();
  });

  it('correr com a simulação e receber o resultado oficial calculado pelo domain', async () => {
    await useZones.getState().loadBbox(bboxAround(DEMO_CENTER, 2500));
    const zones = useZones.getState().zones;
    expect(Object.keys(zones).length).toBeGreaterThan(50);

    const route = simulationRoute(nearestNeutral(zones));
    const outbound = route.slice(0, Math.ceil(route.length / 2));
    const points: NewPoint[] = outbound.map((p, s) => ({ ...p, t: T0 + s * 1000, accuracy: 5, speed: 3.2, altitude: 750, mocked: false, steps: s % 5 === 0 ? 2 : 3 }));

    const runId = await startRecording({ userId: DEMO_USER_ID, mission: 'livre', ghostPace: null, simulated: true, startedAt: points[0].t });
    for (let i = 0; i < points.length; i += 250) await recordPoints(runId, points.slice(i, i + 250));
    clock = points[points.length - 1].t + 2000;
    const local = await endRun(runId, points[points.length - 1].t);
    expect(local?.summary?.source).toBe('provisional');

    const out = await confirmRun(runId, 5000);
    expect(out?.status).toBe('synced');
    const official = out!.official!;
    expect(official.status).toBe('valid');
    expect(official.meters).toBeGreaterThan(2000);
    const conquered = official.zones.find((z) => z.outcome === 'conquered');
    expect(conquered).toBeDefined();
    // O resumo provisório (aparelho) e o oficial (servidor de demonstração) usam o mesmo domain.
    expect(local!.summary!.meters).toBe(official.meters);
    expect(local!.summary!.rpTotal).toBe(official.rpTotal);

    // A zona conquistada muda de dono para todos e vira notificação.
    await useZones.getState().loadBbox(bboxAround(DEMO_CENTER, 2500));
    expect(useZones.getState().zones[conquered!.zoneId]?.owner).toBe('striders');
    const list = await notificationsRepo.listNotifications();
    expect(list.ok && list.data[0].title).toBe('Zona conquistada');
  });

  it('nenhum fetch nem XMLHttpRequest foi usado', () => {
    expect(network).not.toHaveBeenCalled();
  });
});
