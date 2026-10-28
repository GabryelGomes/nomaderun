// T7.3.8 — weekly-recap: entrada validada, resposta por lista branca (sem ids, sem zonas de privacidade, sem horário),
// rotas cortadas pelo domain com semente nova e conferidas (propriedade com 300 casos).
import assert from 'node:assert/strict';
import { distanceMeters, type LatLng, offset, type PrivacyCircle } from '../_shared/domain.ts';
import { decodePolyline, routeIsSafe } from '../_shared/feed.ts';
import { HttpError } from '../_shared/http.ts';
import { parseRecapInput, RECAP_MAX_ROUTES, recapResponse, recapRoute, type SvcWeeklyRecap } from '../_shared/recap.ts';
import type { StoredPoint } from '../_shared/scoring.ts';

const ORIGIN: LatLng = { lat: -16.6869, lng: -49.2648 };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Corrida plausível: 1 ponto por segundo a ~10 km/h, com passos, curvando aos poucos. */
function run(r: () => number, n: number, from = ORIGIN): StoredPoint[] {
  const out: StoredPoint[] = [];
  let pos = from;
  let bearing = r() * 360;
  const t0 = Date.UTC(2026, 9, 26, 9, 0, 0);
  for (let i = 0; i < n; i++) {
    out.push({ seq: i, lat: pos.lat, lng: pos.lng, t: t0 + i * 1000, accuracy: 5, speed: 2.8, altitude: 800, mocked: false, steps: i ? 3 : 0 });
    bearing += (r() - 0.5) * 12;
    pos = offset(pos, 2.78, bearing);
  }
  return out;
}

const SVC: SvcWeeklyRecap = {
  weekStart: '2026-10-26', weekEnd: '2026-11-01', final: false, days: [5000, 1000, 3200, 0, 600, 0, 0], meters: 9800, runs: 4,
  movingSeconds: 3500, zones: 2, streakWeeks: 4, isDemo: false,
  routeIds: ['e9e9e9e9-1026-4000-8000-000000000001'], privacyZones: [{ lat: -16.68, lng: -49.25, radiusM: 200 }],
};

Deno.test('weekly-recap: entrada', () => {
  assert.deepEqual(parseRecapInput(null), { weekStart: null });
  assert.deepEqual(parseRecapInput({}), { weekStart: null });
  assert.deepEqual(parseRecapInput({ weekStart: null }), { weekStart: null });
  assert.deepEqual(parseRecapInput({ weekStart: '2026-10-26' }), { weekStart: '2026-10-26' });
  for (const bad of [[], 'x', 5, { weekStart: '26/10/2026' }, { weekStart: '2026-02-31' }, { weekStart: 20261026 },
                     { weekStart: '2026-10-26', userId: 'outra-pessoa' }, { weekStart: "2026-10-26'; drop table x; --" }]) {
    assert.throws(() => parseRecapInput(bad), (e) => e instanceof HttpError && e.status === 400 && e.code === 'VALIDATION', JSON.stringify(bad));
  }
});

Deno.test('weekly-recap: resposta por lista branca (sem ids, zonas de privacidade nem horário)', () => {
  const extra = { ...SVC, startedAt: '2026-10-26T09:00:00Z', userId: 'x' } as SvcWeeklyRecap;
  const r1 = { pieces: ['abc'], routeHidden: true };
  const out = recapResponse(extra, [r1, null, r1, r1, r1]);
  assert.deepEqual(Object.keys(out).sort(),
    ['days', 'final', 'isDemo', 'meters', 'movingSeconds', 'routes', 'runs', 'streakWeeks', 'weekEnd', 'weekStart', 'zones']);
  assert.equal(out.routes.length, RECAP_MAX_ROUTES, 'no máximo 3 rotas; as nulas saem');
  assert.deepEqual(out.days, SVC.days);
  const text = JSON.stringify(out);
  assert.ok(!/routeIds|privacyZones|radiusM|startedAt|userId|e9e9e9e9|T\d\d:/.test(text), text);
  // days sempre com 7 inteiros ≥ 0, mesmo com o SQL estranho
  const odd = recapResponse({ ...SVC, days: [1.6, -3] as number[] }, []);
  assert.deepEqual(odd.days, [2, 0, 0, 0, 0, 0, 0]);
});

Deno.test('weekly-recap: rota curta demais ou sem pontos = sem rota', () => {
  assert.equal(recapRoute([], [], 1), null);
  assert.equal(recapRoute(run(rng(1), 1), [], 1), null);
  assert.equal(recapRoute(run(rng(1), 60), [], 1), null, '~170 m: o corte das pontas esconde tudo');
});

Deno.test('weekly-recap: propriedade (300 casos) — rota desenhada fora das zonas de privacidade e longe das pontas', () => {
  const r = rng(2610);
  let withRoute = 0;
  for (let k = 0; k < 300; k++) {
    const pts = run(r, 600 + Math.floor(r() * 1800));
    const geo = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
    const zones: PrivacyCircle[] = Array.from({ length: Math.floor(r() * 3) }, () => {
      const at = geo[Math.floor(r() * geo.length)];
      return { ...offset(at, r() * 100, r() * 360), radiusM: 50 + Math.floor(r() * 300) };
    });
    const out = recapRoute(pts, zones, Math.floor(r() * 2 ** 31));
    if (!out) continue;
    withRoute++;
    const drawn = out.pieces.map((s) => decodePolyline(s));
    assert.ok(drawn.reduce((s, p) => s + p.length, 0) <= 80, 'no máximo 80 pontos');
    assert.ok(routeIsSafe(drawn, zones, { start: geo[0], end: geo[geo.length - 1] }), `caso ${k}`);
    for (const p of drawn.flat()) {
      for (const z of zones) assert.ok(distanceMeters(p, z) > z.radiusM, `caso ${k}: ponto dentro da zona`);
    }
  }
  assert.ok(withRoute > 150, `a maioria das corridas longas tem rota (${withRoute})`);
});

Deno.test('weekly-recap: semente nova muda o corte (as pontas não são previsíveis)', () => {
  const pts = run(rng(42), 1500);
  const cuts = new Set<string>();
  for (let seed = 1; seed <= 12; seed++) cuts.add(JSON.stringify(recapRoute(pts, [], seed * 7919)?.pieces));
  assert.ok(cuts.size > 1, 'sementes diferentes, cortes diferentes');
  assert.deepEqual(recapRoute(pts, [], 99), recapRoute(pts, [], 99), 'mesma semente, mesmo corte (determinístico)');
});
