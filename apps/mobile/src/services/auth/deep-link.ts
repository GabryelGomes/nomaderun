/**
 * Leitura dos links de autenticação que chegam por `nomaderun://` (recuperação de senha,
 * confirmação de e-mail, retorno do login social). O app usa o fluxo PKCE (QA-03): o link
 * traz `?code=...`, que só vale junto com o verificador guardado neste aparelho. Links com
 * tokens no fragmento (`#access_token=...`, fluxo implícito) ainda são reconhecidos, mas só
 * para serem recusados (`auth-repo.sessionFromCallback`). Em caso de falha vem `error_description`.
 */
export type AuthCallback =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'code'; code: string; type: string | null }
  | { kind: 'error'; code: string | null; description: string };

function collectParams(url: string): Map<string, string> {
  const params = new Map<string, string>();
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex > queryIndex ? hashIndex : undefined) : '';
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  for (const part of [query, fragment]) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const k = decodeURIComponent((eq >= 0 ? pair.slice(0, eq) : pair).replace(/\+/g, ' '));
      const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
      if (k) params.set(k, v);
    }
  }
  return params;
}

export function parseAuthCallback(url: string | null | undefined): AuthCallback | null {
  if (!url) return null;
  let p: Map<string, string>;
  try {
    p = collectParams(url);
  } catch {
    return null;
  }
  const errorDescription = p.get('error_description') ?? p.get('error');
  if (errorDescription) return { kind: 'error', code: p.get('error_code') ?? null, description: errorDescription };
  const accessToken = p.get('access_token');
  const refreshToken = p.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken, type: p.get('type') ?? null };
  const code = p.get('code');
  if (code) return { kind: 'code', code, type: p.get('type') ?? null };
  return null;
}

/** O link é de recuperação de senha? (o Supabase marca `type=recovery`; a rota também indica). */
export function isRecoveryLink(url: string | null | undefined, cb: AuthCallback | null): boolean {
  if (!url || !cb || cb.kind === 'error') return false;
  return cb.type === 'recovery' || /nova-senha/.test(url);
}
