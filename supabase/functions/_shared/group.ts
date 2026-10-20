/**
 * RN-001 — M_grupo no servidor (P-12). Puro (sem I/O).
 *
 * `detectPack`: etapa antes da pontuação. Para cada trecho válido da corrida (mesmos passos de `validateActivity`
 * que o `finishRun` usa), procura, no mesmo instante, a posição dos outros membros da Crew (percursos das
 * corridas deles no mesmo intervalo, interpoladas). O trecho conta "em grupo" quando o corredor e pelo menos
 * mais 2 membros estão a até 50 m entre si (os 3 dois a dois). Uma zona ganha o multiplicador quando os trechos
 * em grupo somam ≥ 60% dos metros válidos dela.
 *
 * As zonas detectadas vão para `RunContext.packZones` do `finishRun`, que aplica o M_grupo pelo `scoreZone`
 * do domain (P-26 resolvida; a antiga ponte `applyPack` foi removida).
 */
import { distanceMeters, type GeoPoint, type LatLng, validateActivity, zoneOf } from './domain.ts';

/** Distância máxima entre os membros (RN-001). */
export const PACK_DISTANCE_M = 50;
/** Parte mínima do trecho da zona correndo em grupo (RN-001). */
export const PACK_MIN_SHARE = 0.6;
/** Membros da mesma Crew, contando o próprio corredor (RN-001). */
export const PACK_MIN_MEMBERS = 3;
/** Maior intervalo entre dois pontos de um colega para interpolar a posição dele. */
export const PACK_MAX_GAP_MS = 15_000;

/** Percurso de um colega de Crew: pontos [t (ms), lat, lng] em ordem de tempo. */
export type CrewTrack = { userId: string; points: [number, number, number][] };

export type PackDetection = {
  /** Zonas com M_grupo (≥ 60% dos metros válidos em grupo). */
  zones: string[];
  /** Colegas que correram junto em algum trecho (sem contar o corredor). */
  members: string[];
  /** Metros válidos em grupo por zona (para depuração e testes). */
  packMetersByZone: Record<string, number>;
};

/** Posição do colega no instante `t`, interpolada entre os pontos vizinhos (null se não estava correndo). */
export function positionAt(track: CrewTrack, t: number): LatLng | null {
  const pts = track.points;
  if (pts.length === 0 || t < pts[0][0] - PACK_MAX_GAP_MS / 3 || t > pts[pts.length - 1][0] + PACK_MAX_GAP_MS / 3) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  if (t <= a[0]) return { lat: a[1], lng: a[2] };
  if (t >= b[0]) return { lat: b[1], lng: b[2] };
  if (b[0] - a[0] > PACK_MAX_GAP_MS) return null;
  const f = (t - a[0]) / (b[0] - a[0]);
  return { lat: a[1] + (b[1] - a[1]) * f, lng: a[2] + (b[2] - a[2]) * f };
}

/** Colegas que formam, com o corredor em `p`, um grupo de PACK_MIN_MEMBERS a até PACK_DISTANCE_M dois a dois. */
function groupAt(p: LatLng, t: number, tracks: CrewTrack[]): string[] | null {
  const near: { userId: string; pos: LatLng }[] = [];
  for (const tr of tracks) {
    const pos = positionAt(tr, t);
    if (pos && distanceMeters(p, pos) <= PACK_DISTANCE_M) near.push({ userId: tr.userId, pos });
  }
  if (near.length < PACK_MIN_MEMBERS - 1) return null;
  // PACK_MIN_MEMBERS = 3: basta um par de colegas também a até 50 m entre si
  const members = new Set<string>();
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      if (distanceMeters(near[i].pos, near[j].pos) <= PACK_DISTANCE_M) {
        members.add(near[i].userId);
        members.add(near[j].userId);
      }
    }
  }
  return members.size >= PACK_MIN_MEMBERS - 1 ? [...members] : null;
}

export function detectPack(points: GeoPoint[], tracks: CrewTrack[]): PackDetection {
  const byUser = new Map<string, CrewTrack>();
  for (const tr of tracks) {
    const cur = byUser.get(tr.userId);
    if (cur) cur.points.push(...tr.points);
    else byUser.set(tr.userId, { userId: tr.userId, points: [...tr.points] });
  }
  const merged = [...byUser.values()].filter((tr) => tr.points.length > 0);
  for (const tr of merged) tr.points.sort((a, b) => a[0] - b[0]);
  if (merged.length < PACK_MIN_MEMBERS - 1) return { zones: [], members: [], packMetersByZone: {} };

  const validation = validateActivity(points);
  const total: Record<string, number> = {};
  const pack: Record<string, number> = {};
  const members = new Set<string>();
  for (const s of validation.steps) {
    if (!s.valid) continue;
    const a = points[s.from];
    const b = points[s.to];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const zone = zoneOf(mid);
    total[zone] = (total[zone] ?? 0) + s.meters;
    const group = groupAt(mid, (a.t + b.t) / 2, merged);
    if (group) {
      pack[zone] = (pack[zone] ?? 0) + s.meters;
      for (const m of group) members.add(m);
    }
  }
  const zones = Object.keys(pack).filter((z) => total[z] > 0 && pack[z] / total[z] >= PACK_MIN_SHARE).sort();
  return { zones, members: zones.length ? [...members].sort() : [], packMetersByZone: pack };
}
