import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { FadeUp } from '@/components/motion';
import { tabBarClearance } from '@/components/screen';
import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import type { MapBounds } from '@/components/territory-map.types';
import { cellCenter } from '@/domain/grid';
import { DEFENSE_WINDOW_MS, defenseWindowOpen } from '@/domain/territory';
import type { LatLng } from '@/domain/types';
import { DEMO_CENTER, DEMO_CITY, zoneName } from '@/demo/demo-data';
import { mapZonesInBounds } from '@/features/map-data';
import { useNow } from '@/features/use-now';
import { bboxAround } from '@/services/api/zones-repo';
import { currentPosition } from '@/services/location/current';
import { useGame } from '@/store/game-store';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
import { factions, floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CounterBadge } from './game-motion';
import { mapControlsTop } from './game-motion-math';
import { LayerChips, type Layer } from './map-layer-chips';

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
  const now = useNow(60_000);
  const fog = useGame((s) => s.fog);
  const [layer, setLayer] = useState<Layer>('todos');
  const [alertCollapsed, setAlertCollapsed] = useState(false);
  const [bounds, setBounds] = useState<MapBounds>(INITIAL_BOUNDS);
  const requestBbox = useLiveZones();
  // Posição real do corredor (revisão nº 1, A-2): centraliza o mapa e carrega as zonas em volta.
  // Sem permissão/GPS, o mapa fica na região de demonstração (Goiânia), rotulada como tal.
  const [here, setHere] = useState<LatLng | null>(null);
  useEffect(() => {
    let alive = true;
    void currentPosition().then((p) => {
      if (!alive || !p) return;
      setHere(p);
      void useZones.getState().loadBbox(bboxAround(p, MAP_SPAN * 0.8));
    });
    return () => {
      alive = false;
    };
  }, []);
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
  // E-04: o ataque só vale (e a defesa só rende em dobro) dentro da janela de 24 h; depois disso não há alerta.
  const attacked = mine.filter((z) => defenseWindowOpen(z, now));
  const alert = attacked[0];
  const defenseEnds = alert?.attackStartedAt != null ? new Date(alert.attackStartedAt + DEFENSE_WINDOW_MS).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

  const alertName = alert ? displayZoneName(alert.id, meta[alert.id]?.name) : '';
  const statusError = !!zonesError && !hasZones && !zonesOffline && !zonesLoading;
  // Topo: pílula de status (8 + 56) + linha de filtros (8 + 44). Os controles ficam logo abaixo, à direita,
  // e a zona do polegar fica só com o alerta compacto e o "Correr": o mapa é o protagonista.
  const controlsTop = mapControlsTop(insets.top);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TerritoryMap
        zones={layer === 'explorado' ? [] : mapZones}
        myFaction={faction}
        onlyMine={layer === 'meu-time'}
        explored={explored}
        center={MAP_CENTER}
        span={MAP_SPAN}
        user={here}
        focus={focus ?? here ?? undefined}
        onRegionChange={onRegionChange}
        onZonePress={(id) => router.push({ pathname: '/zona/[id]', params: { id } })}
      />

      <View style={{ position: 'absolute', top: insets.top + space[2], left: 0, right: 0, gap: space[2] }}>
        <View
          style={{
            marginHorizontal: space[4],
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
            <Text variant="bodyBold" numberOfLines={1}>
              {factions[faction].name}
            </Text>
            <Text variant="caption" muted numberOfLines={1} testID="mapa-status">
              {!hasZones && zonesLoading
                ? 'Carregando zonas…'
                : zonesOffline
                  ? `Sem internet: mostrando o último mapa salvo`
                  : zonesError && !hasZones
                    ? 'Não foi possível carregar as zonas'
                    : here
                      ? `${mine.length} zonas em ${city}`
                      : `${mine.length} zonas em ${DEMO_CITY} · demonstração`}
            </Text>
          </View>
          {statusError ? (
            <Pressable
              testID="mapa-tentar"
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar as zonas de novo"
              hitSlop={8}
              onPress={() => void useZones.getState().loadBbox(bounds)}
              style={{ minHeight: 36, justifyContent: 'center' }}>
              <Text variant="caption" color={colors.action}>
                Tentar de novo
              </Text>
            </Pressable>
          ) : !hasZones && zonesLoading ? (
            <ActivityIndicator color={colors.action} />
          ) : (
            <Icon name="city" size={18} color={colors.textSecondary} />
          )}
        </View>

        <LayerChips value={layer} onChange={setLayer} />
      </View>

      <View style={{ position: 'absolute', right: space[4], top: controlsTop, gap: space[3] }}>
        <View>
          <IconButton testID="mapa-notificacoes" icon="bell" label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'} onPress={() => router.push('/notificacoes')} />
          <CounterBadge unread={unread} color={colors.action} textColor={colors.onAction} />
        </View>
        <IconButton testID="mapa-camada" icon="layers" label="Trocar camada do mapa" onPress={() => setLayer((l) => (l === 'todos' ? 'meu-time' : l === 'meu-time' ? 'explorado' : 'todos'))} />
      </View>

      {/* Acima da barra de abas flutuante do iOS (o "Correr" ficava atrás dela no iPhone 15). */}
      <View style={{ position: 'absolute', left: space[4], right: space[4], bottom: tabBarClearance(insets.bottom), gap: space[2] }}>
        {alert && !alertCollapsed ? (
          // Alerta compacto (uma linha de título + uma de apoio) que entra por baixo; recolhível ao lado do "Correr".
          <FadeUp key={alert.id} distance={24} duration={600} curve="reveal" delay={200}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', boxShadow: floating }}>
              <Pressable
                accessibilityRole="button"
                testID="mapa-alerta-ataque"
                accessibilityLabel={`Alerta: ${alertName} sob ataque. Abrir zona.`}
                onPress={() => router.push({ pathname: '/zona/[id]', params: { id: alert.id } })}
                style={{ flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], paddingLeft: space[3] }}>
                <TeamBadge faction={alert.owner} attack size={32} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {alertName}
                  </Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    Sob ataque dos {alert.attacker ? factions[alert.attacker].name : 'rivais'} · dobro até {defenseEnds}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                testID="mapa-alerta-recolher"
                accessibilityRole="button"
                accessibilityLabel="Recolher alerta de ataque"
                onPress={() => setAlertCollapsed(true)}
                style={{ width: 44, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </FadeUp>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {alert && alertCollapsed ? (
            <Pressable
              testID="mapa-alerta-expandir"
              accessibilityRole="button"
              accessibilityLabel={`${alertName} sob ataque. Mostrar alerta.`}
              onPress={() => setAlertCollapsed(false)}
              style={{
                width: 60,
                height: 60,
                borderRadius: radius.lg,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                boxShadow: floating,
              }}>
              <TeamBadge faction={alert.owner} attack size={32} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button testID="mapa-correr" label="Correr" icon="play" size="lg" wide onPress={() => router.push('/corrida')} />
          </View>
        </View>
      </View>
    </View>
  );
}
