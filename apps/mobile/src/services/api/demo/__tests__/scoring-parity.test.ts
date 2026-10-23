/**
 * T7.1.18 (D-77): o `finish-activity` da demonstração calcula com o próprio `src/domain` o MESMO resultado
 * que o `computeOfficialResult` real das Edge Functions (`supabase/functions/_shared/scoring.ts`),
 * para as mesmas entradas (inclusive moderação, Fuga com fantasma e Caça com baús).
 */
import { describe, expect, it, jest } from '@jest/globals';

import { offset } from '@/domain/geo';
import type { Zone } from '@/domain/territory';
import { DEMO_CENTER, demoRoute, seedZones, zoneName } from '@/demo/demo-data';
import { demoRunPoints, type DemoPoint } from '@/demo/world';

import { computeDemoOfficial, type DemoScoringInput } from '../scoring';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@babel/runtime/helpers/interopRequireDefault', () => require('@jest/globals').jest.requireActual('@babel/runtime/helpers/interopRequireDefault'), { virtual: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@babel/runtime/helpers/asyncToGenerator', () => require('@jest/globals').jest.requireActual('@babel/runtime/helpers/asyncToGenerator'), { virtual: true });
jest.mock('../../../../../../../supabase/functions/_shared/http.ts', () => ({ HttpError: class HttpError extends Error {} }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const server = require('../../../../../../../supabase/functions/_shared/scoring.ts') as {
  computeOfficialResult: (input: Record<string, unknown>) => { response: Record<string, unknown>; status: string; trustAfter: number; fogCells: string[] };
};

const T0 = 1_761_220_800_000;
const NOW = T0 + 3 * 3600_000;
const ZONES = seedZones();
const NAMES = Object.fromEntries(Object.keys(ZONES).map((id) => [id, zoneName(id)]));

function input(points: DemoPoint[], over: Partial<DemoScoringInput> = {}): DemoScoringInput {
  return {
    mode: 'finish',
    activityId: 'a1',
    points,
    startedAt: T0,
    faction: 'striders',
    trust: 100,
    profileStatus: 'active',
    suspendedUntil: null,
    streakWeeks: 2,
    recentPaces: [330, 340, 320],
    zones: ZONES,
    zoneNames: NAMES,
    earnedToday: {},
    revealedFog: [],
    ghostPace: null,
    mission: 'livre',
    now: NOW,
    ...over,
  };
}

function compare(i: DemoScoringInput) {
  const official = server.computeOfficialResult({
    ...i,
    zones: Object.values(i.zones as Record<string, Zone>).map((z) => ({ ...z, name: i.zoneNames[z.id] ?? null, version: 1 })),
    chests: i.chests ?? [],
    crewTracks: [],
  });
  const demo = computeDemoOfficial(i);
  expect(demo.response).toEqual(official.response);
  expect(demo.status).toBe(official.status);
  expect(demo.trustAfter).toBe(official.trustAfter);
  expect(demo.fogCells).toEqual(official.fogCells);
  return demo.response;
}

const lake = (opts: { roundTrip?: boolean } = {}) => demoRunPoints(demoRoute(), T0, opts);

describe('finish-activity da demonstração = servidor real (mesmas entradas)', () => {
  it('volta no Flamboyant: válida, com zonas, neblina e XP', () => {
    const r = compare(input(lake({ roundTrip: true })));
    expect(r.status).toBe('valid');
    expect(r.rpTotal).toBeGreaterThan(0);
  });

  it('trecho de carro: parcial, com o trecho explicado', () => {
    const pts = lake().map((p, i) => (i >= 300 && i < 360 ? { ...p, t: T0 + 300_000 + (i - 300) * 250, steps: 0 } : i >= 360 ? { ...p, t: p.t - 45_000 } : p));
    const r = compare(input(pts));
    expect(r.invalidSegments.length).toBeGreaterThan(0);
  });

  it('localização simulada: rejeitada, confiança cai', () => {
    const pts = lake().slice(0, 200).map((p, i) => (i === 50 ? { ...p, mocked: true } : p));
    expect(compare(input(pts)).status).toBe('rejected');
  });

  it('confiança baixa: revisão; conta suspensa: revisão', () => {
    expect(compare(input(lake().slice(0, 400), { trust: 35 })).review?.reason).toBe('LOW_TRUST');
    expect(compare(input(lake().slice(0, 400), { profileStatus: 'suspended', suspendedUntil: NOW + 86_400_000 })).review?.reason).toBe('SUSPENDED');
  });

  it('aprovação da moderação e Fuga com fantasma', () => {
    expect(compare(input(lake().slice(0, 600), { mode: 'approve', trust: 20 })).status).toBe('valid');
    expect(compare(input(lake().slice(0, 600), { mission: 'fuga', ghostPace: 360 })).beatGhost).not.toBeNull();
    expect(compare(input(lake().slice(0, 600), { mission: 'livre', ghostPace: 360 })).beatGhost).toBeNull();
  });

  it('Caça: baú a até 25 m do percurso abre e soma XP', () => {
    const pts = lake().slice(0, 600);
    const near = offset(pts[100], 10, 0);
    const far = offset(DEMO_CENTER, 3000, 90);
    const r = compare(
      input(pts, {
        mission: 'caca',
        chests: [
          { id: 'perto', lat: near.lat, lng: near.lng, rarity: 'raro' },
          { id: 'longe', lat: far.lat, lng: far.lng, rarity: 'comum' },
        ],
      }),
    );
    expect((r as { chests: { chestId: string }[] }).chests.map((c) => c.chestId)).toEqual(['perto']);
  });
});
