/**
 * @jest-environment node
 *
 * T4.1 — propriedade da fila offline (RNF-005, D-03): com gravações simultâneas de lotes de tamanho
 * aleatório em várias corridas, intercaladas com leituras, mudanças de estado e limpeza dos pontos
 * já enviados, o `seq` de cada corrida nunca se repete, nunca pula e nunca volta atrás.
 */
import { describe, expect, it } from '@jest/globals';

import { forAllAsync } from '../../../domain/__tests__/prop';
import { createMemoryStore } from '../memory-store';
import { createSqliteStore } from '../sqlite-store';
import type { NewPoint, QueueStore } from '../types';
import { openNodeSqlite } from './helpers/node-sqlite-db';

const pt = (i: number): NewPoint => ({ lat: -16.7 + i * 1e-5, lng: -49.2, t: 1_760_000_000_000 + i * 1000, accuracy: 5, speed: 3, altitude: 750, mocked: false, steps: 3 });

type Op = { kind: 'append'; run: number; size: number; background: boolean } | { kind: 'pause'; run: number; paused: boolean } | { kind: 'clear'; run: number } | { kind: 'read'; run: number };

function check(name: string, make: () => QueueStore, runs: number) {
  it(`${name}: seq único, contínuo e crescente por corrida`, async () => {
    await forAllAsync(
      (r) => ({
        nRuns: r.int(1, 3),
        waves: Array.from({ length: r.int(1, 6) }, () =>
          Array.from({ length: r.int(1, 12) }, (): Op => {
            const run = r.int(0, 2);
            const k = r.next();
            if (k < 0.65) return { kind: 'append', run, size: r.int(0, 25), background: r.bool(0.3) };
            if (k < 0.75) return { kind: 'pause', run, paused: r.bool() };
            if (k < 0.85) return { kind: 'clear', run };
            return { kind: 'read', run };
          }),
        ),
      }),
      async ({ nRuns, waves }) => {
        const s = make();
        const ids = Array.from({ length: nRuns }, (_, i) => `run-${i}`);
        for (const id of ids) await s.createRun({ id, userId: 'u1', mission: 'livre', ghostPace: null, startedAt: 1, simulated: true });
        const assigned: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, []]));
        for (const wave of waves) {
          // cada "onda" roda em paralelo (GPS em primeiro plano + tarefa de segundo plano + sync)
          await Promise.all(
            wave.map(async (op) => {
              const id = ids[op.run % nRuns];
              if (op.kind === 'append') {
                const seqs = await s.appendPoints(id, Array.from({ length: op.size }, (_, i) => pt(i)), op.background ? { onlyIfRecording: true } : undefined);
                assigned[id].push(...seqs);
              } else if (op.kind === 'pause') {
                await s.updateRun(id, { paused: op.paused });
              } else if (op.kind === 'clear') {
                await s.deletePoints(id);
              } else {
                const pts = await s.readPoints(id, 0, 10_000);
                for (let i = 1; i < pts.length; i++) expect(pts[i].seq).toBeGreaterThan(pts[i - 1].seq);
              }
            }),
          );
        }
        for (const id of ids) {
          const seqs = assigned[id];
          expect(new Set(seqs).size).toBe(seqs.length);
          expect([...seqs].sort((a, b) => a - b)).toEqual(seqs.map((_, i) => i));
          expect((await s.getRun(id))?.lastSeq).toBe(seqs.length - 1);
        }
      },
      runs,
    );
  });
}

describe('fila offline — propriedades', () => {
  check('memória (web)', () => createMemoryStore(), 150);
  check('SQLite (node:sqlite)', () => createSqliteStore(async () => openNodeSqlite()), 60);
});
