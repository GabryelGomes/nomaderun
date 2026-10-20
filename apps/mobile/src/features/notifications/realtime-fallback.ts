/**
 * P-24 (D-29, D-45): a central recebe as notificações pelo Realtime da tabela `notifications`.
 * A consulta periódica vira só fallback: roda enquanto o canal não está `SUBSCRIBED` (Realtime caiu,
 * ainda conectando ou com erro) e para quando ele volta. Ao (re)conectar e ao voltar ao primeiro plano
 * faz uma consulta única para recuperar o que chegou enquanto o canal estava fora.
 * Sem React nem supabase-js para poder ser testado com timers falsos.
 */
export type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | (string & {});

export type FallbackPolling = {
  /** Status do canal Realtime (callback do `subscribe`). */
  onChannelStatus: (status: ChannelStatus) => void;
  /** Estado do app (`AppState`): em segundo plano nada roda. */
  onAppState: (state: string) => void;
  /** true enquanto a consulta periódica está ligada (para testes e diagnóstico). */
  isPolling: () => boolean;
  stop: () => void;
};

export type Timers = {
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
};

const defaultTimers: Timers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
};

export function createFallbackPolling(opts: { refresh: () => void; intervalMs: number; timers?: Timers }): FallbackPolling {
  const timers = opts.timers ?? defaultTimers;
  let status: ChannelStatus = 'CONNECTING';
  let foreground = true;
  let timer: unknown = null;
  let stopped = false;

  const sync = () => {
    const want = !stopped && foreground && status !== 'SUBSCRIBED';
    if (want && timer === null) timer = timers.setInterval(opts.refresh, opts.intervalMs);
    if (!want && timer !== null) {
      timers.clearInterval(timer);
      timer = null;
    }
  };

  // Começa consultando: até o canal confirmar, a central não fica sem atualização.
  sync();

  return {
    onChannelStatus(next) {
      if (stopped) return;
      const was = status;
      status = next;
      // Voltou (ou chegou pela primeira vez): recupera o que pode ter chegado enquanto estava fora.
      if (next === 'SUBSCRIBED' && was !== 'SUBSCRIBED' && foreground) opts.refresh();
      sync();
    },
    onAppState(state) {
      if (stopped) return;
      const active = state === 'active';
      if (active && !foreground) opts.refresh();
      foreground = active;
      sync();
    },
    isPolling: () => timer !== null,
    stop() {
      stopped = true;
      sync();
    },
  };
}
