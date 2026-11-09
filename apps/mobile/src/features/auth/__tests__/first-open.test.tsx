/**
 * T7.2.6 (E6a) — primeira abertura (D-72): boas-vindas, cadastro enxuto e o botão "Ver demonstração" (D-77).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

const mockRouter = { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), back: jest.fn(), canGoBack: () => false };
/** Parâmetros da rota (`/cadastro?origem=times` quando vem da escolha de times, F8-D · B3). */
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  // getter: o mock é lido no toque (os imports sobem acima desta constante)
  get router() {
    return mockRouter;
  },
  Redirect: ({ href }: { href: string }) => `redirect:${href}`,
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-linking',() => ({ createURL: (p: string) => `nomaderun://${p}` }));
const mockSignUp = jest.fn<(input: Record<string, unknown>) => Promise<unknown>>();
const mockSignIn = jest.fn<(email: string, password: string) => Promise<unknown>>();
jest.mock('@/services/api/auth-repo', () => ({ signUp: (i: Record<string, unknown>) => mockSignUp(i), signIn: (e: string, p: string) => mockSignIn(e, p) }));
// Interruptor da E10: só o contrato (`@/services/demo-mode`), controlado pelo teste. O estado mora dentro do mock
// (o session-controller registra o ouvinte ao carregar, antes das constantes deste arquivo existirem).
jest.mock('@/services/demo-mode', () => {
  const state = { active: false, build: false, listeners: [] as unknown[], entered: 0 };
  return {
    __state: state,
    enterDemo: async () => {
      state.entered += 1;
      state.active = true;
      return true;
    },
    exitDemo: async () => false,
    isDemoActive: () => state.active,
    isDemoBuild: () => state.build,
    onDemoSwitch: (fn: unknown) => {
      state.listeners.push(fn);
      return () => {};
    },
  };
});
jest.mock('@/services/api/profile-repo',() => ({ isUsernameAvailable: async () => ({ ok: true, data: true }) }));
const mockLocal = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (name: string) => mockLocal.get(name) ?? null,
  writeLocal: async (name: string, value: unknown) => {
    if (value === null || value === undefined) mockLocal.delete(name);
    else mockLocal.set(name, value);
  },
}));

/* eslint-disable import/first */
import { act } from 'react-test-renderer';

import { render } from '@/components/__tests__/render-helpers';
import type { FactionId } from '@/domain/types';
import { useSession } from '@/store/session-store';

import { canLeaveDemo, DEMO_RUNNER_EMAIL, startDemo } from '../demo-entry';
import { useOnboardingFlow } from '../onboarding-flow';
import { usePendingTeam } from '../pending-team';
import { resetStoresForDemoSwitch } from '../session-controller';
import { SignInScreen } from '../sign-in-screen';
import { LEGAL_ERROR, SignUpScreen } from '../sign-up-screen';
import { WelcomeScreen } from '../welcome-screen';
/* eslint-enable import/first */

const mockDemo = jest.requireMock<{ __state: { active: boolean; build: boolean; listeners: unknown[]; entered: number } }>('@/services/demo-mode').__state;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockLocal.clear();
  act(() => useSession.getState().setSignedOutNotice(null));
});

/** Espera os efeitos assíncronos (leitura/gravação do aparelho). */
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const record = (team: FactionId, origin: 'escolha' | 'cadastro', at = Date.now()) => ({ team, at, origin });

describe('Boas-vindas (wireframe 00, D-91)', () => {
  it('1 frase e 2 caminhos: Começar → a cidade dividida (valor antes da conta), Já tenho conta → entrar', () => {
    const r = render(<WelcomeScreen />);
    expect(r.text()).toContain('Corra a sua cidade: cada rua conta.');
    // herói do jogo (UX-20): o logo oficial como imagem, sem o wordmark em texto nem bolinhas
    expect(r.host('boas-vindas-titulo').props.accessibilityLabel).toBe('NOMADE RUN');
    r.press('boas-vindas-comecar');
    r.press('boas-vindas-entrar');
    expect(mockRouter.push.mock.calls).toEqual([['/cidade'], ['/entrar']]);
  });

  it('sessão encerrada pelo servidor: vai direto para Entrar, onde o aviso aparece', () => {
    act(() => useSession.getState().setSignedOutNotice('Conta inativada.'));
    const r = render(<WelcomeScreen />);
    expect(r.text()).toBe('redirect:/entrar');
    act(() => r.renderer.unmount());
  });
});

describe('Cadastro enxuto (D-72)', () => {
  it('depois da cerimônia (D-91): "Garanta seu lugar nos <time>" com o emblema; sem time pendente, "Criar conta"', () => {
    mockParams = { origem: 'times' };
    act(() => usePendingTeam.setState({ team: 'volt', record: record('volt', 'escolha'), hydrated: true }));
    const r = render(<SignUpScreen />);
    expect(r.text()).toContain('Garanta seu lugar nos Volt Runners');
    expect(r.has('cadastro-time')).toBe(true);
    act(() => r.renderer.unmount());
    act(() => usePendingTeam.setState({ team: null, record: null, hydrated: true }));
    const r2 = render(<SignUpScreen />);
    expect(r2.text()).toContain('Criar conta');
    expect(r2.has('cadastro-time')).toBe(false);
  });

  it('F8-D · B3: cadastro aberto sem vir da escolha (Entrar → "Criar conta") apaga o time que outra pessoa largou', async () => {
    mockLocal.set('pending-team', record('owls', 'escolha'));
    act(() => usePendingTeam.setState({ team: null, record: null, hydrated: false }));
    const r = render(<SignUpScreen />);
    await settle();
    expect(usePendingTeam.getState().team).toBeNull();
    expect(mockLocal.has('pending-team')).toBe(false);
    expect(r.text()).toContain('Criar conta');
    expect(r.has('cadastro-time')).toBe(false);
  });

  it('F8-D · B3: cadastro vindo da escolha e enviado (confirmar e-mail) marca a escolha como desta pessoa', async () => {
    mockParams = { origem: 'times' };
    mockLocal.set('pending-team', record('coyotes', 'escolha'));
    act(() => usePendingTeam.setState({ team: null, record: null, hydrated: false }));
    mockSignUp.mockResolvedValue({ ok: true, data: { session: null, needsConfirmation: true } });
    const r = render(<SignUpScreen />);
    await settle();
    expect(r.text()).toContain('Garanta seu lugar nos');
    const type = (id: string, v: string) =>
      act(() => {
        r.all(id).find((n) => typeof n.props.onChangeText === 'function')!.props.onChangeText(v);
      });
    type('cadastro-email', 'ana@exemplo.com');
    type('cadastro-senha', 'Corrida@2026');
    type('cadastro-usuario', 'ana_corre');
    type('cadastro-nascimento', '15052000');
    r.press('cadastro-aceite');
    await act(async () => {
      r.press('cadastro-botao');
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockLocal.get('pending-team')).toMatchObject({ team: 'coyotes', origin: 'cadastro' });
  });

  it('F8-D · B3: abrir "Entrar" apaga o time largado por outra pessoa; o de quem acabou de se cadastrar fica', async () => {
    mockLocal.set('pending-team', record('owls', 'escolha'));
    act(() => usePendingTeam.setState({ team: null, record: null, hydrated: false }));
    const r = render(<SignInScreen />);
    await settle();
    expect(usePendingTeam.getState().team).toBeNull();
    expect(mockLocal.has('pending-team')).toBe(false);
    act(() => r.renderer.unmount());

    mockLocal.set('pending-team', record('volt', 'cadastro'));
    act(() => usePendingTeam.setState({ team: null, record: null, hydrated: false }));
    const r2 = render(<SignInScreen />);
    await settle();
    expect(usePendingTeam.getState().team).toBe('volt');
    act(() => r2.renderer.unmount());
  });

  it('no máximo 4 campos, sem cidade, e 1 caixa para Termos e Privacidade', () => {
    const r = render(<SignUpScreen />);
    const fields = ['cadastro-email', 'cadastro-senha', 'cadastro-usuario', 'cadastro-nascimento'];
    for (const f of fields) expect(r.has(f)).toBe(true);
    expect(r.has('cadastro-cidade')).toBe(false);
    expect(r.has('cadastro-aceite')).toBe(true);
    expect(r.has('cadastro-aceite-termos')).toBe(false);
    expect(r.has('cadastro-aceite-privacidade')).toBe(false);
  });

  it('sem o aceite, uma mensagem só; com o aceite, grava os 2 aceites no servidor', async () => {
    mockSignUp.mockResolvedValue({ ok: true, data: { session: { userId: 'u1' }, needsConfirmation: false } });
    const r = render(<SignUpScreen />);
    const type = (id: string, v: string) =>
      act(() => {
        r.all(id).find((n) => typeof n.props.onChangeText === 'function')!.props.onChangeText(v);
      });
    type('cadastro-email', 'ana@exemplo.com');
    type('cadastro-senha', 'Corrida@2026');
    type('cadastro-usuario', 'ana_corre');
    type('cadastro-nascimento', '15052000');
    await act(async () => {
      r.press('cadastro-botao');
    });
    expect(r.text()).toContain(LEGAL_ERROR);
    expect(mockSignUp).not.toHaveBeenCalled();
    r.press('cadastro-aceite');
    await act(async () => {
      r.press('cadastro-botao');
      await Promise.resolve();
    });
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp.mock.calls[0][0]).toMatchObject({ username: 'ana_corre', birthdate: '2000-05-15', acceptedTerms: true, acceptedPrivacy: true });
    expect(mockSignUp.mock.calls[0][0]).not.toHaveProperty('city');
  });
});

describe('"Ver demonstração" (D-77)', () => {
  beforeEach(() => {
    mockDemo.active = false;
    mockDemo.build = false;
    mockDemo.entered = 0;
  });

  it('build normal: o botão liga o interruptor da E10 (sem entrar em conta nenhuma) e só então dá para sair', async () => {
    expect(canLeaveDemo()).toBe(false);
    expect(await startDemo()).toBeNull();
    expect(mockDemo.entered).toBe(1);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(canLeaveDemo()).toBe(true);
  });

  it('build de demonstração: o botão entra na conta do corredor de demonstração e não há "Sair"', async () => {
    mockDemo.active = true;
    mockDemo.build = true;
    mockSignIn.mockResolvedValue({ ok: true, data: null });
    expect(await startDemo()).toBeNull();
    expect(mockSignIn).toHaveBeenCalledWith(DEMO_RUNNER_EMAIL, expect.any(String));
    expect(mockDemo.entered).toBe(0);
    expect(canLeaveDemo()).toBe(false);
  });

  it('a troca de modo zera as stores de pessoa (ouvinte registrado no session-controller)', async () => {
    expect(mockDemo.listeners).toContain(resetStoresForDemoSwitch);
    act(() => {
      useOnboardingFlow.getState().begin('u1');
      useSession.getState().setSignedOutNotice('x');
    });
    // F8-D · B3: o time escolhido antes da conta num modo não vaza para o outro (memória e aparelho)
    mockLocal.set('pending-team', record('volt', 'cadastro'));
    act(() => usePendingTeam.setState({ team: 'volt', record: record('volt', 'cadastro'), hydrated: true }));
    await act(async () => {
      await resetStoresForDemoSwitch();
    });
    expect(usePendingTeam.getState().team).toBeNull();
    expect(mockLocal.has('pending-team')).toBe(false);
    expect(useOnboardingFlow.getState().activeFor).toBeNull();
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('o corredor de demonstração é o mesmo do servidor em memória', () => {
    expect(DEMO_RUNNER_EMAIL).toBe('demonstracao@nomaderun.invalid');
  });
});
