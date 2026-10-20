import { describe, expect, it } from '@jest/globals';

import { zoneOf } from '../grid';
import { addPoint, averagePace, finishRun, livePace, startRun, type LiveRun } from '../run-engine';
import { newZone } from '../territory';
import type { GeoPoint } from '../types';
import { chain, ORIGIN, track } from './helpers';

const feed = (points: GeoPoint[]): LiveRun => points.reduce(addPoint, startRun(points[0].t));

describe('motor da corrida — ao vivo', () => {
  it('acumula distância e ritmo de uma corrida a 12 km/h (5:00 min/km)', () => {
    const run = feed(track({ kmh: 12, seconds: 300, spm: 172 }));
    expect(run.meters).toBeCloseTo(1000, -1);
    expect(averagePace(run)).toBeCloseTo(300, 0);
    expect(livePace(run)).toBeCloseTo(300, 0);
    expect(run.currentZone).toBe(zoneOf(run.points[run.points.length - 1]));
  });

  it('pausa automaticamente após 10 s parado', () => {
    const pts = chain(
      (start, t0) => track({ kmh: 12, seconds: 60, start, t0, spm: 172 }),
      (start, t0) => track({ kmh: 0.5, seconds: 20, start, t0, spm: 0 }),
    );
    const run = feed(pts);
    expect(run.autoPaused).toBe(true);
    expect(run.movingSeconds).toBeLessThan(75);
  });

  it('ignora saltos impossíveis nos números ao vivo', () => {
    const pts = track({ kmh: 12, seconds: 30, spm: 172 });
    pts.push({ lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng, t: pts[pts.length - 1].t + 1000, accuracy: 5, steps: 3 });
    const run = feed(pts);
    expect(run.meters).toBeLessThan(120);
  });
});

describe('motor da corrida — resultado final', () => {
  const ctx = {
    faction: 'striders' as const,
    basePace: 330,
    streakDays: 0,
    zones: {},
    revealedFog: new Set<string>(),
    now: 1_000_000,
  };

  it('uma corrida de 2 km gera RP, conquista zonas neutras e revela a Neblina', () => {
    const result = finishRun(feed(track({ kmh: 12, seconds: 600, spm: 172 })), ctx);
    expect(result.validation.status).toBe('valid');
    expect(result.rpTotal).toBeGreaterThan(0);
    expect(result.zones.some((z) => z.outcome === 'conquered')).toBe(true);
    expect(result.newFogCells.length).toBeGreaterThan(5);
    expect(result.xp).toBeGreaterThan(20);
  });

  it('aplica M_grupo (×1,25) só nas zonas detectadas em grupo (RN-001)', () => {
    const run = feed(track({ kmh: 12, seconds: 600, spm: 172 }));
    const plain = finishRun(run, ctx);
    const target = plain.zones[0];
    const pack = finishRun(run, { ...ctx, packZones: new Set([target.zoneId]) });
    const rpOf = (r: typeof plain, id: string) => r.zones.find((z) => z.zoneId === id)!.rp;
    expect(rpOf(pack, target.zoneId)).toBe(Math.round(target.rp * 1.25));
    for (const z of plain.zones.slice(1)) expect(rpOf(pack, z.zoneId)).toBe(z.rp);
  });

  it('localização simulada: zero pontos e zero XP', () => {
    const pts = track({ kmh: 12, seconds: 600, spm: 172 });
    pts[3] = { ...pts[3], mocked: true };
    const result = finishRun(feed(pts), ctx);
    expect(result.rpTotal).toBe(0);
    expect(result.xp).toBe(0);
    expect(result.zones).toEqual([]);
  });

  it('defender uma zona sob ataque encerra o ataque', () => {
    const zoneId = zoneOf(ORIGIN);
    const attacked = {
      ...newZone(zoneId),
      owner: 'striders' as const,
      influence: { striders: 300, coyotes: 130, owls: 0, volt: 0 },
      attackStartedAt: ctx.now - 1000,
      attacker: 'coyotes' as const,
    };
    const pts = track({ kmh: 10, seconds: 60, spm: 170, bearing: 0 });
    const result = finishRun(feed(pts), { ...ctx, zones: { [zoneId]: attacked } });
    const outcome = result.zones.find((z) => z.zoneId === zoneId);
    expect(outcome?.outcome).toBe('defended');
  });

  it('vence a Fuga ao terminar à frente de um fantasma mais lento', () => {
    const result = finishRun(feed(track({ kmh: 12, seconds: 300, spm: 172 })), { ...ctx, ghostPace: 360 });
    expect(result.beatGhost).toBe(true);
  });
});
