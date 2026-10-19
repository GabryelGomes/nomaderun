import { describe, expect, it } from '@jest/globals';

import { cellsAround, zoneOf } from '../grid';
import { chaikin, relax, territoryRegions } from '../regions';
import { ORIGIN } from './helpers';

describe('Regiões de território (exibição sem grade)', () => {
  const center = zoneOf(ORIGIN);

  it('une zonas vizinhas do mesmo dono numa única região', () => {
    const zones = cellsAround(center, 2).map((id) => ({ id, owner: 'striders' as const }));
    const regions = territoryRegions(zones);
    expect(regions).toHaveLength(1);
    expect(regions[0].owner).toBe('striders');
    expect(regions[0].rings).toHaveLength(1);
  });

  it('separa donos diferentes e ignora zonas neutras', () => {
    const ring = cellsAround(center, 1);
    const zones = [
      { id: center, owner: 'coyotes' as const },
      ...ring.filter((id) => id !== center).map((id) => ({ id, owner: null })),
      { id: cellsAround(center, 4)[60], owner: 'owls' as const },
    ];
    const owners = territoryRegions(zones).map((r) => r.owner).sort();
    expect(owners).toEqual(['coyotes', 'owls']);
  });

  it('arredonda os cantos: cada passada de Chaikin dobra os pontos e mantém a forma no lugar', () => {
    const square = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 0 },
    ];
    const once = chaikin(square, 1);
    expect(once).toHaveLength(8);
    expect(once.every((p) => p.lat >= 0 && p.lat <= 1 && p.lng >= 0 && p.lng <= 1)).toBe(true);
    expect(chaikin(square, 2)).toHaveLength(16);
  });

  it('relaxa o serrilhado das bordas sem mudar o centro da forma', () => {
    const zigzag = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * 2 * Math.PI;
      const r = i % 2 === 0 ? 1 : 0.8;
      return { lat: r * Math.sin(a), lng: r * Math.cos(a) };
    });
    const radii = (ring: { lat: number; lng: number }[]) => ring.map((p) => Math.hypot(p.lat, p.lng));
    const spread = (ring: { lat: number; lng: number }[]) => Math.max(...radii(ring)) - Math.min(...radii(ring));
    const smooth = relax(zigzag);
    expect(spread(smooth)).toBeLessThan(spread(zigzag) / 4);
    const mean = smooth.reduce((acc, p) => ({ lat: acc.lat + p.lat / 12, lng: acc.lng + p.lng / 12 }), { lat: 0, lng: 0 });
    expect(Math.abs(mean.lat) + Math.abs(mean.lng)).toBeLessThan(1e-9);
  });
});
