import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import type { MapBounds } from '@/components/territory-map.types';
import { cellCenter } from '@/domain/grid';
import { isUnderAttack } from '@/domain/territory';
import type { LatLng } from '@/domain/types';
import { DEMO_CENTER, DEMO_CITY, zoneName } from '@/demo/demo-data';
import { mapZonesInBounds } from '@/features/map-data';
import { bboxAround } from '@/services/api/zones-repo';
import { useGame } from '@/store/game-store';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
import { factions, floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Layer = 'todos' | 'meu-time' | 'explorado';

const MAP_CENTER: LatLng = { lat: DEMO_CENTER.lat - 0.0035, lng: DEMO_CENTER.lng };
const MAP_SPAN = 2600;
/** Espera o mapa parar antes de pedir as zonas da área visível (RNF-009: sem rajada de pedidos). */
const BBOX_DEBOUNCE_MS = 600;
const INITIAL_BOUNDS: MapBounds = bboxAround(MAP_CENTER, MAP_SPAN * 0.8);

/** Nome do servidor quando houver; senão o nome local de demonstração. */
export function displayZoneName(id: string, serverName: string | null | undefined): string {
  return serverName ?? zoneName(id);
}

/** Centro pedido por uma notificação: coordenadas enviadas pelo servidor ou o centro da célula H3. */
export function focusFromParams(zona?: string, lat?: string, lng?: string): LatLng | null {
  if (!zona) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (lat && lng && Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
  try {
    return cellCenter(zona);
  } catch {
    return null;
  }
}

/** Mantém o mapa ligado ao servidor: carga por área visível (com espera) e Realtime enquanto a tela existe. */
function useLiveZones() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const zones = useZones.getState();
    void zones.hydrate().then(() => useZones.getState().loadBbox(INITIAL_BOUNDS));
    const unsubscribe = zones.subscribe();
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return useCallback((b: MapBounds) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void useZones.getState().loadBbox(b), BBOX_DEBOUNCE_MS);
  }, []);
}

/** Home: the living map is the product (Zenly lesson); everything else floats over it. */
export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const zones = useZones((s) => s.zones);
  const meta = useZones((s) => s.meta);
  const zonesError = useZones((s) => s.error);
  const zonesOffline = useZones((s) => s.offline);
  const zonesLoading = useZones((s) => s.loading);
  const hasZones = useZones((s) => Object.keys(s.zones).length > 0);
  const unread = useNotifications(selectUnreadCount);
  const city = useSession((s) => s.profile?.city) ?? DEMO_CITY;
  const faction = useGame((s) => s.faction) ?? 'striders';
  const fog = useGame((s) => s.fog);
  const [layer, setLayer] = useState<Layer>('todos');
  const [bounds, setBounds] = useState<MapBounds>(INITIAL_BOUNDS);
  const requestBbox = useLiveZones();
  const onRegionChange = useCallback(
    (b: MapBounds) => {
      setBounds(b);
      requestBbox(b);
    },
    [requestBbox],
  );

  // Alerta de invasão tocado na central (UC-02 passo 4): centraliza na zona e abre a folha com a situação atual.
  const params = useLocalSearchParams<{ zona?: string; lat?: string; lng?: string; t?: string }>();
  const focus = useMemo(() => focusFromParams(params.zona, params.lat, params.lng), [params.zona, params.lat, params.lng]);
  useEffect(() => {
    if (!params.zona || !focus) return;
    void useZones.getState().loadBbox(bboxAround(focus, MAP_SPAN * 0.8));
    router.push({ pathname: '/zona/[id]', params: { id: params.zona } });
    // `t` muda a cada toque na notificação: tocar de novo no mesmo alerta reabre a zona.
  }, [params.zona, params.t, focus]);

  const mapZones = useMemo(() => mapZonesInBounds(zones, bounds), [zones, bounds]);
  const explored = useMemo(() => (layer === 'explorado' ? fog.slice(-600) : undefined), [fog, layer]);

  const mine = Object.values(zones).filter((z) => z.owner === faction);
  const attacked = mine.filter(isUnderAttack);
  const alert = attacked[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TerritoryMap
        zones={layer === 'explorado' ? [] : mapZones}
        myFaction={faction}
        onlyMine={layer === 'meu-time'}
        explored={explored}
        center={MAP_CENTER}
        span={MAP_SPAN}
        user={DEMO_CENTER}
        focus={focus}
        onRegionChange={onRegionChange}
        onZonePress={(id) => router.push({ pathname: '/zona/[id]', params: { id } })}
      />

      <View style={{ position: 'absolute', top: insets.top + space[2], left: space[4], right: space[4], gap: space[2] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            backgroundColor: colors.surface,
            borderRadius: radius.pill,
            paddingVertical: space[2],
            paddingLeft: space[2],
            paddingRight: space[4],
            boxShadow: floating,
          }}>
          <TeamBadge faction={faction} size={34} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">{factions[faction].name}</Text>
            <Text variant="caption" muted testID="mapa-status">
              {!hasZones && zonesLoading
                ? 'Carregando zonas…'
                : zonesOffline
                  ? `Sem internet: mostrando o último mapa salvo`
                  : zonesError && !hasZones
                    ? 'Não foi possível carregar as zonas'
                    : `${mine.length} zonas em ${city}`}
            </Text>
          </View>
          <Icon name="city" size={18} color={colors.textSecondary} />
        </View>

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {(
            [
              ['todos', 'Todos os times'],
              ['meu-time', 'Só meu time'],
              ['explorado', 'Onde já corri'],
            ] as const
          ).map(([key, label]) => {
            const on = layer === key;
            return (
              <Pressable
                key={key}
                testID={`mapa-camada-${key}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint="Filtra as zonas mostradas no mapa"
                accessibilityState={{ selected: on }}
                // QA-12: o desenho continua com 36 pt; a área de toque chega a 44 pt.
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                onPress={() => setLayer(key)}
                style={{
                  paddingHorizontal: space[4],
                  height: 36,
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  backgroundColor: on ? colors.text : colors.surface,
                  boxShadow: floating,
                }}>
                <Text variant="caption" color={on ? colors.surface : colors.text}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ position: 'absolute', right: space[4], bottom: 190 + insets.bottom, gap: space[3] }}>
        <View>
          <IconButton
            testID="mapa-notificacoes"
            icon="bell"
            label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
            onPress={() => router.push('/notificacoes')}
          />
          {unread > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 20,
                height: 20,
                paddingHorizontal: 5,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.action,
              }}>
              <Text variant="label" color={colors.onAction} tabular>
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          ) : null}
        </View>
        <IconButton
          testID="mapa-camada"
          icon="layers"
          label="Trocar camada do mapa"
          onPress={() => setLayer((l) => (l === 'todos' ? 'meu-time' : l === 'meu-time' ? 'explorado' : 'todos'))}
        />
      </View>

      <View style={{ position: 'absolute', left: space[4], right: space[4], bottom: space[4], gap: space[3] }}>
        {alert ? (
          <Pressable
            accessibilityRole="button"
            testID="mapa-alerta-ataque"
            accessibilityLabel={`Alerta: ${displayZoneName(alert.id, meta[alert.id]?.name)} sob ataque. Abrir zona.`}
            onPress={() => router.push({ pathname: '/zona/[id]', params: { id: alert.id } })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: space[3],
              boxShadow: floating,
            }}>
            <TeamBadge faction={alert.owner} attack size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">{displayZoneName(alert.id, meta[alert.id]?.name)} está sob ataque</Text>
              <Text variant="small" muted>
                {alert.attacker ? factions[alert.attacker].name : 'Rivais'} avançando. Corra lá e ganhe pontos em dobro.
              </Text>
            </View>
          </Pressable>
        ) : null}
        <Button testID="mapa-correr" label="Correr" icon="play" size="lg" wide onPress={() => router.push('/corrida')} />
      </View>
    </View>
  );
}
