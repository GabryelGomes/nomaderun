/**
 * Limite de chamadas por pessoa nas Edge Functions (F8 C3, D-99; S7 de docs/melhoria/F8/04 §6).
 *
 * Onde fica o contador: no banco (`private.rate_limits`, função `svc_rate_limit_hit`, migration
 * 20261104120100_rate_limit.sql), porque cada chamada pode cair num isolate diferente e um contador só em memória
 * deixaria passar N × o limite. Se a função do banco não responder (servidor antigo sem a migration, banco fora do
 * ar), cai para um contador em memória do próprio isolate: o limite fica mais frouxo, mas nunca bloqueia quem não
 * devia e a function continua funcionando (regra 9 da F8: compatível com o servidor v1).
 *
 * Algoritmo (igual nos dois lados): janela deslizante aproximada por duas janelas fixas, a anterior pesando pela
 * fração que ainda cabe na janela atual. Chamada recusada não conta.
 *
 * Baldes (um por chamada; a function escolhe o seu):
 * - `geral`  60/min: register-device, moderate-activity, weekly-recap;
 * - `mapa`   180/min: zones e zone (F8-D, B2: arrastar o mapa por um minuto, com a espera de 600 ms do app, passa de
 *   60 pedidos; o balde próprio não deixa o mapa dar 429 nem consome o limite das outras chamadas);
 * - `ingest` 120/min: ingest-points (a fila offline manda lotes de 200 pontos em rajada ao voltar a rede);
 * - `finish` 10/min: finish-activity (o cálculo mais caro do servidor);
 * - `conta`  5/min: account-export e account-delete (exportação pesada; senha conferida na exclusão).
 * Resposta acima do limite: HTTP 429, `{ error: { code: 'RATE_LIMITED', message, details: { retryAfter } } }` e o
 * cabeçalho `Retry-After` (ver `handler` em http.ts; exposto à web em `Access-Control-Expose-Headers`). O app mostra "Muitas tentativas. Tente de novo em instantes."
 */
import { HttpError } from './http.ts';
import { rpc as dbRpc } from './supabase.ts';

export type RateBucket = 'geral' | 'mapa' | 'ingest' | 'finish' | 'conta';

export const RATE_LIMITS: Readonly<Record<RateBucket, { limit: number; windowSeconds: number }>> = {
  geral: { limit: 60, windowSeconds: 60 },
  mapa: { limit: 180, windowSeconds: 60 },
  ingest: { limit: 120, windowSeconds: 60 },
  finish: { limit: 10, windowSeconds: 60 },
  conta: { limit: 5, windowSeconds: 60 },
};

export const RATE_LIMITED_MESSAGE = 'Muitas tentativas. Tente de novo em instantes.';

export type RateHit = { allowed: boolean; remaining: number; retryAfter: number; source: 'db' | 'memory' };

type Slot = { windowStart: number; hits: number; prevHits: number };

/** Mesmo algoritmo do SQL, em memória (fallback por isolate). `now` em milissegundos. */
export class MemoryRateLimiter {
  private readonly slots = new Map<string, Slot>();
  constructor(private readonly maxKeys = 5000) {}

  hit(key: string, limit: number, windowSeconds: number, now = Date.now()): Omit<RateHit, 'source'> {
    const w = windowSeconds * 1000;
    const start = Math.floor(now / w) * w;
    const elapsed = (now - start) / w;
    const slot = this.slots.get(key);
    let prev = 0;
    let hits = 0;
    if (slot && slot.windowStart === start) {
      prev = slot.prevHits;
      hits = slot.hits;
    } else if (slot && slot.windowStart === start - w) {
      prev = slot.hits;
    }
    const est = prev * (1 - elapsed) + hits;
    // reinsere no fim (o Map guarda a ordem de inserção: as chaves mais antigas saem primeiro)
    this.slots.delete(key);
    if (est + 1 > limit) {
      this.slots.set(key, { windowStart: start, hits, prevHits: prev });
      this.trim();
      const retry =
        hits + 1 > limit
          ? windowSeconds * (1 - elapsed) + windowSeconds * (1 - (limit - 1) / hits)
          : windowSeconds * (1 - (limit - 1 - hits) / prev) - windowSeconds * elapsed;
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.min(windowSeconds, Math.ceil(retry))) };
    }
    this.slots.set(key, { windowStart: start, hits: hits + 1, prevHits: prev });
    this.trim();
    return { allowed: true, remaining: Math.max(0, Math.floor(limit - est - 1)), retryAfter: 0 };
  }

  get size() {
    return this.slots.size;
  }

  private trim() {
    while (this.slots.size > this.maxKeys) {
      const oldest = this.slots.keys().next().value;
      if (oldest === undefined) break;
      this.slots.delete(oldest);
    }
  }
}

const isolateLimiter = new MemoryRateLimiter();

export type RateLimitDeps = {
  rpc?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  memory?: MemoryRateLimiter;
  now?: () => number;
  onFallback?: (error: unknown) => void;
};

function parseDbHit(raw: unknown): Omit<RateHit, 'source'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { allowed?: unknown; remaining?: unknown; retryAfter?: unknown };
  if (typeof r.allowed !== 'boolean') return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  return { allowed: r.allowed, remaining: n(r.remaining), retryAfter: r.allowed ? 0 : Math.max(1, n(r.retryAfter)) };
}

/** Conta 1 chamada da pessoa no balde e diz se passa. Nunca lança: sem banco, usa o contador do isolate. */
export async function checkRateLimit(userId: string, bucket: RateBucket, deps: RateLimitDeps = {}): Promise<RateHit> {
  const { limit, windowSeconds } = RATE_LIMITS[bucket];
  const call = deps.rpc ?? dbRpc;
  try {
    const parsed = parseDbHit(
      await call('svc_rate_limit_hit', { p_user: userId, p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds }),
    );
    if (parsed) return { ...parsed, source: 'db' };
    throw new Error('resposta inesperada de svc_rate_limit_hit');
  } catch (error) {
    (deps.onFallback ?? ((e) => console.warn('rate-limit: usando o contador em memória', e)))(error);
    const hit = (deps.memory ?? isolateLimiter).hit(`${userId}:${bucket}`, limit, windowSeconds, (deps.now ?? Date.now)());
    return { ...hit, source: 'memory' };
  }
}

/** Lança HTTP 429 `RATE_LIMITED` (com `details.retryAfter`) quando a pessoa passou do limite do balde. */
export async function enforceRateLimit(userId: string, bucket: RateBucket, deps: RateLimitDeps = {}): Promise<void> {
  const hit = await checkRateLimit(userId, bucket, deps);
  if (!hit.allowed) {
    throw new HttpError(429, 'RATE_LIMITED', RATE_LIMITED_MESSAGE, { retryAfter: hit.retryAfter });
  }
}
