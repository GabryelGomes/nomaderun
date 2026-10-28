/**
 * Controlador do engajamento v2 (E7, T7.2.4): carrega e atualiza o store a partir do `engagement-repo`.
 * Telas e hooks chamam daqui; nada aqui decide regra (o servidor e o `src/domain` decidem).
 */
import * as repo from '@/services/api/engagement-repo';
import { AppError, fail, ok, type Result } from '@/services/api/errors';
import { useEngagement, type SlotKey } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';

import { flushTelemetry, loadTelemetryConsent, trackTelemetry } from './telemetry';

const currentUser = () => {
  const s = useSession.getState();
  return s.status === 'signedIn' ? (s.session?.userId ?? null) : null;
};

/** Grava no store o resultado de uma leitura que pode estar "indisponível". */
function store<K extends SlotKey>(key: K, res: Result<repo.Maybe<NonNullable<ReturnType<typeof useEngagement.getState>[K]['data']>>>) {
  const s = useEngagement.getState();
  if (!res.ok) s.setError(key, res.error);
  else if (!res.data.available) s.setUnavailable(key, res.data.reason);
  else s.setReady(key, res.data.data);
}

let inflight: Promise<void> | null = null;
let again = false;

/**
 * Recarrega tudo (situação, missões, baú e trilha) em paralelo. Uma chamada durante outra marca uma nova
 * leitura logo depois (o dado de uma corrida recém-confirmada nunca fica para trás).
 */
export function refreshEngagement(now: number = Date.now()): Promise<void> {
  const userId = currentUser();
  if (!userId) return Promise.resolve();
  if (inflight) {
    again = true;
    return inflight;
  }
  const s = useEngagement.getState();
  s.setUser(userId);
  (['status', 'missions', 'chest', 'track'] as const).forEach((k) => s.setLoading(k));
  inflight = (async () => {
    try {
      const [status, missions, chest, track, conquered] = await Promise.all([
        repo.fetchEngagementStatus(userId, now),
        repo.fetchMissions(),
        repo.fetchDailyChest(),
        repo.fetchTrack(),
        repo.fetchEverConquered(userId),
        loadTelemetryConsent(),
      ]);
      if (useEngagement.getState().userId !== userId) return; // trocou de conta no meio
      useEngagement.getState().setEverConquered(conquered);
      if (status.ok) useEngagement.getState().setReady('status', status.data);
      else useEngagement.getState().setError('status', status.error);
      store('missions', missions);
      store('chest', chest);
      store('track', track);
      useEngagement.getState().setLoadedAt(now);
      // Telemetria (D-82): só sai com o consentimento ligado; sem ele, `trackTelemetry` não guarda nada.
      trackTelemetry('app_open', undefined, now);
      void flushTelemetry();
    } finally {
      inflight = null;
      if (again) {
        again = false;
        void refreshEngagement(Date.now());
      }
    }
  })();
  return inflight;
}

const unavailable = () => new AppError('SERVER', 'Este recurso ainda não está disponível no servidor.', { detail: 'FEATURE_DISABLED' });

function unwrap<T>(res: Result<repo.Maybe<T>>): Result<T> {
  if (!res.ok) return res;
  return res.data.available ? ok(res.data.data) : fail(unavailable());
}

/** Troca a missão do dia (1 por dia). O store reflete a troca na hora. */
export async function rerollDailyMission(id: string): Promise<Result<repo.EngagementMission>> {
  const res = unwrap(await repo.rerollMission(id));
  if (res.ok) useEngagement.getState().replaceMission(res.data);
  return res;
}

/** Abre os baús guardados (só com 1 km pontuado hoje) e recarrega a situação, o baú e a trilha. */
export async function openStoredChests(now: number = Date.now()): Promise<Result<repo.DailyChestOpening>> {
  const res = unwrap(await repo.openDailyChests());
  if (res.ok) void refreshAfterReward(now);
  return res;
}

/** Resgata um degrau da trilha e recarrega. */
export async function claimSeasonStep(step: number, now: number = Date.now()): Promise<Result<{ step: number; alreadyClaimed: boolean; items: repo.TrackItem[] }>> {
  const res = unwrap(await repo.claimTrackStep(step));
  if (res.ok) void refreshAfterReward(now);
  return res;
}

export async function startPause(weeks: number, now: number = Date.now()): Promise<Result<repo.HealthPauseInfo>> {
  const res = unwrap(await repo.startHealthPause(weeks));
  if (res.ok) await refreshEngagement(now);
  return res;
}

export async function endPause(now: number = Date.now()): Promise<Result<repo.HealthPauseInfo | null>> {
  const res = unwrap(await repo.endHealthPause());
  if (res.ok) await refreshEngagement(now);
  return res;
}

async function refreshAfterReward(now: number) {
  const userId = currentUser();
  if (!userId) return;
  const [status, chest, track] = await Promise.all([repo.fetchEngagementStatus(userId, now), repo.fetchDailyChest(), repo.fetchTrack()]);
  if (useEngagement.getState().userId !== userId) return;
  if (status.ok) useEngagement.getState().setReady('status', status.data);
  store('chest', chest);
  store('track', track);
}

/**
 * Corrida confirmada pelo servidor: guarda o bloco `extras.engagement` (se o servidor mandou) para o resumo e
 * recarrega o resto. Devolve o bloco lido, ou `null` com o servidor v1.
 */
export function recordRunResult(official: unknown, now: number = Date.now()): repo.RunEngagement | null {
  const block = repo.parseRunEngagement(official);
  const id = (official as { activityId?: unknown } | null)?.activityId;
  if (block && typeof id === 'string') useEngagement.getState().setLastRun(id, block);
  const conquered = conqueredZones(official);
  if (conquered > 0) useEngagement.getState().setEverConquered(true);
  if (typeof id === 'string') {
    trackTelemetry('run_finished', undefined, now);
    if (conquered > 0) trackTelemetry('zone_conquered', { count: conquered }, now);
    for (const m of block?.missions ?? []) trackTelemetry('mission_completed', { cadence: m.cadence }, now);
    void flushTelemetry();
  }
  void refreshEngagement(now);
  return block;
}

/** Zonas conquistadas no resultado oficial (`zones[].outcome`). */
export function conqueredZones(official: unknown): number {
  const zones = (official as { zones?: unknown } | null)?.zones;
  return Array.isArray(zones) ? zones.filter((z) => (z as { outcome?: unknown } | null)?.outcome === 'conquered').length : 0;
}

let rankingMarked: { user: string; day: string } | null = null;

/**
 * A pessoa abriu o ranking do time (passo 6 da primeira semana sem liga real). 1 aviso por dia; se concluiu
 * missão, recarrega as missões. A tela do ranking (E6c) chama ao montar; o atalho da primeira semana também.
 */
export async function markRankingOpened(now: number = Date.now()): Promise<Result<repo.StateMissionsCompleted>> {
  const userId = currentUser();
  if (!userId) return fail(new AppError('UNAUTHORIZED', 'Entre de novo.'));
  const day = new Date(now - 3 * 3_600_000).toISOString().slice(0, 10);
  if (rankingMarked?.user === userId && rankingMarked.day === day) return ok({ completed: [] });
  rankingMarked = { user: userId, day };
  const res = unwrap(await repo.recordRankingOpened());
  if (!res.ok) {
    if (res.error.detail !== 'FEATURE_DISABLED') rankingMarked = null;
    return res;
  }
  if (res.data.completed.length > 0) {
    for (const m of res.data.completed) trackTelemetry('mission_completed', m.cadence ? { cadence: m.cadence } : undefined, now);
    void refreshEngagement(now);
  }
  return res;
}

let conquestInflight: Promise<void> | null = null;

/** Lê só o "já conquistou?" quando ainda não se sabe (a tela da corrida pode abrir antes do Mapa). */
export function ensureConquestHistory(): Promise<void> {
  const userId = currentUser();
  if (!userId) return Promise.resolve();
  if (conquestInflight) return conquestInflight;
  const s = useEngagement.getState();
  s.setUser(userId);
  if (useEngagement.getState().everConquered !== null) return Promise.resolve();
  conquestInflight = (async () => {
    try {
      const v = await repo.fetchEverConquered(userId);
      if (useEngagement.getState().userId === userId) useEngagement.getState().setEverConquered(v);
    } finally {
      conquestInflight = null;
    }
  })();
  return conquestInflight;
}
