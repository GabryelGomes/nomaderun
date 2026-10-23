import * as Location from 'expo-location';

import type { LatLng } from '@/domain/types';

import { checkLocationAccess, type LocationPermissionApi } from './permissions';

export type CurrentPositionApi = LocationPermissionApi & Pick<typeof Location, 'getLastKnownPositionAsync' | 'getCurrentPositionAsync'>;

/** Posição conhecida há no máximo 5 min serve para centralizar o mapa sem esperar o GPS. */
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;
const FRESH_TIMEOUT_MS = 8_000;

/**
 * Onde o corredor está agora, para centralizar o mapa (revisão nº 1, A-2). Não abre o pedido de
 * permissão (isso é do onboarding/da corrida): sem permissão, GPS desligado ou erro, devolve `null`
 * e o mapa fica na região de demonstração, rotulada.
 */
export async function currentPosition(api: CurrentPositionApi = Location, timeoutMs = FRESH_TIMEOUT_MS): Promise<LatLng | null> {
  const access = await checkLocationAccess(api);
  if (access.status !== 'granted') return null;
  try {
    const last = await api.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const fresh = await Promise.race([
      api.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return fresh ? { lat: fresh.coords.latitude, lng: fresh.coords.longitude } : null;
  } catch {
    return null;
  }
}
