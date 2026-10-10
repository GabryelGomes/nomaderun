import type { CheatFlag } from './anti-cheat';

/** RN-009 */
export const TRUST_START = 100;
export const TRUST_REVIEW_BELOW = 40;
export const TRUST_SUSPEND_BELOW = 10;
export const TRUST_RECOVERY = 2;

export const TRUST_PENALTY: Partial<Record<CheatFlag, number>> = {
  MOCK_LOCATION: 30,
  TELEPORT: 10,
  POINT_SPEED: 10,
  VEHICLE_SUSPECTED: 10,
  NO_STEPS: 10,
};

/** Each flag type penalizes once per activity; a fully valid run recovers 2 points. */
export function applyTrust(score: number, flags: CheatFlag[], fullyValid: boolean): number {
  const penalty = [...new Set(flags)].reduce((sum, f) => sum + (TRUST_PENALTY[f] ?? 0), 0);
  const next = score - penalty + (fullyValid && penalty === 0 ? TRUST_RECOVERY : 0);
  return Math.max(0, Math.min(TRUST_START, next));
}

export type TrustLevel = 'ok' | 'review' | 'suspended';

export function trustLevel(score: number): TrustLevel {
  if (score < TRUST_SUSPEND_BELOW) return 'suspended';
  if (score < TRUST_REVIEW_BELOW) return 'review';
  return 'ok';
}
