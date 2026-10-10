import type { LatLng } from './types';

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Converts meters per second to km/h. */
export const mpsToKmh = (mps: number) => mps * 3.6;

/** Pace in seconds per km for a distance covered in a time. Infinity when nothing was covered. */
export function paceSecPerKm(meters: number, seconds: number): number {
  if (meters <= 0) return Infinity;
  return seconds / (meters / 1000);
}

/** Moves a point by a distance (meters) along a bearing (degrees from north). */
export function offset(point: LatLng, meters: number, bearingDeg: number): LatLng {
  const angular = meters / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(point.lat);
  const lng1 = toRad(point.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

/** Formats a pace as m:ss (e.g. 330 → "5:30"). Returns "--:--" for an undefined pace. */
export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '--:--';
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Formats a duration in seconds as m:ss or h:mm:ss. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** Formats meters as km with a comma decimal separator (pt-BR), e.g. 5620 → "5,62". */
export function formatKm(meters: number, decimals = 2): string {
  return (meters / 1000).toFixed(decimals).replace('.', ',');
}
