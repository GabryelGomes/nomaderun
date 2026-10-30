/**
 * Lembretes locais de engajamento (D-69, E7 T7.2.4): cancela os `eng:*` agendados e agenda o que o
 * `planReminders` do domain devolver. Replanejar a cada abertura, sincronização e corrida mantém cada aviso
 * verdadeiro (ex.: correu hoje → nada hoje; abriu o baú → o aviso do baú some).
 *
 * Nunca pede permissão (a E6 pede depois da 1ª conquista, D-72): sem permissão, só registra o plano.
 */
import { planReminders, type PlannedReminder } from '@/domain/reminders';
import { readLocal, writeLocal } from '@/features/engagement/local-store';
import { useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';

import {
  buildReminderState,
  EMPTY_DEVICE_PREFS,
  markOpened,
  mergePlan,
  newLog,
  toReminderPrefs,
  type DeviceReminderPrefs,
  type ReminderLog,
  type ScheduledEntry,
} from './reminder-state';

export const REMINDER_PREFIX = 'eng:';
export const REMINDER_CHANNEL = 'lembretes';
const LOG_KEY = 'reminder-log';
const DEVICE_KEY = 'reminder-device';

/** O que o agendador precisa do sistema (trocável nos testes). */
export type Notifier = {
  supported: () => boolean;
  permitted: () => Promise<boolean>;
  scheduledIds: () => Promise<string[]>;
  cancel: (identifier: string) => Promise<void>;
  schedule: (r: PlannedReminder) => Promise<void>;
};

/** Para onde o toque leva (a rota abre a tela que explica o aviso). */
export function reminderRoute(kind: PlannedReminder['kind']): '/missoes' | '/recompensas' | '/compartilhar/semana' | '/' {
  if (kind === 'missao' || kind === 'ftue' || kind === 'volta') return '/missoes';
  // Sem semana na rota, o recap abre a semana que acabou quando a atual ainda está vazia (segunda de manhã).
  if (kind === 'recap') return '/compartilhar/semana';
  if (kind === 'bau' || kind === 'sequencia' || kind === 'temporada') return '/recompensas';
  return '/';
}

/** `expo-notifications` de verdade (iOS e Android; a web não tem notificação local agendada). */
export function expoNotifier(): Notifier {
  type N = typeof import('expo-notifications');
  let mod: Promise<N> | null = null;
  const load = () => (mod ??= import('expo-notifications'));
  let channel: Promise<unknown> | null = null;
  return {
    supported: () => process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android',
    permitted: async () => (await (await load()).getPermissionsAsync()).granted,
    scheduledIds: async () => (await (await load()).getAllScheduledNotificationsAsync()).map((n) => n.identifier),
    cancel: async (id) => (await load()).cancelScheduledNotificationAsync(id),
    schedule: async (r) => {
      const N = await load();
      if (process.env.EXPO_OS === 'android') channel ??= N.setNotificationChannelAsync(REMINDER_CHANNEL, { name: 'Lembretes', importance: N.AndroidImportance.DEFAULT });
      await channel;
      await N.scheduleNotificationAsync({
        identifier: r.identifier,
        content: { title: 'NOMADE RUN', body: r.text, data: { reminderKey: r.key, reminderId: r.id, url: reminderRoute(r.kind) } },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(r.at), channelId: REMINDER_CHANNEL },
      });
    },
  };
}

/** Troca os lembretes agendados pelo plano: cancela os `eng:*` que saíram e agenda os que faltam. */
export async function applyPlan(plan: readonly PlannedReminder[], notifier: Notifier): Promise<{ scheduled: number; cancelled: number }> {
  const current = (await notifier.scheduledIds()).filter((id) => id.startsWith(REMINDER_PREFIX));
  const wanted = new Set(plan.map((p) => p.identifier));
  let cancelled = 0;
  for (const id of current) {
    if (wanted.has(id)) continue;
    await notifier.cancel(id);
    cancelled++;
  }
  let scheduled = 0;
  for (const p of plan) {
    // Reagendar o mesmo identificador substitui (horário ou texto podem ter mudado).
    if (current.includes(p.identifier)) await notifier.cancel(p.identifier);
    await notifier.schedule(p);
    scheduled++;
  }
  return { scheduled, cancelled };
}

export async function readReminderLog(now: number): Promise<ReminderLog> {
  return (await readLocal<ReminderLog>(LOG_KEY)) ?? newLog(now);
}

export async function readDevicePrefs(): Promise<DeviceReminderPrefs> {
  return { ...EMPTY_DEVICE_PREFS, ...((await readLocal<DeviceReminderPrefs>(DEVICE_KEY)) ?? {}) };
}

export async function writeDevicePrefs(p: DeviceReminderPrefs): Promise<void> {
  await writeLocal(DEVICE_KEY, p);
}

export type ReplanResult = { plan: PlannedReminder[]; scheduled: number; cancelled: number; skipped: 'signed_out' | 'unsupported' | 'no_permission' | null };

let chain: Promise<unknown> = Promise.resolve();

/**
 * Replaneja agora (em fila: duas chamadas seguidas não se atropelam). Lê o engajamento do store; quem chama
 * recarrega o store antes quando há fato novo (abertura, sincronização, corrida).
 */
export function replanReminders(opts: { now?: number; notifier?: Notifier } = {}): Promise<ReplanResult> {
  const run = async (): Promise<ReplanResult> => {
    const now = opts.now ?? Date.now();
    const notifier = opts.notifier ?? expoNotifier();
    const session = useSession.getState();
    if (session.status !== 'signedIn') return { plan: [], scheduled: 0, cancelled: 0, skipped: 'signed_out' };
    const eng = useEngagement.getState();
    const log = await readReminderLog(now);
    const state = buildReminderState({ status: eng.status.data, missions: eng.missions.data, chest: eng.chest.data, log, now });
    const plan = planReminders(state, toReminderPrefs(session.profile?.notificationPrefs, await readDevicePrefs()), now);
    const entries: ScheduledEntry[] = plan.map((p) => ({ identifier: p.identifier, id: p.id, key: p.key, at: p.at }));
    if (!notifier.supported()) return { plan, scheduled: 0, cancelled: 0, skipped: 'unsupported' };
    try {
      if (!(await notifier.permitted())) {
        await writeLocal(LOG_KEY, mergePlan(log, [], now));
        return { plan, scheduled: 0, cancelled: 0, skipped: 'no_permission' };
      }
      const res = await applyPlan(plan, notifier);
      await writeLocal(LOG_KEY, mergePlan(log, entries, now));
      return { plan, ...res, skipped: null };
    } catch {
      // Sem módulo de notificações (ex.: ambiente sem suporte): o app segue; a central continua valendo.
      return { plan, scheduled: 0, cancelled: 0, skipped: 'unsupported' };
    }
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

/** A pessoa tocou num lembrete: conta como aberto (a fadiga considera isso). */
export async function recordReminderOpened(key: string, now: number): Promise<void> {
  const log = await readReminderLog(now);
  await writeLocal(LOG_KEY, markOpened(log, key));
}

/** Sair da conta: cancela os lembretes desta pessoa neste aparelho. */
export async function cancelAllReminders(notifier: Notifier = expoNotifier()): Promise<number> {
  if (!notifier.supported()) return 0;
  try {
    const ids = (await notifier.scheduledIds()).filter((id) => id.startsWith(REMINDER_PREFIX));
    for (const id of ids) await notifier.cancel(id);
    await writeLocal(LOG_KEY, null);
    return ids.length;
  } catch {
    return 0;
  }
}
