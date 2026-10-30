import { routeSvgPath, thinRoute } from '@/components/route-path';
import type { LatLng } from '@/domain/types';

/**
 * "A rota se desenha" no resumo (T7.2.7): a rota projetada (mesma projeção do mini-mapa, sem mapa-base e
 * sem grade) é cortada em `k` pedaços em ordem; cada pedaço aparece com opacidade em cascata. Só
 * opacidade: nada de `strokeDashoffset` animado. Pedaços vizinhos dividem o ponto da emenda (sem buraco).
 */
export type RouteChunks = { chunks: string[]; start: { x: number; y: number } | null; end: { x: number; y: number } | null };

const POINT = /([ML])(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;

export function routeChunks(points: readonly LatLng[], width: number, height: number, k = 12, pad = 16): RouteChunks {
  const d = routeSvgPath(thinRoute(points, 240), width, height, pad);
  const xy = [...d.matchAll(POINT)].map((m) => ({ x: Number(m[2]), y: Number(m[3]) }));
  if (xy.length < 2) return { chunks: [], start: null, end: null };
  const n = Math.max(1, Math.min(k, xy.length - 1));
  const per = (xy.length - 1) / n;
  const chunks: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.round(i * per);
    const b = Math.round((i + 1) * per);
    const seg = xy.slice(a, b + 1);
    chunks.push(seg.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '));
  }
  return { chunks, start: xy[0], end: xy[xy.length - 1] };
}

/** Duração total do desenho (wireframe 10: 800 ms) e o atraso de cada pedaço. */
export const ROUTE_DRAW_MS = 800;
export const routeChunkDelay = (i: number, n: number, total = ROUTE_DRAW_MS) => (n <= 1 ? 0 : Math.round((i * total) / n));
