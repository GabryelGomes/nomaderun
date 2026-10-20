/**
 * Variáveis públicas de ambiente do app (D-01, RNF-007).
 * O Expo só embute `process.env.EXPO_PUBLIC_*` quando o acesso é escrito por extenso
 * (`process.env.EXPO_PUBLIC_X`), por isso cada variável é lida individualmente.
 * Nunca coloque aqui a chave `service_role`: ela fica só nas Edge Functions.
 */
export type OAuthProvider = 'google' | 'apple';

export type AppEnv = {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  oauthProviders: OAuthProvider[];
};

export function parseProviders(raw: string | undefined | null): OAuthProvider[] {
  if (!raw) return [];
  const out: OAuthProvider[] = [];
  for (const part of raw.split(',')) {
    const p = part.trim().toLowerCase();
    if ((p === 'google' || p === 'apple') && !out.includes(p)) out.push(p);
  }
  return out;
}

function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function readEnv(): AppEnv {
  return {
    supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: clean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    oauthProviders: parseProviders(process.env.EXPO_PUBLIC_AUTH_PROVIDERS),
  };
}

export const env = readEnv();

export const isBackendConfigured = (e: AppEnv = env) => Boolean(e.supabaseUrl && e.supabaseAnonKey);
