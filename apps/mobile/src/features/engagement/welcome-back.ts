/**
 * "Bem-vindo de volta" (E7, T7.2.4): quem passou 14 dias ou mais sem correr vê 3 cartões **verdadeiros** e
 * acolhedores. Nenhuma perda aparece (nem em vermelho, nem em texto): só o que a pessoa tem e o próximo passo
 * leve. Regra ética da E7 (prompt §5.4) e escada de volta da D-69.
 */
import type { IconName } from '@/components/icon';
import { brtCalendar } from '@/domain/progression';
import type { DailyChestState, EngagementMissions, EngagementStatus } from '@/services/api/engagement-repo';

import { fmtInt } from './model';

export const WELCOME_BACK_DAYS = 14;
export const WELCOME_BACK_CARDS = 3;

export function daysAway(lastActivityAt: number | null, now: number): number | null {
  if (lastActivityAt === null) return null;
  return Math.max(0, brtCalendar.daysBetween(brtCalendar.clock(lastActivityAt).dayId, brtCalendar.clock(now).dayId));
}

/** Mostrar agora? Só para quem já correu e está há 14+ dias parado; uma vez por ausência (`seenFor`). */
export function shouldWelcomeBack(lastActivityAt: number | null, now: number, seenFor: number | null = null): boolean {
  const d = daysAway(lastActivityAt, now);
  return d !== null && d >= WELCOME_BACK_DAYS && seenFor !== lastActivityAt;
}

export type WelcomeCard = { key: string; icon: IconName; title: string; body: string };

/** Até 3 cartões, só com fatos que o servidor confirmou, na ordem: próximo passo, o que espera, o que é seu. */
export function welcomeBackCards(
  status: EngagementStatus | null,
  missions: Pick<EngagementMissions, 'comeback'> | null,
  chest: Pick<DailyChestState, 'stored' | 'bonus'> | null,
): WelcomeCard[] {
  const cards: WelcomeCard[] = [];
  const cb = missions?.comeback;
  if (cb && cb.completedAt === null) cards.push({ key: 'volta', icon: 'play', title: 'Sua missão de volta', body: `${cb.title}. +${cb.xp} XP, sem prazo.` });
  const chests = (chest?.stored ?? 0) + (chest?.bonus.length ?? 0);
  if (chests > 0) {
    const rare = chest?.bonus.includes('lendario') ? ' Tem um lendário entre eles.' : chest?.bonus.includes('raro') ? ' Tem um raro entre eles.' : '';
    cards.push({ key: 'baus', icon: 'chest', title: chests === 1 ? '1 baú guardado' : `${chests} baús guardados`, body: `Uma atividade de 1 km abre todos.${rare}` });
  }
  if (status) {
    cards.push({ key: 'nivel', icon: 'trophy', title: `Nível ${status.level} · ${status.title.name}`.slice(0, 30), body: 'Todo o seu XP continua aqui.' });
    if (status.streak.best > 0) {
      cards.push({ key: 'recorde', icon: 'fire', title: `Recorde: ${status.streak.best} ${status.streak.best === 1 ? 'semana' : 'semanas'}`, body: 'Sua melhor sequência é sua para sempre.' });
    }
    if (status.lifetimeMeters !== null && status.lifetimeMeters > 0 && status.band) {
      cards.push({ key: 'faixa', icon: 'route', title: `Faixa ${status.band.name}`, body: `${fmtInt(status.lifetimeMeters / 1000)} km corridos até aqui.` });
    }
  }
  return cards.slice(0, WELCOME_BACK_CARDS);
}
