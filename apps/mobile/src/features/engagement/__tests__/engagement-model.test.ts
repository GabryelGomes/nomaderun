/**
 * @jest-environment node
 *
 * T7.2.4 (E7): contas e textos de tela do engajamento — pico-fim do resumo, faixa de hoje, "bem-vindo de volta"
 * (só verdades, nenhuma culpa), chances visíveis e limites de texto da D-74.
 */
import { describe, expect, it } from '@jest/globals';

import { FTUE_STEP_IDS } from '@/domain/missions';
import { brtCalendar } from '@/domain/progression';
import { hasGuiltWords } from '@/domain/reminders';
import type { DailyChestState, EngagementMission, EngagementMissions, EngagementStatus, RunEngagement } from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';

import { COSMETICS, howToEarn } from '../cosmetics';
import { BLOCK_MAX, chestRefusal, fmtInt, ftueDoneCount, ftueRows, missionProgressLabel, missionRatio, oddsRows, pct, pityLabel, storedLabel, TITLE_MAX, trackItemLabel, unlockLabel } from '../model';
import { levelLine, rewardPeak, rewardsA11y, rewardSections, streakLine } from '../run-rewards-model';
import { featuredMission, todayData } from '../today';
import { daysAway, shouldWelcomeBack, welcomeBackCards } from '../welcome-back';

const NOW = Date.parse('2026-10-23T12:00:00Z'); // sexta 09:00 BRT
const DAY = 86_400_000;

function mission(p: Partial<EngagementMission> = {}): EngagementMission {
  return {
    id: 'm1',
    defId: 'd-km',
    cadence: 'diaria',
    tier: 'padrao',
    slot: 1,
    variant: 'base',
    title: 'Corra 3 km hoje',
    metric: 'meters',
    progress: 1200,
    target: 3000,
    xp: 30,
    bonus: null,
    periodKey: '2026-10-23',
    availableFrom: NOW - 9 * 3600_000,
    availableUntil: NOW + 15 * 3600_000,
    completedAt: null,
    claimedAt: null,
    rerolled: false,
    ...p,
  };
}

const missions = (p: Partial<EngagementMissions> = {}): EngagementMissions => ({
  periods: { daily: '2026-10-23', weekly: '2026-W43' },
  daily: [mission({ id: 'a', slot: 0, tier: 'leve', progress: 0, target: 900, metric: 'movingSeconds', title: 'Mova-se 15 min (caminhar vale)' }), mission({ id: 'b' }), mission({ id: 'c', slot: 2, tier: 'desafio', metric: 'conquered', progress: 0, target: 1, title: 'Conquiste uma zona' })],
  weekly: [mission({ id: 'w', cadence: 'semanal', slot: 0, tier: 'leve', metric: 'activities', progress: 2, target: 2, completedAt: NOW - DAY, title: 'Faça 2 atividades na semana', xp: 100 })],
  ftue: [],
  ftueStartedAt: null,
  comeback: null,
  rerollsLeft: 1,
  ...p,
});

function status(p: Partial<EngagementStatus> = {}): EngagementStatus {
  return {
    source: 'server',
    xp: 1850,
    level: 6,
    intoLevel: 520,
    needed: 560,
    isMax: false,
    title: { id: 'pe-na-rua', name: 'Pé na Rua' },
    band: { id: 'prata', name: 'Prata', metersToNext: 20_000, nextName: 'Ouro' },
    lifetimeMeters: 130_000,
    streak: { weeks: 2, best: 3, activitiesThisWeek: 1, freezesLeft: 1, pause: null, pauseAvailable: true },
    season: null,
    createdAt: NOW - 60 * DAY,
    lastActivityAt: NOW - DAY,
    recentStartTimes: [],
    week: { activities: 1, meters: 3000, zones: 2 },
    previousWeek: null,
    cosmetics: [],
    ...p,
  };
}

const chest = (p: Partial<DailyChestState> = {}): DailyChestState => ({
  stored: 2,
  maxStored: 3,
  bonus: ['raro'],
  pityLeft: 14,
  openedToday: false,
  odds: { comum: 0.7, raro: 0.25, lendario: 0.05 },
  xp: { comum: 15, raro: 40, lendario: 100 },
  cosmeticChance: { comum: 0, raro: 0.05, lendario: 0.3 },
  minMeters: 1000,
  ...p,
});

function block(p: Partial<RunEngagement> = {}): RunEngagement {
  return {
    xp: { total: 110, lines: [{ source: 'run_distance', amount: 50, label: 'Distância' }, { source: 'run_complete', amount: 30, label: 'Atividade concluída' }, { source: 'mission', amount: 30, label: 'Missão' }] },
    level: { before: 5, after: 5, titleAfter: null },
    band: null,
    dailyChests: { opened: [], pityLeft: null, reason: 'already', stored: 0 },
    missions: [],
    streak: { activitiesThisWeek: 2, weekKept: true, weeks: 2, best: 3, freezesLeft: 1, paused: false },
    season: null,
    ftue: null,
    comeback: null,
    ...p,
  };
}

const prize = (rarity: 'comum' | 'raro' | 'lendario', n = 1) => ({ n, rarity, xp: 15, cosmeticId: null, duplicate: false, guaranteed: false, bonus: false });

describe('formatos', () => {
  it('pct e fmtInt no padrão brasileiro', () => {
    expect(pct(0.7)).toBe('70%');
    expect(pct(0.05)).toBe('5%');
    expect(pct(0.255)).toBe('25,5%');
    expect(fmtInt(174160)).toBe('174.160');
    expect(fmtInt(5)).toBe('5');
  });

  it('progresso da missão por métrica', () => {
    expect(missionProgressLabel(mission())).toBe('1,2 de 3 km');
    expect(missionProgressLabel(mission({ metric: 'movingSeconds', progress: 480, target: 900 }))).toBe('8 de 15 min');
    expect(missionProgressLabel(mission({ metric: 'zonesPainted', progress: 2, target: 3 }))).toBe('2 de 3');
    expect(missionRatio(mission())).toBeCloseTo(0.4);
    expect(missionRatio(mission({ completedAt: NOW }))).toBe(1);
  });

  it('chances visíveis: as 3 raridades, com XP e chance de item', () => {
    const rows = oddsRows(chest());
    expect(rows.map((r) => `${r.label} ${r.chance} ${r.xp} ${r.cosmetic ?? '-'}`)).toEqual(['Comum 70% 15 XP -', 'Raro 25% 40 XP 5% de item', 'Lendário 5% 100 XP 30% de item']);
    expect(pityLabel(1)).toBe('O próximo baú é lendário garantido.');
    expect(pityLabel(14)).toBe('Lendário garantido em até 14 baús.');
    expect(storedLabel(chest())).toBe('3 baús guardados');
    expect(storedLabel(chest({ stored: 0, bonus: [], openedToday: true }))).toBe('Baús de hoje já abertos');
    expect(chestRefusal('DAILY_CHEST_LOCKED')).toBe('Corra ou caminhe 1 km hoje para abrir.');
  });

  it('itens da trilha e "como ganhar" de todo cosmético têm texto', () => {
    expect(trackItemLabel({ kind: 'xp', amount: 50, cosmeticId: null, rarity: null, medalTier: null })).toBe('+50 XP');
    expect(trackItemLabel({ kind: 'chest', amount: null, cosmeticId: null, rarity: 'lendario', medalTier: null })).toBe('Baú lendário');
    expect(trackItemLabel({ kind: 'cosmetic', amount: null, cosmeticId: 'moldura-temporada', rarity: null, medalTier: null })).toBe('Moldura do mês');
    for (const c of COSMETICS) expect(howToEarn(c).length).toBeGreaterThan(0);
    expect(howToEarn(COSMETICS.find((c) => c.id === 'rastro-faisca')!)).toBe('Nível 5');
    expect(howToEarn(COSMETICS.find((c) => c.id === 'moldura-ouro')!)).toBe('150 km no total');
    expect(howToEarn(COSMETICS.find((c) => c.id === 'moldura-holografica')!)).toBe('1.000 km no total');
  });
});

describe('primeira semana', () => {
  it('passos liberados vêm do servidor; os outros ficam trancados com o texto do catálogo', () => {
    const start = NOW - 3 * DAY;
    const rows = ftueRows(
      missions({
        ftueStartedAt: start,
        ftue: [
          mission({ id: 'f1', defId: 'f1-dominio', cadence: 'ftue', slot: 1, completedAt: NOW - DAY, title: 'Corra 500 m e pinte sua 1ª zona', xp: 100 }),
          mission({ id: 'f2', defId: 'f2-caca', cadence: 'ftue', slot: 2, title: 'Abra seu primeiro baú na Caça', metric: 'huntChests', progress: 0, target: 1, xp: 40 }),
        ],
      }),
      NOW,
    );
    expect(rows).toHaveLength(FTUE_STEP_IDS.length);
    expect(rows.map((r) => r.status)).toEqual(['done', 'open', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(ftueDoneCount(rows)).toBe(1);
    expect(rows[2].title).toBe('Vença o fantasma em 1 km');
    expect(unlockLabel(rows[2], NOW)).toBe('Depois do passo 2');
    for (const r of rows) expect(r.title.length).toBeLessThanOrEqual(40);
  });

  it('conta antiga (sem início da primeira semana) não tem passos', () => {
    expect(ftueRows(missions(), NOW)).toEqual([]);
  });

  it('libera amanhã: o passo seguinte ao feito hoje', () => {
    const rows = ftueRows(missions({ ftueStartedAt: NOW - DAY, ftue: [mission({ id: 'f1', defId: 'f1-dominio', cadence: 'ftue', slot: 1, completedAt: NOW - 3600_000 })] }), NOW);
    expect(rows[1].status).toBe('locked');
    expect(unlockLabel(rows[1], NOW)).toBe('Libera amanhã');
  });
});

describe('resumo: ordem pico-fim', () => {
  it('XP abre, a semana fecha; sem pico, a ordem é a natural', () => {
    expect(rewardSections(block())).toEqual(['xp', 'level', 'streak']);
    expect(rewardPeak(block())).toBeNull();
  });

  it('baú lendário é o pico (fica logo antes do fim); missão vem antes', () => {
    const b = block({ dailyChests: { opened: [prize('comum', 1), prize('lendario', 2)], pityLeft: 20, reason: null, stored: 0 }, missions: [{ id: 'd-km', userMissionId: 'u', cadence: 'diaria', text: 'Corra 3 km hoje', xp: 30 }] });
    expect(rewardSections(b)).toEqual(['xp', 'level', 'missions', 'chests', 'streak']);
    expect(rewardPeak(b)).toBe('chests');
  });

  it('nível novo com título novo vence o baú lendário', () => {
    const b = block({ level: { before: 4, after: 5, titleAfter: { id: 'pe-na-rua', name: 'Pé na Rua' } }, dailyChests: { opened: [prize('lendario')], pityLeft: 20, reason: null, stored: 0 } });
    expect(rewardSections(b)).toEqual(['xp', 'chests', 'level', 'streak']);
    expect(levelLine(b)).toEqual({ title: 'Nível 5!', body: 'Título novo: Pé na Rua.' });
    expect(rewardsA11y(b)).toBe('Você ganhou 110 XP, subiu para o nível 5, abriu 1 baú.');
  });

  it('propriedade: XP sempre primeiro, semana sempre por último, pico logo antes do fim, sem repetição', () => {
    const rarities = [[], ['comum'], ['raro'], ['lendario']] as const;
    for (const chests of rarities)
      for (const levelUp of [0, 1, 2])
        for (const nMissions of [0, 1])
          for (const withStreak of [true, false]) {
            const b = block({
              level: { before: 5, after: 5 + (levelUp ? 1 : 0), titleAfter: levelUp === 2 ? { id: 't', name: 'T' } : null },
              dailyChests: chests.length ? { opened: chests.map((r) => prize(r)), pityLeft: 20, reason: null, stored: 0 } : { opened: [], pityLeft: null, reason: 'already', stored: 0 },
              missions: Array.from({ length: nMissions }, (_, i) => ({ id: `m${i}`, userMissionId: `u${i}`, cadence: 'diaria' as const, text: 'x', xp: 20 })),
              streak: withStreak ? block().streak : null,
            });
            const s = rewardSections(b);
            expect(new Set(s).size).toBe(s.length);
            expect(s[0]).toBe('xp');
            if (withStreak) expect(s.at(-1)).toBe('streak');
            const peak = rewardPeak(b);
            if (peak) expect(s[s.length - (withStreak ? 2 : 1)]).toBe(peak);
          }
  });

  it('a frase do fim é sempre positiva e verdadeira (nunca culpa)', () => {
    const cases = [
      { activitiesThisWeek: 1, weekKept: false, weeks: 0, best: 0, freezesLeft: 1, paused: false },
      { activitiesThisWeek: 2, weekKept: true, weeks: 3, best: 3, freezesLeft: 1, paused: false },
      { activitiesThisWeek: 3, weekKept: false, weeks: 3, best: 3, freezesLeft: 1, paused: false },
      { activitiesThisWeek: 0, weekKept: false, weeks: 2, best: 4, freezesLeft: 0, paused: true },
    ];
    for (const c of cases) {
      const l = streakLine(c);
      expect(hasGuiltWords(`${l.title} ${l.body}`)).toBe(false);
      expect(l.title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(l.body.length).toBeLessThanOrEqual(BLOCK_MAX);
    }
    expect(streakLine(cases[0]).title).toBe('1 de 2 na semana');
    expect(streakLine(cases[1]).body).toBe('Sequência de 4 semanas a caminho.');
  });
});

describe('faixa de hoje do Mapa', () => {
  it('só verdades: sequência, baús (com o bônus) e a missão mais adiantada; no máximo 3', () => {
    const d = todayData({ status: status(), missions: missions(), chest: chest(), now: NOW });
    expect(d.chips.map((c) => `${c.key}:${c.value}:${c.label}`)).toEqual(['sequencia:1/2:Semana', 'bau:3:Baús', 'missao:40%:Missão']);
    expect(d.featured?.id).toBe('b');
    expect(d.coach).toBeNull();
  });

  it('sem dado do servidor, o chip não existe; baú zerado some; tudo feito vira "Feitas"', () => {
    expect(todayData({ status: null, missions: null, chest: null, now: NOW }).chips).toEqual([]);
    const done = missions({ daily: missions().daily.map((m) => ({ ...m, completedAt: NOW })), weekly: [] });
    const d = todayData({ status: null, missions: done, chest: chest({ stored: 0, bonus: [], openedToday: true }), now: NOW });
    expect(d.chips.map((c) => `${c.key}:${c.value}`)).toEqual(['missao:Feitas']);
    expect(featuredMission(done)).toBeNull();
  });

  it('pausa de saúde ativa aparece como "Pausa"; primeira semana vira cartão de passo', () => {
    const paused = status({ streak: { ...status().streak, pause: { from: '2026-10-19', until: '2026-11-01' } } });
    const m = missions({ ftueStartedAt: NOW - DAY, ftue: [mission({ id: 'f1', defId: 'f1-dominio', cadence: 'ftue', slot: 1, title: 'Corra 500 m e pinte sua 1ª zona', xp: 100 })] });
    const d = todayData({ status: paused, missions: m, chest: null, now: NOW });
    expect(d.chips[0].value).toBe('Pausa');
    expect(d.coach).toMatchObject({ eyebrow: 'Passo 1 de 7', done: 0, reward: '+100 XP', steps: ['Domínio', 'Caça', 'Fuga', 'Raid', 'Crew', 'Liga', 'Card'] });
  });

  it('missão de volta tem prioridade no cartão', () => {
    const d = todayData({ status: null, missions: missions({ comeback: mission({ id: 'v', defId: 'v-14', cadence: 'volta', title: 'Caminhe 1 km no seu ritmo', xp: 60 }) }), chest: null, now: NOW });
    expect(d.coach).toMatchObject({ eyebrow: 'Missão de volta', title: 'Caminhe 1 km no seu ritmo', reward: '+60 XP' });
  });
});

describe('bem-vindo de volta', () => {
  it('só a partir de 14 dias, só para quem já correu e uma vez por ausência', () => {
    const at = (d: number) => NOW - d * DAY;
    expect(shouldWelcomeBack(null, NOW)).toBe(false);
    expect(shouldWelcomeBack(at(13), NOW)).toBe(false);
    expect(shouldWelcomeBack(at(14), NOW)).toBe(true);
    expect(shouldWelcomeBack(at(40), NOW, at(40))).toBe(false);
    expect(daysAway(at(20), NOW)).toBe(20);
    expect(daysAway(brtCalendar.at('2026-10-22', 23, 59), brtCalendar.at('2026-10-23', 0, 1))).toBe(1);
  });

  it('3 cartões verdadeiros, sem culpa e sem perda, dentro dos limites de texto', () => {
    const cards = welcomeBackCards(
      status({ lastActivityAt: NOW - 20 * DAY }),
      { comeback: mission({ id: 'v', defId: 'v-14', cadence: 'volta', title: 'Caminhe 1 km no seu ritmo', xp: 60 }) },
      chest({ stored: 3, bonus: ['raro'] }),
    );
    expect(cards.map((c) => c.key)).toEqual(['volta', 'baus', 'nivel']);
    expect(cards[1].title).toBe('4 baús guardados');
    for (const c of cards) {
      expect(hasGuiltWords(`${c.title} ${c.body}`)).toBe(false);
      expect(/perd|perdeu|zerou|acabou/i.test(`${c.title} ${c.body}`)).toBe(false);
      expect(c.title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(c.body.length).toBeLessThanOrEqual(BLOCK_MAX);
    }
  });

  it('sem baú nem missão de volta, usa o que a pessoa tem (nível, recorde, faixa)', () => {
    const cards = welcomeBackCards(status(), { comeback: null }, chest({ stored: 0, bonus: [] }));
    expect(cards.map((c) => c.key)).toEqual(['nivel', 'recorde', 'faixa']);
    expect(cards[2].body).toBe('130 km corridos até aqui.');
  });
});

describe('store', () => {
  it('trocar a missão do dia gasta a troca e mantém o slot; trocar de conta limpa tudo', () => {
    const s = useEngagement.getState();
    s.setUser('u1');
    s.setReady('missions', missions());
    s.replaceMission(mission({ id: 'b', defId: 'd-pintar-3', title: 'Pinte 3 zonas com a cor do time', rerolled: true }));
    const after = useEngagement.getState().missions.data!;
    expect(after.daily[1].defId).toBe('d-pintar-3');
    expect(after.rerollsLeft).toBe(0);
    s.setLoading('missions');
    expect(useEngagement.getState().missions.status).toBe('ready');
    s.setUser('u2');
    expect(useEngagement.getState().missions.data).toBeNull();
  });
});
