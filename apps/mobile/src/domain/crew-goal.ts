/**
 * D-88 — Meta semanal de km da crew.
 *
 * - A meta da semana (segunda 00:00 a domingo 23:59, Brasília) é 10 km por membro atual da crew,
 *   com piso de 20 km (crew de 1 ou 2 pessoas) e teto de 300 km (30 membros, o máximo da crew).
 * - O progresso soma os km das corridas aceitas (`valid` ou `partial`, pontuadas) dos membros atuais na semana.
 * - O servidor é o oficial (`crew_week_goal()`, mesma conta em SQL); o app só mostra.
 */

export const CREW_GOAL_KM_PER_MEMBER = 10;
export const CREW_GOAL_MIN_KM = 20;
export const CREW_GOAL_MAX_KM = 300;

const safe = (v: number) => (Number.isFinite(v) ? v : 0);

/** Meta da semana em metros para uma crew com `members` membros. */
export function crewWeekGoalMeters(members: number): number {
  const n = Math.max(0, Math.floor(safe(members)));
  const km = Math.min(CREW_GOAL_MAX_KM, Math.max(CREW_GOAL_MIN_KM, n * CREW_GOAL_KM_PER_MEMBER));
  return km * 1000;
}

/** Fração da meta já feita (0 a 1; valores inválidos contam 0). */
export function crewWeekProgress(meters: number, goalMeters: number): number {
  const goal = safe(goalMeters);
  if (goal <= 0) return 0;
  return Math.min(1, Math.max(0, safe(meters) / goal));
}
