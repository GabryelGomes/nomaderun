import type { FactionId } from '@/domain/types';
import type { RankingQuery, RankingScope } from '@/services/api/leaderboard-repo';

/** Filtros dos rankings do Clube (RF-015, P-25): quadro, período e escopo → parâmetros das RPCs `ranking_*`. */
export type Board = 'individual' | 'crews' | 'faccoes';
export type Scope = 'geral' | 'cidade' | 'time' | 'distrito';
export type Period = 'season' | 'week';
export type Me = { id: string | null; city: string | null; faction: FactionId | null; district: string | null };

const SCOPE_TO_SERVER: Record<Scope, RankingScope> = { geral: 'general', cidade: 'city', time: 'faction', distrito: 'district' };

/** Escopos de cada quadro (o ranking de times não tem "Meu time"). */
export function scopesFor(board: Board): Scope[] {
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
  if (s === 'cidade' && !me.city) return 'Defina sua cidade natal no perfil para ver este ranking.';
  if (s === 'time' && !me.faction) return 'Escolha um time para ver este ranking.';
  if (s === 'distrito' && !me.district) return 'Corra uma vez para ver o ranking do seu distrito.';
  return period === 'week'
    ? 'Ninguém pontuou nesta semana ainda. A primeira corrida válida abre o ranking.'
    : 'Ninguém pontuou nesta temporada ainda. A primeira corrida válida abre o ranking.';
}
