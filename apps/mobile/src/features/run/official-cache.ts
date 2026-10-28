/**
 * Resposta oficial **crua** do servidor (com `extras`) das corridas confirmadas nesta sessão (T7.3.2, E6b).
 *
 * O resumo guarda só o `RunSummary` (sem `extras`), mas o bloco "Recompensas" (E7) e o card de compartilhar
 * (E8) precisam do `extras.engagement` e do `extras.raid`. Só memória, poucas corridas: nada sai do aparelho.
 */
import { useCallback, useSyncExternalStore } from 'react';

const MAX_KEPT = 10;
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();

export function rememberOfficial(id: string, official: unknown) {
  if (!id || !official || typeof official !== 'object') return;
  cache.delete(id);
  cache.set(id, official);
  while (cache.size > MAX_KEPT) cache.delete(cache.keys().next().value as string);
  for (const l of listeners) l();
}

export function officialFor(id: string | undefined): unknown {
  return id ? (cache.get(id) ?? null) : null;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** A resposta oficial crua da corrida `id` (ou `null`), atualizada quando o sync confirmar. */
export function useRawOfficial(id: string | undefined): unknown {
  const read = useCallback(() => officialFor(id), [id]);
  return useSyncExternalStore(subscribe, read, read);
}
