import type { AppNotification } from '@/services/api/notifications-repo';
import type { NotificationPrefs } from '@/services/api/types';

/**
 * Notificação local quando um alerta chega com o app aberto (RF-009). Push remoto fica para o
 * development build (D-13). Respeita as preferências do perfil e a permissão já pedida no onboarding.
 */
export function prefAllows(n: AppNotification, prefs: NotificationPrefs | null | undefined): boolean {
  if (!prefs) return true;
  switch (n.type) {
    case 'invasion':
    case 'territory_lost':
      return prefs.invasions;
    case 'conquest':
      return prefs.conquests;
    case 'moderation':
      return prefs.moderation;
    case 'mission':
      return prefs.missions;
    default:
      return true;
  }
}

let handlerSet = false;

export async function showLocalAlert(n: AppNotification): Promise<void> {
  if (process.env.EXPO_OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    if (!handlerSet) {
      handlerSet = true;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: { notificationId: n.id, ...n.data } },
      trigger: null,
    });
  } catch {
    // Sem notificação local (ex.: Expo Go sem suporte): a central no app continua mostrando o alerta.
  }
}
