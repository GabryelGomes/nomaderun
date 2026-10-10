import { cellBoundary, cellCenter } from '@/domain/grid';
import { distanceMeters } from '@/domain/geo';
import { isUnderAttack, type Zone } from '@/domain/territory';
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

/** Zones near a point, ready for the map. Keeps the polygon count bounded (prototype map). */
export function mapZonesNear(zones: Record<string, Zone>, near: LatLng, radiusM = 2200): MapZone[] {
  return Object.values(zones)
    .filter((z) => distanceMeters(cellCenter(z.id), near) <= radiusM)
    .map((z) => ({ id: z.id, boundary: boundaryOf(z.id), owner: z.owner, attack: isUnderAttack(z), blocked: z.blocked }));
}
