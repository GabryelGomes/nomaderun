import { describe, expect, it } from '@jest/globals';

import { createCadence, createStepCounter, type PedometerApi } from '../step-counter';

function fakePedometer(available: boolean, granted = true) {
  let cb: ((r: { steps: number }) => void) | null = null;
  const api = {
    isAvailableAsync: async () => available,
    getPermissionsAsync: async () => ({ granted, canAskAgain: false, status: granted ? 'granted' : 'denied', expires: 'never' }),
    requestPermissionsAsync: async () => ({ granted, canAskAgain: false, status: granted ? 'granted' : 'denied', expires: 'never' }),
    watchStepCount: (fn: (r: { steps: number }) => void) => {
      cb = fn;
      return { remove: () => (cb = null) };
    },
  } as unknown as PedometerApi;
  return { api, emit: (steps: number) => cb?.({ steps }) };
}

describe('pedômetro (RN-008)', () => {
  it('passos entre fixes a partir da contagem acumulada', async () => {
    const p = fakePedometer(true);
    const c = createStepCounter(p.api);
    expect(await c.start()).toBe(true);
    expect(c.take()).toBe(0);
    p.emit(3);
    p.emit(5);
    expect(c.take()).toBe(5);
    p.emit(8);
    expect(c.take()).toBe(3);
    expect(c.take()).toBe(0);
    c.stop();
    expect(c.take()).toBeNull();
  });

  it('sem sensor ou sem permissão: steps ausente (null)', async () => {
    const none = createStepCounter(fakePedometer(false).api);
    expect(await none.start()).toBe(false);
    expect(none.take()).toBeNull();
    const denied = createStepCounter(fakePedometer(true, false).api);
    expect(await denied.start()).toBe(false);
    expect(denied.take()).toBeNull();
  });

  it('cadência da simulação: inteiros que somam 168 por minuto', () => {
    const next = createCadence(168);
    const minute = Array.from({ length: 60 }, () => next());
    expect(minute.every((n) => Number.isInteger(n) && n >= 2 && n <= 3)).toBe(true);
    expect(minute.reduce((a, b) => a + b, 0)).toBe(168);
  });
});
