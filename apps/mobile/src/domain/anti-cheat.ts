import { distanceMeters, mpsToKmh } from './geo';
import type { GeoPoint } from './types';

/** RN-007 */
export const MAX_ACCURACY_M = 30;
export const MAX_POINT_KMH = 40;
export const SUSTAINED_KMH = 25;
export const SUSTAINED_SECONDS = 30;
export const TELEPORT_METERS = 50;
export const TELEPORT_SECONDS = 1;
/** RN-008 */
export const CADENCE_CHECK_MIN_KMH = 8;
export const CADENCE_CHECK_MAX_KMH = 20;
export const MIN_CADENCE_SPM = 60;
export const LOW_CADENCE_SECONDS = 60;
export const NO_PEDOMETER_REVIEW_METERS = 10_000;

export type CheatFlag = 'MOCK_LOCATION' | 'TELEPORT' | 'POINT_SPEED' | 'VEHICLE_SUSPECTED' | 'NO_STEPS' | 'NO_PEDOMETER';

export type Step = {
  /** Indices into the original point array. */
  from: number;
  to: number;
  meters: number;
  seconds: number;
  kmh: number;
  valid: boolean;
  reason?: CheatFlag;
};

export type ActivityValidation = {
  status: 'valid' | 'partially_valid' | 'rejected' | 'under_review';
  steps: Step[];
  flags: CheatFlag[];
  validMeters: number;
  invalidMeters: number;
  discardedPoints: number;
};

function invalidateRuns(
  steps: Step[],
  predicate: (s: Step) => boolean,
  minSeconds: number,
  reason: CheatFlag,
) {
  let start = -1;
  let seconds = 0;
  const close = (end: number) => {
    if (start >= 0 && seconds > minSeconds) {
      for (let i = start; i < end; i++) {
        if (steps[i].valid) {
          steps[i].valid = false;
          steps[i].reason = reason;
        }
      }
    }
    start = -1;
    seconds = 0;
  };
  steps.forEach((s, i) => {
    if (predicate(s)) {
      if (start < 0) start = i;
      seconds += s.seconds;
    } else {
      close(i);
    }
  });
  close(steps.length);
}

/** Server-side validation of a recorded run (RN-007, RN-008). The client may run it too, for feedback only. */
export function validateActivity(points: GeoPoint[]): ActivityValidation {
  if (points.some((p) => p.mocked)) {
    return { status: 'rejected', steps: [], flags: ['MOCK_LOCATION'], validMeters: 0, invalidMeters: 0, discardedPoints: 0 };
  }

  const kept = points
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p.accuracy === undefined || p.accuracy <= MAX_ACCURACY_M);
  const discardedPoints = points.length - kept.length;
  const hasPedometer = points.some((p) => p.steps !== undefined);

  const steps: Step[] = [];
  for (let i = 1; i < kept.length; i++) {
    const a = kept[i - 1];
    const b = kept[i];
    const meters = distanceMeters(a.p, b.p);
    const seconds = Math.max(0, (b.p.t - a.p.t) / 1000);
    const kmh = seconds > 0 ? mpsToKmh(meters / seconds) : meters > 0 ? Infinity : 0;
    const step: Step = { from: a.index, to: b.index, meters, seconds, kmh, valid: true };
    if (meters > TELEPORT_METERS && seconds <= TELEPORT_SECONDS) {
      step.valid = false;
      step.reason = 'TELEPORT';
    } else if (kmh > MAX_POINT_KMH) {
      step.valid = false;
      step.reason = 'POINT_SPEED';
    }
    steps.push(step);
  }

  invalidateRuns(steps, (s) => s.kmh > SUSTAINED_KMH, SUSTAINED_SECONDS, 'VEHICLE_SUSPECTED');

  if (hasPedometer) {
    invalidateRuns(
      steps,
      (s) => {
        if (s.kmh < CADENCE_CHECK_MIN_KMH || s.kmh > CADENCE_CHECK_MAX_KMH || s.seconds <= 0) return false;
        const stepCount = points[s.to].steps ?? 0;
        return (stepCount / s.seconds) * 60 < MIN_CADENCE_SPM;
      },
      LOW_CADENCE_SECONDS,
      'NO_STEPS',
    );
  }

  const flags = new Set<CheatFlag>();
  let validMeters = 0;
  let invalidMeters = 0;
  for (const s of steps) {
    if (s.valid) validMeters += s.meters;
    else {
      invalidMeters += s.meters;
      if (s.reason) flags.add(s.reason);
    }
  }

  let status: ActivityValidation['status'] = invalidMeters > 0 ? 'partially_valid' : 'valid';
  if (!hasPedometer) {
    flags.add('NO_PEDOMETER');
    if (validMeters > NO_PEDOMETER_REVIEW_METERS) status = 'under_review';
  }
  return { status, steps, flags: [...flags], validMeters, invalidMeters, discardedPoints };
}

/** Plain-language explanation shown in the run summary (RF-006). */
export const FLAG_EXPLANATION: Record<CheatFlag, string> = {
  MOCK_LOCATION: 'Localização simulada detectada. A corrida não gera pontos.',
  TELEPORT: 'A posição saltou de um lugar para outro. O trecho não conta.',
  POINT_SPEED: 'Velocidade acima de 40 km/h. O trecho não conta.',
  VEHICLE_SUSPECTED: 'Velocidade de veículo por mais de 30 segundos. O trecho não conta.',
  NO_STEPS: 'Movimento rápido sem passos registrados. O trecho não conta.',
  NO_PEDOMETER: 'Este aparelho não informa passos; corridas longas passam por revisão.',
};
