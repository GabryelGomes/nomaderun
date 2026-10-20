import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import * as authRepo from '@/services/api/auth-repo';
import { isBackendConfigured } from '@/services/api/env';
import { AppError, type Result } from '@/services/api/errors';
import { readCachedProfile, writeCachedProfile } from '@/services/api/profile-cache';
import * as profileRepo from '@/services/api/profile-repo';
import type { Profile, ProfilePatch } from '@/services/api/types';
import { isRecoveryLink, parseAuthCallback } from '@/services/auth/deep-link';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';

/**
 * Orquestra sessão ↔ perfil ↔ jogo. Telas chamam estas funções; elas chamam os repositórios
 * e atualizam as stores (stores não importam serviços, ARQUITETURA §2).
 */

const noSession = () => new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre de novo.');

function applyToGame(profile: Profile, withProgress: boolean) {
  useGame.getState().applyProfile({
    username: profile.username,
    faction: profile.faction,
    ...(withProgress ? { xp: profile.xp, trust: profile.trust } : {}),
  });
}

function commitProfile(profile: Profile) {
  const first = useSession.getState().profile?.id !== profile.id;
  useSession.getState().setProfile(profile);
  applyToGame(profile, first);
  void writeCachedProfile(profile);
}

/** Busca o perfil do servidor; sem internet usa a última cópia salva do mesmo usuário. */
export async function loadProfile(): Promise<Result<Profile>> {
  const s = useSession.getState();
  const userId = s.session?.userId;
  if (!userId) return { ok: false, error: noSession() };
  s.setProfileLoading();
  const res = await profileRepo.getMyProfile(userId);
  if (useSession.getState().session?.userId !== userId) return res; // trocou de usuário no meio
  if (res.ok) {
    commitProfile(res.data);
    return res;
  }
  if (res.error.code === 'NETWORK') {
    const cached = await readCachedProfile(userId);
    if (cached) {
      commitProfile(cached);
      return { ok: true, data: cached };
    }
  }
  useSession.getState().setProfileError(res.error);
  return res;
}

export async function saveProfile(patch: ProfilePatch): Promise<Result<Profile>> {
  const userId = useSession.getState().session?.userId;
  if (!userId) return { ok: false, error: noSession() };
  const res = await profileRepo.updateMyProfile(userId, patch);
  if (res.ok) commitProfile(res.data);
  return res;
}

/** Onboarding: grava a facção pelo RPC e recarrega o perfil (o guarda libera as abas). */
export async function chooseFaction(faction: Parameters<typeof profileRepo.chooseFaction>[0]): Promise<Result<Profile>> {
  const res = await profileRepo.chooseFaction(faction);
  if (!res.ok) return res;
  return loadProfile();
}

function clearLocal() {
  useGame.getState().resetForSignOut();
  useSession.getState().reset();
  void writeCachedProfile(null);
}

export async function signOut(): Promise<void> {
  await authRepo.signOut();
  clearLocal();
}

/** Usado depois da exclusão da conta (o usuário já não existe no servidor). */
export async function signOutAfterDeletion(): Promise<void> {
  await authRepo.signOut();
  clearLocal();
}

/** Trata um link `nomaderun://...` com tokens de autenticação. Devolve erro amigável ou null. */
export async function handleAuthUrl(url: string | null): Promise<AppError | null> {
  const cb = parseAuthCallback(url);
  if (!cb) return null;
  const recovery = isRecoveryLink(url, cb);
  if (recovery) useSession.getState().setRecovering(true);
  useSession.getState().setLinkError(null);
  const res = await authRepo.sessionFromCallback(cb);
  if (!res.ok) {
    useSession.getState().setLinkError(res.error);
    return res.error;
  }
  useSession.getState().setSession(res.data);
  return null;
}

/** Montado uma vez no layout raiz: restaura a sessão, escuta mudanças e links de autenticação. */
export function useSessionBootstrap() {
  useEffect(() => {
    if (!isBackendConfigured()) {
      useSession.getState().setUnconfigured();
      return;
    }
    let alive = true;
    const sub = authRepo.onAuthChange((event, session) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') useSession.getState().setRecovering(true);
      if (event === 'SIGNED_OUT') {
        clearLocal();
        return;
      }
      if (event === 'INITIAL_SESSION' || session) useSession.getState().setSession(session);
    });

    (async () => {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl && parseAuthCallback(initialUrl)) await handleAuthUrl(initialUrl);
      const res = await authRepo.getCurrentSession();
      if (!alive) return;
      // Erro ao restaurar (ex.: refresh sem internet) cai na tela de login; nada quebra.
      const current = useSession.getState();
      if (current.status === 'loading' || !current.session) useSession.getState().setSession(res.ok ? res.data : null);
    })();

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (parseAuthCallback(url)) void handleAuthUrl(url);
    });

    return () => {
      alive = false;
      sub?.unsubscribe();
      linkSub.remove();
    };
  }, []);

  // Sempre que entra um usuário novo, carrega o perfil dele.
  const userId = useSession((s) => s.session?.userId);
  useEffect(() => {
    if (userId) void loadProfile();
  }, [userId]);
}
