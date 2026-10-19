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
  chests?: Chest[];
  /** Explored cells (personal map), drawn like a personal heatmap. */
  explored?: string[];
  onZonePress?: (id: string) => void;
  /** Keeps the camera on the user while running. */
  followUser?: boolean;
  interactive?: boolean;
  style?: ViewStyle;
};
