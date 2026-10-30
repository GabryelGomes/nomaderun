/**
 * Corridas do servidor (RF-006) e progresso ligado a elas: neblina (RF-022) e baús (RF-023).
 * Tabelas `activities`, `activity_points`, `fog_cells`, `chest_opens` (RLS: só as próprias).
 * Repositório do A4 (exceção combinada dentro de `services/api`).
 */
import type { CheatFlag } from '@/domain/anti-cheat';
import type { PaintMilestones } from '@/domain/faction-activity';
import type { OfficialResult, OfficialStatus } from '@/services/sync/types';

import { attempt, type Result } from './errors';
import { requireSupabase } from './supabase';

export type ActivityStatus = 'recording' | OfficialStatus;

/**
 * F8 A2 — marcos da pintura na resposta oficial (`extras.milestones` do `finish-activity`, também em
 * `activities.v2_extras.milestones`): "primeiro trecho pintado" (1 vez na vida) e "recorde de trechos numa corrida".
 * Só existe com a pintura v2 ligada; servidor antigo ou regra v1 → `null` (a tela não comemora nada).
 */
export function paintMilestonesOf(official: unknown): PaintMilestones | null {
  const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const m = o(o(o(official).extras).milestones);
  if (typeof m.firstPaint !== 'boolean') return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const rec = o(m.cellsRecord);
  const value = n(rec.value);
  return {
    firstPaint: m.firstPaint,
    cells: n(m.cells),
    cellsRecord: !m.firstPaint && value > 0 && n(rec.previous) > 0 && value > n(rec.previous) ? { value, previous: n(rec.previous) } : null,
  };
}

export type ActivitySummary = {
  id: string;
  status: ActivityStatus;
  mission: 'livre' | 'fuga' | 'caca';
  startedAt: number;
  endedAt: number | null;
  meters: number;
  movingSeconds: number;
  avgPace: number | null;
  rpTotal: number;
  xp: number;
  flags: CheatFlag[];
  result: OfficialResult | null;
  /** `activities.v2_extras` (contrato v2): o `extras` da resposta oficial, guardado pelo servidor. `null` no servidor v1. */
  extras?: Record<string, unknown> | null;
};

type Row = Record<string, unknown>;

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const ms = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

const STATUSES: readonly ActivityStatus[] = ['recording', 'valid', 'partial', 'rejected', 'review'];

export function toActivity(row: Row): ActivitySummary {
  const status = STATUSES.includes(row.status as ActivityStatus) ? (row.status as ActivityStatus) : 'recording';
  const mission = row.mission === 'fuga' || row.mission === 'caca' ? row.mission : 'livre';
  return {
    id: String(row.id ?? ''),
    status,
    mission,
    startedAt: ms(row.started_at) ?? 0,
    endedAt: ms(row.ended_at),
    meters: num(row.meters),
    movingSeconds: num(row.moving_seconds),
    avgPace: typeof row.avg_pace === 'number' ? row.avg_pace : null,
    rpTotal: num(row.rp_total),
    xp: num(row.xp),
    flags: Array.isArray(row.flags) ? (row.flags as CheatFlag[]) : [],
    result: row.result && typeof row.result === 'object' ? (row.result as OfficialResult) : null,
    extras: row.v2_extras && typeof row.v2_extras === 'object' && !Array.isArray(row.v2_extras) ? (row.v2_extras as Record<string, unknown>) : null,
  };
}

const LEGACY_COLUMNS = 'id,status,mission,started_at,ended_at,meters,moving_seconds,avg_pace,rp_total,xp,flags,result';
const COLUMNS = `${LEGACY_COLUMNS},v2_extras`;

/** Servidor antigo (sem a coluna `v2_extras`): `42703` (Postgres) ou `PGRST204` (cache do PostgREST). */
export const isMissingColumn = (e: unknown) => {
  const code = (e as { code?: unknown } | null)?.code;
  return code === '42703' || code === 'PGRST204';
};

/** Lê com `v2_extras`; no servidor antigo, repete sem a coluna (o histórico nunca quebra por ela). */
async function selectActivities<T>(run: (columns: string) => PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const first = await run(COLUMNS);
  if (!first.error) return first.data;
  if (!isMissingColumn(first.error)) throw first.error;
  const legacy = await run(LEGACY_COLUMNS);
  if (legacy.error) throw legacy.error;
  return legacy.data;
}

/** Corridas do usuário, mais recentes primeiro, opcionalmente num período (`started_at` em [from, to)). */
export async function listMyActivities(opts: { from?: number; to?: number; limit?: number } = {}): Promise<Result<ActivitySummary[]>> {
  return attempt(async () => {
    const data = await selectActivities((columns) => {
      let q = requireSupabase().from('activities').select(columns).order('started_at', { ascending: false }).limit(opts.limit ?? 200);
      if (opts.from !== undefined) q = q.gte('started_at', new Date(opts.from).toISOString());
      if (opts.to !== undefined) q = q.lt('started_at', new Date(opts.to).toISOString());
      return q;
    });
    return ((data ?? []) as unknown as Row[]).map(toActivity);
  });
}

export async function getActivity(id: string): Promise<Result<ActivitySummary | null>> {
  return attempt(async () => {
    const data = await selectActivities((columns) => requireSupabase().from('activities').select(columns).eq('id', id).maybeSingle());
    return data ? toActivity(data as unknown as Row) : null;
  });
}

/** `activities.result` (resposta oficial guardada pelo servidor), ou null se ainda não finalizou. */
export async function getActivityResult(id: string): Promise<Result<OfficialResult | null>> {
  const res = await getActivity(id);
  if (!res.ok) return res;
  return { ok: true, data: res.data?.result ?? null };
}

/** Percurso gravado no servidor (para o mapa do resumo de corridas antigas). */
export async function getActivityPath(id: string, max = 2000): Promise<Result<{ lat: number; lng: number }[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('activity_points').select('lat,lng').eq('activity_id', id).order('seq').limit(max);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((p) => ({ lat: num(p.lat), lng: num(p.lng) }));
  });
}

/** Células de neblina já reveladas pelo usuário (RF-022, gravadas pelo servidor no finish). */
export async function listMyFogCells(): Promise<Result<string[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('fog_cells').select('cell').limit(20000);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => String(r.cell));
  });
}

/** Baús já abertos (RF-023). O servidor ainda não grava baús (P-12): hoje volta vazio. */
export async function listMyChestOpens(): Promise<Result<string[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('chest_opens').select('chest_id').limit(5000);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => String(r.chest_id));
  });
}

export type ServerProgress = { xp: number; trust: number; streakWeeks: number; freezesLeft: number; recentPaces: number[] };

/**
 * Progresso que o servidor calcula (XP, confiança, sequência semanal) e os ritmos das últimas
 * 10 corridas pontuadas — o mesmo contexto que o `finish-activity` usa (ritmo-base, RN-001).
 */
export async function getMyProgress(userId: string): Promise<Result<ServerProgress>> {
  return attempt(async () => {
    const supabase = requireSupabase();
    const [{ data: p, error: pe }, { data: a, error: ae }] = await Promise.all([
      supabase.from('profiles').select('xp,trust,streak_weeks,freezes_left').eq('id', userId).single(),
      supabase.from('activities').select('avg_pace,finished_at').eq('scored', true).gt('avg_pace', 0).order('finished_at', { ascending: false }).limit(10),
    ]);
    if (pe) throw pe;
    if (ae) throw ae;
    const row = (p ?? {}) as Row;
    const paces = ((a ?? []) as Row[]).map((r) => num(r.avg_pace)).filter((v) => v > 0).reverse();
    return { xp: num(row.xp), trust: num(row.trust, 100), streakWeeks: num(row.streak_weeks), freezesLeft: num(row.freezes_left, 1), recentPaces: paces };
  });
}
