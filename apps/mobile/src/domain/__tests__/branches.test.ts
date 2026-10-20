/**
 * T4.1 — ramos do domain que os testes de regra não exercitavam (P-01): formatação, casos-limite do
 * antifraude, auto-pausa, zonas bloqueadas, h3-runtime e suavização das regiões.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules precisa de require() para recarregar o módulo */
import { describe, expect, it, jest } from '@jest/globals';

import { validateActivity } from '../anti-cheat';
import { closeWeek, ghostGap, ghostStatus, leagueOutcome, levelFromXp } from '../games';
import { distanceMeters, formatDuration, formatKm, formatPace, offset, paceSecPerKm } from '../geo';
import { cellBoundary, cellCenter, zoneOf } from '../grid';
import { chaikin, relax, smoothCells, territoryRegions } from '../regions';
import { addPoint, averagePace, finishRun, livePace, startRun, AUTO_PAUSE_SECONDS } from '../run-engine';
import { DEFAULT_BASE_PACE, effortMultiplier, EFFORT_MIN } from '../scoring';
import { applyRunPoints, CAPTURE_THRESHOLD, effectiveRp, emptyInfluence, fortifyZone, newZone, resolveZone, type Zone } from '../territory';
import { applyTrust } from '../trust';
import type { GeoPoint } from '../types';
import { ORIGIN, track } from './helpers';

describe('geo — formatação pt-BR', () => {
  it('formatPace: indefinido, zero, negativo e arredondamento', () => {
    expect(formatPace(Infinity)).toBe('--:--');
    expect(formatPace(NaN)).toBe('--:--');
    expect(formatPace(0)).toBe('--:--');
    expect(formatPace(-30)).toBe('--:--');
    expect(formatPace(330)).toBe('5:30');
    expect(formatPace(359.6)).toBe('6:00');
    expect(formatPace(65)).toBe('1:05');
  });

  it('formatDuration: m:ss, h:mm:ss e negativos', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(59.9)).toBe('0:59');
    expect(formatDuration(605)).toBe('10:05');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('formatKm usa vírgula e casas decimais', () => {
    expect(formatKm(5620)).toBe('5,62');
    expect(formatKm(5620, 1)).toBe('5,6');
    expect(formatKm(0)).toBe('0,00');
  });

  it('paceSecPerKm sem distância é infinito; offset e distância são coerentes', () => {
    expect(paceSecPerKm(0, 100)).toBe(Infinity);
    expect(paceSecPerKm(-1, 100)).toBe(Infinity);
    expect(distanceMeters(ORIGIN, offset(ORIGIN, 1000, 45))).toBeCloseTo(1000, 3);
  });
});

describe('grid — contorno da célula', () => {
  it('cellBoundary devolve o hexágono aberto em volta do centro', () => {
    const cell = zoneOf(ORIGIN);
    const ring = cellBoundary(cell);
    expect(ring).toHaveLength(6);
    const c = cellCenter(cell);
    for (const p of ring) expect(distanceMeters(c, p)).toBeLessThan(250);
  });
});

describe('h3-runtime — TextDecoder UTF-16LE', () => {
  const g = globalThis as unknown as { TextDecoder?: unknown };

  it('com decoder sem UTF-16, instala o substituto (UTF-16 decodificado; outros rótulos vão para o original)', () => {
    const saved = g.TextDecoder;
    class Utf8Only {
      readonly label: string;
      constructor(label = 'utf-8') {
        if (/16/.test(label)) throw new RangeError('unsupported');
        this.label = label;
      }
      decode() {
        return `orig:${this.label}`;
      }
    }
    g.TextDecoder = Utf8Only;
    try {
      jest.isolateModules(() => {
        require('../h3-runtime');
      });
      const Ctor = g.TextDecoder as new (label?: string) => { decode(i?: ArrayBufferView | ArrayBuffer): string };
      const d = new Ctor('UTF-16LE ');
      const bytes = new Uint8Array([0x4f, 0x00, 0x69, 0x00, 0x21]); // "Oi" + byte solto
      expect(d.decode(bytes)).toBe('Oi');
      expect(d.decode(bytes.buffer)).toBe('Oi');
      expect(d.decode(new DataView(bytes.buffer, 2, 2))).toBe('i');
      expect(d.decode()).toBe('');
      expect(new Ctor('utf16').decode()).toBe('');
      expect(new Ctor('utf-8').decode()).toBe('orig:utf-8');
      expect(new Ctor().decode()).toBe('orig:utf-8');
    } finally {
      g.TextDecoder = saved;
    }
  });

  it('com decoder que já suporta UTF-16 (ou sem decoder), não mexe em nada', () => {
    const saved = g.TextDecoder;
    class Full {
      decode() {
        return 'full';
      }
    }
    try {
      g.TextDecoder = Full;
      jest.isolateModules(() => {
        require('../h3-runtime');
      });
      expect(g.TextDecoder).toBe(Full);
      g.TextDecoder = undefined;
      jest.isolateModules(() => {
        require('../h3-runtime');
      });
      expect(g.TextDecoder).toBeUndefined();
    } finally {
      g.TextDecoder = saved;
    }
  });
});

describe('regions — suavização', () => {
  const square = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 1, lng: 1 },
    { lat: 1, lng: 0 },
  ];

  it('chaikin e relax com iterações padrão', () => {
    expect(chaikin(square)).toHaveLength(16);
    expect(relax(square)).toHaveLength(4);
    expect(chaikin(square, 0)).toBe(square);
  });

  it('smoothCells: lista vazia e conjunto de células', () => {
    expect(smoothCells([])).toEqual([]);
    const cell = zoneOf(ORIGIN);
    const polys = smoothCells([cell]);
    expect(polys).toHaveLength(1);
    expect(polys[0][0].length).toBeGreaterThan(6);
    expect(territoryRegions([{ id: cell, owner: null }])).toEqual([]);
  });

  it('smoothCells abre anéis fechados e aceita anéis já abertos (h3-js mockado)', () => {
    jest.isolateModules(() => {
      jest.doMock('h3-js', () => ({
        cellsToMultiPolygon: () => [
          [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [0, 0],
            ],
            [
              [5, 5],
              [5, 6],
              [6, 6],
            ],
            [[9, 9]],
          ],
        ],
      }));
      const mod = require('../regions') as typeof import('../regions');
      const [poly] = mod.smoothCells(['x'], 0);
      expect(poly[0]).toHaveLength(3); // fechado → aberto
      expect(poly[1]).toHaveLength(3); // já aberto → igual
      expect(poly[2]).toHaveLength(1); // anel de 1 ponto
      jest.dontMock('h3-js');
    });
  });
});

describe('anti-cheat — casos-limite', () => {
  const base = (over: Partial<GeoPoint>[]): GeoPoint[] =>
    over.map((o, i) => ({ ...offset(ORIGIN, i * 3, 90), t: i * 1000, accuracy: 5, steps: 3, ...o }));

  it('timestamps repetidos: parado conta 0 km/h; movido conta como velocidade infinita', () => {
    const still = validateActivity([
      { ...ORIGIN, t: 0, steps: 0 },
      { ...ORIGIN, t: 0, steps: 0 },
    ]);
    expect(still.steps[0].kmh).toBe(0);
    expect(still.steps[0].valid).toBe(true);
    const moved = validateActivity(base([{ t: 0 }, { t: 0 }]));
    expect(moved.steps[0].kmh).toBe(Infinity);
    expect(moved.steps[0].reason).toBe('POINT_SPEED');
  });

  it('timestamp fora de ordem vira 0 s e não vale', () => {
    const v = validateActivity(base([{ t: 5000 }, { t: 1000 }]));
    expect(v.steps[0].seconds).toBe(0);
    expect(v.steps[0].valid).toBe(false);
  });

  it('veículo sustentado não sobrescreve um motivo já marcado (POINT_SPEED preservado)', () => {
    // 30 km/h por 40 s com um trecho de 60 km/h no meio.
    const pts: GeoPoint[] = [];
    let pos = ORIGIN;
    for (let i = 0; i <= 40; i++) {
      pts.push({ ...pos, t: i * 1000, accuracy: 5 });
      pos = offset(pos, i === 20 ? 60 / 3.6 : 30 / 3.6, 90);
    }
    const v = validateActivity(pts);
    expect(v.steps[20].reason).toBe('POINT_SPEED');
    expect(v.steps.filter((s) => s.reason === 'VEHICLE_SUSPECTED')).toHaveLength(39);
    expect(v.flags).toEqual(expect.arrayContaining(['POINT_SPEED', 'VEHICLE_SUSPECTED', 'NO_PEDOMETER']));
  });

  it('pedômetro presente mas sem passos num ponto conta como 0 passos (NO_STEPS)', () => {
    const pts = track({ kmh: 12, seconds: 90, spm: 170 }).map((p, i) => (i > 0 ? { ...p, steps: i === 1 ? 3 : undefined } : p));
    const v = validateActivity(pts);
    expect(v.flags).toContain('NO_STEPS');
    expect(v.flags).not.toContain('NO_PEDOMETER');
  });

  it('corrida curta sem pedômetro é válida e só recebe a marca NO_PEDOMETER', () => {
    const v = validateActivity(track({ kmh: 10, seconds: 60 }));
    expect(v.status).toBe('valid');
    expect(v.flags).toEqual(['NO_PEDOMETER']);
  });

  it('trust: NO_PEDOMETER não penaliza', () => {
    expect(applyTrust(80, ['NO_PEDOMETER'], true)).toBe(82);
  });
});

describe('run-engine — auto-pausa, zona bloqueada e pace', () => {
  it('auto-pausa após 10 s parado e volta ao andar', () => {
    let run = startRun(0);
    run = addPoint(run, { ...ORIGIN, t: 0 });
    for (let s = 1; s <= AUTO_PAUSE_SECONDS; s++) run = addPoint(run, { ...ORIGIN, t: s * 1000 });
    expect(run.autoPaused).toBe(true);
    const before = run.meters;
    run = addPoint(run, { ...offset(ORIGIN, 3, 90), t: (AUTO_PAUSE_SECONDS + 1) * 1000 });
    expect(run.autoPaused).toBe(false);
    expect(run.meters).toBeGreaterThan(before);
    expect(livePace(run)).toBeGreaterThan(0);
    expect(averagePace(run)).toBeGreaterThan(0);
  });

  it('salto implausível não soma metros ao vivo; repetido no mesmo instante também não', () => {
    let run = startRun(0);
    run = addPoint(run, { ...ORIGIN, t: 0 });
    run = addPoint(run, { ...offset(ORIGIN, 400, 90), t: 1000 });
    expect(run.meters).toBe(0);
    run = addPoint(run, { ...offset(ORIGIN, 460, 90), t: 1000 });
    expect(run.meters).toBe(0);
    expect(livePace(startRun(0))).toBe(Infinity);
  });

  it('finishRun ignora zona bloqueada e marca "none" quando o teto do dia já foi atingido', () => {
    let run = startRun(0);
    for (const p of track({ kmh: 10, seconds: 120, spm: 170 })) run = addPoint(run, p);
    const zoneId = zoneOf(ORIGIN);
    const blocked = finishRun(run, { faction: 'owls', basePace: 360, streakDays: 0, zones: { [zoneId]: newZone(zoneId, true) }, revealedFog: new Set(), now: 0 });
    expect(blocked.zones.find((z) => z.zoneId === zoneId)).toBeUndefined();
    expect(blocked.updatedZones[zoneId]).toBeUndefined();

    const capped = finishRun(run, { faction: 'owls', basePace: 360, streakDays: 0, zones: {}, revealedFog: new Set(), now: 0, earnedTodayByZone: new Proxy({}, { get: () => 300 }) as Record<string, number> });
    expect(capped.rpTotal).toBe(0);
    expect(capped.zones.every((z) => z.outcome === 'none')).toBe(true);
  });

  it('finishRun marca "defended" quando a corrida do dono encerra o ataque', () => {
    let run = startRun(0);
    for (const p of track({ kmh: 10, seconds: 200, spm: 170 })) run = addPoint(run, p);
    const zoneId = zoneOf(ORIGIN);
    const zone: Zone = { ...newZone(zoneId), owner: 'owls', attackStartedAt: 0, attacker: 'volt', influence: { ...emptyInfluence(), owls: 100, volt: 45 } };
    const res = finishRun(run, { faction: 'owls', basePace: 360, streakDays: 0, zones: { [zoneId]: zone }, revealedFog: new Set(), now: 1000 });
    expect(res.zones.find((z) => z.zoneId === zoneId)?.outcome).toBe('defended');
  });
});

describe('scoring / territory / games — ramos restantes', () => {
  it('effortMultiplier: pace inválido → mínimo; base inválida → base padrão', () => {
    expect(effortMultiplier(360, 0)).toBe(EFFORT_MIN);
    expect(effortMultiplier(360, NaN)).toBe(EFFORT_MIN);
    expect(effortMultiplier(0, DEFAULT_BASE_PACE)).toBe(1);
    expect(effortMultiplier(-5, DEFAULT_BASE_PACE)).toBe(1);
  });

  it('effectiveRp: escudo acima de 3 usa a redução máxima; dono não sofre redução', () => {
    const z: Zone = { ...newZone('z'), owner: 'owls', shield: 9 };
    expect(effectiveRp(z, 'volt', 100)).toBeCloseTo(70);
    expect(effectiveRp(z, 'owls', 100)).toBe(100);
  });

  it('resolveZone: zona bloqueada perde dono e ataque; dono com 0 e rival > 0 entra em ataque', () => {
    const blocked = resolveZone({ ...newZone('z', true), owner: 'owls', attackStartedAt: 1, attacker: 'volt' }, 0);
    expect(blocked.zone).toMatchObject({ owner: null, attackStartedAt: null, attacker: null });
    const zero = resolveZone({ ...newZone('z'), owner: 'owls', influence: { ...emptyInfluence(), volt: 10 } }, 5);
    expect(zero.zone.attacker).toBe('volt');
    const none = resolveZone({ ...newZone('z'), owner: 'owls' }, 5);
    expect(none.events).toEqual([]);
  });

  it('fortifyZone: sem dono não muda; corrida curta do dono mantém o escudo', () => {
    const neutral = newZone('z');
    expect(fortifyZone(neutral, 1000)).toBe(neutral);
    expect(fortifyZone({ ...neutral, owner: 'owls', shield: 2 }, 100).shield).toBe(2);
  });

  it('applyRunPoints: dono que já domina sem rival não gera evento', () => {
    const z: Zone = { ...newZone('z'), owner: 'owls', influence: { ...emptyInfluence(), owls: CAPTURE_THRESHOLD } };
    expect(applyRunPoints(z, 'owls', 10, 0).events).toEqual([]);
  });

  it('games: fantasma com pace inválido, liga nas pontas, semana e nível', () => {
    expect(ghostGap(500, 100, 0)).toBe(500);
    expect(ghostStatus(-6)).toBe('caught');
    expect(leagueOutcome(1, 30, 4)).toBe('stays');
    expect(leagueOutcome(30, 30, 0)).toBe('stays');
    expect(closeWeek({ weeks: 3, freezesLeft: 0 }, 1)).toEqual({ weeks: 0, freezesLeft: 0, usedFreeze: false });
    expect(levelFromXp(-10).level).toBe(1);
  });
});
