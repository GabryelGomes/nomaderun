import { cellCenter, cellsAround, fogCellOf } from './grid';
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

/** Top 5 move up, bottom 5 move down; the top and bottom divisions cannot move further. */
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

/** XP needed to go from level n to n+1: 100 × n^1.5, rounded. */
export const xpForLevel = (level: number) => Math.round(100 * level ** 1.5);

export function levelFromXp(totalXp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, intoLevel: remaining, needed: xpForLevel(level) };
}
