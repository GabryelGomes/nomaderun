import { useEffect, useMemo, useRef } from 'react';
import { useColorScheme, View } from 'react-native';
import MapView, { Circle, Marker, Polygon, Polyline } from 'react-native-maps';

import { zoneOf } from '@/domain/grid';
import { palette } from '@/theme/tokens';

import { mapLayers } from './territory-map.layers';
import type { TerritoryMapProps } from './territory-map.types';

/** Desaturated Google style for Android (the base map stays quiet, territories carry the color). */
const ANDROID_STYLE = [
  { elementType: 'geometry', stylers: [{ saturation: -80 }, { lightness: 8 }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }, { saturation: -40 }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

const ANDROID_NIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#1c1c1f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0a8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121214' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c31' }] },
  { featureType: 'water', stylers: [{ color: '#16222c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;

const toCoord = (p: { lat: number; lng: number }) => ({ latitude: p.lat, longitude: p.lng });
const toCoords = (ring: { lat: number; lng: number }[]) => ring.map(toCoord);

/**
 * Prototype map (runs in Expo Go): Apple Maps on iOS, Google Maps on Android.
 * Production swaps this file for Mapbox with feature-state and vector tiles (Product Book §6.1):
 * one React component per region is fine around a neighborhood, not for a whole city.
 * Regions are not tappable themselves: a tap is turned into the zone under the finger (same rule as the server).
 */
export default function TerritoryMap(props: TerritoryMapProps) {
  const { zones, center, span = 1800, myFaction, onlyMine, explored, user, path, invalidPaths, circles, chests, onZonePress, onMapPress, followUser, interactive = true, onRegionChange, focus, style } = props;
  const layers = useMemo(() => mapLayers({ zones, myFaction, onlyMine, explored }), [zones, myFaction, onlyMine, explored]);
  const map = useRef<MapView>(null);
  const night = useColorScheme() === 'dark';
  const delta = span / 111_000;

  useEffect(() => {
    if (followUser && user) {
      map.current?.animateCamera({ center: toCoord(user) }, { duration: 400 });
    }
  }, [followUser, user]);

  useEffect(() => {
    if (focus) map.current?.animateCamera({ center: toCoord(focus) }, { duration: 500 });
  }, [focus]);

  return (
    <View style={[{ flex: 1, backgroundColor: palette.bg }, style]}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={{ ...toCoord(center), latitudeDelta: delta, longitudeDelta: delta }}
        mapType={process.env.EXPO_OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={night ? ANDROID_NIGHT : ANDROID_STYLE}
        userInterfaceStyle={night ? 'dark' : 'light'}
        showsPointsOfInterests={false}
        showsCompass={false}
        showsBuildings
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={interactive}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        onRegionChangeComplete={
          onRegionChange
            ? (r) =>
                onRegionChange({
                  minLng: r.longitude - r.longitudeDelta / 2,
                  minLat: r.latitude - r.latitudeDelta / 2,
                  maxLng: r.longitude + r.longitudeDelta / 2,
                  maxLat: r.latitude + r.latitudeDelta / 2,
                })
            : undefined
        }
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          onMapPress?.({ lat: latitude, lng: longitude });
          if (!onZonePress) return;
          const id = zoneOf({ lat: latitude, lng: longitude });
          if (zones.some((z) => z.id === id)) onZonePress(id);
        }}>
        {layers.explored.map(([outline, ...holes], i) => (
          <Polygon
            key={`exp-${i}`}
            coordinates={toCoords(outline)}
            holes={holes.map(toCoords)}
            fillColor={alpha(palette.orange, 0.22)}
            strokeColor={alpha(palette.orange, 0.7)}
            strokeWidth={1.5}
          />
        ))}
        {layers.blocked.map(([outline, ...holes], i) => (
          <Polygon key={`blk-${i}`} coordinates={toCoords(outline)} holes={holes.map(toCoords)} fillColor="rgba(94,94,102,0.18)" strokeColor={palette.ink3} strokeWidth={1} lineDashPattern={[4, 4]} />
        ))}
        {layers.regions.map((r) => {
          const [outline, ...holes] = r.rings;
          return (
            <Polygon key={`halo-${r.key}`} coordinates={toCoords(outline)} holes={holes.map(toCoords)} fillColor="transparent" strokeColor="rgba(255,255,255,0.9)" strokeWidth={4.5} />
          );
        })}
        {layers.regions.map((r) => {
          const [outline, ...holes] = r.rings;
          return <Polygon key={r.key} coordinates={toCoords(outline)} holes={holes.map(toCoords)} fillColor={alpha(r.color, r.opacity)} strokeColor={r.color} strokeWidth={2} />;
        })}
        {layers.contested.map((c) => (
          <Polygon key={`atk-${c.id}`} coordinates={toCoords(c.ring)} fillColor={alpha(c.color, 0.16)} strokeColor={c.color} strokeWidth={3} lineDashPattern={[8, 6]} />
        ))}
        {circles?.map((c) => (
          <Circle key={`circle-${c.id}`} center={toCoord(c.center)} radius={c.radius} fillColor="rgba(94,94,102,0.18)" strokeColor={palette.ink2} strokeWidth={1.5} />
        ))}
        {path && path.length > 1 ? (
          <>
            <Polyline coordinates={path.map(toCoord)} strokeColor={palette.white} strokeWidth={8} lineCap="round" lineJoin="round" />
            <Polyline coordinates={path.map(toCoord)} strokeColor={palette.orange} strokeWidth={5} lineCap="round" lineJoin="round" />
          </>
        ) : null}
        {invalidPaths
          ?.filter((p) => p.length > 1)
          .map((p, i) => <Polyline key={`invalid-${i}`} coordinates={p.map(toCoord)} strokeColor={palette.ink3} strokeWidth={5} lineCap="round" lineJoin="round" />)}
        {chests?.map((c) => (
          <Marker key={c.id} coordinate={toCoord(c.position)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View
              style={{
                width: c.rarity === 'lendario' ? 20 : 14,
                height: c.rarity === 'lendario' ? 20 : 14,
                borderRadius: 10,
                backgroundColor: c.rarity === 'comum' ? palette.white : palette.warning,
                borderWidth: 2.5,
                borderColor: palette.ink,
              }}
            />
          </Marker>
        ))}
        {user ? (
          <Marker coordinate={toCoord(user)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,90,31,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: palette.orange, borderWidth: 3, borderColor: palette.white }} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
