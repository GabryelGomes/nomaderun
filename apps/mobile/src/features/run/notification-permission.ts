/**
 * Permissão de notificação pedida **depois da 1ª conquista** (D-72), no resumo, com a explicação antes
 * (`PermissionPrimer`). Só pergunta se o sistema ainda não perguntou; na web não há o que pedir.
 */
import { loadNotifications } from '@/features/notifications/load-notifications';

export type NotificationAsk = 'ask' | 'skip';

/** Mostra a explicação? Só quando houve conquista e a permissão ainda não foi decidida. */
export function shouldAskNotifications(conquered: number, status: 'granted' | 'denied' | 'undetermined' | 'unsupported'): NotificationAsk {
  return conquered > 0 && status === 'undetermined' ? 'ask' : 'skip';
}

export async function notificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return 'unsupported';
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return false;
    const p = await Notifications.requestPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}
