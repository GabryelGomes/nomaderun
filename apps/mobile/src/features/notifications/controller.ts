import { useEffect } from 'react';
import { AppState } from 'react-native';

import { gameAlertMode } from '@/domain/reminders';
import * as repo from '@/services/api/notifications-repo';
import { useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';

import { prefAllows, showLocalAlert } from './local-alert';
import { createFallbackPolling } from './realtime-fallback';

/** Tipos que viram notificação local quando chegam com o app aberto. */
const ALERT_TYPES = new Set<repo.NotificationType>(['invasion', 'territory_lost', 'conquest', 'moderation']);
/** Consulta periódica de fallback: só roda enquanto o canal Realtime não está `SUBSCRIBED` (P-24). */
export const POLL_MS = 20_000;

function alertIfWanted(n: repo.AppNotification) {
  if (!ALERT_TYPES.has(n.type) || n.readAt !== null) return;
  if (!prefAllows(n, useSession.getState().profile?.notificationPrefs)) return;
  // D-69: invasão e conquista entre 22h e 7h (Brasília) ficam só na central, sem banner.
  if (n.type !== 'moderation' && gameAlertMode(n.createdAt) === 'central') return;
  void showLocalAlert(n);
}

/** Carrega a lista. `notifyNew`: avisa (notificação local) as que ainda não estavam na lista. */
export async function refreshNotifications(notifyNew = false) {
  const store = useNotifications.getState();
  const known = new Set(store.items.map((i) => i.id));
  const hadData = store.loadedAt !== null;
  if (!hadData) store.setLoading(true);
  const res = await repo.listNotifications(50);
  if (!res.ok) {
    useNotifications.getState().setError(res.error);
    return res;
  }
  useNotifications.getState().setItems(res.data);
  if (notifyNew && hadData) res.data.filter((n) => !known.has(n.id)).forEach(alertIfWanted);
  return res;
}

export async function markRead(ids: string[] | null) {
  useNotifications.getState().markReadLocal(ids);
  const res = await repo.markNotificationsRead(ids);
  if (!res.ok) void refreshNotifications();
  return res;
}

/**
 * Montado no layout raiz: enquanto há usuário logado, mantém a central atualizada pelo Realtime
 * (consulta periódica só como fallback quando o canal cai, e uma consulta ao voltar ao primeiro plano)
 * e limpa as stores do usuário anterior ao trocar de conta ou sair.
 */
export function useUserDataBootstrap() {
  const userId = useSession((s) => (s.status === 'signedIn' ? (s.session?.userId ?? null) : null));
  useEffect(() => {
    useNotifications.getState().reset();
    if (!userId) {
      useZones.getState().reset();
      return;
    }
    void refreshNotifications();
    const polling = createFallbackPolling({ refresh: () => void refreshNotifications(true), intervalMs: POLL_MS });
    const sub = repo.subscribeNotifications(
      userId,
      (n) => {
        if (useNotifications.getState().add(n)) alertIfWanted(n);
      },
      (status) => polling.onChannelStatus(status),
    );
    const app = AppState.addEventListener('change', (state) => polling.onAppState(state));
    return () => {
      polling.stop();
      app.remove();
      if (sub.ok) sub.data.unsubscribe();
    };
  }, [userId]);
}
