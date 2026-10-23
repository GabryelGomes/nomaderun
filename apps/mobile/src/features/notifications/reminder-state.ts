/**
 * Monta o estado do planejador de lembretes (`planReminders`, D-69) a partir do que o app sabe: o engajamento
 * do servidor (store), as preferências da conta e o registro local do que já foi agendado e aberto. Puro.
 */
import type { ReminderPrefs, ReminderState, SentReminder } from '@/domain/reminders';
import { ftueRows, missionRatio } from '@/features/engagement/model';
import type { DailyChestState, EngagementMissions, EngagementStatus } from '@/services/api/engagement-repo';
import type { NotificationPrefs } from '@/services/api/types';

/** Lembrete agendado neste aparelho (o que passou do horário conta como entregue). */
export type ScheduledEntry = { identifier: string; id: string; key: string; at: number };

/** Registro local (kv-store): o que foi agendado, o que a pessoa abriu e o horário do aparelho. */
export type ReminderLog = {
  /** Primeira vez que este aparelho viu a conta (substitui `createdAt` quando o servidor não informa). */
  firstSeenAt: number;
  scheduled: ScheduledEntry[];
  /** Chaves (`key`) dos lembretes que a pessoa tocou. */
  opened: string[];
};

/** Ajustes do aparelho: silêncio maior que o padrão e "pausar lembretes por 7 dias". */
export type DeviceReminderPrefs = { quietStart: number | null; quietEnd: number | null; snoozeUntil: number | null };

export const EMPTY_DEVICE_PREFS: DeviceReminderPrefs = { quietStart: null, quietEnd: null, snoozeUntil: null };

/** Guardamos 30 dias de histórico (o limite semanal só olha 7). */
const KEEP_MS = 30 * 86_400_000;

export const newLog = (now: number): ReminderLog => ({ firstSeenAt: now, scheduled: [], opened: [] });

export function sentReminders(log: ReminderLog, now: number): SentReminder[] {
  return log.scheduled.filter((s) => s.at <= now).map(({ id, key, at }) => ({ id, key, at }));
}

/** Quantos dos últimos lembretes entregues seguidos a pessoa não abriu (fadiga: o orçamento cai para 1/semana). */
export function ignoredInARow(log: ReminderLog, now: number): number {
  const opened = new Set(log.opened);
  let n = 0;
  for (const s of [...sentReminders(log, now)].sort((a, b) => b.at - a.at)) {
    if (opened.has(s.key)) break;
    n++;
  }
  return n;
}

/** Junta o plano novo ao registro: o que já passou fica (entregue), o futuro é trocado pelo plano. */
export function mergePlan(log: ReminderLog, plan: readonly ScheduledEntry[], now: number): ReminderLog {
  const past = log.scheduled.filter((s) => s.at <= now && s.at > now - KEEP_MS);
  const pastKeys = new Set(past.map((s) => s.key));
  const opened = log.opened.filter((k) => pastKeys.has(k));
  return { ...log, scheduled: [...past, ...plan.filter((p) => p.at > now)], opened };
}

export function markOpened(log: ReminderLog, key: string): ReminderLog {
  return log.opened.includes(key) ? log : { ...log, opened: [...log.opened, key] };
}

/** Preferências da conta + do aparelho no formato do planejador (chave ausente = ligada). */
export function toReminderPrefs(prefs: NotificationPrefs | null | undefined, device: DeviceReminderPrefs): ReminderPrefs {
  const p = prefs ?? null;
  return {
    ...(p ?? {}),
    ...(device.quietStart !== null ? { quietStart: device.quietStart } : {}),
    ...(device.quietEnd !== null ? { quietEnd: device.quietEnd } : {}),
    snoozeUntil: device.snoozeUntil,
  };
}

export function buildReminderState(input: {
  status: EngagementStatus | null;
  missions: EngagementMissions | null;
  chest: DailyChestState | null;
  log: ReminderLog;
  now: number;
}): ReminderState {
  const { status, missions, chest, log, now } = input;
  const weekly = (missions?.weekly ?? [])
    .filter((m) => m.completedAt === null && m.metric === 'meters')
    .sort((a, b) => missionRatio(b) - missionRatio(a))[0];
  const rows = missions ? ftueRows(missions, now) : [];
  const next = rows.find((r) => r.status !== 'done' && r.unlocksAt !== null);
  return {
    createdAt: status?.createdAt ?? log.firstSeenAt,
    lastActivityAt: status?.lastActivityAt ?? null,
    recentStartTimes: status?.recentStartTimes ?? [],
    week: status?.week ?? { activities: 0, meters: 0, zones: 0 },
    previousWeek: status?.previousWeek ?? null,
    dailyChestsStored: chest && !chest.openedToday ? chest.stored : 0,
    weeklyMission: weekly ? { ratio: missionRatio(weekly), remainingMeters: Math.max(0, weekly.target - weekly.progress) } : null,
    ftue:
      next && missions
        ? { startedAt: missions.ftueStartedAt ?? log.firstSeenAt, step: next.step, stepText: next.title, unlocksAt: next.unlocksAt as number }
        : null,
    pause: status?.streak.pause ?? null,
    sent: sentReminders(log, now),
    ignoredInARow: ignoredInARow(log, now),
  };
}
