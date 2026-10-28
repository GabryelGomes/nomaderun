/**
 * T7.3.8 (pedido da E8) — resumo da semana para o card "Minha semana". Puro, exceto pela semente (`randomSeed`).
 *
 * O SQL (`svc_weekly_recap`) dá os números (sem horário), até 3 corridas candidatas e as zonas de privacidade. Aqui
 * cada rota passa pelo mesmo caminho do feed (D-79): trechos válidos → `clipRouteForSharing` do domain com semente
 * NOVA a cada chamada → simplificação (≤ 80 pontos) → polyline de precisão 4 → conferência da linha desenhada. Rota
 * que não passa na conferência fica de fora. A resposta é montada por lista branca: ids de corrida e zonas de
 * privacidade nunca saem.
 */
import { type PrivacyCircle, validateActivity } from './domain.ts';
import { buildFeedRoute } from './feed.ts';
import { HttpError } from './http.ts';
import { type StoredPoint, toGeoPoints } from './scoring.ts';
import { validRoute } from './v2.ts';

export const RECAP_MAX_ROUTES = 3;

/** O que o SQL devolve para a function (service role). */
export type SvcWeeklyRecap = {
  weekStart: string;
  weekEnd: string;
  final: boolean;
  days: number[];
  meters: number;
  runs: number;
  movingSeconds: number;
  zones: number;
  streakWeeks: number;
  isDemo: boolean;
  routeIds: string[];
  privacyZones: PrivacyCircle[];
};

/** Um pedaço de rota por polyline (precisão 4), igual ao `route` do feed (`ServerClippedRoute` no app). */
export type RecapRoute = { pieces: string[]; routeHidden: boolean };

/** Resposta de `weekly-recap` (contrato). */
export type WeeklyRecap = Omit<SvcWeeklyRecap, 'routeIds' | 'privacyZones'> & { routes: RecapRoute[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `{ weekStart?: 'YYYY-MM-DD' | null }` (corpo do POST) ou `?weekStart=` (GET). A segunda-feira é conferida no SQL. */
export function parseRecapInput(body: unknown): { weekStart: string | null } {
  if (body === null || body === undefined) return { weekStart: null };
  if (typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION', 'Corpo inválido.');
  const keys = Object.keys(body as Record<string, unknown>);
  if (keys.some((k) => k !== 'weekStart')) throw new HttpError(400, 'VALIDATION', 'Campo desconhecido.');
  const w = (body as { weekStart?: unknown }).weekStart;
  if (w === undefined || w === null || w === '') return { weekStart: null };
  // data que existe no calendário (2026-02-31 não passa: viraria erro de SQL em vez de VALIDATION)
  const parsed = typeof w === 'string' && DATE_RE.test(w) ? new Date(`${w}T12:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== w) {
    throw new HttpError(400, 'VALIDATION', 'weekStart deve ser uma data AAAA-MM-DD.');
  }
  return { weekStart: w };
}

/** Rota de uma corrida, já cortada (ou null quando não sobra rota segura). */
export function recapRoute(points: readonly StoredPoint[], zones: readonly PrivacyCircle[], seed: number): RecapRoute | null {
  if (points.length < 2) return null;
  const geo = toGeoPoints([...points]);
  const route = validRoute(geo, validateActivity(geo));
  const clipped = buildFeedRoute(route, zones, { seed, showMap: true });
  return clipped.route ? { pieces: clipped.route, routeHidden: clipped.routeHidden } : null;
}

const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

/** Monta a resposta por lista branca (nada do SQL passa sem estar aqui). */
export function recapResponse(svc: SvcWeeklyRecap, routes: readonly (RecapRoute | null)[]): WeeklyRecap {
  const days = Array.from({ length: 7 }, (_, i) => int(svc.days?.[i]));
  return {
    weekStart: String(svc.weekStart),
    weekEnd: String(svc.weekEnd),
    final: svc.final === true,
    days,
    meters: int(svc.meters),
    runs: int(svc.runs),
    movingSeconds: int(svc.movingSeconds),
    zones: int(svc.zones),
    streakWeeks: int(svc.streakWeeks),
    isDemo: svc.isDemo === true,
    routes: routes.filter((r): r is RecapRoute => r !== null).slice(0, RECAP_MAX_ROUTES),
  };
}
