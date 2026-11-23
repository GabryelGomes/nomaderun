import { cellCenter } from '@/domain/grid';
import { chaikin, relax, smoothCells, territoryRegions } from '@/domain/regions';
import type { FactionId, LatLng } from '@/domain/types';
import { factions, palette, territoryOpacity } from '@/theme/tokens';

import type { HeatSpot, TerritoryMapProps } from './territory-map.types';

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

/** Abaixo disso (raiz da fração da mais quente) a mancha não aparece. */
export const HEAT_MIN_WEIGHT = 0.2;
/** Uma troca de dono pesa como 3 corridas: é o que muda o mapa. */
export const HEAT_FLIP_WEIGHT = 3;
/** Raios (m) dos 3 anéis de cada mancha, do mais largo ao centro, e a opacidade máxima de cada um. */
export const HEAT_RINGS: readonly (readonly [radius: number, opacity: number])[] = [
  [320, 0.12],
  [210, 0.18],
  [110, 0.26],
];

/**
 * Contagens do servidor → manchas do mapa de calor (RF-013). A intensidade é relativa à zona mais quente da área
 * (0 a 1) com raiz quadrada, para as zonas mornas ainda aparecerem; zona sem nada, ou quase nada perto da mais
 * quente (abaixo de `HEAT_MIN_WEIGHT`), fica de fora para o mapa não virar um tapete.
 */
export function heatSpots(rows: readonly { id: string; runs: number; flips: number }[]): HeatSpot[] {
  const score = (r: { runs: number; flips: number }) => r.runs + HEAT_FLIP_WEIGHT * r.flips;
  const max = rows.reduce((m, r) => Math.max(m, score(r)), 0);
  if (max <= 0) return [];
  return rows
    .map((r) => ({ id: r.id, weight: Math.sqrt(score(r) / max) }))
    .filter((r) => r.weight >= HEAT_MIN_WEIGHT)
    .map((r) => ({ ...r, center: cellCenter(r.id) }))
    .sort((a, b) => a.weight - b.weight); // as mais quentes por cima
}

/** Cor da mancha: laranja da marca no morno, amarelo (alerta) no mais quente. */
export const heatColor = (weight: number) => (weight >= 0.75 ? palette.warning : palette.orange);
