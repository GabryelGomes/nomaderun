/**
 * GPS da corrida (RF-004, D-10): BestForNavigation a cada 1 s, com velocidade, altitude, precisão e
 * `mocked`. Em primeiro plano usa `watchPositionAsync`; com a flag `extra.backgroundLocation`
 * (development build) usa a tarefa de segundo plano, que grava direto na fila SQLite.
 */
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { LOCATION_MESSAGES } from './permissions';

export type Fix = {
  lat: number;
  lng: number;
  t: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
  mocked: boolean | null;
};

export const BACKGROUND_LOCATION_TASK = 'nomade-run-location';

export const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
};

const finiteOrNull = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Converte o objeto do expo-location; velocidade negativa (iOS: inválida) vira null. */
export function toFix(loc: Pick<Location.LocationObject, 'coords' | 'timestamp' | 'mocked'>): Fix {
  const speed = finiteOrNull(loc.coords.speed);
  const accuracy = finiteOrNull(loc.coords.accuracy);
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    t: Math.round(loc.timestamp),
    accuracy: accuracy !== null && accuracy >= 0 ? accuracy : null,
    speed: speed !== null && speed >= 0 ? speed : null,
    altitude: finiteOrNull(loc.coords.altitude),
    mocked: typeof loc.mocked === 'boolean' ? loc.mocked : null,
  };
}

/** Flag de build (D-20): GPS com a tela bloqueada só em development build. */
export function backgroundLocationEnabled(): boolean {
  return Platform.OS !== 'web' && Constants.expoConfig?.extra?.backgroundLocation === true;
}

export type FixSubscription = { remove: () => void };

export async function watchFixes(onFix: (f: Fix) => void, onError: (message: string) => void): Promise<FixSubscription | null> {
  try {
    const sub = await Location.watchPositionAsync(WATCH_OPTIONS, (loc) => onFix(toFix(loc)), () => onError(LOCATION_MESSAGES.lost));
    return { remove: () => sub.remove() };
  } catch {
    onError(LOCATION_MESSAGES.error);
    return null;
  }
}

/** Liga a tarefa de segundo plano. Devolve false se não puder (sem permissão "sempre", Expo Go...). */
export async function startBackgroundUpdates(): Promise<boolean> {
  if (!backgroundLocationEnabled()) return false;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return false;
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) return true;
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      ...WATCH_OPTIONS,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'NOMADE RUN gravando sua corrida',
        notificationBody: 'O GPS continua ativo com a tela bloqueada.',
        notificationColor: '#FF5A1F',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    // Já parada.
  }
}
