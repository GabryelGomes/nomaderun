/**
 * F8 · A2 — regras puras que acompanham três dados novos do servidor (migration 20261031120000_f8_fundacao).
 *
 * - D-96 "Precisa de reforço": `faction_activity()` devolve só quantos corredores de cada time tiveram corrida aceita
 *   nos últimos 7 dias; `factionNeedingBoost` decide qual time ganha o selo (só cosmético, nunca vantagem).
 * - Marcos da pintura no resultado da corrida (`extras.milestones`): "primeiro trecho pintado" (1 vez na vida) e
 *   "recorde de trechos numa corrida" (comparação só consigo). O oficial é o SQL (`svc_paint_milestones`);
 *   `paintMilestones` é a mesma regra para a demonstração e os testes.
 * - Eco da crew (`crew_echo()`): o aviso só sai entre 07h e 22h de Brasília (`isEchoHour`).
 */
import { FACTION_IDS, type FactionId } from './types';

/* ---------- D-96: "Precisa de reforço" ---------- */

/** Abaixo disso (ativos somando os 4 times), o selo não aparece: com tão pouca gente o número não diz nada. */
export const BOOST_MIN_TOTAL_ACTIVE = 4;

export type FactionActiveCounts = Record<FactionId, number>;

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * O time com MENOS corredores ativos nos últimos 7 dias, ou `null` quando:
 * - o total é menor que `BOOST_MIN_TOTAL_ACTIVE`;
 * - há empate no menor número (selo só com um time claramente atrás).
 */
export function factionNeedingBoost(counts: Partial<Record<FactionId, number>> | null | undefined): FactionId | null {
  if (!counts) return null;
  const values = FACTION_IDS.map((f) => ({ f, n: count(counts[f]) }));
  const total = values.reduce((s, v) => s + v.n, 0);
  if (total < BOOST_MIN_TOTAL_ACTIVE) return null;
  const min = Math.min(...values.map((v) => v.n));
  const atMin = values.filter((v) => v.n === min);
  return atMin.length === 1 ? atMin[0].f : null;
}

/* ---------- Marcos da pintura ---------- */

export type PaintMilestones = {
  /** A 1ª corrida da vida com trechos pintados. */
  firstPaint: boolean;
  /** Trechos pintados nesta corrida (`extras.paint.cells`). */
  cells: number;
  /** Mais trechos que qualquer outra corrida da pessoa (nunca junto com `firstPaint`). */
  cellsRecord: { value: number; previous: number } | null;
};

/**
 * Mesma regra de `svc_paint_milestones` (SQL): `others` são as OUTRAS corridas pontuadas da pessoa com trechos
 * (`endedAt` em ms e se já ganharam o "primeiro trecho"). Desempate do "antes" pelo id, como no SQL.
 */
export function paintMilestones(input: {
  id: string;
  cells: number;
  endedAt: number;
  others: readonly { id: string; cells: number; endedAt: number; firstPaint: boolean }[];
}): PaintMilestones {
  const cells = count(input.cells);
  const painted = input.others.filter((o) => o.id !== input.id && count(o.cells) > 0);
  const before = (o: { id: string; endedAt: number }) => o.endedAt < input.endedAt || (o.endedAt === input.endedAt && o.id < input.id);
  const firstPaint = cells > 0 && !painted.some((o) => o.firstPaint || before(o));
  const best = painted.reduce((m, o) => Math.max(m, count(o.cells)), 0);
  return {
    firstPaint,
    cells,
    cellsRecord: !firstPaint && cells > 0 && best >= 1 && cells > best ? { value: cells, previous: best } : null,
  };
}

/* ---------- Eco da crew ---------- */

export const ECHO_FROM_HOUR = 7;
export const ECHO_UNTIL_HOUR = 22;

/** Hora de Brasília (UTC−3, sem horário de verão desde 2019) de um instante. */
const brtHour = (ms: number) => new Date(ms - 3 * 3_600_000).getUTCHours();

/** O eco da crew só aparece e só vira aviso entre 07h e 22h (Brasília). */
export function isEchoHour(nowMs: number): boolean {
  const h = brtHour(nowMs);
  return h >= ECHO_FROM_HOUR && h < ECHO_UNTIL_HOUR;
}
