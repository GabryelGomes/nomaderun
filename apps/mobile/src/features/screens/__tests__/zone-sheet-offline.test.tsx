/**
 * F8-D (QA, Baixo): a folha da zona aberta por link sem rede usa a última cópia do mapa (D-95) com "Mostrando o
 * último salvo, há 2 h" e "Tentar de novo"; sem cópia, o aviso único (`OfflineNotice`) sem dado inventado.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */

type AnyFn = (...args: any[]) => any;
const mockParams: { id: string } = { id: '' };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
}));
const mockDetail = jest.fn<AnyFn>();
jest.mock('@/services/api/zones-repo', () => ({
  ...jest.requireActual<object>('@/services/api/zones-repo'),
  fetchZoneDetail: (...a: unknown[]) => mockDetail(...a),
}));
jest.mock('@/services/api/paint-repo', () => ({ fetchPaintNear: async () => ({ ok: true, data: { available: false } }) }));
jest.mock('@/services/api/zones-cache', () => ({ readCachedZones: async () => null, writeCachedZones: async () => undefined }));

/* eslint-disable import/first */
import { render, type Rendered } from '@/components/__tests__/render-helpers';
import { DEMO_CENTER } from '@/demo/demo-data';
import { zoneOf } from '@/domain/grid';
import { emptyInfluence, newZone, type Zone } from '@/domain/territory';
import { AppError, fail } from '@/services/api/errors';
import { setZonesApi, useZones } from '@/store/zones-store';

import { ZoneSheet } from '../zone-sheet';
/* eslint-enable import/first */

const ID = zoneOf(DEMO_CENTER);
const HOUR = 3_600_000;
const owned = (owner: Zone['owner']): Zone => ({ ...newZone(ID), owner, influence: { ...emptyInfluence(), ...(owner ? { [owner]: 100 } : {}) } });

const mounted: Rendered[] = [];
const show = async () => {
  const r = render(<ZoneSheet />);
  mounted.push(r);
  // a leitura da cópia e a resposta (falha) do servidor
  await act(async () => undefined);
  await act(async () => undefined);
  return r;
};

beforeEach(() => {
  mockParams.id = ID;
  act(() => useZones.getState().reset());
  mockDetail.mockImplementation(async () => fail(new AppError('NETWORK', 'Sem conexão.')));
});

afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.renderer.unmount()));
  setZonesApi(null);
});

describe('folha da zona aberta por link sem rede', () => {
  it('com a cópia do mapa: mostra a zona salva e "Mostrando o último salvo, há 2 h" com "Tentar de novo"', async () => {
    setZonesApi({ readCache: async () => ({ savedAt: Date.now() - 2 * HOUR, zones: { [ID]: owned('volt') }, meta: { [ID]: { name: 'Parque Flamboyant', city: null } } }) });
    const r = await show();
    expect(r.has('tela-zona')).toBe(true);
    expect(r.has('zona-offline')).toBe(true);
    expect(r.host('zona-offline-detalhe').props.children).toBe('Mostrando o último salvo, há 2 h.');
    expect(r.text()).toContain('Sem internet');
    expect(r.text()).toContain('Parque Flamboyant');
    expect(r.has('zona-offline-tentar')).toBe(true);
    mockDetail.mockClear();
    act(() => r.press('zona-offline-tentar'));
    await act(async () => undefined);
    expect(mockDetail).toHaveBeenCalledTimes(1);
  });

  it('sem cópia: o aviso único sem dado ("Os números aparecem…"), com "Tentar de novo"; nunca uma zona inventada', async () => {
    const r = await show();
    expect(r.has('tela-zona')).toBe(false);
    expect(r.has('zona-sem-dado')).toBe(true);
    expect(r.host('zona-offline-detalhe').props.children).toBe('Os números aparecem quando a conexão voltar.');
    expect(r.has('zona-offline-tentar')).toBe(true);
    expect(r.text()).not.toMatch(/Ninguém correu aqui/);
  });

  it('servidor fora do ar com a cópia: "Servidor fora do ar" (não "Sem internet")', async () => {
    mockDetail.mockImplementation(async () => fail(new AppError('SERVER', 'Erro 503.')));
    setZonesApi({ readCache: async () => ({ savedAt: Date.now() - 2 * HOUR, zones: { [ID]: owned('owls') }, meta: {} }) });
    const r = await show();
    expect(r.has('tela-zona')).toBe(true);
    expect(r.text()).toContain('Servidor fora do ar');
    expect(r.text()).not.toContain('Erro 503');
  });
});
