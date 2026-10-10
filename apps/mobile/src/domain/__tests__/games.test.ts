import {
  chestsInReach,
  cityScore,
  closeWeek,
  ghostGap,
  ghostStatus,
  leagueOutcome,
  levelFromXp,
  revealFog,
  xpForLevel,
} from '../games';
import { offset } from '../geo';
import { ORIGIN } from './helpers';

describe('RN-013 — Guerra de Cidades', () => {
  it('CT-14: cidade com 19 corredores fica fora do placar', () => {
    expect(cityScore(10_000, 19)).toBeNull();
  });

  it('divide a soma de RP pela raiz dos corredores ativos', () => {
    expect(cityScore(10_000, 25)).toBe(2000);
    expect(cityScore(40_000, 400)).toBe(2000);
  });
});

describe('Neblina', () => {
  it('revela células ao passar e não revela de novo o que já foi revelado', () => {
    const path = [ORIGIN, offset(ORIGIN, 100, 90), offset(ORIGIN, 200, 90)];
    const first = revealFog(path, new Set());
    expect(first.length).toBeGreaterThanOrEqual(3);
    expect(revealFog(path, new Set(first))).toEqual([]);
  });
});

describe('Fuga', () => {
  it('calcula a vantagem sobre um fantasma a 6:00 min/km', () => {
    expect(ghostGap(1100, 360, 360)).toBeCloseTo(100);
    expect(ghostStatus(100)).toBe('ahead');
    expect(ghostStatus(3)).toBe('tied');
    expect(ghostStatus(-20)).toBe('caught');
  });
});

describe('Caça', () => {
  const chest = { id: 'c1', position: offset(ORIGIN, 24.9, 0), rarity: 'raro' as const };

  it('abre a 24,9 m e não a 25,1 m', () => {
    expect(chestsInReach(ORIGIN, [chest], new Set())).toHaveLength(1);
    expect(chestsInReach(ORIGIN, [{ ...chest, position: offset(ORIGIN, 25.1, 0) }], new Set())).toHaveLength(0);
  });

  it('não reabre um baú já aberto', () => {
    expect(chestsInReach(ORIGIN, [chest], new Set(['c1']))).toHaveLength(0);
  });
});

describe('Liga do Bairro', () => {
  it('5 primeiros sobem e 5 últimos descem num grupo de 30', () => {
    expect(leagueOutcome(5, 30, 1)).toBe('promoted');
    expect(leagueOutcome(6, 30, 1)).toBe('stays');
    expect(leagueOutcome(26, 30, 1)).toBe('relegated');
    expect(leagueOutcome(25, 30, 1)).toBe('stays');
  });

  it('ninguém desce da primeira divisão nem sobe da última', () => {
    expect(leagueOutcome(30, 30, 0)).toBe('stays');
    expect(leagueOutcome(1, 30, 4)).toBe('stays');
  });
});

describe('Sequência semanal', () => {
  it('2 corridas mantêm a sequência; 1 corrida gasta o congelamento', () => {
    expect(closeWeek({ weeks: 3, freezesLeft: 1 }, 2)).toMatchObject({ weeks: 4, freezesLeft: 1 });
    expect(closeWeek({ weeks: 3, freezesLeft: 1 }, 1)).toMatchObject({ weeks: 3, freezesLeft: 0, usedFreeze: true });
    expect(closeWeek({ weeks: 3, freezesLeft: 0 }, 1)).toMatchObject({ weeks: 0 });
  });
});

describe('Progressão', () => {
  it('a curva de níveis é 100 × n^1,5', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(4)).toBe(800);
  });

  it('converte XP total em nível', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(99)).toMatchObject({ level: 1, intoLevel: 99 });
  });
});
