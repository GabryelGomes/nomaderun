import { chaikin, relax, smoothCells, territoryRegions } from '@/domain/regions';
import type { FactionId, LatLng } from '@/domain/types';
import { factions, territoryOpacity } from '@/theme/tokens';

import type { TerritoryMapProps } from './territory-map.types';

export type RegionLayer = { key: string; rings: LatLng[][]; color: string; opacity: number };
export type ContestedLayer = { id: string; ring: LatLng[]; color: string };

export type MapLayers = {
  regions: RegionLayer[];
  blocked: LatLng[][][];
  contested: ContestedLayer[];
  explored: LatLng[][][];
};

/**
 * What both maps draw (pesquisa 06): the H3 grid stays in the rules, never on screen.
 * Same-team zones become one smooth region; a contested zone is a dashed blob in the attacker's color.
 */
export function mapLayers({ zones, myFaction, onlyMine, explored }: Pick<TerritoryMapProps, 'zones' | 'myFaction' | 'onlyMine' | 'explored'>): MapLayers {
  const visible = onlyMine ? zones.filter((z) => z.owner === myFaction) : zones;
  const regions = territoryRegions(visible.filter((z) => !z.blocked)).map((r, i) => ({
    key: `${r.owner}-${i}`,
    rings: r.rings,
    color: factions[r.owner].color,
    opacity: r.owner === myFaction ? territoryOpacity.mine : territoryOpacity.other,
  }));
  const contested = visible
    .filter((z): z is typeof z & { attacker: FactionId } => z.attacker !== null && !z.blocked)
    .map((z) => ({ id: z.id, ring: chaikin(relax(z.boundary), 2), color: factions[z.attacker].color }));
  return {
    regions,
    blocked: smoothCells(zones.filter((z) => z.blocked).map((z) => z.id)),
    contested,
    explored: explored?.length ? smoothCells(explored, 1) : [],
  };
}

/** Ring that approximates a circle of `radius` meters (web map and tests; the native map has `Circle`). */
export function circleRing(center: LatLng, radius: number, steps = 48): LatLng[] {
  const dLat = radius / 111_320;
  const dLng = radius / (111_320 * Math.max(Math.cos((center.lat * Math.PI) / 180), 1e-6));
  return Array.from({ length: steps }, (_, i) => {
    const a = (2 * Math.PI * i) / steps;
    return { lat: center.lat + dLat * Math.sin(a), lng: center.lng + dLng * Math.cos(a) };
  });
}
