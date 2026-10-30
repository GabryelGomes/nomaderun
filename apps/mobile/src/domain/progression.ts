/**
 * Progressão v2 (Fase 7, E7): curva de XP e fontes de XP (D-64), títulos e faixas de corredor (D-64),
 * sequência semanal com congelamento automático e pausa de saúde (D-63), baú do dia (D-66) e trilha da
 * temporada. Regras puras: sem relógio escondido (todo instante entra como parâmetro) e sem sorteio sem
 * semente (o servidor sorteia com HMAC; o app e os testes usam `engagementRng`).
 *
 * Não altera nada da v1: `xpForLevel`, `levelFromXp` e `closeWeek` de `games.ts` continuam valendo para o
 * servidor atual. Os nomes daqui são diferentes de propósito, porque a ponte das functions faz `export *`.
 */
import type { ActivityValidation } from './anti-cheat';
import { CHEST_XP, MAX_LEVEL, STREAK_RUNS_PER_WEEK, type ChestRarity } from './games';

/* ---------- Calendário de Brasília (UTC−3 fixo; o Brasil não tem horário de verão desde 2019) ---------- */

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export type BrtClock = {
  /** 'AAAA-MM-DD' no horário de Brasília. */
  dayId: string;
  /** Semana ISO ('2026-W43'), de segunda a domingo. */
  weekId: string;
  /** 0 = segunda … 6 = domingo. */
  weekday: number;
  hour: number;
  minute: number;
  /** Dia do mês (1..31). */
  day: number;
};

const pad = (n: number) => String(n).padStart(2, '0');

function dayNumber(dayId: string): number {
  const [y, m, d] = dayId.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function dayIdFromNumber(n: number): string {
  const t = new Date(n * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function isoWeekId(dayId: string): string {
  const n = dayNumber(dayId);
  const weekday = (new Date(n * DAY_MS).getUTCDay() + 6) % 7;
  const thursday = n - weekday + 3;
  const year = new Date(thursday * DAY_MS).getUTCFullYear();
  const week = Math.floor((thursday - Math.round(Date.UTC(year, 0, 1) / DAY_MS)) / 7) + 1;
  return `${year}-W${pad(week)}`;
}

/** Utilitários de calendário em Brasília, agrupados para não colidir com nomes de outros arquivos do domain. */
export const brtCalendar = {
  clock(atMs: number): BrtClock {
    const b = new Date(atMs - BRT_OFFSET_MS);
    const dayId = `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`;
    return {
      dayId,
      weekId: isoWeekId(dayId),
      weekday: (b.getUTCDay() + 6) % 7,
      hour: b.getUTCHours(),
      minute: b.getUTCMinutes(),
      day: b.getUTCDate(),
    };
  },
  /** Instante (ms) de `hour:minute` no dia `dayId`, em Brasília. */
  at(dayId: string, hour = 0, minute = 0): number {
    return dayNumber(dayId) * DAY_MS + BRT_OFFSET_MS + (hour * 60 + minute) * 60_000;
  },
  addDays(dayId: string, days: number): string {
    return dayIdFromNumber(dayNumber(dayId) + days);
  },
  /** Dias de `from` até `to` (negativo se `to` vem antes). */
  daysBetween(from: string, to: string): number {
    return dayNumber(to) - dayNumber(from);
  },
  /** Segunda-feira da semana de `dayId`. */
  weekMonday(dayId: string): string {
    const n = dayNumber(dayId);
    return dayIdFromNumber(n - ((new Date(n * DAY_MS).getUTCDay() + 6) % 7));
  },
  weekIdOf(dayId: string): string {
    return isoWeekId(dayId);
  },
};

/* ---------- Sorteio com semente (mesmo gerador dos testes de propriedade: cyrb53 + mulberry32) ---------- */

function hashSeed(seed: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

/**
 * Gerador determinístico em [0, 1) a partir de um texto (`userId|dia|n`). No servidor, a semente do baú
 * do dia vem de um HMAC com segredo (o cliente não consegue prever); o app usa este gerador só na
 * demonstração e nos testes.
 */
export function engagementRng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Curva de XP v2 (D-64) ---------- */

/** XP para ir do nível n ao n+1: arred10(50·n^1,3) + 50. Pede ≤ XP que a curva v1 (100·n^1,5) em todo nível. */
export function xpToNextLevel(level: number): number {
  return Math.round((50 * level ** 1.3) / 10) * 10 + 50;
}

/** XP total acumulado para chegar ao nível `level` (nível 1 = 0). */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < Math.min(level, MAX_LEVEL); n++) total += xpToNextLevel(n);
  return total;
}

export type LevelProgress = {
  level: number;
  /** XP já feito dentro do nível atual (no nível máximo, o excedente). */
  intoLevel: number;
  /** XP do nível atual até o próximo (0 no nível máximo). */
  needed: number;
  isMax: boolean;
  title: RunnerTitle;
};

export function levelProgress(totalXp: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0));
  while (level < MAX_LEVEL && remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level++;
  }
  const isMax = level >= MAX_LEVEL;
  return { level, intoLevel: remaining, needed: isMax ? 0 : xpToNextLevel(level), isMax, title: titleForLevel(level) };
}

/* ---------- Fontes de XP (D-64) ---------- */

/** Códigos do `xp_ledger` (contrato com a E9). O rótulo vai para o resumo e o histórico (transparência). */
export type XpSource =
  | 'run_distance'
  | 'run_complete'
  | 'fog'
  | 'ghost'
  | 'hunt_chest'
  | 'daily_chest'
  | 'mission'
  | 'week_kept'
  | 'ftue'
  | 'comeback'
  | 'season_step'
  | 'duplicate_cosmetic';

export const XP_SOURCE_LABELS: Record<XpSource, string> = {
  run_distance: 'Distância',
  run_complete: 'Atividade concluída',
  fog: 'Atlas',
  ghost: 'Fantasma vencido',
  hunt_chest: 'Baús da Caça',
  daily_chest: 'Baú do dia',
  mission: 'Missão',
  week_kept: 'Semana garantida',
  ftue: 'Primeiros passos',
  comeback: 'Missão de volta',
  season_step: 'Trilha da temporada',
  duplicate_cosmetic: 'Cosmético repetido',
};

export type XpLine = { source: XpSource; amount: number; label: string };

export const XP_RULES_V2 = {
  /** 10 XP por km nos primeiros 5 km do dia. */
  fullXpPerKm: 10,
  fullKmPerDay: 5,
  /** 5 XP por km de 5 a 15 km no dia; 0 depois (teto saudável). */
  halfXpPerKm: 5,
  halfKmUntil: 15,
  /** +30 por atividade concluída (≥ 1 km ou ≥ 15 min), 1 vez por dia. */
  completeXp: 30,
  completeMinMeters: 1000,
  completeMinSeconds: 900,
  /** Atlas (antiga Neblina): 2 XP por trecho novo, no máximo 60 por dia. */
  atlasXpPerCell: 2,
  atlasXpCapPerDay: 60,
  /** Fantasma vencido: +50, 1 vez por dia (dividir a corrida não rende). */
  ghostXp: 50,
  /** 2ª atividade da semana: +50 na hora. */
  weekKeptXp: 50,
} as const;

/** Teto diário do XP que vem da própria atividade (distância + concluída + Atlas + fantasma). */
export const DAILY_RUN_XP_CAP =
  XP_RULES_V2.fullXpPerKm * XP_RULES_V2.fullKmPerDay +
  XP_RULES_V2.halfXpPerKm * (XP_RULES_V2.halfKmUntil - XP_RULES_V2.fullKmPerDay) +
  XP_RULES_V2.completeXp +
  XP_RULES_V2.atlasXpCapPerDay +
  XP_RULES_V2.ghostXp;

/** XP de distância de um dia inteiro com `metersToday` válidos (a soma de corridas divididas dá o mesmo). */
export function dailyDistanceXp(metersToday: number): number {
  const m = Math.max(0, metersToday);
  const full = Math.min(m, XP_RULES_V2.fullKmPerDay * 1000);
  const half = Math.min(Math.max(0, m - XP_RULES_V2.fullKmPerDay * 1000), (XP_RULES_V2.halfKmUntil - XP_RULES_V2.fullKmPerDay) * 1000);
  return Math.floor((full * XP_RULES_V2.fullXpPerKm + half * XP_RULES_V2.halfXpPerKm) / 1000 + 1e-9);
}

/** O que a pessoa já ganhou hoje (dia de Brasília) antes desta atividade; vem do `xp_ledger`. */
export type XpDayTotals = {
  meters: number;
  atlasXp: number;
  completed: boolean;
  ghost: boolean;
};

export const EMPTY_XP_DAY: XpDayTotals = { meters: 0, atlasXp: 0, completed: false, ghost: false };

export type RunXpInput = {
  status: ActivityValidation['status'];
  /** Metros válidos desta atividade. */
  meters: number;
  movingSeconds: number;
  /** Trechos novos do Atlas revelados nesta atividade. */
  newAtlasCells: number;
  beatGhost: boolean | null;
  /** Raridades dos baús da Caça abertos nesta atividade. */
  huntChests?: readonly ChestRarity[];
  today?: XpDayTotals;
};

export type RunXpResult = { total: number; lines: XpLine[]; todayAfter: XpDayTotals };

const line = (source: XpSource, amount: number): XpLine => ({ source, amount, label: XP_SOURCE_LABELS[source] });

/**
 * XP da atividade em linhas (a soma vai para `response.xp`, compatível com os clientes antigos).
 * Atividade rejeitada ou em revisão não dá XP agora (os créditos esperam a revisão; C9).
 */
export function runXp(input: RunXpInput): RunXpResult {
  const today = input.today ?? EMPTY_XP_DAY;
  if (input.status === 'rejected' || input.status === 'under_review') {
    return { total: 0, lines: [], todayAfter: today };
  }
  const meters = Math.max(0, input.meters);
  const seconds = Math.max(0, input.movingSeconds);
  const lines: XpLine[] = [];

  const distance = dailyDistanceXp(today.meters + meters) - dailyDistanceXp(today.meters);
  if (distance > 0) lines.push(line('run_distance', distance));

  const finished = meters >= XP_RULES_V2.completeMinMeters || seconds >= XP_RULES_V2.completeMinSeconds;
  const complete = finished && !today.completed;
  if (complete) lines.push(line('run_complete', XP_RULES_V2.completeXp));

  const atlas = Math.min(
    Math.max(0, Math.floor(input.newAtlasCells)) * XP_RULES_V2.atlasXpPerCell,
    Math.max(0, XP_RULES_V2.atlasXpCapPerDay - today.atlasXp),
  );
  if (atlas > 0) lines.push(line('fog', atlas));

  const ghost = input.beatGhost === true && !today.ghost;
  if (ghost) lines.push(line('ghost', XP_RULES_V2.ghostXp));

  const hunt = (input.huntChests ?? []).reduce((sum, r) => sum + CHEST_XP[r], 0);
  if (hunt > 0) lines.push(line('hunt_chest', hunt));

  return {
    total: lines.reduce((s, l) => s + l.amount, 0),
    lines,
    todayAfter: {
      meters: today.meters + meters,
      atlasXp: today.atlasXp + atlas,
      completed: today.completed || complete,
      ghost: today.ghost || ghost,
    },
  };
}

/* ---------- Títulos (8, por faixa de nível) ---------- */

export type RunnerTitle = { id: string; name: string; minLevel: number; unlocks: string | null };

export const RUNNER_TITLES: readonly RunnerTitle[] = [
  { id: 'recruta-do-asfalto', name: 'Recruta do Asfalto', minLevel: 1, unlocks: null },
  { id: 'pe-na-rua', name: 'Pé na Rua', minLevel: 5, unlocks: 'rastro-faisca' },
  { id: 'desbravador-de-bairro', name: 'Desbravador de Bairro', minLevel: 10, unlocks: 'moldura-bairro' },
  { id: 'guardiao-de-esquina', name: 'Guardião de Esquina', minLevel: 15, unlocks: 'efeito-pulso' },
  { id: 'estrategista-urbano', name: 'Estrategista Urbano', minLevel: 20, unlocks: 'rastro-cometa' },
  { id: 'lenda-do-bairro', name: 'Lenda do Bairro', minLevel: 30, unlocks: 'moldura-holofote' },
  { id: 'mestre-da-cidade', name: 'Mestre da Cidade', minLevel: 40, unlocks: 'efeito-onda' },
  { id: 'nomade', name: 'Nômade', minLevel: 50, unlocks: 'moldura-nomade' },
];

export function titleForLevel(level: number): RunnerTitle {
  let found = RUNNER_TITLES[0];
  for (const t of RUNNER_TITLES) if (level >= t.minLevel) found = t;
  return found;
}

/** Títulos já conquistados (a pessoa pode exibir qualquer um deles). */
export function unlockedTitles(level: number): RunnerTitle[] {
  return RUNNER_TITLES.filter((t) => level >= t.minLevel);
}

/* ---------- Faixas de corredor por material (distância total; nunca por cor) ---------- */

export type RunnerBand = { id: string; name: string; minKm: number };

export const RUNNER_BANDS: readonly RunnerBand[] = [
  { id: 'asfalto', name: 'Asfalto', minKm: 0 },
  { id: 'bronze', name: 'Bronze', minKm: 10 },
  { id: 'prata', name: 'Prata', minKm: 50 },
  { id: 'ouro', name: 'Ouro', minKm: 150 },
  { id: 'neon', name: 'Neon', minKm: 400 },
  { id: 'holografico', name: 'Holográfico', minKm: 1000 },
  { id: 'lenda', name: 'Lenda', minKm: 2500 },
  { id: 'nomade', name: 'Nômade', minKm: 5000 },
];

export function runnerBand(lifetimeMeters: number): { band: RunnerBand; next: RunnerBand | null; metersToNext: number } {
  const m = Math.max(0, lifetimeMeters);
  let i = 0;
  while (i + 1 < RUNNER_BANDS.length && m >= RUNNER_BANDS[i + 1].minKm * 1000) i++;
  const next = RUNNER_BANDS[i + 1] ?? null;
  return { band: RUNNER_BANDS[i], next, metersToNext: next ? Math.ceil(next.minKm * 1000 - m) : 0 };
}

/* ---------- Sequência semanal v2 (D-63) ---------- */

export const STREAK_V2 = {
  activitiesPerWeek: STREAK_RUNS_PER_WEEK,
  freezesPerMonth: 1,
  /** Congelamentos guardados no máximo (o extra vem do degrau 8 da trilha). */
  maxFreezes: 2,
  pauseMinWeeks: 1,
  pauseMaxWeeks: 4,
} as const;

export type HealthPause = { from: string; until: string };

export type StreakV2State = {
  weeks: number;
  /** Melhor sequência: nunca diminui. */
  best: number;
  freezesLeft: number;
  pause: HealthPause | null;
  /** Temporada ('2026-10') em que a pausa foi usada (1 por temporada). */
  pauseUsedSeason: string | null;
};

export type StreakWeekOutcome = 'kept' | 'paused' | 'frozen' | 'reset';

export const NEW_STREAK_V2: StreakV2State = { weeks: 0, best: 0, freezesLeft: 1, pause: null, pauseUsedSeason: null };

function weekOverlapsPause(weekMonday: string, pause: HealthPause | null): boolean {
  if (!pause) return false;
  const sunday = brtCalendar.addDays(weekMonday, 6);
  return weekMonday <= pause.until && sunday >= pause.from;
}

/**
 * Fecha a semana (segunda 00:10 BRT no job). Ordem: 2 atividades mantêm (mesmo na pausa) → semana na pausa
 * fica como está → congelamento automático (só se há sequência a proteger) → recomeça do zero.
 * A melhor sequência nunca diminui.
 */
export function closeStreakWeek(
  state: StreakV2State,
  week: { monday: string; activities: number },
): { state: StreakV2State; outcome: StreakWeekOutcome; usedFreeze: boolean } {
  if (week.activities >= STREAK_V2.activitiesPerWeek) {
    const weeks = state.weeks + 1;
    return { state: { ...state, weeks, best: Math.max(state.best, weeks) }, outcome: 'kept', usedFreeze: false };
  }
  if (weekOverlapsPause(week.monday, state.pause)) return { state, outcome: 'paused', usedFreeze: false };
  if (state.weeks > 0 && state.freezesLeft > 0) {
    return { state: { ...state, freezesLeft: state.freezesLeft - 1 }, outcome: 'frozen', usedFreeze: true };
  }
  return { state: { ...state, weeks: 0 }, outcome: 'reset', usedFreeze: false };
}

/** Virada do mês: volta a ter pelo menos 1 congelamento (o extra guardado continua, até 2). */
export function refillStreakFreezes(freezesLeft: number): number {
  return Math.min(STREAK_V2.maxFreezes, Math.max(freezesLeft, STREAK_V2.freezesPerMonth));
}

/** Degrau 8 da trilha: +1 congelamento, respeitando o máximo de 2. */
export function grantExtraFreeze(freezesLeft: number): number {
  return Math.min(STREAK_V2.maxFreezes, freezesLeft + 1);
}

export function isHealthPaused(state: StreakV2State, today: string): boolean {
  return !!state.pause && state.pause.from <= today && today <= state.pause.until;
}

export type HealthPauseRefusal = 'weeks' | 'used' | 'active';

/** Pausa de saúde (lesão, viagem, descanso): 1 a 4 semanas, 1 vez por temporada; começa na semana atual. */
export function startHealthPause(
  state: StreakV2State,
  req: { weeks: number; today: string; seasonId: string },
): { ok: true; state: StreakV2State } | { ok: false; reason: HealthPauseRefusal } {
  if (!Number.isInteger(req.weeks) || req.weeks < STREAK_V2.pauseMinWeeks || req.weeks > STREAK_V2.pauseMaxWeeks) {
    return { ok: false, reason: 'weeks' };
  }
  if (isHealthPaused(state, req.today)) return { ok: false, reason: 'active' };
  if (state.pauseUsedSeason === req.seasonId) return { ok: false, reason: 'used' };
  const from = brtCalendar.weekMonday(req.today);
  const until = brtCalendar.addDays(from, 7 * req.weeks - 1);
  return { ok: true, state: { ...state, pause: { from, until }, pauseUsedSeason: req.seasonId } };
}

/** Encerra a pausa antes: a semana atual continua protegida (domingo), as seguintes voltam a contar. */
export function endHealthPause(state: StreakV2State, today: string): StreakV2State {
  if (!state.pause || !isHealthPaused(state, today)) return state;
  const sunday = brtCalendar.addDays(brtCalendar.weekMonday(today), 6);
  return { ...state, pause: { ...state.pause, until: sunday < state.pause.until ? sunday : state.pause.until } };
}

/** +50 XP na atividade que completa as 2 da semana (só uma vez por semana). */
export function weekKeptXp(activitiesBefore: number, activitiesAfter: number): number {
  return activitiesBefore < STREAK_V2.activitiesPerWeek && activitiesAfter >= STREAK_V2.activitiesPerWeek
    ? XP_RULES_V2.weekKeptXp
    : 0;
}

/* ---------- Baú do dia (D-66) ---------- */

export const DAILY_CHEST = {
  maxStored: 3,
  /** Abre com qualquer atividade pontuada de pelo menos 1 km. */
  minMeters: 1000,
  /** O 20º baú sem lendário vira lendário. */
  pity: 20,
  /** Índice de confiança abaixo disso: os baús ficam guardados até a revisão. */
  minTrust: 40,
  odds: { comum: 0.7, raro: 0.25, lendario: 0.05 } as Readonly<Record<ChestRarity, number>>,
  xp: { comum: 15, raro: 40, lendario: 100 } as Readonly<Record<ChestRarity, number>>,
  cosmeticChance: { comum: 0, raro: 0.05, lendario: 0.3 } as Readonly<Record<ChestRarity, number>>,
  /** Cosmético repetido vira XP (não existe "fragmento"). */
  duplicateCosmeticXp: 20,
} as const;

const RARITIES: readonly ChestRarity[] = ['comum', 'raro', 'lendario'];

/**
 * Baús guardados hoje: 1 crédito por dia, até 3. Conta nova começa com 1 (progresso dotado) e não acumula
 * além dele antes da primeira atividade.
 */
export function dailyChestsStored(input: {
  today: string;
  createdDay: string;
  lastOpenDay: string | null;
  hasActivity: boolean;
}): number {
  if (input.lastOpenDay) {
    return Math.max(0, Math.min(DAILY_CHEST.maxStored, brtCalendar.daysBetween(input.lastOpenDay, input.today)));
  }
  if (!input.hasActivity) return 1;
  return Math.max(1, Math.min(DAILY_CHEST.maxStored, brtCalendar.daysBetween(input.createdDay, input.today) + 1));
}

export type DailyChestRefusal = 'status' | 'distance' | 'review' | 'already';

/** A atividade abre os baús guardados? (1 abertura por dia; a contagem é do servidor, por dia BRT.) */
export function canOpenDailyChests(input: {
  status: ActivityValidation['status'];
  meters: number;
  trust: number;
  openedToday: boolean;
}): { ok: true } | { ok: false; reason: DailyChestRefusal } {
  if (input.openedToday) return { ok: false, reason: 'already' };
  if (input.status !== 'valid' && input.status !== 'partially_valid') return { ok: false, reason: 'status' };
  if (input.meters < DAILY_CHEST.minMeters) return { ok: false, reason: 'distance' };
  if (input.trust < DAILY_CHEST.minTrust) return { ok: false, reason: 'review' };
  return { ok: true };
}

export type DailyChestRoll = { rarity: number; cosmetic: number };

export type DailyChestPrize = {
  rarity: ChestRarity;
  xp: number;
  /** Ganhou um cosmético (qual, decide `resolveCosmeticDrop` com o catálogo). */
  cosmeticDrop: boolean;
  /** Veio da garantia do 20º baú. */
  guaranteed: boolean;
};

/**
 * Abre um baú. `roll.rarity` e `roll.cosmetic` em [0, 1) (HMAC no servidor). `pity` = baús abertos desde o
 * último lendário; devolve o valor seguinte.
 */
export function rollDailyChest(roll: DailyChestRoll, pity: number): { prize: DailyChestPrize; pityAfter: number } {
  const guaranteed = pity + 1 >= DAILY_CHEST.pity;
  let rarity: ChestRarity = 'comum';
  if (guaranteed) rarity = 'lendario';
  else if (roll.rarity >= DAILY_CHEST.odds.comum + DAILY_CHEST.odds.raro) rarity = 'lendario';
  else if (roll.rarity >= DAILY_CHEST.odds.comum) rarity = 'raro';
  const cosmeticDrop = roll.cosmetic < DAILY_CHEST.cosmeticChance[rarity];
  return {
    prize: { rarity, xp: DAILY_CHEST.xp[rarity], cosmeticDrop, guaranteed: guaranteed && roll.rarity < 0.95 },
    pityAfter: rarity === 'lendario' ? 0 : pity + 1,
  };
}

/** Abre os baús guardados em sequência (a garantia passa de um para o outro). */
export function openDailyChests(rolls: readonly DailyChestRoll[], pity: number): { prizes: DailyChestPrize[]; pityAfter: number } {
  const prizes: DailyChestPrize[] = [];
  let p = Math.max(0, pity);
  for (const r of rolls.slice(0, DAILY_CHEST.maxStored)) {
    const out = rollDailyChest(r, p);
    prizes.push(out.prize);
    p = out.pityAfter;
  }
  return { prizes, pityAfter: p };
}

/** Sorteios reproduzíveis para a demonstração e os testes (o servidor usa HMAC com segredo). */
export function dailyChestRolls(seed: string, count: number): DailyChestRoll[] {
  const next = engagementRng(seed);
  return Array.from({ length: Math.max(0, Math.min(DAILY_CHEST.maxStored, count)) }, () => ({ rarity: next(), cosmetic: next() }));
}

/** Escolhe o cosmético entre os candidatos; se a pessoa já tem (ou não há catálogo), vira +20 XP. */
export function resolveCosmeticDrop(
  roll: number,
  candidates: readonly string[],
  owned: ReadonlySet<string>,
): { cosmeticId: string | null; extraXp: number } {
  if (candidates.length === 0) return { cosmeticId: null, extraXp: DAILY_CHEST.duplicateCosmeticXp };
  const pick = candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, roll) * candidates.length))];
  return owned.has(pick) ? { cosmeticId: null, extraXp: DAILY_CHEST.duplicateCosmeticXp } : { cosmeticId: pick, extraXp: 0 };
}

/** Chances públicas (o "?" da tela) e o contador "faltam N para o lendário garantido". */
export function dailyChestOdds(pity: number): {
  rows: { rarity: ChestRarity; chance: number; xp: number; cosmeticChance: number }[];
  pityLeft: number;
} {
  return {
    rows: RARITIES.map((rarity) => ({
      rarity,
      chance: DAILY_CHEST.odds[rarity],
      xp: DAILY_CHEST.xp[rarity],
      cosmeticChance: DAILY_CHEST.cosmeticChance[rarity],
    })),
    pityLeft: Math.max(1, DAILY_CHEST.pity - Math.max(0, pity)),
  };
}

/* ---------- Trilha da temporada (mês): 24 degraus de 120 XP, medalhas 8/16/24 ---------- */

export const SEASON_TRACK = { stepXp: 120, steps: 24, prestigeXp: 240, bronze: 8, prata: 16, ouro: 24 } as const;

export type SeasonMedal = 'bronze' | 'prata' | 'ouro';

export function seasonTrackStep(seasonXp: number): {
  step: number;
  intoStep: number;
  medal: SeasonMedal | null;
  prestigeStars: number;
} {
  const xp = Math.max(0, Math.floor(seasonXp));
  const step = Math.min(SEASON_TRACK.steps, Math.floor(xp / SEASON_TRACK.stepXp));
  const medal: SeasonMedal | null =
    step >= SEASON_TRACK.ouro ? 'ouro' : step >= SEASON_TRACK.prata ? 'prata' : step >= SEASON_TRACK.bronze ? 'bronze' : null;
  const over = xp - SEASON_TRACK.steps * SEASON_TRACK.stepXp;
  return {
    step,
    intoStep: step < SEASON_TRACK.steps ? xp - step * SEASON_TRACK.stepXp : 0,
    medal,
    prestigeStars: over > 0 ? Math.floor(over / SEASON_TRACK.prestigeXp) : 0,
  };
}
