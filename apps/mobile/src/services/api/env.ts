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
  /**
   * Modo demonstração (D-77): `EXPO_PUBLIC_DEMO=1`. O app usa o servidor em memória
   * (`src/services/api/demo`) e ignora a URL e a chave do Supabase: não há como misturar com conta real.
   */
  demo?: boolean;
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

/** Só `1` ou `true` ligam o modo demonstração. */
export const parseDemoFlag = (raw: string | undefined | null) => {
  const v = raw?.trim().toLowerCase();
  return v === '1' || v === 'true';
};

type EnvVars = Partial<Record<'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY' | 'EXPO_PUBLIC_AUTH_PROVIDERS' | 'EXPO_PUBLIC_DEMO', string | undefined>>;

/** `vars` existe para os testes: no app, cada variável é lida por extenso (o Expo embute o valor no build). */
export function readEnv(
  vars: EnvVars = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_AUTH_PROVIDERS: process.env.EXPO_PUBLIC_AUTH_PROVIDERS,
    EXPO_PUBLIC_DEMO: process.env.EXPO_PUBLIC_DEMO,
  },
): AppEnv {
  const demo = parseDemoFlag(vars.EXPO_PUBLIC_DEMO);
  return {
    supabaseUrl: demo ? null : clean(vars.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: demo ? null : clean(vars.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    // Login social não existe na demonstração.
    oauthProviders: demo ? [] : parseProviders(vars.EXPO_PUBLIC_AUTH_PROVIDERS),
    demo,
  };
}

export const env = readEnv();

export const isDemoMode = (e: AppEnv = env) => e.demo === true;

/** Há "servidor": o Supabase configurado ou o servidor de demonstração. */
export const isBackendConfigured = (e: AppEnv = env) => isDemoMode(e) || Boolean(e.supabaseUrl && e.supabaseAnonKey);
