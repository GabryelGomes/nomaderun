import { callFunction } from './functions';
import type { Result } from './errors';

/** Palavra que o usuário digita para confirmar a exclusão (contrato: `{ confirm: "EXCLUIR" }`). */
export const DELETE_CONFIRMATION = 'EXCLUIR';

/** LGPD: exportação completa dos dados pessoais em JSON (RF-002, RNF-013). */
export function exportMyData(): Promise<Result<unknown>> {
  return callFunction<unknown>('account-export', { method: 'GET' });
}

/** LGPD: exclusão da conta e dos dados pessoais. O app faz logout logo depois. */
export function deleteMyAccount(): Promise<Result<unknown>> {
  return callFunction<unknown>('account-delete', { method: 'POST', body: { confirm: DELETE_CONFIRMATION } });
}
