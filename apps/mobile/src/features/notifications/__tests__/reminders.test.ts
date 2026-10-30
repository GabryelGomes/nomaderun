/**
 * @jest-environment node
 *
 * T7.2.4 (E7, D-69): lembretes locais a partir do `planReminders` — o estado vem do engajamento do servidor e do
 * registro do aparelho; o agendador troca só os `eng:*`; sem permissão ou sem sessão, nada é agendado.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockMemory = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (k: string) => (mockMemory.has(k) ? JSON.parse(JSON.stringify(mockMemory.get(k))) : null),
  writeLocal: async (k: string, v: unknown) => {
    if (v === null || v === undefined) mockMemory.delete(k);
    else mockMemory.set(k, v);
  },
}));

/* eslint-disable import/first */
import type { PlannedReminder } from '@/domain/reminders';
import { brtCalendar } from '@/domain/progression';
import { REMINDER_LIMITS } from '@/domain/reminders';
import { parseDailyChest, parseMissions, type EngagementStatus } from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';

import { buildReminderState, ignoredInARow, markOpened, mergePlan, newLog, toReminderPrefs } from '../reminder-state';
import { applyPlan, cancelAllReminders, recordReminderOpened, reminderRoute, replanReminders, type Notifier } from '../reminders';
/* eslint-enable import/first */

const NOW = brtCalendar.at('2026-10-23', 9); // sexta 09:00 BRT
const DAY = 86_400_000;

function fakeNotifier(opts: { permitted?: boolean; existing?: string[] } = {}) {
  const scheduled = new Map<string, PlannedReminder | null>((opts.existing ?? []).map((id) => [id, null]));
  const calls: string[] = [];
  const n: Notifier = {
    supported: () => true,
    permitted: async () => opts.permitted ?? true,
    scheduledIds: async () => [...scheduled.keys()],
    cancel: async (id) => {
      calls.push(`cancel:${id}`);
      scheduled.delete(id);
    },
    schedule: async (r) => {
      calls.push(`schedule:${r.identifier}`);
      scheduled.set(r.identifier, r);
    },
  };
  return { n, scheduled, calls };
}

const STATUS: EngagementStatus = {
  source: 'server',
  xp: 400,
  level: 3,
  intoLevel: 140,
  needed: 260,
  isMax: false,
  title: { id: 'recruta-do-asfalto', name: 'Recruta do Asfalto' },
  band: null,
  lifetimeMeters: null,
  streak: { weeks: 1, best: 1, activitiesThisWeek: 1, freezesLeft: 1, pause: null, pauseAvailable: true },
  season: null,
  createdAt: NOW - 20 * DAY,
  lastActivityAt: NOW - 2 * DAY,
  recentStartTimes: [NOW - 2 * DAY + 10 * 3600_000],
  week: { activities: 1, meters: 4000, zones: 2 },
  previousWeek: { activities: 2, meters: 9000, zones: 3 },
  cosmetics: null,
};

const MISSIONS = parseMissions({
  periods: { daily: '2026-10-23', weekly: '2026-W43' },
  daily: [],
  weekly: [
    { id: 'w1', defId: 's-km', kind: 'semanal', slot: 1, title: 'Some 10 km na semana', metric: 'meters', progress: 8000, target: 10000, xp: 150 },
    { id: 'w2', defId: 's-pintar-10', kind: 'semanal', slot: 1, title: 'Pinte 10 zonas diferentes', metric: 'zonesPainted', progress: 9, target: 10, xp: 150 },
  ],
  ftue: [{ id: 'f1', defId: 'f1-dominio', kind: 'ftue', slot: 1, title: 'Corra 500 m e pinte sua 1ª zona', metric: 'paintedActivities', progress: 1, target: 1, xp: 100, completedAt: NOW - 2 * DAY }],
  ftueStartedAt: NOW - 3 * DAY,
  rerollsLeft: 1,
});

function signIn(prefs: Record<string, boolean> = {}) {
  useSession.getState().setSession({ userId: 'u1', email: 'x@exemplo.invalid' } as never);
  useSession.getState().setProfile({ id: 'u1', username: 'ana', birthdate: null, faction: 'owls', city: null, unit: 'km', notificationPrefs: { invasions: true, conquests: true, missions: true, moderation: true, ...prefs }, xp: 400, trust: 100, role: 'runner', status: 'active', avatarUrl: null, factionChangedSeason: null });
}

beforeEach(() => {
  mockMemory.clear();
  useSession.getState().reset();
  const e = useEngagement.getState();
  e.reset();
  e.setUser('u1');
  e.setReady('status', STATUS);
  e.setReady('missions', MISSIONS);
  e.setReady('chest', parseDailyChest({ stored: 2, openedToday: false }));
});

describe('estado do planejador', () => {
  it('vem do engajamento: baús guardados, missão semanal de distância e o próximo passo da primeira semana', () => {
    const s = buildReminderState({ status: STATUS, missions: MISSIONS, chest: parseDailyChest({ stored: 2 }), log: newLog(NOW), now: NOW });
    expect(s.dailyChestsStored).toBe(2);
    expect(s.weeklyMission).toEqual({ ratio: 0.8, remainingMeters: 2000 });
    expect(s.ftue).toMatchObject({ step: 2, stepText: 'Abra seu primeiro baú na Caça' });
    expect(s.createdAt).toBe(STATUS.createdAt);
    expect(buildReminderState({ status: STATUS, missions: MISSIONS, chest: parseDailyChest({ stored: 2, openedToday: true }), log: newLog(NOW), now: NOW }).dailyChestsStored).toBe(0);
  });

  it('registro: o que passou conta como entregue; o futuro é trocado; abertos zeram a fadiga', () => {
    let log = newLog(NOW - 10 * DAY);
    log = mergePlan(log, [1, 2, 3].map((d) => ({ identifier: `eng:k${d}`, id: 'n-bau', key: `k${d}`, at: NOW - d * DAY })), NOW - 4 * DAY);
    expect(log.scheduled).toHaveLength(3);
    expect(ignoredInARow(log, NOW)).toBe(3);
    log = markOpened(log, 'k1');
    expect(ignoredInARow(log, NOW)).toBe(0);
    const next = mergePlan(log, [{ identifier: 'eng:novo', id: 'n-bau', key: 'novo', at: NOW + DAY }], NOW);
    expect(next.scheduled.map((s) => s.key)).toEqual(['k1', 'k2', 'k3', 'novo']);
  });

  it('preferências: conta + aparelho; chave ausente = ligada', () => {
    expect(toReminderPrefs({ invasions: true, conquests: true, missions: false, moderation: true }, { quietStart: 20, quietEnd: null, snoozeUntil: null })).toEqual({
      invasions: true,
      conquests: true,
      missions: false,
      moderation: true,
      quietStart: 20,
      snoozeUntil: null,
    });
  });

  it('toque leva à tela certa', () => {
    expect(reminderRoute('bau')).toBe('/recompensas');
    expect(reminderRoute('volta')).toBe('/missoes');
    expect(reminderRoute('chefao')).toBe('/');
    expect(reminderRoute('recap')).toBe('/compartilhar/semana');
  });
});

describe('agendador', () => {
  it('troca só os eng:* (os outros avisos do app ficam)', async () => {
    const { n, scheduled, calls } = fakeNotifier({ existing: ['eng:velho', 'alerta-zona', 'eng:n-bau:2026-10-24'] });
    const plan: PlannedReminder[] = [{ id: 'n-bau', kind: 'bau', pref: 'chests', key: 'n-bau:2026-10-24', identifier: 'eng:n-bau:2026-10-24', at: NOW + DAY, text: 'x' }];
    expect(await applyPlan(plan, n)).toEqual({ scheduled: 1, cancelled: 1 });
    expect([...scheduled.keys()].sort()).toEqual(['alerta-zona', 'eng:n-bau:2026-10-24']);
    expect(calls).toContain('cancel:eng:velho');
  });

  it('replaneja: no máximo 1 por dia, dentro das 8h–21h, e grava o registro', async () => {
    signIn();
    const { n, scheduled } = fakeNotifier();
    const res = await replanReminders({ now: NOW, notifier: n });
    expect(res.skipped).toBeNull();
    expect(res.plan.length).toBeGreaterThan(0);
    const days = res.plan.map((p) => brtCalendar.clock(p.at).dayId);
    expect(new Set(days).size).toBe(days.length);
    expect(res.plan.length).toBeLessThanOrEqual(REMINDER_LIMITS.perWeek);
    for (const p of res.plan) {
      const h = brtCalendar.clock(p.at).hour;
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThanOrEqual(21);
      expect(p.identifier.startsWith('eng:')).toBe(true);
    }
    expect(scheduled.size).toBe(res.plan.length);
    expect((mockMemory.get('reminder-log') as { scheduled: unknown[] }).scheduled).toHaveLength(res.plan.length);
  });

  it('correu hoje: nada hoje; tipo desligado: nunca aparece', async () => {
    signIn({ chests: false });
    useEngagement.getState().setReady('status', { ...STATUS, lastActivityAt: NOW - 3600_000 });
    const { n } = fakeNotifier();
    const res = await replanReminders({ now: NOW, notifier: n });
    expect(res.plan.some((p) => brtCalendar.clock(p.at).dayId === '2026-10-23')).toBe(false);
    expect(res.plan.some((p) => p.pref === 'chests')).toBe(false);
  });

  it('sem permissão ou sem sessão: nada é agendado (a permissão nunca é pedida aqui)', async () => {
    const { n, scheduled } = fakeNotifier({ permitted: false });
    expect((await replanReminders({ now: NOW, notifier: n })).skipped).toBe('signed_out');
    signIn();
    expect((await replanReminders({ now: NOW, notifier: n })).skipped).toBe('no_permission');
    expect(scheduled.size).toBe(0);
  });

  it('pausar por 7 dias: nada antes do fim da pausa', async () => {
    signIn();
    mockMemory.set('reminder-device', { quietStart: null, quietEnd: null, snoozeUntil: NOW + 7 * DAY });
    const { n } = fakeNotifier();
    const res = await replanReminders({ now: NOW, notifier: n });
    expect(res.plan.every((p) => p.at >= NOW + 7 * DAY)).toBe(true);
  });

  it('aberto conta para a fadiga; sair da conta cancela tudo e limpa o registro', async () => {
    signIn();
    const { n, scheduled } = fakeNotifier();
    await replanReminders({ now: NOW, notifier: n });
    await recordReminderOpened('k', NOW);
    expect((mockMemory.get('reminder-log') as { opened: string[] }).opened).toEqual(['k']);
    const before = scheduled.size;
    expect(before).toBeGreaterThan(0);
    expect(await cancelAllReminders(n)).toBe(before);
    expect(scheduled.size).toBe(0);
    expect(mockMemory.has('reminder-log')).toBe(false);
  });
});
