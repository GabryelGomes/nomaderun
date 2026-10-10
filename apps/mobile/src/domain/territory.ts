import { FACTION_IDS, type FactionId } from './types';

/**
 * RN-002 v2 — a neutral zone is captured at 30 RP (~300 m run inside it), so a first run already
 * wins something (early-win principle); taking an owned zone still needs 110% of the owner.
 * An owner whose influence decays below this threshold loses the zone (RN-005).
 */
export const CAPTURE_THRESHOLD = 30;
export const TAKEOVER_RATIO = 1.1;
/** RN-003 */
export const ATTACK_RATIO = 0.5;
export const ATTACK_CLEAR_RATIO = 0.4;
export const DEFENSE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** RN-004 */
export const SHIELD_MAX = 3;
export const SHIELD_REDUCTION = [0, 0.1, 0.2, 0.3] as const;
export const FORTIFY_METERS = 500;
/** RN-005 */
export const DECAY_FACTOR = 0.9;
export const DECAY_FLOOR = 5;
/** RN-006 */
export const SEASON_RESET_FACTOR = 0.3;

export type Influence = Record<FactionId, number>;

export type Zone = {
  id: string;
  influence: Influence;
  owner: FactionId | null;
  shield: number;
  /** Epoch ms when the current attack started, or null when not under attack. */
  attackStartedAt: number | null;
  attacker: FactionId | null;
  blocked: boolean;
};

export type ZoneEvent =
  | { type: 'captured'; zoneId: string; faction: FactionId; from: FactionId | null }
  | { type: 'under_attack'; zoneId: string; owner: FactionId; attacker: FactionId }
  | { type: 'defended'; zoneId: string; owner: FactionId }
  | { type: 'neutralized'; zoneId: string; from: FactionId };

export const emptyInfluence = (): Influence => ({ striders: 0, coyotes: 0, owls: 0, volt: 0 });

export function newZone(id: string, blocked = false): Zone {
  return { id, influence: emptyInfluence(), owner: null, shield: 0, attackStartedAt: null, attacker: null, blocked };
}

/** Strongest faction other than `except`, with its influence. */
function strongestRival(influence: Influence, except: FactionId | null) {
  let best: FactionId | null = null;
  let value = 0;
  for (const f of FACTION_IDS) {
    if (f === except) continue;
    if (influence[f] > value) {
      best = f;
      value = influence[f];
    }
  }
  return { faction: best, value };
}

export const isUnderAttack = (z: Zone) => z.attackStartedAt !== null;

/** RN-004: rival RP is reduced by the zone's shield level. */
export function effectiveRp(zone: Zone, faction: FactionId, rp: number): number {
  if (zone.owner && zone.owner !== faction) {
    return rp * (1 - SHIELD_REDUCTION[Math.min(zone.shield, SHIELD_MAX)]);
  }
  return rp;
}

/** Re-evaluates ownership and attack state after influence changed (RN-002, RN-003). */
export function resolveZone(zone: Zone, now: number): { zone: Zone; events: ZoneEvent[] } {
  const events: ZoneEvent[] = [];
  const z: Zone = { ...zone, influence: { ...zone.influence } };
  if (z.blocked) return { zone: { ...z, owner: null, attackStartedAt: null, attacker: null }, events };

  if (z.owner === null) {
    const top = strongestRival(z.influence, null);
    if (top.faction && top.value >= CAPTURE_THRESHOLD) {
      z.owner = top.faction;
      z.shield = 0;
      events.push({ type: 'captured', zoneId: z.id, faction: top.faction, from: null });
    }
    return { zone: z, events };
  }

  const ownerValue = z.influence[z.owner];
  const rival = strongestRival(z.influence, z.owner);

  if (rival.faction && rival.value >= ownerValue * TAKEOVER_RATIO && rival.value >= CAPTURE_THRESHOLD) {
    const from = z.owner;
    z.owner = rival.faction;
    z.shield = 0;
    z.attackStartedAt = null;
    z.attacker = null;
    events.push({ type: 'captured', zoneId: z.id, faction: rival.faction, from });
    return { zone: z, events };
  }

  const ratio = ownerValue > 0 ? rival.value / ownerValue : rival.value > 0 ? Infinity : 0;
  if (z.attackStartedAt === null && rival.faction && ratio >= ATTACK_RATIO) {
    z.attackStartedAt = now;
    z.attacker = rival.faction;
    events.push({ type: 'under_attack', zoneId: z.id, owner: z.owner, attacker: rival.faction });
  } else if (z.attackStartedAt !== null && ratio < ATTACK_CLEAR_RATIO) {
    z.attackStartedAt = null;
    z.attacker = null;
    events.push({ type: 'defended', zoneId: z.id, owner: z.owner });
  }
  return { zone: z, events };
}

/** Adds a faction's RP to a zone, applying the shield, then resolves ownership. */
export function applyRunPoints(zone: Zone, faction: FactionId, rp: number, now: number) {
  if (zone.blocked || rp <= 0) return { zone, events: [] as ZoneEvent[] };
  const added = effectiveRp(zone, faction, rp);
  const next: Zone = { ...zone, influence: { ...zone.influence, [faction]: zone.influence[faction] + added } };
  return resolveZone(next, now);
}

/** True while the defense window (RN-003) is open, so the owner's RP is doubled. */
export const defenseWindowOpen = (zone: Zone, now: number) =>
  zone.attackStartedAt !== null && now - zone.attackStartedAt <= DEFENSE_WINDOW_MS;

/** RN-005: daily decay at 03:00. Values below the floor drop to zero; a weak owner loses the zone. */
export function decayZone(zone: Zone): { zone: Zone; events: ZoneEvent[] } {
  const influence = { ...zone.influence };
  for (const f of FACTION_IDS) {
    const v = influence[f] * DECAY_FACTOR;
    influence[f] = v < DECAY_FLOOR ? 0 : v;
  }
  const z: Zone = { ...zone, influence };
  if (z.owner && influence[z.owner] < CAPTURE_THRESHOLD) {
    const from = z.owner;
    return {
      zone: { ...z, owner: null, shield: 0, attackStartedAt: null, attacker: null },
      events: [{ type: 'neutralized', zoneId: z.id, from }],
    };
  }
  return { zone: z, events: [] };
}

/** RN-004: end-of-day fortification. ≥ 500 m by the owner raises the shield; no run lowers it. */
export function fortifyZone(zone: Zone, ownerMetersToday: number): Zone {
  if (!zone.owner) return zone;
  const shield =
    ownerMetersToday >= FORTIFY_METERS
      ? Math.min(SHIELD_MAX, zone.shield + 1)
      : ownerMetersToday <= 0
        ? Math.max(0, zone.shield - 1)
        : zone.shield;
  return { ...zone, shield };
}

/** RN-006: season reset multiplies every faction's influence by 0.3. */
export function seasonReset(zone: Zone): Zone {
  const influence = { ...zone.influence };
  for (const f of FACTION_IDS) influence[f] *= SEASON_RESET_FACTOR;
  return { ...zone, influence };
}
