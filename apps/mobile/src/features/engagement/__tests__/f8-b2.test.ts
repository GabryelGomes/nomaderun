/**
 * @jest-environment node
 *
 * F8 · B2 (E7) — engajamento que faz sentido: regras puras dos momentos (1º trecho, recorde, bairro novo, líder),
 * da missão de boas-vindas ligada ao estado real, da semana do time, do eco da crew e do plano (D-94).
 * Nada aqui inventa dado: sem o fato, `null`.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => ({ ...require('@/components/motion/__tests__/render-mocks').reanimated, withRepeat: (v: unknown) => v }));
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
/* eslint-enable @typescript-eslint/no-require-imports */

const mockMemory = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (k: string) => (mockMemory.has(k) ? JSON.parse(JSON.stringify(mockMemory.get(k))) : null),
  writeLocal: async (k: string, v: unknown) => {
    if (v === null || v === undefined) mockMemory.delete(k);
    else mockMemory.set(k, v);
  },
}));

/* eslint-disable import/first */
import { ALERT_PRIORITY, pickAlert } from '@/components/alert-slot';
import { brtCalendar } from '@/domain/progression';
import { GUILT_PATTERN } from '@/domain/reminders';
import { FACTION_IDS } from '@/domain/types';
import { buildReminderState, newLog, toReminderPrefs } from '@/features/notifications/reminder-state';
import { reminderRoute } from '@/features/notifications/reminders';
import { mapAlerts, pickMapMission, welcomeMission } from '@/features/screens/map-screen.model';
import { toProfile, toProfileRow } from '@/services/api/types';

import { echoNow, echoText } from '../crew-echo';
import { fillLeaderLine, LEADER_FEAT_KINDS, LEADER_LINE_MAX, LEADER_LINES, leaderLine } from '../leader-lines';
import { districtName, districtStamps, firstPaintLiveEligible, HISTORY_PAGE, newDistrictStamp, recapLeaderFeat, summaryLeaderFeat, type RunFacts, type StampRun } from '../moments';
import { answerPlan, PLAN_KEY, planQuestionDue, readPendingPlan, readPlanMemory } from '../next-run-plan';
import { teamWeekBody, teamWeekDue } from '../team-week';
import { welcomeDoneDue } from '../welcome-done';
/* eslint-enable import/first */

const WED = brtCalendar.at('2026-10-21', 10);
const MON = brtCalendar.at('2026-10-26', 9);

/** Distrito falso para o teste: o prefixo antes do "-" (os ids reais são H3). */
const dist = (id: string) => id.split('-')[0];

describe('o líder comenta o feito real (5.3)', () => {
  const LONG = { n: 9999, prev: 9998, zone: 'Parque Vaca Brava e Arredores do Setor Bueno', district: 'Jardim Goiás de Cima e de Baixo', km: '999,9' };

  it('30 falas por líder (10 tipos × 3), todas ≤ 90 caracteres e nenhuma bate no filtro de culpa', () => {
    for (const team of FACTION_IDS) {
      const lines = LEADER_LINES[team];
      expect(Object.keys(lines).sort()).toEqual([...LEADER_FEAT_KINDS].sort());
      let count = 0;
      for (const kind of LEADER_FEAT_KINDS) {
        for (const t of lines[kind]) {
          count++;
          expect(GUILT_PATTERN.test(t)).toBe(false);
          const filled = fillLeaderLine(t, { kind, ...LONG });
          expect(filled).not.toBeNull();
          expect(filled!.length).toBeLessThanOrEqual(LEADER_LINE_MAX);
          expect(filled).not.toMatch(/\{[a-z]+\}/);
          expect(GUILT_PATTERN.test(filled!)).toBe(false);
          // Comparação só consigo: nenhuma fala cita outra pessoa ou ranking.
          expect(filled).not.toMatch(/ranking|melhor que (ele|ela|os outros)|primeiro lugar/i);
        }
      }
      expect(count).toBe(30);
    }
  });

  it('sem o dado que a fala cita, nada (não inventa número nem nome)', () => {
    expect(fillLeaderLine('{n} trechos', { kind: 'trechos' })).toBeNull();
    expect(fillLeaderLine('{zona} é nossa', { kind: 'conquista', zone: '  ' })).toBeNull();
    expect(leaderLine('volt', null, 'x')).toBeNull();
    expect(leaderLine('volt', { kind: 'trechos', n: 0 }, 'x')).toBeNull();
  });

  it('a escolha é determinística (mesma corrida, mesma fala) e usa o número real', () => {
    const a = leaderLine('striders', { kind: 'trechos', n: 12 }, 'run-1');
    expect(a).toBe(leaderLine('striders', { kind: 'trechos', n: 12 }, 'run-1'));
    expect(a).toContain('12');
    expect(leaderLine('coyotes', { kind: 'recorde', n: 47, prev: 31 }, 'r')).toMatch(/47/);
    expect(leaderLine('owls', { kind: 'conquista', zone: 'Jardim Goiás · perto do Estádio' }, 'r')!.length).toBeLessThanOrEqual(90);
  });
});

describe('o feito do resumo e do recap', () => {
  const base: RunFacts = { counts: true, milestones: null, conqueredZone: null, defendedZone: null, newDistrict: null, beatGhost: null, meters: 0 };

  it('do mais raro para o mais comum; provisório ou rejeitado não comemora', () => {
    expect(summaryLeaderFeat({ ...base, milestones: { firstPaint: true, cells: 3, cellsRecord: null }, conqueredZone: 'X' })?.kind).toBe('primeiro-trecho');
    expect(summaryLeaderFeat({ ...base, milestones: { firstPaint: false, cells: 47, cellsRecord: { value: 47, previous: 31 } } })).toEqual({ kind: 'recorde', n: 47, prev: 31 });
    expect(summaryLeaderFeat({ ...base, conqueredZone: 'Setor Bueno', newDistrict: 'Bueno' })?.kind).toBe('conquista');
    expect(summaryLeaderFeat({ ...base, newDistrict: 'Bueno', defendedZone: 'Y' })?.kind).toBe('bairro-novo');
    expect(summaryLeaderFeat({ ...base, defendedZone: 'Y', beatGhost: true })?.kind).toBe('defesa');
    expect(summaryLeaderFeat({ ...base, beatGhost: true })?.kind).toBe('fantasma');
    expect(summaryLeaderFeat({ ...base, milestones: { firstPaint: false, cells: 5, cellsRecord: null } })).toEqual({ kind: 'trechos', n: 5 });
    expect(summaryLeaderFeat({ ...base, meters: 5230 })).toEqual({ kind: 'distancia', km: '5,2' });
    expect(summaryLeaderFeat({ ...base, meters: 800 })).toBeNull();
    expect(summaryLeaderFeat({ ...base, counts: false, conqueredZone: 'X' })).toBeNull();
  });

  it('recap: zonas da semana, senão corridas; semana vazia não tem fala', () => {
    expect(recapLeaderFeat({ runs: 3, zones: 2 })).toEqual({ kind: 'semana-zonas', n: 2 });
    expect(recapLeaderFeat({ runs: 3, zones: 0 })).toEqual({ kind: 'semana', n: 3 });
    expect(recapLeaderFeat({ runs: 0, zones: 0 })).toBeNull();
  });
});

describe('carimbo de bairro novo (5.8)', () => {
  const run = (id: string, at: number, zones: { zoneId: string; name: string; rp: number }[], status = 'valid'): StampRun => ({ id, status, startedAt: at, endedAt: at + 1, result: { zones } });
  const H = [
    run('a', 1, [{ zoneId: 'D1-1', name: 'Setor Bueno · perto do Parque', rp: 10 }]),
    run('b', 2, [{ zoneId: 'D2-1', name: 'Jardim Goiás · perto do Estádio', rp: 0 }]),
    run('c', 3, [{ zoneId: 'D3-1', name: 'Centro', rp: 5 }], 'rejected'),
  ];

  it('Atlas: 1 carimbo por distrito, na 1ª corrida que pontuou (zona sem ponto ou corrida rejeitada não carimba)', () => {
    expect(districtStamps(H, dist)).toEqual([{ district: 'D1', name: 'Setor Bueno', at: 2, runId: 'a' }]);
    expect(districtName('Jardim Goiás · perto do Estádio')).toBe('Jardim Goiás');
    expect(districtName('')).toBe('Bairro novo');
  });

  it('resumo: só com distrito novo, histórico completo e não na 1ª corrida com pontos', () => {
    const zones = [{ zoneId: 'D2-9', name: 'Jardim Goiás · perto do Estádio', rp: 8 }];
    expect(newDistrictStamp({ runId: 'n', zones, history: H }, dist)).toEqual({ district: 'D2', name: 'Jardim Goiás' });
    expect(newDistrictStamp({ runId: 'n', zones: [{ zoneId: 'D1-2', name: 'Setor Bueno', rp: 3 }], history: H }, dist)).toBeNull();
    expect(newDistrictStamp({ runId: 'n', zones, history: null }, dist)).toBeNull();
    expect(newDistrictStamp({ runId: 'n', zones, history: [] }, dist)).toBeNull();
    const full = Array.from({ length: HISTORY_PAGE }, (_, i) => run(`h${i}`, i, [{ zoneId: 'D1-1', name: 'x', rp: 1 }]));
    expect(newDistrictStamp({ runId: 'n', zones, history: full }, dist)).toBeNull();
    // A própria corrida no histórico não conta como "antes".
    expect(newDistrictStamp({ runId: 'a', zones: [{ zoneId: 'D1-1', name: 'Setor Bueno', rp: 3 }], history: H }, dist)).toBeNull();
  });
});

describe('"Primeiro trecho!" ao vivo (5.1)', () => {
  it('só quando o servidor diz que a pessoa nunca correu e não há corrida no aparelho', () => {
    expect(firstPaintLiveEligible({ statusKnown: true, lastActivityAt: null, localRuns: 0, celebrated: false })).toBe(true);
    expect(firstPaintLiveEligible({ statusKnown: false, lastActivityAt: undefined, localRuns: 0, celebrated: false })).toBe(false);
    expect(firstPaintLiveEligible({ statusKnown: true, lastActivityAt: WED, localRuns: 0, celebrated: false })).toBe(false);
    expect(firstPaintLiveEligible({ statusKnown: true, lastActivityAt: null, localRuns: 1, celebrated: false })).toBe(false);
    expect(firstPaintLiveEligible({ statusKnown: true, lastActivityAt: null, localRuns: 0, celebrated: true })).toBe(false);
  });
});

describe('missão de boas-vindas ligada ao estado real (UX-02, UX-32)', () => {
  const names = { zoneName: (id: string) => id, attackerName: () => 'Volt Runners' };
  const attacked = [{ id: 'z1', owner: 'striders', attacker: 'volt', attackStartedAt: WED - 3_600_000 } as never];

  it('0 corridas: 2 de 3 e vence o ataque; correu sem zona: 3 de 4, abaixo do ataque; correu e conquistou: some', () => {
    const w0 = welcomeMission(0, null)!;
    expect(w0).toMatchObject({ done: 2, steps: ['Conta', 'Time', '1ª corrida'], first: true });
    const alerts0 = mapAlerts({ attacked, ...names, today: { mission: w0 }, now: WED });
    expect(pickAlert(alerts0.map((a) => ({ ...a, onPress: () => {} })))?.kind).toBe('welcome');

    const w1 = welcomeMission(1, false)!;
    expect(w1).toMatchObject({ done: 3, steps: ['Conta', 'Time', '1ª corrida', '1ª zona'] });
    expect(w1.first).toBeUndefined();
    const alerts1 = mapAlerts({ attacked, ...names, today: { mission: w1 }, now: WED });
    expect(pickAlert(alerts1.map((a) => ({ ...a, onPress: () => {} })))?.kind).toBe('attack');

    expect(welcomeMission(1, true)).toBeNull();
    expect(welcomeMission(4, null)).toBeNull();
    expect(welcomeMission(null, false)).toBeNull();
  });

  it('com 0 corridas a missão inicial vence até a primeira semana da E7; depois, a da E7', () => {
    const coach = { id: 'hoje-primeira-semana', title: 'Passo 1', steps: ['a', 'b'], done: 0, href: '/missoes' as const };
    expect(pickMapMission(welcomeMission(0), coach)?.id).toBe('boas-vindas');
    expect(pickMapMission(welcomeMission(2, false), coach)?.id).toBe('hoje-primeira-semana');
    expect(pickMapMission(welcomeMission(2, false), null)?.id).toBe('boas-vindas-zona');
    expect(pickMapMission(null, null)).toBeNull();
  });

  it('prioridade única da vaga: missão inicial → ataque → missão → baú → chefão → recap', () => {
    expect(ALERT_PRIORITY.slice(0, 6)).toEqual(['welcome', 'attack', 'mission', 'chest', 'boss', 'recap']);
    const all = mapAlerts({
      attacked: [],
      ...names,
      today: { chest: { credits: 1, meters: 300 }, boss: { name: 'Soneca', hp: 0.1 }, recap: { title: 'Sua semana está pronta', body: 'Veja o recap' } },
      now: WED,
    });
    expect(all.map((a) => a.kind)).toEqual(['chest', 'boss', 'recap']);
    expect(all.find((a) => a.kind === 'recap')?.href).toBe('/compartilhar/semana');
  });

  it('a celebração "Missão 1 feita" sai 1 vez, só para quem viu a missão aberta', () => {
    expect(welcomeDoneDue({ seen: true, celebrated: false, complete: true })).toBe(true);
    expect(welcomeDoneDue({ seen: false, celebrated: false, complete: true })).toBe(false);
    expect(welcomeDoneDue({ seen: true, celebrated: true, complete: true })).toBe(false);
    expect(welcomeDoneDue({ seen: true, celebrated: false, complete: false })).toBe(false);
  });
});

describe('a semana do time (5.10)', () => {
  it('só na segunda e 1 vez por semana', () => {
    expect(teamWeekDue(MON, null)).toBe(true);
    expect(teamWeekDue(MON, brtCalendar.clock(MON).weekId)).toBe(false);
    expect(teamWeekDue(WED, null)).toBe(false);
  });

  it('número real ou o convite (nunca lugar inventado)', () => {
    expect(teamWeekBody({ position: 2, zones: 48 })).toBe('2º lugar na temporada · 48 zonas');
    expect(teamWeekBody({ position: 1, zones: 1 })).toBe('1º lugar na temporada · 1 zona');
    expect(teamWeekBody(null)).toBe('Semana nova. Bora pintar a cidade juntos');
    expect(teamWeekBody({ position: 0, zones: 3 })).toBe('Semana nova. Bora pintar a cidade juntos');
  });
});

describe('eco da crew (5.7)', () => {
  const echo = { available: true as const, day: '2026-10-20', mateUsername: 'rafa', cells: 3, othersCount: 0, totalCells: 3, notifyFrom: brtCalendar.at('2026-10-21', 7), notifyUntil: brtCalendar.at('2026-10-21', 22), isDemo: false };

  it('texto com o número real, singular e os outros colegas', () => {
    expect(echoText(echo)).toBe('rafa reforçou 3 trechos que você pintou');
    expect(echoText({ ...echo, cells: 1, othersCount: 2 })).toBe('rafa reforçou 1 trecho que você pintou, e mais 2 da crew');
    expect(echoText({ ...echo, mateUsername: 'nome_de_usuario_muito_longo' }).startsWith('nome_de_usuario…')).toBe(true);
  });

  it('só entre 07h e 22h (Brasília) e dentro da janela do dia', () => {
    expect(echoNow(echo, WED)).toBe(echo);
    expect(echoNow(echo, brtCalendar.at('2026-10-21', 6, 59))).toBeNull();
    expect(echoNow(echo, brtCalendar.at('2026-10-21', 22))).toBeNull();
    expect(echoNow(echo, brtCalendar.at('2026-10-22', 10))).toBeNull();
    expect(echoNow({ ...echo, cells: 0 }, WED)).toBeNull();
    expect(echoNow(null, WED)).toBeNull();
  });
});

describe('D-94 — memória do plano no aparelho', () => {
  it('1º resumo pergunta; escolher guarda o horário; "Agora não" guarda só a semana', async () => {
    mockMemory.clear();
    expect(await planQuestionDue(WED)).toBe(true);
    await answerPlan(WED + 86_400_000, WED);
    expect(await readPlanMemory()).toEqual({ at: WED + 86_400_000, askedWeek: brtCalendar.clock(WED).weekId });
    expect(await readPendingPlan(WED)).toEqual({ at: WED + 86_400_000 });
    expect(await planQuestionDue(WED)).toBe(false);
    expect(await readPendingPlan(WED + 2 * 86_400_000)).toBeNull();

    await answerPlan(null, WED);
    expect(await planQuestionDue(WED + 3_600_000)).toBe(false);
    expect(await planQuestionDue(MON)).toBe(true);

    mockMemory.set(PLAN_KEY, { at: 'lixo', askedWeek: 7 });
    expect(await readPlanMemory()).toEqual({ at: null, askedWeek: null });
  });
});

describe('plano e eco chegam ao planejador e às preferências', () => {
  it('o estado do planejador leva o plano e o eco; o toque no eco abre a central', () => {
    const echo = { mateUsername: 'bia', cells: 2, notifyFrom: WED - 3_600_000, notifyUntil: WED + 3_600_000 };
    const s = buildReminderState({ status: null, missions: null, chest: null, log: newLog(WED), now: WED, plan: { at: WED + 86_400_000 }, crewEcho: echo });
    expect(s.plan).toEqual({ at: WED + 86_400_000 });
    expect(s.crewEcho).toEqual({ mate: 'bia', cells: 2, notifyFrom: echo.notifyFrom, notifyUntil: echo.notifyUntil });
    expect(buildReminderState({ status: null, missions: null, chest: null, log: newLog(WED), now: WED })).toMatchObject({ plan: null, crewEcho: null });
    expect(reminderRoute('eco')).toBe('/notificacoes');
    expect(reminderRoute('plano')).toBe('/');
  });

  it('cada tipo novo tem a sua preferência, gravada no jsonb (desligar o plano não desliga o resto)', () => {
    const p = toProfile({ id: 'u', notification_prefs: { invasion: true, conquest: true, missions: true, moderation: true, plan: false, crew_echo: false } });
    expect(p.notificationPrefs.plan).toBe(false);
    expect(p.notificationPrefs.crewEcho).toBe(false);
    expect(toReminderPrefs(p.notificationPrefs, { quietStart: null, quietEnd: null, snoozeUntil: null })).toMatchObject({ plan: false, crewEcho: false, missions: true });
    const row = toProfileRow({ notificationPrefs: { ...p.notificationPrefs, plan: true } }) as { notification_prefs: Record<string, unknown> };
    expect(row.notification_prefs).toMatchObject({ plan: true, crew_echo: false });
  });
});
