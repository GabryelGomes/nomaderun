import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import * as authRepo from '@/services/api/auth-repo';
import type { OAuthProvider } from '@/services/api/env';
import { AppError } from '@/services/api/errors';

import { handleAuthUrl } from './session-controller';

/**
 * Login social (RF-001, D-05). Só é oferecido quando `EXPO_PUBLIC_AUTH_PROVIDERS` lista o
 * provedor, ou seja, quando ele foi configurado no Supabase com credenciais reais.
 * Devolve `null` em sucesso ou se a pessoa cancelou; AppError em falha.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<AppError | null> {
  const redirectTo = Linking.createURL('/entrar');
  const res = await authRepo.oauthUrl(provider, redirectTo);
  if (!res.ok) return res.error;
  const result = await WebBrowser.openAuthSessionAsync(res.data, redirectTo);
  if (result.type !== 'success') return null;
  return handleAuthUrl(result.url);
}

export const providerLabel: Record<OAuthProvider, string> = { google: 'Continuar com Google', apple: 'Continuar com Apple' };
