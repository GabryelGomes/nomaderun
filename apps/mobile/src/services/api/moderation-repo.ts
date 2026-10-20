import { attempt, type Result } from './errors';
import { callFunction } from './functions';
import { requireSupabase } from './supabase';
import { isFaction, type ProfileRole } from './types';
import type { FactionId } from '@/domain/types';

/**
 * Painel de moderação (RF-018, D-08). Staff lê todas as corridas e pontos (RLS `is_staff()`);
 * decisões só pela function `moderate-activity`; status de conta só por `admin_set_user_status` (admin).
 */
export type ReviewActivity = {
  id: string;
  userId: string;
  username: string;
  trust: number | null;
  status: string;
  startedAt: number;
  meters: number;
  movingSeconds: number;
  avgPace: number | null;
  flags: string[];
  reviewReason: string | null;
  invalidSegments: { fromSeq: number; toSeq: number; code: string; reason: string }[];
};

export type ActivityPoint = { seq: number; lat: number; lng: number; t: number; accuracy: number | null; speed: number | null; steps: number | null; mocked: boolean | null };

export type ModerationReview = { decision: 'approve' | 'reject'; justification: string; createdAt: number };

export type ReviewDetail = ReviewActivity & { points: ActivityPoint[]; reviews: ModerationReview[] };

export type ManagedUser = { id: string; username: string; role: ProfileRole; status: string; trust: number; faction: FactionId | null; city: string | null };

type Row = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ms = (v: unknown) => (typeof v === 'string' ? Date.parse(v) || 0 : num(v));

export const JUSTIFICATION_MIN = 10;
export const JUSTIFICATION_MAX = 1000;

/** Mesma regra do servidor: justificativa obrigatória de 10 a 1000 caracteres (sem contar espaços nas pontas). */
export function validateJustification(text: string): string | null {
  const t = text.trim();
  if (t.length === 0) return 'Escreva a justificativa da decisão.';
  if (t.length < JUSTIFICATION_MIN) return `A justificativa precisa ter pelo menos ${JUSTIFICATION_MIN} caracteres.`;
  if (t.length > JUSTIFICATION_MAX) return `A justificativa pode ter no máximo ${JUSTIFICATION_MAX} caracteres.`;
  return null;
}

function toReviewActivity(r: Row, profiles: Map<string, Row>): ReviewActivity {
  const p = profiles.get(String(r.user_id)) ?? {};
  const segs = Array.isArray(r.invalid_segments) ? (r.invalid_segments as Row[]) : [];
  return {
    id: String(r.id),
    userId: String(r.user_id),
    username: typeof p.username === 'string' ? p.username : 'Corredor',
    trust: numOrNull(p.trust),
    status: String(r.status ?? ''),
    startedAt: ms(r.started_at),
    meters: num(r.meters),
    movingSeconds: num(r.moving_seconds),
    avgPace: numOrNull(r.avg_pace),
    flags: Array.isArray(r.flags) ? (r.flags as string[]) : [],
    reviewReason: typeof r.review_reason === 'string' ? r.review_reason : null,
    invalidSegments: segs.map((s) => ({ fromSeq: num(s.fromSeq), toSeq: num(s.toSeq), code: String(s.code ?? ''), reason: String(s.reason ?? '') })),
  };
}

const ACTIVITY_COLS = 'id,user_id,status,started_at,meters,moving_seconds,avg_pace,flags,review_reason,invalid_segments';

async function profilesById(ids: string[]): Promise<Map<string, Row>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await requireSupabase().from('staff_profiles').select('id,username,trust').in('id', ids);
  if (error) throw error;
  return new Map(((data ?? []) as Row[]).map((p) => [String(p.id), p]));
}

export async function listActivitiesInReview(): Promise<Result<ReviewActivity[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('activities').select(ACTIVITY_COLS).eq('status', 'review').order('started_at', { ascending: true }).limit(100);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    const profiles = await profilesById([...new Set(rows.map((r) => String(r.user_id)))]);
    return rows.map((r) => toReviewActivity(r, profiles));
  });
}

/** O PostgREST devolve no máximo 1.000 linhas por pedido: busca o percurso em páginas. */
const POINTS_PAGE = 1000;
async function fetchAllPoints(activityId: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; from < 20 * POINTS_PAGE; from += POINTS_PAGE) {
    const { data, error } = await requireSupabase()
      .from('activity_points')
      .select('seq,lat,lng,t,accuracy,speed,steps,mocked')
      .eq('activity_id', activityId)
      .order('seq')
      .range(from, from + POINTS_PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < POINTS_PAGE) break;
  }
  return all;
}

export async function getReviewDetail(activityId: string): Promise<Result<ReviewDetail>> {
  return attempt(async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('activities').select(ACTIVITY_COLS).eq('id', activityId).single();
    if (error) throw error;
    const row = data as Row;
    const [profiles, pts, reviews] = await Promise.all([
      profilesById([String(row.user_id)]),
      fetchAllPoints(activityId),
      supabase.from('moderation_reviews').select('decision,justification,created_at').eq('activity_id', activityId).order('created_at', { ascending: false }),
    ]);
    if (reviews.error) throw reviews.error;
    return {
      ...toReviewActivity(row, profiles),
      points: pts.map((p) => ({
        seq: num(p.seq),
        lat: num(p.lat),
        lng: num(p.lng),
        t: num(p.t),
        accuracy: numOrNull(p.accuracy),
        speed: numOrNull(p.speed),
        steps: numOrNull(p.steps),
        mocked: typeof p.mocked === 'boolean' ? p.mocked : null,
      })),
      reviews: ((reviews.data ?? []) as Row[]).map((r) => ({
        decision: r.decision === 'approve' ? 'approve' : 'reject',
        justification: String(r.justification ?? ''),
        createdAt: ms(r.created_at),
      })),
    };
  });
}

export type ModerationDecision = 'approve' | 'reject';
export type ModerationResult = { activityId: string; decision: ModerationDecision; status: string; result?: { rpTotal?: number; zones?: unknown[] } };

export async function moderateActivity(activityId: string, decision: ModerationDecision, justification: string): Promise<Result<ModerationResult>> {
  return callFunction<ModerationResult>('moderate-activity', { method: 'POST', body: { activityId, decision, justification: justification.trim() } });
}

/** Admin: lista contas pela view `staff_profiles` (só staff vê linhas; sem data de nascimento, QA-16/D-50). */
export async function listUsers(search: string, limit = 50): Promise<Result<ManagedUser[]>> {
  return attempt(async () => {
    let q = requireSupabase().from('staff_profiles').select('id,username,role,status,trust,faction,city');
    const term = search.trim().replace(/[%*,()]/g, ''); // '_' fica: casa com qualquer caractere (busca mais ampla, sem risco)
    if (term) q = q.ilike('username', `%${term}%`);
    const { data, error } = await q.order('username').limit(limit);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      username: String(r.username ?? ''),
      role: r.role === 'admin' || r.role === 'moderator' ? r.role : 'runner',
      status: String(r.status ?? 'active'),
      trust: num(r.trust, 100),
      faction: isFaction(r.faction) ? r.faction : null,
      city: typeof r.city === 'string' ? r.city : null,
    }));
  });
}

export type UserStatus = 'active' | 'inactive' | 'suspended';

export async function setUserStatus(userId: string, status: UserStatus): Promise<Result<{ userId: string; status: UserStatus }>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().rpc('admin_set_user_status', { p_user_id: userId, p_status: status });
    if (error) throw error;
    const d = (data ?? {}) as Row;
    return { userId: String(d.userId ?? userId), status: (d.status as UserStatus) ?? status };
  });
}
