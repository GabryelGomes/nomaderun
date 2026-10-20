import { useEffect } from 'react';
import { AppState } from 'react-native';

import * as repo from '@/services/api/notifications-repo';
import { useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';

import { prefAllows, showLocalAlert } from './local-alert';

/** Tipos que viram notificação local quando chegam com o app aberto. */
const ALERT_TYPES = new Set<repo.NotificationType>(['invasion', 'territory_lost', 'conquest', 'moderation']);
/** Consulta periódica: garante a chegada mesmo sem Realtime na tabela `notifications`. */
export const POLL_MS = 20_000;

function alertIfWanted(n: repo.AppNotification) {
  if (!ALERT_TYPES.has(n.type) || n.readAt !== null) return;
  if (!prefAllows(n, useSession.getState().profile?.notificationPrefs)) return;
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
 * Montado no layout raiz: enquanto há usuário logado, mantém a central atualizada (Realtime + consulta
 * periódica em primeiro plano) e limpa as stores do usuário anterior ao trocar de conta ou sair.
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
    const sub = repo.subscribeNotifications(userId, (n) => {
      if (useNotifications.getState().add(n)) alertIfWanted(n);
    });
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void refreshNotifications(true), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshNotifications(true);
        start();
      } else stop();
    });
    return () => {
      stop();
      app.remove();
      if (sub.ok) sub.data.unsubscribe();
    };
  }, [userId]);
}
