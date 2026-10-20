import { cellBoundary, cellCenter } from '@/domain/grid';
import { distanceMeters } from '@/domain/geo';
import type { Zone } from '@/domain/territory';
import type { LatLng } from '@/domain/types';
import type { MapZone } from '@/components/territory-map.types';

const boundaryCache = new Map<string, LatLng[]>();

export function boundaryOf(id: string): LatLng[] {
  let b = boundaryCache.get(id);
  if (!b) {
    b = cellBoundary(id);
    boundaryCache.set(id, b);
  }
  return b;
}

/** Zones near a point, ready for the map. Keeps the shape count bounded (prototype map). */
export function mapZonesNear(zones: Record<string, Zone>, near: LatLng, radiusM = 2200): MapZone[] {
  return Object.values(zones)
    .filter((z) => distanceMeters(cellCenter(z.id), near) <= radiusM)
    .map((z) => ({ id: z.id, boundary: boundaryOf(z.id), owner: z.owner, attacker: z.attackStartedAt !== null ? z.attacker : null, blocked: z.blocked }));
}

const centerCache = new Map<string, LatLng>();
function centerOf(id: string): LatLng {
  let c = centerCache.get(id);
  if (!c) {
    c = cellCenter(id);
    centerCache.set(id, c);
  }
  return c;
}

const toMapZone = (z: Zone): MapZone => ({
  id: z.id,
  boundary: boundaryOf(z.id),
  owner: z.owner,
  attacker: z.attackStartedAt !== null ? z.attacker : null,
  blocked: z.blocked,
});

/**
 * Zones inside the visible area (plus a margin, so panning doesn't show empty edges), closest to the
 * center first and capped: the prototype map draws one shape per region, not a whole city (RNF-003).
 */
export function mapZonesInBounds(
  zones: Record<string, Zone>,
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  max = 1500,
): MapZone[] {
  const mLat = (bounds.maxLat - bounds.minLat) * 0.25;
  const mLng = (bounds.maxLng - bounds.minLng) * 0.25;
  const mid = { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
  const inside = Object.values(zones)
    .map((z) => ({ z, c: centerOf(z.id) }))
    .filter(({ c }) => c.lat >= bounds.minLat - mLat && c.lat <= bounds.maxLat + mLat && c.lng >= bounds.minLng - mLng && c.lng <= bounds.maxLng + mLng);
  if (inside.length > max) inside.sort((a, b) => distanceMeters(a.c, mid) - distanceMeters(b.c, mid)).splice(max);
  return inside.map(({ z }) => toMapZone(z));
}
