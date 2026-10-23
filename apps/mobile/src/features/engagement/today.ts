/**
 * Dados da faixa de hoje do Mapa (E7, T7.2.4): sequência da semana, baú do dia e a missão em destaque. A E6b
 * desenha com `DailyStrip` e `MissionCoachCard`. Só entra o que é verdade: sem dado do servidor, o chip não
 * existe (D-76).
 */
import type { IconName } from '@/components/icon';
import { STREAK_V2 } from '@/domain/progression';
import type { DailyChestState, EngagementMission, EngagementMissions, EngagementStatus } from '@/services/api/engagement-repo';

import { FTUE_SHORT, ftueDoneCount, ftueRows, missionRatio, pauseActive, pct } from './model';

export type TodayChip = {
  key: 'sequencia' | 'bau' | 'missao';
  testID: string;
  icon: IconName;
  value: string;
  label: string;
  /** Rota que o chip abre. */
  href: '/missoes' | '/recompensas';
};

export type TodayCoach = {
  testID: string;
  eyebrow: string;
  title: string;
  done: number;
  steps: string[];
  reward: string;
  href: '/missoes';
};

export type TodayData = {
  chips: TodayChip[];
  /** Cartão da primeira semana ou da missão de volta (o Mapa mostra no `MissionCoachCard`). */
  coach: TodayCoach | null;
  /** Missão aberta mais adiantada de hoje ou da semana. */
  featured: EngagementMission | null;
  streak: { activities: number; target: number; weeks: number; paused: boolean } | null;
  chest: { stored: number; bonus: number; openedToday: boolean } | null;
};

export function featuredMission(m: EngagementMissions | null): EngagementMission | null {
  if (!m) return null;
  const open = [...m.daily, ...m.weekly].filter((x) => x.completedAt === null);
  return open.sort((a, b) => missionRatio(b) - missionRatio(a) || (a.cadence === b.cadence ? a.slot - b.slot : a.cadence === 'diaria' ? -1 : 1))[0] ?? null;
}

function coachOf(m: EngagementMissions | null, now: number): TodayCoach | null {
  if (!m) return null;
  if (m.comeback && m.comeback.completedAt === null) {
    return { testID: 'hoje-missao-volta', eyebrow: 'Missão de volta', title: m.comeback.title, done: 0, steps: ['Hoje'], reward: `+${m.comeback.xp} XP`, href: '/missoes' };
  }
  const rows = ftueRows(m, now);
  const open = rows.find((r) => r.status === 'open');
  if (!open || rows.length === 0) return null;
  return {
    testID: 'hoje-primeira-semana',
    eyebrow: `Passo ${open.step} de ${rows.length}`,
    title: open.title,
    done: ftueDoneCount(rows),
    steps: rows.map((r) => FTUE_SHORT[r.id as keyof typeof FTUE_SHORT] ?? r.short),
    reward: `+${open.xp} XP`,
    href: '/missoes',
  };
}

export function todayData(input: { status: EngagementStatus | null; missions: EngagementMissions | null; chest: DailyChestState | null; now: number }): TodayData {
  const { status, missions, chest, now } = input;
  const chips: TodayChip[] = [];
  const streak = status
    ? { activities: status.streak.activitiesThisWeek, target: STREAK_V2.activitiesPerWeek, weeks: status.streak.weeks, paused: pauseActive(status.streak.pause, now) }
    : null;
  if (streak) {
    chips.push({
      key: 'sequencia',
      testID: 'hoje-sequencia',
      icon: 'fire',
      value: streak.paused ? 'Pausa' : `${Math.min(streak.activities, streak.target)}/${streak.target}`,
      label: 'Semana',
      href: '/recompensas',
    });
  }
  const chestInfo = chest ? { stored: chest.stored, bonus: chest.bonus.length, openedToday: chest.openedToday } : null;
  if (chestInfo && chestInfo.stored + chestInfo.bonus > 0) {
    const n = chestInfo.stored + chestInfo.bonus;
    chips.push({ key: 'bau', testID: 'hoje-bau', icon: 'chest', value: String(n), label: n === 1 ? 'Baú' : 'Baús', href: '/recompensas' });
  }
  const featured = featuredMission(missions);
  if (featured) {
    chips.push({ key: 'missao', testID: 'hoje-missao', icon: 'trophy', value: pct(missionRatio(featured)), label: 'Missão', href: '/missoes' });
  } else if (missions && missions.daily.length > 0) {
    chips.push({ key: 'missao', testID: 'hoje-missao', icon: 'check', value: 'Feitas', label: 'Missões', href: '/missoes' });
  }
  return { chips, coach: coachOf(missions, now), featured, streak, chest: chestInfo };
}
