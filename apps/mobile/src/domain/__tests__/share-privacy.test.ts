/**
 * T7.1.8 (D-78) — corte da rota para compartilhar: exemplos e teste de propriedade (≥ 1.000 casos).
 * Propriedades: nenhum ponto (nem o meio de um segmento) visível dentro de zona; nada visível a menos de
 * 150 m do começo/fim; pedaços ≥ 150 m; "sem rota" quando > 60% some; saída sobre a rota original.
 */
import { describe, expect, it } from '@jest/globals';

import { distanceMeters, offset } from '../geo';
import {
  clipRouteForSharing,
  isSharedRoute,
  SHARE_END_CUT_MIN_M,
  SHARE_MAX_HIDDEN_RATIO,
  SHARE_MIN_PIECE_M,
  SHARE_ZONE_MARGIN_MIN_M,
  type PrivacyCircle,
  type SharedRoute,
} from '../share-privacy';
import type { GeoPoint, LatLng } from '../types';
import { ORIGIN } from './helpers';
import { forAll, type Rng } from './prop';

const PROPERTY_RUNS = Math.max(1000, Number(process.env.NOMADE_SHARE_RUNS ?? 1200));

/** Linha reta para leste, um ponto a cada `step` metros. */
function line(meters: number, step = 20, start: LatLng = ORIGIN, bearing = 90): LatLng[] {
  const pts: LatLng[] = [start];
  for (let d = step; d <= meters; d += step) pts.push(offset(start, d, bearing));
  return pts;
}

const lengthOf = (pts: readonly LatLng[]) => pts.slice(1).reduce((s, p, i) => s + distanceMeters(pts[i], p), 0);

/** Distância (m) de `p` ao segmento a–b, num plano local (precisão de centímetros nas escalas do teste). */
function distToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos((a.lat * Math.PI) / 180);
  const toXY = (q: LatLng) => [(q.lng - a.lng) * k * 111_320, (q.lat - a.lat) * 110_574];
  const [px, py] = toXY(p);
  const [bx, by] = toXY(b);
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

describe('clipRouteForSharing — exemplos', () => {
  it('rota vazia ou de 1 ponto vira "sem rota" (vazia)', () => {
    for (const r of [[], [ORIGIN]]) {
      const out = clipRouteForSharing(r, [], { seed: 1 });
      expect(out.mode).toBe('noRoute');
      expect(out.noRouteReason).toBe('empty');
      expect(out.pieces).toEqual([]);
      expect(out.hiddenRatio).toBe(1);
    }
  });

  it('rota curta (< 150 m) não tem o que mostrar', () => {
    const out = clipRouteForSharing(line(120), [], { seed: 3, hideEnds: false });
    expect(out.mode).toBe('noRoute');
    expect(out.noRouteReason).toBe('empty');
  });

  it('sem zonas e com as pontas escondidas: um pedaço, longe do começo e do fim', () => {
    const route = line(2000);
    const out = clipRouteForSharing(route, [], { seed: 7 });
    expect(out.mode).toBe('route');
    expect(out.pieces).toHaveLength(1);
    expect(out.endsHidden).toBe(true);
    const piece = out.pieces[0];
    expect(distanceMeters(piece[0], route[0])).toBeGreaterThan(SHARE_END_CUT_MIN_M);
    expect(distanceMeters(piece[piece.length - 1], route[route.length - 1])).toBeGreaterThan(SHARE_END_CUT_MIN_M);
    expect(out.totalMeters).toBeCloseTo(2000, -1);
    expect(out.hiddenMeters).toBeGreaterThanOrEqual(300);
    expect(out.hiddenMeters).toBeLessThanOrEqual(620);
    expect(out.hiddenRatio).toBeCloseTo(out.hiddenMeters / out.totalMeters, 2);
  });

  it('sem zonas e com as pontas à mostra: a rota inteira', () => {
    const out = clipRouteForSharing(line(1000), [], { seed: 7, hideEnds: false });
    expect(out.mode).toBe('route');
    expect(out.pieces).toHaveLength(1);
    expect(out.hiddenMeters).toBe(0);
    expect(out.shownMeters).toBeCloseTo(1000, -1);
  });

  it('zona no meio parte a rota em dois pedaços e nenhum ponto fica nela', () => {
    const route = line(3000);
    const zone: PrivacyCircle = { ...offset(ORIGIN, 1500, 90), radiusM: 200 };
    const out = clipRouteForSharing(route, [zone], { seed: 11 });
    expect(out.mode).toBe('route');
    expect(out.pieces).toHaveLength(2);
    for (const piece of out.pieces) for (const p of piece) expect(distanceMeters(p, zone)).toBeGreaterThan(zone.radiusM + SHARE_ZONE_MARGIN_MIN_M);
  });

  it('casa no começo cobrindo quase tudo: "sem rota" por excesso de corte', () => {
    const route = line(1500);
    const home: PrivacyCircle = { ...offset(ORIGIN, 400, 90), radiusM: 600 };
    const out = clipRouteForSharing(route, [home], { seed: 5 });
    expect(out.mode).toBe('noRoute');
    expect(out.noRouteReason).toBe('mostlyHidden');
    expect(out.pieces).toEqual([]);
    expect(out.hiddenMeters).toBe(Math.round(out.totalMeters));
  });

  it('ignora pontos e zonas inválidos', () => {
    const route = [...line(800), { lat: Number.NaN, lng: 0 }, { lat: 95, lng: 0 }, ...line(800, 20, offset(ORIGIN, 820, 90))];
    const zones = [{ lat: Number.NaN, lng: 0, radiusM: 100 }, { ...ORIGIN, radiusM: -5 }, { ...ORIGIN, radiusM: Number.POSITIVE_INFINITY }];
    const out = clipRouteForSharing(route, zones, { seed: 2, hideEnds: false });
    expect(out.mode).toBe('route');
    expect(out.shownMeters).toBeGreaterThan(1500);
  });

  it('a mesma semente reproduz o corte; sementes diferentes mudam a borda', () => {
    const route = line(3000);
    const zone: PrivacyCircle = { ...offset(ORIGIN, 1500, 90), radiusM: 200 };
    const a = clipRouteForSharing(route, [zone], { seed: 42 });
    const b = clipRouteForSharing(route, [zone], { seed: 42 });
    expect(b.pieces).toEqual(a.pieces);
    const hidden = new Set<number>();
    for (let seed = 0; seed < 20; seed++) hidden.add(clipRouteForSharing(route, [zone], { seed }).hiddenMeters);
    expect(hidden.size).toBeGreaterThan(10);
  });

  it('a saída só tem lat/lng (nada de horário), é congelada e reconhecida como SharedRoute', () => {
    const route: GeoPoint[] = line(1200).map((p, i) => ({ ...p, t: 1_700_000_000_000 + i * 4000, accuracy: 4, steps: 3 }));
    const out = clipRouteForSharing(route, [], { seed: 9 });
    expect(isSharedRoute(out)).toBe(true);
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.pieces[0])).toBe(true);
    for (const p of out.pieces[0]) expect(Object.keys(p).sort()).toEqual(['lat', 'lng']);
  });

  it('objeto montado à mão não passa por SharedRoute', () => {
    const fake = { mode: 'route', pieces: [line(500)], totalMeters: 500, shownMeters: 500, hiddenMeters: 0, hiddenRatio: 0, endsHidden: false, noRouteReason: null };
    expect(isSharedRoute(fake)).toBe(false);
    expect(isSharedRoute(null)).toBe(false);
    expect(isSharedRoute('rota')).toBe(false);
    // @ts-expect-error — LatLng[] não é SharedRoute (marca nominal)
    const typed: SharedRoute = fake;
    expect(typed).toBe(fake);
  });
});

/* ---------- propriedade ---------- */

type Case = { route: LatLng[]; zones: PrivacyCircle[]; seed: number; hideEnds: boolean };

function genCase(r: Rng): Case {
  const start = offset(ORIGIN, r.float(0, 3000), r.float(0, 360));
  const n = r.int(4, 50);
  const route: LatLng[] = [start];
  let p = start;
  let bearing = r.float(0, 360);
  for (let i = 0; i < n; i++) {
    bearing += r.float(-70, 70);
    p = offset(p, r.float(5, 250), bearing);
    route.push(p);
  }
  if (r.bool(0.2)) route.push({ ...start }); // volta para casa
  const zones: PrivacyCircle[] = Array.from({ length: r.int(0, 3) }, () => ({ ...offset(r.pick(route), r.float(0, 800), r.float(0, 360)), radiusM: r.float(50, 1000) }));
  if (r.bool(0.5)) zones.push({ ...offset(start, r.float(0, 120), r.float(0, 360)), radiusM: r.float(50, 300) }); // casa perto da saída
  return { route, zones, seed: r.int(0, 2 ** 31), hideEnds: r.bool(0.85) };
}

describe('clipRouteForSharing — propriedade', () => {
  it(`${PROPERTY_RUNS} casos: nada dentro de zona, pontas e pedaços ≥ 150 m, sobre a rota original`, () => {
    let routes = 0;
    let noRoutes = 0;
    let minEdge = Infinity;
    forAll(
      genCase,
      ({ route, zones, seed, hideEnds }) => {
        const out = clipRouteForSharing(route, zones, { seed, hideEnds });
        if (!isSharedRoute(out)) throw new Error('saída sem a marca SharedRoute');
        if (out.mode === 'noRoute') {
          noRoutes++;
          if (out.pieces.length) throw new Error('sem rota com pedaços');
          return;
        }
        routes++;
        // checagens simples (sem `expect` no laço interno, que custaria minutos em 1.000+ casos)
        const check = (ok: boolean, msg: string) => {
          if (!ok) throw new Error(msg);
        };
        check(out.pieces.length > 0, 'modo rota sem pedaços');
        check(out.hiddenRatio <= SHARE_MAX_HIDDEN_RATIO, `escondeu ${out.hiddenRatio} e ainda mostrou rota`);
        const first = route[0];
        const last = route[route.length - 1];
        for (const piece of out.pieces) {
          check(lengthOf(piece) >= SHARE_MIN_PIECE_M, `pedaço curto: ${lengthOf(piece)} m`);
          for (let i = 0; i < piece.length; i++) {
            const p = piece[i];
            for (const z of zones) {
              const d = distanceMeters(p, z);
              minEdge = Math.min(minEdge, d - z.radiusM);
              check(d > z.radiusM, `ponto a ${d} m de uma zona de raio ${z.radiusM}`);
              if (i > 0) {
                const mid = { lat: (p.lat + piece[i - 1].lat) / 2, lng: (p.lng + piece[i - 1].lng) / 2 };
                check(distanceMeters(mid, z) > z.radiusM, 'segmento atravessa uma zona');
              }
            }
            if (hideEnds) {
              check(distanceMeters(p, first) >= SHARE_END_CUT_MIN_M, 'ponto perto do começo');
              check(distanceMeters(p, last) >= SHARE_END_CUT_MIN_M, 'ponto perto do fim');
            }
          }
          // sobre a rota original: as pontas de cada pedaço e um ponto a cada 25
          for (let i = 0; i < piece.length; i += i === piece.length - 1 ? 1 : Math.min(25, piece.length - 1 - i)) {
            check(route.slice(1).some((b, k) => distToSegment(piece[i], route[k], b) < 0.5), 'ponto fora da rota original');
          }
        }
        expect(out.shownMeters + out.hiddenMeters).toBeCloseTo(out.totalMeters, -1);
      },
      PROPERTY_RUNS,
    );
    expect(routes + noRoutes).toBe(PROPERTY_RUNS);
    expect(routes).toBeGreaterThan(PROPERTY_RUNS * 0.3); // o gerador exercita os dois caminhos
    expect(noRoutes).toBeGreaterThan(0);
    if (Number.isFinite(minEdge)) expect(minEdge).toBeGreaterThan(SHARE_ZONE_MARGIN_MIN_M - 0.5);
  });
});
