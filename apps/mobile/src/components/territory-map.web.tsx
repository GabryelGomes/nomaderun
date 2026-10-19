import 'maplibre-gl/dist/maplibre-gl.css';

import type { GeoJSONSource, Map as MLMap, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { zoneOf } from '@/domain/grid';
import type { LatLng } from '@/domain/types';
import { palette } from '@/theme/tokens';

import { mapLayers } from './territory-map.layers';
import type { TerritoryMapProps } from './territory-map.types';

/** Free vector basemap (OpenFreeMap, no key). If it can't load, the map still shows territory on a plain background. */
const STYLE_URL = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' };

const fallbackStyle = (night: boolean): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': night ? palette.night : palette.bg } }],
});

async function loadStyle(night: boolean): Promise<StyleSpecification | string> {
  const url = night ? STYLE_URL.dark : STYLE_URL.light;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    return url;
  } catch {
    return fallbackStyle(night);
  }
}

const ring = (r: LatLng[]) => [...r.map((p) => [p.lng, p.lat]), [r[0].lng, r[0].lat]];
const polygon = (rings: LatLng[][], properties: Record<string, unknown>): GeoJSON.Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Polygon', coordinates: rings.map(ring) },
});
const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

/** The same layers as the native map, as GeoJSON sources. */
function sources(props: TerritoryMapProps) {
  const l = mapLayers(props);
  return {
    regions: collection(l.regions.map((r) => polygon(r.rings, { color: r.color, opacity: r.opacity }))),
    contested: collection(l.contested.map((c) => polygon([c.ring], { color: c.color }))),
    blocked: collection(l.blocked.map((rings) => polygon(rings, {}))),
    explored: collection(l.explored.map((rings) => polygon(rings, {}))),
  };
}

/** Web map (MapLibre GL JS). Same props as the native map. Loaded lazily so static rendering never touches `window`. */
export default function TerritoryMap(props: TerritoryMapProps) {
  const { center, span = 1800, interactive = true, style } = props;
  const host = useRef<View>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const night = useColorScheme() === 'dark';
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ Map: MapCtor, setWorkerUrl }, mapStyle] = await Promise.all([import('maplibre-gl'), loadStyle(night)]);
      setWorkerUrl('/maplibre-gl-worker.mjs'); // copied to public/ by scripts/copy-maplibre-worker.js
      const el = host.current as unknown as HTMLElement | null;
      if (cancelled || !el) return;
      const zoom = Math.log2((40_075_016 * Math.cos((center.lat * Math.PI) / 180)) / span) - 0.6;
      const map = new MapCtor({
        container: el,
        style: mapStyle,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
        interactive,
      });
      mapRef.current = map;
      map.on('load', () => {
        const data = sources(latest.current);
        for (const [id, fc] of Object.entries(data)) map.addSource(id, { type: 'geojson', data: fc });
        map.addSource('path', { type: 'geojson', data: collection([]) });
        map.addSource('points', { type: 'geojson', data: collection([]) });
        map.addLayer({ id: 'explored-fill', type: 'fill', source: 'explored', paint: { 'fill-color': palette.orange, 'fill-opacity': 0.22 } });
        map.addLayer({ id: 'explored-edge', type: 'line', source: 'explored', paint: { 'line-color': palette.orange, 'line-opacity': 0.7, 'line-width': 1.5 } });
        map.addLayer({ id: 'blocked-fill', type: 'fill', source: 'blocked', paint: { 'fill-color': palette.ink2, 'fill-opacity': 0.18 } });
        map.addLayer({ id: 'blocked-edge', type: 'line', source: 'blocked', paint: { 'line-color': palette.ink3, 'line-width': 1, 'line-dasharray': [2, 2] } });
        map.addLayer({ id: 'region-fill', type: 'fill', source: 'regions', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'] } });
        map.addLayer({ id: 'region-halo', type: 'line', source: 'regions', layout: { 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-opacity': 0.9, 'line-width': 4.5 } });
        map.addLayer({ id: 'region-edge', type: 'line', source: 'regions', layout: { 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 2 } });
        map.addLayer({ id: 'contested-fill', type: 'fill', source: 'contested', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.16 } });
        map.addLayer({
          id: 'contested-edge',
          type: 'line',
          source: 'contested',
          paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2.2, 1.6] },
        });
        map.addLayer({ id: 'path-casing', type: 'line', source: 'path', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': palette.white, 'line-width': 8 } });
        map.addLayer({ id: 'path-line', type: 'line', source: 'path', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': palette.orange, 'line-width': 5 } });
        map.addLayer({
          id: 'chests',
          type: 'circle',
          source: 'points',
          filter: ['==', ['get', 'kind'], 'chest'],
          paint: {
            'circle-radius': ['case', ['==', ['get', 'rarity'], 'lendario'], 9, 6],
            'circle-color': ['case', ['==', ['get', 'rarity'], 'comum'], palette.white, palette.warning],
            'circle-stroke-color': palette.ink,
            'circle-stroke-width': 2.5,
          },
        });
        map.addLayer({ id: 'user-halo', type: 'circle', source: 'points', filter: ['==', ['get', 'kind'], 'user'], paint: { 'circle-radius': 17, 'circle-color': 'rgba(255,90,31,0.18)' } });
        map.addLayer({
          id: 'user-dot',
          type: 'circle',
          source: 'points',
          filter: ['==', ['get', 'kind'], 'user'],
          paint: { 'circle-radius': 7.5, 'circle-color': palette.orange, 'circle-stroke-color': palette.white, 'circle-stroke-width': 3 },
        });
        // A click is turned into the zone under the pointer (same rule as the server), not into a drawn shape.
        map.on('click', (e: MapMouseEvent) => {
          const { onZonePress, zones } = latest.current;
          const id = zoneOf({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          if (onZonePress && zones.some((z) => z.id === id)) onZonePress(id);
        });
        if (latest.current.onZonePress) map.getCanvas().style.cursor = 'pointer';
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; data updates flow through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const [id, fc] of Object.entries(sources(props))) (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
    (map.getSource('path') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features:
        props.path && props.path.length > 1
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: props.path.map((p) => [p.lng, p.lat]) } }]
          : [],
    });
    const points: GeoJSON.Feature[] = [
      ...(props.chests ?? []).map((c) => ({
        type: 'Feature' as const,
        properties: { kind: 'chest', rarity: c.rarity },
        geometry: { type: 'Point' as const, coordinates: [c.position.lng, c.position.lat] },
      })),
      ...(props.user ? [{ type: 'Feature' as const, properties: { kind: 'user' }, geometry: { type: 'Point' as const, coordinates: [props.user.lng, props.user.lat] } }] : []),
    ];
    (map.getSource('points') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: points });
    if (props.followUser && props.user) map.easeTo({ center: [props.user.lng, props.user.lat], duration: 400 });
  }, [ready, props]);

  return <View ref={host} style={[{ flex: 1, backgroundColor: night ? palette.night : palette.bg }, style]} />;
}
