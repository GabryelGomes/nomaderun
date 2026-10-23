import { describe, expect, it } from '@jest/globals';

import { levelFromXp, MAX_LEVEL, xpForLevel } from '../games';
import {
  brtCalendar,
  canOpenDailyChests,
  closeStreakWeek,
  DAILY_CHEST,
  DAILY_RUN_XP_CAP,
  dailyChestOdds,
  dailyChestRolls,
  dailyChestsStored,
  dailyDistanceXp,
  endHealthPause,
  engagementRng,
  grantExtraFreeze,
  isHealthPaused,
  levelProgress,
  NEW_STREAK_V2,
  openDailyChests,
  refillStreakFreezes,
  resolveCosmeticDrop,
  rollDailyChest,
  RUNNER_BANDS,
  RUNNER_TITLES,
  runnerBand,
  runXp,
  seasonTrackStep,
  startHealthPause,
  titleForLevel,
  totalXpForLevel,
  unlockedTitles,
  weekKeptXp,
  xpToNextLevel,
  type RunXpInput,
  type StreakV2State,
  type XpDayTotals,
} from '../progression';
import { forAll } from './prop';

describe('calendário de Brasília', () => {
  it('converte o instante para o dia, a hora e a semana ISO de Brasília', () => {
    const c = brtCalendar.clock(Date.UTC(2026, 9, 23, 12, 30));
    expect(c).toEqual({ dayId: '2026-10-23', weekId: '2026-W43', weekday: 4, hour: 9, minute: 30, day: 23 });
  });

  it('02:59 UTC ainda é o dia anterior em Brasília', () => {
    expect(brtCalendar.clock(Date.UTC(2026, 9, 24, 2, 59)).dayId).toBe('2026-10-23');
    expect(brtCalendar.clock(Date.UTC(2026, 9, 24, 3, 0)).dayId).toBe('2026-10-24');
  });

  it('semana ISO na virada do ano (2026 tem 53 semanas)', () => {
    expect(brtCalendar.weekIdOf('2025-12-29')).toBe('2026-W01');
    expect(brtCalendar.weekIdOf('2026-01-01')).toBe('2026-W01');
    expect(brtCalendar.weekIdOf('2027-01-01')).toBe('2026-W53');
    expect(brtCalendar.weekIdOf('2027-01-04')).toBe('2027-W01');
  });

  it('soma dias, mede intervalos e acha a segunda-feira', () => {
    expect(brtCalendar.addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(brtCalendar.daysBetween('2026-10-23', '2026-11-02')).toBe(10);
    expect(brtCalendar.daysBetween('2026-11-02', '2026-10-23')).toBe(-10);
    expect(brtCalendar.weekMonday('2026-10-25')).toBe('2026-10-19');
    expect(brtCalendar.weekMonday('2026-10-19')).toBe('2026-10-19');
    expect(brtCalendar.at('2026-10-23', 9, 30)).toBe(Date.UTC(2026, 9, 23, 12, 30));
    expect(brtCalendar.at('2026-10-23')).toBe(Date.UTC(2026, 9, 23, 3, 0));
  });
});

describe('engagementRng', () => {
  it('é determinístico, fica em [0, 1) e muda com a semente', () => {
    const a = engagementRng('u1|2026-10-23');
    const b = engagementRng('u1|2026-10-23');
    const seqA = Array.from({ length: 50 }, () => a());
    expect(seqA).toEqual(Array.from({ length: 50 }, () => b()));
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(engagementRng('u2|2026-10-23')()).not.toBe(seqA[0]);
  });
});

describe('D-64 — curva de XP v2', () => {
  it('bate com a tabela da F1 (nível 2 = 100, 5 = 880, 10 = 4.300, 20 = 21.100, 50 = 174.160)', () => {
    expect(xpToNextLevel(1)).toBe(100);
    expect(xpToNextLevel(2)).toBe(170);
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(5)).toBe(880);
    expect(totalXpForLevel(10)).toBe(4300);
    expect(totalXpForLevel(20)).toBe(21100);
    expect(totalXpForLevel(50)).toBe(174160);
    expect(totalXpForLevel(60)).toBe(174160);
  });

  it('a curva nova pede ≤ XP que a atual em todo nível (por nível e acumulado)', () => {
    let v1 = 0;
    for (let n = 1; n <= MAX_LEVEL; n++) {
      expect(xpToNextLevel(n)).toBeLessThanOrEqual(xpForLevel(n));
      if (n > 1) v1 += xpForLevel(n - 1);
      expect(totalXpForLevel(n)).toBeLessThanOrEqual(v1);
    }
  });

  it('nível, XP dentro do nível, título e nível máximo', () => {
    expect(levelProgress(0)).toMatchObject({ level: 1, intoLevel: 0, needed: 100, isMax: false });
    expect(levelProgress(99).level).toBe(1);
    expect(levelProgress(100)).toMatchObject({ level: 2, intoLevel: 0, needed: 170 });
    expect(levelProgress(4300).title.name).toBe('Desbravador de Bairro');
    const max = levelProgress(10_000_000);
    expect(max).toMatchObject({ level: MAX_LEVEL, needed: 0, isMax: true });
    expect(max.title.name).toBe('Nômade');
    expect(levelProgress(-50).level).toBe(1);
    expect(levelProgress(Number.NaN).level).toBe(1);
  });

  it('propriedade: nível só sobe com mais XP e ninguém perde nível na troca de curva', () => {
    forAll(
      (r) => {
        const a = r.int(0, 250_000);
        return { a, b: a + r.int(0, 50_000) };
      },
      ({ a, b }) => {
        const pa = levelProgress(a);
        const pb = levelProgress(b);
        expect(pb.level).toBeGreaterThanOrEqual(pa.level);
        expect(pa.level).toBeGreaterThanOrEqual(levelFromXp(a).level);
        expect(pa.intoLevel).toBeGreaterThanOrEqual(0);
        if (!pa.isMax) expect(pa.intoLevel).toBeLessThan(pa.needed);
      },
    );
  });
});

describe('D-64 — fontes de XP', () => {
  const base: RunXpInput = { status: 'valid', meters: 3000, movingSeconds: 1200, newAtlasCells: 10, beatGhost: null };

  it('corrida de 3 km: distância 30 + concluída 30 + Atlas 20', () => {
    const out = runXp(base);
    expect(out.total).toBe(80);
    expect(out.lines.map((l) => [l.source, l.amount, l.label])).toEqual([
      ['run_distance', 30, 'Distância'],
      ['run_complete', 30, 'Atividade concluída'],
      ['fog', 20, 'Atlas'],
    ]);
    expect(out.todayAfter).toEqual({ meters: 3000, atlasXp: 20, completed: true, ghost: false });
  });

  it('distância: 10/km até 5 km, 5/km de 5 a 15 km e 0 depois', () => {
    expect(dailyDistanceXp(0)).toBe(0);
    expect(dailyDistanceXp(-100)).toBe(0);
    expect(dailyDistanceXp(5000)).toBe(50);
    expect(dailyDistanceXp(10_000)).toBe(75);
    expect(dailyDistanceXp(15_000)).toBe(100);
    expect(dailyDistanceXp(42_195)).toBe(100);
    expect(runXp({ ...base, meters: 4000, today: { meters: 12_000, atlasXp: 0, completed: true, ghost: false } }).lines[0]).toMatchObject({
      source: 'run_distance',
      amount: 15,
    });
  });

  it('concluída vale com 15 min mesmo abaixo de 1 km, e só 1 vez por dia', () => {
    expect(runXp({ ...base, meters: 600, movingSeconds: 900, newAtlasCells: 0 }).lines.map((l) => l.source)).toEqual(['run_distance', 'run_complete']);
    expect(runXp({ ...base, meters: 600, movingSeconds: 300, newAtlasCells: 0 }).lines.map((l) => l.source)).toEqual(['run_distance']);
    const second = runXp({ ...base, today: { meters: 3000, atlasXp: 0, completed: true, ghost: false } });
    expect(second.lines.some((l) => l.source === 'run_complete')).toBe(false);
  });

  it('Atlas tem teto de 60 por dia; fantasma vale 50 uma vez por dia; baús da Caça mantêm o XP', () => {
    const out = runXp({ ...base, newAtlasCells: 100, beatGhost: true, huntChests: ['comum', 'raro'] });
    expect(out.lines.find((l) => l.source === 'fog')?.amount).toBe(60);
    expect(out.lines.find((l) => l.source === 'ghost')?.amount).toBe(50);
    expect(out.lines.find((l) => l.source === 'hunt_chest')?.amount).toBe(80);
    const again = runXp({ ...base, newAtlasCells: 100, beatGhost: true, today: out.todayAfter });
    expect(again.lines.some((l) => l.source === 'fog' || l.source === 'ghost')).toBe(false);
  });

  it('atividade rejeitada ou em revisão não dá XP agora', () => {
    for (const status of ['rejected', 'under_review'] as const) {
      expect(runXp({ ...base, status })).toEqual({ total: 0, lines: [], todayAfter: { meters: 0, atlasXp: 0, completed: false, ghost: false } });
    }
    expect(runXp({ ...base, status: 'partially_valid' }).total).toBe(80);
  });

  it('propriedade: XP ≥ 0, teto diário e dividir a corrida não rende mais distância', () => {
    forAll(
      (r) =>
        Array.from({ length: r.int(1, 6) }, () => ({
          status: r.pick(['valid', 'partially_valid', 'rejected', 'under_review'] as const),
          meters: r.float(-100, 30_000),
          movingSeconds: r.float(0, 10_000),
          newAtlasCells: r.int(0, 300),
          beatGhost: r.pick([true, false, null]),
        })),
      (runs) => {
        let today: XpDayTotals = { meters: 0, atlasXp: 0, completed: false, ghost: false };
        let activityXp = 0;
        let distance = 0;
        let scoredMeters = 0;
        for (const run of runs) {
          const out = runXp({ ...run, today });
          expect(out.total).toBeGreaterThanOrEqual(0);
          for (const l of out.lines) expect(l.amount).toBeGreaterThan(0);
          activityXp += out.total;
          distance += out.lines.find((l) => l.source === 'run_distance')?.amount ?? 0;
          if (run.status === 'valid' || run.status === 'partially_valid') scoredMeters += Math.max(0, run.meters);
          today = out.todayAfter;
        }
        expect(activityXp).toBeLessThanOrEqual(DAILY_RUN_XP_CAP);
        expect(distance).toBe(dailyDistanceXp(scoredMeters));
      },
    );
    expect(DAILY_RUN_XP_CAP).toBe(240);
  });
});

describe('D-64 — títulos e faixas de corredor', () => {
  it('8 títulos por faixa de nível', () => {
    expect(RUNNER_TITLES).toHaveLength(8);
    expect(titleForLevel(1).name).toBe('Recruta do Asfalto');
    expect(titleForLevel(4).name).toBe('Recruta do Asfalto');
    expect(titleForLevel(5).name).toBe('Pé na Rua');
    expect(titleForLevel(29).name).toBe('Estrategista Urbano');
    expect(titleForLevel(50).unlocks).toBe('moldura-nomade');
    expect(unlockedTitles(12).map((t) => t.id)).toEqual(['recruta-do-asfalto', 'pe-na-rua', 'desbravador-de-bairro']);
  });

  it('8 faixas por material, pela distância total', () => {
    expect(RUNNER_BANDS.map((b) => b.name)).toEqual(['Asfalto', 'Bronze', 'Prata', 'Ouro', 'Neon', 'Holográfico', 'Lenda', 'Nômade']);
    expect(runnerBand(0)).toMatchObject({ band: { id: 'asfalto' }, next: { id: 'bronze' }, metersToNext: 10_000 });
    expect(runnerBand(9_999).metersToNext).toBe(1);
    expect(runnerBand(10_000).band.id).toBe('bronze');
    expect(runnerBand(-5).band.id).toBe('asfalto');
    expect(runnerBand(5_000_000)).toMatchObject({ band: { id: 'nomade' }, next: null, metersToNext: 0 });
  });

  it('propriedade: a faixa nunca regride quando a distância total sobe', () => {
    const idx = (m: number) => RUNNER_BANDS.findIndex((b) => b.id === runnerBand(m).band.id);
    forAll(
      (r) => {
        const a = r.float(0, 6_000_000);
        return { a, b: a + r.float(0, 500_000) };
      },
      ({ a, b }) => expect(idx(b)).toBeGreaterThanOrEqual(idx(a)),
    );
  });
});

describe('D-63 — sequência semanal v2', () => {
  const s = (over: Partial<StreakV2State> = {}): StreakV2State => ({ ...NEW_STREAK_V2, ...over });
  const MON = '2026-10-19';

  it('2 atividades mantêm a semana e atualizam a melhor sequência', () => {
    const out = closeStreakWeek(s({ weeks: 3, best: 3 }), { monday: MON, activities: 2 });
    expect(out).toMatchObject({ outcome: 'kept', usedFreeze: false, state: { weeks: 4, best: 4 } });
  });

  it('congelamento automático protege a sequência; sem congelamento, recomeça sem apagar a melhor', () => {
    expect(closeStreakWeek(s({ weeks: 3, best: 5, freezesLeft: 1 }), { monday: MON, activities: 1 })).toMatchObject({
      outcome: 'frozen',
      usedFreeze: true,
      state: { weeks: 3, freezesLeft: 0, best: 5 },
    });
    expect(closeStreakWeek(s({ weeks: 3, best: 5, freezesLeft: 0 }), { monday: MON, activities: 0 })).toMatchObject({
      outcome: 'reset',
      state: { weeks: 0, best: 5 },
    });
  });

  it('sem sequência a proteger, o congelamento não é gasto', () => {
    expect(closeStreakWeek(s({ weeks: 0, freezesLeft: 1 }), { monday: MON, activities: 0 })).toMatchObject({
      outcome: 'reset',
      usedFreeze: false,
      state: { freezesLeft: 1 },
    });
  });

  it('semana na pausa de saúde fica como está; correr na pausa ainda conta', () => {
    const paused = s({ weeks: 6, best: 6, freezesLeft: 1, pause: { from: '2026-10-12', until: '2026-10-25' } });
    expect(closeStreakWeek(paused, { monday: MON, activities: 0 })).toMatchObject({ outcome: 'paused', usedFreeze: false, state: { weeks: 6, freezesLeft: 1 } });
    expect(closeStreakWeek(paused, { monday: MON, activities: 2 }).outcome).toBe('kept');
    expect(closeStreakWeek(paused, { monday: '2026-10-26', activities: 0 }).outcome).toBe('frozen');
  });

  it('congelamento: 1 por mês, até 2 guardados com o extra da trilha', () => {
    expect(refillStreakFreezes(0)).toBe(1);
    expect(refillStreakFreezes(1)).toBe(1);
    expect(refillStreakFreezes(2)).toBe(2);
    expect(refillStreakFreezes(5)).toBe(2);
    expect(grantExtraFreeze(1)).toBe(2);
    expect(grantExtraFreeze(2)).toBe(2);
  });

  it('pausa de saúde: 1 a 4 semanas, 1 vez por temporada, começando na segunda da semana atual', () => {
    const ok = startHealthPause(s(), { weeks: 2, today: '2026-10-23', seasonId: '2026-10' });
    expect(ok).toEqual({ ok: true, state: { ...s(), pause: { from: '2026-10-19', until: '2026-11-01' }, pauseUsedSeason: '2026-10' } });
    if (!ok.ok) throw new Error('pausa recusada');
    expect(isHealthPaused(ok.state, '2026-11-01')).toBe(true);
    expect(isHealthPaused(ok.state, '2026-11-02')).toBe(false);
    expect(isHealthPaused(s(), '2026-11-02')).toBe(false);
    expect(startHealthPause(s(), { weeks: 0, today: '2026-10-23', seasonId: '2026-10' })).toEqual({ ok: false, reason: 'weeks' });
    expect(startHealthPause(s(), { weeks: 5, today: '2026-10-23', seasonId: '2026-10' })).toEqual({ ok: false, reason: 'weeks' });
    expect(startHealthPause(s(), { weeks: 1.5, today: '2026-10-23', seasonId: '2026-10' })).toEqual({ ok: false, reason: 'weeks' });
    expect(startHealthPause(ok.state, { weeks: 1, today: '2026-10-24', seasonId: '2026-10' })).toEqual({ ok: false, reason: 'active' });
    expect(startHealthPause(ok.state, { weeks: 1, today: '2026-11-03', seasonId: '2026-10' })).toEqual({ ok: false, reason: 'used' });
    expect(startHealthPause(ok.state, { weeks: 1, today: '2026-11-03', seasonId: '2026-11' }).ok).toBe(true);
  });

  it('encerrar a pausa antes protege só a semana atual', () => {
    const paused = s({ pause: { from: '2026-10-19', until: '2026-11-15' }, pauseUsedSeason: '2026-10' });
    expect(endHealthPause(paused, '2026-10-28').pause).toEqual({ from: '2026-10-19', until: '2026-11-01' });
    expect(endHealthPause(paused, '2026-11-20')).toBe(paused);
    expect(endHealthPause(s(), '2026-11-20')).toEqual(s());
    const lastWeek = s({ pause: { from: '2026-10-19', until: '2026-10-25' } });
    expect(endHealthPause(lastWeek, '2026-10-21').pause?.until).toBe('2026-10-25');
  });

  it('+50 XP na atividade que completa as 2 da semana', () => {
    expect(weekKeptXp(1, 2)).toBe(50);
    expect(weekKeptXp(0, 2)).toBe(50);
    expect(weekKeptXp(2, 3)).toBe(0);
    expect(weekKeptXp(0, 1)).toBe(0);
  });

  it('propriedade: melhor sequência nunca diminui, fica ≥ a atual, e congelamentos nunca negativos', () => {
    forAll(
      (r) => Array.from({ length: r.int(1, 30) }, () => ({ activities: r.int(0, 4), refill: r.bool(0.25) })),
      (weeks) => {
        let st = s({ freezesLeft: 1 });
        let monday = '2026-01-05';
        for (const w of weeks) {
          const before = st.best;
          st = closeStreakWeek(st, { monday, activities: w.activities }).state;
          if (w.refill) st = { ...st, freezesLeft: refillStreakFreezes(st.freezesLeft) };
          expect(st.best).toBeGreaterThanOrEqual(before);
          expect(st.best).toBeGreaterThanOrEqual(st.weeks);
          expect(st.freezesLeft).toBeGreaterThanOrEqual(0);
          monday = brtCalendar.addDays(monday, 7);
        }
      },
    );
  });
});

describe('D-66 — baú do dia', () => {
  it('crédito diário que guarda até 3; conta nova começa com 1 e não acumula sem atividade', () => {
    const today = '2026-10-23';
    expect(dailyChestsStored({ today, createdDay: '2026-10-13', lastOpenDay: null, hasActivity: false })).toBe(1);
    expect(dailyChestsStored({ today, createdDay: '2026-10-23', lastOpenDay: null, hasActivity: true })).toBe(1);
    expect(dailyChestsStored({ today, createdDay: '2026-10-22', lastOpenDay: null, hasActivity: true })).toBe(2);
    expect(dailyChestsStored({ today, createdDay: '2026-10-01', lastOpenDay: null, hasActivity: true })).toBe(3);
    expect(dailyChestsStored({ today, createdDay: '2026-10-01', lastOpenDay: '2026-10-23', hasActivity: true })).toBe(0);
    expect(dailyChestsStored({ today, createdDay: '2026-10-01', lastOpenDay: '2026-10-22', hasActivity: true })).toBe(1);
    expect(dailyChestsStored({ today, createdDay: '2026-10-01', lastOpenDay: '2026-10-10', hasActivity: true })).toBe(3);
  });

  it('abre com atividade pontuada de pelo menos 1 km, 1 vez por dia, e espera a revisão com confiança baixa', () => {
    const ok = { status: 'valid' as const, meters: 1000, trust: 100, openedToday: false };
    expect(canOpenDailyChests(ok)).toEqual({ ok: true });
    expect(canOpenDailyChests({ ...ok, status: 'partially_valid' })).toEqual({ ok: true });
    expect(canOpenDailyChests({ ...ok, meters: 999 })).toEqual({ ok: false, reason: 'distance' });
    expect(canOpenDailyChests({ ...ok, status: 'under_review' })).toEqual({ ok: false, reason: 'status' });
    expect(canOpenDailyChests({ ...ok, trust: 39 })).toEqual({ ok: false, reason: 'review' });
    expect(canOpenDailyChests({ ...ok, openedToday: true })).toEqual({ ok: false, reason: 'already' });
  });

  it('raridade pelas chances públicas (70/25/5) e cosmético só no raro e no lendário', () => {
    expect(rollDailyChest({ rarity: 0.1, cosmetic: 0 }, 0)).toEqual({
      prize: { rarity: 'comum', xp: 15, cosmeticDrop: false, guaranteed: false },
      pityAfter: 1,
    });
    expect(rollDailyChest({ rarity: 0.8, cosmetic: 0.01 }, 3).prize).toEqual({ rarity: 'raro', xp: 40, cosmeticDrop: true, guaranteed: false });
    expect(rollDailyChest({ rarity: 0.8, cosmetic: 0.06 }, 3).prize.cosmeticDrop).toBe(false);
    expect(rollDailyChest({ rarity: 0.97, cosmetic: 0.2 }, 5)).toEqual({
      prize: { rarity: 'lendario', xp: 100, cosmeticDrop: true, guaranteed: false },
      pityAfter: 0,
    });
  });

  it('o 20º baú sem lendário vira lendário', () => {
    expect(rollDailyChest({ rarity: 0.1, cosmetic: 0.9 }, 19)).toEqual({
      prize: { rarity: 'lendario', xp: 100, cosmeticDrop: false, guaranteed: true },
      pityAfter: 0,
    });
    expect(rollDailyChest({ rarity: 0.1, cosmetic: 0.9 }, 18).prize.rarity).toBe('comum');
  });

  it('propriedade: nunca há 20 baús seguidos sem lendário, e o XP fica entre 15 e 100', () => {
    forAll(
      (r) => ({ seed: `u${r.int(1, 1e9)}`, n: r.int(20, 120) }),
      ({ seed, n }) => {
        const next = engagementRng(seed);
        let pity = 0;
        let streak = 0;
        for (let i = 0; i < n; i++) {
          const out = rollDailyChest({ rarity: next(), cosmetic: next() }, pity);
          streak = out.prize.rarity === 'lendario' ? 0 : streak + 1;
          expect(streak).toBeLessThan(DAILY_CHEST.pity);
          expect(out.prize.xp).toBeGreaterThanOrEqual(15);
          expect(out.prize.xp).toBeLessThanOrEqual(100);
          pity = out.pityAfter;
        }
      },
      50,
    );
  });

  it('sem a garantia, a frequência sorteada fica perto das chances publicadas', () => {
    const next = engagementRng('frequencia');
    const count = { comum: 0, raro: 0, lendario: 0 };
    const N = 20_000;
    for (let i = 0; i < N; i++) count[rollDailyChest({ rarity: next(), cosmetic: 1 }, 0).prize.rarity]++;
    expect(Math.abs(count.comum / N - 0.7)).toBeLessThan(0.02);
    expect(Math.abs(count.raro / N - 0.25)).toBeLessThan(0.02);
    expect(Math.abs(count.lendario / N - 0.05)).toBeLessThan(0.01);
  });

  it('abre até 3 baús em sequência, passando a garantia adiante', () => {
    const rolls = [
      { rarity: 0.1, cosmetic: 1 },
      { rarity: 0.1, cosmetic: 1 },
      { rarity: 0.1, cosmetic: 1 },
      { rarity: 0.1, cosmetic: 1 },
    ];
    const out = openDailyChests(rolls, 18);
    expect(out.prizes.map((p) => p.rarity)).toEqual(['comum', 'lendario', 'comum']);
    expect(out.pityAfter).toBe(1);
    expect(openDailyChests([], -3)).toEqual({ prizes: [], pityAfter: 0 });
  });

  it('sorteios reproduzíveis para a demonstração (no máximo 3)', () => {
    expect(dailyChestRolls('u1|2026-10-23', 2)).toEqual(dailyChestRolls('u1|2026-10-23', 2));
    expect(dailyChestRolls('u1|2026-10-23', 9)).toHaveLength(3);
    expect(dailyChestRolls('u1|2026-10-23', -1)).toHaveLength(0);
  });

  it('cosmético repetido (ou sem catálogo) vira +20 XP', () => {
    const owned = new Set(['rastro-a']);
    expect(resolveCosmeticDrop(0.1, ['rastro-a', 'rastro-b'], owned)).toEqual({ cosmeticId: null, extraXp: 20 });
    expect(resolveCosmeticDrop(0.9, ['rastro-a', 'rastro-b'], owned)).toEqual({ cosmeticId: 'rastro-b', extraXp: 0 });
    expect(resolveCosmeticDrop(1, ['rastro-a', 'rastro-b'], owned)).toEqual({ cosmeticId: 'rastro-b', extraXp: 0 });
    expect(resolveCosmeticDrop(0.5, [], owned)).toEqual({ cosmeticId: null, extraXp: 20 });
  });

  it('chances públicas somam 100% e o contador mostra quanto falta para o lendário garantido', () => {
    const odds = dailyChestOdds(5);
    expect(odds.rows.reduce((s, r) => s + r.chance, 0)).toBeCloseTo(1, 10);
    expect(odds.rows.map((r) => r.xp)).toEqual([15, 40, 100]);
    expect(odds.pityLeft).toBe(15);
    expect(dailyChestOdds(19).pityLeft).toBe(1);
    expect(dailyChestOdds(-2).pityLeft).toBe(20);
  });
});

describe('trilha da temporada', () => {
  it('24 degraus de 120 XP, medalhas nos degraus 8, 16 e 24 e estrelas depois', () => {
    expect(seasonTrackStep(0)).toEqual({ step: 0, intoStep: 0, medal: null, prestigeStars: 0 });
    expect(seasonTrackStep(959)).toMatchObject({ step: 7, intoStep: 119, medal: null });
    expect(seasonTrackStep(960)).toMatchObject({ step: 8, medal: 'bronze' });
    expect(seasonTrackStep(1920)).toMatchObject({ step: 16, medal: 'prata' });
    expect(seasonTrackStep(2880)).toEqual({ step: 24, intoStep: 0, medal: 'ouro', prestigeStars: 0 });
    expect(seasonTrackStep(2880 + 480)).toMatchObject({ step: 24, prestigeStars: 2 });
    expect(seasonTrackStep(-10).step).toBe(0);
  });
});
