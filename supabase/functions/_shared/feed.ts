/**
 * Feed da crew (D-79; E8 §9.2): a rota sai da Edge Function JÁ cortada pelo domain (`clipRouteForSharing`, com
 * semente sorteada a cada geração), simplificada para no máximo 80 pontos e codificada como polyline de precisão 4
 * (1 pedaço visível = 1 polyline). Sem horário em lugar nenhum. Puro, exceto pela semente (`randomSeed`).
 *
 * Garantia extra depois da simplificação e do arredondamento: nenhum ponto da linha desenhada (densificada a cada
 * 8 m) cai dentro do raio de uma zona de privacidade nem a menos de 150 m do começo ou do fim da corrida.
 * Se cair, o item vai sem rota (`routeHidden = true`).
 */
import {
  clipRouteForSharing,
  distanceMeters,
  type LatLng,
  type PrivacyCircle,
  SHARE_DENSIFY_STEP_M,
  SHARE_END_CUT_MIN_M,
} from './domain.ts';

export const FEED_MAX_POINTS = 80;
export const FEED_PRECISION = 4;
/** Folga para o arredondamento da precisão 4 (≈ 11 m) perto das pontas, que o corte já esconde com 150–250 m. */
const END_TOLERANCE_M = 15;

/* ---------- polyline (algoritmo do Google, precisão 4) ---------- */

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function encodePolyline(points: readonly LatLng[], precision = FEED_PRECISION): string {
  const factor = 10 ** precision;
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  for (const p of points) {
    const lat = Math.round(p.lat * factor);
    const lng = Math.round(p.lng * factor);
    out += encodeValue(lat - lastLat) + encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

export function decodePolyline(s: string, precision = FEED_PRECISION): LatLng[] {
  const factor = 10 ** precision;
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i < s.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next();
    lng += next();
    out.push({ lat: lat / factor, lng: lng / factor });
  }
  return out;
}

/* ---------- simplificação (Douglas–Peucker em metros, projeção local) ---------- */

function toXY(p: LatLng, ref: LatLng): [number, number] {
  const kx = 111_320 * Math.cos((ref.lat * Math.PI) / 180);
  return [(p.lng - ref.lng) * kx, (p.lat - ref.lat) * 110_574];
}

function segDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function simplify(points: readonly LatLng[], toleranceM: number): LatLng[] {
  if (points.length <= 2) return [...points];
  const ref = points[0];
  const xy = points.map((p) => toXY(p, ref));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let max = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(xy[i], xy[s], xy[e]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx >= 0 && max > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Simplifica todos os pedaços juntos até caberem em `maxPoints` (tolerância crescente). */
export function simplifyPieces(pieces: readonly (readonly LatLng[])[], maxPoints = FEED_MAX_POINTS): LatLng[][] {
  let tol = 2;
  for (let round = 0; round < 20; round++) {
    const out = pieces.map((p) => simplify(p, tol));
    if (out.reduce((s, p) => s + p.length, 0) <= maxPoints) return out;
    tol *= 1.5;
  }
  // último recurso: só as pontas de cada pedaço
  return pieces.map((p) => (p.length > 2 ? [p[0], p[p.length - 1]] : [...p])).slice(0, Math.floor(maxPoints / 2));
}

/** Pontos de uma linha a cada `step` metros (para conferir a linha desenhada, não só os vértices). */
function densifyLine(points: readonly LatLng[], step: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    out.push(p);
    const q = points[i + 1];
    if (!q) break;
    const d = distanceMeters(p, q);
    const n = Math.floor(d / step);
    for (let k = 1; k <= n; k++) {
      const f = k / (n + 1);
      out.push({ lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f });
    }
  }
  return out;
}

/** A linha desenhada (já decodificada) respeita as zonas e as pontas? */
export function routeIsSafe(
  pieces: readonly (readonly LatLng[])[],
  zones: readonly PrivacyCircle[],
  ends: { start: LatLng; end: LatLng } | null,
): boolean {
  for (const piece of pieces) {
    for (const p of densifyLine(piece, SHARE_DENSIFY_STEP_M)) {
      if (zones.some((z) => distanceMeters(p, z) <= z.radiusM)) return false;
      if (ends && (distanceMeters(p, ends.start) < SHARE_END_CUT_MIN_M - END_TOLERANCE_M ||
                   distanceMeters(p, ends.end) < SHARE_END_CUT_MIN_M - END_TOLERANCE_M)) {
        return false;
      }
    }
  }
  return true;
}

export type FeedRoute = { route: string[] | null; routeHidden: boolean };

/** Semente nova a cada geração (32 bits, crypto). */
export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] | 0;
}

/**
 * Rota do item do feed: corte do domain → simplificação (≤ 80 pontos) → polyline precisão 4 → conferência.
 * `route` = pontos dos trechos válidos, em ordem. `showMap = false` → sem rota.
 */
export function buildFeedRoute(
  route: readonly LatLng[],
  zones: readonly PrivacyCircle[],
  opts: { seed: number; showMap: boolean },
): FeedRoute {
  if (!opts.showMap || route.length < 2) return { route: null, routeHidden: true };
  const clipped = clipRouteForSharing(route, zones, { seed: opts.seed, hideEnds: true });
  if (clipped.mode !== 'route' || clipped.pieces.length === 0) return { route: null, routeHidden: true };
  const simple = simplifyPieces(clipped.pieces, FEED_MAX_POINTS).filter((p) => p.length >= 2);
  const encoded = simple.map((p) => encodePolyline(p));
  const drawn = encoded.map((s) => decodePolyline(s));
  if (drawn.length === 0 || !routeIsSafe(drawn, zones, { start: route[0], end: route[route.length - 1] })) {
    return { route: null, routeHidden: true };
  }
  return { route: encoded, routeHidden: clipped.hiddenRatio > 0 };
}

export type FeedHighlight =
  | { kind: 'zone_conquered'; name: string }
  | { kind: 'raid_damage'; damage: number; km: number };

/** Fichas do item (até 3): zonas conquistadas e dano no chefão. O recorde entra no SQL. */
export function feedHighlights(input: {
  conquered: readonly { name: string }[];
  raid: { damage: number; countedKm: number } | null;
}): FeedHighlight[] {
  const out: FeedHighlight[] = input.conquered.slice(0, 2).map((z) => ({ kind: 'zone_conquered' as const, name: z.name.slice(0, 40) }));
  if (input.raid && input.raid.damage > 0) {
    out.push({ kind: 'raid_damage', damage: Math.round(input.raid.damage), km: Math.round(input.raid.countedKm * 10) / 10 });
  }
  return out.slice(0, 3);
}
