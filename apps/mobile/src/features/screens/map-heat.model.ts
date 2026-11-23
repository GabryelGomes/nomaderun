import type { MapBounds } from '@/components/territory-map.types';

/** O servidor aceita até 1 grau por lado: com o mapa muito afastado, pede só o miolo da tela. */
export function heatBounds(b: MapBounds): MapBounds {
  const half = 0.5;
  const lng = (b.minLng + b.maxLng) / 2;
  const lat = (b.minLat + b.maxLat) / 2;
  return {
    minLng: Math.max(b.minLng, lng - half),
    maxLng: Math.min(b.maxLng, lng + half),
    minLat: Math.max(b.minLat, lat - half),
    maxLat: Math.min(b.maxLat, lat + half),
  };
}
