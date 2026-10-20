import type { Session, Subscription } from '@supabase/supabase-js';

import type { AuthCallback } from '@/services/auth/deep-link';

import { AppError, attempt, MESSAGES, type Result } from './errors';
import { getSupabase, requireSupabase } from './supabase';

/** Versões dos textos legais aceitos no cadastro (guardadas no perfil pelo trigger do backend). */
export const TERMS_VERSION = '2026-10';
export const PRIVACY_VERSION = '2026-10';

export type SignUpInput = {
  email: string;
  password: string;
  username: string;
  /** AAAA-MM-DD */
  birthdate: string;
  /** Cidade natal (opcional): o trigger grava em `profiles.city` (vazio = sem cidade). */
  city?: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  /** URL de retorno do link de confirmação de e-mail (deep link). */
  emailRedirectTo?: string;
};

export type SessionInfo = { userId: string; email: string | null };

export const toSessionInfo = (s: Session | null): SessionInfo | null => (s ? { userId: s.user.id, email: s.user.email ?? null } : null);

/**
 * Metadados enviados em `options.data` do `signUp`: o trigger do backend lê
 * `raw_user_meta_data` para criar o perfil e validar 16+ e aceites (D-05).
 */
export function buildSignUpMetadata(input: SignUpInput, now: Date = new Date()) {
  const at = now.toISOString();
  return {
    username: input.username.trim(),
    birthdate: input.birthdate,
    ...(input.city?.trim() ? { city: input.city.trim() } : {}),
    accepted_terms: input.acceptedTerms,
    accepted_privacy: input.acceptedPrivacy,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    terms_accepted_at: input.acceptedTerms ? at : null,
    privacy_accepted_at: input.acceptedPrivacy ? at : null,
  };
}

export async function getCurrentSession(): Promise<Result<SessionInfo | null>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    return toSessionInfo(data.session);
  });
}

export function onAuthChange(listener: (event: string, session: SessionInfo | null) => void): Subscription | null {
  const c = getSupabase();
  if (!c) return null;
  const { data } = c.auth.onAuthStateChange((event, session) => listener(event, toSessionInfo(session)));
  return data.subscription;
}

export async function signIn(email: string, password: string): Promise<Result<SessionInfo>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    const info = toSessionInfo(data.session);
    if (!info) throw new AppError('UNAUTHORIZED', MESSAGES.emailNotConfirmed);
    return info;
  });
}

/** `needsConfirmation` = o projeto exige confirmar o e-mail antes do primeiro login. */
export async function signUp(input: SignUpInput): Promise<Result<{ session: SessionInfo | null; needsConfirmation: boolean }>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: buildSignUpMetadata(input), emailRedirectTo: input.emailRedirectTo },
    });
    if (error) throw error;
    // Com confirmação ligada e e-mail já cadastrado, o Supabase devolve um usuário sem identidades.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new AppError('CONFLICT', MESSAGES.emailTaken, { detail: 'user_already_exists' });
    }
    const session = toSessionInfo(data.session);
    return { session, needsConfirmation: !session };
  });
}

export async function signOut(): Promise<Result<void>> {
  return attempt(async () => {
    const c = requireSupabase();
    const { error } = await c.auth.signOut();
    // Sem rede o logout global falha; ainda assim apagamos a sessão local.
    if (error) await c.auth.signOut({ scope: 'local' });
  });
}

export async function sendPasswordReset(email: string, redirectTo: string): Promise<Result<void>> {
  return attempt(async () => {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
  });
}

export async function updatePassword(password: string): Promise<Result<void>> {
  return attempt(async () => {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw error;
  });
}

/**
 * Cria a sessão a partir de um link de autenticação já interpretado (QA-03).
 * Só aceita o `code` do fluxo PKCE: ele só vira sessão junto com o verificador guardado
 * neste aparelho quando o pedido foi feito (recuperação de senha, cadastro, login social).
 * Tokens prontos na URL (fluxo implícito) são recusados: qualquer app ou página poderia
 * montar um link desses e trocar a conta conectada.
 */
export async function sessionFromCallback(cb: AuthCallback): Promise<Result<SessionInfo>> {
  return attempt(async () => {
    if (cb.kind === 'error') throw new AppError('UNAUTHORIZED', MESSAGES.linkExpired, { detail: cb.code ?? undefined });
    if (cb.kind === 'tokens') throw new AppError('UNAUTHORIZED', MESSAGES.linkUnsafe, { detail: 'IMPLICIT_TOKENS' });
    const { data, error } = await requireSupabase().auth.exchangeCodeForSession(cb.code);
    if (error) throw error;
    const info = toSessionInfo(data.session);
    if (!info) throw new AppError('UNAUTHORIZED', MESSAGES.linkExpired);
    return info;
  });
}

/** URL do provedor para login social (Google/Apple), aberta pelo navegador do sistema. */
export async function oauthUrl(provider: 'google' | 'apple', redirectTo: string): Promise<Result<string>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
    if (error) throw error;
    if (!data.url) throw new AppError('SERVER', MESSAGES.unavailable);
    return data.url;
  });
}
