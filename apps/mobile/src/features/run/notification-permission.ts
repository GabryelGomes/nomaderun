/**
 * Permissão de notificação pedida **depois da 1ª conquista** (D-72), no resumo, com a explicação antes
 * (`PermissionPrimer`). Só pergunta se o sistema ainda não perguntou; na web não há o que pedir.
 */
export type NotificationAsk = 'ask' | 'skip';

/** Mostra a explicação? Só quando houve conquista e a permissão ainda não foi decidida. */
export function shouldAskNotifications(conquered: number, status: 'granted' | 'denied' | 'undetermined' | 'unsupported'): NotificationAsk {
  return conquered > 0 && status === 'undetermined' ? 'ask' : 'skip';
}

export async function notificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (process.env.EXPO_OS === 'web') return 'unsupported';
  try {
    const Notifications = await import('expo-notifications');
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') return false;
  try {
    const Notifications = await import('expo-notifications');
    const p = await Notifications.requestPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}
