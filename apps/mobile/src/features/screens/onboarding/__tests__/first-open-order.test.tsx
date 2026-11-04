/**
 * F8 B1 (D-91, D-93) — a ordem nova da primeira abertura:
 *  - escolha do time com as capas, antes da conta: 2 toques até a cerimônia, zero digitação; o quiz sugere e marca,
 *    com os 4 cards à vista; a cerimônia é pulável e termina em "Continuar" com "Seu rastro agora é <cor>";
 *  - depois do cadastro, o onboarding grava o time pendente (`choose_faction`) e vai direto ao GPS; se gravar
 *    falhar, a pessoa escolhe de novo ali mesmo, com o erro; sem time pendente, cai na cidade dividida (reserva).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  Stack: { Screen: () => null },
}));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: async () => ({ status: 'granted' }) }));
jest.mock('@/services/api/leaderboard-repo', () => ({ getFactionRanking: async () => ({ ok: false, error: new Error('offline') }) }));
const mockStore = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (name: string) => mockStore.get(name) ?? null,
  writeLocal: async (name: string, value: unknown) => {
    if (value === null || value === undefined) mockStore.delete(name);
    else mockStore.set(name, value);
  },
}));
// D-96: o selo "Precisa de reforço" vem de 1 leitura (mockada) compartilhada pelos 4 cards.
jest.mock('@/features/engagement/team-boost', () => ({
  ...jest.requireActual<object>('@/features/engagement/team-boost'),
  useFactionBoost: () => ({ needsBoost: 'coyotes', isDemo: true }),
}));
const mockChoose = jest.fn<(f: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>>();
jest.mock('@/features/auth/session-controller', () => ({ chooseFaction: (f: string) => mockChoose(f), saveProfile: jest.fn() }));

/* eslint-disable import/first */
import { act } from 'react-test-renderer';

import { render } from '@/components/__tests__/render-helpers';
import { usePendingTeam } from '@/features/auth/pending-team';
import { useOnboardingFlow } from '@/features/auth/onboarding-flow';
import { useSession } from '@/store/session-store';
import { useMotionPrefs } from '@/store/motion-prefs-store';

import { OnboardingScreen } from '../onboarding-screen';
import { TeamChoiceScreen } from '../team-choice';
import { TeamChoiceAuthScreen } from '../team-choice-auth-screen';
/* eslint-enable import/first */

/** Espera as promessas e a medida do botão (250 ms de teto, `team-choice.tsx`). */
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  usePendingTeam.setState({ team: null, hydrated: false });
  useOnboardingFlow.getState().reset();
  useSession.getState().reset();
  useMotionPrefs.setState({ skipCelebrations: false } as never);
});

describe('escolha do time antes da conta (D-91)', () => {
  it('2 toques até a cerimônia, que termina em "Seu rastro agora é verde" + moldura Recruta e "Continuar"', async () => {
    const onContinue = jest.fn(async () => null);
    const r = render(<TeamChoiceScreen onContinue={onContinue} />);
    expect(r.text()).toContain('Escolha seu time');
    expect(r.text()).toContain('Dá para trocar 1 vez por temporada.');
    // 4 capas à vista, nenhuma marcada; o botão espera a escolha
    for (const f of ['striders', 'coyotes', 'owls', 'volt']) expect(r.host(`onboarding-times-${f}`).props.accessibilityState).toMatchObject({ checked: false });
    expect(r.text()).toContain('Toque no seu time');
    // D-96: selo só no time com menos ativos, marcado como demonstração e lido no rótulo do card
    expect(r.has('selo-reforco-coyotes')).toBe(true);
    expect(r.has('selo-reforco-volt')).toBe(false);
    expect(r.host('onboarding-times-coyotes').props.accessibilityLabel).toContain('Precisa de reforço');
    expect(r.text()).toContain('Precisa de reforço · demonstração');

    r.press('onboarding-times-volt'); // toque 1
    expect(r.host('onboarding-times-volt').props.accessibilityState).toMatchObject({ checked: true });
    expect(r.text()).toContain('Entrar para os Volt Runners');
    r.press('onboarding-entrar-time'); // toque 2
    await flush();
    expect(r.has('onboarding-confirmacao')).toBe(true);
    expect(r.text()).toContain('Seu rastro agora é verde');
    expect(r.text()).toContain('Moldura Recruta');
    expect(r.text()).toContain('Continuar');
    // pulável: um toque fora do botão leva ao estado final
    r.press('onboarding-confirmacao-pular');
    r.press('onboarding-confirmacao-continuar');
    await flush();
    expect(onContinue).toHaveBeenCalledWith('volt');
    // a moldura Recruta ficou liberada no aparelho
    expect(mockStore.get('cosmetics-local')).toEqual(['moldura-recruta']);
  });

  it('o quiz sugere e marca; os 4 continuam à vista e a pessoa pode trocar', async () => {
    const r = render(<TeamChoiceScreen onContinue={async () => null} />);
    r.press('onboarding-nao-sei');
    r.press('onboarding-quiz-corrida-owls');
    r.press('onboarding-quiz-fim-owls');
    r.press('onboarding-quiz-superpoder-volt');
    expect(r.text()).toContain('Combina com você: Night Owls');
    r.press('onboarding-quiz-ver');
    expect(r.host('onboarding-times-owls').props.accessibilityState).toMatchObject({ checked: true });
    expect(r.host('onboarding-times-owls').props.accessibilityLabel).toContain('Combina com você');
    for (const f of ['striders', 'coyotes', 'volt']) expect(r.has(`onboarding-times-${f}`)).toBe(true);
    r.press('onboarding-times-coyotes');
    expect(r.host('onboarding-times-coyotes').props.accessibilityState).toMatchObject({ checked: true });
    expect(r.host('onboarding-times-owls').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('antes da conta: "Continuar" guarda o time no aparelho e abre o cadastro', async () => {
    const r = render(<TeamChoiceAuthScreen />);
    await flush();
    r.press('onboarding-times-coyotes');
    r.press('onboarding-entrar-time');
    await flush();
    expect(usePendingTeam.getState().team).toBe('coyotes');
    r.press('onboarding-confirmacao-pular');
    r.press('onboarding-confirmacao-continuar');
    await flush();
    expect(mockStore.get('pending-team')).toBe('coyotes');
    expect(mockRouter.push).toHaveBeenCalledWith('/cadastro');
  });

  it('erro ao continuar fecha a cerimônia e mostra o erro com o time ainda marcado', async () => {
    const r = render(<TeamChoiceScreen onContinue={async () => 'Não deu para salvar seu time.'} />);
    r.press('onboarding-times-striders');
    r.press('onboarding-entrar-time');
    await flush();
    r.press('onboarding-confirmacao-continuar');
    await flush();
    expect(r.has('onboarding-confirmacao')).toBe(false);
    expect(r.text()).toContain('Não deu para salvar seu time.');
    expect(r.host('onboarding-times-striders').props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('onboarding depois do cadastro (D-91)', () => {
  const signedIn = () => {
    useSession.getState().setSession({ userId: 'ana', email: 'ana@ex.com' } as never);
    useSession.getState().setProfile({ id: 'ana', username: 'ana_corre', faction: null, xp: 0, trust: 100 } as never);
  };

  it('com time pendente: grava uma vez (`choose_faction`), apaga a escolha do aparelho e vai direto ao GPS', async () => {
    signedIn();
    mockStore.set('pending-team', 'volt');
    mockChoose.mockResolvedValue({ ok: true, data: {} });
    const r = render(<OnboardingScreen />);
    expect(r.has('onboarding-salvando')).toBe(true);
    await flush();
    expect(mockChoose).toHaveBeenCalledTimes(1);
    expect(mockChoose).toHaveBeenCalledWith('volt');
    expect(r.has('onboarding-localizacao')).toBe(true);
    expect(r.text()).toContain('Ligue o GPS e pinte a cidade');
    expect(mockStore.has('pending-team')).toBe(false);
    expect(useOnboardingFlow.getState().activeFor).toBe('ana');
  });

  it('gravar falhou: a pessoa escolhe de novo, com o erro e o time marcado; a 2ª tentativa segue ao GPS', async () => {
    signedIn();
    mockStore.set('pending-team', 'owls');
    mockChoose.mockResolvedValueOnce({ ok: false, error: { message: 'Servidor fora do ar.' } });
    const r = render(<OnboardingScreen />);
    await flush();
    expect(r.has('tela-onboarding-times')).toBe(true);
    expect(r.text()).toContain('Não deu para salvar seu time. Servidor fora do ar.');
    expect(r.host('onboarding-times-owls').props.accessibilityState).toMatchObject({ checked: true });
    mockChoose.mockResolvedValueOnce({ ok: true, data: {} });
    r.press('onboarding-entrar-time');
    await flush();
    r.press('onboarding-confirmacao-pular');
    r.press('onboarding-confirmacao-continuar');
    await flush();
    expect(mockChoose).toHaveBeenCalledTimes(2);
    expect(r.has('onboarding-localizacao')).toBe(true);
  });

  it('sem time pendente (login social, conta antiga): cai na cidade dividida, como antes', async () => {
    signedIn();
    const r = render(<OnboardingScreen />);
    await flush();
    expect(mockChoose).not.toHaveBeenCalled();
    expect(r.has('onboarding-cidade')).toBe(true);
    expect(r.text()).toContain('A cidade está dividida');
  });

  it('sem nome de usuário (login social): pede o nome antes de tudo', () => {
    useSession.getState().setSession({ userId: 'ana', email: 'ana@ex.com' } as never);
    useSession.getState().setProfile({ id: 'ana', username: '', faction: null } as never);
    const r = render(<OnboardingScreen />);
    expect(r.has('onboarding-nome')).toBe(true);
    expect(mockChoose).not.toHaveBeenCalled();
  });
});
