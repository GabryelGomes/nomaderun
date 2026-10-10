/**
 * RN-001 v2 — Run Points per zone, with relative effort (Product Book 3.2).
 *
 * RP = valid meters × 0.1 × M_effort × M_streak × M_ghost × M_pack × M_defense, rounded,
 * capped at DAILY_ZONE_CAP per user, per zone, per day.
 */

/** Reference pace used when the runner has no history yet: 6:00 min/km. */
export const DEFAULT_BASE_PACE = 360;
export const EFFORT_MIN = 0.8;
export const EFFORT_MAX = 1.3;
export const STREAK_STEP = 0.05;
export const STREAK_MAX_DAYS = 10;
export const GHOST_BONUS = 1.5;
export const PACK_BONUS = 1.25;
export const DEFENSE_BONUS = 2;
export const DAILY_ZONE_CAP = 300;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Running at your own usual pace is worth 1.0; faster than usual is worth more, up to 1.3. */
export function effortMultiplier(basePaceSecPerKm: number, paceSecPerKm: number): number {
  if (!Number.isFinite(paceSecPerKm) || paceSecPerKm <= 0) return EFFORT_MIN;
  const base = basePaceSecPerKm > 0 ? basePaceSecPerKm : DEFAULT_BASE_PACE;
  return clamp(base / paceSecPerKm, EFFORT_MIN, EFFORT_MAX);
}

export function streakMultiplier(consecutiveDays: number): number {
  return 1 + STREAK_STEP * clamp(Math.floor(consecutiveDays), 0, STREAK_MAX_DAYS);
}

/** Median of the last 10 valid paces; DEFAULT_BASE_PACE when there is no history. */
export function basePace(recentPaces: number[]): number {
  const valid = recentPaces.filter((p) => Number.isFinite(p) && p > 0).slice(-10);
  if (valid.length === 0) return DEFAULT_BASE_PACE;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type ZoneScoreInput = {
  meters: number;
  paceSecPerKm: number;
  basePaceSecPerKm: number;
  streakDays: number;
  beatGhost?: boolean;
  inPack?: boolean;
  defending?: boolean;
  /** RP this user already earned in this zone today, for the daily cap. */
  earnedTodayInZone?: number;
};

export type ZoneScore = {
  rp: number;
  multipliers: { effort: number; streak: number; ghost: number; pack: number; defense: number };
  capped: boolean;
};

export function scoreZone(input: ZoneScoreInput): ZoneScore {
  const multipliers = {
    effort: effortMultiplier(input.basePaceSecPerKm, input.paceSecPerKm),
    streak: streakMultiplier(input.streakDays),
    ghost: input.beatGhost ? GHOST_BONUS : 1,
    pack: input.inPack ? PACK_BONUS : 1,
    defense: input.defending ? DEFENSE_BONUS : 1,
  };
  const raw =
    Math.max(0, input.meters) *
    0.1 *
    multipliers.effort *
    multipliers.streak *
    multipliers.ghost *
    multipliers.pack *
    multipliers.defense;
  const room = Math.max(0, DAILY_ZONE_CAP - (input.earnedTodayInZone ?? 0));
  const rounded = Math.round(raw);
  return { rp: Math.min(rounded, room), multipliers, capped: rounded > room };
}
