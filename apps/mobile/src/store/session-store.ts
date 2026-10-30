import { create } from 'zustand';

import type { AppError } from '@/services/api/errors';
import type { SessionInfo } from '@/services/api/auth-repo';
import type { Profile } from '@/services/api/types';

/**
 * Estado de autenticação (D-12). Só guarda dados: quem conversa com o servidor é o
 * controlador em `src/features/auth/session-controller.ts`.
 *  - `loading`: restaurando a sessão salva (splash na tela)
 *  - `unconfigured`: faltam as variáveis do Supabase
 *  - `signedOut` / `signedIn`
 */
export type SessionStatus = 'loading' | 'unconfigured' | 'signedOut' | 'signedIn';
export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

type SessionState = {
  status: SessionStatus;
  session: SessionInfo | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  profileError: AppError | null;
  /**
   * D-95/UX-05: o perfil na tela é a cópia salva no aparelho (sem internet ou servidor fora do ar) e esta é a hora
   * em que ela foi salva (`null` = cópia antiga, sem hora). `undefined` = perfil fresco do servidor.
   */
  profileSavedAt?: number | null;
  /** Usuário entrou por um link de recuperação e precisa definir a nova senha. */
  recovering: boolean;
  /** Falha ao abrir um link de autenticação (ex.: link de recuperação expirado). */
  linkError: AppError | null;
  /**
   * Link de autenticação que chegou com alguém já conectado (QA-03): só é usado depois que
   * a pessoa confirma a troca de conta. `currentEmail` = conta conectada agora.
   */
  pendingLink: { url: string; currentEmail: string | null } | null;
  /** Aviso mostrado na tela Entrar depois que a sessão foi encerrada pelo servidor (ex.: conta inativada). */
  signedOutNotice: string | null;
  setUnconfigured: () => void;
  setSession: (session: SessionInfo | null) => void;
  setProfileLoading: () => void;
  setProfile: (profile: Profile, savedAt?: number | null) => void;
  setProfileError: (error: AppError) => void;
  setRecovering: (on: boolean) => void;
  setLinkError: (e: AppError | null) => void;
  setPendingLink: (link: { url: string; currentEmail: string | null } | null) => void;
  setSignedOutNotice: (notice: string | null) => void;
  reset: () => void;
};

const initial = {
  status: 'loading' as SessionStatus,
  session: null,
  profile: null,
  profileStatus: 'idle' as ProfileStatus,
  profileError: null,
  recovering: false,
  linkError: null,
  pendingLink: null,
  signedOutNotice: null,
};

export const useSession = create<SessionState>((set, get) => ({
  ...initial,
  setUnconfigured: () => set({ ...initial, status: 'unconfigured' }),
  setSession: (session) => {
    const prev = get().session;
    if (!session) {
      set({ status: 'signedOut', session: null, profile: null, profileStatus: 'idle', profileError: null, profileSavedAt: undefined, recovering: false });
      return;
    }
    // Troca de usuário: descarta o perfil antigo.
    const sameUser = prev?.userId === session.userId;
    set({
      status: 'signedIn',
      session,
      ...(sameUser ? {} : { profile: null, profileStatus: 'idle' as ProfileStatus, profileError: null }),
    });
  },
  setProfileLoading: () => set((s) => ({ profileStatus: s.profile ? s.profileStatus : 'loading', profileError: null })),
  setProfile: (profile, savedAt) => set({ profile, profileStatus: 'ready', profileError: null, profileSavedAt: savedAt }),
  setProfileError: (profileError) => set((s) => (s.profile ? { profileError } : { profileStatus: 'error', profileError })),
  setRecovering: (recovering) => set({ recovering }),
  setLinkError: (linkError) => set({ linkError }),
  setPendingLink: (pendingLink) => set({ pendingLink }),
  setSignedOutNotice: (signedOutNotice) => set({ signedOutNotice }),
  reset: () => set({ ...initial, status: 'signedOut' }),
}));
