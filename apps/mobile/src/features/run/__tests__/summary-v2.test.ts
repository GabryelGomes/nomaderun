/**
 * T7.2.7 (E6b) — Resumo v2: a rota que se desenha (pedaços em ordem, sem buraco) e as conquistas que viram
 * celebração (só o que o servidor confirmou).
 */
import { describe, expect, it } from '@jest/globals';

import { shouldAskNotifications } from '../notification-permission';
import { routeChunkDelay, routeChunks, ROUTE_DRAW_MS } from '../route-draw.math';
import { summaryCelebrations, summaryIntro } from '../summary-celebration';
import type { RunSummary } from '../summary-model';

const path = Array.from({ length: 300 }, (_, i) => ({ lat: -16.71 + Math.sin(i / 30) * 0.004, lng: -49.24 + i * 0.00003 }));

describe('routeChunks', () => {
  it('corta em k pedaços contínuos: o fim de um é o começo do próximo', () => {
    const r = routeChunks(path, 320, 180, 12);
    expect(r.chunks).toHaveLength(12);
    const ends = r.chunks.map((d) => {
      const pts = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => `${m[1]} ${m[2]}`);
      return { first: pts[0], last: pts[pts.length - 1] };
    });
    for (let i = 1; i < ends.length; i++) expect(ends[i].first).toBe(ends[i - 1].last);
    expect(r.start).not.toBeNull();
    expect(r.end).not.toBeNull();
  });

  it('cabe na caixa (com a margem) e mantém a ordem da rota', () => {
    const r = routeChunks(path, 320, 180, 6, 16);
    const xs = r.chunks.flatMap((d) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]));
    for (const [x, y] of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(320);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(180);
    }
    // a rota vai para o leste: o x cresce ao longo dos pedaços
    expect(xs[xs.length - 1][0]).toBeGreaterThan(xs[0][0]);
  });

  it('rota curta ou vazia: nada a desenhar; poucos pontos: menos pedaços', () => {
    expect(routeChunks([], 320, 180).chunks).toEqual([]);
    expect(routeChunks([path[0]], 320, 180).chunks).toEqual([]);
    expect(routeChunks(path.slice(0, 3), 320, 180, 12).chunks).toHaveLength(2);
  });

  it('a cascata inteira cabe nos 800 ms', () => {
    expect(routeChunkDelay(0, 12)).toBe(0);
    expect(routeChunkDelay(11, 12)).toBeLessThan(ROUTE_DRAW_MS);
    expect(routeChunkDelay(3, 1)).toBe(0);
  });
});

const summary = (patch: Partial<RunSummary> = {}): RunSummary => ({
  source: 'official',
  status: 'valid',
  meters: 5020,
  movingSeconds: 1690,
  avgPace: 337,
  rpTotal: 183,
  xp: 40,
  flags: [],
  invalidSegments: [],
  zones: [
    { zoneId: 'a', name: 'Lago', meters: 900, rp: 90, outcome: 'conquered', ownerBefore: null, ownerAfter: 'striders' },
    { zoneId: 'b', name: 'Praça', meters: 400, rp: 30, outcome: 'defended', ownerBefore: 'striders', ownerAfter: 'striders' },
    { zoneId: 'c', name: 'Rua', meters: 200, rp: 10, outcome: 'influence', ownerBefore: null, ownerAfter: null },
  ],
  newFogCells: 4,
  beatGhost: null,
  trust: 100,
  review: null,
  ...patch,
});

describe('summaryCelebrations', () => {
  it('oficial: conquista (média), defesa (pequena) e XP; influência não é celebrada', () => {
    const ev = summaryCelebrations(summary(), true, 'striders');
    expect(ev.map((e) => [e.kind, e.level])).toEqual([
      ['zone-captured', 'medium'],
      ['zone-defended', 'small'],
      ['xp', 'small'],
    ]);
    expect(ev[0]).toMatchObject({ label: 'conquistou Lago', payload: { zone: 'Lago', faction: 'striders', points: 90 } });
  });

  it('provisório, em revisão ou rejeitado: nada comemorado (honestidade, E-01)', () => {
    expect(summaryCelebrations(summary(), false, 'striders')).toEqual([]);
    expect(summaryCelebrations(summary({ status: 'review' }), true, 'striders')).toEqual([]);
    expect(summaryCelebrations(summary({ status: 'rejected' }), true, 'striders')).toEqual([]);
  });

  it('anúncio de abertura para o leitor de tela', () => {
    expect(summaryIntro('5,02', '28:10')).toBe('Corrida concluída: 5,02 km em 28:10.');
  });
});

describe('permissão de notificação depois da 1ª conquista (D-72)', () => {
  it('só pergunta com conquista e permissão ainda não decidida', () => {
    expect(shouldAskNotifications(1, 'undetermined')).toBe('ask');
    expect(shouldAskNotifications(0, 'undetermined')).toBe('skip');
    expect(shouldAskNotifications(2, 'granted')).toBe('skip');
    expect(shouldAskNotifications(2, 'denied')).toBe('skip');
    expect(shouldAskNotifications(2, 'unsupported')).toBe('skip');
  });
});
