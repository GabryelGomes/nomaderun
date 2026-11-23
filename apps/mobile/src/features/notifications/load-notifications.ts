import Constants, { ExecutionEnvironment } from 'expo-constants';

export type NotificationsModule = typeof import('expo-notifications');

/**
 * Pode usar `expo-notifications` aqui? Na web não há notificação local, e o Expo Go do Android (SDK 53+) não traz
 * o módulo nativo `ExpoTopicSubscriptionModule`: só carregar a biblioteca derruba o app na abertura
 * (DF11, 5ª bateria de testes externos). Nesses casos o app segue sem notificação; a central de avisos continua.
 */
export function notificationsAvailable(): boolean {
  const os = process.env.EXPO_OS;
  if (os !== 'ios' && os !== 'android') return false;
  return !(os === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
}

/** Carrega `expo-notifications` só onde existe; `null` quando não dá (ver `notificationsAvailable`). */
export async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!notificationsAvailable()) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}
