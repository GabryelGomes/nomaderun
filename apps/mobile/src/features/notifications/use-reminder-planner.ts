import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { recordRunResult, refreshEngagement } from '@/features/engagement/controller';
import { getSyncEngine } from '@/services/sync/sync-service';
import { useSession } from '@/store/session-store';

import { cancelAllReminders, recordReminderOpened, replanReminders } from './reminders';

/** Recarrega o engajamento e replaneja (os lembretes falam do estado novo). */
async function refreshAndReplan() {
  await refreshEngagement(Date.now());
  await replanReminders();
}

/**
 * Planejador de lembretes locais (D-69). A E6a monta **uma vez** no `_layout` raiz: `useReminderPlanner()`.
 * Replaneja ao abrir o app (e ao voltar ao primeiro plano), quando a sincronização confirma uma corrida e quando
 * as preferências mudam; ao sair da conta, cancela os lembretes deste aparelho. Toque num lembrete abre a tela
 * certa e conta como "aberto" (a fadiga do planejador usa isso).
 */
export function useReminderPlanner(): void {
  const userId = useSession((s) => (s.status === 'signedIn' ? (s.session?.userId ?? null) : null));
  const prefs = useSession((s) => s.profile?.notificationPrefs ?? null);
  const signedOut = useSession((s) => s.status === 'signedOut');

  useEffect(() => {
    // Só quando a sessão termina de verdade (não enquanto ela é restaurada ao abrir o app).
    if (signedOut) void cancelAllReminders();
  }, [signedOut]);

  useEffect(() => {
    if (!userId) return;
    void refreshAndReplan();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAndReplan();
    });
    // Corrida confirmada pelo servidor (fim da corrida ou sincronização depois): o bloco do resumo e o plano novo.
    const unsubscribe = getSyncEngine().subscribe((_run, official) => {
      if (!official) return;
      recordRunResult(official, Date.now());
      void refreshAndReplan();
    });
    let response: { remove: () => void } | null = null;
    let alive = true;
    if (process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android') {
      void import('expo-notifications')
        .then((N) => {
          if (!alive) return;
          response = N.addNotificationResponseReceivedListener((r) => {
            const data = (r.notification.request.content.data ?? {}) as { reminderKey?: unknown; url?: unknown };
            if (typeof data.reminderKey !== 'string') return;
            void recordReminderOpened(data.reminderKey, Date.now());
            if (typeof data.url === 'string' && data.url !== '/') router.push(data.url as '/missoes' | '/recompensas');
          });
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      app.remove();
      unsubscribe();
      response?.remove();
    };
  }, [userId]);

  useEffect(() => {
    if (userId && prefs) void replanReminders();
  }, [userId, prefs]);
}
