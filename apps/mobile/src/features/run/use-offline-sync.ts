/**
 * Montado uma vez no layout raiz (pedido ao A3): define a tarefa de GPS em segundo plano, liga o
 * espelho da fila, recupera corridas interrompidas e sincroniza ao abrir o app, ao voltar a
 * conexão e ao voltar ao primeiro plano (RF-005). Também carrega neblina, baús, contatos e
 * progresso do servidor para o usuário logado. Não renderiza nada.
 */
import { useEffect } from 'react';

import '@/services/location/background-task';
import { watchConnectivity, getSyncEngine } from '@/services/sync/sync-service';
import { useSession } from '@/store/session-store';

import { activeRunId } from './active-run';
import { loadChests, loadFog, loadPlayerProgress, loadSafetyContacts, recoverInterrupted, refreshLocalRuns, wireSyncEvents } from './run-controller';

let bootedFor: string | null = null;

export async function bootstrapOfflineSync(userId: string) {
  wireSyncEvents();
  watchConnectivity(() => useSession.getState().session?.userId);
  if (bootedFor === userId) return;
  bootedFor = userId;
  try {
    await recoverInterrupted(userId, activeRunId());
    await refreshLocalRuns(userId);
  } catch {
    // Fila indisponível (ex.: web sem armazenamento): segue sem histórico local.
  }
  void getSyncEngine()
    .syncAll(userId, { force: true })
    .catch(() => undefined);
  void Promise.allSettled([loadPlayerProgress(userId), loadFog(), loadChests(), loadSafetyContacts()]);
}

export function useOfflineSync() {
  const userId = useSession((s) => (s.profile?.faction ? s.session?.userId : null));
  useEffect(() => {
    if (userId) void bootstrapOfflineSync(userId);
    else bootedFor = null;
  }, [userId]);
}
