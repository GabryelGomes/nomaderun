import type { ProfileStatus, SessionStatus } from '@/store/session-store';

/**
 * Qual grupo de rotas o `Stack.Protected` do layout raiz libera (função pura, testada).
 *  - `splash`: restaurando sessão ou carregando o perfil (splash continua visível)
 *  - `unavailable`: backend não configurado ou perfil não carregou (tela com explicação)
 *  - `auth`: entrar, cadastro, recuperar senha
 *  - `recovery`: só "nova senha" (entrou por link de recuperação)
 *  - `onboarding`: logado, sem facção
 *  - `app`: abas, corrida, resumo, zona
 */
export type RouteGroup = 'splash' | 'unavailable' | 'auth' | 'recovery' | 'onboarding' | 'app';

export type GuardInput = {
  status: SessionStatus;
  profileStatus: ProfileStatus;
  hasProfile: boolean;
  hasFaction: boolean;
  recovering: boolean;
};

export function resolveRouteGroup(i: GuardInput): RouteGroup {
  if (i.status === 'loading') return 'splash';
  if (i.status === 'unconfigured') return 'unavailable';
  if (i.status === 'signedOut') return 'auth';
  if (i.recovering) return 'recovery';
  if (!i.hasProfile) return i.profileStatus === 'error' ? 'unavailable' : 'splash';
  return i.hasFaction ? 'app' : 'onboarding';
}
