/**
 * D-94 — "Quando você corre de novo?" (intenção de implementação). A regra (opções e quando perguntar) é do
 * domain (`nextRunPlanOptions`, `shouldAskPlan`); aqui fica a memória do aparelho e o replanejamento dos avisos.
 *
 * - Escolher um horário guarda `{ at, askedWeek }` e replaneja: o planejador agenda 1 aviso `plano` no horário,
 *   dentro do limite de 1 por dia e 4 por semana (D-69).
 * - "Agora não" guarda só a semana: a pergunta volta na semana seguinte, nunca na mesma (nunca insistir).
 * Chaves separadas na demonstração (`local-store`).
 */
import { brtCalendar } from '@/domain/progression';
import { shouldAskPlan, type NextRunPlanMemory } from '@/domain/reminders';

import { readLocal, writeLocal } from './local-store';

export const PLAN_KEY = 'next-run-plan';

export async function readPlanMemory(): Promise<NextRunPlanMemory | null> {
  const v = await readLocal<NextRunPlanMemory>(PLAN_KEY);
  if (!v || typeof v !== 'object') return null;
  return { at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : null, askedWeek: typeof v.askedWeek === 'string' ? v.askedWeek : null };
}

/** O plano ainda no futuro (para o planejador de avisos), ou nada. */
export async function readPendingPlan(now: number): Promise<{ at: number } | null> {
  const m = await readPlanMemory();
  return m && m.at !== null && m.at > now ? { at: m.at } : null;
}

/** Devem perguntar agora? (sem memória legível, pergunta: é o 1º resumo neste aparelho). */
export async function planQuestionDue(now: number): Promise<boolean> {
  return shouldAskPlan(await readPlanMemory(), now);
}

/** Guarda a resposta: um horário (`at`) ou "Agora não" (`null`). Quem chama replaneja os avisos. */
export async function answerPlan(at: number | null, now: number): Promise<NextRunPlanMemory> {
  const memory: NextRunPlanMemory = { at, askedWeek: brtCalendar.clock(now).weekId };
  await writeLocal(PLAN_KEY, memory);
  return memory;
}
