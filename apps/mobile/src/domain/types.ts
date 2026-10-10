export type FactionId = 'striders' | 'coyotes' | 'owls' | 'volt';

export const FACTION_IDS: readonly FactionId[] = ['striders', 'coyotes', 'owls', 'volt'];

/** One GPS fix as recorded by the phone. `t` is epoch milliseconds. */
export type GeoPoint = {
  lat: number;
  lng: number;
  t: number;
  /** Horizontal accuracy in meters, when the OS reports it. */
  accuracy?: number;
  /** True when the OS flags the fix as coming from a mock provider. */
  mocked?: boolean;
  /** Steps counted by the pedometer since the previous fix. */
  steps?: number;
};

export type LatLng = { lat: number; lng: number };
