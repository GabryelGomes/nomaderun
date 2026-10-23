import { describe, expect, it } from '@jest/globals';

import { onboardingInProgressFor, useOnboardingFlow } from '../onboarding-flow';
import { resolveRouteGroup, type GuardInput } from '../route-guard';

const base: GuardInput = { status: 'signedIn', profileStatus: 'ready', hasProfile: true, hasFaction: true, recovering: false };

describe('resolveRouteGroup (guardas do layout raiz)', () => {
  it('restaurando sessão → splash', () => expect(resolveRouteGroup({ ...base, status: 'loading' })).toBe('splash'));
  it('sem variáveis do Supabase → indisponível', () => expect(resolveRouteGroup({ ...base, status: 'unconfigured' })).toBe('unavailable'));
  it('sem sessão → auth', () => expect(resolveRouteGroup({ ...base, status: 'signedOut', hasProfile: false })).toBe('auth'));
  it('link de recuperação → só nova senha', () => expect(resolveRouteGroup({ ...base, recovering: true })).toBe('recovery'));
  it('logado, perfil carregando → splash', () => expect(resolveRouteGroup({ ...base, hasProfile: false, profileStatus: 'loading' })).toBe('splash'));
  it('logado, perfil falhou → indisponível', () => expect(resolveRouteGroup({ ...base, hasProfile: false, profileStatus: 'error' })).toBe('unavailable'));
  it('logado sem facção → onboarding', () => expect(resolveRouteGroup({ ...base, hasFaction: false })).toBe('onboarding'));
  it('logado com facção → abas', () => expect(resolveRouteGroup(base)).toBe('app'));

  // D-72: o time é gravado no meio do onboarding; a confirmação épica e o GPS vêm depois, ainda no onboarding.
  it('time recém-gravado com o onboarding aberto → continua no onboarding', () =>
    expect(resolveRouteGroup({ ...base, onboardingInProgress: true })).toBe('onboarding'));
  it('onboarding aberto e ainda sem time → onboarding', () =>
    expect(resolveRouteGroup({ ...base, hasFaction: false, onboardingInProgress: true })).toBe('onboarding'));
  it('último passo concluído (flag desligada) → abas', () => expect(resolveRouteGroup({ ...base, onboardingInProgress: false })).toBe('app'));
  it('a flag não fura sessão, recuperação nem perfil faltando', () => {
    expect(resolveRouteGroup({ ...base, status: 'signedOut', onboardingInProgress: true })).toBe('auth');
    expect(resolveRouteGroup({ ...base, recovering: true, onboardingInProgress: true })).toBe('recovery');
    expect(resolveRouteGroup({ ...base, hasProfile: false, profileStatus: 'loading', onboardingInProgress: true })).toBe('splash');
  });
});

describe('onboarding-flow (flag só na memória, por pessoa)', () => {
  it('vale só para a pessoa que abriu o onboarding', () => {
    expect(onboardingInProgressFor('u1', 'u1')).toBe(true);
    expect(onboardingInProgressFor('u1', 'u2')).toBe(false);
    expect(onboardingInProgressFor(null, 'u1')).toBe(false);
    expect(onboardingInProgressFor('u1', null)).toBe(false);
  });

  it('begin → finish libera as abas e liga a missão de boas-vindas', () => {
    useOnboardingFlow.getState().reset();
    useOnboardingFlow.getState().begin('u1');
    expect(useOnboardingFlow.getState().activeFor).toBe('u1');
    useOnboardingFlow.getState().finish('u1');
    expect(useOnboardingFlow.getState()).toMatchObject({ activeFor: null, welcomeFor: 'u1' });
    useOnboardingFlow.getState().dismissWelcome();
    expect(useOnboardingFlow.getState().welcomeFor).toBeNull();
  });

  it('finish de outra pessoa não fecha o onboarding aberto', () => {
    useOnboardingFlow.getState().reset();
    useOnboardingFlow.getState().begin('u1');
    useOnboardingFlow.getState().finish('u2');
    expect(useOnboardingFlow.getState().activeFor).toBe('u1');
    useOnboardingFlow.getState().reset();
  });
});
