/**
 * T7.1.2 — eventos ao vivo (previsão incremental da pintura, D-62).
 */
import '../h3-runtime';

import { describe, expect, it } from '@jest/globals';
import { cellToChildren } from 'h3-js';

import { validateActivity } from '../anti-cheat';
import { offset } from '../geo';
import { zoneOf } from '../grid';
import { createLiveTracker, LIVE_EVENT_LEVEL, type LiveEvent, type LiveSnapshot } from '../live-events';
import {
  applyPaint,
  emptyPaintCounts,
  newZonePaint,
  PAINT_CELL_RES,
  paintCellsOfRun,
  paintZoneOf,
  zoneOwnerByCells,
  type PaintCell,
  type ZonePaint,
} from '../paint';
import { FACTION_IDS, type FactionId, type GeoPoint } from '../types';
import { ORIGIN, track } from './helpers';
import { forAll } from './prop';

const ZONE = zoneOf(ORIGIN);
const ZONE_CELLS = cellToChildren(ZONE, PAINT_CELL_RES).sort();

/** 300 m para o leste, a 10 km/h, 1 ponto por segundo. */
const PATH = track({ kmh: 10, seconds: 108, spm: 170 });
const PATH_CELLS = paintCellsOfRun(PATH, validateActivity(PATH));
const PATH_IN_ZONE = PATH_CELLS.filter((c) => paintZoneOf(c) === ZONE);
const OFF_PATH = ZONE_CELLS.filter((c) => !PATH_CELLS.includes(c));

const EMPTY: LiveSnapshot = { cells: {}, zones: {} };

function runAll(points: GeoPoint[], opts: Partial<Parameters<typeof createLiveTracker>[0]> = {}) {
  const tracker = createLiveTracker({ runId: 'r1', faction: 'owls', snapshot: EMPTY, ...opts });
  const events: LiveEvent[] = [];
  for (const p of points) events.push(...tracker.push(p));
  return { events, summary: tracker.summary() };
}

const types = (events: LiveEvent[]) => events.map((e) => e.type);

describe('eventos ao vivo — zona neutra', () => {
  it('entra, pinta, 25% e 50%, faltam X m e conquista no 3º trecho', () => {
    const { events, summary } = runAll(PATH);
    expect(events[0]).toMatchObject({ type: 'zona_entrou', zoneId: ZONE, mine: false, owner: null, gapCells: 3, gapMeters: 120, level: 'micro', atMeters: 0 });
    const inZone = events.filter((e) => 'zoneId' in e && e.zoneId === ZONE);
    expect(types(inZone).slice(0, 9)).toEqual([
      'zona_entrou',
      'trecho_pintado',
      'zona_progresso',
      'faltam_metros',
      'trecho_pintado',
      'zona_progresso',
      'faltam_metros',
      'trecho_pintado',
      'zona_conquistada',
    ]);
    const progress = inZone.filter((e) => e.type === 'zona_progresso');
    expect(progress.map((e) => (e.type === 'zona_progresso' ? e.pct : 0))).toEqual([25, 50]);
    expect(inZone.find((e) => e.type === 'faltam_metros')).toMatchObject({ gapCells: 2, gapMeters: 80 });
    const won = inZone.find((e) => e.type === 'zona_conquistada');
    expect(won).toMatchObject({ level: 'media', from: null, provisional: true, first: false, counts: { owls: 3 } });
    expect(summary.conquered).toContain(ZONE);
    expect(summary.cellsPainted).toBe(PATH_CELLS.length);
    expect(summary.meters).toBeGreaterThan(290);
    expect(summary.current).toMatchObject({ mine: true });
    expect(summary.stopped).toBe(false);
  });

  it('primeira conquista da vida é épica; a seguinte é média', () => {
    const long = track({ kmh: 10, seconds: 900, spm: 170 });
    const won = runAll(long, { firstConquestEver: true }).events.filter((e) => e.type === 'zona_conquistada');
    expect(won.length).toBeGreaterThan(1);
    expect(won[0]).toMatchObject({ level: 'epica', first: true });
    expect(won[1]).toMatchObject({ level: 'media', first: false });
  });

  it('eventos têm runId, instante do ponto e distância crescentes', () => {
    const { events } = runAll(PATH);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].runId).toBe('r1');
      expect(events[i].t).toBeGreaterThanOrEqual(events[i - 1].t);
      expect(events[i].atMeters).toBeGreaterThanOrEqual(events[i - 1].atMeters);
    }
    for (const e of events) if (e.type !== 'zona_conquistada') expect(e.level).toBe(LIVE_EVENT_LEVEL[e.type]);
  });
});

describe('eventos ao vivo — rivais, defesa e casos de borda', () => {
  it('zona rival: entra, enfraquece e vira trechos', () => {
    const cells: Record<string, { faction: FactionId; layers: number }> = {};
    PATH_IN_ZONE.forEach((c, i) => (cells[c] = { faction: 'volt', layers: i % 2 ? 2 : 1 }));
    for (const c of OFF_PATH.slice(0, 12)) cells[c] = { faction: 'volt', layers: 3 };
    const snapshot: LiveSnapshot = { cells, zones: { [ZONE]: { owner: 'volt', name: 'Setor Sul 4', inherited: 3 } } };
    const { events } = runAll(PATH, { snapshot });
    expect(events[0]).toMatchObject({ type: 'zona_rival_entrou', owner: 'volt', name: 'Setor Sul 4', level: 'pequena' });
    const total = PATH_IN_ZONE.length + 12 + 3;
    expect(events[0]).toMatchObject({ counts: { volt: total }, gapCells: total + 1 });
    expect(events.find((e) => e.type === 'trecho_virado')).toMatchObject({ from: 'volt', layers: 1 });
    expect(events.find((e) => e.type === 'trecho_enfraquecido')).toMatchObject({ owner: 'volt', layersLeft: 1 });
  });

  it('defesa: zona sua sob ataque, vira de volta 3 trechos → defendida uma vez', () => {
    const cells: Record<string, { faction: FactionId; layers: number }> = {};
    PATH_IN_ZONE.slice(0, 3).forEach((c) => (cells[c] = { faction: 'volt', layers: 1 }));
    PATH_IN_ZONE.slice(3).forEach((c) => (cells[c] = { faction: 'owls', layers: 3 }));
    OFF_PATH.slice(0, 12).forEach((c) => (cells[c] = { faction: 'volt', layers: 1 }));
    OFF_PATH.slice(12, 30).forEach((c) => (cells[c] = { faction: 'owls', layers: 1 }));
    const snapshot: LiveSnapshot = { cells, zones: { [ZONE]: { owner: 'owls', underAttack: true } } };
    const { events, summary } = runAll(PATH, { snapshot });
    expect(events[0]).toMatchObject({ type: 'zona_entrou', mine: true, gapCells: 0 });
    const defended = events.filter((e) => e.type === 'zona_defendida');
    expect(defended).toHaveLength(1);
    expect(defended[0]).toMatchObject({ retaken: 3, level: 'media', provisional: true });
    expect(summary.defended).toEqual([ZONE]);
    expect(events.filter((e) => e.type === 'trecho_pintado' && e.kind === 'reforco').length).toBe(PATH_IN_ZONE.length - 3);
  });

  it('defesa pela margem: o rival cai abaixo de 50% do dono', () => {
    const cells: Record<string, { faction: FactionId; layers: number }> = {};
    cells[PATH_IN_ZONE[0]] = { faction: 'volt', layers: 1 };
    OFF_PATH.slice(0, 4).forEach((c) => (cells[c] = { faction: 'volt', layers: 1 }));
    OFF_PATH.slice(4, 14).forEach((c) => (cells[c] = { faction: 'owls', layers: 1 }));
    const snapshot: LiveSnapshot = { cells, zones: { [ZONE]: { owner: 'owls', underAttack: true } } };
    const d = runAll(PATH, { snapshot }).events.find((e) => e.type === 'zona_defendida');
    expect(d).toMatchObject({ retaken: 1, counts: { owls: 11, volt: 4 } });
  });

  it('localização simulada para a previsão; precisão ruim e salto não pintam', () => {
    const mocked = runAll([PATH[0], PATH[1], { ...PATH[2], mocked: true }, PATH[3]]);
    expect(mocked.summary.stopped).toBe(true);
    expect(mocked.summary.cellsPainted).toBeLessThanOrEqual(2);

    const noisy = runAll(PATH.map((p) => ({ ...p, accuracy: 80 })));
    expect(noisy.events).toEqual([]);
    expect(noisy.summary.current).toBeNull();

    const far = offset(PATH[1], 900, 0);
    const jump = runAll([PATH[0], PATH[1], { ...far, t: PATH[1].t + 500 }]);
    expect(jump.summary.meters).toBeLessThan(10);
    expect(jump.events.at(-1)).toMatchObject({ type: 'zona_entrou', zoneId: zoneOf(far) });
    const still = runAll([PATH[0], { ...PATH[0], t: PATH[0].t }]);
    expect(still.summary.meters).toBe(0);
    const sameInstant = runAll([PATH[0], { ...PATH[5], t: PATH[0].t }]);
    expect(sameInstant.summary).toMatchObject({ meters: 0, cellsPainted: 0 });
  });

  it('trecho com 0 camadas no retrato conta como vazio', () => {
    const snapshot: LiveSnapshot = { cells: { [PATH_IN_ZONE[0]]: { faction: 'volt', layers: 0 } }, zones: {} };
    const { events } = runAll(PATH, { snapshot });
    expect(events[0]).toMatchObject({ type: 'zona_entrou', counts: { volt: 0 } });
    expect(events.find((e) => e.type === 'trecho_pintado')).toMatchObject({ cell: PATH_IN_ZONE[0], kind: 'novo' });
  });

  it('trecho já pintado hoje e zona bloqueada não pintam', () => {
    const today = runAll(PATH, { paintedToday: new Set(PATH_CELLS) });
    expect(today.summary.cellsPainted).toBe(0);
    const blocked = runAll(PATH, { snapshot: { cells: {}, zones: { [ZONE]: { owner: null, blocked: true } } } });
    expect(blocked.events.some((e) => e.type === 'trecho_pintado' && e.zoneId === ZONE)).toBe(false);
  });
});

describe('previsão = oficial (mesma regra) e desempenho', () => {
  it('propriedade: as zonas conquistadas ao vivo são as que o servidor conquistaria', () => {
    forAll(
      (r) => {
        const pts: GeoPoint[] = [];
        let pos = ORIGIN;
        let t = 0;
        let bearing = r.float(0, 360);
        for (let i = 0; i < r.int(2, 400); i++) {
          pts.push({ ...pos, t, accuracy: r.bool(0.05) ? 60 : 5, steps: 3 });
          if (r.bool(0.05)) bearing = r.float(0, 360);
          pos = offset(pos, r.float(1.5, 4.5), bearing);
          t += 1000;
        }
        const faction = r.pick(FACTION_IDS);
        const all = [...new Set(paintCellsOfRun(pts, validateActivity(pts)).flatMap((c) => cellToChildren(paintZoneOf(c), PAINT_CELL_RES)))];
        const cells: Record<string, { faction: FactionId; layers: number }> = {};
        for (const c of all) if (r.bool(0.4)) cells[c] = { faction: r.pick(FACTION_IDS), layers: r.int(1, 3) };
        // Retrato coerente: o dono é o que a regra dá para o placar (o servidor monta assim, com refreshZoneOwner).
        const zones: Record<string, LiveSnapshot['zones'][string]> = {};
        for (const z of new Set(all.map(paintZoneOf))) {
          const counts = emptyPaintCounts();
          for (const [c, v] of Object.entries(cells)) if (paintZoneOf(c) === z) counts[v.faction]++;
          zones[z] = { owner: zoneOwnerByCells(counts, r.bool(0.4) ? null : r.pick(FACTION_IDS)) };
        }
        return { pts, faction, snapshot: { cells, zones } as LiveSnapshot };
      },
      ({ pts, faction, snapshot }) => {
        const tracker = createLiveTracker({ runId: 'p', faction, snapshot });
        for (const p of pts) tracker.push(p);
        const live = tracker.summary();

        const now = 1_800_000_000_000;
        const worldCells: Record<string, PaintCell> = {};
        for (const [cell, v] of Object.entries(snapshot.cells)) worldCells[cell] = { cell, zoneId: paintZoneOf(cell), ...v, paintedAt: now };
        const worldZones: Record<string, ZonePaint> = {};
        for (const [id, z] of Object.entries(snapshot.zones)) worldZones[id] = { ...newZonePaint(id), owner: z.owner };
        const cells = paintCellsOfRun(pts, validateActivity(pts));
        const official = applyPaint({ cells: worldCells, zones: worldZones }, { cells, faction, now });

        expect(live.cellsPainted).toBe(cells.length);
        expect([...live.conquered].sort()).toEqual(official.zones.filter((z) => z.outcome === 'conquistada').map((z) => z.zoneId).sort());
      },
      60,
    );
  });

  it('15 km a 1 Hz processados em menos de 200 ms', () => {
    const points = track({ kmh: 10, seconds: 5400, spm: 170 }); // 15 km, 5.401 pontos
    const pathCells = paintCellsOfRun(points, validateActivity(points));
    const cells: Record<string, { faction: FactionId; layers: number }> = {};
    pathCells.forEach((c, i) => {
      if (i % 3 === 0) cells[c] = { faction: 'volt', layers: 1 + (i % 2) };
    });
    const zones: Record<string, LiveSnapshot['zones'][string]> = {};
    for (const c of pathCells) zones[paintZoneOf(c)] = { owner: 'volt' };
    const snapshot: LiveSnapshot = { cells, zones };

    let best = Infinity;
    let summary = null as ReturnType<ReturnType<typeof createLiveTracker>['summary']> | null;
    for (let round = 0; round < 3; round++) {
      const started = performance.now();
      const tracker = createLiveTracker({ runId: 'perf', faction: 'owls', snapshot });
      for (const p of points) tracker.push(p);
      best = Math.min(best, performance.now() - started);
      summary = tracker.summary();
    }
    expect(summary!.meters).toBeGreaterThan(14_900);
    expect(summary!.cellsPainted).toBe(pathCells.length);
    expect(best).toBeLessThan(200);
  });
});
