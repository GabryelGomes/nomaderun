// RN-017 — abertura de baús no cálculo oficial (P-12/P-19): ponto de trecho válido a até 25 m, uma vez por baú,
// XP do domain (CHEST_XP) somado ao XP da corrida; nada abre em corrida rejeitada ou em revisão.
import assert from 'node:assert/strict';
import { CHEST_OPEN_RADIUS_M, CHEST_XP, cellCenter, offset, zoneOf } from '../_shared/domain.ts';
import { computeOfficialResult, type ChestCandidate, type ScoringInput, type StoredPoint } from '../_shared/scoring.ts';

const CENTER = cellCenter(zoneOf({ lat: -16.3, lng: -49.3 }));
const T0 = 1_760_000_000_000;
const R = 60;
const CIRC = 2 * Math.PI * R;

function loop(mockedAt = -1): StoredPoint[] {
  const n = Math.floor((2 * CIRC) / 3);
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = offset(CENTER, R, ((i * 3) / CIRC) * 360);
    return { seq: i, lat: p.lat, lng: p.lng, t: T0 + i * 1000, accuracy: 5, speed: 3, altitude: 750, mocked: i === mockedAt, steps: i === 0 ? 0 : 3 };
  });
}

const at = (id: string, meters: number, rarity: ChestCandidate['rarity'] = 'comum'): ChestCandidate => {
  const p = offset(CENTER, meters, 90);
  return { id, lat: p.lat, lng: p.lng, rarity };
};

const input = (over: Partial<ScoringInput> = {}): ScoringInput => ({
  mode: 'finish', activityId: '3f2b6c1e-8d4a-4b7e-9c2f-1a5e6d7c8b90', points: loop(), startedAt: T0, faction: 'striders',
  trust: 100, profileStatus: 'active', suspendedUntil: null, streakWeeks: 0, recentPaces: [], zones: [], earnedToday: {},
  revealedFog: [], ghostPace: null, now: T0 + 3_600_000, ...over,
});

Deno.test('baú a ~10 m do percurso abre; a 100 m não; o XP do domain entra no XP da corrida', () => {
  const base = computeOfficialResult(input());
  const r = computeOfficialResult(input({ chests: [at('perto', R + 10, 'raro'), at('longe', R + 100, 'lendario')] }));
  assert.ok(R + 10 - R <= CHEST_OPEN_RADIUS_M);
  assert.deepEqual(r.response.chests, [{ chestId: 'perto', rarity: 'raro', xp: CHEST_XP.raro }]);
  assert.deepEqual(r.chests, r.response.chests);
  assert.equal(r.response.xp, base.response.xp + 60);
  assert.equal(r.response.rpTotal, base.response.rpTotal, 'baú não mexe nos pontos de território');
});

Deno.test('baú dentro da volta (centro, a 60 m do percurso) não abre', () => {
  assert.deepEqual(computeOfficialResult(input({ chests: [at('centro', 0)] })).response.chests, []);
});

Deno.test('vários baús ao alcance abrem uma vez cada, com o XP de cada raridade', () => {
  const r = computeOfficialResult(input({ chests: [at('a', R + 5), at('b', R - 5, 'lendario'), at('c', R + 20, 'raro')] }));
  assert.deepEqual(r.response.chests.map((c) => c.chestId).sort(), ['a', 'b', 'c']);
  assert.equal(r.response.chests.reduce((s, c) => s + c.xp, 0), 20 + 150 + 60);
});

Deno.test('corrida rejeitada (localização simulada) ou em revisão não abre baú', () => {
  const rejected = computeOfficialResult(input({ points: loop(10), chests: [at('a', R + 5)] }));
  assert.equal(rejected.status, 'rejected');
  assert.deepEqual(rejected.response.chests, []);
  assert.deepEqual(rejected.chests, []);
  const review = computeOfficialResult(input({ trust: 30, chests: [at('a', R + 5)] }));
  assert.equal(review.status, 'review');
  assert.deepEqual(review.response.chests, []);
  assert.equal(review.response.xp, 0);
});

Deno.test('moderação aprova a corrida em revisão e aí o baú abre', () => {
  const r = computeOfficialResult(input({ mode: 'approve', trust: 30, chests: [at('a', R + 5)] }));
  assert.equal(r.status, 'valid');
  assert.equal(r.response.chests.length, 1);
});
