/** RF-013 — mapa de calor: leitura da resposta, intensidade, área pedida e o servidor de demonstração. */
import '@/domain/h3-runtime';

import { describe, expect, it } from '@jest/globals';

import { HEAT_FLIP_WEIGHT, heatColor, heatSpots } from '@/components/territory-map.layers';
import { cellCenter } from '@/domain/grid';
import { parseZoneHeat } from '@/services/api/heat-repo';
import { DemoDb } from '@/services/api/demo/db';
import { DEMO_HEAT_RPC_HANDLERS } from '@/services/api/demo/heat';
import { DEMO_USER_ID } from '@/demo/world';

import { heatBounds } from '../map-heat.model';

const Z1 = '8ba8a5a0a0dffff';
const Z2 = '8ba8a5a0a0d7fff';

describe('parseZoneHeat', () => {
  it('fica só com linhas válidas', () => {
    expect(
      parseZoneHeat([
        { id: Z1, runs: 3, flips: 1 },
        { id: 'abc', runs: 1, flips: 0 },
        { id: Z2, runs: -1, flips: 0 },
        { id: Z2, runs: 1.5, flips: 0 },
        null,
      ]),
    ).toEqual([{ id: Z1, runs: 3, flips: 1 }]);
    expect(parseZoneHeat({})).toEqual([]);
  });
});

describe('heatSpots', () => {
  it('a zona mais quente vale 1; troca de dono pesa mais que corrida; sem nada não aparece', () => {
    const spots = heatSpots([
      { id: Z1, runs: 4, flips: 0 },
      { id: Z2, runs: 0, flips: 2 },
      { id: '8ba8a5a0a0c7fff', runs: 0, flips: 0 },
    ]);
    expect(spots).toHaveLength(2);
    const hottest = spots[spots.length - 1];
    expect(hottest.id).toBe(Z2); // 2 trocas × 3 = 6 > 4 corridas
    expect(hottest.weight).toBe(1);
    expect(spots[0].weight).toBeCloseTo(Math.sqrt(4 / (2 * HEAT_FLIP_WEIGHT)));
    expect(hottest.center).toEqual(cellCenter(Z2));
  });

  it('zona quase fria perto da mais quente fica de fora (o mapa não vira um tapete)', () => {
    expect(heatSpots([{ id: Z1, runs: 100, flips: 0 }, { id: Z2, runs: 1, flips: 0 }]).map((s) => s.id)).toEqual([Z1]);
  });

  it('nada para mostrar: lista vazia', () => {
    expect(heatSpots([])).toEqual([]);
    expect(heatSpots([{ id: Z1, runs: 0, flips: 0 }])).toEqual([]);
  });

  it('cor: laranja no morno, amarelo no mais quente', () => {
    expect(heatColor(0.2)).not.toBe(heatColor(0.9));
  });
});

describe('heatBounds', () => {
  it('área pequena passa igual; área grande vira 1 grau em volta do centro', () => {
    const small = { minLng: -49.3, minLat: -16.75, maxLng: -49.2, maxLat: -16.65 };
    expect(heatBounds(small)).toEqual(small);
    const big = heatBounds({ minLng: -51, minLat: -18, maxLng: -47, maxLat: -14 });
    expect(big.maxLng - big.minLng).toBeCloseTo(1);
    expect(big.maxLat - big.minLat).toBeCloseTo(1);
  });
});

describe('zone_heat_json na demonstração (mesmas regras do SQL)', () => {
  const heat = DEMO_HEAT_RPC_HANDLERS.zone_heat_json;
  const db = new DemoDb({ now: Date.UTC(2026, 10, 20, 15) });
  const area = { min_lng: -49.4, min_lat: -16.85, max_lng: -49.1, max_lat: -16.55 };

  it('devolve calor (fictício) na área de Goiânia, sem dado de pessoa', () => {
    const rows = heat(db, DEMO_USER_ID, { ...area, p_period: '7d' }) as { id: string; runs: number; flips: number }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['flips', 'id', 'runs']);
  });

  it('24 h tem menos corridas que a temporada', () => {
    const sum = (p: string) => (heat(db, DEMO_USER_ID, { ...area, p_period: p }) as { runs: number }[]).reduce((s, r) => s + r.runs, 0);
    expect(sum('24h')).toBeLessThan(sum('season'));
  });

  it('recusa sem login, período desconhecido e área grande demais', () => {
    expect(() => heat(db, null, { ...area, p_period: '7d' })).toThrow(/UNAUTHORIZED/);
    expect(() => heat(db, DEMO_USER_ID, { ...area, p_period: '1y' })).toThrow(/INVALID_PERIOD/);
    expect(() => heat(db, DEMO_USER_ID, { min_lng: -60, min_lat: -20, max_lng: -40, max_lat: -10, p_period: '7d' })).toThrow(/INVALID_BBOX/);
  });

  it('corrida de uma pessoa só não aparece; troca de dono aparece', () => {
    const empty = new DemoDb({ now: Date.UTC(2026, 10, 20, 15) });
    for (const z of empty.zones.values()) z.influence = { striders: 0, coyotes: 0, owls: 0, volt: 0 };
    const at = new Date(Date.UTC(2026, 10, 20, 12)).toISOString();
    empty.tables.activity_zones.push(
      { activity_id: 'a1', user_id: 'u1', zone_id: Z1, faction: 'owls', meters: 500, rp: 50, outcome: 'influence', owner_before: 'volt', owner_after: 'volt', created_at: at },
      { activity_id: 'a2', user_id: 'u1', zone_id: Z2, faction: 'owls', meters: 500, rp: 50, outcome: 'conquered', owner_before: 'volt', owner_after: 'owls', created_at: at },
    );
    const c1 = cellCenter(Z1);
    const box = { min_lng: c1.lng - 0.05, min_lat: c1.lat - 0.05, max_lng: c1.lng + 0.05, max_lat: c1.lat + 0.05, p_period: '7d' };
    const rows = heat(empty, DEMO_USER_ID, box) as { id: string; runs: number; flips: number }[];
    expect(rows.find((r) => r.id === Z1)).toBeUndefined();
    expect(rows.find((r) => r.id === Z2)).toEqual({ id: Z2, runs: 0, flips: 1 });
  });
});
