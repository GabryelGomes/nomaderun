import { LEAGUE_DIVISIONS } from './games';
import { weekStartBrt } from './season';

/**
 * D-68 — Liga real.
 *
 * - A pessoa entra na liga da semana na 1ª corrida da semana (o servidor cria o vínculo).
 * - Grupos de até 30 pessoas da mesma divisão, com volume parecido (ordenados pelo volume das últimas semanas
 *   e cortados em blocos de tamanhos quase iguais).
 * - Pontos da semana = soma dos pontos das corridas (antigo RP, de `scoreZoneV2`, sem sequência — D-63).
 * - Fecha na segunda às 03:20 (Brasília), de forma idempotente.
 * - Sobem/descem até 5 em grupos de 30 (1 a cada 6). Grupo pequeno (< 6 pessoas): só o 1º sobe, se pontuou,
 *   e ninguém desce. A regra antiga (`leagueOutcome`, em games.ts) quebra com grupo pequeno.
 */

export const LEAGUE_V2_GROUP_MAX = 30;
export const LEAGUE_V2_MOVES_MAX = 5;
/** Um sobe/desce a cada 6 pessoas do grupo. */
export const LEAGUE_V2_MOVE_EVERY = 6;
/** Grupo com menos que isso é "grupo pequeno". */
export const LEAGUE_V2_SMALL_GROUP = 6;
/** Fechamento: segunda-feira 03:20 (Brasília) da semana seguinte. */
export const LEAGUE_V2_CLOSE_OFFSET_MS = (3 * 60 + 20) * 60 * 1000;

const WEEK = 7 * 24 * 60 * 60 * 1000;

export type LeagueResultV2 = 'promoted' | 'stays' | 'relegated';

export type LeagueMember = {
  userId: string;
  /** Índice em LEAGUE_DIVISIONS (0 = Calçada). */
  division: number;
  /** Volume para agrupar (ex.: km ou pontos das 4 últimas semanas). */
  volume: number;
};

export type LeagueGroup = { division: number; index: number; members: string[] };

export type LeagueEntry = {
  userId: string;
  points: number;
  /** Quando chegou aos pontos atuais (desempate: quem chegou antes fica na frente). */
  reachedAt?: number;
};

export type LeagueStanding = LeagueEntry & { rank: number; result: LeagueResultV2 };

const safe = (v: number) => (Number.isFinite(v) ? v : 0);
/** Sem instante conhecido, fica atrás de quem tem. */
const reached = (e: LeagueEntry) => (e.reachedAt !== undefined && Number.isFinite(e.reachedAt) ? e.reachedAt : Number.MAX_SAFE_INTEGER);

/** Semana da liga do instante: começa na segunda 00:00 e fecha na segunda seguinte às 03:20 (Brasília). */
export function leagueWeek(now: number): { startsAt: number; closesAt: number } {
  const startsAt = weekStartBrt(now);
  return { startsAt, closesAt: startsAt + WEEK + LEAGUE_V2_CLOSE_OFFSET_MS };
}

/** Pontos da semana: soma dos pontos das corridas (valores inválidos ou negativos contam 0). */
export function leagueWeekPoints(runPoints: readonly number[]): number {
  return Math.round(runPoints.reduce((s, p) => s + Math.max(0, safe(p)), 0));
}

/**
 * Grupos da semana: por divisão, ordena pelo volume (maior primeiro; empate pelo id) e corta em
 * ⌈n / 30⌉ blocos de tamanhos que diferem no máximo em 1. Cada pessoa fica em exatamente 1 grupo.
 */
export function leagueGroupsV2(members: readonly LeagueMember[]): LeagueGroup[] {
  const byDivision = new Map<number, LeagueMember[]>();
  const seen = new Set<string>();
  for (const m of members) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    const d = Math.min(LEAGUE_DIVISIONS.length - 1, Math.max(0, Math.floor(safe(m.division))));
    const list = byDivision.get(d) ?? [];
    list.push(m);
    byDivision.set(d, list);
  }
  const groups: LeagueGroup[] = [];
  for (const division of [...byDivision.keys()].sort((a, b) => a - b)) {
    const list = byDivision
      .get(division)!
      .sort((a, b) => safe(b.volume) - safe(a.volume) || (a.userId < b.userId ? -1 : 1));
    const k = Math.ceil(list.length / LEAGUE_V2_GROUP_MAX);
    const base = Math.floor(list.length / k);
    const extra = list.length % k;
    let at = 0;
    for (let i = 0; i < k; i++) {
      const size = base + (i < extra ? 1 : 0);
      groups.push({ division, index: i, members: list.slice(at, at + size).map((m) => m.userId) });
      at += size;
    }
  }
  return groups;
}

/** Quantos sobem (e quantos descem) num grupo deste tamanho. */
export function leagueMovesFor(groupSize: number): number {
  if (groupSize < LEAGUE_V2_SMALL_GROUP) return 0;
  return Math.min(LEAGUE_V2_MOVES_MAX, Math.floor(groupSize / LEAGUE_V2_MOVE_EVERY));
}

/**
 * Classificação e resultado do grupo no fechamento. Ranking estrito: pontos (maior primeiro), depois quem
 * chegou antes aos pontos, depois o id. Quem fez 0 ponto não sobe. A divisão mais alta não sobe e a mais
 * baixa não desce. Grupo pequeno: só o 1º sobe (se pontuou) e ninguém desce.
 */
export function leagueStandingsV2(entries: readonly LeagueEntry[], division: number): LeagueStanding[] {
  const sorted = [...entries].sort(
    (a, b) =>
      safe(b.points) - safe(a.points) ||
      reached(a) - reached(b) ||
      (a.userId < b.userId ? -1 : 1),
  );
  const size = sorted.length;
  const small = size < LEAGUE_V2_SMALL_GROUP;
  const moves = leagueMovesFor(size);
  const canUp = division < LEAGUE_DIVISIONS.length - 1;
  const canDown = division > 0;
  return sorted.map((e, i) => {
    const rank = i + 1;
    const scored = safe(e.points) > 0;
    let result: LeagueResultV2 = 'stays';
    if (canUp && scored && (small ? rank === 1 : rank <= moves)) result = 'promoted';
    else if (canDown && !small && rank > size - moves) result = 'relegated';
    return { ...e, rank, result };
  });
}

/** Divisão da semana seguinte. */
export function nextDivision(division: number, result: LeagueResultV2): number {
  const d = division + (result === 'promoted' ? 1 : result === 'relegated' ? -1 : 0);
  return Math.min(LEAGUE_DIVISIONS.length - 1, Math.max(0, d));
}
