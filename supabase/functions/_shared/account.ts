/** Exclusão de conta com reautenticação (QA-06, D-50): o corpo traz a senha e o servidor confere no Auth. */
import { HttpError } from './http.ts';
import { isObject } from './validate.ts';

export type AccountDeleteBody = { password: string };

/** `{ "confirm": "EXCLUIR", "password": "<senha atual>" }`. */
export function parseAccountDelete(body: unknown): AccountDeleteBody {
  if (!isObject(body) || body.confirm !== 'EXCLUIR') {
    throw new HttpError(400, 'VALIDATION', 'Para excluir a conta, envie { "confirm": "EXCLUIR", "password": "<sua senha>" }.');
  }
  const password = body.password;
  if (typeof password !== 'string' || password.length === 0 || password.length > 200) {
    throw new HttpError(400, 'VALIDATION', 'Informe a sua senha atual para confirmar a exclusão.');
  }
  return { password };
}

type VerifyDeps = { baseUrl: string; apikey: string; fetch?: typeof fetch };

/**
 * Confere a senha atual no Auth (`grant_type=password` com o e-mail do usuário do token). A sessão criada por essa
 * conferência deixa de valer junto com a conta. Conta sem e-mail (login social, P-06) ainda não tem reautenticação.
 */
export async function verifyPassword(email: string | undefined, password: string, deps: VerifyDeps): Promise<void> {
  if (!email) {
    throw new HttpError(409, 'REAUTH_UNAVAILABLE', 'Esta conta não tem senha cadastrada. Fale com o suporte para excluir a conta.');
  }
  const doFetch = deps.fetch ?? fetch;
  const res = await doFetch(`${deps.baseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: deps.apikey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await res.body?.cancel();
  if (res.ok) return;
  if (res.status === 429) throw new HttpError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  throw new HttpError(403, 'INVALID_PASSWORD', 'Senha incorreta.');
}
