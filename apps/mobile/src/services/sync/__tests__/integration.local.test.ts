/**
 * @jest-environment node
 */
import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';

import { basePace } from '@/domain/scoring';
import type { LatLng } from '@/domain/types';
import { nearestNeutral, simulationRoute } from '@/features/run/simulation';
import { provisionalSummary } from '@/features/run/summary-model';
import * as activitiesRepo from '@/services/api/activities-repo';
import * as zonesRepo from '@/services/api/zones-repo';
import * as repo from '@/services/safety/contacts-repo';
import { createSqliteStore } from '@/services/offline/sqlite-store';
import type { NewPoint } from '@/services/offline/types';
import { openNodeSqlite } from '@/services/offline/__tests__/helpers/node-sqlite-db';
import { loadDeviceKey, newDeviceKey, saveDeviceKey, type DeviceKeyDeps } from '@/services/signing/device-key';

import { createSyncEngine } from '../sync-engine';
import { createSupabaseTransport } from '../transport';
import type { SyncTransport } from '../types';

/**
 * Integração REAL do sync (sem mock de rede) contra o Supabase local: cadastro → facção → corrida
 * simulada no Parque Flamboyant gravada na fila SQLite → queda de rede no meio → lotes assinados
 * com HMAC → finish-activity → resultado oficial com zona conquistada.
 *   NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon> npx jest sync/__tests__/integration.local
 * (precisa de `npm run db:start` e `npm run functions:serve` na raiz).
 */
const RUN = process.env.NOMADE_IT === '1';
const URL = process.env.NOMADE_IT_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.NOMADE_IT_ANON ?? '';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = (RUN ? require('node-fetch') : undefined) as typeof fetch | undefined;
const memory = new Map<string, string>();
let mockClient: SupabaseClient | null = null;
if (RUN) {
  mockClient = createClient(URL, ANON, {
    global: { fetch: nodeFetch },
    auth: {
      storage: { getItem: async (k: string) => memory.get(k) ?? null, setItem: async (k: string, v: string) => void memory.set(k, v), removeItem: async (k: string) => void memory.delete(k) },
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

jest.mock('@/services/api/supabase', () => ({ requireSupabase: () => mockClient, getSupabase: () => mockClient }));

const suite = RUN ? describe : describe.skip;

/** Pontos da Simulação do app (volta no Flamboyant + desvio até uma zona neutra), 1 por segundo. */
function simulatedPoints(t0: number, route: LatLng[]): NewPoint[] {
  return route.map((p, s) => ({ ...p, t: t0 + s * 1000, accuracy: 5, speed: 3.2, altitude: 750, mocked: false, steps: s % 5 === 0 ? 2 : 3 }));
}

suite('sync real com o Supabase local (T2.2/T2.4)', () => {
  const stamp = Date.now().toString(36);
  const email = `a4_${stamp}@nomaderun.test`;
  const password = 'Corrida2026!';
  let userId = '';

  afterAll(async () => {
    if (userId && mockClient) await mockClient.functions.invoke('account-delete', { method: 'POST', body: { confirm: 'EXCLUIR' } }).catch(() => undefined);
  });

  it('cadastro e facção', async () => {
    const { data, error } = await mockClient!.auth.signUp({
      email,
      password,
      options: { data: { username: `a4_${stamp}`.slice(0, 20), birthdate: '2000-01-01', accepted_terms: true, accepted_privacy: true } },
    });
    expect(error).toBeNull();
    userId = data.user!.id;
    const f = await mockClient!.rpc('choose_faction', { p_faction: 'striders' });
    expect(f.error).toBeNull();
  });

  it('corrida simulada com queda de rede no meio → resultado oficial igual ao provisório e zona conquistada', async () => {
    const store = createSqliteStore(async () => openNodeSqlite());
    const mem = new Map<string, string>();
    const keyDeps: DeviceKeyDeps = {
      storage: { get: async (k) => mem.get(k) ?? null, set: async (k, v) => void mem.set(k, v), remove: async (k) => void mem.delete(k) },
      randomUUID: () => randomUUID(),
      randomBytes: (n) => new Uint8Array(randomBytes(n)),
    };
    const real = createSupabaseTransport(() => mockClient);
    let online = true;
    const transport: SyncTransport = {
      ...real,
      ingest: (b) => (online ? real.ingest(b) : Promise.resolve({ ok: false, error: { code: 'NETWORK', status: 0, message: 'sem rede' } })),
    };
    let clock = Date.now();
    const engine = createSyncEngine({
      store,
      transport,
      platform: 'android',
      model: 'Teste de integração',
      now: () => clock,
      keys: {
        load: (u) => loadDeviceKey(u, keyDeps),
        save: (u, k) => saveDeviceKey(u, k, keyDeps),
        regenerate: async (u) => {
          const k = newDeviceKey(keyDeps);
          await saveDeviceKey(u, k, keyDeps);
          return k;
        },
      },
    });

    // Zonas atuais do servidor perto do parque (o mesmo contexto que o finish vai usar).
    const park = { lat: -16.7108, lng: -49.2394 };
    const zonesRes = await zonesRepo.fetchZonesInBbox(zonesRepo.bboxAround(park, 3000));
    expect(zonesRes.ok).toBe(true);
    let zones = Object.fromEntries((zonesRes.ok ? zonesRes.data : []).map((z) => [z.zone.id, z.zone]));
    let names: Record<string, string | null> = Object.fromEntries((zonesRes.ok ? zonesRes.data : []).map((z) => [z.zone.id, z.meta.name]));
    // Desvio até a zona neutra mais próxima (o seed tem 23 perto do parque; cada execução conquista uma).
    const detour = nearestNeutral(zones);
    let route = simulationRoute(detour);
    if (!detour) {
      // Sem zona neutra por perto (banco já usado): a mesma volta numa região sem zonas, que nascem neutras (RF-020).
      const dLat = 0.4 + Math.random() * 0.3;
      const dLng = -0.3 - Math.random() * 0.3;
      route = route.map((p) => ({ lat: p.lat + dLat, lng: p.lng + dLng }));
      zones = {};
      names = {};
    }
    const outbound = route.slice(0, Math.ceil(route.length / 2));
    const points = simulatedPoints(Date.now() - 60 * 60_000, outbound);
    const N = points.length;
    const third = Math.floor(N / 3);

    const id = randomUUID();
    await store.createRun({ id, userId, mission: 'livre', ghostPace: null, startedAt: points[0].t, simulated: true });

    // 1º terço com rede, 2º terço sem rede (fica na fila), resto com rede de novo.
    await store.appendPoints(id, points.slice(0, third));
    expect((await engine.syncRun(id)).status).toBe('uploaded');
    online = false;
    await store.appendPoints(id, points.slice(third, 2 * third));
    expect((await engine.syncRun(id)).status).toBe('pending');
    online = true;
    clock += 10 * 60_000;
    await store.appendPoints(id, points.slice(2 * third));
    const run = await store.getRun(id);
    await store.updateRun(id, { state: 'pending', endedAt: points[points.length - 1].t });

    const allPoints = await store.readPoints(id, 0, 5000);
    const { summary: provisional } = provisionalSummary({
      points: allPoints,
      startedAt: run!.startedAt,
      trust: 100,
      zoneNames: names,
      context: { faction: 'striders', basePace: basePace([]), streakDays: 0, zones, revealedFog: new Set(), now: Date.now() },
    });

    const out = await engine.syncRun(id, { force: true });
    expect(out.status).toBe('synced');
    const official = out.official!;
    expect(official.status).toBe('valid');
    if (process.env.NOMADE_IT_DEBUG) console.log(JSON.stringify(official.zones.map((z) => [z.zoneId, z.name, z.meters, z.rp, z.outcome, z.ownerBefore]), null, 0));
    expect(official.zones.some((z) => z.outcome === 'conquered')).toBe(true);

    // Provisório (aparelho) = oficial (servidor) para as mesmas entradas.
    expect(provisional.meters).toBe(official.meters);
    expect(provisional.movingSeconds).toBe(official.movingSeconds);
    expect(provisional.rpTotal).toBe(official.rpTotal);
    expect(provisional.zones.map((z) => [z.zoneId, z.rp, z.outcome])).toEqual(official.zones.map((z) => [z.zoneId, z.rp, z.outcome]));

    // Todos os pontos no servidor, uma única vez; resultado guardado em activities.result.
    const { count } = await mockClient!.from('activity_points').select('seq', { count: 'exact', head: true }).eq('activity_id', id);
    expect(count).toBe(N);
    const saved = await activitiesRepo.getActivity(id);
    expect(saved.ok && saved.data?.status).toBe('valid');
    expect(saved.ok && saved.data?.result?.rpTotal).toBe(official.rpTotal);

    // A zona conquistada aparece com o novo dono para todos (/zone).
    const conquered = official.zones.find((z) => z.outcome === 'conquered')!;
    const zone = await zonesRepo.fetchZoneDetail(conquered.zoneId);
    expect(zone.ok && zone.data.zone.owner).toBe('striders');

    // Histórico e progresso vêm do servidor.
    const hist = await activitiesRepo.listMyActivities({ from: Date.now() - 86_400_000 });
    expect(hist.ok && hist.data.map((a) => a.id)).toContain(id);
    const prog = await activitiesRepo.getMyProgress(userId);
    expect(prog.ok && prog.data.xp).toBe(official.xp);
    const fog = await activitiesRepo.listMyFogCells();
    expect(fog.ok && fog.data.length).toBe(official.newFogCells);

    // Finalizar de novo é idempotente.
    expect((await real.finish({ activityId: id, lastSeq: N - 1 })).ok).toBe(true);
  }, 60_000);

  it('contatos de segurança: até 5 (o 6º é recusado pelo banco)', async () => {
    for (let i = 0; i < 5; i++) expect((await repo.addContact(`Contato ${i}`, `+55 62 9999${i}-000${i}`)).ok).toBe(true);
    const sixth = await repo.addContact('Sexto', '+55 62 99990-0006');
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(repo.isLimitError(sixth.error)).toBe(true);
    const list = await repo.listContacts();
    expect(list.ok && list.data).toHaveLength(5);
    if (list.ok) {
      expect((await repo.updateContact(list.data[0].id, 'Mãe', '+55 62 98888-0000')).ok).toBe(true);
      expect((await repo.removeContact(list.data[1].id)).ok).toBe(true);
    }
    const after = await repo.listContacts();
    expect(after.ok && after.data.map((c) => c.name)).toContain('Mãe');
    expect(after.ok && after.data).toHaveLength(4);
  });
});
