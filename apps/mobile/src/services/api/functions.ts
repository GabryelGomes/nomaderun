import { AppError, fail, fromHttp, ok, toAppError, type Result } from './errors';
import { requireSupabase } from './supabase';

/**
 * Chamada às Edge Functions do contrato (`docs/API_CONTRATO.md`).
 * O supabase-js envia o JWT da sessão atual em `Authorization: Bearer` automaticamente.
 * Erros seguem o corpo `{ error: { code, message } }` do contrato e viram AppError.
 */
export type FunctionName =
  | 'register-device'
  | 'ingest-points'
  | 'finish-activity'
  | 'zones'
  | 'zone'
  | 'moderate-activity'
  | 'account-export'
  | 'account-delete'
  | 'weekly-recap';

export type CallOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  query?: Record<string, string | number>;
};

export function buildFunctionPath(name: FunctionName, query?: CallOptions['query']): string {
  if (!query || Object.keys(query).length === 0) return name;
  const qs = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${name}?${qs}`;
}

/** Lê o corpo de erro do contrato a partir da Response guardada em `FunctionsHttpError.context`. */
export async function errorFromFunctions(error: unknown): Promise<AppError> {
  const ctx = (error as { name?: string; context?: unknown })?.context;
  if ((error as { name?: string })?.name === 'FunctionsHttpError' && ctx && typeof ctx === 'object' && 'status' in ctx) {
    const res = ctx as { status: number; clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> };
    let body: unknown;
    try {
      body = await (res.clone ? res.clone().json() : res.json?.());
    } catch {
      body = undefined;
    }
    return fromHttp(res.status, body);
  }
  return toAppError(error);
}

export async function callFunction<T>(name: FunctionName, opts: CallOptions = {}): Promise<Result<T>> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.functions.invoke(buildFunctionPath(name, opts.query), {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      body: opts.body,
    });
    if (error) return fail(await errorFromFunctions(error));
    return ok(data as T);
  } catch (e) {
    return fail(toAppError(e));
  }
}
