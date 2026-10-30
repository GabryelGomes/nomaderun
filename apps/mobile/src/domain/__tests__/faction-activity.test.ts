import { describe, expect, it } from '@jest/globals';

import { BOOST_MIN_TOTAL_ACTIVE, factionNeedingBoost, isEchoHour, paintMilestones } from '../faction-activity';
import { FACTION_IDS } from '../types';
import { forAll } from './prop';

describe('D-96 — selo "Precisa de reforço"', () => {
  it('o time com menos ativos, só se for o único no menor número', () => {
    expect(factionNeedingBoost({ striders: 12, coyotes: 9, owls: 3, volt: 10 })).toBe('owls');
    expect(factionNeedingBoost({ striders: 12, coyotes: 3, owls: 3, volt: 10 })).toBeNull();
    expect(factionNeedingBoost({ striders: 2, coyotes: 2, owls: 2, volt: 2 })).toBeNull();
  });

  it('com pouca gente (menos de 4 ativos no total) não há selo; entrada ruim conta zero', () => {
    expect(BOOST_MIN_TOTAL_ACTIVE).toBe(4);
    expect(factionNeedingBoost({ striders: 2, coyotes: 1, owls: 0, volt: 0 })).toBeNull();
    expect(factionNeedingBoost({ striders: 3, coyotes: 1, owls: 0, volt: 1 })).toBe('owls');
    expect(factionNeedingBoost({ striders: 5, coyotes: Number.NaN, owls: 3, volt: 4 })).toBe('coyotes');
    expect(factionNeedingBoost(null)).toBeNull();
  });

  it('propriedade: o selo, quando existe, é de um time com o menor número e nunca de dois', () => {
    forAll(
      (r) => Object.fromEntries(FACTION_IDS.map((f) => [f, r.int(0, 20)])) as Record<(typeof FACTION_IDS)[number], number>,
      (counts) => {
        const f = factionNeedingBoost(counts);
        if (f === null) return;
        const min = Math.min(...Object.values(counts));
        expect(counts[f]).toBe(min);
        expect(Object.values(counts).filter((n) => n === min)).toHaveLength(1);
      },
    );
  });
});

describe('marcos da pintura (mesma regra do svc_paint_milestones)', () => {
  const run = (id: string, cells: number, endedAt: number, firstPaint = false) => ({ id, cells, endedAt, firstPaint });

  it('primeira corrida com trechos: "primeiro trecho", sem recorde', () => {
    expect(paintMilestones({ id: 'a', cells: 7, endedAt: 10, others: [run('z', 0, 5)] })).toEqual({ firstPaint: true, cells: 7, cellsRecord: null });
  });

  it('recorde só quando passa o maior número de qualquer outra corrida', () => {
    const others = [run('a', 12, 1, true), run('b', 20, 2)];
    expect(paintMilestones({ id: 'c', cells: 21, endedAt: 3, others }).cellsRecord).toEqual({ value: 21, previous: 20 });
    expect(paintMilestones({ id: 'c', cells: 20, endedAt: 3, others }).cellsRecord).toBeNull();
  });

  it('propriedade: nunca "primeiro trecho" e "recorde" juntos; sem trechos, nada', () => {
    forAll(
      (r) => ({
        cells: r.int(0, 60),
        others: Array.from({ length: r.int(0, 5) }, (_, i) => run(`o${i}`, r.int(0, 60), r.int(0, 100), r.int(0, 3) === 0)),
        endedAt: r.int(0, 100),
      }),
      ({ cells, others, endedAt }) => {
        const m = paintMilestones({ id: 'me', cells, endedAt, others });
        expect(m.firstPaint && m.cellsRecord !== null).toBe(false);
        if (cells === 0) expect(m).toEqual({ firstPaint: false, cells: 0, cellsRecord: null });
        if (others.some((o) => o.firstPaint && o.cells > 0)) expect(m.firstPaint).toBe(false);
      },
    );
  });
});

describe('eco da crew: só entre 07h e 22h de Brasília', () => {
  it('limites da janela', () => {
    const brt = (h: number, m = 0) => Date.UTC(2026, 10, 4, h + 3, m);
    expect(isEchoHour(brt(6, 59))).toBe(false);
    expect(isEchoHour(brt(7))).toBe(true);
    expect(isEchoHour(brt(21, 59))).toBe(true);
    expect(isEchoHour(brt(22))).toBe(false);
  });
});
