import { describe, expect, it } from '@jest/globals';

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
});
