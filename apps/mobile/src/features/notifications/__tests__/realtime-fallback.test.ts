import { describe, expect, it, jest } from '@jest/globals';

import { createFallbackPolling, type Timers } from '../realtime-fallback';

/** Timers controlados: `tick()` dispara o intervalo ligado, se houver. */
function fakeTimers() {
  let fn: (() => void) | null = null;
  let created = 0;
  const timers: Timers = {
    setInterval: (f) => {
      fn = f;
      created += 1;
      return created;
    },
    clearInterval: () => {
      fn = null;
    },
  };
  return { timers, tick: () => fn?.(), active: () => fn !== null, created: () => created };
}

describe('central de notificações: Realtime com consulta só de fallback (P-24)', () => {
  it('consulta enquanto o canal conecta e para quando fica SUBSCRIBED (com 1 consulta de recuperação)', () => {
    const t = fakeTimers();
    const refresh = jest.fn();
    const p = createFallbackPolling({ refresh, intervalMs: 20_000, timers: t.timers });
    expect(p.isPolling()).toBe(true);
    t.tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    p.onChannelStatus('SUBSCRIBED');
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(p.isPolling()).toBe(false);
    t.tick();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('Realtime caiu → volta a consultar; voltou → recupera e para', () => {
    const t = fakeTimers();
    const refresh = jest.fn();
    const p = createFallbackPolling({ refresh, intervalMs: 20_000, timers: t.timers });
    p.onChannelStatus('SUBSCRIBED');
    refresh.mockClear();
    for (const s of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      p.onChannelStatus(s);
      expect(p.isPolling()).toBe(true);
      t.tick();
      p.onChannelStatus('SUBSCRIBED');
      expect(p.isPolling()).toBe(false);
    }
    // por queda: 1 consulta do intervalo + 1 de recuperação
    expect(refresh).toHaveBeenCalledTimes(6);
    // SUBSCRIBED repetido não consulta de novo
    p.onChannelStatus('SUBSCRIBED');
    expect(refresh).toHaveBeenCalledTimes(6);
  });

  it('segundo plano desliga tudo; ao voltar consulta 1× e só religa o intervalo se o canal estiver fora', () => {
    const t = fakeTimers();
    const refresh = jest.fn();
    const p = createFallbackPolling({ refresh, intervalMs: 20_000, timers: t.timers });
    p.onChannelStatus('CHANNEL_ERROR');
    p.onAppState('background');
    expect(p.isPolling()).toBe(false);
    p.onAppState('active');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(p.isPolling()).toBe(true);
    p.onChannelStatus('SUBSCRIBED');
    p.onAppState('inactive');
    p.onAppState('active');
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(p.isPolling()).toBe(false);
  });

  it('stop desliga e ignora eventos depois', () => {
    const t = fakeTimers();
    const refresh = jest.fn();
    const p = createFallbackPolling({ refresh, intervalMs: 20_000, timers: t.timers });
    p.stop();
    expect(t.active()).toBe(false);
    p.onChannelStatus('CLOSED');
    p.onAppState('active');
    expect(t.active()).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
