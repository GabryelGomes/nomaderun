/** T7.1.9 — enquadramento da rota no card: só `SharedRoute` de verdade, só a parte visível, dentro da caixa. */
import { describe, expect, it } from '@jest/globals';

import { clipRouteForSharing, type SharedRoute } from '@/domain/share-privacy';

import { frameRoutes, visibleRoutes } from '../route-geometry';
import { DEMO_ROUTE, demoSharedRoute } from './fixtures';

const box = { x: 60, y: 370, w: 960, h: 760 };
const coords = (d: string) => [...d.matchAll(/[ML](-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('frameRoutes', () => {
  it('cabe na caixa (com a folga) e enquadra só a parte visível', () => {
    const route = demoSharedRoute();
    const frame = frameRoutes([route], box, 40)!;
    const pts = coords(frame.routePath(route));
    expect(pts.length).toBeGreaterThan(10);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(box.x + 40 - 0.1);
      expect(x).toBeLessThanOrEqual(box.x + box.w - 40 + 0.1);
      expect(y).toBeGreaterThanOrEqual(box.y + 40 - 0.1);
      expect(y).toBeLessThanOrEqual(box.y + box.h - 40 + 0.1);
    }
    // um dos lados encosta na folga (escala máxima)
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(Math.max(spanX / (box.w - 80), spanY / (box.h - 80))).toBeGreaterThan(0.98);
    expect(frame.scale).toBeGreaterThan(0);
    expect(frame.routePath(route).match(/M/g)).toHaveLength(route.pieces.length);
  });

  it('nada visível ou rota montada à mão: sem enquadramento e sem caminho', () => {
    const none = clipRouteForSharing([], [], { seed: 1 });
    expect(frameRoutes([none, null, undefined], box)).toBeNull();
    const fake = { ...demoSharedRoute() } as SharedRoute;
    expect(visibleRoutes([fake])).toEqual([]);
    expect(frameRoutes([fake], box)).toBeNull();
    const frame = frameRoutes([demoSharedRoute()], box)!;
    expect(frame.routePath(fake)).toBe('');
    expect(frame.routePath(none)).toBe('');
  });

  it('rota quase parada não vira zoom absurdo (extensão mínima de 60 m)', () => {
    const tiny = clipRouteForSharing([DEMO_ROUTE[0], { lat: DEMO_ROUTE[0].lat, lng: DEMO_ROUTE[0].lng + 0.0016 }], [], { seed: 1, hideEnds: false });
    const frame = frameRoutes([tiny], { x: 0, y: 0, w: 600, h: 600 })!;
    expect(frame.scale).toBeLessThanOrEqual(600 / 60);
  });

  it('regiões: anéis fechados, anéis com menos de 3 pontos ignorados', () => {
    const frame = frameRoutes([demoSharedRoute()], box)!;
    const ring = DEMO_ROUTE.slice(0, 20);
    const d = frame.regionPath({ owner: 'volt', rings: [ring, ring.slice(0, 2)] });
    expect(d.match(/Z/g)).toHaveLength(1);
    expect(d.startsWith('M')).toBe(true);
  });

  it('pula pontos a menos de 1,5 px, mas mantém o último', () => {
    const route = demoSharedRoute();
    const frame = frameRoutes([route], { x: 0, y: 0, w: 60, h: 60 })!;
    const d = frame.routePath(route);
    expect(coords(d).length).toBeLessThan(route.pieces.flat().length);
    const last = route.pieces[route.pieces.length - 1];
    const [lx, ly] = frame.toPoint(last[last.length - 1]);
    expect(d.endsWith(`${lx.toFixed(1)} ${ly.toFixed(1)}`)).toBe(true);
  });
});
