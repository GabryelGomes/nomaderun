import { describe, expect, it } from '@jest/globals';

import { FTUE_STEP_IDS, missionById } from '../missions';
import { brtCalendar } from '../progression';
import {
  gameAlertMode,
  GUILT_PATTERN,
  hasGuiltWords,
  planReminders,
  REMINDER_CATALOG,
  REMINDER_LIMITS,
  REMINDER_TEXT_MAX,
  reminderText,
  shortZoneName,
  usualStartHour,
  type PlannedReminder,
  type ReminderPrefKey,
  type ReminderPrefs,
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

describe('D-69 — catálogo de notificações', () => {
  it('tem os 15 ids da F1 e uma preferência por tipo', () => {
    expect(REMINDER_CATALOG.map((r) => r.id)).toEqual([
      'n-chefao', 'n-liga', 'n-sequencia', 'n-missao', 'n-bau', 'n-ftue', 'n-recap', 'n-temporada',
      'n-volta-7', 'n-volta-14', 'n-volta-14-zona', 'n-volta-21', 'n-volta-30', 'n-invasao', 'n-conquista',
    ]);
    const prefByKind = new Map<string, Set<ReminderPrefKey>>();
    for (const r of REMINDER_CATALOG) prefByKind.set(r.kind, (prefByKind.get(r.kind) ?? new Set()).add(r.pref));
    for (const prefs of prefByKind.values()) expect(prefs.size).toBe(1);
  });

  it('todo texto possível tem no máximo 60 caracteres e nenhuma palavra de culpa', () => {
    const texts: string[] = [];
    for (let x = 0; x <= 14; x++) texts.push(reminderText('n-chefao', { x }));
    for (let x = 0; x <= 3; x++) texts.push(reminderText('n-liga', { x }));
    for (let m = 0; m <= 45_000; m += 500) texts.push(reminderText('n-missao', { meters: m }));
    for (const id of FTUE_STEP_IDS) {
      const def = missionById(id);
      texts.push(reminderText('n-ftue', { x: 7, step: def?.text }));
      if (def?.fallback) texts.push(reminderText('n-ftue', { x: 7, step: def.fallback.text }));
    }
    for (const meters of [0, 1000, 120_500, 999_999, 9_999_999]) {
      for (const y of [0, 1, 99, 9999]) texts.push(reminderText('n-recap', { meters, y }));
    }
    for (let month = 1; month <= 12; month++) texts.push(reminderText('n-temporada', { month }));
    const zone = 'Parque Vaca Brava e Arredores do Setor Bueno';
    texts.push(reminderText('n-volta-14-zona', { zone }), reminderText('n-invasao', { zone }));
    for (const x of [1, 12, 999]) texts.push(reminderText('n-conquista', { x }));
    for (const r of REMINDER_CATALOG) texts.push(reminderText(r.id));
    for (const t of texts) {
      expect(t.length).toBeGreaterThan(0);
      expect(t.length).toBeLessThanOrEqual(REMINDER_TEXT_MAX);
      expect(t).not.toMatch(/\{[a-z]+\}/);
      expect(hasGuiltWords(t)).toBe(false);
    }
  });

  it('singular e plural, km no padrão brasileiro e nome de zona cortado', () => {
    expect(reminderText('n-liga', { x: 1 })).toBe('A liga fecha hoje: você está a 1 posição de subir.');
    expect(reminderText('n-liga', { x: 2 })).toBe('A liga fecha hoje: você está a 2 posições de subir.');
    expect(reminderText('n-missao', { meters: 1500 })).toBe('Falta 1,5 km para a missão da semana.');
    expect(reminderText('n-missao', { meters: 12_500 })).toBe('Faltam 12,5 km para a missão da semana.');
    expect(reminderText('n-recap', { meters: 21_300, y: 1 })).toBe('Sua semana: 21,3 km e 1 zona pintada. Veja o recap.');
    expect(reminderText('n-recap', { meters: 150_400, y: 30 })).toBe('Sua semana: 150 km e 30 zonas pintadas. Veja o recap.');
    expect(reminderText('n-ftue', { x: 2, step: 'Abra seu primeiro baú na Caça' })).toBe('Passo 2 de 7 liberado: abra seu primeiro baú na Caça.');
    expect(reminderText('n-temporada', { month: 11 })).toBe('Temporada de novembro começou: trilha nova e troca de time.');
    expect(reminderText('n-temporada', { month: 99 })).toContain('dezembro');
    expect(reminderText('n-conquista', { x: 1 })).toBe('Você conquistou 1 zona para o seu time!');
    expect(reminderText('n-chefao', { x: 14 })).toBe('O chefão está com 14% de vida. Sua corrida conta!');
    expect(reminderText('nao-existe')).toBe('');
    expect(shortZoneName('  Praça Cívica  ')).toBe('Praça Cívica');
    expect(shortZoneName('Parque Vaca Brava e Arredores')).toBe('Parque Vaca Brava e A…');
    expect(shortZoneName('Parque Vaca Brava e Arredores')).toHaveLength(22);
  });

  it('o filtro de culpa pega as frases proibidas', () => {
    for (const t of ['Você abandonou seu time', 'Seu time está decepcionado', 'Última chance!', 'Você vai perder a sequência', 'Sentimos sua falta']) {
      expect(hasGuiltWords(t)).toBe(true);
    }
    expect(GUILT_PATTERN.test('Caminhar vale!')).toBe(false);
  });
});

describe('horário habitual', () => {
  it('mediana das horas de início das 10 atividades mais novas; sem histórico, 19h', () => {
    expect(usualStartHour([])).toBe(19);
    expect(usualStartHour([at(WED, 6), at(WED, 7), at(WED, 20)])).toBe(7);
    expect(usualStartHour([at(WED, 6), at(WED, 9)])).toBe(7);
    expect(usualStartHour([...Array(10).fill(at(WED, 6)), ...Array(10).fill(at(WED, 20))])).toBe(6);
  });
});

describe('planReminders — casos', () => {
  // Estado-base: correu hoje (quarta) às 7h e abriu os baús; nada pendente na semana.
  const OFF: ReminderPrefs = { chests: false };
  const notToday = at('2026-10-20', 7);

  it('sem motivo verdadeiro, nada é agendado', () => {
    expect(planReminders(state(), OFF, NOW)).toEqual([]);
  });

  it('sábado com 1 de 2 atividades: lembrete da sequência 1 h antes do horário habitual (mínimo 8h)', () => {
    const plan = planReminders(state({ week: { activities: 1, meters: 3000, zones: 2 }, recentStartTimes: [at('2026-10-20', 7)] }), OFF, NOW);
    expect(ids(plan)).toEqual(['n-sequencia@2026-10-24 8:00', 'n-recap@2026-10-26 8:00']);
    expect(plan[0]).toMatchObject({ kind: 'sequencia', pref: 'streak', key: 'n-sequencia:2026-W43', identifier: 'eng:n-sequencia:2026-W43' });
    expect(plan[0].text).toBe('Falta 1 atividade para garantir a semana. Caminhar vale!');
    expect(plan[1].text).toBe('Sua semana: 3 km e 2 zonas pintadas. Veja o recap.');
  });

  it('baús: aviso no dia em que chegam a 3 guardados, no máximo 1 a cada 7 dias (18h sem histórico)', () => {
    expect(ids(planReminders(state(), {}, NOW))).toEqual(['n-bau@2026-10-24 18:00']);
    const plan = planReminders(state({ dailyChestsStored: 3, lastActivityAt: notToday }), {}, NOW);
    expect(ids(plan)).toEqual(['n-bau@2026-10-21 18:00', 'n-volta-7@2026-10-27 18:00']);
    expect(plan[0].text).toBe('Seus 3 baús do dia estão guardados. Uma corrida abre todos.');
  });

  it('nada no dia em que a pessoa já correu', () => {
    const plan = planReminders(state({ dailyChestsStored: 3 }), {}, NOW);
    expect(ids(plan)).toEqual(['n-bau@2026-10-22 18:00']);
  });

  it('prioridade: no mesmo dia, sequência ganha do baú; o baú vai para o dia seguinte', () => {
    const plan = planReminders(
      state({ week: { activities: 1, meters: 0, zones: 0 }, dailyChestsStored: 3, lastActivityAt: notToday }),
      { recap: false },
      brtCalendar.at('2026-10-24', 7),
    );
    expect(ids(plan)).toEqual(['n-sequencia@2026-10-24 18:00', 'n-bau@2026-10-25 18:00', 'n-volta-7@2026-10-27 18:00']);
  });

  it('missão semanal a ≥ 70%: aviso na sexta (ou no sábado)', () => {
    const wm = { ratio: 0.8, remainingMeters: 4000 };
    const plan = planReminders(state({ weeklyMission: wm }), OFF, NOW);
    expect(ids(plan)).toEqual(['n-missao@2026-10-23 18:00']);
    expect(plan[0].text).toBe('Faltam 4 km para a missão da semana.');
    expect(planReminders(state({ weeklyMission: { ratio: 0.6, remainingMeters: 9000 } }), OFF, NOW)).toEqual([]);
    expect(planReminders(state({ weeklyMission: { ratio: 1, remainingMeters: 0 } }), OFF, NOW)).toEqual([]);
    expect(ids(planReminders(state({ weeklyMission: wm }), OFF, brtCalendar.at('2026-10-23', 22)))).toEqual([
      'n-missao@2026-10-24 18:00',
      'n-volta-7@2026-10-28 18:00',
    ]);
  });

  it('primeira semana: passo liberado avisa às 9h, só nos 14 primeiros dias', () => {
    const ftue = { startedAt: at('2026-10-20', 19), step: 2, stepText: 'Abra seu primeiro baú na Caça', unlocksAt: at(WED, 0) };
    const plan = planReminders(state({ createdAt: at('2026-10-20', 19), ftue }), OFF, NOW);
    expect(ids(plan)).toEqual(['n-ftue@2026-10-22 9:00']);
    expect(plan[0]).toMatchObject({ key: 'n-ftue:2', text: 'Passo 2 de 7 liberado: abra seu primeiro baú na Caça.' });
    expect(planReminders(state({ ftue: { ...ftue, startedAt: at('2026-10-05', 19) } }), OFF, NOW)).toEqual([]);
  });

  it('recap da segunda às 8h; na própria segunda cedo, usa a semana anterior', () => {
    const monday = brtCalendar.at('2026-10-26', 6);
    const s = state({ lastActivityAt: at('2026-10-25', 7), previousWeek: { activities: 2, meters: 8000, zones: 5 } });
    const plan = planReminders(s, OFF, monday);
    expect(ids(plan)).toEqual(['n-recap@2026-10-26 8:00', 'n-volta-7@2026-11-01 18:00']);
    expect(plan[0].key).toBe('n-recap:2026-W43');
    expect(ids(planReminders({ ...s, previousWeek: { activities: 0, meters: 0, zones: 0 } }, OFF, monday))).toEqual(['n-volta-7@2026-11-01 18:00']);
  });

  it('temporada nova: dia 1, 9h', () => {
    const plan = planReminders(state({ lastActivityAt: at('2026-10-28', 7) }), OFF, brtCalendar.at('2026-10-28', 12));
    expect(ids(plan)).toEqual(['n-temporada@2026-11-01 9:00']);
    expect(plan[0]).toMatchObject({ key: 'n-temporada:2026-11', text: 'Temporada de novembro começou: trilha nova e troca de time.' });
  });

  it('escada de volta: 7, 14, 21 e 30 dias sem atividade, só ela, e depois silêncio', () => {
    const away = (days: number) => state({ lastActivityAt: at(brtCalendar.addDays(WED, -days), 7), dailyChestsStored: 3 });
    expect(ids(planReminders(away(7), {}, NOW))).toEqual(['n-volta-7@2026-10-21 18:00']);
    expect(ids(planReminders(away(10), {}, NOW))).toEqual(['n-volta-14@2026-10-25 18:00']);
    expect(ids(planReminders(away(20), {}, NOW))).toEqual(['n-volta-21@2026-10-22 18:00']);
    expect(ids(planReminders(away(28), {}, NOW))).toEqual(['n-volta-30@2026-10-23 18:00']);
    expect(planReminders(away(31), {}, NOW)).toEqual([]);
    expect(planReminders(away(200), {}, NOW)).toEqual([]);
    expect(ids(planReminders(away(4), {}, NOW))).toEqual(['n-bau@2026-10-21 18:00', 'n-volta-7@2026-10-24 18:00']);
    expect(planReminders(away(7), { comeback: false }, NOW)).toEqual([]);
  });

  it('cada degrau da escada sai 1 vez por ausência', () => {
    const lastDay = brtCalendar.addDays(WED, -7);
    const s = state({ lastActivityAt: at(lastDay, 7), sent: [{ id: 'n-volta-7', key: `n-volta-7:${lastDay}`, at: at('2026-10-20', 18) }] });
    expect(planReminders(s, {}, NOW)).toEqual([]);
  });

  it('quem nunca correu não recebe a escada de volta', () => {
    expect(planReminders(state({ createdAt: at('2026-10-01', 12), lastActivityAt: null, dailyChestsStored: 1 }), {}, NOW)).toEqual([]);
  });

  it('pausa de saúde e "pausar lembretes" silenciam o engajamento', () => {
    const busy = state({ dailyChestsStored: 3, weeklyMission: { ratio: 0.9, remainingMeters: 2000 } });
    expect(planReminders({ ...busy, pause: { from: '2026-10-19', until: '2026-11-15' } }, {}, NOW)).toEqual([]);
    expect(ids(planReminders({ ...busy, pause: { from: '2026-10-19', until: '2026-10-25' } }, {}, NOW))).toEqual(['n-bau@2026-10-26 18:00']);
    expect(ids(planReminders(busy, { snoozeUntil: brtCalendar.at('2026-10-25') }, NOW))).toEqual(['n-bau@2026-10-25 18:00']);
  });

  it('preferência desligada nunca envia aquele tipo', () => {
    const busy = state({ dailyChestsStored: 3, weeklyMission: { ratio: 0.9, remainingMeters: 2000 } });
    expect(planReminders(busy, {}, NOW).map((p) => p.id)).toEqual(['n-bau', 'n-missao']);
    expect(planReminders(busy, { chests: false }, NOW).map((p) => p.id)).toEqual(['n-missao']);
    expect(planReminders(busy, { chests: false, missions: false }, NOW)).toEqual([]);
  });

  it('silêncio da pessoa só amplia a janela de 8h às 21h', () => {
    const ftue = { startedAt: at('2026-10-20', 19), step: 2, stepText: 'Abra seu primeiro baú na Caça', unlocksAt: at(WED, 0) };
    const s = state({ ftue });
    expect(ids(planReminders(s, { ...OFF, quietEnd: 10 }, NOW))).toEqual(['n-ftue@2026-10-22 10:00']);
    expect(ids(planReminders(s, { ...OFF, quietEnd: 5 }, NOW))).toEqual(['n-ftue@2026-10-22 9:00']);
    const late = state({ dailyChestsStored: 3, recentStartTimes: [at(WED, 21), at(WED, 22)] });
    expect(ids(planReminders(late, {}, NOW))).toEqual(['n-bau@2026-10-22 19:00']);
    expect(ids(planReminders(late, { quietStart: 17 }, NOW))).toEqual(['n-bau@2026-10-22 16:59']);
    expect(ids(planReminders(late, { quietStart: 2 }, NOW))).toEqual(['n-bau@2026-10-22 19:00']);
    expect(planReminders(late, { quietStart: 9, quietEnd: 21 }, NOW)).toEqual([]);
  });

  it('no máximo 1 por dia, contando o que já foi entregue', () => {
    const s = state({ dailyChestsStored: 3, lastActivityAt: notToday, sent: [{ id: 'n-chefao', key: 'n-chefao:raid-1', at: at(WED, 9) }] });
    expect(ids(planReminders(s, {}, NOW))).toEqual(['n-bau@2026-10-22 18:00', 'n-volta-7@2026-10-27 18:00']);
  });

  it('no máximo 4 em 7 dias, e 1 por semana quando as 3 últimas foram ignoradas', () => {
    const sent = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'].map((d, i) => ({ id: 'n-liga', key: `x${i}`, at: at(d, 10) }));
    expect(ids(planReminders(state({ dailyChestsStored: 3, lastActivityAt: notToday, sent }), {}, NOW))).toEqual([
      'n-bau@2026-10-23 18:00',
      'n-volta-7@2026-10-27 18:00',
    ]);
    const tired = state({ dailyChestsStored: 3, lastActivityAt: notToday, ignoredInARow: 3, sent: [{ id: 'n-bau', key: 'old', at: at('2026-10-18', 18) }] });
    expect(ids(planReminders(tired, {}, NOW))).toEqual(['n-bau@2026-10-25 18:00']);
  });
});

describe('planReminders — propriedades', () => {
  const PREF_KEYS: ReminderPrefKey[] = ['missions', 'chests', 'streak', 'season', 'recap', 'comeback'];

  it('limites, janela, dia corrido, pausa, preferências, silêncio após 30 dias e textos', () => {
    forAll(
      (r) => {
        const now = brtCalendar.at(brtCalendar.addDays('2026-01-01', r.int(0, 600)), r.int(0, 23), r.int(0, 59));
        const today = brtCalendar.clock(now).dayId;
        const ranAgo = r.pick([null, 0, 0, 1, 2, 5, 6, 7, 8, 13, 14, 20, 21, 25, 29, 30, 31, 60]);
        const lastActivityAt = ranAgo === null ? null : Math.min(now, brtCalendar.at(brtCalendar.addDays(today, -ranAgo), r.int(5, 22)));
        const pauseFrom = brtCalendar.addDays(today, r.int(-20, 5));
        const s: ReminderState = {
          createdAt: brtCalendar.at(brtCalendar.addDays(today, -r.int(0, 90)), 12),
          lastActivityAt,
          recentStartTimes: Array.from({ length: r.int(0, 12) }, () => brtCalendar.at(today, r.int(0, 23))),
          week: { activities: r.int(0, 3), meters: r.int(0, 60_000), zones: r.int(0, 40) },
          previousWeek: r.bool() ? { activities: r.int(0, 4), meters: r.int(0, 80_000), zones: r.int(0, 60) } : null,
          dailyChestsStored: r.int(0, 3),
          weeklyMission: r.bool() ? { ratio: r.float(0.5, 1.1), remainingMeters: r.int(0, 30_000) } : null,
          ftue: r.bool(0.3)
            ? { startedAt: brtCalendar.at(brtCalendar.addDays(today, -r.int(0, 20)), 10), step: r.int(1, 7), stepText: 'Abra seu primeiro baú na Caça', unlocksAt: now + r.int(-3, 3) * 86_400_000 }
            : null,
          pause: r.bool(0.2) ? { from: pauseFrom, until: brtCalendar.addDays(pauseFrom, r.int(6, 27)) } : null,
          sent: Array.from({ length: r.int(0, 6) }, (_, i) => ({ id: 'n-bau', key: `old-${i}`, at: now - r.int(1, 7 * 24) * 3_600_000 })),
          ignoredInARow: r.int(0, 4),
        };
        const prefs: ReminderPrefs = {};
        for (const k of PREF_KEYS) if (r.bool(0.2)) prefs[k] = false;
        if (r.bool(0.3)) prefs.quietStart = r.int(0, 23);
        if (r.bool(0.3)) prefs.quietEnd = r.int(0, 23);
        return { s, prefs, now };
      },
      ({ s, prefs, now }) => {
        const plan = planReminders(s, prefs, now);
        const today = brtCalendar.clock(now).dayId;
        const ranToday = s.lastActivityAt !== null && brtCalendar.clock(s.lastActivityAt).dayId === today;
        const anchor = brtCalendar.clock(s.lastActivityAt ?? s.createdAt).dayId;
        const days = plan.map((p) => brtCalendar.clock(p.at).dayId);
        const sentDays = s.sent.map((x) => brtCalendar.clock(x.at).dayId);
        const limit = s.ignoredInARow >= REMINDER_LIMITS.fatigueAfterIgnored ? REMINDER_LIMITS.fatiguedPerWeek : REMINDER_LIMITS.perWeek;

        expect(new Set(plan.map((p) => p.key)).size).toBe(plan.length);
        expect(new Set(days).size).toBe(days.length);
        for (const p of plan) {
          const c = brtCalendar.clock(p.at);
          const minutes = c.hour * 60 + c.minute;
          expect(p.at).toBeGreaterThan(now);
          expect(p.at).toBeLessThan(now + 8 * 86_400_000);
          expect(minutes).toBeGreaterThanOrEqual(8 * 60);
          expect(minutes).toBeLessThanOrEqual(21 * 60);
          expect(gameAlertMode(p.at, prefs)).toBe('banner');
          expect(sentDays).not.toContain(c.dayId);
          if (ranToday) expect(c.dayId).not.toBe(today);
          if (s.pause) expect(c.dayId >= s.pause.from && c.dayId <= s.pause.until).toBe(false);
          expect(prefs[p.pref]).not.toBe(false);
          const away = brtCalendar.daysBetween(anchor, c.dayId);
          expect(away).toBeLessThanOrEqual(30);
          if (away >= 7) expect([p.id, REMINDER_LIMITS.comebackLadder.includes(away)]).toEqual([`n-volta-${away}`, true]);
          if (p.kind === 'volta') expect(s.lastActivityAt).not.toBeNull();
          expect(p.text.length).toBeLessThanOrEqual(REMINDER_TEXT_MAX);
          expect(hasGuiltWords(p.text)).toBe(false);
        }
        const all = [...sentDays, ...days].sort();
        for (const d of all) {
          const from = brtCalendar.addDays(d, -6);
          const inWindow = all.filter((x) => x >= from && x <= d).length;
          if (days.includes(d)) expect(inWindow).toBeLessThanOrEqual(limit);
        }
      },
      400,
    );
  });
});

describe('alertas de jogo (invasão, conquista)', () => {
  it('entre 22h e 7h ficam só na central', () => {
    expect(gameAlertMode(at(WED, 23))).toBe('central');
    expect(gameAlertMode(at(WED, 6, 59))).toBe('central');
    expect(gameAlertMode(at(WED, 7))).toBe('banner');
    expect(gameAlertMode(at(WED, 21, 59))).toBe('banner');
    expect(gameAlertMode(at(WED, 22))).toBe('central');
  });

  it('o silêncio maior da pessoa também vale; um silêncio menor é ignorado', () => {
    expect(gameAlertMode(at(WED, 20, 30), { quietStart: 20 })).toBe('central');
    expect(gameAlertMode(at(WED, 8), { quietEnd: 9 })).toBe('central');
    expect(gameAlertMode(at(WED, 23), { quietStart: 23 })).toBe('central');
    expect(gameAlertMode(at(WED, 6), { quietEnd: 5 })).toBe('central');
  });
});
