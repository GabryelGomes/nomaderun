/**
 * T7.2.5 — estado do feed da crew: 1ª página, "ver mais", recarregar e reação otimista (desfeita se o
 * servidor recusar). Erros:
 *  - `unavailable`: servidor antigo ou flag desligada (PGRST202 / FEATURE_DISABLED);
 *  - `noCrew`: a pessoa não está em crew;
 *  - `error`: rede ou servidor; a última página carregada continua na tela.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteFeedItem, isFeedUnavailable, listCrewFeed, reactToFeedItem, type FeedCrew, type FeedItem, type FeedReaction } from '@/services/api/feed-repo';

import { toggleReaction } from './feed-model';

export type CrewFeedStatus = 'loading' | 'ready' | 'noCrew' | 'unavailable' | 'error';

export type CrewFeedState = {
  status: CrewFeedStatus;
  crew: FeedCrew | null;
  items: FeedItem[];
  /** Há mais itens no servidor. */
  hasMore: boolean;
  loadingMore: boolean;
  /** Mensagem do último erro (rede, limite de reações). */
  error: string | null;
};

const INITIAL: CrewFeedState = { status: 'loading', crew: null, items: [], hasMore: false, loadingMore: false, error: null };

export function useCrewFeed(opts: { pageSize?: number } = {}) {
  const [state, setState] = useState<CrewFeedState>(INITIAL);
  const cursor = useRef<string | null>(null);
  const alive = useRef(true);
  const pageSize = opts.pageSize;

  const apply = useCallback((res: Awaited<ReturnType<typeof listCrewFeed>>) => {
    if (!alive.current) return;
    if (!res.ok) {
      setState((s) => ({
        ...s,
        status: isFeedUnavailable(res.error) ? 'unavailable' : s.items.length ? 'ready' : 'error',
        loadingMore: false,
        error: res.error.message,
      }));
      return;
    }
    cursor.current = res.data.next;
    setState({
      status: res.data.crew ? 'ready' : 'noCrew',
      crew: res.data.crew,
      items: res.data.items,
      hasMore: res.data.next !== null,
      loadingMore: false,
      error: null,
    });
  }, []);

  const load = useCallback(() => listCrewFeed({ limit: pageSize }).then(apply), [pageSize, apply]);

  useEffect(() => {
    alive.current = true;
    void listCrewFeed({ limit: pageSize }).then(apply);
    return () => {
      alive.current = false;
    };
  }, [pageSize, apply]);

  const loadMore = useCallback(async () => {
    if (!cursor.current) return;
    setState((s) => (s.loadingMore ? s : { ...s, loadingMore: true }));
    const res = await listCrewFeed({ before: cursor.current, limit: pageSize });
    if (!alive.current) return;
    if (!res.ok) {
      setState((s) => ({ ...s, loadingMore: false, error: res.error.message }));
      return;
    }
    cursor.current = res.data.next;
    setState((s) => {
      const seen = new Set(s.items.map((i) => i.id));
      return { ...s, items: [...s.items, ...res.data.items.filter((i) => !seen.has(i.id))], hasMore: res.data.next !== null, loadingMore: false };
    });
  }, [pageSize]);

  // Última versão do estado, para a reação otimista ler o item fora do render.
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);

  const react = useCallback(async (itemId: string, reaction: FeedReaction) => {
    const before = current.current.items.find((i) => i.id === itemId);
    if (!before || before.you) return; // ninguém reage a si mesmo (KUDOS_SELF)
    const optimistic = toggleReaction(before, reaction);
    const patch = (fields: Pick<FeedItem, 'kudos' | 'myReaction'>, error: string | null) =>
      setState((s) => ({ ...s, error, items: s.items.map((i) => (i.id === itemId ? { ...i, ...fields } : i)) }));
    patch(optimistic, null);
    const res = await reactToFeedItem(itemId, optimistic.myReaction);
    if (!alive.current) return;
    if (res.ok) patch({ kudos: res.data.kudos, myReaction: res.data.myReaction }, null);
    else patch({ kudos: before.kudos, myReaction: before.myReaction }, res.error.message);
  }, []);

  /** Tira a própria corrida do feed (some da lista na hora; volta se o servidor recusar). */
  const remove = useCallback(async (itemId: string) => {
    const before = current.current.items;
    const item = before.find((i) => i.id === itemId);
    if (!item?.you) return;
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }));
    const res = await deleteFeedItem(itemId);
    if (!alive.current) return;
    if (!res.ok || !res.data) setState((s) => ({ ...s, items: before, error: res.ok ? 'Não deu para tirar do feed.' : res.error.message }));
  }, []);

  return { ...state, reload: load, loadMore, react, remove };
}
