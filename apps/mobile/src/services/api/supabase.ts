import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';

import { asSupabaseClient, getDemoClient } from './demo';
import { env, isBackendConfigured, isDemoMode } from './env';
import { AppError } from './errors';
import { createChunkedStorage, createWebStorage } from './secure-storage';

/**
 * Cliente único do Supabase (D-01, D-05, D-06). Só os repositórios de `src/services/api`
 * importam este módulo: telas e stores nunca falam com o supabase direto.
 * O URL/URLSearchParams que o supabase-js usa já vem no runtime do Expo SDK 57
 * (expo/src/winter), por isso não há `react-native-url-polyfill`.
 */
let client: SupabaseClient | null = null;
let appStateWired = false;

const isWeb = process.env.EXPO_OS === 'web';
/** Renderização estática do `expo export -p web` roda em Node, sem janela nem storage. */
const isServer = typeof window === 'undefined';

function buildStorage() {
  if (isWeb) return createWebStorage();
  return createChunkedStorage({
    getItemAsync: (k) => SecureStore.getItemAsync(k),
    setItemAsync: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
    deleteItemAsync: (k) => SecureStore.deleteItemAsync(k),
  });
}

/** Padrão da documentação do Supabase para apps: renova o token só com o app em primeiro plano. */
function wireAppState(c: SupabaseClient) {
  if (appStateWired || isWeb || isServer) return;
  appStateWired = true;
  const apply = (state: AppStateStatus) => {
    if (state === 'active') c.auth.startAutoRefresh();
    else c.auth.stopAutoRefresh();
  };
  AppState.addEventListener('change', apply);
  apply(AppState.currentState);
}

/**
 * Devolve o cliente, ou `null` se `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` faltarem.
 * Com `EXPO_PUBLIC_DEMO=1` (D-77) devolve o servidor de demonstração em memória: é a única costura
 * do modo demonstração (repositórios e telas não sabem dele) e nenhum cliente real é criado.
 */
export function getSupabase(): SupabaseClient | null {
  if (isDemoMode(env)) return asSupabaseClient(getDemoClient());
  if (client) return client;
  if (!isBackendConfigured(env) || !env.supabaseUrl || !env.supabaseAnonKey) return null;
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: buildStorage(),
      autoRefreshToken: !isServer,
      persistSession: !isServer,
      detectSessionInUrl: false,
      // QA-03: links de e-mail trazem só um `code` de uso único, trocado pela sessão com o
      // verificador guardado neste aparelho. Tokens soltos na URL (fluxo implícito) nunca viram sessão.
      flowType: 'pkce',
    },
  });
  wireAppState(client);
  return client;
}

/** Versão que lança AppError: usada dentro de `attempt()` nos repositórios. */
export function requireSupabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new AppError('SERVER', 'Backend não configurado. Defina as variáveis do Supabase no arquivo .env.', { detail: 'NOT_CONFIGURED' });
  return c;
}
