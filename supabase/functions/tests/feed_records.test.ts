// T7.2.2 — feed (D-79): rota cortada pelo domain na function, polyline precisão 4, até 80 pontos, nenhum ponto da
// linha desenhada dentro de zona de privacidade nem perto das pontas; recordes e parciais só sobre trechos válidos.
import assert from 'node:assert/strict';
import { distanceMeters, type GeoPoint, type LatLng, offset, type PrivacyCircle, validateActivity } from '../_shared/domain.ts';
import {
  buildFeedRoute,
  decodePolyline,
  encodePolyline,
  FEED_MAX_POINTS,
  feedHighlights,
  routeIsSafe,
  simplifyPieces,
} from '../_shared/feed.ts';
import { bestEffort, computeRunStats } from '../_shared/records.ts';

const ORIGIN: LatLng = { lat: -16.6869, lng: -49.2648 };

/** Gerador determinístico (mulberry32) para os casos de propriedade. */
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

/** Passeio com curvas: `n` pontos a cada `step` m, mudando de direção aos poucos. */
function walk(r: () => number, n: number, step = 8, from = ORIGIN): LatLng[] {
  const out: LatLng[] = [from];
  let bearing = r() * 360;
  for (let i = 1; i < n; i++) {
    bearing += (r() - 0.5) * 40;
    out.push(offset(out[i - 1], step, bearing));
  }
  return out;
}

Deno.test('polyline: vetor do Google (precisão 5) e ida e volta na precisão 4', () => {
  const pts = [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }];
  assert.equal(encodePolyline(pts, 5), '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5), pts);
  const r = rng(7);
  const route = walk(r, 300, 25);
  const back = decodePolyline(encodePolyline(route));
  assert.equal(back.length, route.length);
  route.forEach((p, i) => {
    assert.ok(Math.abs(back[i].lat - p.lat) <= 0.00005 + 1e-12);
    assert.ok(Math.abs(back[i].lng - p.lng) <= 0.00005 + 1e-12);
  });
});

Deno.test('simplificação: no máximo 80 pontos somando todos os pedaços', () => {
  const r = rng(11);
  const pieces = [walk(r, 900), walk(r, 400, 8, offset(ORIGIN, 3000, 90)), walk(r, 60, 8, offset(ORIGIN, 5000, 180))];
  const out = simplifyPieces(pieces);
  assert.ok(out.reduce((s, p) => s + p.length, 0) <= FEED_MAX_POINTS);
  out.forEach((p, i) => {
    assert.deepEqual(p[0], pieces[i][0], 'a ponta de cada pedaço fica');
    assert.deepEqual(p[p.length - 1], pieces[i][pieces[i].length - 1]);
  });
});

Deno.test('feed: propriedade (600 casos) — nenhum ponto desenhado dentro de zona de privacidade nem perto das pontas', () => {
  const r = rng(2026);
  let withRoute = 0;
  let noRoute = 0;
  for (let k = 0; k < 600; k++) {
    const route = walk(r, 150 + Math.floor(r() * 900), 6 + r() * 6);
    const zones: PrivacyCircle[] = Array.from({ length: 1 + Math.floor(r() * 3) }, () => {
      const at = route[Math.floor(r() * route.length)];
      return { ...offset(at, r() * 150, r() * 360), radiusM: 50 + Math.floor(r() * 400) };
    });
    const out = buildFeedRoute(route, zones, { seed: Math.floor(r() * 2 ** 31), showMap: true });
    if (!out.route) {
      noRoute++;
      assert.equal(out.routeHidden, true);
      continue;
    }
    withRoute++;
    const drawn = out.route.map((s) => decodePolyline(s));
    assert.ok(drawn.reduce((s, p) => s + p.length, 0) <= FEED_MAX_POINTS, 'até 80 pontos');
    assert.ok(routeIsSafe(drawn, zones, { start: route[0], end: route[route.length - 1] }));
    for (const piece of drawn) {
      for (const p of piece) {
        for (const z of zones) assert.ok(distanceMeters(p, z) > z.radiusM, `ponto dentro da zona (caso ${k})`);
      }
    }
    // a polyline só carrega lat/lng (sem horário, precisão, passos)
    assert.ok(out.route.every((s) => typeof s === 'string' && /^[\x3f-\x7e]+$/.test(s)));
  }
  assert.ok(withRoute > 100, `casos com rota: ${withRoute}`);
  assert.ok(noRoute > 0, `casos sem rota: ${noRoute}`);
});

Deno.test('feed: sem mapa → sem rota; mesma semente → mesmo corte; fichas', () => {
  const route = walk(rng(3), 800, 8);
  assert.deepEqual(buildFeedRoute(route, [], { seed: 1, showMap: false }), { route: null, routeHidden: true });
  assert.deepEqual(buildFeedRoute(route, [], { seed: 42, showMap: true }), buildFeedRoute(route, [], { seed: 42, showMap: true }));
  const h = feedHighlights({ conquered: [{ name: 'Setor Sul 4' }, { name: 'Centro' }, { name: 'Vila' }], raid: { damage: 70.2, countedKm: 7.04 } });
  assert.deepEqual(h, [
    { kind: 'zone_conquered', name: 'Setor Sul 4' },
    { kind: 'zone_conquered', name: 'Centro' },
    { kind: 'raid_damage', damage: 70, km: 7 },
  ]);
});

/** Corrida reta a `mps` m/s, 1 ponto por segundo, com passos (pedômetro) para não ir à revisão. */
function straight(meters: number, mps: number, t0 = 1_760_000_000_000): GeoPoint[] {
  const n = Math.round(meters / mps);
  return Array.from({ length: n + 1 }, (_, i) => ({ ...offset(ORIGIN, i * mps, 45), t: t0 + i * 1000, accuracy: 5, steps: i ? 3 : 0 }));
}

Deno.test('recordes: corrida constante de 10,5 km a 5 m/s → parciais de 200 s e melhores esforços', () => {
  const pts = straight(10_500, 5);
  const v = validateActivity(pts);
  const s = computeRunStats(pts, v);
  assert.ok(Math.abs(s.meters - 10_500) <= 5);
  assert.equal(s.splits.length, 10);
  s.splits.forEach((x) => assert.ok(Math.abs(x - 200) <= 1, `parcial ${x}`));
  assert.ok(Math.abs((s.best1k ?? 0) - 200) <= 1);
  assert.ok(Math.abs((s.best5k ?? 0) - 1000) <= 1);
  assert.ok(Math.abs((s.best10k ?? 0) - 2000) <= 1);
  assert.equal(s.best21k, null);
  assert.ok(s.paceSeries.length > 0 && s.paceSeries.length <= 200);
  s.paceSeries.forEach((p) => assert.ok(Math.abs(p - 200) <= 2));
});

Deno.test('recordes: trecho inválido (salto de GPS) não conta tempo nem distância', () => {
  const a = straight(3000, 4);
  const jump = a[a.length - 1];
  // 5 km em 10 s: velocidade de carro, trecho inválido
  const far = offset(jump, 5000, 45);
  const b = straight(3000, 4, jump.t + 10_000).map((p) => ({ ...p, ...offset(far, distanceMeters(ORIGIN, p), 45) }));
  const pts = [...a, ...b];
  const v = validateActivity(pts);
  const s = computeRunStats(pts, v);
  assert.ok(Math.abs(s.meters - v.validMeters) <= 2, `${s.meters} × ${v.validMeters}`);
  assert.ok(s.meters < 7000);
});

Deno.test('recordes: propriedades (300 corridas) — soma das parciais ≤ tempo; melhor 1 km ≤ qualquer parcial', () => {
  const r = rng(99);
  for (let k = 0; k < 300; k++) {
    const n = 300 + Math.floor(r() * 2000);
    const pts: GeoPoint[] = [{ ...ORIGIN, t: 0, accuracy: 5, steps: 0 }];
    let bearing = r() * 360;
    for (let i = 1; i < n; i++) {
      bearing += (r() - 0.5) * 30;
      const mps = 2 + r() * 3.5;
      pts.push({ ...offset(pts[i - 1], mps, bearing), t: pts[i - 1].t + 1000, accuracy: 5, steps: 3 });
    }
    const s = computeRunStats(pts, validateActivity(pts));
    assert.ok(s.splits.reduce((a, b) => a + b, 0) <= s.movingSeconds + s.splits.length, `caso ${k}`);
    if (s.best1k !== null) assert.ok(s.best1k <= Math.min(...s.splits) + 1, `caso ${k}: ${s.best1k} × ${Math.min(...s.splits)}`);
    if (s.best5k !== null && s.best1k !== null) assert.ok(s.best5k >= s.best1k * 5 - 5);
    assert.ok(s.splits.length <= 100 && s.paceSeries.length <= 200);
  }
});

Deno.test('bestEffort: menor janela com interpolação', () => {
  // 0..1000 m em 300 s, 1000..2000 m em 200 s
  assert.equal(bestEffort([0, 1000, 2000], [0, 300, 500], 1000), 200);
  assert.equal(bestEffort([0, 1000, 2000], [0, 300, 500], 1500), 350);
  assert.equal(bestEffort([0, 1000], [0, 300], 1500), null);
});
