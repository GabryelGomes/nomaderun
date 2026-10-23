/**
 * Temporadas (RN-006): uma por mês no horário de Brasília, com o mesmo id do servidor
 * (`public.current_season_id()` = 'YYYY-MM' em America/Sao_Paulo).
 * O Brasil não tem horário de verão desde 2019, então Brasília é sempre UTC−3.
 */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Id da temporada em que o instante cai ('2026-10'). */
export function seasonIdAt(now: Date): string {
  const brt = new Date(now.getTime() + BRT_OFFSET_MS);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Id da temporada seguinte ('2026-12' → '2027-01'). */
export function nextSeasonId(seasonId: string): string {
  const [y, m] = seasonId.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** "1º de novembro" para a temporada '2026-11'. */
export function seasonStartLabel(seasonId: string): string {
  const m = Number(seasonId.split('-')[1]);
  return `1º de ${MONTHS[m - 1]}`;
}

/**
 * RF-003: a facção pode ser trocada uma vez por temporada (o servidor confere de novo em `choose_faction`).
 * Sem facção ainda (onboarding) sempre pode escolher.
 */
export function factionChange(
  profile: { faction: string | null; factionChangedSeason: string | null },
  now: Date,
): { allowed: true } | { allowed: false; nextAt: string } {
  const season = seasonIdAt(now);
  if (!profile.faction || profile.factionChangedSeason !== season) return { allowed: true };
  return { allowed: false, nextAt: seasonStartLabel(nextSeasonId(season)) };
}
