import { useEffect, useRef } from 'react';
import { useColorScheme, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';

import { factions, palette } from '@/theme/tokens';

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
  { elementType: 'geometry', stylers: [{ color: '#1f242b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8f98a3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1b1f25' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c323b' }] },
  { featureType: 'water', stylers: [{ color: '#14222e' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;

const toCoord = (p: { lat: number; lng: number }) => ({ latitude: p.lat, longitude: p.lng });

/**
 * Prototype map (runs in Expo Go): Apple Maps on iOS, Google Maps on Android.
 * Production swaps this file for Mapbox with feature-state and vector tiles (Product Book §6.1):
 * one React component per hexagon is fine for a few hundred zones, not for a whole city.
 */
export default function TerritoryMap({
  zones,
  center,
  span = 1800,
  user,
  path,
  chests,
  fogCells,
  selectedZone,
  onZonePress,
  followUser,
  interactive = true,
  style,
}: TerritoryMapProps) {
  const map = useRef<MapView>(null);
  const night = useColorScheme() === 'dark';
  const delta = span / 111_000;

  useEffect(() => {
    if (followUser && user) {
      map.current?.animateCamera({ center: toCoord(user) }, { duration: 400 });
    }
  }, [followUser, user]);

  return (
    <View style={[{ flex: 1, backgroundColor: palette.concreto }, style]}>
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
        zoomEnabled={interactive}>
        {fogCells?.map((c) => (
          <Polygon key={`fog-${c.id}`} coordinates={c.boundary.map(toCoord)} fillColor="rgba(255,255,255,0.55)" strokeWidth={0} />
        ))}
        {zones.map((z) => {
          const f = z.owner ? factions[z.owner] : null;
          if (!f && !z.blocked) return null;
          return (
            <Polygon
              key={z.id}
              coordinates={z.boundary.map(toCoord)}
              fillColor={z.blocked ? 'rgba(107,115,128,0.25)' : alpha(f!.color, z.id === selectedZone ? 0.42 : 0.26)}
              strokeColor={z.blocked ? palette.meioFio : f!.color}
              strokeWidth={z.id === selectedZone ? 3 : 1.4}
              lineDashPattern={f?.dash}
              tappable={!!onZonePress}
              onPress={() => onZonePress?.(z.id)}
            />
          );
        })}
        {zones
          .filter((z) => z.attack)
          .map((z) => (
            <Polygon
              key={`atk-${z.id}`}
              coordinates={z.boundary.map(toCoord)}
              fillColor="rgba(255,210,63,0.18)"
              strokeColor={palette.sinalizacao}
              strokeWidth={4}
              lineDashPattern={[10, 8]}
              tappable={!!onZonePress}
              onPress={() => onZonePress?.(z.id)}
            />
          ))}
        {path && path.length > 1 ? (
          <>
            <Polyline coordinates={path.map(toCoord)} strokeColor="#FFFFFF" strokeWidth={9} lineCap="round" lineJoin="round" />
            <Polyline coordinates={path.map(toCoord)} strokeColor={palette.asfalto} strokeWidth={5} lineCap="round" lineJoin="round" />
          </>
        ) : null}
        {chests?.map((c) => (
          <Marker key={c.id} coordinate={toCoord(c.position)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View
              style={{
                width: c.rarity === 'lendario' ? 22 : 16,
                height: c.rarity === 'lendario' ? 22 : 16,
                borderRadius: 5,
                backgroundColor: c.rarity === 'comum' ? palette.giz : palette.sinalizacao,
                borderWidth: 2.5,
                borderColor: palette.asfalto,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </Marker>
        ))}
        {user ? (
          <Marker coordinate={toCoord(user)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(37,42,49,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: palette.sinalizacao, borderWidth: 3, borderColor: palette.asfalto }} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
