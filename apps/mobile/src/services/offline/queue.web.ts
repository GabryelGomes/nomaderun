import { createMemoryStore, type MemorySnapshot } from './memory-store';
import type { QueueStore } from './types';

/**
 * No navegador o expo-sqlite exige cabeçalhos COOP/COEP e WebAssembly; a fila usa memória com
 * cópia no localStorage (gravada a cada 2 s). Suficiente para a demonstração pelo navegador.
 */
const KEY = 'nomade.queue.v1';
let store: QueueStore | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function read(): MemorySnapshot | undefined {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MemorySnapshot) : undefined;
  } catch {
    return undefined;
  }
}

export function getQueueStore(): QueueStore {
  if (!store) {
    let latest: MemorySnapshot | null = null;
    store = createMemoryStore(read(), (snap) => {
      latest = snap;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try {
          if (latest && typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(latest));
        } catch {
          // Cota cheia: segue só em memória.
        }
      }, 2000);
    });
  }
  return store;
}

export function setQueueStore(next: QueueStore | null) {
  store = next;
}
