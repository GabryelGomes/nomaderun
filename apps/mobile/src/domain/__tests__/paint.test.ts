/**
 * T7.1.1 — regra v2 "Pintura de ruas" (D-62): exemplos da seção 7.3 do relatório da E3 e propriedades.
 */
import '../h3-runtime';

import { describe, expect, it } from '@jest/globals';
import { cellToChildren, gridDisk } from 'h3-js';

import { validateActivity } from '../anti-cheat';
import { distanceMeters, offset } from '../geo';
import { cellCenter, zoneOf } from '../grid';
import {
  applyPaint,
  cellsOfSegment,
  conquestGap,
  effectiveLayers,
  emptyPaintCounts,
  fadeCell,
  fadeCells,
  paintGapMeters,
  inheritZonesV1,
  inheritedCells,
  isZoneUnderAttackV2,
  newZonePaint,
  PAINT_ATTACK_WINDOW_MS,
  PAINT_CELL_RES,
  PAINT_FADE_MS,
  PAINT_INHERIT_CELLS,
  PAINT_MAX_LAYERS,
  paintAttackActive,
  paintCellOf,
  paintCellsOfRun,
  paintTransition,
  paintZoneOf,
  refreshZoneOwner,
  seasonResetPaint,
  zoneCounts,
  zoneOwnerByCells,
  ZONE_MIN_CELLS,
  type PaintCell,
  type PaintCounts,
  type PaintWorld,
  type ZonePaint,
} from '../paint';
import { FACTION_IDS, type FactionId, type GeoPoint } from '../types';
import { ORIGIN, track } from './helpers';
import { forAll, type Rng } from './prop';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_790_000_000_000;
const ZONE = zoneOf(ORIGIN);
/** Os 49 trechos (res 11) da zona do Parque Flamboyant, em ordem estável. */
const CELLS = cellToChildren(ZONE, PAINT_CELL_RES).sort();
const NEIGHBOR = gridDisk(ZONE, 1).find((z) => z !== ZONE)!;
const NEIGHBOR_CELLS = cellToChildren(NEIGHBOR, PAINT_CELL_RES).sort();

const pc = (cell: string, faction: FactionId, layers: number, paintedAt = NOW): PaintCell => ({
  cell,
  zoneId: paintZoneOf(cell),
  faction,
  layers,
  paintedAt,
});

function worldOf(cells: PaintCell[], zones: ZonePaint[] = []): PaintWorld {
  return {
    cells: Object.fromEntries(cells.map((c) => [c.cell, c])),
    zones: Object.fromEntries(zones.map((z) => [z.zoneId, z])),
  };
}

const counts = (partial: Partial<PaintCounts>): PaintCounts => ({ ...emptyPaintCounts(), ...partial });

describe('células e trajeto', () => {
  it('trecho é res 11 e pertence a uma única zona (pai res 9)', () => {
    const c = paintCellOf(ORIGIN);
    expect(paintZoneOf(c)).toBe(ZONE);
    expect(CELLS).toHaveLength(49);
    expect(CELLS.every((x) => paintZoneOf(x) === ZONE)).toBe(true);
  });

  it('segmento curto interpola; segmento acima de 100 m pinta só as pontas', () => {
    const a = ORIGIN;
    const b = offset(a, 90, 90);
    const near = cellsOfSegment(a, b, distanceMeters(a, b));
    expect(new Set(near).size).toBeGreaterThanOrEqual(3);
    const far = offset(a, 400, 90);
    expect(cellsOfSegment(a, far, distanceMeters(a, far))).toEqual([paintCellOf(a), paintCellOf(far)]);
  });

  it('corrida pinta trechos em ordem, sem repetir; ~40 m por trecho', () => {
    const points = track({ kmh: 10, seconds: 120, spm: 170 }); // ~333 m para o leste
    const cells = paintCellsOfRun(points, validateActivity(points));
    expect(new Set(cells).size).toBe(cells.length);
    expect(cells[0]).toBe(paintCellOf(points[0]));
    expect(cells.length).toBeGreaterThanOrEqual(6);
    expect(cells.length).toBeLessThanOrEqual(20);
  });

  it('corrida rejeitada (localização simulada) não pinta nada', () => {
    const points = track({ kmh: 10, seconds: 60, spm: 170 }).map((p) => ({ ...p, mocked: true }));
    expect(paintCellsOfRun(points, validateActivity(points))).toEqual([]);
  });

  it('salto de GPS (passo inválido) não pinta a linha reta do salto', () => {
    const a = track({ kmh: 10, seconds: 20, spm: 170 });
    const last = a[a.length - 1];
    const jumpTo = offset(last, 800, 0);
    const b = track({ kmh: 10, seconds: 20, spm: 170, start: jumpTo, t0: last.t + 1000 });
    const points = [...a, ...b];
    const cells = paintCellsOfRun(points, validateActivity(points));
    const middle = paintCellOf(offset(last, 400, 0));
    expect(cells).not.toContain(middle);
    expect(cells).toContain(paintCellOf(jumpTo));
  });
});

describe('camadas, desbotar e passadas', () => {
  it('desbota 1 camada a cada 7 dias sem passada do time', () => {
    const c = pc(CELLS[0], 'owls', 3, NOW);
    expect(effectiveLayers(c, NOW + PAINT_FADE_MS - 1)).toBe(3);
    expect(effectiveLayers(c, NOW + PAINT_FADE_MS)).toBe(2);
    expect(effectiveLayers(c, NOW + 3 * PAINT_FADE_MS)).toBe(0);
    expect(effectiveLayers(c, NOW - DAY)).toBe(3);
    expect(fadeCell(c, NOW + 3 * PAINT_FADE_MS)).toBeNull();
    expect(fadeCell(c, NOW + DAY)).toBe(c);
    const once = fadeCell(c, NOW + PAINT_FADE_MS + DAY)!;
    expect(once).toMatchObject({ layers: 2, paintedAt: NOW + PAINT_FADE_MS });
    expect(fadeCell(once, NOW + PAINT_FADE_MS + DAY)).toEqual(once);
  });

  it('fadeCells separa o que fica e o que some (job diário)', () => {
    const r = fadeCells([pc(CELLS[0], 'owls', 1, NOW - PAINT_FADE_MS), pc(CELLS[1], 'volt', 2, NOW - PAINT_FADE_MS)], NOW);
    expect(r.removed).toEqual([CELLS[0]]);
    expect(r.kept).toEqual([{ ...pc(CELLS[1], 'volt', 1, NOW) }]);
  });

  it('virada de temporada: todo trecho vivo volta a 1 camada', () => {
    const r = seasonResetPaint([pc(CELLS[0], 'owls', 3, NOW - DAY), pc(CELLS[1], 'volt', 1, NOW - 2 * PAINT_FADE_MS)], NOW);
    expect(r.kept).toEqual([pc(CELLS[0], 'owls', 1, NOW)]);
    expect(r.removed).toEqual([CELLS[1]]);
  });

  it('transições: novo, reforço até 3, enfraquecido e virado', () => {
    const t = NOW + DAY;
    expect(paintTransition(null, CELLS[0], 'volt', t)).toEqual({ next: pc(CELLS[0], 'volt', 1, t), kind: 'novo' });
    expect(paintTransition(pc(CELLS[0], 'volt', 1, NOW - 2 * PAINT_FADE_MS), CELLS[0], 'owls', t).kind).toBe('novo');
    expect(paintTransition(pc(CELLS[0], 'volt', 2), CELLS[0], 'volt', t).next).toMatchObject({ layers: 3, paintedAt: t });
    expect(paintTransition(pc(CELLS[0], 'volt', 3), CELLS[0], 'volt', t)).toMatchObject({ next: { layers: 3 }, kind: 'reforco' });
    expect(paintTransition(pc(CELLS[0], 'volt', 3), CELLS[0], 'owls', t)).toEqual({ next: pc(CELLS[0], 'volt', 2, NOW), kind: 'enfraquecido' });
    expect(paintTransition(pc(CELLS[0], 'volt', 1), CELLS[0], 'owls', t)).toEqual({ next: pc(CELLS[0], 'owls', 1, t), kind: 'virado' });
  });
});

describe('dono da zona e "faltam N trechos"', () => {
  it('maioria com mínimo de 3; empate mantém o dono; empate sem dono fica neutro', () => {
    expect(zoneOwnerByCells(counts({ volt: 2 }), null)).toBeNull();
    expect(zoneOwnerByCells(counts({ volt: 3 }), null)).toBe('volt');
    expect(zoneOwnerByCells(counts({ volt: 2 }), 'volt')).toBeNull();
    expect(zoneOwnerByCells(counts({ volt: 4, owls: 4 }), 'owls')).toBe('owls');
    expect(zoneOwnerByCells(counts({ volt: 4, owls: 4 }), null)).toBeNull();
    expect(zoneOwnerByCells(counts({ volt: 4, owls: 4, striders: 1 }), 'striders')).toBeNull();
    expect(zoneOwnerByCells(counts({ striders: 4, coyotes: 4 }), null)).toBeNull(); // sem vantagem dos Striders
  });

  it('faltam N trechos (estimativa só com trechos novos)', () => {
    expect(conquestGap(counts({}), 'owls', null)).toBe(ZONE_MIN_CELLS);
    expect(conquestGap(counts({ owls: 3 }), 'owls', 'owls')).toBe(0);
    expect(conquestGap(counts({ owls: 3, volt: 7 }), 'owls', 'volt')).toBe(5);
    expect(conquestGap(counts({ owls: 4, volt: 4 }), 'owls', 'volt')).toBe(1);
    expect(paintGapMeters(5)).toBe(200);
    expect(paintGapMeters(-1)).toBe(0);
  });
});

describe('exemplos do relatório (seção 7.3)', () => {
  it('Exemplo 1 — Ana, 1º dia, zona neutra: 3 trechos conquistam', () => {
    const two = applyPaint(worldOf([]), { cells: CELLS.slice(0, 2), faction: 'volt', now: NOW });
    expect(two.zones[0]).toMatchObject({ ownerAfter: null, outcome: 'pintada', touched: 2 });
    const five = applyPaint(worldOf([]), { cells: CELLS.slice(0, 5), faction: 'volt', now: NOW });
    expect(five.zones[0]).toMatchObject({ ownerBefore: null, ownerAfter: 'volt', outcome: 'conquistada' });
    expect(five.events).toEqual([{ type: 'captured', zoneId: ZONE, faction: 'volt', from: null }]);
    expect(five.updatedCells.every((c) => c.layers === 1 && c.faction === 'volt')).toBe(true);
    expect(five.paintedCells).toEqual(CELLS.slice(0, 5));
  });

  it('Exemplo 2 — Bruno ataca os Corujas: 3 × 4, faltam 2; depois 5 × 4 conquista', () => {
    const layers = [1, 1, 3, 3, 1, 1, 1];
    const owls = layers.map((l, i) => pc(CELLS[i], 'owls', l, NOW - DAY));
    const world = worldOf(owls, [{ ...newZonePaint(ZONE), owner: 'owls' }]);
    const first = applyPaint(world, { cells: CELLS.slice(0, 5), faction: 'coyotes', now: NOW });
    expect(first.changes.map((c) => c.kind)).toEqual(['virado', 'virado', 'enfraquecido', 'enfraquecido', 'virado']);
    const z = first.zones[0];
    expect(z.countsAfter).toMatchObject({ coyotes: 3, owls: 4 });
    expect(z.ownerAfter).toBe('owls');
    expect(conquestGap(z.countsAfter, 'coyotes', 'owls')).toBe(2);
    expect(first.events).toContainEqual({ type: 'under_attack', zoneId: ZONE, owner: 'owls', attacker: 'coyotes' });
    expect(z.outcome).toBe('atacada');

    const after = worldOf(
      [...owls.filter((c) => !first.updatedCells.some((u) => u.cell === c.cell)), ...first.updatedCells],
      first.updatedZones,
    );
    const second = applyPaint(after, {
      cells: CELLS.slice(10, 12),
      faction: 'coyotes',
      now: NOW + 60_000,
      paintedToday: new Set(first.paintedCells),
    });
    expect(second.zones[0]).toMatchObject({ ownerAfter: 'coyotes', outcome: 'conquistada', countsAfter: { coyotes: 5, owls: 4 } });
    expect(second.updatedZones[0].attack).toBeNull();
  });

  it('Exemplo 3 — Carla defende: vira de volta 4 trechos e a zona é defendida', () => {
    const owls = CELLS.slice(0, 10).map((c) => pc(c, 'owls', 1, NOW - DAY));
    const world = worldOf(owls, [{ ...newZonePaint(ZONE), owner: 'owls' }]);
    const attack = applyPaint(world, { cells: CELLS.slice(0, 4), faction: 'coyotes', now: NOW });
    expect(attack.events).toEqual([{ type: 'under_attack', zoneId: ZONE, owner: 'owls', attacker: 'coyotes' }]);
    const attackedZone = attack.updatedZones[0];
    expect(attackedZone.attack).toMatchObject({ attacker: 'coyotes', flips: 4, since: NOW, lastAt: NOW });

    const cells = [...owls.slice(4), ...attack.updatedCells];
    expect(isZoneUnderAttackV2(attackedZone, zoneCounts(attackedZone, cells, NOW + DAY), NOW + DAY)).toBe(true);
    const defense = applyPaint(worldOf(cells, [attackedZone]), { cells: CELLS.slice(0, 7), faction: 'owls', now: NOW + DAY });
    expect(defense.events).toEqual([{ type: 'defended', zoneId: ZONE, owner: 'owls' }]);
    expect(defense.zones[0]).toMatchObject({ outcome: 'defendida', countsAfter: { owls: 10, coyotes: 0 } });
    expect(defense.updatedZones[0].attack).toBeNull();
  });
});

describe('ataque, herança, bloqueio, "hoje" e reforço na conquista', () => {
  const owned = (n: number, owner: FactionId = 'owls') => CELLS.slice(0, n).map((c) => pc(c, owner, 1, NOW - DAY));

  it('ataque expira 24 h depois da última virada (E-03 na v2)', () => {
    const zone: ZonePaint = { ...newZonePaint(ZONE), owner: 'owls', attack: { attacker: 'volt', since: NOW, lastAt: NOW, flips: 3 } };
    const c = counts({ owls: 10, volt: 1 });
    expect(paintAttackActive(zone, NOW + PAINT_ATTACK_WINDOW_MS)).toBe(true);
    expect(isZoneUnderAttackV2(zone, c, NOW + 1000)).toBe(true);
    expect(isZoneUnderAttackV2(zone, c, NOW + PAINT_ATTACK_WINDOW_MS + 1)).toBe(false);
    expect(isZoneUnderAttackV2({ ...zone, attack: { ...zone.attack!, flips: 0 } }, c, NOW)).toBe(false);
    expect(isZoneUnderAttackV2({ ...zone, owner: null }, c, NOW)).toBe(false);
    expect(isZoneUnderAttackV2({ ...zone, attack: { ...zone.attack!, attacker: 'owls' } }, c, NOW)).toBe(false);
  });

  it('o mesmo atacante acumula viradas; outro atacante abre um ataque novo', () => {
    const zone: ZonePaint = { ...newZonePaint(ZONE), owner: 'owls', attack: { attacker: 'volt', since: NOW - 1000, lastAt: NOW - 1000, flips: 2 } };
    const world = worldOf(owned(20), [zone]);
    const same = applyPaint(world, { cells: CELLS.slice(0, 1), faction: 'volt', now: NOW });
    expect(same.updatedZones[0].attack).toEqual({ attacker: 'volt', since: NOW - 1000, lastAt: NOW, flips: 3 });
    expect(same.events).toEqual([]);
    const other = applyPaint(world, { cells: CELLS.slice(0, 3), faction: 'coyotes', now: NOW });
    expect(other.updatedZones[0].attack).toEqual({ attacker: 'coyotes', since: NOW, lastAt: NOW, flips: 3 });
    expect(other.events).toEqual([{ type: 'under_attack', zoneId: ZONE, owner: 'owls', attacker: 'coyotes' }]);
    const weak = applyPaint(worldOf(owned(20), [{ ...newZonePaint(ZONE), owner: 'owls' }]), { cells: CELLS.slice(0, 1), faction: 'coyotes', now: NOW });
    expect(weak.zones[0]).toMatchObject({ outcome: 'pintada', ownerAfter: 'owls', flipped: 1 });
    expect(weak.updatedZones[0].attack).toBeNull();
    const empty = applyPaint(worldOf(owned(20), [{ ...newZonePaint(ZONE), owner: 'owls' }]), { cells: CELLS.slice(30, 31), faction: 'coyotes', now: NOW });
    expect(empty.updatedZones[0].attack).toBeNull();
  });

  it('dono que corre sem tirar a pressão não defende; pressão já sumida limpa o ataque sem evento', () => {
    const attack = { attacker: 'volt' as const, since: NOW, lastAt: NOW, flips: 0 };
    const pressed = worldOf([...owned(4), ...CELLS.slice(20, 24).map((c) => pc(c, 'volt', 2, NOW - DAY))], [{ ...newZonePaint(ZONE), owner: 'owls', attack }]);
    const r = applyPaint(pressed, { cells: CELLS.slice(30, 31), faction: 'owls', now: NOW + 1000 });
    expect(r.zones[0].outcome).toBe('reforcada');
    expect(r.updatedZones[0].attack).toEqual(attack);
    const calm = worldOf(owned(10), [{ ...newZonePaint(ZONE), owner: 'owls', attack }]);
    const s = applyPaint(calm, { cells: CELLS.slice(0, 1), faction: 'owls', now: NOW + 1000 });
    expect(s.events).toEqual([]);
    expect(s.updatedZones[0].attack).toBeNull();
  });

  it('herança da virada: 3 trechos virtuais do dono por 7 dias', () => {
    const [z, neutral, blocked] = inheritZonesV1(
      [
        { id: ZONE, owner: 'volt' },
        { id: NEIGHBOR, owner: null },
        { id: 'x', owner: 'owls', blocked: true },
      ],
      NOW,
    );
    expect(z.inherited).toEqual({ faction: 'volt', cells: PAINT_INHERIT_CELLS, until: NOW + PAINT_FADE_MS });
    expect(neutral).toEqual(newZonePaint(NEIGHBOR));
    expect(blocked).toMatchObject({ owner: null, inherited: null, blocked: true });
    expect(inheritedCells(z, NOW + PAINT_FADE_MS - 1)).toBe(3);
    expect(inheritedCells(z, NOW + PAINT_FADE_MS)).toBe(0);
    expect(zoneCounts(z, [], NOW).volt).toBe(3);

    const three = applyPaint(worldOf([], [z]), { cells: CELLS.slice(0, 3), faction: 'owls', now: NOW + DAY });
    expect(three.zones[0]).toMatchObject({ ownerAfter: 'volt', countsAfter: { owls: 3, volt: 3 } });
    const four = applyPaint(worldOf([], [z]), { cells: CELLS.slice(0, 4), faction: 'owls', now: NOW + DAY });
    expect(four.zones[0]).toMatchObject({ ownerAfter: 'owls', countsAfter: { owls: 4, volt: 0 } });
    expect(four.updatedZones[0].inherited).toBeNull();
    const own = applyPaint(worldOf([], [z]), { cells: CELLS.slice(0, 1), faction: 'volt', now: NOW + DAY });
    expect(own.updatedZones[0].inherited).toEqual(z.inherited);
    const late = applyPaint(worldOf([], [z]), { cells: CELLS.slice(0, 1), faction: 'owls', now: NOW + PAINT_FADE_MS });
    expect(late.zones[0]).toMatchObject({ ownerAfter: null, countsBefore: { volt: 0 } });
    expect(late.events).toEqual([{ type: 'neutralized', zoneId: ZONE, from: 'volt' }]);
  });

  it('zona bloqueada e trecho já pintado hoje não pintam', () => {
    const world = worldOf([], [{ ...newZonePaint(NEIGHBOR), blocked: true }]);
    const r = applyPaint(world, {
      cells: [CELLS[0], CELLS[1], NEIGHBOR_CELLS[0], CELLS[2]],
      faction: 'volt',
      now: NOW,
      paintedToday: new Set([CELLS[1]]),
      blockedZones: new Set(['outra']),
    });
    expect(r.skipped).toEqual([
      { cell: CELLS[1], reason: 'hoje' },
      { cell: NEIGHBOR_CELLS[0], reason: 'bloqueada' },
    ]);
    expect(r.paintedCells).toEqual([CELLS[0], CELLS[2]]);
    const viaInput = applyPaint(worldOf([]), { cells: [CELLS[0]], faction: 'volt', now: NOW, blockedZones: new Set([ZONE]) });
    expect(viaInput.changes).toEqual([]);
  });

  it('reforço na conquista é parâmetro desligado; ligado, dá +1 camada aos trechos do time', () => {
    const base = worldOf([pc(CELLS[40], 'volt', 1, NOW - DAY), pc(CELLS[41], 'volt', 1, NOW - 4 * PAINT_FADE_MS)]);
    const off = applyPaint(base, { cells: CELLS.slice(0, 3), faction: 'volt', now: NOW });
    expect(off.updatedCells.every((c) => c.layers === 1)).toBe(true);
    const on = applyPaint(base, { cells: CELLS.slice(0, 3), faction: 'volt', now: NOW, options: { reinforceOnConquest: true } });
    expect(on.zones[0].outcome).toBe('conquistada');
    expect(on.updatedCells.filter((c) => c.faction === 'volt').map((c) => c.layers)).toEqual([2, 2, 2, 2]);
  });

  it('refreshZoneOwner: neutraliza, troca ou mantém depois do desbotar', () => {
    const zone: ZonePaint = { ...newZonePaint(ZONE), owner: 'owls', attack: { attacker: 'volt', since: NOW, lastAt: NOW, flips: 3 } };
    expect(refreshZoneOwner(zone, counts({ owls: 2 }), NOW)).toEqual({
      zone: { ...zone, owner: null, attack: null },
      events: [{ type: 'neutralized', zoneId: ZONE, from: 'owls' }],
    });
    expect(refreshZoneOwner(zone, counts({ owls: 3, volt: 4 }), NOW).events).toEqual([
      { type: 'captured', zoneId: ZONE, faction: 'volt', from: 'owls' },
    ]);
    expect(refreshZoneOwner(zone, counts({ owls: 5 }), NOW + 1000)).toEqual({ zone, events: [] });
    expect(refreshZoneOwner(zone, counts({ owls: 5 }), NOW + 2 * PAINT_ATTACK_WINDOW_MS).zone.attack).toBeNull();
    expect(refreshZoneOwner(newZonePaint(ZONE), counts({ coyotes: 3 }), NOW).events).toEqual([
      { type: 'captured', zoneId: ZONE, faction: 'coyotes', from: null },
    ]);
    expect(refreshZoneOwner({ ...zone, blocked: true }, counts({ owls: 5 }), NOW)).toEqual({
      zone: { ...zone, blocked: true, owner: null, attack: null },
      events: [],
    });
    expect(refreshZoneOwner(newZonePaint(ZONE), counts({}), NOW).events).toEqual([]);
    const heir: ZonePaint = { ...newZonePaint(ZONE), owner: 'volt', inherited: { faction: 'volt', cells: 3, until: NOW + DAY } };
    expect(refreshZoneOwner(heir, counts({ volt: 3 }), NOW).zone.inherited).toEqual(heir.inherited);
    expect(refreshZoneOwner(heir, counts({ volt: 3 }), NOW + DAY).zone.inherited).toBeNull();
  });
});

/* ---------- propriedades ---------- */

const NOW_P = NOW + 30 * DAY;

type Case = { world: PaintWorld; cells: string[]; faction: FactionId; paintedToday: Set<string>; now: number };

function caseGen(r: Rng): Case {
  const all = [...CELLS, ...NEIGHBOR_CELLS];
  const cells: PaintCell[] = [];
  for (const c of all) {
    if (r.bool(0.45)) cells.push(pc(c, r.pick(FACTION_IDS), r.int(1, PAINT_MAX_LAYERS), NOW_P - r.int(0, 25 * DAY)));
  }
  const zone = (id: string): ZonePaint => {
    const owner = r.bool(0.3) ? null : r.pick(FACTION_IDS);
    const attacker = r.pick(FACTION_IDS);
    return {
      zoneId: id,
      owner,
      inherited: owner && r.bool(0.3) ? { faction: owner, cells: PAINT_INHERIT_CELLS, until: NOW_P + r.int(-DAY, 7 * DAY) } : null,
      attack: owner && attacker !== owner && r.bool(0.4) ? { attacker, since: NOW_P - DAY, lastAt: NOW_P - r.int(0, 2 * DAY), flips: r.int(0, 5) } : null,
    };
  };
  const run: string[] = [];
  const n = r.int(0, 40);
  for (let i = 0; i < n; i++) run.push(r.pick(all));
  const today = new Set<string>();
  for (const c of all) if (r.bool(0.05)) today.add(c);
  return { world: worldOf(cells, [zone(ZONE), zone(NEIGHBOR)]), cells: run, faction: r.pick(FACTION_IDS), paintedToday: today, now: NOW_P };
}

const run = (c: Case, extra: Partial<Parameters<typeof applyPaint>[1]> = {}) =>
  applyPaint(c.world, { cells: c.cells, faction: c.faction, now: c.now, paintedToday: c.paintedToday, ...extra });

/** Troca os rótulos dos times por uma permutação. */
function permute(c: Case, sigma: Record<FactionId, FactionId>): Case {
  const cells = Object.fromEntries(Object.entries(c.world.cells).map(([k, v]) => [k, { ...v, faction: sigma[v.faction] }]));
  const zones = Object.fromEntries(
    Object.entries(c.world.zones).map(([k, z]) => [
      k,
      {
        ...z,
        owner: z.owner && sigma[z.owner],
        inherited: z.inherited && { ...z.inherited, faction: sigma[z.inherited.faction] },
        attack: z.attack && { ...z.attack, attacker: sigma[z.attack.attacker] },
      },
    ]),
  );
  return { ...c, world: { cells, zones }, faction: sigma[c.faction] };
}

describe('propriedades da pintura (D-62)', () => {
  it('1 dono por zona, sempre o líder do placar com pelo menos 3 trechos', () => {
    forAll(caseGen, (c) => {
      for (const z of run(c).zones) {
        expect(z.ownerAfter).toBe(zoneOwnerByCells(z.countsAfter, z.ownerBefore));
        if (z.ownerAfter) {
          expect(z.countsAfter[z.ownerAfter]).toBeGreaterThanOrEqual(ZONE_MIN_CELLS);
          for (const f of FACTION_IDS) expect(z.countsAfter[z.ownerAfter]).toBeGreaterThanOrEqual(z.countsAfter[f]);
        }
      }
    });
  });

  it('camadas sempre entre 1 e 3; passada rival nunca aumenta camada do rival', () => {
    forAll(caseGen, (c) => {
      const r = run(c, { options: { reinforceOnConquest: c.cells.length % 2 === 0 } });
      for (const u of r.updatedCells) {
        expect(u.layers).toBeGreaterThanOrEqual(1);
        expect(u.layers).toBeLessThanOrEqual(PAINT_MAX_LAYERS);
      }
      for (const ch of r.changes) {
        if (ch.before && ch.before.faction !== c.faction && ch.after.faction === ch.before.faction) {
          expect(ch.after.layers).toBe(ch.before.layers - 1);
        }
      }
    });
  });

  it('simetria entre times: trocar os rótulos troca o resultado', () => {
    forAll(
      (r) => ({ c: caseGen(r), order: [...FACTION_IDS].sort(() => r.next() - 0.5) }),
      ({ c, order }) => {
        const sigma = Object.fromEntries(FACTION_IDS.map((f, i) => [f, order[i]])) as Record<FactionId, FactionId>;
        const a = run(c);
        const b = run(permute(c, sigma));
        expect(b.zones.map((z) => z.ownerAfter)).toEqual(a.zones.map((z) => z.ownerAfter && sigma[z.ownerAfter]));
        expect(b.updatedCells.map((u) => [u.cell, u.faction, u.layers])).toEqual(a.updatedCells.map((u) => [u.cell, sigma[u.faction], u.layers]));
        expect(b.events.length).toBe(a.events.length);
      },
    );
  });

  it('idempotência: repetir trecho na corrida não muda nada; reaplicar no mesmo dia não pinta de novo', () => {
    forAll(caseGen, (c) => {
      const once = run({ ...c, cells: [...new Set(c.cells)] });
      const twice = run({ ...c, cells: [...c.cells, ...c.cells] });
      expect(twice).toEqual(once);
      const merged: Record<string, PaintCell> = { ...c.world.cells };
      for (const u of once.updatedCells) merged[u.cell] = u;
      const zones: Record<string, ZonePaint> = { ...c.world.zones };
      for (const z of once.updatedZones) zones[z.zoneId] = z;
      const again = applyPaint(
        { cells: merged, zones },
        { cells: c.cells, faction: c.faction, now: c.now, paintedToday: new Set([...c.paintedToday, ...once.paintedCells]) },
      );
      expect(again.changes).toEqual([]);
      expect(again.events).toEqual([]);
    });
  });

  it('desbotar é idempotente, componível e nunca aumenta camadas', () => {
    forAll(
      (r) => ({ cell: pc(CELLS[r.int(0, 48)], r.pick(FACTION_IDS), r.int(1, 3), NOW - r.int(0, 30 * DAY)), t1: NOW + r.int(0, 10 * DAY), dt: r.int(0, 20 * DAY) }),
      ({ cell, t1, dt }) => {
        const a = fadeCell(cell, t1);
        expect(a === null ? null : fadeCell(a, t1)).toEqual(a);
        const direct = fadeCell(cell, t1 + dt);
        expect(a === null ? null : fadeCell(a, t1 + dt)).toEqual(direct);
        expect(effectiveLayers(cell, t1 + dt)).toBeLessThanOrEqual(effectiveLayers(cell, t1));
      },
    );
  });

  it('só passos válidos pintam: todo trecho fica perto de um passo válido', () => {
    forAll(
      (r) => {
        const pts: GeoPoint[] = [];
        let pos = ORIGIN;
        let t = 0;
        for (let i = 0; i < r.int(2, 60); i++) {
          pts.push({ ...pos, t, accuracy: r.bool(0.1) ? 50 : 5, steps: 3 });
          const kmh = r.bool(0.15) ? r.float(45, 200) : r.float(5, 15);
          const dt = r.int(1, 8);
          pos = offset(pos, (kmh / 3.6) * dt, r.float(0, 360));
          t += dt * 1000;
        }
        return pts;
      },
      (pts) => {
        const v = validateActivity(pts);
        const samples = v.steps
          .filter((s) => s.valid)
          .flatMap((s) => {
            const a = pts[s.from];
            const b = pts[s.to];
            return Array.from({ length: 21 }, (_, i) => ({ lat: a.lat + ((b.lat - a.lat) * i) / 20, lng: a.lng + ((b.lng - a.lng) * i) / 20 }));
          });
        for (const cell of paintCellsOfRun(pts, v)) {
          const center = cellCenter(cell);
          expect(Math.min(...samples.map((s) => distanceMeters(s, center)))).toBeLessThanOrEqual(35);
        }
      },
      100,
    );
  });
});
