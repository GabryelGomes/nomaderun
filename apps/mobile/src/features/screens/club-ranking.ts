import type { FactionId } from '@/domain/types';
import type { IndividualRow, RankingQuery, RankingScope } from '@/services/api/leaderboard-repo';

/**
 * Filtros dos rankings do Clube (RF-015, P-25): quadro, período e escopo → parâmetros das RPCs `ranking_*`.
 * T7.3.3: a Guerra de Cidades (RN-013) virou o 4º quadro ("Cidades"), só na temporada e sem escopo.
 */
export type Board = 'individual' | 'crews' | 'faccoes' | 'cidades';
export type Scope = 'geral' | 'cidade' | 'time' | 'distrito';
export type Period = 'season' | 'week';
export type Me = { id: string | null; city: string | null; faction: FactionId | null; district: string | null };

const SCOPE_TO_SERVER: Record<Scope, RankingScope> = { geral: 'general', cidade: 'city', time: 'faction', distrito: 'district' };

/** Escopos de cada quadro (o ranking de times não tem "Meu time"). */
export function scopesFor(board: Board): Scope[] {
  if (board === 'cidades') return ['geral'];
  return board === 'faccoes' ? ['geral', 'cidade', 'distrito'] : ['geral', 'cidade', 'time', 'distrito'];
}

const effectiveScope = (board: Board, scope: Scope): Scope => (scopesFor(board).includes(scope) ? scope : 'geral');

/** Parâmetros das RPCs, ou null quando falta o dado do escopo (cidade natal, time ou distrito). */
export function rankingQuery(board: Board, scope: Scope, period: Period, me: Me, limit = 20): RankingQuery | null {
  const s = effectiveScope(board, scope);
  const value = s === 'cidade' ? me.city : s === 'time' ? me.faction : s === 'distrito' ? me.district : null;
  if (s !== 'geral' && !value) return null;
  return { period, scope: SCOPE_TO_SERVER[s], value, limit };
}

export function emptyRankingText(board: Board, scope: Scope, period: Period, me: Me): string {
  const s = effectiveScope(board, scope);
  if (board === 'cidades') return 'Nenhuma cidade pontuou nesta temporada ainda.';
  if (s === 'cidade' && !me.city) return 'Defina sua cidade natal no perfil para ver este ranking.';
  if (s === 'time' && !me.faction) return 'Escolha um time para ver este ranking.';
  if (s === 'distrito' && !me.district) return 'Corra uma vez para ver o ranking do seu distrito.';
  return period === 'week'
    ? 'Ninguém pontuou nesta semana ainda. A primeira corrida válida abre o ranking.'
    : 'Ninguém pontuou nesta temporada ainda. A primeira corrida válida abre o ranking.';
}

/** O quadro tem filtro de período? (Cidades: só a temporada, `leaderboard_cities`.) */
export const hasPeriod = (board: Board) => board !== 'cidades';

/**
 * A semana da crew a partir do ranking semanal de corredores (`ranking_runners`, período `week`): km somados
 * de quem tem a sigla da crew e quantos membros já correram. Dado real; o servidor ainda não tem meta de km
 * da crew, então a "meta da semana" mostrada é "todos correrem" (membros que correram ÷ membros).
 */
export function crewWeek(rows: readonly Pick<IndividualRow, 'crewTag' | 'meters' | 'runs'>[], tag: string, members: number): { meters: number; ran: number; ratio: number } {
  const mine = rows.filter((r) => r.crewTag === tag && (r.runs > 0 || r.meters > 0));
  const meters = mine.reduce((n, r) => n + r.meters, 0);
  const ran = Math.min(members, mine.length);
  return { meters, ran, ratio: members > 0 ? ran / members : 0 };
}
