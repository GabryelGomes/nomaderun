/**
 * T7.3.7 — tela `/compartilhar/semana` no modo demonstração (repositórios reais, sem rede): card da semana
 * com as mini-rotas cortadas no servidor, chaves, cópia de exportação em 1080 px, semana vazia e o botão.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */

type AnyFn = (...args: any[]) => any;
jest.setTimeout(30_000);
const mockPush = jest.fn<AnyFn>();
const mockParams: { inicio?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: () => Promise.resolve(true) }));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '/cache' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => Promise.resolve(true), shareAsync: () => Promise.resolve() }));
jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { createDemoClient, setDemoClient } from '@/services/api/demo';
import { DEMO_USER_ID } from '@/demo/world';
import { useSession } from '@/store/session-store';

import { ShareCard } from '../../card/share-card';
import { RecapButton } from '../recap-button';
import { RecapScreen } from '../recap-screen';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z');
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (() => Promise.reject(new Error('rede proibida'))) as typeof fetch;
  jest.useFakeTimers({ advanceTimers: true, now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => {
  globalThis.fetch = realFetch;
  jest.useRealTimers();
});

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((m) => m.unmount()));
});

async function mount(el: React.ReactElement): Promise<ReactTestRenderer> {
  let r: ReactTestRenderer | undefined;
  await act(async () => {
    r = create(el);
  });
  mounted.push(r!);
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((res) => setImmediate(res));
    });
  }
  return r!;
}

const byId = (r: ReactTestRenderer, id: string) => r.root.findAll((n: ReactTestInstance) => n.props.testID === id && typeof n.type !== 'string');

describe('<RecapScreen> no modo demonstração', () => {
  it('semana atual: card da semana com mini-rotas, chaves e cópia de exportação', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    useSession.setState({ session: { userId: DEMO_USER_ID } as never });
    const r = await mount(<RecapScreen />);
    expect(byId(r, 'semana-previa').length).toBeGreaterThan(0);
    const cards = r.root.findAllByType(ShareCard);
    expect(cards).toHaveLength(2); // prévia + exportação
    const model = cards[0].props.model;
    expect(model.kind).toBe('week');
    expect(model.rangeLabel).toBe('19 – 25 OUT');
    expect(model.isDemo).toBe(true);
    expect(model.routes.length).toBeGreaterThan(0);
    expect(byId(r, 'semana-parcial').length).toBeGreaterThan(0); // a semana ainda não acabou
    for (const id of ['semana-rota', 'semana-usuario', 'semana-cidade', 'semana-legenda', 'semana-fechar']) expect(byId(r, id).length).toBeGreaterThan(0);
    // desligar "Mostrar rotas" tira as mini-rotas do card
    await act(async () => {
      byId(r, 'semana-rota')[0].props.onValueChange(false);
    });
    expect(r.root.findAllByType(ShareCard)[0].props.model.routes).toHaveLength(0);
    // exportação em 1080 px de largura (unidades do SVG)
    expect(byId(r, 'semana-exportar').length).toBeGreaterThan(0);
  });

  it('semana sem corrida: estado vazio com arte e "Correr" (UX-28), a saída é só o X', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    mockParams.inicio = '2025-01-06';
    const r = await mount(<RecapScreen />);
    expect(byId(r, 'semana-vazia').length).toBeGreaterThan(0);
    expect(byId(r, 'semana-correr').length).toBeGreaterThan(0);
    expect(byId(r, 'semana-voltar')).toHaveLength(0);
    expect(byId(r, 'semana-fechar').length).toBeGreaterThan(0);
    delete mockParams.inicio;
  });

  it('<RecapButton> abre a tela da semana pedida', async () => {
    const r = await mount(<RecapButton weekStart="2026-10-19" />);
    byId(r, 'atividades-semana')[0].props.onPress();
    expect(mockPush).toHaveBeenCalledWith('/compartilhar/semana?inicio=2026-10-19');
  });
});
