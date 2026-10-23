/**
 * Realtime de demonstração: `channel().on('postgres_changes', ...).subscribe()` e `removeChannel`, para os
 * 2 canais do app (`notifications` do próprio usuário e `zones`). As mudanças vêm do banco de demonstração
 * (`DemoDb.emit`), por exemplo a zona conquistada pelo `finish-activity` e a notificação de conquista.
 */
import type { DemoDb, Row } from './db';

type ChangeFilter = { event: string; schema: string; table: string; filter?: string };
type Handler = { filter: ChangeFilter; callback: (payload: { eventType: string; new: Row; old: Row; table: string; schema: string }) => void };

export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export class DemoChannel {
  private handlers: Handler[] = [];
  private off: (() => void) | null = null;
  private statusCb: ((status: ChannelStatus) => void) | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    readonly topic: string,
    private readonly db: DemoDb,
    private readonly opts: { failing: boolean; onSubscribed?: (ch: DemoChannel) => void },
  ) {}

  on(type: string, filter: ChangeFilter, callback: Handler['callback']) {
    if (type === 'postgres_changes') this.handlers.push({ filter, callback });
    return this;
  }

  subscribe(cb?: (status: ChannelStatus) => void) {
    this.statusCb = cb ?? null;
    if (this.opts.failing) {
      void Promise.resolve().then(() => this.statusCb?.('CHANNEL_ERROR'));
      return this;
    }
    this.off = this.db.onChange((table, event, row) => {
      for (const h of this.handlers) {
        if (h.filter.table !== table) continue;
        if (h.filter.event !== '*' && h.filter.event !== event) continue;
        const m = h.filter.filter ? /^(\w+)=eq\.(.+)$/.exec(h.filter.filter) : null;
        if (m && String(row[m[1]]) !== m[2]) continue;
        h.callback({ eventType: event, new: { ...row }, old: {}, table, schema: 'public' });
      }
    });
    void Promise.resolve().then(() => {
      if (!this.off) return;
      this.statusCb?.('SUBSCRIBED');
      this.opts.onSubscribed?.(this);
    });
    return this;
  }

  /** Agenda algo para depois (roteiro "sob ataque"); cancelado ao remover o canal. */
  later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  unsubscribe() {
    this.off?.();
    this.off = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.statusCb?.('CLOSED');
    this.statusCb = null;
    return Promise.resolve('ok' as const);
  }
}
