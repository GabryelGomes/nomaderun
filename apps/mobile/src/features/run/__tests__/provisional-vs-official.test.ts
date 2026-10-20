/**
 * UC-01 A1: o resumo provisório do aparelho usa o MESMO domain e as mesmas regras de status do
 * servidor. Aqui o cálculo do app é comparado com o `computeOfficialResult` real das Edge Functions
 * (supabase/functions/_shared/scoring.ts) para as mesmas entradas.
 */
import { describe, expect, it, jest } from '@jest/globals';

import { distanceMeters, offset } from '@/domain/geo';
import { basePace } from '@/domain/scoring';
import type { Zone } from '@/domain/territory';
import type { LatLng } from '@/domain/types';
import { demoRoute, seedZones, zoneName } from '@/demo/demo-data';
import type { QueuedPoint } from '@/services/offline/types';

import { provisionalSummary } from '../summary-model';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@babel/runtime/helpers/interopRequireDefault', () => require('@jest/globals').jest.requireActual('@babel/runtime/helpers/interopRequireDefault'), { virtual: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@babel/runtime/helpers/asyncToGenerator', () => require('@jest/globals').jest.requireActual('@babel/runtime/helpers/asyncToGenerator'), { virtual: true });
jest.mock('../../../../../../supabase/functions/_shared/http.ts', () => ({ HttpError: class HttpError extends Error {} }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const server = require('../../../../../../supabase/functions/_shared/scoring.ts') as {
  computeOfficialResult: (input: Record<string, unknown>) => { response: Record<string, unknown> };
};

const T0 = 1_760_000_000_000;
const NOW = T0 + 3 * 3600_000;

function route(stepM: number): LatLng[] {
  const r = demoRoute();
  const out: LatLng[] = [r[0]];
  let carry = 0;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1];
    const b = r[i];
    const seg = distanceMeters(a, b);
    if (!seg) continue;
    const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
    let d = stepM - carry;
    while (d <= seg) {
      out.push(offset(a, d, bearing));
      d += stepM;
    }
    carry = seg - (d - stepM);
  }
  return [...out, ...out.slice(0, -1).reverse()];
}

/** Pontos como a fila guarda: 1 por segundo a 3,2 m/s, com passos (ou sem pedômetro). */
function simulatedPoints(opts: { seconds: number; steps?: boolean; carFrom?: number; carTo?: number; mockedAt?: number }): QueuedPoint[] {
  const r = route(3.2);
  const out: QueuedPoint[] = [];
  let idx = 0;
  for (let s = 0; s < opts.seconds; s++) {
    const inCar = opts.carFrom !== undefined && s >= opts.carFrom && s < (opts.carTo ?? 0);
    idx = (idx + (inCar ? 3 : 1)) % r.length; // carro: ~34 km/h
    const p = r[idx];
    out.push({
      seq: s,
      lat: p.lat,
      lng: p.lng,
      t: T0 + s * 1000,
      accuracy: s % 97 === 0 ? 45 : 5, // alguns pontos com precisão ruim (descartados)
      speed: 3.2,
      altitude: 750,
      mocked: opts.mockedAt === s ? true : false,
      steps: opts.steps === false ? null : inCar ? 0 : s % 5 === 0 ? 2 : 3,
    });
  }
  return out;
}

function compare(points: QueuedPoint[], opts: { trust?: number; recentPaces?: number[]; streakWeeks?: number; zones?: Record<string, Zone> } = {}) {
  const zones = opts.zones ?? seedZones();
  const names: Record<string, string> = Object.fromEntries(Object.keys(zones).map((id) => [id, zoneName(id)]));
  const trust = opts.trust ?? 100;
  const recentPaces = opts.recentPaces ?? [330, 340, 320];
  const streakWeeks = opts.streakWeeks ?? 2;

  const official = server.computeOfficialResult({
    mode: 'finish',
    activityId: 'a1',
    points,
    startedAt: T0,
    faction: 'striders',
    trust,
    profileStatus: 'active',
    suspendedUntil: null,
    streakWeeks,
    recentPaces,
    zones: Object.values(zones).map((z) => ({ ...z, name: names[z.id], version: 1 })),
    earnedToday: {},
    revealedFog: [],
    ghostPace: null,
    now: NOW,
  }).response;

  const { summary } = provisionalSummary({
    points,
    startedAt: T0,
    trust,
    zoneNames: names,
    context: { faction: 'striders', basePace: basePace(recentPaces), streakDays: streakWeeks, zones, revealedFog: new Set(), now: NOW },
  });

  const { activityId: _id, ...rest } = official;
  const { source, ...mine } = summary;
  expect(source).toBe('provisional');
  expect(mine).toEqual(rest);
  return summary;
}

describe('resumo provisório = resultado oficial (mesmas entradas)', () => {
  it('volta simulada no Parque Flamboyant (válida, com zonas e neblina)', () => {
    const s = compare(simulatedPoints({ seconds: 900 }));
    expect(['valid', 'partial']).toContain(s.status);
    expect(s.zones.length).toBeGreaterThan(0);
    expect(s.rpTotal).toBeGreaterThan(0);
    expect(s.newFogCells).toBeGreaterThan(0);
  });

  it('trecho de carro: parcial, com o trecho explicado (E1)', () => {
    const s = compare(simulatedPoints({ seconds: 600, carFrom: 200, carTo: 280 }));
    expect(s.status).toBe('partial');
    expect(s.invalidSegments.some((g) => g.code === 'VEHICLE_SUSPECTED' || g.code === 'POINT_SPEED')).toBe(true);
  });

  it('localização simulada: rejeitada (E2)', () => {
    const s = compare(simulatedPoints({ seconds: 120, mockedAt: 50 }));
    expect(s.status).toBe('rejected');
    expect(s.rpTotal).toBe(0);
    expect(s.trust).toBe(70);
  });

  it('sem pedômetro e mais de 10 km: em revisão (RN-008)', () => {
    const s = compare(simulatedPoints({ seconds: 3400, steps: false }));
    expect(s.status).toBe('review');
    expect(s.review?.reason).toBe('NO_PEDOMETER_LONG_RUN');
  });

  it('Índice de Confiança abaixo de 40: em revisão (RN-009)', () => {
    const s = compare(simulatedPoints({ seconds: 300 }), { trust: 35 });
    expect(s.status).toBe('review');
    expect(s.review?.reason).toBe('LOW_TRUST');
  });
});
