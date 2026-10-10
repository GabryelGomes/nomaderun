import 'maplibre-gl/dist/maplibre-gl.css';

import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { FACTION_IDS } from '@/domain/types';
import { factions, palette, type Pattern } from '@/theme/tokens';

import type { TerritoryMapProps } from './territory-map.types';

/** Free vector basemap (OpenFreeMap, no key). If it can't load, the map still shows territory on concrete. */
const STYLE_URL = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' };

const fallbackStyle = (night: boolean): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': night ? palette.noite : palette.concreto } }],
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

/** Draws a faction's chalk hatch into an RGBA tile for MapLibre `fill-pattern`. */
function patternImage(kind: Pattern, color: string) {
  const s = 16;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (kind === 'listras') {
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(s, 0);
    ctx.stroke();
  } else if (kind === 'pontos') {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'ondas') {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.6);
    ctx.quadraticCurveTo(s / 4, s * 0.25, s / 2, s * 0.6);
    ctx.quadraticCurveTo((3 * s) / 4, s * 0.95, s, s * 0.6);
    ctx.stroke();
  } else {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, s / 2, s / 2);
    ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
  }
  return { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data.buffer) };
}

const ring = (b: { lat: number; lng: number }[]) => [...b.map((p) => [p.lng, p.lat]), [b[0].lng, b[0].lat]];

function zonesGeoJSON(props: TerritoryMapProps): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: props.zones
      .filter((z) => z.owner || z.blocked)
      .map((z) => ({
        type: 'Feature',
        id: z.id,
        properties: { id: z.id, owner: z.owner ?? 'none', attack: z.attack, selected: z.id === props.selectedZone, blocked: !!z.blocked },
        geometry: { type: 'Polygon', coordinates: [ring(z.boundary)] },
      })),
  };
}

const colorMatch = ['match', ['get', 'owner'], ...FACTION_IDS.flatMap((f) => [f, factions[f].color]), palette.meioFio] as unknown as string;

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
      const [{ Map: MapCtor }, mapStyle] = await Promise.all([import('maplibre-gl'), loadStyle(night)]);
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
        for (const f of FACTION_IDS) map.addImage(`hatch-${f}`, patternImage(factions[f].pattern, factions[f].color));
        map.addSource('zones', { type: 'geojson', data: zonesGeoJSON(latest.current) });
        map.addSource('path', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zones', paint: { 'fill-color': colorMatch, 'fill-opacity': ['case', ['get', 'selected'], 0.42, 0.24] } });
        map.addLayer({
          id: 'zone-hatch',
          type: 'fill',
          source: 'zones',
          filter: ['!=', ['get', 'owner'], 'none'],
          paint: { 'fill-pattern': ['concat', 'hatch-', ['get', 'owner']], 'fill-opacity': 0.55 },
        });
        map.addLayer({ id: 'zone-edge', type: 'line', source: 'zones', paint: { 'line-color': colorMatch, 'line-width': ['case', ['get', 'selected'], 3, 1.2], 'line-opacity': 0.9 } });
        map.addLayer({ id: 'attack-under', type: 'line', source: 'zones', filter: ['==', ['get', 'attack'], true], paint: { 'line-color': palette.asfalto, 'line-width': 4 } });
        map.addLayer({
          id: 'attack-stripes',
          type: 'line',
          source: 'zones',
          filter: ['==', ['get', 'attack'], true],
          paint: { 'line-color': palette.sinalizacao, 'line-width': 4, 'line-dasharray': [1.6, 1.6] },
        });
        map.addLayer({ id: 'path-casing', type: 'line', source: 'path', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 8 } });
        map.addLayer({ id: 'path-line', type: 'line', source: 'path', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': palette.asfalto, 'line-width': 4.5 } });
        map.addLayer({
          id: 'chests',
          type: 'circle',
          source: 'points',
          filter: ['==', ['get', 'kind'], 'chest'],
          paint: {
            'circle-radius': ['case', ['==', ['get', 'rarity'], 'lendario'], 9, 6],
            'circle-color': ['case', ['==', ['get', 'rarity'], 'comum'], palette.giz, palette.sinalizacao],
            'circle-stroke-color': palette.asfalto,
            'circle-stroke-width': 2.5,
          },
        });
        map.addLayer({ id: 'user-halo', type: 'circle', source: 'points', filter: ['==', ['get', 'kind'], 'user'], paint: { 'circle-radius': 17, 'circle-color': 'rgba(37,42,49,0.16)' } });
        map.addLayer({
          id: 'user-dot',
          type: 'circle',
          source: 'points',
          filter: ['==', ['get', 'kind'], 'user'],
          paint: { 'circle-radius': 7.5, 'circle-color': palette.sinalizacao, 'circle-stroke-color': palette.asfalto, 'circle-stroke-width': 3 },
        });
        map.on('click', 'zone-fill', (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) latest.current.onZonePress?.(id);
        });
        map.on('mouseenter', 'zone-fill', () => (map.getCanvas().style.cursor = latest.current.onZonePress ? 'pointer' : ''));
        map.on('mouseleave', 'zone-fill', () => (map.getCanvas().style.cursor = ''));
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
    (map.getSource('zones') as GeoJSONSource | undefined)?.setData(zonesGeoJSON(props));
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

  return <View ref={host} style={[{ flex: 1, backgroundColor: night ? palette.noite : palette.concreto }, style]} />;
}
