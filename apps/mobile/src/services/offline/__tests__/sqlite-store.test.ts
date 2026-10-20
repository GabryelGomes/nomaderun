/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createMemoryStore } from '../memory-store';
import { createSqliteStore } from '../sqlite-store';
import type { NewPoint, QueueStore } from '../types';
import { openNodeSqlite } from './helpers/node-sqlite-db';

const pt = (i: number, extra: Partial<NewPoint> = {}): NewPoint => ({
  lat: -16.7097 + i * 0.00001,
  lng: -49.2388 - i * 0.00001,
  t: 1_760_000_000_000 + i * 1000,
  accuracy: 4.5,
  speed: 3.1,
  altitude: 750.25,
  mocked: false,
  steps: 3,
  ...extra,
});

const run = { id: 'run-1', userId: 'u1', mission: 'livre' as const, ghostPace: null, startedAt: 1_760_000_000_000, simulated: true };

function suites(name: string, make: () => QueueStore) {
  describe(name, () => {
    it('seq contínuo a partir de 0, valores preservados (double, null, boolean)', async () => {
      const s = make();
      await s.createRun(run, 1);
      expect(await s.appendPoints('run-1', [pt(0), pt(1, { accuracy: null, speed: null, altitude: null, mocked: null, steps: null })])).toEqual([0, 1]);
      expect(await s.appendPoints('run-1', [pt(2, { mocked: true, steps: 0 })])).toEqual([2]);
      const pts = await s.readPoints('run-1', 0, 10);
      expect(pts.map((p) => p.seq)).toEqual([0, 1, 2]);
      expect(pts[0]).toEqual({ ...pt(0), seq: 0 });
      expect(pts[1]).toMatchObject({ accuracy: null, speed: null, altitude: null, mocked: null, steps: null });
      expect(pts[2]).toMatchObject({ mocked: true, steps: 0 });
      expect((await s.getRun('run-1'))?.lastSeq).toBe(2);
    });

    it('lê por página a partir de um seq', async () => {
      const s = make();
      await s.createRun(run);
      await s.appendPoints('run-1', Array.from({ length: 450 }, (_, i) => pt(i)));
      const page = await s.readPoints('run-1', 200, 200);
      expect(page[0].seq).toBe(200);
      expect(page[page.length - 1].seq).toBe(399);
      expect(await s.readPoints('run-1', 400, 200)).toHaveLength(50);
    });

    it('escritas simultâneas nunca repetem nem pulam seq', async () => {
      const s = make();
      await s.createRun(run);
      await Promise.all(Array.from({ length: 30 }, (_, i) => s.appendPoints('run-1', [pt(i), pt(i + 100)])));
      const seqs = (await s.readPoints('run-1', 0, 1000)).map((p) => p.seq);
      expect(seqs).toEqual(Array.from({ length: 60 }, (_, i) => i));
    });

    it('tarefa de segundo plano só grava com a corrida gravando e sem pausa', async () => {
      const s = make();
      await s.createRun(run);
      await s.updateRun('run-1', { paused: true });
      expect(await s.appendPoints('run-1', [pt(0)], { onlyIfRecording: true })).toEqual([]);
      await s.updateRun('run-1', { paused: false });
      expect(await s.appendPoints('run-1', [pt(0)], { onlyIfRecording: true })).toEqual([0]);
      await s.updateRun('run-1', { state: 'pending' });
      expect(await s.appendPoints('run-1', [pt(1)], { onlyIfRecording: true })).toEqual([]);
    });

    it('atualiza estado, resultado e apaga pontos/corrida', async () => {
      const s = make();
      await s.createRun(run);
      await s.appendPoints('run-1', [pt(0), pt(1)]);
      const r = await s.updateRun('run-1', { state: 'synced', ackedSeq: 1, official: '{"ok":1}', endedAt: 99, paused: false });
      expect(r).toMatchObject({ state: 'synced', ackedSeq: 1, official: '{"ok":1}', endedAt: 99 });
      await s.deletePoints('run-1');
      expect(await s.readPoints('run-1', 0, 10)).toEqual([]);
      expect((await s.listRuns('u1')).map((x) => x.id)).toEqual(['run-1']);
      expect(await s.listRuns('outro')).toEqual([]);
      await s.deleteRun('run-1');
      expect(await s.getRun('run-1')).toBeNull();
    });

    it('createRun é idempotente', async () => {
      const s = make();
      await s.createRun(run);
      await s.appendPoints('run-1', [pt(0)]);
      const again = await s.createRun(run);
      expect(again.lastSeq).toBe(0);
    });
  });
}

suites('fila SQLite (mesmo SQL do expo-sqlite, motor node:sqlite)', () => createSqliteStore(async () => openNodeSqlite()));
suites('fila em memória (web)', () => createMemoryStore());

describe('fila SQLite em arquivo', () => {
  it('pontos sobrevivem ao app ser fechado no meio da corrida (RNF-005)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nomade-queue-'));
    const file = join(dir, 'q.db');
    try {
      const first = openNodeSqlite(file);
      const a = createSqliteStore(async () => first);
      await a.createRun(run);
      await a.appendPoints('run-1', Array.from({ length: 120 }, (_, i) => pt(i)));
      first.close();

      const b = createSqliteStore(async () => openNodeSqlite(file));
      const r = await b.getRun('run-1');
      expect(r?.lastSeq).toBe(119);
      expect(await b.appendPoints('run-1', [pt(120)])).toEqual([120]);
      expect(await b.readPoints('run-1', 0, 1000)).toHaveLength(121);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
