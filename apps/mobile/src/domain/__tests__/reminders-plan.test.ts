/**
 * F8 · B2 (E7): D-94 "Quando você corre de novo?" e o eco da crew no planejador de lembretes (D-69).
 * O plano vira 1 aviso local no horário escolhido e entra no mesmo limite de 1 por dia e 4 por semana.
 */
import { describe, expect, it } from '@jest/globals';

import { brtCalendar } from '../progression';
import {
  hasGuiltWords,
  hourLabel,
  nextRunPlanOptions,
  planReminders,
  REMINDER_LIMITS,
  REMINDER_TEXT_MAX,
  reminderText,
  shouldAskPlan,
  type PlannedReminder,
  type ReminderState,
} from '../reminders';
import { forAll } from './prop';

/** Quarta-feira, 21/10/2026, 10:00 em Brasília. */
const WED = '2026-10-21';
const NOW = brtCalendar.at(WED, 10);
const at = (day: string, h: number, m = 0) => brtCalendar.at(day, h, m);

function state(over: Partial<ReminderState> = {}): ReminderState {
  return {
    createdAt: at('2026-09-01', 12),
    lastActivityAt: at(WED, 7),
    recentStartTimes: [],
    week: { activities: 0, meters: 0, zones: 0 },
    previousWeek: null,
    dailyChestsStored: 0,
    weeklyMission: null,
    ftue: null,
    pause: null,
    sent: [],
    ignoredInARow: 0,
    ...over,
  };
}

const ids = (plan: PlannedReminder[]) => plan.map((p) => `${p.id}@${brtCalendar.clock(p.at).dayId} ${brtCalendar.clock(p.at).hour}:${String(brtCalendar.clock(p.at).minute).padStart(2, '0')}`);
const OFF = { chests: false };
/** Sem a escada de volta (o caso do eco usa uma pessoa que correu anteontem). */
const NO_COMEBACK = { chests: false, comeback: false };

describe('D-94 — opções do plano', () => {
  it('amanhã e depois no horário habitual, e a manhã do sábado', () => {
    const opts = nextRunPlanOptions(NOW, [at('2026-10-20', 19), at('2026-10-19', 19)]);
    expect(opts.map((o) => o.label)).toEqual(['Amanhã · 19h', 'Sexta · 19h', 'Sábado · 8h']);
    expect(opts[0].at).toBe(at('2026-10-22', 19));
    expect(opts[2].at).toBe(at('2026-10-24', 8));
    expect(opts[1].a11y).toBe('Sexta às 19 horas');
  });

  it('sem histórico: 19h; fim de semana já nas duas primeiras: o 3º dia', () => {
    const fri = brtCalendar.at('2026-10-23', 18);
    expect(nextRunPlanOptions(fri).map((o) => o.label)).toEqual(['Amanhã · 19h', 'Domingo · 19h', 'Segunda · 19h']);
  });

  it('horário habitual de madrugada ou muito tarde fica dentro da janela de 8h às 20h', () => {
    expect(nextRunPlanOptions(NOW, [at(WED, 5)])[0].label).toBe('Amanhã · 8h');
    expect(nextRunPlanOptions(NOW, [at(WED, 23)])[0].label).toBe('Amanhã · 20h');
  });

  it('propriedade: 3 opções, dias diferentes, no futuro, até 6 dias, nunca hoje, dentro da janela', () => {
    forAll(
      (r) => ({
        now: brtCalendar.at(brtCalendar.addDays('2026-01-01', r.int(0, 500)), r.int(0, 23), r.int(0, 59)),
        recent: Array.from({ length: r.int(0, 10) }, () => brtCalendar.at('2026-03-03', r.int(0, 23))),
      }),
      ({ now, recent }) => {
        const opts = nextRunPlanOptions(now, recent);
        const today = brtCalendar.clock(now).dayId;
        expect(opts).toHaveLength(3);
        const days = opts.map((o) => brtCalendar.clock(o.at).dayId);
        expect(new Set(days).size).toBe(3);
        for (const o of opts) {
          const c = brtCalendar.clock(o.at);
          expect(o.at).toBeGreaterThan(now);
          expect(c.dayId).not.toBe(today);
          expect(brtCalendar.daysBetween(today, c.dayId)).toBeLessThanOrEqual(6);
          expect(c.hour).toBeGreaterThanOrEqual(REMINDER_LIMITS.windowStartHour);
          expect(c.hour).toBeLessThan(REMINDER_LIMITS.windowEndHour);
          expect(o.label.length).toBeLessThanOrEqual(16);
        }
      },
      300,
    );
  });
});

describe('D-94 — quando perguntar', () => {
  it('1º resumo pergunta; depois só 1 vez por semana e nunca com plano marcado no futuro', () => {
    expect(shouldAskPlan(null, NOW)).toBe(true);
    const week = brtCalendar.clock(NOW).weekId;
    expect(shouldAskPlan({ at: null, askedWeek: week }, NOW)).toBe(false); // "Agora não" nesta semana
    expect(shouldAskPlan({ at: NOW + 3_600_000, askedWeek: '2026-W01' }, NOW)).toBe(false); // plano marcado
    expect(shouldAskPlan({ at: NOW - 3_600_000, askedWeek: week }, NOW)).toBe(false); // já perguntou nesta semana
    const nextMonday = at('2026-10-26', 9);
    expect(shouldAskPlan({ at: NOW - 3_600_000, askedWeek: week }, nextMonday)).toBe(true);
    expect(shouldAskPlan({ at: null, askedWeek: week }, nextMonday)).toBe(true);
  });
});

describe('D-94 — aviso "plano" no planejador', () => {
  const plan = { at: at('2026-10-22', 19) };

  it('vira 1 aviso local no horário escolhido, com texto curto e sem culpa', () => {
    const out = planReminders(state({ plan }), OFF, NOW);
    expect(ids(out)).toEqual(['n-plano@2026-10-22 19:00']);
    expect(out[0]).toMatchObject({ kind: 'plano', pref: 'plan', key: `n-plano:${plan.at}`, identifier: `eng:n-plano:${plan.at}` });
    expect(out[0].text).toBe('Seu plano: correr hoje às 19h. Caminhar também vale.');
    expect(hourLabel(19, 30)).toBe('19h30');
  });

  it('vence os outros avisos no mesmo dia (a pessoa pediu) e conta no limite de 1 por dia', () => {
    const s = state({ plan: { at: at('2026-10-24', 8) }, week: { activities: 1, meters: 3000, zones: 1 } });
    // Sábado teria a sequência; o plano ocupa o dia e a sequência não vai para outro dia (ela é só do sábado).
    expect(ids(planReminders(s, OFF, NOW))).toEqual(['n-plano@2026-10-24 8:00', 'n-recap@2026-10-26 8:00']);
  });

  it('limite de 4 em 7 dias também vale para o plano', () => {
    const sent = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].map((d, i) => ({ id: 'n-liga', key: `x${i}`, at: at(d, 9) }));
    expect(planReminders(state({ plan, sent }), OFF, NOW)).toEqual([]);
    const three = sent.slice(1);
    expect(ids(planReminders(state({ plan, sent: three }), OFF, NOW))).toEqual(['n-plano@2026-10-22 19:00']); // 3 + o plano = 4
    expect(planReminders(state({ plan, sent: three }), OFF, NOW).filter((p) => p.id !== 'n-plano')).toEqual([]);
  });

  it('desligado na preferência, no dia em que já correu, na pausa de saúde ou com plano vencido: nada', () => {
    expect(planReminders(state({ plan }), { ...OFF, plan: false }, NOW)).toEqual([]);
    expect(planReminders(state({ plan, lastActivityAt: at('2026-10-22', 7) }), OFF, at('2026-10-22', 10))).toEqual([]);
    expect(planReminders(state({ plan, pause: { from: '2026-10-19', until: '2026-10-25' } }), OFF, NOW)).toEqual([]);
    expect(planReminders(state({ plan: { at: NOW - 1 } }), OFF, NOW)).toEqual([]);
    expect(planReminders(state({ plan }), { ...OFF, snoozeUntil: at('2026-10-23', 0) }, NOW)).toEqual([]);
  });

  it('respeita o silêncio da pessoa: plano às 20h com silêncio a partir das 19h vai para 18h59', () => {
    const out = planReminders(state({ plan: { at: at('2026-10-22', 20) } }), { ...OFF, quietStart: 19 }, NOW);
    expect(ids(out)).toEqual(['n-plano@2026-10-22 18:59']);
  });
});

describe('eco da crew no planejador', () => {
  const echo = { mate: 'rafa_corre', cells: 3, notifyFrom: at(WED, 7), notifyUntil: at(WED, 22) };

  it('1 aviso hoje, no horário habitual (ou logo, se ele já passou), só dentro da janela 07h–22h', () => {
    const out = planReminders(state({ crewEcho: echo, lastActivityAt: at('2026-10-20', 7) }), NO_COMEBACK, NOW);
    expect(ids(out)).toEqual(['n-eco@2026-10-21 18:00']);
    expect(out[0].text).toBe('rafa_corre reforçou 3 trechos que você pintou.');
    const late = planReminders(state({ crewEcho: echo, lastActivityAt: at('2026-10-20', 7) }), NO_COMEBACK, at(WED, 19, 7));
    expect(ids(late)).toEqual(['n-eco@2026-10-21 19:30']);
    // Depois das 21h (fim da janela dos lembretes) não sai mais; perto dela, sai às 21h.
    expect(planReminders(state({ crewEcho: echo, lastActivityAt: at('2026-10-20', 7) }), NO_COMEBACK, at(WED, 21, 5))).toEqual([]);
    expect(ids(planReminders(state({ crewEcho: echo, lastActivityAt: at('2026-10-20', 7) }), NO_COMEBACK, at(WED, 20, 50)))).toEqual(['n-eco@2026-10-21 21:00']);
  });

  it('fora do dia do eco, com 0 trechos, desligado ou depois de já ter corrido hoje: nada', () => {
    const away = { lastActivityAt: at('2026-10-20', 7) };
    expect(planReminders(state({ ...away, crewEcho: { ...echo, notifyFrom: at('2026-10-20', 7), notifyUntil: at('2026-10-20', 22) } }), NO_COMEBACK, NOW)).toEqual([]);
    expect(planReminders(state({ ...away, crewEcho: { ...echo, cells: 0 } }), NO_COMEBACK, NOW)).toEqual([]);
    expect(planReminders(state({ ...away, crewEcho: echo }), { ...NO_COMEBACK, crewEcho: false }, NOW)).toEqual([]);
    expect(planReminders(state({ crewEcho: echo }), NO_COMEBACK, NOW)).toEqual([]);
  });

  it('1 por dia: já entregue hoje (qualquer aviso), não sai', () => {
    const s = state({ crewEcho: echo, lastActivityAt: at('2026-10-20', 7), sent: [{ id: 'n-bau', key: 'b', at: at(WED, 9) }] });
    expect(planReminders(s, NO_COMEBACK, NOW)).toEqual([]);
  });

  it('texto: singular, nome longo cortado, até 60 caracteres e sem culpa', () => {
    expect(reminderText('n-eco', { x: 1, mate: 'Bia' })).toBe('Bia reforçou 1 trecho que você pintou.');
    const long = reminderText('n-eco', { x: 999, mate: 'um_nome_de_usuario_bem_comprido' });
    expect(long.length).toBeLessThanOrEqual(REMINDER_TEXT_MAX);
    expect(long.startsWith('um_nome_de_usua…')).toBe(true);
    expect(reminderText('n-eco', { x: 2 })).toBe('Alguém da crew reforçou 2 trechos que você pintou.');
    for (const t of [long, reminderText('n-plano', { hour: 21, minute: 45 })]) expect(hasGuiltWords(t)).toBe(false);
  });
});

describe('propriedade — plano e eco nunca furam os limites da D-69', () => {
  it('1 por dia, 4 em 7 dias, janela 8h–21h, pausa e preferências', () => {
    forAll(
      (r) => {
        const now = brtCalendar.at(brtCalendar.addDays('2026-01-01', r.int(0, 400)), r.int(0, 23), r.int(0, 59));
        const today = brtCalendar.clock(now).dayId;
        const opts = nextRunPlanOptions(now - r.int(0, 3) * 86_400_000);
        const s = state({
          createdAt: brtCalendar.at(brtCalendar.addDays(today, -40), 12),
          lastActivityAt: r.bool(0.3) ? null : Math.min(now, brtCalendar.at(brtCalendar.addDays(today, -r.int(0, 9)), r.int(5, 22))),
          week: { activities: r.int(0, 3), meters: 4000, zones: 2 },
          dailyChestsStored: r.int(0, 3),
          plan: r.bool(0.8) ? { at: r.pick(opts).at } : null,
          crewEcho: r.bool(0.6) ? { mate: 'ana', cells: r.int(0, 5), notifyFrom: brtCalendar.at(today, 7), notifyUntil: brtCalendar.at(today, 22) } : null,
          sent: Array.from({ length: r.int(0, 5) }, (_, i) => ({ id: 'n-bau', key: `old-${i}`, at: now - r.int(1, 6 * 24) * 3_600_000 })),
          ignoredInARow: r.int(0, 4),
          pause: r.bool(0.15) ? { from: today, until: brtCalendar.addDays(today, 6) } : null,
        });
        const prefs = { plan: r.bool(0.85), crewEcho: r.bool(0.85), ...(r.bool(0.3) ? { quietStart: r.int(9, 21) } : {}) };
        return { s, prefs, now };
      },
      ({ s, prefs, now }) => {
        const out = planReminders(s, prefs, now);
        const days = out.map((p) => brtCalendar.clock(p.at).dayId);
        expect(new Set(days).size).toBe(days.length);
        const sentDays = s.sent.map((x) => brtCalendar.clock(x.at).dayId);
        const limit = s.ignoredInARow >= REMINDER_LIMITS.fatigueAfterIgnored ? REMINDER_LIMITS.fatiguedPerWeek : REMINDER_LIMITS.perWeek;
        for (const p of out) {
          const c = brtCalendar.clock(p.at);
          expect(p.at).toBeGreaterThan(now);
          expect(c.hour * 60 + c.minute).toBeGreaterThanOrEqual(8 * 60);
          expect(c.hour * 60 + c.minute).toBeLessThanOrEqual(21 * 60);
          expect(sentDays).not.toContain(c.dayId);
          if (s.pause) expect(c.dayId >= s.pause.from && c.dayId <= s.pause.until).toBe(false);
          if (p.kind === 'plano') expect(prefs.plan).toBe(true);
          if (p.kind === 'eco') {
            expect(prefs.crewEcho).toBe(true);
            expect(p.at).toBeLessThan(s.crewEcho!.notifyUntil);
          }
          expect(p.text.length).toBeLessThanOrEqual(REMINDER_TEXT_MAX);
          expect(hasGuiltWords(p.text)).toBe(false);
        }
        const all = [...sentDays, ...days].sort();
        for (const d of days) expect(all.filter((x) => x >= brtCalendar.addDays(d, -6) && x <= d).length).toBeLessThanOrEqual(limit);
      },
      400,
    );
  });
});
