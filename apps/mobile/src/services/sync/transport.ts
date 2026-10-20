/**
 * Transporte do sync sobre o supabase-js (Edge Functions com o JWT da sessão).
 * Diferente do `callFunction` genérico, preserva `error.details.lastSeq` do contrato, que o sync
 * precisa para `OUT_OF_ORDER` e `MISSING_POINTS`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from '@/services/api/supabase';
import { getActivityResult } from '@/services/api/activities-repo';

import type { ApiFailure, ApiResult, SyncTransport } from './types';

const NETWORK_MESSAGE = 'Sem conexão com a internet. A corrida fica guardada no aparelho e será enviada quando a conexão voltar.';

export async function parseFunctionsError(error: unknown): Promise<ApiFailure> {
  const e = error as { name?: string; message?: string; context?: unknown };
  if (e?.name === 'FunctionsHttpError' && e.context && typeof e.context === 'object' && 'status' in e.context) {
    const res = e.context as { status: number; clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> };
    let body: unknown;
    try {
      body = await (res.clone ? res.clone().json() : res.json?.());
    } catch {
      body = undefined;
    }
    const err = (body as { error?: { code?: unknown; message?: unknown; details?: unknown } } | undefined)?.error;
    const details = err?.details && typeof err.details === 'object' ? (err.details as { lastSeq?: unknown }) : undefined;
    return {
      code: typeof err?.code === 'string' ? err.code : `HTTP_${res.status}`,
      status: res.status,
      message: typeof err?.message === 'string' ? err.message : 'O servidor não respondeu como esperado.',
      details: typeof details?.lastSeq === 'number' ? { lastSeq: details.lastSeq } : undefined,
    };
  }
  if (e?.name === 'FunctionsRelayError') return { code: 'HTTP_502', status: 502, message: 'O servidor não respondeu como esperado.' };
  return { code: 'NETWORK', status: 0, message: NETWORK_MESSAGE };
}

export function createSupabaseTransport(get: () => SupabaseClient | null = getSupabase): SyncTransport {
  async function invoke<T>(name: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
    const client = get();
    if (!client) return { ok: false, error: { code: 'NOT_CONFIGURED', status: 0, message: 'Backend não configurado.' } };
    try {
      const { data, error } = await client.functions.invoke(name, { method: 'POST', body });
      if (error) return { ok: false, error: await parseFunctionsError(error) };
      return { ok: true, data: data as T };
    } catch (err) {
      return { ok: false, error: await parseFunctionsError(err) };
    }
  }
  return {
    registerDevice: (body) => invoke('register-device', body),
    ingest: (body) => invoke('ingest-points', body as unknown as Record<string, unknown>),
    finish: (body) => invoke('finish-activity', body),
    refreshSession: async () => {
      const client = get();
      if (!client) return false;
      try {
        const { data, error } = await client.auth.refreshSession();
        return !error && !!data.session;
      } catch {
        return false;
      }
    },
    fetchResult: async (activityId) => {
      const res = await getActivityResult(activityId);
      if (res.ok) return { ok: true, data: res.data };
      return { ok: false, error: { code: res.error.code, status: res.error.status ?? 0, message: res.error.message } };
    },
  };
}
