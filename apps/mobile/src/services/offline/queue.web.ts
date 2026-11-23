import { isDemoMode } from '@/services/api/env';

import { createMemoryStore, type MemorySnapshot } from './memory-store';
import type { QueueStore } from './types';

/**
 * No navegador o expo-sqlite exige cabeçalhos COOP/COEP e WebAssembly; a fila usa memória com
 * cópia no localStorage (gravada a cada 2 s). Suficiente para a demonstração pelo navegador.
 */
const KEY = 'nomade.queue.v1';
/**
 * Modo demonstração (D-77): a fila nunca lê a fila real gravada por uma conta de verdade neste navegador. Fica na
 * memória com cópia no `sessionStorage` da aba (some ao fechar a aba): recarregar a página ou trocar o
 * `?cenario=` não apaga a corrida feita sem internet (5ª bateria: "corrida offline não aparece no histórico").
 */
export const DEMO_QUEUE_KEY = 'nomade.demo.queue.v1';
export const queueKey = (demo = isDemoMode()) => (demo ? DEMO_QUEUE_KEY : KEY);

let store: QueueStore | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function storageOf(demo: boolean): Storage | null {
  try {
    if (demo) return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(demo: boolean): MemorySnapshot | undefined {
  try {
    const raw = storageOf(demo)?.getItem(queueKey(demo)) ?? null;
    return raw ? (JSON.parse(raw) as MemorySnapshot) : undefined;
  } catch {
    return undefined;
  }
}

export function getQueueStore(): QueueStore {
  if (!store) {
    const demo = isDemoMode();
    let latest: MemorySnapshot | null = null;
    store = createMemoryStore(read(demo), (snap) => {
      latest = snap;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try {
          if (latest) storageOf(demo)?.setItem(queueKey(demo), JSON.stringify(latest));
        } catch {
          // Cota cheia: segue só em memória.
        }
      }, demo ? 300 : 2000);
    });
  }
  return store;
}

export function setQueueStore(next: QueueStore | null) {
  store = next;
}
