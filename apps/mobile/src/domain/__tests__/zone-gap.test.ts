/**
 * T7.2.3 — "faltam X m" para o HUD (pedido da E6): `paintZoneGap` (regra v2) e `influenceGapV1` (regra v1).
 * Exemplos e propriedades: a estimativa nunca promete menos do que a regra oficial exige, e não exagera.
 */
import { describe, expect, it } from '@jest/globals';

import {
  conquestGap,
  emptyPaintCounts,
  isZoneUnderAttackV2,
  newZonePaint,
  PAINT_CELL_METERS,
  PAINT_DEFENSE_RETAKES,
  paintZoneGap,
  zoneOwnerByCells,
  type PaintCounts,
} from '../paint';
import { DAILY_ZONE_CAP, scoreZone } from '../scoring';
import {
  applyRunPoints,
  CAPTURE_THRESHOLD,
  DEFENSE_WINDOW_MS,
  influenceGapV1,
  newZone,
  type Zone,
} from '../territory';
import { FACTION_IDS, type FactionId } from '../types';
import { forAll } from './prop';

const NOW = Date.UTC(2026, 9, 23, 12);
const counts = (c: Partial<PaintCounts>): PaintCounts => ({ ...emptyPaintCounts(), ...c });

describe('paintZoneGap (regra v2)', () => {
  it('zona neutra ou de outro time: conquestGap trechos novos, em metros', () => {
    expect(paintZoneGap(counts({}), 'owls', null)).toEqual({ goal: 'conquistar', cells: 3, meters: 3 * PAINT_CELL_METERS, retakes: 0 });
    expect(paintZoneGap(counts({ volt: 5, owls: 2 }), 'owls', 'volt')).toEqual({ goal: 'conquistar', cells: 4, meters: 160, retakes: 0 });
    expect(paintZoneGap(counts({ volt: 5, owls: 2 }), 'owls', 'volt').cells).toBe(conquestGap(counts({ volt: 5, owls: 2 }), 'owls', 'volt'));
  });

  it('zona sua: manter; sob ataque: trechos até o rival cair abaixo de 50% ou 3 trechos virados de volta', () => {
    expect(paintZoneGap(counts({ owls: 6, volt: 4 }), 'owls', 'owls')).toEqual({ goal: 'manter', cells: 0, meters: 0, retakes: 0 });
    // rival 4 × meus 6: preciso de 9 (4 < 9 × 0,5) → 3 novos, ou virar 3 de volta
    expect(paintZoneGap(counts({ owls: 6, volt: 4 }), 'owls', 'owls', { underAttack: true })).toEqual({
      goal: 'defender',
      cells: 3,
      meters: 120,
      retakes: PAINT_DEFENSE_RETAKES,
    });
    expect(paintZoneGap(counts({ owls: 6, volt: 4 }), 'owls', 'owls', { underAttack: true, retaken: 2 }).retakes).toBe(1);
    // já virou 3 de volta, ou o rival já está abaixo de 50%: defendida
    expect(paintZoneGap(counts({ owls: 6, volt: 4 }), 'owls', 'owls', { underAttack: true, retaken: 3 }).goal).toBe('manter');
    expect(paintZoneGap(counts({ owls: 9, volt: 4 }), 'owls', 'owls', { underAttack: true }).goal).toBe('manter');
    expect(paintZoneGap(counts({ owls: 9 }), 'owls', 'owls', { underAttack: true }).goal).toBe('manter');
    expect(paintZoneGap(counts({ owls: 9 }), 'owls', 'owls', { blocked: true })).toEqual({ goal: 'bloqueada', cells: 0, meters: 0, retakes: 0 });
  });

  it('propriedade: pintar os trechos indicados basta, e 1 a menos não basta (conquistar e defender)', () => {
    forAll(
      (r) => {
        const c = emptyPaintCounts();
        for (const f of FACTION_IDS) c[f] = r.int(0, 12);
        const owner = r.bool(0.2) ? null : r.pick(FACTION_IDS);
        return { c, owner: zoneOwnerByCells(c, owner) ?? owner, me: r.pick(FACTION_IDS) };
      },
      ({ c, owner, me }) => {
        const g = paintZoneGap(c, me, owner, { underAttack: true });
        const plus = (n: number) => ({ ...c, [me]: c[me] + n });
        if (g.goal === 'conquistar') {
          expect(zoneOwnerByCells(plus(g.cells), owner)).toBe(me);
          if (g.cells > 0) expect(zoneOwnerByCells(plus(g.cells - 1), owner)).not.toBe(me);
        } else if (g.goal === 'defender') {
          let attacker: FactionId = FACTION_IDS.find((f) => f !== me)!;
          for (const f of FACTION_IDS) if (f !== me && c[f] > c[attacker]) attacker = f;
          const zone = { ...newZonePaint('z'), owner: me, attack: { attacker, since: NOW, lastAt: NOW, flips: 0 } };
          expect(isZoneUnderAttackV2(zone, c, NOW)).toBe(true);
          expect(isZoneUnderAttackV2(zone, plus(g.cells), NOW)).toBe(false);
          expect(isZoneUnderAttackV2(zone, plus(g.cells - 1), NOW)).toBe(true);
        } else {
          expect(g.cells).toBe(0);
        }
        expect(g.meters).toBe(g.cells * PAINT_CELL_METERS);
      },
    );
  });
});

const zoneWith = (p: Partial<Zone>): Zone => ({ ...newZone('z1'), ...p, influence: { ...newZone('z1').influence, ...p.influence } });
const base = { now: NOW, paceSecPerKm: 360, basePaceSecPerKm: 360 };

describe('influenceGapV1 (regra v1, enquanto territory_rule = v1)', () => {
  it('zona neutra: 30 pontos = 300 m no ritmo de sempre; mais rápido que o normal precisa de menos', () => {
    expect(influenceGapV1({ ...base, zone: zoneWith({}), faction: 'owls' })).toEqual({ goal: 'conquistar', points: CAPTURE_THRESHOLD, meters: 296, reachableToday: true });
    const fast = influenceGapV1({ ...base, zone: zoneWith({}), faction: 'owls', paceSecPerKm: 300 });
    expect(fast.meters).toBeLessThan(296);
    // já correu 200 m dentro dela nesta corrida
    expect(influenceGapV1({ ...base, zone: zoneWith({}), faction: 'owls', runMetersInZone: 200 }).meters).toBe(96);
    expect(influenceGapV1({ ...base, zone: zoneWith({}), faction: 'owls', runMetersInZone: 5000 }).meters).toBe(0);
  });

  it('zona de outro time: 110% do dono, com o escudo; e precisa passar o rival mais forte', () => {
    const z = zoneWith({ owner: 'volt', influence: { volt: 100, owls: 20, striders: 0, coyotes: 0 }, shield: 0 });
    const g = influenceGapV1({ ...base, zone: z, faction: 'owls' });
    expect(g.goal).toBe('conquistar');
    expect(g.points).toBe(90); // 110 − 20
    const shielded = influenceGapV1({ ...base, zone: { ...z, shield: 3 }, faction: 'owls' });
    expect(shielded.points).toBe(90);
    expect(shielded.meters).toBeGreaterThan(g.meters * 1.4); // escudo 3 = −30%
    // um terceiro time com 200: é ele que preciso passar
    const crowded = influenceGapV1({ ...base, zone: { ...z, influence: { ...z.influence, coyotes: 200 } }, faction: 'owls' });
    expect(crowded.points).toBe(181);
  });

  it('desempate da v1 (E-06): empatar com um time anterior na ordem não basta; com um posterior basta', () => {
    const before = zoneWith({ influence: { striders: 50, coyotes: 0, owls: 0, volt: 0 } });
    expect(influenceGapV1({ ...base, zone: before, faction: 'volt' }).points).toBe(51);
    const after = zoneWith({ influence: { striders: 0, coyotes: 0, owls: 0, volt: 50 } });
    expect(influenceGapV1({ ...base, zone: after, faction: 'striders' }).points).toBe(50);
  });

  it('zona sua: manter; sob ataque: até o rival ficar abaixo de 40%, com o dobro na janela de defesa', () => {
    const mine = zoneWith({ owner: 'owls', influence: { owls: 100, volt: 60, striders: 0, coyotes: 0 } });
    expect(influenceGapV1({ ...base, zone: mine, faction: 'owls' })).toEqual({ goal: 'manter', points: 0, meters: 0, reachableToday: true });
    const attacked = { ...mine, attackStartedAt: NOW - 3600_000, attacker: 'volt' as const };
    const inWindow = influenceGapV1({ ...base, zone: attacked, faction: 'owls' });
    expect(inWindow.goal).toBe('defender');
    expect(inWindow.points).toBe(51); // 60 ÷ 0,4 = 150 → passar de 150
    const late = influenceGapV1({ ...base, zone: { ...attacked, attackStartedAt: NOW - DEFENSE_WINDOW_MS - 1 }, faction: 'owls' });
    expect(late.meters).toBeGreaterThan(inWindow.meters * 1.9);
    // rival já abaixo de 40%: nada a defender
    expect(influenceGapV1({ ...base, zone: { ...attacked, influence: { ...attacked.influence, volt: 30 } }, faction: 'owls' }).goal).toBe('manter');
  });

  it('teto diário, zona bloqueada e entradas inválidas', () => {
    const big = zoneWith({ owner: 'volt', influence: { volt: 400, owls: 0, striders: 0, coyotes: 0 } });
    expect(influenceGapV1({ ...base, zone: big, faction: 'owls' }).reachableToday).toBe(false);
    expect(influenceGapV1({ ...base, zone: zoneWith({}), faction: 'owls', earnedTodayInZone: DAILY_ZONE_CAP - 10 }).reachableToday).toBe(false);
    expect(influenceGapV1({ ...base, zone: zoneWith({ blocked: true }), faction: 'owls' })).toEqual({ goal: 'bloqueada', points: 0, meters: 0, reachableToday: false });
    const odd = influenceGapV1({ ...base, zone: zoneWith({}), faction: 'owls', runMetersInZone: Number.NaN, earnedTodayInZone: -5, bonus: 0.2 });
    expect(odd.meters).toBe(296);
    expect(influenceGapV1({ ...base, zone: zoneWith({}), faction: 'owls', bonus: 1.5 }).meters).toBe(197);
  });

  it('propriedade: correr os metros indicados conquista (ou defende) na regra oficial, e 30 m a menos não', () => {
    const checked = { conquistar: 0, defender: 0 };
    forAll(
      (r) => {
        const influence = { striders: 0, coyotes: 0, owls: 0, volt: 0 };
        for (const f of FACTION_IDS) influence[f] = r.bool(0.3) ? 0 : Math.round(r.float(0, 160) * 10) / 10;
        const owner = r.bool(0.25) ? null : r.pick(FACTION_IDS);
        const attacked = owner !== null && r.bool(0.5);
        const zone = zoneWith({
          owner,
          influence,
          shield: r.int(0, 3),
          attackStartedAt: attacked ? NOW - r.int(0, 2 * DEFENSE_WINDOW_MS) : null,
          attacker: attacked ? r.pick(FACTION_IDS.filter((f) => f !== owner)) : null,
        });
        return { zone, faction: owner && r.bool(0.4) ? owner : r.pick(FACTION_IDS), pace: r.int(240, 540), basePace: r.int(270, 480), earned: r.bool(0.3) ? r.int(0, 200) : 0 };
      },
      ({ zone, faction, pace, basePace, earned }) => {
        const g = influenceGapV1({ zone, faction, now: NOW, paceSecPerKm: pace, basePaceSecPerKm: basePace, earnedTodayInZone: earned });
        if (g.meters === 0 || !g.reachableToday) return;
        const defending = g.goal === 'defender' && zone.attackStartedAt !== null && NOW - zone.attackStartedAt <= DEFENSE_WINDOW_MS;
        const run = (meters: number) => {
          const { rp } = scoreZone({ meters, paceSecPerKm: pace, basePaceSecPerKm: basePace, streakDays: 0, defending, earnedTodayInZone: earned });
          return applyRunPoints(zone, faction, rp, NOW).zone;
        };
        const done = (z: Zone) => (g.goal === 'conquistar' ? z.owner === faction : z.owner === faction && z.attackStartedAt === null);
        expect(done(run(g.meters))).toBe(true);
        if (g.meters > 30) expect(done(run(g.meters - 30))).toBe(false);
        if (g.goal === 'conquistar' || g.goal === 'defender') checked[g.goal]++;
      },
    );
    // A propriedade conferiu casos de verdade (não pulou todos).
    expect(checked.conquistar).toBeGreaterThan(50);
    expect(checked.defender).toBeGreaterThan(10);
  });
});
