import type { NewPoint, NewRun, QueuedPoint, QueuedRun, QueueStore, RunPatch } from './types';

export function newQueuedRun(run: NewRun, now: number): QueuedRun {
  return {
    ...run,
    endedAt: null,
    lastSeq: -1,
    ackedSeq: -1,
    state: 'recording',
    paused: false,
    provisional: null,
    official: null,
    path: null,
    error: null,
    errorCode: null,
    attempts: 0,
    nextAttemptAt: 0,
    updatedAt: now,
  };
}

export type MemorySnapshot = { runs: QueuedRun[]; points: Record<string, QueuedPoint[]> };

/**
 * Fila em memória (testes e web). `onChange` permite persistir um snapshot (o web usa localStorage).
 */
export function createMemoryStore(initial?: MemorySnapshot, onChange?: (snap: MemorySnapshot) => void): QueueStore & { snapshot: () => MemorySnapshot } {
  const runs = new Map<string, QueuedRun>((initial?.runs ?? []).map((r) => [r.id, { ...r }]));
  const points = new Map<string, QueuedPoint[]>(Object.entries(initial?.points ?? {}).map(([k, v]) => [k, v.map((p) => ({ ...p }))]));
  const snapshot = (): MemorySnapshot => ({ runs: [...runs.values()].map((r) => ({ ...r })), points: Object.fromEntries([...points].map(([k, v]) => [k, v.map((p) => ({ ...p }))])) });
  const changed = () => onChange?.(snapshot());

  return {
    snapshot,
    async createRun(run, now = Date.now()) {
      const existing = runs.get(run.id);
      if (existing) return { ...existing };
      const r = newQueuedRun(run, now);
      runs.set(r.id, r);
      points.set(r.id, []);
      changed();
      return { ...r };
    },
    async appendPoints(runId, list: NewPoint[], opts) {
      const r = runs.get(runId);
      if (!r || list.length === 0) return [];
      if (opts?.onlyIfRecording && (r.state !== 'recording' || r.paused)) return [];
      const arr = points.get(runId) ?? [];
      const seqs: number[] = [];
      for (const p of list) {
        r.lastSeq += 1;
        arr.push({ ...p, seq: r.lastSeq });
        seqs.push(r.lastSeq);
      }
      points.set(runId, arr);
      r.updatedAt = Date.now();
      changed();
      return seqs;
    },
    async getRun(id) {
      const r = runs.get(id);
      return r ? { ...r } : null;
    },
    async listRuns(userId) {
      return [...runs.values()].filter((r) => !userId || r.userId === userId).sort((a, b) => b.startedAt - a.startedAt).map((r) => ({ ...r }));
    },
    async readPoints(runId, fromSeq, limit) {
      return (points.get(runId) ?? []).filter((p) => p.seq >= fromSeq).slice(0, limit).map((p) => ({ ...p }));
    },
    async updateRun(id, patch: RunPatch) {
      const r = runs.get(id);
      if (!r) return null;
      Object.assign(r, patch, { updatedAt: patch.updatedAt ?? Date.now() });
      changed();
      return { ...r };
    },
    async deletePoints(runId) {
      points.set(runId, []);
      changed();
    },
    async deleteRun(id) {
      runs.delete(id);
      points.delete(id);
      changed();
    },
  };
}
