// Must load before h3-js (see h3-runtime.ts).
import './h3-runtime';

import { cellToBoundary, cellToChildrenSize, cellToLatLng, cellToParent, gridDisk, latLngToCell } from 'h3-js';

import type { LatLng } from './types';

/** Zones (conquerable territory) use H3 resolution 9, ~0.1 km² (ERS 1.3). */
export const ZONE_RES = 9;
/** Districts aggregate zones at resolution 7, ~5 km² (ERS 1.3, RN-012). */
export const DISTRICT_RES = 7;
/** Fog-of-war cells use resolution 10, ~15,000 m² (Product Book 3.3). */
export const FOG_RES = 10;

export const zoneOf = (p: LatLng) => latLngToCell(p.lat, p.lng, ZONE_RES);
export const fogCellOf = (p: LatLng) => latLngToCell(p.lat, p.lng, FOG_RES);
export const districtOf = (zoneId: string) => cellToParent(zoneId, DISTRICT_RES);

export function cellCenter(cell: string): LatLng {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/** Polygon ring of a cell as LatLng points (not closed). */
export function cellBoundary(cell: string): LatLng[] {
  return cellToBoundary(cell).map(([lat, lng]) => ({ lat, lng }));
}

/** Cells within `k` rings around a cell, including itself. */
export const cellsAround = (cell: string, k: number) => gridDisk(cell, k);

/** Quantas células de Neblina/Atlas (res 10) cabem num distrito (res 7): 343, ou menos num pentágono. */
export const fogCellsInDistrict = (district: string) => cellToChildrenSize(district, FOG_RES);
