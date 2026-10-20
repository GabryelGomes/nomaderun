import * as SQLite from 'expo-sqlite';

import { createSqliteStore, type SqlDb } from './sqlite-store';
import type { QueueStore } from './types';

export const QUEUE_DB_NAME = 'nomade-queue.db';

let store: QueueStore | null = null;

/** Fila única do app (iOS/Android: SQLite). */
export function getQueueStore(): QueueStore {
  if (!store) store = createSqliteStore(async () => (await SQLite.openDatabaseAsync(QUEUE_DB_NAME)) as unknown as SqlDb);
  return store;
}

/** Só para testes. */
export function setQueueStore(next: QueueStore | null) {
  store = next;
}
