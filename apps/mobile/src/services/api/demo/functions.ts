/**
 * As 8 Edge Functions do contrato (`docs/API_CONTRATO.md`) no servidor de demonstração.
 * Respostas e erros no formato do `supabase.functions.invoke`: `{ data, error }`, com o erro igual ao
 * `FunctionsHttpError` (status e corpo `{ error: { code, message, details } }` em `context`).
 */
import type { FunctionName } from '../functions';

import type { DemoDb, Row } from './db';
import { withEngagementExtras } from './engagement';
import { weeklyRecapDemo } from './social';
import { accountDelete, accountExport, DemoHttpError, finishActivity, ingestPoints, moderateActivity, registerDevice, zoneDetail, zonesInBbox } from './server';

export type FunctionRequest = { method: string; query: URLSearchParams; body: Row };
type FunctionHandler = (db: DemoDb, userId: string, req: FunctionRequest) => unknown;

export const DEMO_FUNCTION_HANDLERS: Record<FunctionName, FunctionHandler> = {
  'register-device': (db, userId, req) => registerDevice(db, userId, req.body),
  'ingest-points': (db, userId, req) => ingestPoints(db, userId, req.body),
  'finish-activity': (db, userId, req) => withEngagementExtras(db, userId, finishActivity(db, userId, req.body)),
  zones: (db, _u, req) => zonesInBbox(db, req.query.get('bbox')),
  zone: (db, _u, req) => zoneDetail(db, req.query.get('id')),
  'moderate-activity': (db, userId, req) => moderateActivity(db, userId, req.body),
  'account-export': (db, userId) => accountExport(db, userId),
  'account-delete': (db, userId, req) => accountDelete(db, userId, req.body),
  'weekly-recap': (db, userId, req) => weeklyRecapDemo(db, userId, req.body.weekStart ?? req.query.get('weekStart'), true),
};

/** Nomes das functions que o servidor de demonstração atende (o teste de contrato confere). */
export const DEMO_FUNCTIONS = Object.keys(DEMO_FUNCTION_HANDLERS).sort() as FunctionName[];

/** Erro igual ao `FunctionsHttpError` do supabase-js: o app lê `context.status` e `context.clone().json()`. */
export function functionsHttpError(status: number, body: unknown) {
  const context = { status, clone: () => ({ json: async () => body }), json: async () => body };
  return Object.assign(new Error('Edge Function returned a non-2xx status code'), { name: 'FunctionsHttpError', context });
}

export function functionsFetchError() {
  return Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError', context: {} });
}

export function runFunction(db: DemoDb, userId: string | null, path: string, opts: { method?: string; body?: unknown } = {}): { data: unknown; error: unknown } {
  const [name, qs] = path.split('?');
  const handler = DEMO_FUNCTION_HANDLERS[name as FunctionName];
  if (!handler) return { data: null, error: functionsHttpError(404, { error: { code: 'NOT_FOUND', message: `Function ${name} não existe na demonstração.` } }) };
  if (!userId) return { data: null, error: functionsHttpError(401, { error: { code: 'UNAUTHORIZED', message: 'Sessão inválida. Entre de novo.' } }) };
  try {
    // Ida e volta em JSON, como na rede: ninguém guarda referência aos objetos do "servidor".
    const body = opts.body && typeof opts.body === 'object' ? (JSON.parse(JSON.stringify(opts.body)) as Row) : {};
    const data = handler(db, userId, { method: opts.method ?? 'POST', query: new URLSearchParams(qs ?? ''), body });
    return { data: JSON.parse(JSON.stringify(data ?? null)), error: null };
  } catch (e) {
    if (e instanceof DemoHttpError) {
      return { data: null, error: functionsHttpError(e.status, { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } }) };
    }
    return { data: null, error: functionsHttpError(500, { error: { code: 'INTERNAL', message: e instanceof Error ? e.message : 'Erro interno da demonstração.' } }) };
  }
}
