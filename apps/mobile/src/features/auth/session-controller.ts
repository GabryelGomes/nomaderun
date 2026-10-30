import * as Linking from 'expo-linking';
import { useEffect, useSyncExternalStore } from 'react';

import * as authRepo from '@/services/api/auth-repo';
import { isBackendConfigured } from '@/services/api/env';
import { AppError, MESSAGES, onAccountInactive, type Result } from '@/services/api/errors';
import { readCachedProfile, writeCachedProfile } from '@/services/api/profile-cache';
import * as profileRepo from '@/services/api/profile-repo';
import type { Profile, ProfilePatch } from '@/services/api/types';
import { isRecoveryLink, parseAuthCallback } from '@/services/auth/deep-link';
import { isDemoActive, onDemoSwitch } from '@/services/demo-mode';
import { useGame } from '@/store/game-store';
import { useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';

import { useOnboardingFlow } from './onboarding-flow';

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

function commitProfile(profile: Profile, fromCache?: { savedAt: number | null }) {
  const first = useSession.getState().profile?.id !== profile.id;
  useSession.getState().setProfile(profile, fromCache ? fromCache.savedAt : undefined);
  applyToGame(profile, first);
  // A cópia salva não é regravada: a hora dela ("há 2 h") continua sendo a da última vez que o servidor respondeu.
  if (!fromCache) void writeCachedProfile(profile);
}

/**
 * Erros que não dizem nada sobre a conta (D-95/UX-05): sem internet, servidor fora do ar ou ocupado. Com eles, o app
 * abre com a última cópia do perfil e um aviso, em vez de travar; a corrida já funciona offline.
 */
const TRANSIENT: ReadonlySet<string> = new Set(['NETWORK', 'SERVER', 'RATE_LIMITED', 'UNKNOWN']);

/** Busca o perfil do servidor; sem internet ou com o servidor fora do ar, usa a última cópia salva do mesmo usuário. */
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
  if (TRANSIENT.has(res.error.code)) {
    const cached = await readCachedProfile(userId);
    if (cached && useSession.getState().session?.userId === userId) {
      const { savedAt, ...profile } = cached;
      commitProfile(profile, { savedAt: typeof savedAt === 'number' ? savedAt : null });
      // Fica o erro junto do perfil salvo: as telas mostram o `OfflineNotice` com a hora da cópia.
      useSession.getState().setProfileError(res.error);
      return { ok: true, data: profile };
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

/** Grava a facção pelo RPC e recarrega o perfil: no onboarding (o guarda libera as abas) e na troca em Perfil › Meu time. */
export async function chooseFaction(faction: Parameters<typeof profileRepo.chooseFaction>[0]): Promise<Result<Profile>> {
  const res = await profileRepo.chooseFaction(faction);
  if (!res.ok) return res;
  return loadProfile();
}

/**
 * Troca do modo demonstração (D-77, `@/services/demo-mode`): zera as stores com dados de pessoa, para nada de um
 * modo aparecer no outro. Não usa `clearLocal()`: o `writeCachedProfile(null)` dele apagaria o cache de perfil
 * do modo que está entrando (ao sair da demonstração, o da conta real). Stores novas da onda 2 com dados do
 * usuário (engajamento da E7, feed da E8) entram aqui; preferências ficam.
 */
export function resetStoresForDemoSwitch() {
  useGame.getState().resetForSignOut();
  useSession.getState().reset();
  useZones.getState().reset();
  useNotifications.getState().reset();
  useOnboardingFlow.getState().reset();
}
onDemoSwitch(resetStoresForDemoSwitch);

function clearLocal() {
  useGame.getState().resetForSignOut();
  useSession.getState().reset();
  void writeCachedProfile(null);
}

export async function signOut(): Promise<void> {
  await authRepo.signOut();
  clearLocal();
}

let endingInactive = false;

/**
 * O servidor avisou que a conta foi inativada (401 `ACCOUNT_INACTIVE`, D-50): encerra a sessão
 * neste aparelho e mostra o motivo na tela Entrar. Corridas na fila continuam guardadas.
 */
export async function endSessionForInactiveAccount(): Promise<void> {
  if (endingInactive || !useSession.getState().session) return;
  endingInactive = true;
  try {
    await authRepo.signOut();
    clearLocal();
    useSession.getState().setSignedOutNotice(MESSAGES.accountInactive);
  } finally {
    endingInactive = false;
  }
}

/** Usado depois da exclusão da conta (o usuário já não existe no servidor). */
export async function signOutAfterDeletion(): Promise<void> {
  await authRepo.signOut();
  clearLocal();
}

/**
 * Trata um link `nomaderun://...` de autenticação (QA-03). Devolve erro amigável ou null.
 *  - só o `code` do fluxo PKCE vira sessão (tokens soltos na URL são recusados no repositório);
 *  - com alguém já conectado, o link fica pendente até a pessoa confirmar a troca de conta
 *    (`confirmPendingLink`), porque não dá para saber de qual conta ele é antes de usá-lo.
 */
export async function handleAuthUrl(url: string | null, opts: { confirmed?: boolean } = {}): Promise<AppError | null> {
  const cb = parseAuthCallback(url);
  if (!cb || !url) return null;
  const current = await authRepo.getCurrentSession();
  const signedInAs = current.ok ? current.data : null;
  if (signedInAs && !opts.confirmed) {
    // Links de erro ou com tokens não trocam nada: ignorados para quem já está conectado.
    if (cb.kind !== 'code') return null;
    useSession.getState().setPendingLink({ url, currentEmail: signedInAs.email });
    return null;
  }
  const recovery = isRecoveryLink(url, cb);
  if (recovery) useSession.getState().setRecovering(true);
  useSession.getState().setLinkError(null);
  const res = await authRepo.sessionFromCallback(cb);
  if (!res.ok) {
    if (signedInAs) useSession.getState().setRecovering(false);
    else useSession.getState().setLinkError(res.error);
    return res.error;
  }
  if (signedInAs && signedInAs.userId !== res.data.userId) {
    // Trocou de conta: o progresso local da conta anterior não pode vazar para a nova.
    useGame.getState().resetForSignOut();
    void writeCachedProfile(null);
  }
  useSession.getState().setSession(res.data);
  return null;
}

/** A pessoa confirmou a troca de conta pelo link pendente. */
export async function confirmPendingLink(): Promise<AppError | null> {
  const pending = useSession.getState().pendingLink;
  useSession.getState().setPendingLink(null);
  if (!pending) return null;
  return handleAuthUrl(pending.url, { confirmed: true });
}

/** A pessoa preferiu continuar na conta atual: o link é descartado. */
export function dismissPendingLink() {
  useSession.getState().setPendingLink(null);
}

/** Montado uma vez no layout raiz: restaura a sessão, escuta mudanças e links de autenticação. */
export function useSessionBootstrap() {
  // Na troca do modo demonstração, o efeito refaz tudo e assina o Auth do cliente do modo atual.
  const demo = useSyncExternalStore(onDemoSwitch, isDemoActive, isDemoActive);
  useEffect(() => {
    if (!isBackendConfigured()) {
      useSession.getState().setUnconfigured();
      return;
    }
    let alive = true;
    const offInactive = onAccountInactive(() => void endSessionForInactiveAccount());
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
      offInactive();
      sub?.unsubscribe();
      linkSub.remove();
    };
  }, [demo]);

  // Sempre que entra um usuário novo, carrega o perfil dele.
  const userId = useSession((s) => s.session?.userId);
  useEffect(() => {
    if (userId) void loadProfile();
  }, [userId]);
}
