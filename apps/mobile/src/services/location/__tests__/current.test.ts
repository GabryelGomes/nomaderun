import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-location', () => ({ Accuracy: { Balanced: 3 } }));

/* eslint-disable import/first */
import { currentPosition, type CurrentPositionApi } from '../current';
/* eslint-enable import/first */

const pos = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } });
/**
 * Prazo curto do GPS nos testes que esperam o prazo vencer. Antes da T7.2.10 o `currentPosition` deixava o
 * temporizador do `Promise.race` armado até o fim do prazo (8 s) mesmo com o GPS respondendo antes, e o worker
 * do Jest era encerrado à força (T7.1.19). Hoje o prazo é cancelado: ver o último teste.
 */
const FAST_TIMEOUT_MS = 20;

function api(over: Partial<Record<keyof CurrentPositionApi, unknown>> = {}): CurrentPositionApi {
  return {
    hasServicesEnabledAsync: async () => true,
    getForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true, canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true, canAskAgain: true }),
    getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async () => pos(-15.8, -47.9),
    ...over,
  } as unknown as CurrentPositionApi;
}

describe('currentPosition — centro do mapa na posição real', () => {
  it('usa a última posição conhecida quando existe', async () => {
    expect(await currentPosition(api({ getLastKnownPositionAsync: async () => pos(-23.55, -46.63) }))).toEqual({ lat: -23.55, lng: -46.63 });
  });

  it('sem posição recente, pede uma nova', async () => {
    expect(await currentPosition(api(), FAST_TIMEOUT_MS)).toEqual({ lat: -15.8, lng: -47.9 });
  });

  it('sem permissão ou com GPS desligado, devolve null (mapa de demonstração)', async () => {
    expect(await currentPosition(api({ getForegroundPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: true }) }))).toBeNull();
    expect(await currentPosition(api({ hasServicesEnabledAsync: async () => false }))).toBeNull();
  });

  it('GPS que não responde a tempo ou falha devolve null', async () => {
    expect(await currentPosition(api({ getCurrentPositionAsync: () => new Promise(() => undefined) }), FAST_TIMEOUT_MS)).toBeNull();
    expect(await currentPosition(api({ getCurrentPositionAsync: async () => Promise.reject(new Error('x')) }), FAST_TIMEOUT_MS)).toBeNull();
  });

  it('não deixa o temporizador do prazo armado quando o GPS responde ou falha (prazo padrão de 8 s)', async () => {
    jest.useFakeTimers();
    try {
      expect(await currentPosition(api())).toEqual({ lat: -15.8, lng: -47.9 });
      expect(jest.getTimerCount()).toBe(0);
      expect(await currentPosition(api({ getCurrentPositionAsync: async () => Promise.reject(new Error('x')) }))).toBeNull();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
