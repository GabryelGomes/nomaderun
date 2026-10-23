import * as SQLite from 'expo-sqlite';

import { isDemoMode } from '@/services/api/env';

import { createSqliteStore, type SqlDb } from './sqlite-store';
import type { QueueStore } from './types';

export const QUEUE_DB_NAME = 'nomade-queue.db';
/** Modo demonstração (D-77): outro arquivo, para uma corrida de demonstração nunca ir ao servidor real. */
export const DEMO_QUEUE_DB_NAME = 'nomade-queue.demo.db';

export const queueDbName = (demo = isDemoMode()) => (demo ? DEMO_QUEUE_DB_NAME : QUEUE_DB_NAME);

let store: QueueStore | null = null;

/** Fila única do app (iOS/Android: SQLite). */
export function getQueueStore(): QueueStore {
  if (!store) store = createSqliteStore(async () => (await SQLite.openDatabaseAsync(queueDbName())) as unknown as SqlDb);
  return store;
}

/** Só para testes. */
export function setQueueStore(next: QueueStore | null) {
  store = next;
}
