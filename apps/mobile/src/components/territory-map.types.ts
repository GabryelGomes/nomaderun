import type { ViewStyle } from 'react-native';

import type { Chest } from '@/domain/games';
import type { FactionId, LatLng } from '@/domain/types';

export type MapZone = {
  id: string;
  boundary: LatLng[];
  owner: FactionId | null;
  attack: boolean;
  blocked?: boolean;
};

export type TerritoryMapProps = {
  zones: MapZone[];
  center: LatLng;
  /** Approximate visible span in meters (vertical). */
  span?: number;
  user?: LatLng | null;
  path?: LatLng[];
  chests?: Chest[];
  fogCells?: { id: string; boundary: LatLng[] }[];
  selectedZone?: string | null;
  onZonePress?: (id: string) => void;
  /** Keeps the camera on the user while running. */
  followUser?: boolean;
  interactive?: boolean;
  style?: ViewStyle;
};
