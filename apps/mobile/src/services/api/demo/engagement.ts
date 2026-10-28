/**
 * Pares de demonstração do engajamento v2 (E7, T7.2.4): `my_engagement`, `my_missions`, `reroll_mission`,
 * `claim_mission`, `my_daily_chest`, `open_daily_chests`, `my_track`, `claim_track_step`, `start_health_pause`
 * e `end_health_pause`, mais o bloco `extras.engagement` do `finish-activity` (E7 contrato §8).
 *
 * Tudo sai das regras do `src/domain` (`progression.ts`, `missions.ts`) sobre as corridas do banco de
 * demonstração. O histórico é **reproduzido** na primeira chamada (cada corrida semeada passa pela mesma regra
 * que uma corrida nova), então missões, baús guardados, garantia do lendário, trilha e primeira semana
 * ficam coerentes entre si. O sorteio usa `engagementRng` (o servidor real usa HMAC com segredo).
 */
import type { ActivityValidation } from '@/domain/anti-cheat';
import type { ChestRarity } from '@/domain/games';
import { districtOf } from '@/domain/grid';
import {
  comebackAssignment,
  drawMissions,
  FTUE_STEP_IDS,
  ftueAssignment,
  ftueSteps,
  missionById,
  missionText,
  missionXpSource,
  rerollMission,
  settleMission,
  type MissionActivity,
  type MissionAssignment,
  type MissionContext,
  type MissionEvidence,
} from '@/domain/missions';
import {
  brtCalendar,
  canOpenDailyChests,
  DAILY_CHEST,
  dailyChestRolls,
  dailyChestsStored,
  endHealthPause,
  engagementRng,
  levelProgress,
  rollDailyChest,
  resolveCosmeticDrop,
  runnerBand,
  runXp,
  SEASON_TRACK,
  seasonTrackStep,
  startHealthPause,
  titleForLevel,
  unlockedTitles,
  weekKeptXp,
  XP_SOURCE_LABELS,
  type HealthPause,
  type StreakV2State,
  type XpDayTotals,
  type XpSource,
} from '@/domain/progression';

import { iso, msOf, raise, type DemoDb, type Row } from './db';

type RpcHandler = (db: DemoDb, userId: string | null, args: Row) => unknown;

/* ---------- Catálogos (iguais às migrations `rewards_catalog` e `missions_track`) ---------- */

/** Cosméticos que podem sair do baú, por raridade (`cosmetic_defs.in_chest_pool`). */
const CHEST_POOL: Record<ChestRarity, readonly string[]> = {
  comum: [],
  raro: ['rastro-aurora', 'rastro-lava', 'rastro-gelo', 'efeito-confete'],
  lendario: ['rastro-oceano', 'rastro-neon', 'efeito-relampago'],
};

type TrackRewardDef = { kind: 'chest' | 'cosmetic' | 'xp' | 'medal' | 'freeze'; cosmeticId?: string; amount?: number; rarity?: ChestRarity; medalTier?: 'bronze' | 'prata' | 'ouro' };

/** Os 24 degraus da trilha (`track_rewards`). */
export const DEMO_TRACK_REWARDS: Readonly<Record<number, readonly TrackRewardDef[]>> = {
  1: [{ kind: 'chest', rarity: 'raro' }],
  2: [{ kind: 'cosmetic', cosmeticId: 'emblema-temporada' }],
  3: [{ kind: 'cosmetic', cosmeticId: 'moldura-temporada' }],
  4: [{ kind: 'cosmetic', cosmeticId: 'rastro-temporada' }],
  5: [{ kind: 'xp', amount: 50 }],
  6: [{ kind: 'xp', amount: 50 }],
  7: [{ kind: 'xp', amount: 50 }],
  8: [{ kind: 'medal', medalTier: 'bronze' }, { kind: 'freeze' }],
  9: [{ kind: 'cosmetic', cosmeticId: 'efeito-faisca-mes' }],
  10: [{ kind: 'chest', rarity: 'lendario' }],
  11: [{ kind: 'xp', amount: 50 }],
  12: [{ kind: 'cosmetic', cosmeticId: 'rastro-temporada-brilho' }],
  13: [{ kind: 'xp', amount: 75 }],
  14: [{ kind: 'xp', amount: 75 }],
  15: [{ kind: 'xp', amount: 75 }],
  16: [{ kind: 'medal', medalTier: 'prata' }, { kind: 'cosmetic', cosmeticId: 'moldura-temporada-rara' }],
  17: [{ kind: 'chest', rarity: 'raro' }],
  18: [{ kind: 'cosmetic', cosmeticId: 'efeito-pulso-mes' }],
  19: [{ kind: 'xp', amount: 75 }],
  20: [{ kind: 'cosmetic', cosmeticId: 'rastro-temporada-animado' }],
  21: [{ kind: 'xp', amount: 100 }],
  22: [{ kind: 'xp', amount: 100 }],
  23: [{ kind: 'xp', amount: 100 }],
  24: [{ kind: 'medal', medalTier: 'ouro' }, { kind: 'cosmetic', cosmeticId: 'moldura-temporada-animada' }],
};

/** Molduras das faixas de corredor (`cosmetic_defs.source = 'faixa'`). */
const BAND_FRAME: Record<string, string> = {
  asfalto: 'moldura-asfalto',
  bronze: 'moldura-bronze',
  prata: 'moldura-prata',
  ouro: 'moldura-ouro',
  neon: 'moldura-neon',
  holografico: 'moldura-holografica',
  lenda: 'moldura-lenda',
  nomade: 'moldura-nomade',
};

/** Distância anterior ao histórico semeado do perfil cheio (o XP de 1.850 vem de antes também). */
const CHEIO_LIFETIME_BASE_M = 110_000;

/* ---------- Estado por pessoa ---------- */

type Assignment = MissionAssignment & { id: string; rerolledAt: number | null; claimedAt: number | null; createdAt: number };
type LedgerLine = { source: XpSource; ref: string; amount: number; at: number; activityId: string | null };
type ChestOpen = { day: string; n: number; rarity: ChestRarity; xp: number; cosmeticId: string | null; duplicate: boolean; guaranteed: boolean; at: number };
type BonusChest = { id: string; rarity: ChestRarity; source: string; openedAt: number | null };

type EngState = {
  createdAt: number;
  ftueStartedAt: number;
  assignments: Assignment[];
  ledger: LedgerLine[];
  chestOpens: ChestOpen[];
  pity: number;
  bonus: BonusChest[];
  bonusOpens: (ChestOpen & { bonusId: string })[];
  trackClaims: Set<string>;
  cosmetics: Map<string, { id: string; variant: string; source: string }>;
  best: number;
  pause: HealthPause | null;
  pauseUsedSeason: string | null;
  lifetimeBase: number;
  processed: Set<string>;
  seq: number;
  /** Fatos declarados pelo app (`engagement_marks`): compartilhou o card, abriu o ranking (1 por tipo por dia). */
  marks: { kind: 'share' | 'ranking_opened'; day: string; at: number }[];
};

const STATES = new WeakMap<DemoDb, Map<string, EngState>>();

const seasonOf = (at: number) => brtCalendar.clock(at).dayId.slice(0, 7);
const dayOf = (at: number) => brtCalendar.clock(at).dayId;

function requireUser(db: DemoDb, userId: string | null): Row {
  const p = db.profile(userId);
  if (!userId || !p) throw raise('UNAUTHORIZED: faça login novamente');
  if (p.status === 'inactive') throw raise('ACCOUNT_INACTIVE: conta inativa');
  return p;
}

const STATUS: Record<string, ActivityValidation['status']> = { valid: 'valid', partial: 'partially_valid', rejected: 'rejected', review: 'under_review' };

type ActFacts = MissionActivity & { startedAt: number; scored: boolean; huntRarities: ChestRarity[] };

/** Recorte de uma corrida do banco de demonstração para as regras de missão e de XP. */
function factsOf(db: DemoDb, a: Row): ActFacts {
  const r = (a.result ?? {}) as Row;
  const zones = (Array.isArray(r.zones) ? r.zones : []) as Row[];
  const painted = zones.filter((z) => Number(z.rp) > 0).map((z) => String(z.zoneId));
  const hunt = db.tables.chest_opens.filter((c) => c.activity_id === a.id).map((c) => c.rarity as ChestRarity);
  const startedAt = msOf(a.started_at) ?? 0;
  return {
    id: String(a.id),
    startedAt,
    endedAt: msOf(a.ended_at) ?? startedAt,
    status: STATUS[String(a.status)] ?? 'under_review',
    scored: a.scored === true,
    meters: Number(a.meters) || 0,
    movingSeconds: Number(a.moving_seconds) || 0,
    atlasCells: Number(r.newFogCells) || 0,
    zonesPainted: painted,
    districts: [...new Set(painted.map(districtOf))],
    conquered: zones.filter((z) => z.outcome === 'conquered').length,
    defended: zones.filter((z) => z.outcome === 'defended').length,
    huntChests: hunt.length,
    huntRarities: hunt,
    beatGhost: typeof r.beatGhost === 'boolean' ? r.beatGhost : null,
    group: false,
    raidMeters: 0,
  };
}

function scoredActs(db: DemoDb, userId: string, until = Number.POSITIVE_INFINITY, exclude?: string): ActFacts[] {
  return db.tables.activities
    .filter((a) => a.user_id === userId && a.scored === true && a.id !== exclude)
    .map((a) => factsOf(db, a))
    .filter((a) => a.endedAt <= until)
    .sort((x, y) => x.endedAt - y.endedAt);
}

function context(db: DemoDb, userId: string, at: number, exclude?: string): MissionContext {
  const me = db.profile(userId);
  const acts = scoredActs(db, userId, at, exclude);
  const monday = brtCalendar.weekMonday(dayOf(at));
  const weeks = [1, 2, 3, 4].map((k) => {
    const from = brtCalendar.at(brtCalendar.addDays(monday, -7 * k));
    const to = brtCalendar.at(brtCalendar.addDays(monday, -7 * (k - 1)));
    return acts.filter((a) => a.endedAt >= from && a.endedAt < to).reduce((s, a) => s + a.meters, 0);
  });
  return {
    userId,
    hasCrew: !!db.crewOf(userId),
    zoneUnderAttackNearby: [...db.zones.values()].some((z) => z.owner === me?.faction && z.attacker !== null),
    raidActive: false,
    leagueActive: false,
    recentRunMeters: [...acts].reverse().map((a) => a.meters),
    recentWeekMeters: weeks,
  };
}

function evidence(db: DemoDb, st: EngState, userId: string, at: number): MissionEvidence {
  const marks = (kind: EngState['marks'][number]['kind']) => st.marks.filter((m) => m.kind === kind && m.at <= at).map((m) => m.at);
  return { activities: scoredActs(db, userId, at), inCrew: !!db.crewOf(userId), leaguePoints: 0, sharedAt: marks('share'), rankingOpenedAt: marks('ranking_opened') };
}

const nextId = (st: EngState, prefix: string) => `demo-${prefix}-${(st.seq += 1).toString(36)}`;

function addAssignment(st: EngState, a: MissionAssignment, at: number): Assignment {
  const row: Assignment = { ...a, id: nextId(st, 'missao'), rerolledAt: null, claimedAt: null, createdAt: at };
  st.assignments.push(row);
  return row;
}

function credit(db: DemoDb, st: EngState, userId: string, line: Omit<LedgerLine, 'at'> & { at: number }, live: boolean): number {
  if (line.amount <= 0 || st.ledger.some((l) => l.source === line.source && l.ref === line.ref)) return 0;
  st.ledger.push(line);
  if (live) {
    const p = db.profile(userId);
    if (p) p.xp = Number(p.xp ?? 0) + line.amount;
  }
  return line.amount;
}

/** Dá o cosmético (idempotente) e grava a linha em `user_cosmetics`, que o app lê pelo PostgREST. */
function grantCosmetic(db: DemoDb, st: EngState, userId: string, id: string, variant: string, source: string): boolean {
  const key = `${id}|${variant}`;
  if (st.cosmetics.has(key)) return false;
  st.cosmetics.set(key, { id, variant, source });
  db.tables.user_cosmetics.push({ user_id: userId, cosmetic_id: id, variant, source, unlocked_at: iso(db.now()) });
  return true;
}

/** Garante as atribuições do dia, da semana, da primeira semana e da volta no instante `at`. */
function ensureMissions(db: DemoDb, st: EngState, userId: string, at: number, exclude?: string) {
  const today = dayOf(at);
  const weekId = brtCalendar.weekIdOf(today);
  const ctx = context(db, userId, at, exclude);
  if (!st.assignments.some((a) => a.cadence === 'diaria' && a.period === today)) {
    for (const a of drawMissions(ctx, 'diaria', today)) addAssignment(st, a, at);
  }
  if (!st.assignments.some((a) => a.cadence === 'semanal' && a.period === weekId)) {
    for (const a of drawMissions(ctx, 'semanal', today)) addAssignment(st, a, at);
  }
  if (at >= st.ftueStartedAt) {
    const done = Object.fromEntries(st.assignments.filter((a) => a.cadence === 'ftue').map((a) => [a.missionId, a.completedAt]));
    for (const step of ftueSteps({ startedAt: st.ftueStartedAt, completedAt: done, now: at })) {
      if (step.status === 'locked' || step.unlocksAt === null || st.assignments.some((a) => a.missionId === step.id)) continue;
      const a = ftueAssignment(step.id, step.unlocksAt, ctx);
      if (a) addAssignment(st, a, at);
    }
  }
  const last = scoredActs(db, userId, at, exclude).at(-1);
  if (last && !st.assignments.some((a) => a.cadence === 'volta' && a.completedAt === null)) {
    const cb = comebackAssignment(dayOf(last.endedAt), at);
    if (cb && !st.assignments.some((a) => a.period === cb.period)) addAssignment(st, cb, at);
  }
}

type Completed = { id: string; userMissionId: string; cadence: string; text: string; xp: number; slot: number };

/** `settleMission` nas atribuições abertas; a conclusão paga na hora (XP, baú bônus, cosmético). */
function settleOpen(db: DemoDb, st: EngState, userId: string, at: number, live: boolean): Completed[] {
  const ev = evidence(db, st, userId, at);
  const out: Completed[] = [];
  for (const a of st.assignments) {
    if (a.completedAt !== null) continue;
    if (a.availableUntil !== null && at >= a.availableUntil + 60_000) continue;
    const res = settleMission(a, ev, at);
    a.progress = res.assignment.progress;
    if (!res.completedNow) continue;
    const def = missionById(a.missionId)!;
    a.completedAt = at;
    a.claimedAt = at;
    credit(db, st, userId, { source: missionXpSource(def), ref: a.id, amount: res.xp, at, activityId: null }, live);
    if (def.bonus?.dailyChest) st.bonus.push({ id: nextId(st, 'bonus'), rarity: def.bonus.dailyChest, source: def.id, openedAt: null });
    if (def.bonus?.cosmetic) grantCosmetic(db, st, userId, def.bonus.cosmetic, '', `missao:${def.id}`);
    out.push({ id: def.id, userMissionId: a.id, cadence: a.cadence, text: missionText(def, a.target, a.variant), xp: res.xp, slot: a.slot });
  }
  return out;
}

const RANK: Record<ChestRarity, number> = { comum: 0, raro: 1, lendario: 2 };

type OpenResult = { prizes: (ChestOpen & { bonus: boolean })[]; pityLeft: number; xp: number; duplicateXp: number };

/** Abre os baús guardados do dia e os bônus pendentes (os bônus não mexem na garantia). */
function openChests(db: DemoDb, st: EngState, userId: string, at: number, live: boolean): OpenResult {
  const today = dayOf(at);
  const hasActivity = scoredActs(db, userId, at).length > 0;
  const lastOpen = st.chestOpens.at(-1)?.day ?? null;
  const stored = dailyChestsStored({ today, createdDay: dayOf(st.createdAt), lastOpenDay: lastOpen, hasActivity });
  const seed = `${userId}|${today}`;
  const rolls = dailyChestRolls(seed, stored);
  const prizes: OpenResult['prizes'] = [];
  let xp = 0;
  let duplicateXp = 0;
  const pick = (rarity: ChestRarity, roll: number, n: number) => {
    const drop = rarity === 'comum' ? { cosmeticId: null, extraXp: 0 } : resolveCosmeticDrop(roll, CHEST_POOL[rarity], new Set([...st.cosmetics.values()].map((c) => c.id)));
    if (drop.cosmeticId) grantCosmetic(db, st, userId, drop.cosmeticId, '', `bau:${today}:${n}`);
    return drop;
  };
  rolls.forEach((r, i) => {
    const out = rollDailyChest(r, st.pity);
    st.pity = out.pityAfter;
    const drop = out.prize.cosmeticDrop ? pick(out.prize.rarity, engagementRng(`${seed}|cosmetico|${i}`)(), i + 1) : { cosmeticId: null, extraXp: 0 };
    const open: ChestOpen = { day: today, n: i + 1, rarity: out.prize.rarity, xp: out.prize.xp, cosmeticId: drop.cosmeticId, duplicate: drop.extraXp > 0, guaranteed: out.prize.guaranteed, at };
    st.chestOpens.push(open);
    prizes.push({ ...open, bonus: false });
    xp += credit(db, st, userId, { source: 'daily_chest', ref: `${today}:${open.n}`, amount: open.xp, at, activityId: null }, live);
    duplicateXp += credit(db, st, userId, { source: 'duplicate_cosmetic', ref: `${today}:${open.n}`, amount: drop.extraXp, at, activityId: null }, live);
  });
  for (const b of st.bonus.filter((x) => x.openedAt === null)) {
    const r = engagementRng(`${userId}|${b.id}`);
    const roll = rollDailyChest({ rarity: r(), cosmetic: r() }, 0).prize;
    const rarity = RANK[roll.rarity] >= RANK[b.rarity] ? roll.rarity : b.rarity;
    const drop = roll.cosmeticDrop || rarity !== roll.rarity ? pick(rarity, r(), 90 + prizes.length) : { cosmeticId: null, extraXp: 0 };
    const amount = DAILY_CHEST.xp[rarity];
    b.openedAt = at;
    const open = { day: today, n: prizes.length + 1, rarity, xp: amount, cosmeticId: drop.cosmeticId, duplicate: drop.extraXp > 0, guaranteed: false, at, bonusId: b.id };
    st.bonusOpens.push(open);
    prizes.push({ ...open, bonus: true });
    xp += credit(db, st, userId, { source: 'daily_chest', ref: `bonus:${b.id}`, amount, at, activityId: null }, live);
    duplicateXp += credit(db, st, userId, { source: 'duplicate_cosmetic', ref: `bonus:${b.id}`, amount: drop.extraXp, at, activityId: null }, live);
  }
  return { prizes, pityLeft: Math.max(1, DAILY_CHEST.pity - st.pity), xp, duplicateXp };
}

const openedOn = (st: EngState, day: string) => st.chestOpens.some((c) => c.day === day);

function seasonXp(st: EngState, season: string): number {
  return st.ledger.filter((l) => seasonOf(l.at) === season && l.source !== 'season_step').reduce((s, l) => s + l.amount, 0);
}

function lifetime(db: DemoDb, st: EngState, userId: string, at = Number.POSITIVE_INFINITY, exclude?: string): number {
  return st.lifetimeBase + scoredActs(db, userId, at, exclude).reduce((s, a) => s + a.meters, 0);
}

function weekActivities(db: DemoDb, userId: string, at: number, exclude?: string): number {
  const from = brtCalendar.at(brtCalendar.weekMonday(dayOf(at)));
  return scoredActs(db, userId, at, exclude).filter((a) => a.endedAt >= from).length;
}

type EngagementBlock = Row;

/**
 * Passa uma atividade pelas regras v2 (a mesma ordem do finish v2, contrato §8): XP em linhas, semana garantida,
 * baú do dia, missões, nível, faixa e trilha. `live = false` reproduz o histórico sem mexer no XP do perfil
 * (o XP semeado já conta esse passado).
 */
function processActivity(db: DemoDb, st: EngState, userId: string, act: Row, live: boolean): EngagementBlock {
  const f = factsOf(db, act);
  const at = f.endedAt;
  const day = dayOf(at);
  const season = seasonOf(at);
  const profile = db.profile(userId)!;
  st.processed.add(f.id);
  const xpBefore = Number(profile.xp ?? 0) - (live ? Number(act.xp ?? 0) : 0);
  const lifetimeBefore = lifetime(db, st, userId, at, f.id);
  const stepBefore = seasonTrackStep(seasonXp(st, season)).step;
  const ledgerBefore = st.ledger.length;

  ensureMissions(db, st, userId, at, f.id);

  const today: XpDayTotals = { meters: 0, atlasXp: 0, completed: false, ghost: false };
  for (const l of st.ledger) {
    if (dayOf(l.at) !== day) continue;
    if (l.source === 'fog') today.atlasXp += l.amount;
    if (l.source === 'run_complete') today.completed = true;
    if (l.source === 'ghost') today.ghost = true;
  }
  today.meters = scoredActs(db, userId, at, f.id).filter((a) => dayOf(a.endedAt) === day).reduce((s, a) => s + a.meters, 0);
  const rx = f.scored
    ? runXp({ status: f.status, meters: f.meters, movingSeconds: f.movingSeconds, newAtlasCells: f.atlasCells, beatGhost: f.beatGhost, huntChests: f.huntRarities, today })
    : { total: 0, lines: [], todayAfter: today };
  for (const l of rx.lines) credit(db, st, userId, { source: l.source, ref: f.id, amount: l.amount, at, activityId: f.id }, live);

  const weekBefore = weekActivities(db, userId, at, f.id);
  const weekAfter = f.scored ? weekBefore + 1 : weekBefore;
  const kept = weekKeptXp(weekBefore, weekAfter);
  credit(db, st, userId, { source: 'week_kept', ref: brtCalendar.weekIdOf(day), amount: kept, at, activityId: f.id }, live);

  const gate = canOpenDailyChests({ status: f.status, meters: f.meters, trust: Number(profile.trust ?? 100), openedToday: openedOn(st, day) });
  const opened = gate.ok ? openChests(db, st, userId, at, live) : null;

  const completed = settleOpen(db, st, userId, at, live);

  const lines = st.ledger.slice(ledgerBefore);
  const bySource = new Map<XpSource, number>();
  for (const l of lines) bySource.set(l.source, (bySource.get(l.source) ?? 0) + l.amount);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  if (live) {
    // O v1 já somou `response.xp`; a regra v2 substitui esse crédito pelo das linhas (XP nunca diminui).
    profile.xp = Math.max(xpBefore, xpBefore + total);
  }
  const xpAfter = live ? Number(profile.xp) : xpBefore + total;
  const levelBefore = levelProgress(xpBefore).level;
  const levelAfter = levelProgress(xpAfter).level;
  const stepAfter = seasonTrackStep(seasonXp(st, season)).step;
  const ftueDone = completed.find((c) => c.cadence === 'ftue');
  const ftueOpen = st.assignments.filter((a) => a.cadence === 'ftue').length < FTUE_STEP_IDS.length;
  const weeks = Number(profile.streak_weeks ?? 0);
  return {
    xp: { total, lines: [...bySource].map(([source, amount]) => ({ source, amount, label: XP_SOURCE_LABELS[source] })) },
    level: { before: levelBefore, after: levelAfter, titleAfter: titleForLevel(levelAfter).id !== titleForLevel(levelBefore).id ? { id: titleForLevel(levelAfter).id, name: titleForLevel(levelAfter).name } : null },
    band: { before: runnerBand(lifetimeBefore).band.id, after: runnerBand(lifetimeBefore + (f.scored ? f.meters : 0)).band.id },
    dailyChests: opened
      ? { opened: opened.prizes.map((p) => ({ n: p.n, rarity: p.rarity, xp: p.xp, cosmeticDrop: p.cosmeticId !== null || p.duplicate, cosmeticId: p.cosmeticId, duplicate: p.duplicate, guaranteed: p.guaranteed, bonus: p.bonus })), pityLeft: opened.pityLeft }
      : { opened: [], reason: gate.ok ? 'already' : gate.reason, stored: chestState(db, st, userId, at).stored },
    missions: completed.map(({ slot: _slot, ...c }) => c),
    streak: { activitiesThisWeek: weekAfter, weekKept: kept > 0, weeks, best: Math.max(st.best, weeks), freezesLeft: Number(profile.freezes_left ?? 0), paused: isPaused(st, day) },
    season: { stepBefore, stepAfter, medal: seasonTrackStep(seasonXp(st, season)).medal },
    ...(ftueDone ? { ftue: { stepDone: ftueDone.slot, nextUnlocksAt: ftueOpen ? brtCalendar.at(brtCalendar.addDays(day, 1)) : null } } : {}),
    ...(completed.some((c) => c.cadence === 'volta') ? { comeback: { missionId: completed.find((c) => c.cadence === 'volta')!.id } } : {}),
  };
}

const isPaused = (st: EngState, day: string) => !!st.pause && st.pause.from <= day && day <= st.pause.until;

/** Cria o estado e reproduz o histórico semeado (corrida por corrida, na ordem). */
function stateOf(db: DemoDb, userId: string, exclude?: string): EngState {
  let byUser = STATES.get(db);
  if (!byUser) {
    byUser = new Map();
    STATES.set(db, byUser);
  }
  const existing = byUser.get(userId);
  if (existing) return existing;
  const profile = db.profile(userId)!;
  const now = db.now();
  const createdAt = msOf(profile.created_at) ?? now;
  const veteran = Number(profile.xp ?? 0) > 0;
  const st: EngState = {
    createdAt,
    // A primeira semana do perfil cheio começou há 3 dias (já tem passo feito); a conta nova começa agora.
    ftueStartedAt: veteran ? brtCalendar.at(brtCalendar.addDays(dayOf(now), -3), 9) : createdAt,
    assignments: [],
    ledger: [],
    chestOpens: [],
    pity: veteran ? 6 : 0,
    bonus: [],
    bonusOpens: [],
    trackClaims: new Set(),
    cosmetics: new Map(),
    best: veteran ? 3 : 0,
    pause: null,
    pauseUsedSeason: null,
    lifetimeBase: veteran ? CHEIO_LIFETIME_BASE_M : 0,
    processed: new Set(),
    seq: 0,
    marks: [],
  };
  byUser.set(userId, st);
  for (const a of db.tables.activities.filter((x) => x.user_id === userId && x.status !== 'recording' && x.id !== exclude).sort((x, y) => (msOf(x.ended_at) ?? 0) - (msOf(y.ended_at) ?? 0))) {
    processActivity(db, st, userId, a, false);
  }
  ensureMissions(db, st, userId, now, exclude);
  settleOpen(db, st, userId, now, false);
  // Recompensas já resgatadas no passado: degraus da trilha até o penúltimo alcançado, título e faixa.
  const season = seasonOf(now);
  const reached = seasonTrackStep(seasonXp(st, season)).step;
  for (let s = 1; s < reached; s++) claimStep(db, st, userId, s, season, now, false);
  const level = levelProgress(Number(profile.xp ?? 0)).level;
  for (const t of unlockedTitles(level)) if (t.unlocks) grantCosmetic(db, st, userId, t.unlocks, '', `titulo:${t.id}`);
  const band = runnerBand(lifetime(db, st, userId, now, exclude)).band;
  for (const [id, frame] of Object.entries(BAND_FRAME)) {
    grantCosmetic(db, st, userId, frame, '', `faixa:${id}`);
    if (id === band.id) break;
  }
  return st;
}

/* ---------- Respostas no formato das RPCs ---------- */

function missionJson(a: Assignment) {
  const def = missionById(a.missionId)!;
  const fb = a.variant === 'fallback' && def.fallback;
  return {
    id: a.id,
    defId: a.missionId,
    kind: a.cadence,
    tier: def.tier,
    slot: a.slot,
    variant: a.variant,
    title: missionText(def, a.target, a.variant),
    metric: fb ? fb.metric : def.metric,
    progress: Math.round(a.progress),
    target: a.target,
    xp: def.xp,
    bonus: def.bonus ?? null,
    periodKey: a.period,
    availableFrom: a.availableFrom,
    availableUntil: a.availableUntil,
    completedAt: a.completedAt,
    claimedAt: a.claimedAt,
    rerolled: a.rerolledAt !== null,
  };
}

function rerollsToday(st: EngState, now: number) {
  const today = dayOf(now);
  return st.assignments.filter((a) => a.rerolledAt !== null && dayOf(a.rerolledAt) === today).length;
}

function chestState(db: DemoDb, st: EngState, userId: string, now: number) {
  const today = dayOf(now);
  const opened = openedOn(st, today);
  const hasActivity = scoredActs(db, userId, now).length > 0;
  const stored = opened ? 0 : dailyChestsStored({ today, createdDay: dayOf(st.createdAt), lastOpenDay: st.chestOpens.at(-1)?.day ?? null, hasActivity });
  return {
    stored,
    maxStored: DAILY_CHEST.maxStored,
    bonus: st.bonus.filter((b) => b.openedAt === null).map((b) => b.rarity),
    pityLeft: Math.max(1, DAILY_CHEST.pity - st.pity),
    openedToday: opened,
    odds: { ...DAILY_CHEST.odds },
    xp: { ...DAILY_CHEST.xp },
    cosmeticChance: { ...DAILY_CHEST.cosmeticChance },
    minMeters: DAILY_CHEST.minMeters,
  };
}

function trackJson(st: EngState, now: number) {
  const season = seasonOf(now);
  const xp = seasonXp(st, season);
  const t = seasonTrackStep(xp);
  const nextMonth = brtCalendar.addDays(`${season}-28`, 7).slice(0, 7);
  return {
    seasonId: season,
    endsAt: brtCalendar.at(`${nextMonth}-01`),
    xp,
    step: t.step,
    stepXp: SEASON_TRACK.stepXp,
    steps: SEASON_TRACK.steps,
    intoStep: t.intoStep,
    nextStepXp: t.step < SEASON_TRACK.steps ? (t.step + 1) * SEASON_TRACK.stepXp : null,
    prestigeStars: t.prestigeStars,
    medal: t.medal,
    rewards: Object.entries(DEMO_TRACK_REWARDS).map(([k, items]) => {
      const step = Number(k);
      return {
        step,
        unlocked: step <= t.step,
        claimed: st.trackClaims.has(`${season}:${step}`),
        items: items.map((i) => ({ kind: i.kind, cosmeticId: i.cosmeticId ?? null, amount: i.amount ?? null, rarity: i.rarity ?? null, medalTier: i.medalTier ?? null })),
      };
    }),
  };
}

function claimStep(db: DemoDb, st: EngState, userId: string, step: number, season: string, now: number, live: boolean) {
  const key = `${season}:${step}`;
  if (st.trackClaims.has(key)) return { step, seasonId: season, alreadyClaimed: true, items: [] };
  st.trackClaims.add(key);
  const items = DEMO_TRACK_REWARDS[step] ?? [];
  for (const i of items) {
    if (i.kind === 'cosmetic' && i.cosmeticId) grantCosmetic(db, st, userId, i.cosmeticId, season, `trilha:${key}`);
    if (i.kind === 'xp') credit(db, st, userId, { source: 'season_step', ref: key, amount: i.amount ?? 0, at: now, activityId: null }, live);
    if (i.kind === 'chest' && i.rarity) st.bonus.push({ id: nextId(st, 'bonus'), rarity: i.rarity, source: `trilha:${key}`, openedAt: live ? null : now });
    if (i.kind === 'freeze' && live) {
      const p = db.profile(userId);
      if (p) p.freezes_left = Math.min(2, Number(p.freezes_left ?? 0) + 1);
    }
  }
  return { step, seasonId: season, alreadyClaimed: false, items: items.map((i) => ({ kind: i.kind, cosmeticId: i.cosmeticId ?? null, amount: i.amount ?? null, rarity: i.rarity ?? null, medalTier: i.medalTier ?? null })) };
}

function streakState(db: DemoDb, st: EngState, userId: string): StreakV2State {
  const p = db.profile(userId)!;
  const weeks = Number(p.streak_weeks ?? 0);
  return { weeks, best: Math.max(st.best, weeks), freezesLeft: Number(p.freezes_left ?? 0), pause: st.pause, pauseUsedSeason: st.pauseUsedSeason };
}


/** Mesmo formato do `my_engagement()` da E9 (onda 2): parte `null` = recurso desligado (aqui, tudo ligado). */
function engagementJson(db: DemoDb, st: EngState, userId: string, now: number) {
  const p = db.profile(userId)!;
  const xp = Number(p.xp ?? 0);
  const lp = levelProgress(xp);
  const life = lifetime(db, st, userId, now);
  const band = runnerBand(life);
  const today = dayOf(now);
  const season = seasonOf(now);
  const s = streakState(db, st, userId);
  const sxp = seasonXp(st, season);
  const t = seasonTrackStep(sxp);
  const chest = chestState(db, st, userId, now);
  const weekId = brtCalendar.weekIdOf(today);
  const pick = (f: (a: Assignment) => boolean) => st.assignments.filter(f).sort((a, b) => a.slot - b.slot).map(missionJson);
  const comeback = st.assignments.filter((a) => a.cadence === 'volta' && a.completedAt === null).at(-1);
  return {
    level: lp.level,
    xp,
    intoLevel: lp.intoLevel,
    needed: lp.needed,
    isMax: lp.isMax,
    title: { id: lp.title.id, name: lp.title.name },
    band: { id: band.band.id, name: band.band.name, next: band.next?.id ?? null, metersToNext: band.metersToNext },
    lifetimeMeters: life,
    streak: { weeks: s.weeks, best: s.best, freezesLeft: s.freezesLeft, activitiesThisWeek: weekActivities(db, userId, now), pause: st.pause },
    dailyChest: { stored: chest.stored, openedToday: chest.openedToday, pityLeft: chest.pityLeft, odds: chest.odds },
    missions: {
      daily: pick((a) => a.cadence === 'diaria' && a.period === today),
      weekly: pick((a) => a.cadence === 'semanal' && a.period === weekId),
      ftue: pick((a) => a.cadence === 'ftue'),
      comeback: comeback ? missionJson(comeback) : null,
    },
    season: { id: season, xp: sxp, step: t.step, intoStep: t.intoStep, medal: t.medal, prestigeStars: t.prestigeStars },
  };
}

/** Guarda o fato (1 por tipo por dia, como `engagement_marks`) e paga as missões que ele concluir. */
function mark(db: DemoDb, st: EngState, userId: string, kind: EngState['marks'][number]['kind'], now: number) {
  const day = dayOf(now);
  if (!st.marks.some((m) => m.kind === kind && m.day === day)) st.marks.push({ kind, day, at: now });
  return settleOpen(db, st, userId, now, true).map(({ slot: _slot, ...c }) => c);
}

function open(db: DemoDb, userId: string | null) {
  requireUser(db, userId);
  const st = stateOf(db, userId!);
  const now = db.now();
  ensureMissions(db, st, userId!, now);
  settleOpen(db, st, userId!, now, true);
  return { st, now, uid: userId! };
}

export const ENGAGEMENT_RPC_HANDLERS: Record<string, RpcHandler> = {
  my_engagement: (db, userId) => {
    const { st, now, uid } = open(db, userId);
    return engagementJson(db, st, uid, now);
  },

  my_missions: (db, userId) => {
    const { st, now } = open(db, userId);
    const today = dayOf(now);
    const weekId = brtCalendar.weekIdOf(today);
    const pick = (f: (a: Assignment) => boolean) => st.assignments.filter(f).sort((a, b) => a.slot - b.slot).map(missionJson);
    const comeback = st.assignments.filter((a) => a.cadence === 'volta' && a.completedAt === null).at(-1);
    return {
      periods: { daily: today, weekly: weekId },
      daily: pick((a) => a.cadence === 'diaria' && a.period === today),
      weekly: pick((a) => a.cadence === 'semanal' && a.period === weekId),
      ftue: pick((a) => a.cadence === 'ftue'),
      ftueStartedAt: st.ftueStartedAt,
      comeback: comeback ? missionJson(comeback) : null,
      rerollsLeft: Math.max(0, 1 - rerollsToday(st, now)),
    };
  },

  reroll_mission: (db, userId, args) => {
    const { st, now, uid } = open(db, userId);
    const a = st.assignments.find((x) => x.id === args.p_id);
    if (!a) throw raise('NOT_FOUND: missão não encontrada');
    if (a.cadence !== 'diaria' || a.period !== dayOf(now)) throw raise('MISSION_NOT_REROLLABLE: só as missões de hoje podem ser trocadas');
    if (a.completedAt !== null) throw raise('MISSION_COMPLETED: esta missão já foi concluída');
    const current = st.assignments.filter((x) => x.cadence === 'diaria' && x.period === a.period);
    const res = rerollMission(context(db, uid, now), current, a.slot, rerollsToday(st, now));
    if (!res.ok) {
      if (res.reason === 'limit') throw raise('MISSION_REROLL_LIMIT: você já trocou uma missão hoje');
      if (res.reason === 'completed') throw raise('MISSION_COMPLETED: esta missão já foi concluída');
      throw raise('MISSION_NO_OPTION: não há outra missão deste nível hoje');
    }
    Object.assign(a, res.assignment, { rerolledAt: now, claimedAt: null });
    settleOpen(db, st, uid, now, true);
    return missionJson(a);
  },

  claim_mission: (db, userId, args) => {
    const { st } = open(db, userId);
    const a = st.assignments.find((x) => x.id === args.p_id);
    if (!a) throw raise('NOT_FOUND: missão não encontrada');
    if (a.completedAt === null) throw raise('MISSION_NOT_COMPLETED: a missão ainda não foi concluída');
    return { id: a.id, claimed: false, alreadyClaimed: true, xp: missionById(a.missionId)?.xp ?? 0, claimedAt: a.claimedAt };
  },

  // Passo 7 da primeira semana (E7 vale sobre o par da E8, D-85): o compartilhamento conta para as missões.
  record_share: (db, userId, args) => {
    const { st, now, uid } = open(db, userId);
    const act = db.tables.activities.find((a) => a.id === args.p_activity && a.user_id === uid && a.status !== 'recording');
    if (!act) throw raise('NOT_FOUND: corrida não encontrada');
    return { completed: mark(db, st, uid, 'share', now) };
  },

  // Alternativa do passo 6 sem liga real: "Veja o ranking do seu time".
  record_ranking_opened: (db, userId) => {
    const { st, now, uid } = open(db, userId);
    return { completed: mark(db, st, uid, 'ranking_opened', now) };
  },

  my_daily_chest: (db, userId) => {
    const { st, now, uid } = open(db, userId);
    return chestState(db, st, uid, now);
  },

  open_daily_chests: (db, userId) => {
    const { st, now, uid } = open(db, userId);
    const today = dayOf(now);
    if (openedOn(st, today)) {
      return {
        prizes: st.chestOpens.filter((c) => c.day === today).map((c) => ({ n: c.n, rarity: c.rarity, xp: c.xp, cosmeticId: c.cosmeticId, duplicate: c.duplicate, guaranteed: c.guaranteed })),
        bonus: [],
        pityLeft: Math.max(1, DAILY_CHEST.pity - st.pity),
        odds: { ...DAILY_CHEST.odds },
        alreadyOpened: true,
      };
    }
    const from = brtCalendar.at(today);
    const runToday = scoredActs(db, uid, now).some((a) => a.endedAt >= from && a.meters >= DAILY_CHEST.minMeters);
    if (!runToday) throw raise('DAILY_CHEST_LOCKED: corra 1 km hoje para abrir os baús');
    if (Number(db.profile(uid)?.trust ?? 100) < DAILY_CHEST.minTrust) throw raise('DAILY_CHEST_REVIEW: seus baús ficam guardados até a revisão das corridas');
    const res = openChests(db, st, uid, now, true);
    const strip = ({ n, rarity, xp, cosmeticId, duplicate, guaranteed }: ChestOpen) => ({ n, rarity, xp, cosmeticId, duplicate, guaranteed });
    return {
      prizes: res.prizes.filter((p) => !p.bonus).map(strip),
      bonus: res.prizes.filter((p) => p.bonus).map(strip),
      pityLeft: res.pityLeft,
      odds: { ...DAILY_CHEST.odds },
      alreadyOpened: false,
    };
  },

  my_track: (db, userId) => {
    const { st, now } = open(db, userId);
    return trackJson(st, now);
  },

  claim_track_step: (db, userId, args) => {
    const { st, now, uid } = open(db, userId);
    const step = Number(args.p_step);
    if (!Number.isInteger(step) || step < 1 || step > SEASON_TRACK.steps) throw raise('INVALID_STEP: degrau inválido');
    const season = seasonOf(now);
    if (seasonXp(st, season) < step * SEASON_TRACK.stepXp) throw raise('TRACK_LOCKED: degrau ainda não alcançado');
    return claimStep(db, st, uid, step, season, now, true);
  },

  start_health_pause: (db, userId, args) => {
    const { st, now, uid } = open(db, userId);
    const season = seasonOf(now);
    const res = startHealthPause(streakState(db, st, uid), { weeks: Number(args.p_weeks), today: dayOf(now), seasonId: season });
    if (!res.ok) {
      if (res.reason === 'weeks') throw raise('PAUSE_WEEKS: escolha de 1 a 4 semanas');
      if (res.reason === 'active') throw raise('PAUSE_ACTIVE: você já está numa pausa');
      throw raise('PAUSE_USED: a pausa desta temporada já foi usada');
    }
    st.pause = res.state.pause;
    st.pauseUsedSeason = res.state.pauseUsedSeason;
    return { from: st.pause!.from, until: st.pause!.until, seasonId: season };
  },

  end_health_pause: (db, userId) => {
    const { st, now, uid } = open(db, userId);
    const today = dayOf(now);
    if (!st.pause || !isPaused(st, today)) return null;
    st.pause = endHealthPause(streakState(db, st, uid), today).pause;
    return st.pause ? { from: st.pause.from, until: st.pause.until, seasonId: seasonOf(now) } : null;
  },
};

/**
 * Bloco `extras.engagement` na resposta do `finish-activity` de demonstração. Idempotente: repetir o finish
 * devolve o mesmo bloco (a resposta fica guardada na corrida).
 */
export function withEngagementExtras<T>(db: DemoDb, userId: string, response: T): T {
  const r = response as unknown as Row;
  const extras = (r.extras && typeof r.extras === 'object' ? r.extras : {}) as Row;
  if (extras.engagement) return response;
  const act = db.tables.activities.find((a) => a.id === r.activityId && a.user_id === userId);
  if (!act || !db.profile(userId)) return response;
  const st = stateOf(db, userId, String(act.id));
  if (st.processed.has(String(act.id))) return response;
  const block = processActivity(db, st, userId, act, true);
  // Contrato da E9 (onda 2): `response.xp` = XP da própria atividade (sem baús e missões, que vêm nas linhas).
  const own = new Set(['run_distance', 'run_complete', 'fog', 'ghost', 'hunt_chest', 'week_kept']);
  r.xp = (block.xp as { lines: { source: string; amount: number }[] }).lines.filter((l) => own.has(l.source)).reduce((sum, l) => sum + l.amount, 0);
  r.extras = { contract: 2, ...extras, engagement: block };
  act.xp = r.xp;
  return response;
}

/** Só para testes: o estado de engajamento de uma pessoa (sem criar). */
export function demoEngagementState(db: DemoDb, userId: string) {
  return STATES.get(db)?.get(userId) ?? null;
}
