/**
 * T7.3.7 (E8) — recap semanal (card "Minha semana"): Edge Function `POST /weekly-recap { weekStart? }` da E9
 * (`docs/API_CONTRATO.md`, "Resumo da semana"):
 *
 * ```
 * { weekStart, weekEnd, final, days: number[7] (metros, seg → dom), meters, runs, movingSeconds,
 *   zones (conquistadas na semana), streakWeeks, isDemo,
 *   routes: [{ pieces: string[] (polyline de precisão 4), routeHidden }] }   // até 3, as mais longas
 * ```
 *
 * Privacidade: cada rota já sai cortada no servidor pelo `clipRouteForSharing` do domain (semente nova, ≤ 80
 * pontos, conferida contra as zonas de privacidade). Aqui ela só é decodificada (`ServerClippedRoute`); o card a
 * recebe pelo adaptador `ownRouteFromServer` (recap-model), **sem cortar de novo**.
 *
 * Leitura tolerante: campo ausente ou estranho vira o neutro. Servidor antigo (404 `NOT_AVAILABLE`, function
 * inexistente) → `RECAP_UNAVAILABLE`: o app monta o recap das próprias corridas (`recapFromActivities`) e corta
 * as rotas no aparelho.
 */
import { AppError, type Result } from './errors';
import { decodeServerRoute, type ServerClippedRoute } from './feed-repo';
import { callFunction } from './functions';

export const RECAP_UNAVAILABLE = 'RECAP_UNAVAILABLE';

export type WeeklyRecap = {
  /** Segunda-feira da semana, `AAAA-MM-DD`. */
  weekStart: string;
  /** Domingo, `AAAA-MM-DD`. */
  weekEnd: string;
  /** A semana já acabou. */
  final: boolean;
  /** Metros por dia, de segunda (0) a domingo (6). */
  dayMeters: number[];
  runs: number;
  meters: number;
  movingSeconds: number;
  /** Zonas conquistadas na semana. */
  zones: number;
  streakWeeks: number;
  /** Rotas cortadas no servidor (até 3). Vazio no recap local. */
  routes: ServerClippedRoute[];
  /** Só no recap local: corridas para as mini-rotas (cortadas no aparelho). */
  activityIds: string[];
  isDemo: boolean;
};

type Row = Record<string, unknown>;

const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const nonNeg = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);
export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Domingo da semana que começa em `weekStart`. */
function sundayOf(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
}

/** Converte a resposta do `weekly-recap` sem confiar no formato. */
export function toWeeklyRecap(data: unknown, fallbackWeekStart: string): WeeklyRecap {
  const d = obj(data);
  const days = Array.from({ length: 7 }, (_, i) => nonNeg(Array.isArray(d.days) ? d.days[i] : 0));
  const weekStart = isIsoDate(d.weekStart) ? d.weekStart : fallbackWeekStart;
  const routes = (Array.isArray(d.routes) ? d.routes : [])
    .slice(0, 3)
    .map((r) => decodeServerRoute(obj(r).pieces))
    .filter((r): r is ServerClippedRoute => r !== null);
  return {
    weekStart,
    weekEnd: isIsoDate(d.weekEnd) ? d.weekEnd : isIsoDate(weekStart) ? sundayOf(weekStart) : '',
    final: d.final === true,
    dayMeters: days,
    runs: Math.round(nonNeg(d.runs)),
    meters: nonNeg(d.meters) || days.reduce((s, m) => s + m, 0),
    movingSeconds: nonNeg(d.movingSeconds),
    zones: Math.round(nonNeg(d.zones)),
    streakWeeks: Math.round(nonNeg(d.streakWeeks)),
    routes,
    activityIds: [],
    isDemo: d.isDemo === true,
  };
}

/** Servidor sem o recap (function inexistente ou `NOT_AVAILABLE`): o app monta o recap das corridas. */
export function isRecapUnavailable(error: AppError): boolean {
  return error.detail === RECAP_UNAVAILABLE || error.detail === 'NOT_AVAILABLE' || error.status === 404;
}

/** A semana `weekStart` (`AAAA-MM-DD`, segunda); sem ela, a semana atual (Brasília). */
export async function getWeeklyRecap(weekStart?: string | null): Promise<Result<WeeklyRecap>> {
  const res = await callFunction<unknown>('weekly-recap', { method: 'POST', body: weekStart ? { weekStart } : {} });
  if (res.ok) return { ok: true, data: toWeeklyRecap(res.data, weekStart ?? '') };
  if (!isRecapUnavailable(res.error)) return res;
  return { ok: false, error: new AppError('SERVER', 'O resumo da semana ainda não está disponível.', { detail: RECAP_UNAVAILABLE, status: res.error.status }) };
}
