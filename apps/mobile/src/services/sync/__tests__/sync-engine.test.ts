/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { createMemoryStore } from '@/services/offline/memory-store';
import { createSqliteStore } from '@/services/offline/sqlite-store';
import type { NewPoint, QueueStore } from '@/services/offline/types';
import { openNodeSqlite } from '@/services/offline/__tests__/helpers/node-sqlite-db';

import { backoffDelay, BACKOFF_MAX_MS, createSyncEngine, SYNC_BATCH_SIZE } from '../sync-engine';
import { createFakeServer, memoryKeyRing } from './fake-server';

const T0 = 1_760_000_000_000;
const pt = (i: number): NewPoint => ({ lat: -16.7097 + i * 1e-5, lng: -49.2388, t: T0 + i * 1000, accuracy: 5, speed: 3.2, altitude: 750, mocked: false, steps: 3 });
const pts = (from: number, n: number) => Array.from({ length: n }, (_, i) => pt(from + i));

function setup(store: QueueStore = createMemoryStore()) {
  const server = createFakeServer();
  const keys = memoryKeyRing();
  let clock = T0;
  const engine = createSyncEngine({ store, transport: server.transport, keys, platform: 'android', now: () => clock });
  const advance = (ms: number) => {
    clock += ms;
  };
  return { server, keys, engine, store, advance };
}

async function newRun(store: QueueStore, id = 'a1') {
  await store.createRun({ id, userId: 'me', mission: 'livre', ghostPace: null, startedAt: T0, simulated: false });
  return id;
}

async function end(store: QueueStore, id: string) {
  const r = await store.getRun(id);
  await store.updateRun(id, { state: 'pending', endedAt: T0 + (r!.lastSeq + 1) * 1000 });
}

describe('sync da fila (RF-005, RNF-005, RNF-006)', () => {
  it('lotes de até 200 pontos assinados, finaliza e guarda o resultado oficial', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 450));
    await end(store, id);
    const seen: string[] = [];
    engine.subscribe((r, off) => off && seen.push(r.state));
    const out = await engine.syncRun(id);
    expect(out.status).toBe('synced');
    expect(server.state.calls.ingest).toBe(Math.ceil(450 / SYNC_BATCH_SIZE));
    expect(server.storedSeqs(id)).toEqual(Array.from({ length: 450 }, (_, i) => i));
    expect(out.official?.zones[0].outcome).toBe('conquered');
    const r = await store.getRun(id);
    expect(r).toMatchObject({ state: 'synced', ackedSeq: 449 });
    expect(JSON.parse(r!.official!).rpTotal).toBe(42);
    expect(await store.readPoints(id, 0, 10)).toEqual([]); // pontos locais liberados
    expect(seen).toEqual(['synced']);
    expect(server.state.calls.register).toBe(1);
  });

  it('queda de rede no meio da corrida: todos os seqs chegam uma única vez', async () => {
    const { server, engine, store, advance } = setup(createSqliteStore(async () => openNodeSqlite()));
    const id = await newRun(store);

    await store.appendPoints(id, pts(0, 120));
    expect((await engine.syncRun(id)).status).toBe('uploaded');

    // Sem rede: a corrida continua gravando no aparelho.
    server.state.online = false;
    await store.appendPoints(id, pts(120, 300));
    const off = await engine.syncRun(id);
    expect(off.status).toBe('pending');
    expect(off.run?.nextAttemptAt).toBeGreaterThan(T0);
    // Respeita a espera exponencial (sem forçar não tenta de novo).
    const calls = server.state.calls.ingest;
    expect((await engine.syncRun(id)).status).toBe('pending');
    expect(server.state.calls.ingest).toBe(calls);

    // Rede volta, mas a primeira resposta se perde depois de gravar: reenvio vira duplicado.
    server.state.online = true;
    server.state.dropNextResponse = true;
    advance(60_000);
    expect((await engine.syncRun(id)).status).toBe('pending');
    await store.appendPoints(id, pts(420, 80));
    await end(store, id);
    const done = await engine.syncRun(id, { force: true });
    expect(done.status).toBe('synced');

    const stored = server.storedSeqs(id);
    expect(stored).toEqual(Array.from({ length: 500 }, (_, i) => i));
    // O servidor gravou cada seq exatamente uma vez (duplicados foram ignorados).
    expect(server.received).toHaveLength(500);
    expect(new Set(server.received).size).toBe(500);
  });

  it('reenvio do mesmo lote é idempotente (duplicados aceitos)', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 50));
    await engine.syncRun(id);
    await store.updateRun(id, { ackedSeq: -1 }); // como se a confirmação tivesse se perdido
    const again = await engine.syncRun(id);
    expect(again.status).toBe('uploaded');
    expect(server.received).toHaveLength(50);
  });

  it('OUT_OF_ORDER: recomeça de details.lastSeq + 1', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 300));
    await engine.syncRun(id);
    server.truncate(id, 99); // servidor só tem 0..99
    await store.appendPoints(id, pts(300, 10));
    await end(store, id);
    const out = await engine.syncRun(id);
    expect(out.status).toBe('synced');
    expect(server.storedSeqs(id)).toEqual(Array.from({ length: 310 }, (_, i) => i));
  });

  it('MISSING_POINTS no finish: reenvia a fila e finaliza', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 40));
    await engine.syncRun(id);
    server.truncate(id, 9);
    await store.updateRun(id, { state: 'pending', endedAt: T0 + 40_000, ackedSeq: 39 });
    const out = await engine.syncRun(id);
    expect(out.status).toBe('synced');
    expect(server.state.calls.finish).toBe(2);
    expect(server.storedSeqs(id)).toHaveLength(40);
  });

  it('UNKNOWN_DEVICE: registra de novo e continua', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 5));
    await engine.syncRun(id);
    server.devices.clear();
    await store.appendPoints(id, pts(5, 5));
    expect((await engine.syncRun(id)).status).toBe('uploaded');
    expect(server.state.calls.register).toBe(2);
  });

  it('DEVICE_TAKEN no registro: gera outro deviceId', async () => {
    const { server, engine, store, keys } = setup();
    server.devices.set('dev-0', { userId: 'outra-conta', secret: 'x' });
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 5));
    expect((await engine.syncRun(id)).status).toBe('uploaded');
    expect(keys.keys.get('me')).toMatchObject({ deviceId: 'dev-1', registered: true });
  });

  it('401: renova a sessão uma vez e segue', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 5));
    await engine.ensureDevice('me');
    server.state.expiredToken = true;
    expect((await engine.syncRun(id)).status).toBe('uploaded');
    expect(server.state.calls.refresh).toBe(1);
  });

  it('REPLAY_MISMATCH: erro definitivo, sem sobrescrever', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 5));
    await engine.syncRun(id);
    // Outro conteúdo para seqs já enviados (bug/fraude).
    server.acts.get(id)!.points.set(4, 'diferente');
    await store.updateRun(id, { ackedSeq: 3 });
    const out = await engine.syncRun(id);
    expect(out.status).toBe('failed');
    expect(out.run?.error).toMatch(/pontos diferentes/);
    expect(out.run?.state).toBe('failed');
  });

  it('ACTIVITY_CLOSED: descarta o lote e usa o resultado já guardado no servidor', async () => {
    const { server, engine, store } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 20));
    await engine.syncRun(id);
    // A corrida foi fechada no servidor (ex.: finalizada por outra tentativa) antes destes pontos.
    await server.transport.finish({ activityId: id, lastSeq: 19 });
    server.state.closedAnswersError = true;
    await store.appendPoints(id, pts(20, 5));
    await end(store, id);
    const out = await engine.syncRun(id);
    expect(out.status).toBe('synced');
    expect(out.official?.rpTotal).toBe(42);
    expect(server.storedSeqs(id)).toHaveLength(20);
  });

  it('corrida sem pontos não vai para o servidor', async () => {
    const { engine, store, server } = setup();
    const id = await newRun(store);
    await store.updateRun(id, { state: 'pending', endedAt: T0 });
    expect((await engine.syncRun(id)).status).toBe('failed');
    expect(server.state.calls.ingest).toBe(0);
  });

  it('syncAll envia só o que está pendente do usuário', async () => {
    const { engine, store, server } = setup();
    await newRun(store, 'r1');
    await newRun(store, 'r2');
    await store.appendPoints('r1', pts(0, 3));
    await end(store, 'r1');
    await store.appendPoints('r2', pts(0, 3));
    const outs = await engine.syncAll('me');
    expect(outs.map((o) => o.status).sort()).toEqual(['synced', 'uploaded']);
    expect(server.storedSeqs('r2')).toEqual([0, 1, 2]);
    expect(await engine.syncAll('me')).toEqual([]);
  });

  it('chamadas simultâneas da mesma corrida não duplicam envio', async () => {
    const { engine, store, server } = setup();
    const id = await newRun(store);
    await store.appendPoints(id, pts(0, 300));
    await Promise.all([engine.syncRun(id), engine.syncRun(id), engine.syncRun(id)]);
    expect(server.received).toHaveLength(300);
    expect(server.state.calls.ingest).toBe(2);
  });

  it('espera exponencial com teto', () => {
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
    expect(backoffDelay(5)).toBe(32000);
    expect(backoffDelay(50)).toBe(BACKOFF_MAX_MS);
  });
});
