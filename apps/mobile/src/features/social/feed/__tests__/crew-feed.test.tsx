/**
 * `<CrewFeed>` sobre o servidor de demonstração (repositório real, sem rede): 6 corridas da crew, "Bora!"
 * otimista, item próprio só leitura e os estados sem crew, indisponível e erro.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { createDemoClient, setDemoClient } from '@/services/api/demo';
import * as feedRepo from '@/services/api/feed-repo';
import { AppError } from '@/services/api/errors';

import { CrewFeed } from '../crew-feed';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z');
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (() => Promise.reject(new Error('rede proibida'))) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

async function mount(el: React.ReactElement): Promise<ReactTestRenderer> {
  let r: ReactTestRenderer | undefined;
  await act(async () => {
    r = create(el);
  });
  // A resposta do servidor de demonstração chega no microtask seguinte.
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r!;
}

const byId = (r: ReactTestRenderer, id: string) => r.root.findAll((n: ReactTestInstance) => n.props.testID === id && typeof n.type !== 'string');
const allText = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => typeof n.props.children === 'string' || Array.isArray(n.props.children))
    .map((n) => [n.props.children].flat().filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join(''))
    .join('|');

describe('<CrewFeed> no modo demonstração', () => {
  it('6 corridas; o item próprio só mostra os contadores; "Bora!" soma na hora', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    const r = await mount(<CrewFeed faction="striders" />);
    const cards = r.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('feed-item-') && typeof n.type !== 'string');
    expect(cards).toHaveLength(6);
    expect(allText(r)).toContain('Você');
    expect(allText(r)).toContain('Demonstração');

    const mine = cards.find((c) => allText({ root: c } as unknown as ReactTestRenderer).includes('Você'))!;
    const mineId = String(mine.props.testID).replace('feed-item-', '');
    expect(byId(r, `feed-${mineId}-bora`)).toHaveLength(0); // ninguém aplaude a si mesmo

    const mateId = 'feed-demo-colega-1';
    const bora = byId(r, `feed-${mateId}-bora`)[0];
    expect(bora).toBeDefined();
    const before = String(bora.props.accessibilityLabel);
    await act(async () => {
      bora.props.onPress();
      await new Promise((res) => setTimeout(res, 0));
    });
    const after = String(byId(r, `feed-${mateId}-bora`)[0].props.accessibilityLabel);
    const n = (s: string) => Number(/(\d+)$/.exec(s)?.[1] ?? 0);
    expect(n(after)).toBe(n(before) + 1);
    expect(byId(r, `feed-${mateId}-bora`)[0].props.accessibilityState).toEqual({ selected: true });
  });

  it('sem crew: arte + "Entrar com código" / "Criar crew"', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'vazio' }));
    const join = jest.fn();
    const r = await mount(<CrewFeed onJoinCrew={join} onCreateCrew={() => undefined} />);
    expect(byId(r, 'feed-crew-sem-crew').length).toBeGreaterThan(0);
    byId(r, 'feed-crew-entrar')[0].props.onPress();
    expect(join).toHaveBeenCalled();
    expect(byId(r, 'feed-crew-criar').length).toBeGreaterThan(0);
  });

  it('servidor antigo / feed desligado: "Feed indisponível"', async () => {
    const spy = jest.spyOn(feedRepo, 'listCrewFeed').mockResolvedValue({ ok: false, error: new AppError('SERVER', 'x', { detail: feedRepo.FEED_UNAVAILABLE }) });
    const r = await mount(<CrewFeed />);
    expect(byId(r, 'feed-crew-indisponivel').length).toBeGreaterThan(0);
    expect(allText(r)).toContain('Feed indisponível');
    spy.mockRestore();
  });

  it('sem conexão e nada carregado: erro com "Tentar de novo"', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'offline' }));
    const r = await mount(<CrewFeed />);
    expect(byId(r, 'feed-crew-erro').length).toBeGreaterThan(0);
    expect(byId(r, 'feed-crew-tentar').length).toBeGreaterThan(0);
  });
});
