import { describe, expect, it } from '@jest/globals';

import { ORIGIN } from '@/domain/__tests__/helpers';
import { cellBoundary, cellsAround, zoneOf } from '@/domain/grid';
import { factions, territoryOpacity } from '@/theme/tokens';

import { mapLayers } from '../territory-map.layers';
import type { MapZone } from '../territory-map.types';

const center = zoneOf(ORIGIN);
const zone = (id: string, owner: MapZone['owner'], attacker: MapZone['attacker'] = null): MapZone => ({ id, boundary: cellBoundary(id), owner, attacker });

describe('Camadas do mapa (sem grade na tela)', () => {
  const near = cellsAround(center, 1);
  const far = cellsAround(center, 4)[60];
  const zones = [...near.map((id) => zone(id, 'striders')), zone(far, 'owls')];

  it('desenha uma região por bloco de time, mais forte para o meu time', () => {
    const { regions } = mapLayers({ zones, myFaction: 'striders' });
    expect(regions).toHaveLength(2);
    const mine = regions.find((r) => r.color === factions.striders.color);
    expect(mine?.opacity).toBe(territoryOpacity.mine);
  });

  it('"Só meu time" esconde os outros times', () => {
    const { regions } = mapLayers({ zones, myFaction: 'striders', onlyMine: true });
    expect(regions.map((r) => r.color)).toEqual([factions.striders.color]);
  });

  it('zona disputada usa a cor de quem ataca', () => {
    const { contested } = mapLayers({ zones: [zone(center, 'striders', 'volt')], myFaction: 'striders' });
    expect(contested).toHaveLength(1);
    expect(contested[0].color).toBe(factions.volt.color);
  });
});
