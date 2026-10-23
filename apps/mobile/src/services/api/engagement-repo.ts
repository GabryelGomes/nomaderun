/**
 * Engajamento v2 (E7, T7.2.4; D-63 a D-66): missões, baú do dia, trilha da temporada, pausa de saúde, nível e
 * o bloco `extras.engagement` do `finish-activity`. Contrato: `docs/API_CONTRATO.md` ("Contrato v2") e
 * `docs/melhoria/relatorios/E7-contrato-v2.md` §3 e §8.
 *
 * Servidor antigo (`PGRST202`) ou recurso desligado (`FEATURE_DISABLED`) não é erro: a chamada devolve
 * `{ available: false }` e a tela mostra o estado "em breve". As regras ficam no `src/domain`; aqui só se lê,
 * valida o formato e se chama a RPC.
 */
import type { ChestRarity } from '@/domain/games';
import type { MissionCadence, MissionTier } from '@/domain/missions';
import {
  brtCalendar,
  DAILY_CHEST,
  levelProgress,
  runnerBand,
  XP_SOURCE_LABELS,
  type HealthPause,
  type SeasonMedal,
  type XpSource,
} from '@/domain/progression';

import { listMyActivities, type ActivitySummary } from './activities-repo';
import { AppError, attempt, ok, type Result } from './errors';
import { requireSupabase } from './supabase';

/* ---------- Disponibilidade ---------- */

export type Unavailable = { available: false; reason: 'old_server' | 'disabled' };
export type Maybe<T> = { available: true; data: T } | Unavailable;

/** Códigos que significam "o servidor ainda não tem isso" (não é falha da pessoa nem da rede). */
const OLD_SERVER = new Set(['PGRST202', 'PGRST205', '42883', '42P01']);

export function unavailableReason(error: AppError): Unavailable['reason'] | null {
  if (error.detail === 'FEATURE_DISABLED') return 'disabled';
  if (error.detail && OLD_SERVER.has(error.detail)) return 'old_server';
  return null;
}

/** Converte a falha "indisponível" em resultado normal; as outras continuam como erro. */
export function asMaybe<T>(res: Result<T>): Result<Maybe<T>> {
  if (res.ok) return ok({ available: true, data: res.data });
  const reason = unavailableReason(res.error);
  return reason ? ok({ available: false, reason }) : res;
}

/* ---------- Leitura tolerante ---------- */

type Row = Record<string, unknown>;

const RARITIES: readonly ChestRarity[] = ['comum', 'raro', 'lendario'];
const CADENCES: readonly MissionCadence[] = ['diaria', 'semanal', 'ftue', 'volta'];
const TIERS: readonly MissionTier[] = ['leve', 'padrao', 'desafio'];
const MEDALS: readonly SeasonMedal[] = ['bronze', 'prata', 'ouro'];

const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Row[]) : []);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
const ms = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};
const rarity = (v: unknown, fallback: ChestRarity = 'comum'): ChestRarity => (RARITIES.includes(v as ChestRarity) ? (v as ChestRarity) : fallback);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (list.includes(v as T) ? (v as T) : null);
const byRarity = (v: unknown, fallback: Readonly<Record<ChestRarity, number>>): Record<ChestRarity, number> => {
  const o = obj(v);
  return { comum: num(o.comum, fallback.comum), raro: num(o.raro, fallback.raro), lendario: num(o.lendario, fallback.lendario) };
};
const pause = (v: unknown): HealthPause | null => {
  const o = obj(v);
  return typeof o.from === 'string' && typeof o.until === 'string' ? { from: o.from, until: o.until } : null;
};

/* ---------- Missões (`my_missions`, `reroll_mission`, `claim_mission`) ---------- */

export type EngagementMission = {
  /** Id da atribuição (`user_missions.id`): é ele que vai para a troca e o resgate. */
  id: string;
  /** Id do catálogo (`d-km`, `f1-dominio`…). */
  defId: string;
  cadence: MissionCadence;
  tier: MissionTier;
  slot: number;
  variant: 'base' | 'fallback';
  /** Texto pronto (≤ 40), com o alvo já no lugar do `{x}`. */
  title: string;
  metric: string;
  progress: number;
  target: number;
  xp: number;
  bonus: { dailyChest?: ChestRarity; cosmetic?: string; streakRestart?: boolean } | null;
  periodKey: string;
  availableFrom: number | null;
  availableUntil: number | null;
  completedAt: number | null;
  claimedAt: number | null;
  rerolled: boolean;
};

export type EngagementMissions = {
  periods: { daily: string; weekly: string };
  daily: EngagementMission[];
  weekly: EngagementMission[];
  /** Primeira semana: só os passos já liberados vêm do servidor (o 1º na criação, 1 por dia depois). */
  ftue: EngagementMission[];
  ftueStartedAt: number | null;
  comeback: EngagementMission | null;
  rerollsLeft: number;
};

export function parseMission(v: unknown): EngagementMission | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  const defId = strOrNull(r.defId);
  const cadence = oneOf(CADENCES, r.kind ?? r.cadence);
  if (!id || !defId || !cadence) return null;
  const b = obj(r.bonus);
  const bonus =
    r.bonus && typeof r.bonus === 'object'
      ? {
          ...(RARITIES.includes(b.dailyChest as ChestRarity) ? { dailyChest: b.dailyChest as ChestRarity } : {}),
          ...(typeof b.cosmetic === 'string' ? { cosmetic: b.cosmetic } : {}),
          ...(b.streakRestart === true ? { streakRestart: true } : {}),
        }
      : null;
  const target = Math.max(1, num(r.target, 1));
  return {
    id,
    defId,
    cadence,
    tier: oneOf(TIERS, r.tier) ?? 'leve',
    slot: num(r.slot),
    variant: r.variant === 'fallback' ? 'fallback' : 'base',
    title: str(r.title),
    metric: str(r.metric),
    progress: Math.min(target, Math.max(0, num(r.progress))),
    target,
    xp: Math.max(0, num(r.xp)),
    bonus,
    periodKey: str(r.periodKey),
    availableFrom: ms(r.availableFrom),
    availableUntil: ms(r.availableUntil),
    completedAt: ms(r.completedAt),
    claimedAt: ms(r.claimedAt),
    rerolled: r.rerolled === true,
  };
}

const missions = (v: unknown) =>
  arr(v)
    .map(parseMission)
    .filter((m): m is EngagementMission => m !== null)
    .sort((a, b) => a.slot - b.slot);

export function parseMissions(data: unknown): EngagementMissions {
  const d = obj(data);
  const p = obj(d.periods);
  return {
    periods: { daily: str(p.daily), weekly: str(p.weekly) },
    daily: missions(d.daily),
    weekly: missions(d.weekly),
    ftue: missions(d.ftue),
    ftueStartedAt: ms(d.ftueStartedAt),
    comeback: parseMission(d.comeback),
    rerollsLeft: Math.max(0, num(d.rerollsLeft)),
  };
}

export async function fetchMissions(): Promise<Result<Maybe<EngagementMissions>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('my_missions');
      if (error) throw error;
      return parseMissions(data);
    }),
  );
}

/** Troca 1 missão diária por dia (mesmo slot, progresso 0). Erros: `MISSION_REROLL_LIMIT`, `MISSION_COMPLETED`… */
export async function rerollMission(id: string): Promise<Result<Maybe<EngagementMission>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('reroll_mission', { p_id: id });
      if (error) throw error;
      const m = parseMission(data);
      if (!m) throw new AppError('SERVER', 'Resposta inesperada do servidor.', { detail: 'BAD_RESPONSE' });
      return m;
    }),
  );
}

/** Idempotente: a conclusão já paga na hora; serve para conferir (`alreadyClaimed`). */
export async function claimMission(id: string): Promise<Result<Maybe<{ id: string; xp: number; alreadyClaimed: boolean }>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('claim_mission', { p_id: id });
      if (error) throw error;
      const d = obj(data);
      return { id: str(d.id, id), xp: num(d.xp), alreadyClaimed: d.alreadyClaimed === true };
    }),
  );
}

/* ---------- Baú do dia (`my_daily_chest`, `open_daily_chests`) ---------- */

export type DailyChestState = {
  /** Guardados agora (0..3): 1 crédito por dia, acumula até 3 (D-66). */
  stored: number;
  maxStored: number;
  /** Baús bônus pendentes (primeira semana, volta, trilha), pela raridade mínima. */
  bonus: ChestRarity[];
  /** Faltam N baús para o lendário garantido. */
  pityLeft: number;
  openedToday: boolean;
  /** Chances públicas (0–1), XP e chance de cosmético por raridade: sempre visíveis. */
  odds: Record<ChestRarity, number>;
  xp: Record<ChestRarity, number>;
  cosmeticChance: Record<ChestRarity, number>;
  minMeters: number;
};

export function parseDailyChest(data: unknown): DailyChestState {
  const d = obj(data);
  return {
    stored: Math.max(0, Math.min(3, num(d.stored))),
    maxStored: num(d.maxStored, DAILY_CHEST.maxStored),
    bonus: (Array.isArray(d.bonus) ? d.bonus : []).map((x) => rarity(x)),
    pityLeft: Math.max(1, num(d.pityLeft, DAILY_CHEST.pity)),
    openedToday: d.openedToday === true,
    odds: byRarity(d.odds, DAILY_CHEST.odds),
    xp: byRarity(d.xp, DAILY_CHEST.xp),
    cosmeticChance: byRarity(d.cosmeticChance, DAILY_CHEST.cosmeticChance),
    minMeters: num(d.minMeters, DAILY_CHEST.minMeters),
  };
}

export type ChestPrize = { n: number; rarity: ChestRarity; xp: number; cosmeticId: string | null; duplicate: boolean; guaranteed: boolean; bonus: boolean };

export type DailyChestOpening = { prizes: ChestPrize[]; pityLeft: number; odds: Record<ChestRarity, number>; alreadyOpened: boolean };

const prize = (r: Row, bonus: boolean): ChestPrize => ({
  n: num(r.n),
  rarity: rarity(r.rarity ?? r.minRarity),
  xp: Math.max(0, num(r.xp)),
  cosmeticId: strOrNull(r.cosmeticId),
  duplicate: r.duplicate === true,
  guaranteed: r.guaranteed === true,
  bonus,
});

export function parseChestOpening(data: unknown): DailyChestOpening {
  const d = obj(data);
  return {
    prizes: [...arr(d.prizes).map((r) => prize(r, false)), ...arr(d.bonus).map((r) => prize(r, true))],
    pityLeft: Math.max(1, num(d.pityLeft, DAILY_CHEST.pity)),
    odds: byRarity(d.odds, DAILY_CHEST.odds),
    alreadyOpened: d.alreadyOpened === true,
  };
}

export async function fetchDailyChest(): Promise<Result<Maybe<DailyChestState>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('my_daily_chest');
      if (error) throw error;
      return parseDailyChest(data);
    }),
  );
}

/** Abre todos os guardados. Erros: `DAILY_CHEST_LOCKED` (sem 1 km hoje), `DAILY_CHEST_REVIEW` (em revisão). */
export async function openDailyChests(): Promise<Result<Maybe<DailyChestOpening>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('open_daily_chests');
      if (error) throw error;
      return parseChestOpening(data);
    }),
  );
}

/* ---------- Trilha da temporada (`my_track`, `claim_track_step`) ---------- */

export type TrackItem = {
  kind: 'chest' | 'cosmetic' | 'xp' | 'medal' | 'freeze';
  cosmeticId: string | null;
  amount: number | null;
  rarity: ChestRarity | null;
  medalTier: SeasonMedal | null;
};

export type TrackStep = { step: number; unlocked: boolean; claimed: boolean; items: TrackItem[] };

export type SeasonTrack = {
  seasonId: string;
  endsAt: number | null;
  xp: number;
  step: number;
  stepXp: number;
  steps: number;
  intoStep: number;
  nextStepXp: number | null;
  prestigeStars: number;
  medal: SeasonMedal | null;
  rewards: TrackStep[];
};

const TRACK_KINDS: readonly TrackItem['kind'][] = ['chest', 'cosmetic', 'xp', 'medal', 'freeze'];

export function parseTrackItem(v: unknown): TrackItem | null {
  const r = obj(v);
  const kind = oneOf(TRACK_KINDS, r.kind);
  if (!kind) return null;
  return {
    kind,
    cosmeticId: strOrNull(r.cosmeticId),
    amount: numOrNull(r.amount),
    rarity: RARITIES.includes(r.rarity as ChestRarity) ? (r.rarity as ChestRarity) : null,
    medalTier: oneOf(MEDALS, r.medalTier),
  };
}

const items = (v: unknown) => arr(v).map(parseTrackItem).filter((i): i is TrackItem => i !== null);

export function parseTrack(data: unknown): SeasonTrack {
  const d = obj(data);
  return {
    seasonId: str(d.seasonId),
    endsAt: ms(d.endsAt),
    xp: Math.max(0, num(d.xp)),
    step: Math.max(0, num(d.step)),
    stepXp: Math.max(1, num(d.stepXp, 120)),
    steps: Math.max(1, num(d.steps, 24)),
    intoStep: Math.max(0, num(d.intoStep)),
    nextStepXp: numOrNull(d.nextStepXp),
    prestigeStars: Math.max(0, num(d.prestigeStars)),
    medal: oneOf(MEDALS, d.medal),
    rewards: arr(d.rewards)
      .map((r) => ({ step: num(r.step), unlocked: r.unlocked === true, claimed: r.claimed === true, items: items(r.items) }))
      .filter((r) => r.step > 0)
      .sort((a, b) => a.step - b.step),
  };
}

export async function fetchTrack(): Promise<Result<Maybe<SeasonTrack>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('my_track');
      if (error) throw error;
      return parseTrack(data);
    }),
  );
}

/** Resgata um degrau alcançado (idempotente). Erros: `TRACK_LOCKED`, `INVALID_STEP`. */
export async function claimTrackStep(step: number): Promise<Result<Maybe<{ step: number; alreadyClaimed: boolean; items: TrackItem[] }>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('claim_track_step', { p_step: step });
      if (error) throw error;
      const d = obj(data);
      return { step: num(d.step, step), alreadyClaimed: d.alreadyClaimed === true, items: items(d.items) };
    }),
  );
}

/* ---------- Pausa de saúde (`start_health_pause`, `end_health_pause`) ---------- */

export type HealthPauseInfo = { from: string; until: string; seasonId: string };

const pauseInfo = (data: unknown): HealthPauseInfo | null => {
  const d = obj(data);
  return typeof d.from === 'string' && typeof d.until === 'string' ? { from: d.from, until: d.until, seasonId: str(d.seasonId) } : null;
};

/** 1 a 4 semanas, 1 vez por temporada. Erros: `PAUSE_WEEKS`, `PAUSE_ACTIVE`, `PAUSE_USED`. */
export async function startHealthPause(weeks: number): Promise<Result<Maybe<HealthPauseInfo>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('start_health_pause', { p_weeks: weeks });
      if (error) throw error;
      const p = pauseInfo(data);
      if (!p) throw new AppError('SERVER', 'Resposta inesperada do servidor.', { detail: 'BAD_RESPONSE' });
      return p;
    }),
  );
}

/** Encerra antes: a semana atual continua protegida. `null` = não havia pausa. */
export async function endHealthPause(): Promise<Result<Maybe<HealthPauseInfo | null>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('end_health_pause');
      if (error) throw error;
      return pauseInfo(data);
    }),
  );
}

/* ---------- Situação da pessoa (`my_engagement`, com plano B pelo perfil e pelas corridas) ---------- */

export type OwnedCosmetic = { id: string; variant: string };

export type WeekTotals = { activities: number; meters: number; zones: number };

export type EngagementStatus = {
  /** `server` = `my_engagement`; `profile` = servidor sem a RPC: calculado do perfil e das corridas. */
  source: 'server' | 'profile';
  xp: number;
  level: number;
  intoLevel: number;
  needed: number;
  isMax: boolean;
  title: { id: string; name: string };
  /** Faixa por distância total (material, nunca cor). Nula quando o servidor não informa a distância. */
  band: { id: string; name: string; metersToNext: number; nextName: string | null } | null;
  lifetimeMeters: number | null;
  streak: {
    weeks: number;
    best: number;
    activitiesThisWeek: number;
    freezesLeft: number;
    pause: HealthPause | null;
    /** A pausa desta temporada ainda pode ser usada (nulo = o servidor não informa). */
    pauseAvailable: boolean | null;
  };
  season: { id: string; xp: number; step: number; intoStep: number; medal: SeasonMedal | null; prestigeStars: number } | null;
  createdAt: number | null;
  lastActivityAt: number | null;
  /** Início das últimas atividades (mais nova primeiro), para o horário habitual dos lembretes. */
  recentStartTimes: number[];
  week: WeekTotals;
  previousWeek: WeekTotals | null;
  /** Cosméticos que a pessoa tem (nulo = o servidor ainda não informa). */
  cosmetics: OwnedCosmetic[] | null;
};

const SCORED_STATUS = new Set(['valid', 'partial']);

/** Semana atual e anterior, última atividade e horários, a partir das corridas (mais novas primeiro). */
export function activityFacts(runs: readonly Pick<ActivitySummary, 'status' | 'startedAt' | 'meters' | 'result'>[], now: number) {
  const scored = runs.filter((r) => SCORED_STATUS.has(r.status)).sort((a, b) => b.startedAt - a.startedAt);
  const monday = brtCalendar.weekMonday(brtCalendar.clock(now).dayId);
  const thisWeekStart = brtCalendar.at(monday);
  const lastWeekStart = brtCalendar.at(brtCalendar.addDays(monday, -7));
  const totals = (from: number, to: number): WeekTotals => {
    const inWeek = scored.filter((r) => r.startedAt >= from && r.startedAt < to);
    const zones = new Set(inWeek.flatMap((r) => (r.result?.zones ?? []).filter((z) => z.rp > 0).map((z) => z.zoneId)));
    return { activities: inWeek.length, meters: inWeek.reduce((s, r) => s + Math.max(0, r.meters), 0), zones: zones.size };
  };
  return {
    lastActivityAt: scored[0]?.startedAt ?? null,
    recentStartTimes: scored.slice(0, 10).map((r) => r.startedAt),
    week: totals(thisWeekStart, Number.POSITIVE_INFINITY),
    previousWeek: totals(lastWeekStart, thisWeekStart),
  };
}

const week = (v: unknown): WeekTotals | null => {
  if (!v || typeof v !== 'object') return null;
  const o = obj(v);
  return { activities: Math.max(0, num(o.activities)), meters: Math.max(0, num(o.meters)), zones: Math.max(0, num(o.zones)) };
};

export function parseStatus(data: unknown, facts: ReturnType<typeof activityFacts> | null): EngagementStatus {
  const d = obj(data);
  const xp = Math.max(0, num(d.xp));
  const lp = levelProgress(xp);
  const t = obj(d.title);
  const s = obj(d.streak);
  const lifetime = numOrNull(d.lifetimeMeters);
  const rb = lifetime !== null ? runnerBand(lifetime) : null;
  const se = d.season && typeof d.season === 'object' ? obj(d.season) : null;
  const weeks = Math.max(0, num(s.weeks));
  const cosmetics = Array.isArray(d.cosmetics)
    ? arr(d.cosmetics)
        .map((c) => ({ id: str(c.id ?? c.cosmeticId), variant: str(c.variant) }))
        .filter((c) => c.id.length > 0)
    : null;
  const recent = Array.isArray(d.recentStartTimes) ? d.recentStartTimes.map(ms).filter((x): x is number => x !== null) : null;
  return {
    source: 'server',
    xp,
    level: num(d.level, lp.level),
    intoLevel: num(d.intoLevel, lp.intoLevel),
    needed: num(d.needed, lp.needed),
    isMax: lp.isMax,
    title: { id: str(t.id, lp.title.id), name: str(t.name, lp.title.name) },
    band: rb ? { id: rb.band.id, name: rb.band.name, metersToNext: rb.metersToNext, nextName: rb.next?.name ?? null } : null,
    lifetimeMeters: lifetime,
    streak: {
      weeks,
      best: Math.max(weeks, num(s.best, weeks)),
      activitiesThisWeek: Math.max(0, num(s.activitiesThisWeek, facts?.week.activities ?? 0)),
      freezesLeft: Math.max(0, num(s.freezesLeft)),
      pause: pause(s.pause),
      pauseAvailable: typeof s.pauseAvailable === 'boolean' ? s.pauseAvailable : null,
    },
    season: se
      ? {
          id: str(se.id),
          xp: Math.max(0, num(se.xp)),
          step: Math.max(0, num(se.step)),
          intoStep: Math.max(0, num(se.intoStep)),
          medal: oneOf(MEDALS, se.medal),
          prestigeStars: Math.max(0, num(se.prestigeStars)),
        }
      : null,
    createdAt: ms(d.createdAt),
    lastActivityAt: ms(d.lastActivityAt) ?? facts?.lastActivityAt ?? null,
    recentStartTimes: recent ?? facts?.recentStartTimes ?? [],
    week: week(d.week) ?? facts?.week ?? { activities: 0, meters: 0, zones: 0 },
    previousWeek: week(d.previousWeek) ?? facts?.previousWeek ?? null,
    cosmetics,
  };
}

/** Plano B (servidor sem `my_engagement`): XP e sequência do perfil v1; o resto das corridas. */
export function statusFromProfile(profile: { xp: number; streakWeeks: number; freezesLeft: number }, facts: ReturnType<typeof activityFacts>): EngagementStatus {
  const s = parseStatus({ xp: profile.xp, streak: { weeks: profile.streakWeeks, freezesLeft: profile.freezesLeft } }, facts);
  return { ...s, source: 'profile' };
}

const FACTS_DAYS = 35;

async function loadFacts(now: number) {
  const runs = await listMyActivities({ from: now - FACTS_DAYS * 86_400_000, limit: 60 });
  return runs.ok ? activityFacts(runs.data, now) : null;
}

/** Nível, título, faixa, sequência, pausa e temporada. Nunca "indisponível": sem a RPC, usa o perfil v1. */
export async function fetchEngagementStatus(userId: string, now: number): Promise<Result<EngagementStatus>> {
  const facts = await loadFacts(now);
  const res = asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('my_engagement');
      if (error) throw error;
      return data;
    }),
  );
  if (!res.ok) return res;
  if (res.data.available) return ok(parseStatus(res.data.data, facts));
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('profiles').select('xp,streak_weeks,freezes_left').eq('id', userId).single();
    if (error) throw error;
    const p = obj(data);
    return statusFromProfile(
      { xp: num(p.xp), streakWeeks: num(p.streak_weeks), freezesLeft: num(p.freezes_left, 1) },
      facts ?? activityFacts([], now),
    );
  });
}

/* ---------- Bloco `extras.engagement` do `finish-activity` (E7 contrato §8) ---------- */

export type RunXpLine = { source: XpSource | string; amount: number; label: string };

export type RunEngagement = {
  xp: { total: number; lines: RunXpLine[] };
  level: { before: number; after: number; titleAfter: { id: string; name: string } | null };
  band: { before: string; after: string } | null;
  dailyChests:
    | { opened: (ChestPrize & { n: number })[]; pityLeft: number; reason: null; stored: number }
    | { opened: []; pityLeft: null; reason: 'status' | 'distance' | 'review' | 'already'; stored: number };
  missions: { id: string; userMissionId: string; cadence: MissionCadence; text: string; xp: number }[];
  streak: { activitiesThisWeek: number; weekKept: boolean; weeks: number; best: number; freezesLeft: number; paused: boolean } | null;
  season: { stepBefore: number; stepAfter: number; medal: SeasonMedal | null } | null;
  ftue: { stepDone: number | null; nextUnlocksAt: number | null } | null;
  comeback: { missionId: string } | null;
};

const REFUSALS = ['status', 'distance', 'review', 'already'] as const;

export function parseRunEngagement(official: unknown): RunEngagement | null {
  const e = obj(obj(obj(official).extras).engagement);
  if (!e.xp || !e.level) return null;
  const x = obj(e.xp);
  const lv = obj(e.level);
  const ta = obj(lv.titleAfter);
  const dc = obj(e.dailyChests);
  const opened = arr(dc.opened).map((r) => prize(r, r.bonus === true));
  const reason = oneOf(REFUSALS, dc.reason);
  const st = e.streak && typeof e.streak === 'object' ? obj(e.streak) : null;
  const se = e.season && typeof e.season === 'object' ? obj(e.season) : null;
  const ft = e.ftue && typeof e.ftue === 'object' ? obj(e.ftue) : null;
  const cb = e.comeback && typeof e.comeback === 'object' ? obj(e.comeback) : null;
  const bd = e.band && typeof e.band === 'object' ? obj(e.band) : null;
  const lines = arr(x.lines)
    .map((l) => {
      const source = str(l.source);
      const label = str(l.label) || XP_SOURCE_LABELS[source as XpSource] || source;
      return { source, amount: Math.max(0, num(l.amount)), label };
    })
    .filter((l) => l.amount > 0);
  return {
    xp: { total: Math.max(0, num(x.total, lines.reduce((s, l) => s + l.amount, 0))), lines },
    level: {
      before: Math.max(1, num(lv.before, 1)),
      after: Math.max(1, num(lv.after, num(lv.before, 1))),
      titleAfter: typeof ta.id === 'string' && typeof ta.name === 'string' ? { id: ta.id, name: ta.name } : null,
    },
    band: bd && typeof bd.before === 'string' && typeof bd.after === 'string' ? { before: bd.before, after: bd.after } : null,
    dailyChests:
      opened.length > 0 || !reason
        ? { opened, pityLeft: Math.max(1, num(dc.pityLeft, DAILY_CHEST.pity)), reason: null, stored: Math.max(0, num(dc.stored)) }
        : { opened: [], pityLeft: null, reason, stored: Math.max(0, num(dc.stored)) },
    missions: arr(e.missions)
      .map((m) => ({
        id: str(m.id),
        userMissionId: str(m.userMissionId),
        cadence: oneOf(CADENCES, m.cadence) ?? 'diaria',
        text: str(m.text),
        xp: Math.max(0, num(m.xp)),
      }))
      .filter((m) => m.id.length > 0),
    streak: st
      ? {
          activitiesThisWeek: Math.max(0, num(st.activitiesThisWeek)),
          weekKept: st.weekKept === true,
          weeks: Math.max(0, num(st.weeks)),
          best: Math.max(0, num(st.best)),
          freezesLeft: Math.max(0, num(st.freezesLeft)),
          paused: st.paused === true,
        }
      : null,
    season: se ? { stepBefore: Math.max(0, num(se.stepBefore)), stepAfter: Math.max(0, num(se.stepAfter)), medal: oneOf(MEDALS, se.medal) } : null,
    ftue: ft ? { stepDone: numOrNull(ft.stepDone), nextUnlocksAt: ms(ft.nextUnlocksAt) } : null,
    comeback: cb && typeof cb.missionId === 'string' ? { missionId: cb.missionId } : null,
  };
}
