import { describe, expect, it, jest } from '@jest/globals';

import { createMemoryStore } from '@/services/offline/memory-store';

import { handleBackgroundLocations, splitSteps } from '../background-task';
import { accessMessage, checkLocationAccess, LOCATION_MESSAGES, requestLocationAccess, type LocationPermissionApi } from '../permissions';
import { createSignalMonitor, WEAK_SIGNAL_MS } from '../signal';
import { toFix } from '../tracker';

const perm = (status: 'granted' | 'denied' | 'undetermined', canAskAgain = true) => ({ status, granted: status === 'granted', canAskAgain, expires: 'never' as const });

function api(p: ReturnType<typeof perm>, services = true, requested = p): LocationPermissionApi {
  return {
    getForegroundPermissionsAsync: jest.fn(async () => p) as never,
    requestForegroundPermissionsAsync: jest.fn(async () => requested) as never,
    hasServicesEnabledAsync: jest.fn(async () => services) as never,
  };
}

describe('permissão e GPS (RF-004, RNF-013)', () => {
  it('concedida e GPS ligado', async () => {
    expect(await checkLocationAccess(api(perm('granted')))).toEqual({ status: 'granted' });
  });
  it('ainda não perguntado: mostra a explicação antes do pedido', async () => {
    const a = await checkLocationAccess(api(perm('undetermined')));
    expect(a).toEqual({ status: 'undetermined' });
    expect(accessMessage(a)).toBe(LOCATION_MESSAGES.explain);
  });
  it('negada com nova chance e negada de vez (Ajustes)', async () => {
    const a = await requestLocationAccess(api(perm('undetermined'), true, perm('denied', true)));
    expect(a).toEqual({ status: 'denied', canAskAgain: true });
    expect(accessMessage(a)).toMatch(/simulação/);
    const b = await checkLocationAccess(api(perm('denied', false)));
    expect(accessMessage(b)).toMatch(/Ajustes/);
  });
  it('GPS do aparelho desligado', async () => {
    const a = await checkLocationAccess(api(perm('granted'), false));
    expect(a).toEqual({ status: 'services-off' });
    expect(accessMessage(a)).toMatch(/desligado/);
  });
  it('erro do sistema vira mensagem, nunca exceção', async () => {
    const broken = { ...api(perm('granted')), getForegroundPermissionsAsync: async () => Promise.reject(new Error('boom')) } as never;
    const a = await checkLocationAccess(broken);
    expect(a.status).toBe('error');
    expect(accessMessage(a)).toBe(LOCATION_MESSAGES.error);
  });
});

describe('sinal antes de iniciar (UC-01 E3)', () => {
  it('bom assim que a precisão fica ≤ 30 m', () => {
    const m = createSignalMonitor(0);
    expect(m.feed(80, 1000)).toBe('searching');
    expect(m.feed(12, 2000)).toBe('good');
  });
  it('fraco depois de 15 s pior que 30 m (e continua podendo melhorar)', () => {
    const m = createSignalMonitor(0);
    expect(m.feed(45, 5000)).toBe('searching');
    expect(m.tick(WEAK_SIGNAL_MS)).toBe('searching');
    expect(m.tick(WEAK_SIGNAL_MS + 1)).toBe('weak');
    expect(m.feed(null, WEAK_SIGNAL_MS + 2000)).toBe('weak');
    expect(m.feed(20, WEAK_SIGNAL_MS + 3000)).toBe('good');
  });
});

describe('fix do expo-location', () => {
  it('velocidade negativa (iOS) e campos ausentes viram null; mocked preservado', () => {
    const f = toFix({ timestamp: 1000.4, mocked: true, coords: { latitude: -16.7, longitude: -49.2, accuracy: 6, speed: -1, altitude: null, altitudeAccuracy: null, heading: null } });
    expect(f).toEqual({ lat: -16.7, lng: -49.2, t: 1000, accuracy: 6, speed: null, altitude: null, mocked: true });
    const g = toFix({ timestamp: 5, coords: { latitude: 1, longitude: 2, accuracy: null, speed: 3.4, altitude: 751.2, altitudeAccuracy: null, heading: null } });
    expect(g).toMatchObject({ speed: 3.4, altitude: 751.2, accuracy: null, mocked: null });
  });
});

describe('tarefa de segundo plano (D-10)', () => {
  const loc = (t: number) => ({ timestamp: t, coords: { latitude: -16.7, longitude: -49.2, accuracy: 5, speed: 3, altitude: 750, altitudeAccuracy: null, heading: null } });

  it('reparte os passos do lote pelo tempo', () => {
    expect(splitSteps(null, [0, 1000])).toEqual([null, null]);
    expect(splitSteps(9, [0])).toEqual([9]);
    const s = splitSteps(10, [0, 1000, 2000, 3000]) as number[];
    expect(s.reduce((a, b) => a + b, 0)).toBe(10);
    expect(s[0]).toBe(0);
  });

  it('grava direto na fila da corrida em gravação e respeita a pausa', async () => {
    const store = createMemoryStore();
    await store.createRun({ id: 'r', userId: 'u', mission: 'livre', ghostPace: null, startedAt: 0, simulated: false });
    expect(await handleBackgroundLocations([loc(2000), loc(1000)], store, () => 6)).toEqual([0, 1]);
    const pts = await store.readPoints('r', 0, 10);
    expect(pts.map((p) => p.t)).toEqual([1000, 2000]);
    expect(pts.reduce((a, p) => a + (p.steps ?? 0), 0)).toBe(6);
    await store.updateRun('r', { paused: true });
    expect(await handleBackgroundLocations([loc(3000)], store, () => 1)).toEqual([]);
  });

  it('sem corrida em gravação não grava nada', async () => {
    expect(await handleBackgroundLocations([loc(1)], createMemoryStore(), () => 1)).toEqual([]);
  });
});
