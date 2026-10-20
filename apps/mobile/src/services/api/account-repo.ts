import { AppError, MESSAGES, type Result } from './errors';
import { callFunction } from './functions';

/** Palavra que o usuário digita para confirmar a exclusão (contrato: `{ confirm: "EXCLUIR" }`). */
export const DELETE_CONFIRMATION = 'EXCLUIR';

/** LGPD: exportação completa dos dados pessoais em JSON (RF-002, RNF-013). */
export function exportMyData(): Promise<Result<unknown>> {
  return callFunction<unknown>('account-export', { method: 'GET' });
}

/** Códigos do servidor para "senha atual errada" (`account-delete` devolve 403 `INVALID_PASSWORD`, D-50). */
const WRONG_PASSWORD_CODES = new Set(['INVALID_PASSWORD', 'WRONG_PASSWORD', 'invalid_credentials']);

/** O servidor recusou a senha atual? (QA-06). Sessão expirada, limite de tentativas etc. não contam. */
export function isWrongPasswordError(e: AppError): boolean {
  return e.code !== 'RATE_LIMITED' && Boolean(e.detail && WRONG_PASSWORD_CODES.has(e.detail));
}

/**
 * LGPD: exclusão da conta e dos dados pessoais, com a senha atual (reautenticação, QA-06).
 * Envia `{ confirm: "EXCLUIR", password }`; o servidor confere a senha no Auth antes de excluir.
 * O app faz logout logo depois.
 */
export async function deleteMyAccount(password: string): Promise<Result<unknown>> {
  if (!password) return { ok: false, error: new AppError('VALIDATION', MESSAGES.passwordRequired, { detail: 'PASSWORD_REQUIRED' }) };
  const res = await callFunction<unknown>('account-delete', { method: 'POST', body: { confirm: DELETE_CONFIRMATION, password } });
  if (!res.ok && isWrongPasswordError(res.error)) {
    return { ok: false, error: new AppError('UNAUTHORIZED', MESSAGES.wrongPassword, { detail: res.error.detail, status: res.error.status }) };
  }
  return res;
}
