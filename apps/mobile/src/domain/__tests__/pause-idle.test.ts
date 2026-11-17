/**
 * Defeitos dos testes externos (bateria 3, grupo de Paulo e João; DF09 do grupo de Lucas): a distância andada
 * durante a pausa e o tempo parado entravam na corrida. A pausa manual não grava pontos, então aparece como um
 * trecho com intervalo longo; parado sem pausar, os pontos ficam no mesmo lugar.
 */
import '../h3-runtime';

import { describe, expect, it } from '@jest/globals';

import { MAX_STEP_GAP_SECONDS, validateActivity } from '../anti-cheat';
import { offset } from '../geo';
import { addPoint, finishRunV2, startRun, type LiveRun } from '../run-engine';
import * as t from '../territory';
import type { GeoPoint } from '../types';
import { ORIGIN, track } from './helpers';

const ctx = { faction: 'striders' as const, basePace: 360, zones: {}, revealedFog: new Set<string>(), now: 0 };

/** 100 m a 12 km/h (30 s), a partir de `start` e `t0` (ms), 1 ponto por segundo, com pedômetro. */
const leg = (start: { lat: number; lng: number }, t0: number) => track({ kmh: 12, seconds: 30, start, t0, spm: 170 });

const live = (points: GeoPoint[]): LiveRun => points.reduce(addPoint, startRun(0));

describe('pausa manual: o trecho andado durante a pausa não conta', () => {
  // corre 100 m, pausa 70 s andando 100 m (sem gravar), retoma e corre mais 100 m
  const a = leg(ORIGIN, 0);
  const end = a[a.length - 1];
  const resumeAt = offset(end, 100, 90);
  const b = leg(resumeAt, end.t + 70_000);
  const points = [...a, ...b];

  it('o resultado oficial fica com 200 m e 60 s, sem o trecho da pausa', () => {
    const r = finishRunV2({ ...startRun(0), points }, ctx);
    expect(r.meters).toBeGreaterThan(195);
    expect(r.meters).toBeLessThan(205);
    expect(r.movingSeconds).toBe(60);
    expect(r.avgPace).toBeGreaterThan(290);
    expect(r.avgPace).toBeLessThan(310);
  });

  it('o trecho da pausa não vira fraude: sem alerta e com status válido', () => {
    const v = validateActivity(points);
    expect(v.flags).not.toContain('POINT_SPEED');
    expect(v.status).toBe('valid');
    expect(v.invalidMeters).toBe(0);
    expect(v.steps.filter((s) => s.idle)).toHaveLength(1);
  });

  it('a corrida ao vivo mostra os mesmos números do oficial', () => {
    const run = live(points);
    expect(Math.round(run.meters)).toBe(Math.round(finishRunV2({ ...startRun(0), points }, ctx).meters));
    expect(run.movingSeconds).toBe(60);
  });
});

describe('parado sem pausar: o tempo parado não entra no tempo em movimento', () => {
  // corre 100 m, fica 20 s parado no mesmo lugar e corre mais 100 m
  const a = leg(ORIGIN, 0);
  const end = a[a.length - 1];
  const stopped: GeoPoint[] = Array.from({ length: 20 }, (_, i) => ({ lat: end.lat, lng: end.lng, t: end.t + (i + 1) * 1000, accuracy: 5, steps: 0 }));
  const b = leg(end, end.t + 20_000).slice(1);
  const points = [...a, ...stopped, ...b];

  it('oficial: cerca de 1:00 em movimento e ritmo de 5:00', () => {
    const r = finishRunV2({ ...startRun(0), points }, ctx);
    expect(r.movingSeconds).toBe(60);
    expect(r.avgPace).toBeGreaterThan(290);
    expect(r.avgPace).toBeLessThan(310);
  });

  it('ao vivo: o mesmo tempo em movimento', () => {
    expect(live(points).movingSeconds).toBe(60);
  });
});

describe('limite do intervalo entre pontos', () => {
  it(`até ${MAX_STEP_GAP_SECONDS} s entre pontos ainda conta (GPS mais lento)`, () => {
    const points = track({ kmh: 10, seconds: 300, stepSeconds: MAX_STEP_GAP_SECONDS, spm: 165 });
    const v = validateActivity(points);
    expect(v.steps.every((s) => s.valid)).toBe(true);
  });

  it('acima do limite, o trecho fica de fora sem penalizar', () => {
    const points = track({ kmh: 10, seconds: 300, stepSeconds: MAX_STEP_GAP_SECONDS + 5, spm: 165 });
    const v = validateActivity(points);
    expect(v.validMeters).toBe(0);
    expect(v.flags.filter((f) => f !== 'NO_PEDOMETER')).toEqual([]);
  });
});

describe('RN-002: a desafiante com exatamente 110% do dono conquista (teste externo, bateria 3)', () => {
  const zoneWith = (owner: number, rival: number) => ({
    ...t.newZone('8ba8a5a0a0dffff'),
    owner: 'coyotes' as const,
    influence: { ...t.emptyInfluence(), coyotes: owner, striders: rival },
  });

  it.each([
    [100, 110],
    [50, 55],
    [200, 220],
  ])('dono %p e rival com 110%% (%p): a zona muda de dono (v1 e v2)', (owner, rival) => {
    for (const apply of [t.applyRunPoints, t.applyRunPointsV2]) {
      const { zone } = apply(zoneWith(owner, rival - 1), 'striders', 1, 0);
      expect(zone.owner).toBe('striders');
    }
  });

  it('abaixo de 110% a zona continua com o dono', () => {
    expect(t.reachesTakeover(109.99, 100)).toBe(false);
    expect(t.applyRunPointsV2(zoneWith(100, 108), 'striders', 1, 0).zone.owner).toBe('coyotes');
  });
});
