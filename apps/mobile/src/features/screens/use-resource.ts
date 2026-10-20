import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppError, Result } from '@/services/api/errors';

type State<T> = { key: string | null; data: T | null; error: AppError | null };

/**
 * Carrega um recurso do servidor com estados de carregamento, erro e recarga. `deps` são valores
 * simples (ids, filtros): quando mudam, carrega de novo. Uma recarga que falha mantém o último dado
 * bom (sem internet, o usuário continua vendo o que já tinha).
 */
export function useResource<T>(load: () => Promise<Result<T>>, deps: readonly unknown[] = []) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<State<T>>({ key: null, data: null, error: null });
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
      setState((s) => (res.ok ? { key: k, data: res.data, error: null } : { key: k, data: s.key === k ? s.data : null, error: res.error }));
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
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !current || refreshing, reload, setData };
}
