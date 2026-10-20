/**
 * Sync da fila offline com o servidor (RF-005, RNF-005, RNF-006, D-03, D-04).
 *
 * - Lotes de até `batchSize` pontos, a partir do último `seq` confirmado, assinados com HMAC.
 * - Reenvio idempotente: o servidor ignora `(activityId, seq)` repetidos.
 * - `OUT_OF_ORDER` / `MISSING_POINTS`: recomeça de `details.lastSeq + 1`.
 * - `UNKNOWN_DEVICE` / `INVALID_SIGNATURE`: registra (renova) a chave do aparelho e tenta uma vez.
 * - 401: renova a sessão e tenta uma vez. Rede/5xx: mantém na fila com espera exponencial.
 * - `ACTIVITY_CLOSED`: a corrida já foi fechada; busca o resultado guardado.
 * - `REPLAY_MISMATCH`, `DEVICE_MISMATCH`, `NOT_OWNER`, `ACCOUNT_INACTIVE`, `VALIDATION`: erro definitivo.
 * - `POINTS_LIMIT` / `TOO_MANY_OPEN_RUNS` (409, D-50): erro definitivo com mensagem clara, sem novas tentativas;
 *   os pontos continuam no aparelho (só a confirmação oficial apaga os pontos locais).
 * - `endedAt` vai limitado a "agora": a simulação 10× gera horários à frente do relógio e o servidor
 *   recusa fim depois de agora + 5 min (QA-09).
 */
import { signBatch } from '@/services/signing/canonical';
import type { DeviceKey } from '@/services/signing/device-key';

import type { QueuedPoint, QueuedRun, QueueStore } from '@/services/offline/types';

import { isRetryable, type ApiFailure, type IngestBody, type OfficialResult, type SyncTransport } from './types';

export const SYNC_BATCH_SIZE = 200;
export const SYNC_INTERVAL_MS = 5000;
export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 5 * 60_000;
const MAX_FINISH_ROUNDS = 4;

export type KeyRing = {
  load(userId: string): Promise<DeviceKey>;
  save(userId: string, key: DeviceKey): Promise<void>;
  /** Gera outro deviceId/segredo (DEVICE_TAKEN). */
  regenerate(userId: string): Promise<DeviceKey>;
};

export type SyncDeps = {
  store: QueueStore;
  transport: SyncTransport;
  keys: KeyRing;
  platform: 'ios' | 'android' | 'web';
  model?: string;
  now?: () => number;
  batchSize?: number;
};

export type SyncStatus = 'synced' | 'uploaded' | 'pending' | 'failed' | 'skipped';

export type SyncOutcome = { status: SyncStatus; run: QueuedRun | null; official?: OfficialResult; error?: ApiFailure };

export type SyncListener = (run: QueuedRun, official?: OfficialResult) => void;

/** Mensagens pt-BR dos erros definitivos (mostradas no histórico/resumo). */
export const FAILURE_MESSAGE: Record<string, string> = {
  REPLAY_MISMATCH: 'O servidor já recebeu pontos diferentes para esta corrida. Ela não pode ser enviada de novo.',
  DEVICE_MISMATCH: 'Esta corrida começou em outro aparelho e não pode ser enviada deste.',
  NOT_OWNER: 'Esta corrida pertence a outra conta.',
  ACCOUNT_INACTIVE: 'Sua conta está inativa. A corrida não pode ser enviada.',
  INVALID_SIGNATURE: 'A assinatura dos pontos não foi aceita pelo servidor.',
  FACTION_REQUIRED: 'Escolha uma facção antes de enviar a corrida.',
  VALIDATION: 'O servidor recusou os dados desta corrida.',
  NO_POINTS: 'A corrida não tem pontos de GPS para enviar.',
  POINTS_LIMIT: 'Esta corrida passou do limite de pontos de GPS aceito pelo servidor e não pode ser enviada. Os pontos continuam guardados no aparelho.',
  TOO_MANY_OPEN_RUNS:
    'Você já tem 3 corridas começadas nas últimas 24 horas sem terminar de enviar. Esta não foi enviada; os pontos continuam guardados no aparelho.',
};

const failureMessage = (e: ApiFailure) => FAILURE_MESSAGE[e.code] ?? e.message;

export function backoffDelay(attempts: number) {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

export function toBody(run: QueuedRun, key: DeviceKey, points: QueuedPoint[]): IngestBody {
  const fromSeq = points[0].seq;
  const toSeq = points[points.length - 1].seq;
  const pts = points.map((p) => ({
    seq: p.seq,
    lat: p.lat,
    lng: p.lng,
    t: p.t,
    accuracy: p.accuracy,
    speed: p.speed,
    altitude: p.altitude,
    mocked: p.mocked,
    steps: p.steps,
  }));
  const signature = signBatch(key.secret, { activityId: run.id, deviceId: key.deviceId, fromSeq, toSeq, points: pts });
  const body: IngestBody = { activityId: run.id, deviceId: key.deviceId, startedAt: run.startedAt, mission: run.mission, fromSeq, toSeq, points: pts, signature };
  if (run.mission === 'fuga' && run.ghostPace !== null) body.ghostPace = Math.round(run.ghostPace);
  return body;
}

export function createSyncEngine(deps: SyncDeps) {
  const now = deps.now ?? Date.now;
  const batchSize = deps.batchSize ?? SYNC_BATCH_SIZE;
  const listeners = new Set<SyncListener>();
  const inflight = new Map<string, Promise<SyncOutcome>>();
  const { store, transport } = deps;

  const emit = (run: QueuedRun | null, official?: OfficialResult) => {
    if (run) for (const l of listeners) l(run, official);
  };

  async function update(id: string, patch: Parameters<QueueStore['updateRun']>[1]) {
    const r = await store.updateRun(id, patch);
    emit(r);
    return r;
  }

  async function ensureDevice(userId: string, force = false): Promise<{ ok: true; key: DeviceKey } | { ok: false; error: ApiFailure }> {
    let key = await deps.keys.load(userId);
    if (key.registered && !force) return { ok: true, key };
    for (let i = 0; i < 2; i++) {
      const res = await transport.registerDevice({ deviceId: key.deviceId, secret: key.secret, platform: deps.platform, ...(deps.model ? { model: deps.model.slice(0, 100) } : {}) });
      if (res.ok) {
        key = { ...key, registered: true };
        await deps.keys.save(userId, key);
        return { ok: true, key };
      }
      if (res.error.code === 'DEVICE_TAKEN') {
        key = await deps.keys.regenerate(userId);
        continue;
      }
      if (res.error.status === 401 && i === 0 && (await transport.refreshSession())) continue;
      return { ok: false, error: res.error };
    }
    return { ok: false, error: { code: 'DEVICE_TAKEN', status: 409, message: 'Não foi possível registrar este aparelho.' } };
  }

  async function retryLater(run: QueuedRun, error: ApiFailure): Promise<SyncOutcome> {
    const attempts = run.attempts + 1;
    const r = await update(run.id, {
      attempts,
      nextAttemptAt: now() + backoffDelay(attempts),
      error: error.code === 'NETWORK' ? null : error.message,
      errorCode: error.code,
      ...(run.state === 'syncing' ? { state: 'pending' as const } : {}),
    });
    return { status: 'pending', run: r, error };
  }

  async function failRun(run: QueuedRun, error: ApiFailure): Promise<SyncOutcome> {
    const r = await update(run.id, { state: 'failed', error: failureMessage(error), errorCode: error.code });
    return { status: 'failed', run: r, error };
  }

  /** Envia todos os pontos ainda não confirmados. */
  async function push(runId: string): Promise<SyncOutcome> {
    let run = await store.getRun(runId);
    if (!run) return { status: 'skipped', run: null };
    let dev = await ensureDevice(run.userId);
    if (!dev.ok) return isRetryable(dev.error) || dev.error.status === 401 ? retryLater(run, dev.error) : failRun(run, dev.error);
    let reregistered = false;
    let refreshed = false;
    // Envia até o que existia ao começar (pontos que chegam durante o envio vão no próximo ciclo).
    const target = run.lastSeq;

    while (run.ackedSeq < target) {
      const points = await store.readPoints(run.id, run.ackedSeq + 1, Math.min(batchSize, target - run.ackedSeq));
      if (points.length === 0) break;
      const res = await transport.ingest(toBody(run, dev.key, points));
      if (res.ok) {
        const acked = Math.max(run.ackedSeq, Math.min(res.data.lastSeq, points[points.length - 1].seq));
        run = (await update(run.id, { ackedSeq: acked, attempts: 0, nextAttemptAt: 0, error: null, errorCode: null })) ?? run;
        continue;
      }
      const e = res.error;
      const lastSeq = e.details?.lastSeq;
      if (e.code === 'OUT_OF_ORDER' && typeof lastSeq === 'number') {
        // O servidor tem menos do que achávamos: recomeça do que ele confirmou.
        run = (await update(run.id, { ackedSeq: Math.min(lastSeq, run.lastSeq) })) ?? run;
        continue;
      }
      if (e.code === 'ACTIVITY_CLOSED') {
        run = (await update(run.id, { ackedSeq: run.lastSeq })) ?? run;
        break;
      }
      if ((e.code === 'UNKNOWN_DEVICE' || e.code === 'INVALID_SIGNATURE') && !reregistered) {
        reregistered = true;
        dev = await ensureDevice(run.userId, true);
        if (!dev.ok) return isRetryable(dev.error) ? retryLater(run, dev.error) : failRun(run, dev.error);
        continue;
      }
      if (e.status === 401 && e.code !== 'UNKNOWN_DEVICE' && e.code !== 'INVALID_SIGNATURE' && !refreshed) {
        refreshed = true;
        if (await transport.refreshSession()) continue;
        return retryLater(run, e);
      }
      if (isRetryable(e) || e.status === 401) return retryLater(run, e);
      return failRun(run, e);
    }
    return { status: 'uploaded', run };
  }

  async function finish(runId: string): Promise<SyncOutcome> {
    let run = await store.getRun(runId);
    if (!run) return { status: 'skipped', run: null };
    if (run.state === 'synced' || run.state === 'failed') return { status: run.state === 'synced' ? 'synced' : 'failed', run };
    if (run.lastSeq < 0) return failRun(run, { code: 'NO_POINTS', status: 0, message: FAILURE_MESSAGE.NO_POINTS });
    run = (await update(run.id, { state: 'syncing' })) ?? run;
    let refreshed = false;

    for (let round = 0; round < MAX_FINISH_ROUNDS; round++) {
      const pushed = await push(run.id);
      if (pushed.status !== 'uploaded') return pushed;
      run = pushed.run ?? run;
      const res = await transport.finish({ activityId: run.id, lastSeq: run.lastSeq, ...(run.endedAt ? { endedAt: Math.min(run.endedAt, now()) } : {}) });
      if (res.ok) return confirm(run, res.data);
      const e = res.error;
      if (e.code === 'MISSING_POINTS') {
        const lastSeq = typeof e.details?.lastSeq === 'number' ? e.details.lastSeq : -1;
        run = (await update(run.id, { ackedSeq: Math.min(lastSeq, run.lastSeq) })) ?? run;
        continue;
      }
      if (e.code === 'ACTIVITY_CLOSED' && transport.fetchResult) {
        const stored = await transport.fetchResult(run.id);
        if (stored.ok && stored.data) return confirm(run, stored.data);
        if (!stored.ok && isRetryable(stored.error)) return retryLater(run, stored.error);
        return failRun(run, e);
      }
      if (e.status === 401 && !refreshed) {
        refreshed = true;
        if (await transport.refreshSession()) continue;
        return retryLater(run, e);
      }
      if (isRetryable(e) || e.status === 401) return retryLater(run, e);
      return failRun(run, e);
    }
    return retryLater(run, { code: 'MISSING_POINTS', status: 409, message: 'O servidor ainda não recebeu todos os pontos.' });
  }

  async function confirm(run: QueuedRun, official: OfficialResult): Promise<SyncOutcome> {
    const r = await store.updateRun(run.id, {
      state: 'synced',
      ackedSeq: run.lastSeq,
      official: JSON.stringify(official),
      error: null,
      errorCode: null,
      attempts: 0,
      nextAttemptAt: 0,
    });
    // Pontos já estão no servidor; o resumo usa o percurso simplificado guardado na corrida.
    await store.deletePoints(run.id);
    emit(r, official);
    return { status: 'synced', run: r, official };
  }

  function once(runId: string, fn: () => Promise<SyncOutcome>): Promise<SyncOutcome> {
    const running = inflight.get(runId);
    if (running) return running.then(() => fn());
    const p = fn().finally(() => inflight.delete(runId));
    inflight.set(runId, p);
    return p;
  }

  /** Sincroniza uma corrida: em gravação só envia pontos; terminada, envia e finaliza. */
  function syncRun(runId: string, opts: { force?: boolean } = {}): Promise<SyncOutcome> {
    return once(runId, async () => {
      const run = await store.getRun(runId);
      if (!run) return { status: 'skipped', run: null };
      if (run.state === 'synced' || run.state === 'failed') return { status: run.state === 'synced' ? 'synced' : 'failed', run };
      if (!opts.force && run.nextAttemptAt > now()) return { status: 'pending', run };
      if (run.state === 'recording') return push(runId);
      return finish(runId);
    });
  }

  /** Tudo o que estiver pendente do usuário (abrir o app, voltar a conexão). */
  async function syncAll(userId?: string, opts: { force?: boolean } = {}): Promise<SyncOutcome[]> {
    const runs = await store.listRuns(userId);
    const out: SyncOutcome[] = [];
    for (const r of runs) {
      if (r.state === 'synced' || r.state === 'failed') continue;
      if (r.state === 'recording' && r.ackedSeq >= r.lastSeq) continue;
      out.push(await syncRun(r.id, opts));
    }
    return out;
  }

  return {
    syncRun,
    syncAll,
    ensureDevice,
    subscribe(l: SyncListener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
