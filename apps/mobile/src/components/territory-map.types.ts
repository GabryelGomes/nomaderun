import type { ViewStyle } from 'react-native';

import type { Chest } from '@/domain/games';
import type { FactionId, LatLng } from '@/domain/types';

export type MapZone = {
  id: string;
  boundary: LatLng[];
  owner: FactionId | null;
  /** Team attacking this zone right now, if any. */
  attacker: FactionId | null;
  blocked?: boolean;
};

export type MapCircle = { id: string; center: LatLng; radius: number };

/** Visible area of the map (degrees), reported after the camera stops moving. */
export type MapBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type TerritoryMapProps = {
  zones: MapZone[];
  center: LatLng;
  /** Approximate visible span in meters (vertical). */
  span?: number;
  /** The runner's team: its regions are drawn a little stronger. */
  myFaction?: FactionId;
  /** "Só meu time": hides every other team's regions. */
  onlyMine?: boolean;
  user?: LatLng | null;
  path?: LatLng[];
  /**
   * Muda quando a rota cresce. Na corrida o vetor `path` é sempre o mesmo (`appendPoint`, E-12): sem isto o
   * mapa não veria os pontos novos. Padrão: `path.length`.
   */
  pathVersion?: number;
  /** Cor do rastro (na corrida, a cor do time: "a cidade pinta"). Padrão: laranja da marca. */
  pathColor?: string;
  /** Stretches of the path that did not count (UC-01 E1), drawn in gray over the route. */
  invalidPaths?: LatLng[][];
  /** Circles in meters (privacy zones, RN-010), drawn as quiet gray discs. */
  circles?: MapCircle[];
  chests?: Chest[];
  /** Explored cells (personal map), drawn like a personal heatmap. */
  explored?: string[];
  onZonePress?: (id: string) => void;
  /** Tap anywhere on the map, with the coordinate (e.g. picking a privacy zone). */
  onMapPress?: (point: LatLng) => void;
  /** Keeps the camera on the user while running. */
  followUser?: boolean;
  interactive?: boolean;
  /** Called when the camera stops moving, with the visible area (used to load zones by bbox). */
  onRegionChange?: (bounds: MapBounds) => void;
  /** When this changes, the camera moves here (e.g. opening an invasion alert). */
  focus?: LatLng | null;
  style?: ViewStyle;
};
