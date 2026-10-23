/**
 * Sync de verdade do app: fila SQLite + transporte Supabase + chave do aparelho no SecureStore.
 * Escuta a volta da conexão (expo-network) e a volta do app ao primeiro plano (AppState).
 */
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { getQueueStore } from '@/services/offline/queue';
import { defaultDeviceKeyDeps, devicePlatform, loadDeviceKey, newDeviceKey, saveDeviceKey } from '@/services/signing/device-key';

import { createSyncEngine, type SyncEngine, type SyncListener } from './sync-engine';
import { createSupabaseTransport } from './transport';

let engine: SyncEngine | null = null;

/**
 * Ouvintes do sync que sobrevivem à troca do motor (T7.2.10): `enterDemo`/`exitDemo` zeram o motor com
 * `setSyncEngine(null)`, mas o espelho fila → store (`wireSyncEvents`) se liga uma vez por processo.
 * Cada motor criado aqui repassa os eventos aos ouvintes, e só enquanto for o motor atual: um envio
 * da demonstração que termina depois de sair dela não chega à conta real.
 */
const relay = new Set<SyncListener>();

function relaying(inner: SyncEngine): SyncEngine {
  const self: SyncEngine = {
    ...inner,
    subscribe: (l: SyncListener) => {
      relay.add(l);
      return () => relay.delete(l);
    },
  };
  inner.subscribe((run, official) => {
    if (engine !== self) return;
    for (const l of [...relay]) l(run, official);
  });
  return self;
}

export function getSyncEngine(): SyncEngine {
  if (!engine) {
    engine = relaying(createSyncEngine({
      store: getQueueStore(),
      transport: createSupabaseTransport(),
      platform: devicePlatform(),
      model: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || undefined,
      keys: {
        load: (userId) => loadDeviceKey(userId),
        save: (userId, key) => saveDeviceKey(userId, key),
        regenerate: async (userId) => {
          const key = newDeviceKey(defaultDeviceKeyDeps);
          await saveDeviceKey(userId, key);
          return key;
        },
      },
    }));
  }
  return engine;
}

/** Troca o motor (testes) ou o descarta (`null`, na troca de modo da demonstração). */
export function setSyncEngine(next: SyncEngine | null) {
  engine = next;
}

let watching: { remove: () => void } | null = null;

/**
 * Liga os gatilhos de sync (uma vez por processo): conexão voltou → envia tudo; app voltou ao
 * primeiro plano → envia tudo. `getUserId` lê o usuário atual na hora.
 */
export function watchConnectivity(getUserId: () => string | null | undefined): () => void {
  if (watching) return watching.remove;
  let wasOnline = true;
  const run = (force: boolean) => {
    const userId = getUserId();
    if (userId) void getSyncEngine().syncAll(userId, { force }).catch(() => undefined);
  };
  const net = Network.addNetworkStateListener((s) => {
    const online = s.isConnected !== false && s.isInternetReachable !== false;
    if (online && !wasOnline) run(true);
    wasOnline = online;
  });
  const app = AppState.addEventListener('change', (state) => {
    if (state === 'active') run(false);
  });
  watching = {
    remove: () => {
      net.remove();
      app.remove();
      watching = null;
    },
  };
  return watching.remove;
}
