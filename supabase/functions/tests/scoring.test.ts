// Cálculo oficial no servidor (RNF-006) usando o domain do app (D-02): status, trust (RN-009), revisão,
// trechos inválidos com explicação (RF-006) e o que é gravado nas zonas (RF-008, RF-020).
import assert from 'node:assert/strict';
import { cellCenter, finishRun, offset, startRun, zoneOf, type LatLng } from '../_shared/domain.ts';
import { HttpError } from '../_shared/http.ts';
import { computeOfficialResult, type DbZone, type ScoringInput, type StoredPoint, toGeoPoints, zoneLabel } from '../_shared/scoring.ts';

const CENTER = cellCenter(zoneOf({ lat: -16.5, lng: -49.5 }));
const ZONE = zoneOf(CENTER);
const T0 = 1_760_000_000_000;

/** Voltas de raio 60 m a 3 m/s (com passos), como no e2e: ~750 m dentro de uma única zona. */
function loop(opts: { laps?: number; steps?: boolean; mockedAt?: number; from?: LatLng } = {}): StoredPoint[] {
  const laps = opts.laps ?? 2;
  const circumference = 2 * Math.PI * 60;
  const n = Math.floor((laps * circumference) / 3);
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = offset(opts.from ?? CENTER, 60, ((i * 3) / circumference) * 360);
    return {
      seq: i, lat: p.lat, lng: p.lng, t: T0 + i * 1000, accuracy: 5, speed: 3, altitude: 750,
      mocked: opts.mockedAt === i ? true : false,
      steps: opts.steps === false ? null : i === 0 ? 0 : 3,
    };
  });
}

const input = (over: Partial<ScoringInput> = {}): ScoringInput => ({
  mode: 'finish',
  activityId: '3f2b6c1e-8d4a-4b7e-9c2f-1a5e6d7c8b90',
  points: loop(),
  startedAt: T0,
  faction: 'striders',
  trust: 100,
  profileStatus: 'active',
  suspendedUntil: null,
  streakWeeks: 0,
  recentPaces: [],
  zones: [],
  earnedToday: {},
  revealedFog: [],
  ghostPace: null,
  now: T0 + 3_600_000,
  ...over,
});

Deno.test('corrida válida conquista zona neutra nova e manda criar a geometria (RF-008, RF-020)', () => {
  const r = computeOfficialResult(input());
  assert.equal(r.status, 'valid');
  assert.equal(r.scored, true);
  const z = r.response.zones.find((x) => x.zoneId === ZONE)!;
  assert.equal(z.outcome, 'conquered');
  assert.equal(z.ownerAfter, 'striders');
  assert.equal(z.name, zoneLabel(ZONE, null));
  const w = r.zones.find((x) => x.id === ZONE)!;
  assert.equal(w.expectedVersion, null);
  const geom = JSON.parse(w.geom!);
  assert.equal(geom.type, 'Polygon');
  assert.equal(geom.coordinates[0].length, 7, 'hexágono fechado (6 vértices + o primeiro repetido)');
  assert.deepEqual(geom.coordinates[0][0], geom.coordinates[0][6]);
  assert.ok(r.events.some((e) => e.type === 'captured' && e.zoneId === ZONE));
  assert.ok(r.fogCells.length > 0 && r.response.newFogCells === r.fogCells.length);
  assert.equal(r.response.trust, 100);
  assert.equal(r.response.review, null);
});

Deno.test('resultado oficial = finishRun do domain (provisório no app e oficial no servidor batem)', () => {
  const points = loop();
  const r = computeOfficialResult(input({ points, recentPaces: [300, 320, 340], streakWeeks: 4 }));
  const local = finishRun({ ...startRun(T0), points: toGeoPoints(points) }, {
    faction: 'striders', basePace: 320, streakDays: 4, zones: {}, revealedFog: new Set(), now: T0 + 3_600_000,
  });
  assert.equal(r.response.rpTotal, local.rpTotal);
  assert.equal(r.response.xp, local.xp);
  assert.equal(r.response.meters, Math.round(local.meters));
});

Deno.test('zona existente: confere a versão lida (concorrência otimista, D-23) e respeita o dono', () => {
  const existing: DbZone = {
    id: ZONE, name: 'Parque Teste', influence: { striders: 0, coyotes: 1000, owls: 0, volt: 0 }, owner: 'coyotes',
    shield: 0, attacker: null, attackStartedAt: null, blocked: false, version: 5,
  };
  const r = computeOfficialResult(input({ zones: [existing] }));
  const w = r.zones.find((x) => x.id === ZONE)!;
  assert.equal(w.expectedVersion, 5);
  assert.equal(w.geom, undefined);
  assert.equal(w.owner, 'coyotes');
  assert.equal(r.response.zones.find((x) => x.zoneId === ZONE)!.name, 'Parque Teste');
});

Deno.test('localização simulada: corrida rejeitada, trecho inteiro explicado e trust −30 (RN-007 e, RN-009)', () => {
  const points = loop({ mockedAt: 10 });
  const r = computeOfficialResult(input({ points }));
  assert.equal(r.status, 'rejected');
  assert.equal(r.scored, false);
  assert.equal(r.response.rpTotal, 0);
  assert.deepEqual(r.response.zones, []);
  assert.equal(r.response.trust, 70);
  assert.deepEqual(r.response.invalidSegments, [{
    fromSeq: 0, toSeq: points.length - 1, code: 'MOCK_LOCATION', reason: 'Localização simulada detectada. A corrida não gera pontos.',
  }]);
});

Deno.test('trecho de veículo: corrida parcial, segmento agrupado com explicação (RF-006)', () => {
  const points = loop({ laps: 3 });
  // 40 s a 12 m/s (43 km/h) no meio da corrida
  for (let i = 100; i < points.length; i++) {
    const extra = Math.min(i - 100, 40) * 9;
    const p = offset({ lat: points[i].lat, lng: points[i].lng }, extra, 90);
    points[i] = { ...points[i], lat: p.lat, lng: p.lng };
  }
  const r = computeOfficialResult(input({ points }));
  assert.equal(r.status, 'partial');
  assert.ok(r.response.invalidSegments.length >= 1);
  const seg = r.response.invalidSegments[0];
  assert.ok(seg.fromSeq >= 99 && seg.toSeq <= 141, JSON.stringify(seg));
  assert.match(seg.reason, /km\/h|veículo/);
  const penalized = r.response.flags.filter((f) => ['TELEPORT', 'POINT_SPEED', 'VEHICLE_SUSPECTED', 'NO_STEPS'].includes(f));
  assert.ok(penalized.length >= 1);
  assert.equal(r.response.trust, 100 - 10 * penalized.length, 'uma penalidade de 10 pontos por tipo de alerta');
});

Deno.test('trust abaixo de 40 manda para revisão e não pontua (RN-009)', () => {
  const r = computeOfficialResult(input({ trust: 39 }));
  assert.equal(r.status, 'review');
  assert.equal(r.scored, false);
  assert.equal(r.reviewReason, 'LOW_TRUST');
  assert.equal(r.response.rpTotal, 0);
  assert.equal(r.response.trust, 41, 'corrida limpa ainda recupera +2 (a próxima já não vai para revisão)');
  assert.match(r.response.review!.message, /revisão manual/);
});

Deno.test('trust abaixo de 10 suspende o corredor', () => {
  const r = computeOfficialResult(input({ trust: 15, points: loop({ mockedAt: 3 }) }));
  assert.equal(r.status, 'rejected');
  assert.equal(r.suspend, true);
  assert.equal(r.response.trust, 0);
});

Deno.test('conta suspensa: corrida fica em revisão', () => {
  const r = computeOfficialResult(input({ profileStatus: 'suspended', suspendedUntil: T0 + 30 * 86_400_000 }));
  assert.equal(r.status, 'review');
  assert.equal(r.reviewReason, 'SUSPENDED');
});

Deno.test('sem pedômetro: alerta NO_PEDOMETER e, acima de 10 km, revisão (RN-008)', () => {
  const short = computeOfficialResult(input({ points: loop({ steps: false }) }));
  assert.ok(short.response.flags.includes('NO_PEDOMETER'));
  assert.equal(short.status, 'valid');
  const long = computeOfficialResult(input({ points: loop({ steps: false, laps: 28 }) }));
  assert.equal(long.status, 'review');
  assert.equal(long.reviewReason, 'NO_PEDOMETER_LONG_RUN');
});

Deno.test('moderação: aprovar ignora o trust e pontua; corrida simulada não pode ser aprovada (RF-018)', () => {
  const ok = computeOfficialResult(input({ mode: 'approve', trust: 20 }));
  assert.equal(ok.status, 'valid');
  assert.equal(ok.scored, true);
  assert.equal(ok.trustAfter, 20, 'aprovação não mexe no trust');
  assert.throws(() => computeOfficialResult(input({ mode: 'approve', points: loop({ mockedAt: 1 }) })),
    (e: unknown) => e instanceof HttpError && e.code === 'CANNOT_APPROVE');
});

Deno.test('rótulo de zona sem nome', () => {
  assert.equal(zoneLabel('89a8c0ce2c3ffff', null), 'Zona E2C3');
  assert.equal(zoneLabel('89a8c0ce2c3ffff', 'Parque Flamboyant'), 'Parque Flamboyant');
});
