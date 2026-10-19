import './h3-runtime';

import { cellsToMultiPolygon } from 'h3-js';

import type { FactionId, LatLng } from './types';

/**
 * Territory is computed on an H3 grid (fair, testable), but shown as natural regions:
 * adjacent cells of the same owner are merged into one shape and its corners are rounded,
 * so the map reads like a choropleth, not like a board-game grid.
 */
export type Region = {
  owner: FactionId;
  /** First ring is the outline, the rest are holes. Rings are open (first point not repeated). */
  rings: LatLng[][];
  cells: number;
};

/** One Chaikin corner-cutting pass on a closed ring: each edge keeps its 1/4 and 3/4 points. */
export function chaikin(ring: LatLng[], iterations = 2): LatLng[] {
  let pts = ring;
  for (let it = 0; it < iterations; it++) {
    const next: LatLng[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push({ lat: 0.75 * a.lat + 0.25 * b.lat, lng: 0.75 * a.lng + 0.25 * b.lng });
      next.push({ lat: 0.25 * a.lat + 0.75 * b.lat, lng: 0.25 * a.lng + 0.75 * b.lng });
    }
    pts = next;
  }
  return pts;
}

/**
 * Laplacian relaxation on a closed ring: each point moves toward the middle of its neighbors.
 * Cancels the zigzag of hexagon edges along an outline, which corner cutting alone keeps.
 */
export function relax(ring: LatLng[], iterations = 3): LatLng[] {
  let pts = ring;
  for (let it = 0; it < iterations; it++) {
    pts = pts.map((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[(i + 1) % pts.length];
      return { lat: 0.5 * p.lat + 0.25 * (a.lat + b.lat), lng: 0.5 * p.lng + 0.25 * (a.lng + b.lng) };
    });
  }
  return pts;
}

/** Merges any set of cells into smoothed polygons (each one: outline ring, then holes). */
export function smoothCells(cells: string[], smoothing = 2): LatLng[][][] {
  if (cells.length === 0) return [];
  return cellsToMultiPolygon(cells, false).map((polygon) =>
    polygon.map((ring) => {
      const last = ring[ring.length - 1];
      const open = ring.length > 1 && ring[0][0] === last[0] && ring[0][1] === last[1] ? ring.slice(0, -1) : ring;
      return chaikin(
        relax(open.map(([lat, lng]) => ({ lat, lng }))),
        smoothing,
      );
    }),
  );
}

/** Merges zones per owner into smoothed regions. Neutral zones are not drawn. */
export function territoryRegions(zones: { id: string; owner: FactionId | null }[], smoothing = 2): Region[] {
  const byOwner = new Map<FactionId, string[]>();
  for (const z of zones) {
    if (!z.owner) continue;
    const list = byOwner.get(z.owner) ?? [];
    list.push(z.id);
    byOwner.set(z.owner, list);
  }
  const regions: Region[] = [];
  for (const [owner, cells] of byOwner) {
    for (const rings of smoothCells(cells, smoothing)) regions.push({ owner, rings, cells: cells.length });
  }
  return regions;
}
