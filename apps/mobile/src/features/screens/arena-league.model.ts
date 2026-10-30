/**
 * F8-B3 (UX-11): textos da folha da Liga, puros e testados. A folha responde 3 perguntas em 3 segundos: em que
 * grupo estou, quem sobe (e quem desce) e quando fecha. Nada de "top 5" (inglês) nem "Liga Rua" solto.
 */
import { formatTimeLeft } from '@/features/format';
import type { LeagueCurrent } from '@/services/api/league-repo';

const DAY = 86_400_000;

/** "Liga · Divisão Rua" (o nome da divisão sozinho parecia nome incompleto). */
export const leagueTitle = (l: Pick<LeagueCurrent, 'divisionName'>) => `Liga · Divisão ${l.divisionName}`;

/** Linha curta da faixa da Arena: "17º de 30 · 5 primeiros sobem" ou "Corra para entrar". */
export function leagueStripLine(l: Pick<LeagueCurrent, 'me' | 'groupSize' | 'promoteSlots'>): string {
  if (!l.me) return 'Corra para entrar';
  return `${l.me.position}º de ${l.groupSize}${l.promoteSlots > 0 ? ` · ${upLabel(l.promoteSlots)}` : ''}`;
}

const upLabel = (n: number) => (n === 1 ? 'o 1º sobe' : `${n} primeiros sobem`);

/** Quem sobe e quem desce, numa frase cada. Grupo pequeno: só o 1º sobe e ninguém desce. */
export function leagueRules(l: Pick<LeagueCurrent, 'groupSize' | 'promoteSlots' | 'relegateSlots' | 'smallGroup' | 'joined'>): { group: string; up: string; down: string } {
  const group = l.joined ? `Grupo de ${l.groupSize} ${l.groupSize === 1 ? 'corredor' : 'corredores'}` : 'Sua 1ª corrida da semana te põe num grupo';
  const up = l.promoteSlots > 0 ? `${l.promoteSlots === 1 ? 'O 1º sobe' : `Os ${l.promoteSlots} primeiros sobem`} de divisão` : 'Ninguém sobe nesta divisão';
  const down = l.smallGroup || l.relegateSlots === 0 ? 'Ninguém desce nesta semana' : `${l.relegateSlots === 1 ? 'O último desce' : `Os ${l.relegateSlots} últimos descem`}`;
  return { group, up, down };
}

/** Prazo da semana: "Fecha em 3 dias", "Fecha em 1 dia", "Fecha em 5 h 20 min"; passou: "Fechando agora". */
export function leagueCloses(closesAt: number, now: number): string {
  const left = closesAt - now;
  if (!(left > 0)) return 'Fechando agora';
  if (left >= DAY) {
    const d = Math.floor(left / DAY);
    return `Fecha em ${d} ${d === 1 ? 'dia' : 'dias'}`;
  }
  return `Fecha em ${formatTimeLeft(left)}`;
}
