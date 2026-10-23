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

/**
 * @deprecated v1: o servidor passa semanas e a sequência vira +50% permanente (E-10). Na v2 a sequência não
 * multiplica pontos (D-63); `scoreZoneV2` não usa este multiplicador.
 */
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

/**
 * @deprecated v1, usada pela gravação atual do servidor (sequência e fantasma multiplicam os pontos).
 * Use `scoreZoneV2` (D-63, E-15).
 */
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

/* ---------- v2: pontos sem sequência e sem fantasma (D-63, E-15) ---------- */

export type ZoneScoreInputV2 = {
  meters: number;
  paceSecPerKm: number;
  basePaceSecPerKm: number;
  inPack?: boolean;
  /** Janela de defesa da regra v1 (só enquanto o mapa ainda for por influência). */
  defending?: boolean;
  /** Pontos que a pessoa já fez nesta zona hoje, para o teto diário. */
  earnedTodayInZone?: number;
};

export type ZoneScoreV2 = {
  rp: number;
  multipliers: { effort: number; pack: number; defense: number };
  capped: boolean;
};

/**
 * Pontos de uma zona na v2 (ranking, Liga e Cidade × Cidade): metros × 0,1 × esforço × grupo × defesa,
 * arredondado, com o teto de 300 por pessoa, zona e dia. A sequência não multiplica (D-63) e o fantasma vira
 * XP, não pontos (E-15). Nunca negativo.
 */
export function scoreZoneV2(input: ZoneScoreInputV2): ZoneScoreV2 {
  const multipliers = {
    effort: effortMultiplier(input.basePaceSecPerKm, input.paceSecPerKm),
    pack: input.inPack ? PACK_BONUS : 1,
    defense: input.defending ? DEFENSE_BONUS : 1,
  };
  const meters = Number.isFinite(input.meters) ? Math.max(0, input.meters) : 0;
  const raw = meters * 0.1 * multipliers.effort * multipliers.pack * multipliers.defense;
  const earned = input.earnedTodayInZone;
  const room = Math.max(0, DAILY_ZONE_CAP - (earned !== undefined && Number.isFinite(earned) ? earned : 0));
  const rounded = Math.round(raw);
  return { rp: Math.min(rounded, room), multipliers, capped: rounded > room };
}

/** Pontos de uma corrida inteira na v2: soma de `scoreZoneV2` por zona (para a Liga, D-68). */
export function scoreRunV2(input: {
  zoneMeters: Readonly<Record<string, number>>;
  paceSecPerKm: number;
  basePaceSecPerKm: number;
  packZones?: ReadonlySet<string>;
  earnedTodayByZone?: Readonly<Record<string, number>>;
  blockedZones?: ReadonlySet<string>;
}): { total: number; zones: { zoneId: string; rp: number; capped: boolean }[] } {
  const zones: { zoneId: string; rp: number; capped: boolean }[] = [];
  let total = 0;
  for (const [zoneId, meters] of Object.entries(input.zoneMeters)) {
    if (input.blockedZones?.has(zoneId)) continue;
    const s = scoreZoneV2({
      meters,
      paceSecPerKm: input.paceSecPerKm,
      basePaceSecPerKm: input.basePaceSecPerKm,
      inPack: input.packZones?.has(zoneId) ?? false,
      earnedTodayInZone: input.earnedTodayByZone?.[zoneId] ?? 0,
    });
    zones.push({ zoneId, rp: s.rp, capped: s.capped });
    total += s.rp;
  }
  zones.sort((a, b) => b.rp - a.rp);
  return { total, zones };
}
