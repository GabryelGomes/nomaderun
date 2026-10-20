/**
 * Acesso ao Supabase via HTTP (fetch) — sem dependências npm, para as functions subirem mesmo sem
 * internet no container (D-22). Service role só aqui, no servidor.
 */
import { HttpError } from './http.ts';

const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`variável de ambiente ausente: ${name}`);
  return v;
};

const baseUrl = () => env('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = () => Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey();

export type AuthUser = { id: string; email?: string };

/** Confere o JWT do usuário no Auth (também recusa usuário excluído ou banido). */
export async function requireUser(req: Request): Promise<AuthUser> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Faça login para continuar.');
  const res = await fetch(`${baseUrl()}/auth/v1/user`, {
    headers: { apikey: anonKey(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError(401, 'UNAUTHORIZED', 'Sessão expirada ou inválida. Faça login novamente.');
  }
  const user = (await res.json()) as { id?: string; email?: string; role?: string };
  if (!user.id) throw new HttpError(401, 'UNAUTHORIZED', 'Sessão inválida. Faça login novamente.');
  return { id: user.id, email: user.email };
}

export class DbError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function serviceHeaders(extra: Record<string, string> = {}) {
  const key = serviceKey();
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

/** Chama uma função SQL (RPC) com o service role. */
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${baseUrl()}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    let code = String(res.status);
    try {
      const body = JSON.parse(text) as { message?: string; code?: string };
      message = body.message ?? text;
      code = body.code ?? code;
    } catch { /* corpo não-JSON */ }
    throw new DbError(code, message, res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** SELECT simples via PostgREST com o service role (consultas pequenas). */
export async function select<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${baseUrl()}/rest/v1/${table}?${query}`, { headers: serviceHeaders() });
  if (!res.ok) throw new DbError(String(res.status), await res.text(), res.status);
  return (await res.json()) as T[];
}

/** Remove o usuário do Auth (LGPD). Os dados ligados ao perfil caem em cascata. */
export async function deleteAuthUser(userId: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new DbError(String(res.status), await res.text(), res.status);
  await res.body?.cancel();
}

/** Apaga os arquivos do usuário no bucket de avatares (LGPD). Sem Storage ativo, não faz nada. */
export async function deleteUserAvatars(userId: string): Promise<number> {
  try {
    const list = await fetch(`${baseUrl()}/storage/v1/object/list/avatars`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({ prefix: userId, limit: 100 }),
    });
    if (!list.ok) {
      await list.body?.cancel();
      return 0;
    }
    const files = (await list.json()) as { name: string }[];
    if (files.length === 0) return 0;
    const del = await fetch(`${baseUrl()}/storage/v1/object/avatars`, {
      method: 'DELETE',
      headers: serviceHeaders(),
      body: JSON.stringify({ prefixes: files.map((f) => `${userId}/${f.name}`) }),
    });
    await del.body?.cancel();
    return del.ok ? files.length : 0;
  } catch {
    return 0;
  }
}

/** Converte "CODIGO: mensagem" levantado pelo SQL em HttpError. */
export function sqlErrorToHttp(e: unknown, status = 409): never {
  if (e instanceof DbError) {
    const m = /^([A-Z_]+): (.*)$/s.exec(e.message);
    if (m) throw new HttpError(status, m[1], m[2]);
  }
  throw e;
}
