import { distanceMeters } from '@/domain/geo';
import type { LatLng } from '@/domain/types';
import type { ActivityPoint } from '@/services/api/moderation-repo';

/** Ponto de um gráfico: `x` em segundos desde o início, `y` no valor da série. */
export type SeriesPoint = { x: number; y: number };

export type ActivitySeries = {
  /** Velocidade em km/h (do GPS quando houver; senão calculada entre pontos). */
  speed: SeriesPoint[];
  /** Cadência em passos por minuto; vazio quando o aparelho não informou passos. */
  cadence: SeriesPoint[];
  maxSpeed: number;
  path: LatLng[];
  durationS: number;
};

/**
 * Séries para os gráficos do painel (RF-018): agrupa em janelas de `bucketS` segundos para o
 * gráfico ficar legível com milhares de pontos.
 */
export function activitySeries(points: ActivityPoint[], bucketS = 15): ActivitySeries {
  const pts = [...points].sort((a, b) => a.seq - b.seq);
  const path = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
  if (pts.length < 2) return { speed: [], cadence: [], maxSpeed: 0, path, durationS: 0 };
  const t0 = pts[0].t;
  const buckets = new Map<number, { speedSum: number; speedN: number; steps: number; hasSteps: boolean; dt: number }>();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dt = Math.max(0, (b.t - a.t) / 1000);
    const kmh = b.speed !== null && b.speed >= 0 ? b.speed * 3.6 : dt > 0 ? (distanceMeters(a, b) / dt) * 3.6 : 0;
    const k = Math.floor((b.t - t0) / 1000 / bucketS);
    const cur = buckets.get(k) ?? { speedSum: 0, speedN: 0, steps: 0, hasSteps: false, dt: 0 };
    cur.speedSum += kmh;
    cur.speedN += 1;
    cur.dt += dt;
    if (b.steps !== null) {
      cur.steps += b.steps;
      cur.hasSteps = true;
    }
    buckets.set(k, cur);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const speed = keys.map((k) => {
    const v = buckets.get(k)!;
    return { x: k * bucketS, y: v.speedSum / v.speedN };
  });
  const cadence = keys
    .filter((k) => buckets.get(k)!.hasSteps)
    .map((k) => {
      const v = buckets.get(k)!;
      return { x: k * bucketS, y: v.dt > 0 ? (v.steps / v.dt) * 60 : 0 };
    });
  return {
    speed,
    cadence,
    maxSpeed: speed.reduce((m, p) => Math.max(m, p.y), 0),
    path,
    durationS: (pts[pts.length - 1].t - t0) / 1000,
  };
}

/** Centro e extensão (metros) do percurso, para enquadrar o mapa. */
export function pathFrame(path: LatLng[]): { center: LatLng; spanM: number } | null {
  if (path.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of path) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  const h = distanceMeters({ lat: minLat, lng: center.lng }, { lat: maxLat, lng: center.lng });
  const w = distanceMeters({ lat: center.lat, lng: minLng }, { lat: center.lat, lng: maxLng });
  return { center, spanM: Math.max(600, Math.max(h, w) * 1.4) };
}
