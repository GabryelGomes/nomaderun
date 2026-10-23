import type { ProfileStatus, SessionStatus } from '@/store/session-store';

/**
 * Qual grupo de rotas o `Stack.Protected` do layout raiz libera (função pura, testada).
 *  - `splash`: restaurando sessão ou carregando o perfil (splash continua visível)
 *  - `unavailable`: backend não configurado ou perfil não carregou (tela com explicação)
 *  - `auth`: boas-vindas, entrar, cadastro, recuperar senha
 *  - `recovery`: só "nova senha" (entrou por link de recuperação)
 *  - `onboarding`: logado sem time, ou com o onboarding ainda aberto (D-72: confirmação épica e GPS depois de
 *    gravar o time)
 *  - `app`: abas, corrida, resumo, zona
 */
export type RouteGroup = 'splash' | 'unavailable' | 'auth' | 'recovery' | 'onboarding' | 'app';

export type GuardInput = {
  status: SessionStatus;
  profileStatus: ProfileStatus;
  hasProfile: boolean;
  hasFaction: boolean;
  recovering: boolean;
  /**
   * O onboarding desta pessoa ainda está aberto (`features/auth/onboarding-flow.ts`, só na memória). Com ele, quem
   * acabou de gravar o time continua no onboarding até o último passo. Quem já tinha time (sem a flag) vai direto
   * às abas. Ausente = `false`.
   */
  onboardingInProgress?: boolean;
};

export function resolveRouteGroup(i: GuardInput): RouteGroup {
  if (i.status === 'loading') return 'splash';
  if (i.status === 'unconfigured') return 'unavailable';
  if (i.status === 'signedOut') return 'auth';
  if (i.recovering) return 'recovery';
  if (!i.hasProfile) return i.profileStatus === 'error' ? 'unavailable' : 'splash';
  return i.hasFaction && !i.onboardingInProgress ? 'app' : 'onboarding';
}
