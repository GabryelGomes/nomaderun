/**
 * T7.1.9 — enquadramento da rota no card (puro). Só aceita `CardRoute` (a rota já cortada, ver `card-route.ts`) e enquadra
 * **só a parte visível**, para o recorte não "apontar" para o trecho escondido. Regiões dos times
 * (opcionais) usam a mesma projeção e já chegam suavizadas: o card nunca desenha hexágonos.
 */
import { isCardRoute, type CardRoute } from './card-route';
import type { FactionId, LatLng } from '@/domain/types';


export type Box = { x: number; y: number; w: number; h: number };

/** Região de um time no mapa do card (anéis já suavizados, como no mapa do app). */
export type CardRegion = { owner: FactionId; rings: readonly (readonly LatLng[])[] };

export type RouteFrame = {
  /** Pixels do card por metro. */
  scale: number;
  toPoint(p: LatLng): [number, number];
  /** Caminho SVG de todos os pedaços visíveis da rota. */
  routePath(route: CardRoute): string;
  /** Caminho SVG (fechado) dos anéis de uma região. */
  regionPath(region: CardRegion): string;
};

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG_EQUATOR = 111_320;
/** Menor extensão enquadrada (m): evita um zoom absurdo numa rota quase parada. */
const MIN_SPAN_M = 60;
/** Distância mínima (px) entre pontos desenhados: menos texto no SVG, mesma forma. */
const MIN_STEP_PX = 1.5;

/** Só as rotas com algo visível e que saíram de verdade do corte. */
export function visibleRoutes(routes: readonly (CardRoute | null | undefined)[]): CardRoute[] {
  return routes.filter((r): r is CardRoute => !!r && isCardRoute(r) && r.mode === 'route' && r.pieces.length > 0);
}

/** Enquadra as rotas em `box` com `pad` de folga. `null` quando não há nada visível. */
export function frameRoutes(routes: readonly (CardRoute | null | undefined)[], box: Box, pad = 0): RouteFrame | null {
  const shown = visibleRoutes(routes);
  const points = shown.flatMap((r) => r.pieces.flat());
  if (!points.length) return null;
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng0 = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180) * M_PER_DEG_LNG_EQUATOR;
  const local = (p: LatLng): [number, number] => [(p.lng - lng0) * kx, -(p.lat - lat0) * M_PER_DEG_LAT];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    const [x, y] = local(p);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const spanX = Math.max(MIN_SPAN_M, x1 - x0);
  const spanY = Math.max(MIN_SPAN_M, y1 - y0);
  const innerW = Math.max(1, box.w - pad * 2);
  const innerH = Math.max(1, box.h - pad * 2);
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const tx = box.x + box.w / 2 - cx * scale;
  const ty = box.y + box.h / 2 - cy * scale;
  const toPoint = (p: LatLng): [number, number] => {
    const [x, y] = local(p);
    return [x * scale + tx, y * scale + ty];
  };
  const polyline = (pts: readonly LatLng[], close: boolean) => {
    let d = '';
    let last: [number, number] | null = null;
    pts.forEach((p, i) => {
      const q = toPoint(p);
      const isLast = i === pts.length - 1;
      if (last && !isLast && Math.hypot(q[0] - last[0], q[1] - last[1]) < MIN_STEP_PX) return;
      d += `${last ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
      last = q;
    });
    return close && d ? `${d}Z` : d;
  };
  return {
    scale,
    toPoint,
    routePath: (route) => (isCardRoute(route) && route.mode === 'route' ? route.pieces.map((piece) => polyline(piece, false)).join('') : ''),
    regionPath: (region) => region.rings.filter((ring) => ring.length > 2).map((ring) => polyline(ring, true)).join(''),
  };
}
