/**
 * Orquestra a corrida entre a fila offline, o sync e as stores (telas chamam estas funções).
 *  - começar: UUID da corrida (expo-crypto) + linha na fila;
 *  - cada ponto: grava na fila com `seq` (antes de qualquer rede);
 *  - terminar: grava o fim, calcula o resumo provisório com o domain e tenta finalizar no servidor;
 *  - resultado oficial: atualiza zonas (refetch), XP/confiança, neblina e o histórico.
 */
import * as Crypto from 'expo-crypto';

import type { RunContext } from '@/domain/run-engine';
import { basePace } from '@/domain/scoring';
import type { LatLng } from '@/domain/types';
import { loadProfile } from '@/features/auth/session-controller';
import * as activitiesRepo from '@/services/api/activities-repo';
import { bboxAround } from '@/services/api/zones-repo';
import { getQueueStore } from '@/services/offline/queue';
import type { NewPoint, QueuedPoint, QueuedRun, ServerMission } from '@/services/offline/types';
import * as contactsRepo from '@/services/safety/contacts-repo';
import { getSyncEngine } from '@/services/sync/sync-service';
import type { SyncOutcome } from '@/services/sync/sync-engine';
import type { OfficialResult } from '@/services/sync/types';
import { useGame, type LocalRun, type MissionId } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';

import { officialSummary, provisionalSummary, simplifyPath, type RunSummary } from './summary-model';

/** Quanto a tela espera o servidor antes de mostrar o resumo provisório. */
export const FINISH_WAIT_MS = 12_000;

export const toServerMission = (m: MissionId): ServerMission => (m === 'fuga' || m === 'caca' ? m : 'livre');

function parse<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function toLocalRun(q: QueuedRun): LocalRun {
  const official = parse<OfficialResult>(q.official);
  const provisional = parse<RunSummary>(q.provisional);
  const path = (parse<[number, number][]>(q.path) ?? []).map(([lat, lng]) => ({ lat, lng }));
  return {
    id: q.id,
    state: q.state,
    mission: q.mission,
    startedAt: q.startedAt,
    endedAt: q.endedAt,
    simulated: q.simulated,
    summary: official ? officialSummary(official) : provisional,
    path,
    error: q.error,
  };
}

export async function refreshLocalRuns(userId: string): Promise<LocalRun[]> {
  const runs = (await getQueueStore().listRuns(userId)).map(toLocalRun);
  useGame.getState().setLocalRuns(runs);
  return runs;
}

export async function startRecording(opts: { userId: string; mission: MissionId; ghostPace: number | null; simulated: boolean; startedAt: number }): Promise<string> {
  const id = Crypto.randomUUID();
  await getQueueStore().createRun(
    { id, userId: opts.userId, mission: toServerMission(opts.mission), ghostPace: opts.mission === 'fuga' ? opts.ghostPace : null, startedAt: opts.startedAt, simulated: opts.simulated },
    opts.startedAt,
  );
  return id;
}

export async function recordPoints(runId: string, points: NewPoint[]): Promise<number[]> {
  return getQueueStore().appendPoints(runId, points);
}

export async function setRunPaused(runId: string, paused: boolean) {
  await getQueueStore().updateRun(runId, { paused });
}

export async function readAllPoints(runId: string): Promise<QueuedPoint[]> {
  const out: QueuedPoint[] = [];
  const store = getQueueStore();
  for (;;) {
    const page = await store.readPoints(runId, out.length ? out[out.length - 1].seq + 1 : 0, 1000);
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/** Contexto da estimativa/provisório: o mesmo que o servidor usa, com os dados que o aparelho tem. */
export function currentContext(now: number, ghostPace?: number): RunContext {
  const g = useGame.getState();
  return {
    faction: g.faction ?? 'striders',
    basePace: basePace(g.recentPaces),
    streakDays: Math.min(10, g.streakWeeks),
    zones: useZones.getState().zones,
    revealedFog: new Set(g.fog),
    now,
    ghostPace,
  };
}

/** Grava o fim, calcula o resumo provisório (UC-01 A1) e devolve a corrida local. Corrida sem pontos é descartada. */
export async function endRun(runId: string, endedAt: number): Promise<LocalRun | null> {
  const store = getQueueStore();
  const q = await store.getRun(runId);
  if (!q) return null;
  const points = await readAllPoints(runId);
  if (points.length < 2) {
    await store.deleteRun(runId);
    return null;
  }
  const g = useGame.getState();
  const ctx = currentContext(endedAt, q.mission === 'fuga' && q.ghostPace ? q.ghostPace : undefined);
  const { summary } = provisionalSummary({
    points,
    startedAt: q.startedAt,
    context: ctx,
    trust: g.trust,
    zoneNames: Object.fromEntries(Object.entries(useZones.getState().meta).map(([id, m]) => [id, m.name])),
  });
  const updated = await store.updateRun(runId, {
    state: 'pending',
    endedAt,
    paused: false,
    provisional: JSON.stringify(summary),
    path: JSON.stringify(simplifyPath(points)),
  });
  const local = updated ? toLocalRun(updated) : null;
  if (local) useGame.getState().upsertLocalRun(local);
  return local;
}

/** Tenta confirmar no servidor; se demorar, a tela segue com o provisório e o sync termina depois. */
export async function confirmRun(runId: string, waitMs = FINISH_WAIT_MS): Promise<SyncOutcome | null> {
  wireSyncEvents(); // o resultado que chegar depois do tempo de espera ainda atualiza o resumo
  const p = getSyncEngine().syncRun(runId, { force: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), waitMs);
  });
  const out = await Promise.race([p.catch(() => null), timeout]);
  clearTimeout(timer);
  if (out?.run) useGame.getState().upsertLocalRun(toLocalRun(out.run));
  return out;
}

const center = (path: LatLng[]) => path[Math.floor(path.length / 2)] ?? null;

/** Efeitos do resultado oficial: zonas, progresso, neblina, histórico. Nunca lança. */
export async function applyOfficialEffects(run: LocalRun): Promise<void> {
  const userId = useSession.getState().session?.userId;
  const c = center(run.path);
  const tasks: Promise<unknown>[] = [];
  if (c) tasks.push(useZones.getState().loadBbox(bboxAround(c, 2500)));
  if (userId) tasks.push(loadPlayerProgress(userId));
  tasks.push(loadProfile());
  tasks.push(loadFog());
  await Promise.allSettled(tasks);
}

export async function loadPlayerProgress(userId: string) {
  const res = await activitiesRepo.getMyProgress(userId);
  if (res.ok) useGame.getState().applyServerProgress(res.data);
  return res;
}

export async function loadFog() {
  const res = await activitiesRepo.listMyFogCells();
  if (res.ok) useGame.getState().setFog(res.data);
  return res;
}

/** Baús abertos no servidor (vazio enquanto P-12 estiver aberta; os locais continuam valendo). */
export async function loadChests() {
  const res = await activitiesRepo.listMyChestOpens();
  if (res.ok && res.data.length) useGame.getState().setOpenedChests(res.data);
  return res;
}

export async function loadSafetyContacts() {
  const res = await contactsRepo.listContacts();
  if (res.ok) useGame.getState().setSafetyContacts(res.data);
  return res;
}

export async function loadHistory(opts: { from?: number; to?: number } = {}) {
  const res = await activitiesRepo.listMyActivities(opts);
  if (res.ok) useGame.getState().setServerRuns(res.data);
  return res;
}

/** Corridas que ficaram "gravando" porque o app foi fechado no meio: passam a pendentes. */
export async function recoverInterrupted(userId: string, activeRunId: string | null) {
  const store = getQueueStore();
  for (const r of await store.listRuns(userId)) {
    if (r.state === 'syncing') await store.updateRun(r.id, { state: 'pending' });
    if (r.state !== 'recording' || r.id === activeRunId) continue;
    if (r.lastSeq < 1) {
      await store.deleteRun(r.id);
      continue;
    }
    const last = await store.readPoints(r.id, r.lastSeq, 1);
    await endRun(r.id, last[0]?.t ?? r.updatedAt);
  }
}

let unsubscribe: (() => void) | null = null;

/** Liga o espelho fila → store e os efeitos do resultado oficial (uma vez por processo). */
export function wireSyncEvents() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = getSyncEngine().subscribe((run, official) => {
    const local = toLocalRun(run);
    useGame.getState().upsertLocalRun(local);
    if (official) void applyOfficialEffects(local);
  });
  return unsubscribe;
}
