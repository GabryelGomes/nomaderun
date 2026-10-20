import type { ProfileRole } from '@/services/api/types';

/** RF-018 / D-08: o painel só existe para `moderator` e `admin`; usuário comum nunca vê a entrada. */
export function canModerate(role: ProfileRole | null | undefined): boolean {
  return role === 'moderator' || role === 'admin';
}

/** Inativar/reativar contas: só `admin`, e nunca a própria conta. */
export function canManageUser(role: ProfileRole | null | undefined, actorId: string | null | undefined, targetId: string): boolean {
  return role === 'admin' && !!actorId && actorId !== targetId;
}
