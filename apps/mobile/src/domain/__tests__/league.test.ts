/**
 * T7.1.3 — Liga real (D-68): grupos de até 30 com volume parecido e regra para grupo pequeno.
 */
import { describe, expect, it } from '@jest/globals';

import { LEAGUE_DIVISIONS } from '../games';
import {
  LEAGUE_V2_GROUP_MAX,
  leagueGroupsV2,
  leagueMovesFor,
  leaguePlaceNewcomer,
  leagueStandingsV2,
  leagueWeek,
  leagueWeekPoints,
  leagueNextDivision,
  type LeagueEntry,
  type LeagueMember,
} from '../league';
import { weekStartBrt } from '../season';
import { forAll } from './prop';

const brt = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h + 3, min);
const TOP = LEAGUE_DIVISIONS.length - 1;

const members = (n: number, division = 0): LeagueMember[] =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(3, '0')}`, division, volume: (i * 37) % 101 }));
const entries = (n: number): LeagueEntry[] => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, points: (n - i) * 10 }));

describe('semana da liga', () => {
  it('começa na segunda 00:00 e fecha na segunda seguinte às 03:20 (Brasília)', () => {
    expect(weekStartBrt(brt(2026, 10, 21, 12))).toBe(brt(2026, 10, 19));
    expect(weekStartBrt(brt(2026, 10, 19, 0))).toBe(brt(2026, 10, 19));
    expect(weekStartBrt(brt(2026, 10, 18, 23, 59))).toBe(brt(2026, 10, 12));
    expect(leagueWeek(brt(2026, 10, 21, 12))).toEqual({ startsAt: brt(2026, 10, 19), closesAt: brt(2026, 10, 26, 3, 20) });
  });

  it('entre segunda 00:00 e 03:20 a semana anterior ainda vale (igual ao league_current do servidor)', () => {
    const prev = { startsAt: brt(2026, 10, 19), closesAt: brt(2026, 10, 26, 3, 20) };
    const next = { startsAt: brt(2026, 10, 26), closesAt: brt(2026, 11, 2, 3, 20) };
    expect(leagueWeek(brt(2026, 10, 26, 0))).toEqual(prev);
    expect(leagueWeek(brt(2026, 10, 26, 3, 19))).toEqual(prev);
    expect(leagueWeek(brt(2026, 10, 26, 3, 20))).toEqual(next);
    expect(leagueWeek(brt(2026, 10, 25, 23, 59))).toEqual(prev);
    // propriedade: o instante sempre cai dentro da semana devolvida, antes do fechamento dela
    forAll(
      (r) => brt(2026, 1, 1) + r.int(0, 400 * 86_400_000),
      (now) => {
        const w = leagueWeek(now);
        expect(w.startsAt).toBeLessThanOrEqual(now);
        expect(now).toBeLessThan(w.closesAt);
        expect(w.closesAt - w.startsAt).toBe(7 * 86_400_000 + (3 * 60 + 20) * 60_000);
        expect(now - w.startsAt).toBeGreaterThanOrEqual((3 * 60 + 20) * 60_000);
      },
    );
  });

  it('pontos da semana = soma dos pontos das corridas', () => {
    expect(leagueWeekPoints([10, -5, NaN, 20.4, Infinity])).toBe(30);
    expect(leagueWeekPoints([])).toBe(0);
  });
});

describe('grupos', () => {
  it('65 pessoas na Calçada → 3 grupos de 22, 22 e 21, por volume', () => {
    const groups = leagueGroupsV2(members(65));
    expect(groups.map((g) => g.members.length)).toEqual([22, 22, 21]);
    expect(groups.map((g) => g.index)).toEqual([0, 1, 2]);
    const vol = new Map(members(65).map((m) => [m.userId, m.volume]));
    expect(Math.min(...groups[0].members.map((u) => vol.get(u)!))).toBeGreaterThanOrEqual(Math.max(...groups[1].members.map((u) => vol.get(u)!)));
  });

  it('divisões separadas, repetidos ignorados, divisão fora da faixa vira a mais próxima', () => {
    const list: LeagueMember[] = [
      { userId: 'a', division: 0, volume: 5 },
      { userId: 'a', division: 3, volume: 99 },
      { userId: 'b', division: 9, volume: 1 },
      { userId: 'c', division: -2, volume: NaN },
      { userId: 'd', division: 0, volume: 5 },
    ];
    expect(leagueGroupsV2(list)).toEqual([
      { division: 0, index: 0, members: ['a', 'd', 'c'] },
      { division: TOP, index: 0, members: ['b'] },
    ]);
    expect(leagueGroupsV2([])).toEqual([]);
  });
});

describe('entrada no meio da semana', () => {
  it('vai para o último grupo da divisão com vaga; cheio, abre outro; já inscrito não muda', () => {
    const groups = leagueGroupsV2(members(59));
    expect(groups.map((g) => g.members.length)).toEqual([30, 29]);
    const a = leaguePlaceNewcomer(groups, { userId: 'novo', division: 0, volume: 0 });
    expect(a.group).toMatchObject({ division: 0, index: 1 });
    expect(a.groups.map((g) => g.members.length)).toEqual([30, 30]);
    const b = leaguePlaceNewcomer(a.groups, { userId: 'novo2', division: 0, volume: 0 });
    expect(b.group).toEqual({ division: 0, index: 2, members: ['novo2'] });
    expect(leaguePlaceNewcomer(b.groups, { userId: 'novo', division: 0, volume: 0 }).group).toBe(a.group);
    expect(leaguePlaceNewcomer([], { userId: 'x', division: 99, volume: 0 }).group).toEqual({ division: TOP, index: 0, members: ['x'] });
    const two = leaguePlaceNewcomer(
      [
        { division: 1, index: 1, members: ['p'] },
        { division: 1, index: 0, members: ['q'] },
      ],
      { userId: 'y', division: 1, volume: 0 },
    );
    expect(two.group).toEqual({ division: 1, index: 1, members: ['p', 'y'] });
  });
});

describe('resultado do grupo', () => {
  it('sobe/desce 1 a cada 6, até 5', () => {
    expect([1, 5, 6, 11, 12, 29, 30, 31].map(leagueMovesFor)).toEqual([0, 0, 1, 1, 2, 4, 5, 5]);
  });

  it('grupo de 30: 5 sobem, 5 descem', () => {
    const s = leagueStandingsV2(entries(30), 2);
    expect(s.filter((x) => x.result === 'promoted').map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(s.filter((x) => x.result === 'relegated').map((x) => x.rank)).toEqual([26, 27, 28, 29, 30]);
  });

  it('divisão mais alta não sobe; mais baixa não desce; quem fez 0 não sobe', () => {
    expect(leagueStandingsV2(entries(30), TOP).some((x) => x.result === 'promoted')).toBe(false);
    expect(leagueStandingsV2(entries(30), 0).some((x) => x.result === 'relegated')).toBe(false);
    const zeros = leagueStandingsV2(Array.from({ length: 12 }, (_, i) => ({ userId: `z${i}`, points: 0 })), 1);
    expect(zeros.filter((x) => x.result === 'promoted')).toEqual([]);
    expect(zeros.filter((x) => x.result === 'relegated')).toHaveLength(2);
  });

  it('grupo pequeno (< 6): só o 1º sobe, se pontuou; ninguém desce', () => {
    const s = leagueStandingsV2(entries(4), 1);
    expect(s.map((x) => x.result)).toEqual(['promoted', 'stays', 'stays', 'stays']);
    expect(leagueStandingsV2([{ userId: 'só', points: 0 }], 1)[0].result).toBe('stays');
    expect(leagueStandingsV2([{ userId: 'só', points: 40 }], 1)[0]).toMatchObject({ rank: 1, result: 'promoted' });
  });

  it('desempate: quem chegou antes aos pontos, depois o id', () => {
    const s = leagueStandingsV2(
      [
        { userId: 'c', points: 50 },
        { userId: 'b', points: 50, reachedAt: 200 },
        { userId: 'a', points: 50 },
        { userId: 'd', points: 50, reachedAt: 100 },
        { userId: 'e', points: NaN },
      ],
      1,
    );
    expect(s.map((x) => x.userId)).toEqual(['d', 'b', 'a', 'c', 'e']);
  });

  it('próxima divisão', () => {
    expect(leagueNextDivision(1, 'promoted')).toBe(2);
    expect(leagueNextDivision(1, 'relegated')).toBe(0);
    expect(leagueNextDivision(1, 'stays')).toBe(1);
    expect(leagueNextDivision(TOP, 'promoted')).toBe(TOP);
    expect(leagueNextDivision(0, 'relegated')).toBe(0);
  });
});

describe('propriedades da Liga', () => {
  it('grupos ≤ 30, cada pessoa em 1 grupo, tamanhos parecidos e volumes em faixas', () => {
    forAll(
      (r) => Array.from({ length: r.int(0, 200) }, (_, i) => ({ userId: `u${i}`, division: r.int(0, TOP), volume: r.float(0, 500) })),
      (list) => {
        const groups = leagueGroupsV2(list);
        const all = groups.flatMap((g) => g.members);
        expect(all.length).toBe(list.length);
        expect(new Set(all).size).toBe(list.length);
        const vol = new Map(list.map((m) => [m.userId, m.volume]));
        for (let d = 0; d <= TOP; d++) {
          const gs = groups.filter((g) => g.division === d);
          const sizes = gs.map((g) => g.members.length);
          if (sizes.length) expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
          for (const g of gs) expect(g.members.length).toBeLessThanOrEqual(LEAGUE_V2_GROUP_MAX);
          for (let i = 1; i < gs.length; i++) {
            expect(Math.min(...gs[i - 1].members.map((u) => vol.get(u)!))).toBeGreaterThanOrEqual(Math.max(...gs[i].members.map((u) => vol.get(u)!)));
          }
        }
      },
    );
  });

  it('ninguém sobe e desce ao mesmo tempo; no máximo "moves" sobem e descem; ranks 1..n', () => {
    forAll(
      (r) => ({ list: Array.from({ length: r.int(0, 30) }, (_, i) => ({ userId: `u${i}`, points: r.bool(0.2) ? 0 : r.int(0, 900) })), division: r.int(0, TOP) }),
      ({ list, division }) => {
        const s = leagueStandingsV2(list, division);
        expect(s.map((x) => x.rank)).toEqual(list.map((_, i) => i + 1));
        const up = s.filter((x) => x.result === 'promoted');
        const down = s.filter((x) => x.result === 'relegated');
        const limit = list.length < 6 ? 1 : leagueMovesFor(list.length);
        expect(up.length).toBeLessThanOrEqual(limit);
        expect(down.length).toBeLessThanOrEqual(leagueMovesFor(list.length));
        for (const u of up) expect(u.points).toBeGreaterThan(0);
        for (let i = 1; i < s.length; i++) expect(s[i - 1].points).toBeGreaterThanOrEqual(s[i].points);
      },
    );
  });
});
