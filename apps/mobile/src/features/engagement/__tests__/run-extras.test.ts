/**
 * @jest-environment node
 *
 * T7.2.4 (E7): uma corrida no modo demonstração devolve o bloco `extras.engagement` (contrato E7 §8) pelo
 * caminho real do app (fila, sync assinado, transporte) e o engajamento anda junto: XP em linhas, baús do dia
 * abertos, missões com progresso e nível coerente. Sem rede.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';

import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
  getRandomBytes: (n: number) => new Uint8Array(jest.requireActual<typeof import('node:crypto')>('node:crypto').randomBytes(n)),
}));
jest.mock('@/services/api/zones-cache', () => ({ readCachedZones: async () => null, writeCachedZones: async () => undefined }));
jest.mock('@/services/api/profile-cache', () => ({ readCachedProfile: async () => null, writeCachedProfile: async () => undefined }));

/* eslint-disable import/first */
import { levelProgress } from '@/domain/progression';
import { confirmRun, endRun, recordPoints, startRecording } from '@/features/run/run-controller';
import { nearestNeutral, simulationRoute } from '@/features/run/simulation';
import { getActivityResult } from '@/services/api/activities-repo';
import { createDemoClient, getDemoClient, setDemoClient } from '@/services/api/demo';
import * as repo from '@/services/api/engagement-repo';
import { bboxAround } from '@/services/api/zones-repo';
import { DEMO_CENTER } from '@/demo/demo-data';
import { createMemoryStore } from '@/services/offline/memory-store';
import { setQueueStore } from '@/services/offline/queue';
import type { NewPoint } from '@/services/offline/types';
import { newDeviceKey, type DeviceKey } from '@/services/signing/device-key';
import { createSyncEngine } from '@/services/sync/sync-engine';
import { setSyncEngine } from '@/services/sync/sync-service';
import { createSupabaseTransport } from '@/services/sync/transport';
import { useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';

import { refreshEngagement } from '../controller';
/* eslint-enable import/first */

const T0 = Date.parse('2026-10-23T12:00:00Z'); // sexta, 09:00 em Brasília
let clock = T0;
const realFetch = globalThis.fetch;
const network = jest.fn(() => Promise.reject(new Error('rede proibida no modo demonstração')));

beforeAll(() => {
  globalThis.fetch = network as unknown as typeof fetch;
  setDemoClient(createDemoClient({ clock: () => clock }));
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
      keys: { load: async (u) => keys.get(u) ?? fresh(u), save: async (u, k) => void keys.set(u, k), regenerate: async (u) => fresh(u) },
    }),
  );
  useSession.getState().setSession({ userId: DEMO_USER_ID, email: 'demo@exemplo.invalid' } as never);
});

afterAll(() => {
  globalThis.fetch = realFetch;
  setSyncEngine(null);
  setQueueStore(null);
  setDemoClient(null);
  useSession.getState().reset();
  expect(network).not.toHaveBeenCalled();
});

describe('corrida no modo demonstração → extras.engagement', () => {
  it('o finish devolve XP em linhas, abre os baús guardados, mexe nas missões e mantém o nível coerente', async () => {
    await refreshEngagement(clock);
    const before = useEngagement.getState();
    expect(before.chest.data?.stored).toBe(1);
    expect(before.chest.data?.bonus).toEqual(['raro']);
    const xpBefore = before.status.data!.xp;

    await useZones.getState().loadBbox(bboxAround(DEMO_CENTER, 2500));
    const route = simulationRoute(nearestNeutral(useZones.getState().zones));
    const outbound = route.slice(0, Math.ceil(route.length / 2));
    const points: NewPoint[] = outbound.map((p, s) => ({ ...p, t: T0 + s * 1000, accuracy: 5, speed: 3.2, altitude: 750, mocked: false, steps: s % 5 === 0 ? 2 : 3 }));
    const runId = await startRecording({ userId: DEMO_USER_ID, mission: 'livre', ghostPace: null, simulated: true, startedAt: points[0].t });
    for (let i = 0; i < points.length; i += 250) await recordPoints(runId, points.slice(i, i + 250));
    clock = points[points.length - 1].t + 2000;
    await endRun(runId, points[points.length - 1].t);
    const out = await confirmRun(runId, 5000);
    const official = out!.official!;
    expect(official.status).toBe('valid');

    const block = repo.parseRunEngagement(official)!;
    expect(block).not.toBeNull();
    expect(block.xp.lines.map((l) => l.source)).toEqual(expect.arrayContaining(['run_distance', 'run_complete', 'daily_chest']));
    expect(block.xp.total).toBe(block.xp.lines.reduce((s, l) => s + l.amount, 0));
    // Contrato da E9 (onda 2): `response.xp` = só o XP da própria atividade; baús e missões vêm nas linhas.
    const own = ['run_distance', 'run_complete', 'fog', 'ghost', 'hunt_chest', 'week_kept'];
    expect(official.xp).toBe(block.xp.lines.filter((l) => own.includes(l.source)).reduce((s, l) => s + l.amount, 0));
    expect(official.xp).toBeLessThan(block.xp.total);
    expect((official as unknown as { extras: { contract: number } }).extras.contract).toBe(2);
    // 1 guardado + o bônus raro da primeira semana, com a garantia do lendário andando.
    expect(block.dailyChests.opened).toHaveLength(2);
    expect(block.dailyChests.opened.filter((c) => c.bonus).map((c) => c.rarity)).not.toContain('comum');
    expect(block.streak).toMatchObject({ activitiesThisWeek: 3, weekKept: false });
    expect(block.level.after).toBe(levelProgress(xpBefore + block.xp.total).level);

    // Idempotente: o resultado guardado tem o mesmo bloco.
    const again = await getActivityResult(official.activityId);
    expect(again.ok && repo.parseRunEngagement(again.data)).toEqual(block);

    // O resto do app enxerga a mesma verdade.
    await refreshEngagement(clock);
    const after = useEngagement.getState();
    expect(after.status.data!.xp).toBe(xpBefore + block.xp.total);
    expect(after.chest.data).toMatchObject({ stored: 0, bonus: [], openedToday: true });
    const moved = [...after.missions.data!.daily, ...after.missions.data!.weekly].filter((m) => ['meters', 'movingSeconds'].includes(m.metric));
    expect(moved.every((m) => m.progress > 0)).toBe(true);
    const opened = await repo.openDailyChests();
    expect(opened.ok && opened.data.available && opened.data.data.alreadyOpened).toBe(true);
    expect(getDemoClient().isDemo).toBe(true);
  });
});
