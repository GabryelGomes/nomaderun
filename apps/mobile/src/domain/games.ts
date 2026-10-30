import { cellCenter, cellsAround, districtOf, fogCellOf, fogCellsInDistrict } from './grid';
import { distanceMeters } from './geo';
import type { LatLng } from './types';

/* ---------- RN-013 — Guerra de Cidades ---------- */
export const CITY_MIN_ACTIVE_RUNNERS = 20;

/** Sum of valid RP divided by √(active runners), so small cities can compete with capitals. */
export function cityScore(rpSum: number, activeRunners: number): number | null {
  if (activeRunners < CITY_MIN_ACTIVE_RUNNERS) return null;
  return rpSum / Math.sqrt(activeRunners);
}

/* ---------- Neblina (fog of war, H3 res 10) ---------- */
export const FOG_REVEAL_RADIUS_M = 30;
export const FOG_XP_PER_CELL = 10;

/** Cells revealed by standing at `p`: its own cell plus neighbours whose center is ≤ 30 m away. */
export function cellsRevealedAt(p: LatLng): string[] {
  const own = fogCellOf(p);
  return cellsAround(own, 1).filter((c) => c === own || distanceMeters(p, cellCenter(c)) <= FOG_REVEAL_RADIUS_M);
}

/** Returns only the newly revealed cells for a path, given what was already revealed. */
export function revealFog(path: LatLng[], revealed: ReadonlySet<string>): string[] {
  const fresh = new Set<string>();
  for (const p of path) {
    for (const c of cellsRevealedAt(p)) {
      if (!revealed.has(c)) fresh.add(c);
    }
  }
  return [...fresh];
}

/* ---------- Atlas por bairro (Neblina v2, T7.1.4) ---------- */
export const ATLAS_MILESTONES = [25, 50, 75, 100] as const;
export type AtlasMilestone = 0 | (typeof ATLAS_MILESTONES)[number];

export type DistrictExploration = {
  /** Distrito H3 res 7 (~5 km², o "bairro"). */
  district: string;
  revealed: number;
  total: number;
  /** % explorado, arredondado para baixo (100 só com o bairro inteiro). */
  pct: number;
  /** Maior marco alcançado (medalha a cada 25%). */
  milestone: AtlasMilestone;
};

function explorationOf(district: string, revealed: number): DistrictExploration {
  const total = fogCellsInDistrict(district);
  const pct = total > 0 ? Math.min(100, Math.floor((revealed / total) * 100)) : 0;
  let milestone: AtlasMilestone = 0;
  for (const m of ATLAS_MILESTONES) if (pct >= m) milestone = m;
  return { district, revealed, total, pct, milestone };
}

/** % do bairro explorado a partir das células reveladas (res 10). Células de outros bairros são ignoradas. */
export function districtExploration(revealed: Iterable<string>, district: string): DistrictExploration {
  const own = new Set<string>();
  for (const c of revealed) if (districtOf(c) === district) own.add(c);
  return explorationOf(district, own.size);
}

/** Todos os bairros tocados, do mais explorado para o menos (empate pelo id). */
export function districtsExploration(revealed: Iterable<string>): DistrictExploration[] {
  const byDistrict = new Map<string, Set<string>>();
  for (const c of revealed) {
    const d = districtOf(c);
    const set = byDistrict.get(d) ?? new Set<string>();
    set.add(c);
    byDistrict.set(d, set);
  }
  return [...byDistrict]
    .map(([d, set]) => explorationOf(d, set.size))
    .sort((a, b) => b.pct - a.pct || (a.district < b.district ? -1 : 1));
}

/** Marcos (25/50/75/100%) cruzados entre duas leituras: medalhas novas do Atlas. */
export const atlasMilestonesCrossed = (pctBefore: number, pctAfter: number): number[] =>
  ATLAS_MILESTONES.filter((m) => pctBefore < m && pctAfter >= m);

/* ---------- Fuga (ghost chase) ---------- */
export type GhostStatus = 'ahead' | 'tied' | 'caught';
export const GHOST_TIE_METERS = 5;

/** Meters the runner is ahead of a ghost running at a constant pace (negative = behind). */
export function ghostGap(runnerMeters: number, elapsedSeconds: number, ghostPaceSecPerKm: number): number {
  const ghostMeters = ghostPaceSecPerKm > 0 ? (elapsedSeconds / ghostPaceSecPerKm) * 1000 : 0;
  return runnerMeters - ghostMeters;
}

export function ghostStatus(gapMeters: number): GhostStatus {
  if (gapMeters > GHOST_TIE_METERS) return 'ahead';
  if (gapMeters >= -GHOST_TIE_METERS) return 'tied';
  return 'caught';
}

/* ---------- Fuga v2: fantasma pelo seu ritmo-base (E-15, E-16) ---------- */
export type GhostLevel = 'seu-ritmo' | 'desafio' | 'recorde';
export const GHOST_LEVELS: readonly GhostLevel[] = ['seu-ritmo', 'desafio', 'recorde'];
/** "Desafio" = ritmo-base 3% mais rápido. */
export const GHOST_CHALLENGE_FACTOR = 0.97;
/** Sem histórico, o fantasma "Seu ritmo" corre a 7:30/km (o iniciante consegue vencer). */
export const GHOST_NO_HISTORY_PACE = 450;
/** O servidor aceita fantasma a até ±20% do ritmo-base (ou o próprio recorde). */
export const GHOST_ALLOWED_DEVIATION = 0.2;
/** Vencer o fantasma vale XP, não pontos de território (E-15). */
export const GHOST_WIN_XP = 50;

const validPaces = (recent: readonly number[]) => recent.filter((p) => Number.isFinite(p) && p > 0).slice(-10);

/**
 * Ritmo do fantasma (s/km) pelo nível: "Seu ritmo" = mediana das 10 últimas corridas; "Desafio" = 3% mais
 * rápido; "Recorde" = o melhor ritmo das 10 últimas. Sem histórico, 7:30/km.
 */
export function ghostPaceV2(level: GhostLevel, recentPaces: readonly number[]): number {
  const valid = validPaces(recentPaces);
  if (valid.length === 0) return level === 'desafio' ? Math.round(GHOST_NO_HISTORY_PACE * GHOST_CHALLENGE_FACTOR) : GHOST_NO_HISTORY_PACE;
  const sorted = [...valid].sort((a, b) => a - b);
  if (level === 'recorde') return Math.round(sorted[0]);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(level === 'desafio' ? median * GHOST_CHALLENGE_FACTOR : median);
}

/** O servidor aceita o fantasma? Dentro de ±20% do "Seu ritmo", ou igual ao "Recorde" (±1 s). */
export function ghostPaceAllowedV2(ghostPace: number, recentPaces: readonly number[]): boolean {
  if (!Number.isFinite(ghostPace) || ghostPace <= 0) return false;
  const base = ghostPaceV2('seu-ritmo', recentPaces);
  if (Math.abs(ghostPace - base) <= base * GHOST_ALLOWED_DEVIATION) return true;
  return Math.abs(ghostPace - ghostPaceV2('recorde', recentPaces)) <= 1;
}

/* ---------- Caça (treasure chests) ---------- */
export const CHEST_OPEN_RADIUS_M = 25;
export type ChestRarity = 'comum' | 'raro' | 'lendario';
export const CHEST_XP: Record<ChestRarity, number> = { comum: 20, raro: 60, lendario: 150 };

export type Chest = { id: string; position: LatLng; rarity: ChestRarity };

/** Chests within 25 m of the runner that were not opened yet. */
export function chestsInReach(p: LatLng, chests: Chest[], opened: ReadonlySet<string>): Chest[] {
  return chests.filter((c) => !opened.has(c.id) && distanceMeters(p, c.position) <= CHEST_OPEN_RADIUS_M);
}

/* ---------- Liga do Bairro ---------- */
export const LEAGUE_GROUP_SIZE = 30;
export const LEAGUE_MOVES = 5;
export const LEAGUE_DIVISIONS = ['Calçada', 'Rua', 'Avenida', 'Rodovia', 'Maratona'] as const;

export type LeagueOutcome = 'promoted' | 'stays' | 'relegated';

/**
 * Top 5 move up, bottom 5 move down; the top and bottom divisions cannot move further.
 * @deprecated quebra com grupo pequeno (o mesmo corredor sobe e desce). Use `leagueStandingsV2` (league.ts, D-68).
 */
export function leagueOutcome(rank: number, groupSize: number, division: number): LeagueOutcome {
  if (rank <= LEAGUE_MOVES && division < LEAGUE_DIVISIONS.length - 1) return 'promoted';
  if (rank > groupSize - LEAGUE_MOVES && division > 0) return 'relegated';
  return 'stays';
}

/* ---------- Weekly streak (RN-014 proposal) ---------- */
export const STREAK_RUNS_PER_WEEK = 2;
export const FREEZES_PER_MONTH = 1;

export type StreakState = { weeks: number; freezesLeft: number };

/** Closes a week: 2+ valid runs extend the streak; otherwise a freeze is spent, or the streak resets. */
export function closeWeek(state: StreakState, validRunsThisWeek: number): StreakState & { usedFreeze: boolean } {
  if (validRunsThisWeek >= STREAK_RUNS_PER_WEEK) return { ...state, weeks: state.weeks + 1, usedFreeze: false };
  if (state.freezesLeft > 0) return { weeks: state.weeks, freezesLeft: state.freezesLeft - 1, usedFreeze: true };
  return { weeks: 0, freezesLeft: state.freezesLeft, usedFreeze: false };
}

/* ---------- Progression ---------- */
export const XP_PER_100M = 1;
export const MAX_LEVEL = 50;

/*
 * D-92: a curva de nível é UMA só, `levelProgress`/`xpToNextLevel` em `progression.ts` — a mesma que o servidor usa
 * (`private.level_progress` sobre `profiles.xp`, creditado pelo `xp_ledger`). A curva v1 (`xpForLevel` = 100·n^1,5 e
 * `levelFromXp`) saiu: o Você e o Resumo mostravam um nível e as Recompensas outro.
 */
