import { offset } from '../geo';
import type { GeoPoint, LatLng } from '../types';

/** Parque Flamboyant, Goiânia — the demo city center. */
export const ORIGIN: LatLng = { lat: -16.7097, lng: -49.2388 };

/**
 * Builds a straight track heading east: one fix per `stepSeconds`, at `kmh`, for `seconds`.
 * `spm` sets the pedometer cadence (undefined = device without pedometer).
 */
export function track(opts: {
  kmh: number;
  seconds: number;
  stepSeconds?: number;
  start?: LatLng;
  t0?: number;
  spm?: number;
  bearing?: number;
}): GeoPoint[] {
  const step = opts.stepSeconds ?? 1;
  const metersPerStep = (opts.kmh / 3.6) * step;
  const start = opts.start ?? ORIGIN;
  const t0 = opts.t0 ?? 0;
  const points: GeoPoint[] = [];
  let pos = start;
  for (let i = 0; i * step <= opts.seconds; i++) {
    points.push({
      ...pos,
      t: t0 + i * step * 1000,
      accuracy: 5,
      steps: opts.spm === undefined ? undefined : i === 0 ? 0 : (opts.spm / 60) * step,
    });
    pos = offset(pos, metersPerStep, opts.bearing ?? 90);
  }
  return points;
}

/** Concatenates tracks so each one continues where the previous ended. */
export function chain(...parts: ((start: LatLng, t0: number) => GeoPoint[])[]): GeoPoint[] {
  const out: GeoPoint[] = [];
  let start = ORIGIN;
  let t0 = 0;
  for (const part of parts) {
    const pts = part(start, t0);
    const body = out.length ? pts.slice(1) : pts;
    out.push(...body);
    const last = out[out.length - 1];
    start = { lat: last.lat, lng: last.lng };
    t0 = last.t;
  }
  return out;
}
