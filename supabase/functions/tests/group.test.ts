// RN-001 — M_grupo no servidor (P-12): detecção (3+ membros da Crew a até 50 m em ≥ 60% do trecho) e aplicação
// do multiplicador 1,25 com as funções do domain.
import assert from 'node:assert/strict';
import { cellCenter, finishRun, offset, PACK_BONUS, scoreZone, startRun, zoneOf } from '../_shared/domain.ts';
import { type CrewTrack, detectPack, PACK_DISTANCE_M, positionAt } from '../_shared/group.ts';
import { computeOfficialResult, type ScoringInput, type StoredPoint, toGeoPoints } from '../_shared/scoring.ts';

const CENTER = cellCenter(zoneOf({ lat: -16.4, lng: -49.4 }));
const ZONE = zoneOf(CENTER);
const T0 = 1_760_000_000_000;
const R = 60;
const CIRC = 2 * Math.PI * R;

/** Volta de raio 60 m a 3 m/s em torno do centro; `shiftM` desloca o percurso inteiro para o norte. */
function loop(shiftM = 0, laps = 2): StoredPoint[] {
  const center = shiftM ? offset(CENTER, shiftM, 0) : CENTER;
  const n = Math.floor((laps * CIRC) / 3);
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = offset(center, R, ((i * 3) / CIRC) * 360);
    return { seq: i, lat: p.lat, lng: p.lng, t: T0 + i * 1000, accuracy: 5, speed: 3, altitude: 750, mocked: false, steps: i === 0 ? 0 : 3 };
  });
}

const track = (userId: string, pts: StoredPoint[], keep: (i: number) => boolean = () => true): CrewTrack => ({
  userId,
  points: pts.filter((_, i) => keep(i)).map((p) => [p.t, p.lat, p.lng] as [number, number, number]),
});

const input = (over: Partial<ScoringInput> = {}): ScoringInput => ({
  mode: 'finish', activityId: '3f2b6c1e-8d4a-4b7e-9c2f-1a5e6d7c8b90', points: loop(), startedAt: T0, faction: 'striders',
  trust: 100, profileStatus: 'active', suspendedUntil: null, streakWeeks: 0, recentPaces: [], zones: [], earnedToday: {},
  revealedFog: [], ghostPace: null, now: T0 + 3_600_000, ...over,
});

Deno.test('positionAt interpola entre dois pontos e recusa buracos maiores que 15 s', () => {
  const tr: CrewTrack = { userId: 'a', points: [[0, 0, 0], [10_000, 0, 0.001], [40_000, 0, 0.002]] };
  assert.deepEqual(positionAt(tr, 5_000), { lat: 0, lng: 0.0005 });
  assert.equal(positionAt(tr, 25_000), null);
  assert.equal(positionAt(tr, 100_000), null);
});

Deno.test('3 membros correndo juntos (a 10 m) → zona com M_grupo', () => {
  const pts = loop();
  const d = detectPack(toGeoPoints(pts), [track('b', loop(10)), track('c', loop(-10))]);
  assert.deepEqual(d.zones, [ZONE]);
  assert.deepEqual(d.members, ['b', 'c']);
});

Deno.test('só 2 membros (o corredor + 1) não formam grupo', () => {
  assert.deepEqual(detectPack(toGeoPoints(loop()), [track('b', loop(10))]).zones, []);
});

Deno.test('membros longe (200 m) ou fora do horário não contam', () => {
  assert.deepEqual(detectPack(toGeoPoints(loop()), [track('b', loop(200)), track('c', loop(-200))]).zones, []);
  const later = (s: number) => loop(s).map((p) => ({ ...p, t: p.t + 3_600_000 }));
  assert.deepEqual(detectPack(toGeoPoints(loop()), [track('b', later(10)), track('c', later(-10))]).zones, []);
});

Deno.test('os 3 precisam estar a até 50 m dois a dois (colegas a 45 m em lados opostos = 90 m entre eles)', () => {
  const d = detectPack(toGeoPoints(loop()), [track('b', loop(45)), track('c', loop(-45))]);
  assert.ok(45 <= PACK_DISTANCE_M);
  assert.deepEqual(d.zones, []);
});

Deno.test('grupo em menos de 60% do trecho da zona não ganha o multiplicador; em 70% ganha', () => {
  const pts = loop();
  const n = pts.length;
  const part = (share: number) => [track('b', loop(10), (i) => i < n * share), track('c', loop(-10), (i) => i < n * share)];
  assert.deepEqual(detectPack(toGeoPoints(pts), part(0.4)).zones, []);
  assert.deepEqual(detectPack(toGeoPoints(pts), part(0.7)).zones, [ZONE]);
});

Deno.test('cálculo oficial aplica 1,25 na zona em grupo e devolve group no resultado', () => {
  const solo = computeOfficialResult(input());
  const pack = computeOfficialResult(input({ crewTracks: [track('b', loop(10)), track('c', loop(-10))] }));
  const zSolo = solo.response.zones.find((z) => z.zoneId === ZONE)!;
  const zPack = pack.response.zones.find((z) => z.zoneId === ZONE)!;
  const expected = scoreZone({ meters: solo.activityZones.find((z) => z.zoneId === ZONE)!.meters, paceSecPerKm: solo.response.avgPace!,
    basePaceSecPerKm: 360, streakDays: 0, inPack: true }).rp;
  assert.equal(zPack.rp, expected);
  assert.ok(Math.abs(zPack.rp - zSolo.rp * PACK_BONUS) <= 1, `${zPack.rp} ≈ ${zSolo.rp} × 1,25`);
  assert.equal(pack.response.rpTotal, solo.response.rpTotal - zSolo.rp + zPack.rp);
  assert.deepEqual(pack.response.group, { zones: [ZONE], members: 2 });
  assert.equal(solo.response.group, null);
  const w = pack.zones.find((z) => z.id === ZONE)!;
  assert.ok(w.influence.striders > solo.zones.find((z) => z.id === ZONE)!.influence.striders, 'influência maior gravada na zona');
  assert.equal(pack.response.xp, solo.response.xp, 'M_grupo não muda o XP');
});

Deno.test('sem pontuação (revisão) o grupo não aparece', () => {
  const r = computeOfficialResult(input({ trust: 30, crewTracks: [track('b', loop(10)), track('c', loop(-10))] }));
  assert.equal(r.status, 'review');
  assert.equal(r.response.group, null);
});

Deno.test('lembrete: o finishRun do domain ainda não repassa M_grupo (quando repassar, troque applyPack pelo contexto)', () => {
  const pts = toGeoPoints(loop());
  const ctx = { faction: 'striders' as const, basePace: 360, streakDays: 0, zones: {}, revealedFog: new Set<string>(), now: T0 + 3_600_000 };
  const base = finishRun({ ...startRun(T0), points: pts }, ctx).rpTotal;
  // deno-lint-ignore no-explicit-any
  const withPack = finishRun({ ...startRun(T0), points: pts }, { ...ctx, packZones: new Set([ZONE]), inPack: true } as any).rpTotal;
  assert.equal(withPack, base, 'o domain passou a aplicar M_grupo: remova applyPack de _shared/scoring.ts para não aplicar duas vezes');
});

