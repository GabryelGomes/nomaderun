/**
 * T7.3.7 (E8) — recap semanal: `weekly_recap(p_week_start)` da E9 (onda 3), no contrato que a E8 pediu na F1
 * (`docs/melhoria/F1/08-social.md` §9, item 6) e alinhado no relatório `E8-onda3.md`:
 *
 * ```
 * weekly_recap(p_week_start date default null)  -- null = a semana de hoje (segunda, fuso de Brasília)
 *   → { weekStart: 'AAAA-MM-DD', days: number[7] (metros, seg → dom), runs, meters, movingSeconds,
 *       zones (conquistadas na semana), zonesHeld (as que a pessoa ainda domina), streakWeeks,
 *       activityIds: uuid[] (até 3 corridas pontuadas mais longas, para as mini-rotas), isDemo }
 * ```
 *
 * Privacidade: o card **não** usa rota do servidor. As mini-rotas saem do `activity_points` das próprias
 * corridas (`activityIds`) cortadas no aparelho pelo domain (`clipRouteForSharing`), como o card da corrida.
 * Se o servidor também mandar `routes` (polylines), o app ignora.
 *
 * Leitura tolerante: aceita `camelCase` e `snake_case`; campo estranho vira o neutro. Servidor antigo ou flag
 * desligada (`PGRST202`, `42883`, `FEATURE_DISABLED`) → `RECAP_UNAVAILABLE` (o app monta o recap das próprias
 * corridas).
 */
import { AppError, attempt, type Result } from './errors';
import { requireSupabase } from './supabase';

export const RECAP_UNAVAILABLE = 'RECAP_UNAVAILABLE';

export type WeeklyRecap = {
  /** Segunda-feira da semana, `AAAA-MM-DD`. */
  weekStart: string;
  /** Metros por dia, de segunda (0) a domingo (6). */
  dayMeters: number[];
  runs: number;
  meters: number;
  movingSeconds: number;
  /** Zonas conquistadas na semana. */
  zones: number;
  /** Zonas que a pessoa ainda domina (`null` quando o servidor não manda). */
  zonesHeld: number | null;
  streakWeeks: number;
  /** Até 3 corridas da semana para as mini-rotas (o app corta as rotas). */
  activityIds: string[];
  isDemo: boolean;
};

type Row = Record<string, unknown>;

const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const nonNeg = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);
const pick = (row: Row, ...keys: string[]) => keys.map((k) => row[k]).find((v) => v !== undefined && v !== null);
export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Converte a resposta do `weekly_recap` sem confiar no formato. */
export function toWeeklyRecap(data: unknown, fallbackWeekStart: string): WeeklyRecap {
  const d = obj(data);
  const rawDays = pick(d, 'days', 'dayMeters', 'day_meters');
  const days = Array.from({ length: 7 }, (_, i) => {
    const v = Array.isArray(rawDays) ? rawDays[i] : 0;
    return nonNeg(typeof v === 'object' && v !== null ? obj(v).meters : v);
  });
  const ids = pick(d, 'activityIds', 'activity_ids', 'topActivities', 'top_activities');
  const activityIds = (Array.isArray(ids) ? ids : [])
    .map((v) => (typeof v === 'string' ? v : typeof obj(v).id === 'string' ? (obj(v).id as string) : ''))
    .filter(Boolean)
    .slice(0, 3);
  const meters = nonNeg(pick(d, 'meters', 'totalMeters', 'total_meters'));
  const held = pick(d, 'zonesHeld', 'zones_held');
  const weekStart = pick(d, 'weekStart', 'week_start');
  return {
    weekStart: isIsoDate(weekStart) ? weekStart : fallbackWeekStart,
    dayMeters: days,
    runs: Math.round(nonNeg(pick(d, 'runs', 'activities'))),
    meters: meters || days.reduce((s, m) => s + m, 0),
    movingSeconds: nonNeg(pick(d, 'movingSeconds', 'moving_seconds')),
    zones: Math.round(nonNeg(pick(d, 'zones', 'zonesConquered', 'zones_conquered'))),
    zonesHeld: typeof held === 'number' && Number.isFinite(held) ? Math.max(0, Math.round(held)) : null,
    streakWeeks: Math.round(nonNeg(pick(d, 'streakWeeks', 'streak_weeks'))),
    activityIds,
    isDemo: d.isDemo === true || d.is_demo === true,
  };
}

const UNAVAILABLE_DETAILS = new Set(['PGRST202', 'PGRST205', '42883', '42P01', 'FEATURE_DISABLED']);

/** Servidor sem o `weekly_recap` (ou flag desligada): o app monta o recap das próprias corridas. */
export function isRecapUnavailable(error: AppError): boolean {
  return error.detail === RECAP_UNAVAILABLE || (!!error.detail && UNAVAILABLE_DETAILS.has(error.detail));
}

/** A semana `weekStart` (`AAAA-MM-DD`, segunda). */
export async function getWeeklyRecap(weekStart: string): Promise<Result<WeeklyRecap>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('weekly_recap', { p_week_start: weekStart });
    if (error) throw error;
    return toWeeklyRecap(data, weekStart);
  });
  if (res.ok || !isRecapUnavailable(res.error)) return res;
  return { ok: false, error: new AppError('SERVER', 'O recap semanal ainda não está disponível.', { detail: RECAP_UNAVAILABLE }) };
}
