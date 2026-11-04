import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppError, Result } from '@/services/api/errors';

type State<T> = { key: string | null; data: T | null; error: AppError | null; at: number | null };

/**
 * Carrega um recurso do servidor com estados de carregamento, erro e recarga. `deps` são valores
 * simples (ids, filtros): quando mudam, carrega de novo. Uma recarga que falha mantém o último dado
 * bom (sem internet, o usuário continua vendo o que já tinha), com a hora dele em `savedAt` (D-95).
 */
export function useResource<T>(load: () => Promise<Result<T>>, deps: readonly unknown[] = []) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<State<T>>({ key: null, data: null, error: null, at: null });
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  const seq = useRef(0);
  useEffect(() => {
    loadRef.current = load;
  });

  const fetchFor = useCallback(async (k: string) => {
    const my = ++seq.current;
    const res = await loadRef.current();
    if (my === seq.current) {
      // `at`: hora do último dado bom (D-95: "último salvo há 2 h" quando a recarga falha).
      const at = Date.now();
      setState((s) => (res.ok ? { key: k, data: res.data, error: null, at } : { key: k, data: s.key === k ? s.data : null, error: res.error, at: s.key === k ? s.at : null }));
    }
    return res;
  }, []);

  useEffect(() => {
    void fetchFor(key);
  }, [key, fetchFor]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    const res = await fetchFor(key);
    setRefreshing(false);
    return res;
  }, [fetchFor, key]);

  const setData = useCallback((update: (cur: T | null) => T | null) => setState((s) => ({ ...s, data: update(s.data) })), []);

  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, savedAt: current ? state.at : null, loading: !current || refreshing, reload, setData };
}
