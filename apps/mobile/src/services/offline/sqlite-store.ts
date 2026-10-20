/**
 * Fila offline no expo-sqlite (D-03). Arquivo próprio (`nomade-queue.db`), separado do kv-store
 * do perfil. Toda escrita passa por uma fila em JS (mutex) e por transação, para o `seq` nunca
 * repetir nem pular, mesmo com o GPS em primeiro plano e a tarefa de segundo plano gravando.
 */
import type { NewPoint, NewRun, QueuedPoint, QueuedRun, QueueStore, RunPatch } from './types';
import { newQueuedRun } from './memory-store';

/** Subconjunto do `SQLiteDatabase` do expo-sqlite usado aqui (facilita testar com outro motor). */
export type SqlDb = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};
export type SqlValue = string | number | null;

export const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  mission TEXT NOT NULL,
  ghost_pace REAL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  last_seq INTEGER NOT NULL DEFAULT -1,
  acked_seq INTEGER NOT NULL DEFAULT -1,
  state TEXT NOT NULL CHECK (state IN ('recording','pending','syncing','synced','failed')),
  simulated INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  provisional TEXT,
  official TEXT,
  path TEXT,
  error TEXT,
  error_code TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_user_idx ON runs (user_id, started_at DESC);
CREATE TABLE IF NOT EXISTS points (
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  t INTEGER NOT NULL,
  accuracy REAL,
  speed REAL,
  altitude REAL,
  mocked INTEGER,
  steps INTEGER,
  PRIMARY KEY (run_id, seq)
);
`;

type RunRow = {
  id: string;
  user_id: string;
  mission: string;
  ghost_pace: number | null;
  started_at: number;
  ended_at: number | null;
  last_seq: number;
  acked_seq: number;
  state: string;
  simulated: number;
  paused: number;
  provisional: string | null;
  official: string | null;
  path: string | null;
  error: string | null;
  error_code: string | null;
  attempts: number;
  next_attempt_at: number;
  updated_at: number;
};

type PointRow = Omit<QueuedPoint, 'mocked'> & { mocked: number | null };

const toRun = (r: RunRow): QueuedRun => ({
  id: r.id,
  userId: r.user_id,
  mission: r.mission as QueuedRun['mission'],
  ghostPace: r.ghost_pace,
  startedAt: Number(r.started_at),
  endedAt: r.ended_at === null ? null : Number(r.ended_at),
  lastSeq: Number(r.last_seq),
  ackedSeq: Number(r.acked_seq),
  state: r.state as QueuedRun['state'],
  simulated: Boolean(r.simulated),
  paused: Boolean(r.paused),
  provisional: r.provisional,
  official: r.official,
  path: r.path,
  error: r.error,
  errorCode: r.error_code,
  attempts: Number(r.attempts),
  nextAttemptAt: Number(r.next_attempt_at),
  updatedAt: Number(r.updated_at),
});

const toPoint = (p: PointRow): QueuedPoint => ({
  seq: Number(p.seq),
  lat: p.lat,
  lng: p.lng,
  t: Number(p.t),
  accuracy: p.accuracy,
  speed: p.speed,
  altitude: p.altitude,
  mocked: p.mocked === null ? null : Boolean(p.mocked),
  steps: p.steps === null ? null : Number(p.steps),
});

const COLUMN: Record<keyof RunPatch, string> = {
  mission: 'mission',
  ghostPace: 'ghost_pace',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  ackedSeq: 'acked_seq',
  state: 'state',
  simulated: 'simulated',
  paused: 'paused',
  provisional: 'provisional',
  official: 'official',
  path: 'path',
  error: 'error',
  errorCode: 'error_code',
  attempts: 'attempts',
  nextAttemptAt: 'next_attempt_at',
  updatedAt: 'updated_at',
};

const sqlValue = (v: unknown): SqlValue => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : (v as SqlValue));

export function createSqliteStore(open: () => Promise<SqlDb>): QueueStore {
  let dbPromise: Promise<SqlDb> | null = null;
  let chain: Promise<unknown> = Promise.resolve();

  const db = () => {
    if (!dbPromise) {
      dbPromise = (async () => {
        const d = await open();
        await d.execAsync(SCHEMA);
        return d;
      })();
      dbPromise.catch(() => {
        dbPromise = null;
      });
    }
    return dbPromise;
  };

  /** Serializa escritas (o expo-sqlite não impede que transações assíncronas se intercalem). */
  function exclusive<T>(fn: (d: SqlDb) => Promise<T>): Promise<T> {
    const next = chain.then(async () => fn(await db()));
    chain = next.catch(() => undefined);
    return next;
  }

  const getRun = async (d: SqlDb, id: string) => {
    const row = await d.getFirstAsync<RunRow>('SELECT * FROM runs WHERE id = ?', [id]);
    return row ? toRun(row) : null;
  };

  return {
    createRun: (run: NewRun, now = Date.now()) =>
      exclusive(async (d) => {
        const existing = await getRun(d, run.id);
        if (existing) return existing;
        const r = newQueuedRun(run, now);
        await d.runAsync(
          'INSERT INTO runs (id, user_id, mission, ghost_pace, started_at, state, simulated, paused, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
          [r.id, r.userId, r.mission, r.ghostPace, r.startedAt, r.state, r.simulated ? 1 : 0, now],
        );
        return r;
      }),

    appendPoints: (runId: string, list: NewPoint[], opts) =>
      exclusive(async (d) => {
        if (list.length === 0) return [];
        const seqs: number[] = [];
        await d.withTransactionAsync(async () => {
          const r = await getRun(d, runId);
          if (!r) return;
          if (opts?.onlyIfRecording && (r.state !== 'recording' || r.paused)) return;
          let seq = r.lastSeq;
          for (const p of list) {
            seq += 1;
            await d.runAsync(
              'INSERT INTO points (run_id, seq, lat, lng, t, accuracy, speed, altitude, mocked, steps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [runId, seq, p.lat, p.lng, p.t, p.accuracy, p.speed, p.altitude, p.mocked === null ? null : p.mocked ? 1 : 0, p.steps],
            );
            seqs.push(seq);
          }
          await d.runAsync('UPDATE runs SET last_seq = ?, updated_at = ? WHERE id = ?', [seq, Date.now(), runId]);
        });
        return seqs;
      }),

    getRun: async (id) => getRun(await db(), id),

    listRuns: async (userId) => {
      const d = await db();
      const rows = userId
        ? await d.getAllAsync<RunRow>('SELECT * FROM runs WHERE user_id = ? ORDER BY started_at DESC', [userId])
        : await d.getAllAsync<RunRow>('SELECT * FROM runs ORDER BY started_at DESC', []);
      return rows.map(toRun);
    },

    readPoints: async (runId, fromSeq, limit) => {
      const d = await db();
      const rows = await d.getAllAsync<PointRow>('SELECT * FROM points WHERE run_id = ? AND seq >= ? ORDER BY seq LIMIT ?', [runId, fromSeq, limit]);
      return rows.map(toPoint);
    },

    updateRun: (id, patch: RunPatch) =>
      exclusive(async (d) => {
        const entries = Object.entries({ ...patch, updatedAt: patch.updatedAt ?? Date.now() }).filter(([k]) => k in COLUMN);
        const sets = entries.map(([k]) => `${COLUMN[k as keyof RunPatch]} = ?`).join(', ');
        await d.runAsync(`UPDATE runs SET ${sets} WHERE id = ?`, [...entries.map(([, v]) => sqlValue(v)), id]);
        return getRun(d, id);
      }),

    deletePoints: (runId) =>
      exclusive(async (d) => {
        await d.runAsync('DELETE FROM points WHERE run_id = ?', [runId]);
      }),

    deleteRun: (id) =>
      exclusive(async (d) => {
        await d.withTransactionAsync(async () => {
          await d.runAsync('DELETE FROM points WHERE run_id = ?', [id]);
          await d.runAsync('DELETE FROM runs WHERE id = ?', [id]);
        });
      }),
  };
}
