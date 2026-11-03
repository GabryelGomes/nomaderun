import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertSlot, pickAlert, type SlotAlert } from '@/components/alert-slot';
import { BigRunButton } from '@/components/big-run-button';
import { IconButton } from '@/components/button';
import { DailyStrip, type DailyItem } from '@/components/daily-strip';
import { useDemoSealSpace } from '@/components/demo-badge';
import { MissionCoachCard } from '@/components/mission-coach-card';
import { FadeUp, ShimmerSkeleton } from '@/components/motion';
import { tabBarClearance } from '@/components/screen';
import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import type { MapBounds } from '@/components/territory-map.types';
import { cellCenter } from '@/domain/grid';
import type { LatLng } from '@/domain/types';
import { DEMO_CENTER, zoneName } from '@/demo/demo-data';
import { useOnboardingFlow } from '@/features/auth/onboarding-flow';
import { mapZonesInBounds } from '@/features/map-data';
import { loadHistory } from '@/features/run/run-controller';
import { useNow } from '@/features/use-now';
import { bboxAround } from '@/services/api/zones-repo';
import { currentPosition } from '@/services/location/current';
import { useGame } from '@/store/game-store';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
import { factions, floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { zoneDisplayName } from '@/features/format';

import { CounterBadge } from './game-motion';
import { mapControlsTop } from './game-motion-math';
import { LayerChips, type Layer } from './map-layer-chips';
import { changesSinceYesterday, changesText, expiredAttackKey, mapAlerts, todayChips, welcomeMission, zonesUnderAttack, type MapToday } from './map-screen.model';

const MAP_CENTER: LatLng = { lat: DEMO_CENTER.lat - 0.0035, lng: DEMO_CENTER.lng };
const MAP_SPAN = 2600;
/** Espera o mapa parar antes de pedir as zonas da área visível (RNF-009: sem rajada de pedidos). */
const BBOX_DEBOUNCE_MS = 600;
const INITIAL_BOUNDS: MapBounds = bboxAround(MAP_CENTER, MAP_SPAN * 0.8);
/** "O que mudou" desce, fica 4 s e some (E5, F1 §4.1). */
const CHANGES_VISIBLE_MS = 4000;

/** Nome do servidor quando houver; senão o nome local de demonstração. */
export function displayZoneName(id: string, serverName: string | null | undefined): string {
  return zoneDisplayName(serverName ?? zoneName(id));
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

/** Quantas corridas a pessoa já tem (servidor + aparelho); `null` enquanto o servidor não respondeu. */
function useRunCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void loadHistory().then((res) => {
      if (alive && res.ok) setCount(res.data.length + useGame.getState().localRuns.length);
    });
    return () => {
      alive = false;
    };
  }, []);
  return count;
}

export type MapScreenProps = {
  /**
   * Dados do dia (sequência, baú do dia, chefão e missão). Encaixe para o hook de engajamento da E7 e o da
   * Raid; sem eles, a faixa mostra só o que o app já sabe de verdade (sequência do servidor, boas-vindas).
   */
  today?: MapToday | null;
};

/**
 * Mapa (v2, T7.2.7): o mapa vivo é o herói; por cima, o que importa hoje em 3 segundos — meu time, a faixa
 * de hoje, o que mudou, **um** alerta (ou a missão) e o CORRER a 1 toque, na zona do polegar.
 */
export function MapScreen({ today }: MapScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const zones = useZones((s) => s.zones);
  const meta = useZones((s) => s.meta);
  const zonesError = useZones((s) => s.error);
  const zonesOffline = useZones((s) => s.offline);
  const zonesLoading = useZones((s) => s.loading);
  const hasZones = useZones((s) => Object.keys(s.zones).length > 0);
  const unread = useNotifications(selectUnreadCount);
  const notifications = useNotifications((s) => s.items);
  const faction = useGame((s) => s.faction) ?? 'striders';
  const streakWeeks = useGame((s) => s.streakWeeks);
  const now = useNow(60_000);
  const fog = useGame((s) => s.fog);
  const runCount = useRunCount();
  const [layer, setLayer] = useState<Layer>('todos');
  const [layersOpen, setLayersOpen] = useState(false);
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
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

  // "O que mudou desde ontem" (notificações do servidor das últimas 24 h): aparece 4 s ao abrir e some.
  const changes = useMemo(() => changesSinceYesterday(notifications, now), [notifications, now]);
  const [changesGone, setChangesGone] = useState(false);
  const hasChanges = changes !== null;
  useEffect(() => {
    if (!hasChanges) return;
    const t = setTimeout(() => setChangesGone(true), CHANGES_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [hasChanges]);

  // Regiões refeitas só quando as zonas mudam (ou um ataque vence): o ataque vencido sai do desenho (E-03).
  const expiredKey = expiredAttackKey(zones, now);
  const mapZones = useMemo(() => {
    const expired = new Set(expiredKey ? expiredKey.split(',') : []);
    return mapZonesInBounds(zones, bounds).map((z) => (expired.has(z.id) ? { ...z, attacker: null } : z));
  }, [zones, bounds, expiredKey]);
  const explored = useMemo(() => (layer === 'explorado' ? fog.slice(-600) : undefined), [fog, layer]);

  // Cidade do que está no mapa (zonas da área visível), não a cidade natal do perfil (QA E10).
  const mine = useMemo(() => Object.values(zones).filter((z) => z.owner === faction).length, [zones, faction]);
  const attacked = useMemo(() => zonesUnderAttack(zones, faction, now), [zones, faction, now]);
  const mission = today?.mission ?? welcomeMission(runCount);
  const dayToday: MapToday = { ...today, mission };
  const chips: DailyItem[] = todayChips(dayToday, streakWeeks).map(({ href, ...c }) => (href ? { ...c, onPress: () => router.push(href) } : c));
  const candidates = mapAlerts({
    attacked,
    zoneName: (id) => displayZoneName(id, meta[id]?.name),
    attackerName: (f) => (f ? factions[f].name : 'Rivais'),
    today: dayToday,
    now,
  }).filter((a) => !dismissed.includes(a.id));
  const slot: SlotAlert[] = candidates.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    body: a.body,
    onPress: () => (a.zoneId ? router.push({ pathname: '/zona/[id]', params: { id: a.zoneId } }) : router.push('/corrida')),
    onDismiss: () => setDismissed((d) => [...d, a.id]),
  }));
  // E10 (onda 4): na primeira sessão, o card de boas-vindas (WelcomeMissionOverlay, montado pelas abas) fica no mesmo
  // lugar; o Mapa cede a vaga a ele em vez de empilhar dois cards (um cobria o outro).
  const userId = useSession((s) => s.session?.userId ?? null);
  const welcomeOn = useOnboardingFlow((s) => !!userId && s.welcomeFor === userId);
  const top = welcomeOn ? null : pickAlert(slot);

  const statusError = !!zonesError && !hasZones && !zonesOffline && !zonesLoading;
  // E10 (onda 4): o selo "Demonstração" (DemoSeal, no alto e no centro) encostava no nome do time. Na
  // demonstração, o cabeçalho e os botões do mapa descem a altura do selo.
  const sealSpace = useDemoSealSpace();
  const headTop = insets.top + sealSpace;
  const controlsTop = mapControlsTop(headTop);

  return (
    <View testID="tela-mapa" style={{ flex: 1, backgroundColor: colors.background }}>
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

      <View style={{ position: 'absolute', top: headTop + space[2], left: space[4], right: space[4], gap: space[2] }}>
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
            <Text variant="bodyBold" numberOfLines={1}>
              {factions[faction].name}
            </Text>
            <Text variant="caption" muted numberOfLines={1} testID="mapa-status">
              {!hasZones && zonesLoading
                ? 'Carregando zonas…'
                : zonesOffline
                  ? `Sem internet: último mapa salvo`
                  : zonesError && !hasZones
                    ? 'Não deu para carregar as zonas'
                    : here
                      ? `Seu time: ${mine} ${mine === 1 ? 'zona' : 'zonas'}`
                      : `Seu time: ${mine} ${mine === 1 ? 'zona' : 'zonas'} · demonstração`}
            </Text>
          </View>
          {statusError ? (
            <Pressable
              testID="mapa-tentar"
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar as zonas de novo"
              hitSlop={8}
              onPress={() => void useZones.getState().loadBbox(bounds)}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text variant="caption" color={colors.action}>
                Tentar de novo
              </Text>
            </Pressable>
          ) : !hasZones && zonesLoading ? (
            <ShimmerSkeleton shape="circle" width={20} height={20} accessibilityLabel="Carregando zonas" />
          ) : (
            <Icon name="city" size={18} color={colors.textSecondary} />
          )}
        </View>

        {/* Faixa de hoje: só os chips verdadeiros (sem dado, o chip não existe). O sino fica abaixo (mapControlsTop). */}
        {/* A 360 pt os 3 chips não cabem com o rótulo inteiro: a linha rola na horizontal (sem cortar texto). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -space[4], marginVertical: -space[2] }}
          contentContainerStyle={{ paddingHorizontal: space[4], paddingVertical: space[2] }}>
          <DailyStrip items={chips} testID="mapa-hoje" />
        </ScrollView>

        {changes && !changesGone ? (
          <FadeUp distance={-12} duration={400}>
            <View
              testID="mapa-mudou"
              accessible
              accessibilityLiveRegion="polite"
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                minHeight: 36,
                paddingHorizontal: space[3],
                borderRadius: radius.pill,
                backgroundColor: colors.surface,
                boxShadow: floating,
              }}>
              <Icon name={changes.gained >= changes.lost ? 'flag' : 'warning'} size={14} color={changes.gained >= changes.lost ? colors.accentText : colors.textSecondary} />
              <Text variant="caption">{changesText(changes)}</Text>
            </View>
          </FadeUp>
        ) : null}
      </View>

      <View style={{ position: 'absolute', right: space[4], top: controlsTop, gap: space[3], alignItems: 'flex-end' }}>
        <View>
          <IconButton testID="mapa-notificacoes" icon="bell" label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'} onPress={() => router.push('/notificacoes')} />
          <CounterBadge unread={unread} color={colors.action} textColor={colors.onAction} />
        </View>
        <IconButton testID="mapa-camada" icon="layers" label={layersOpen ? 'Fechar camadas do mapa' : 'Camadas do mapa'} onPress={() => setLayersOpen((o) => !o)} />
        {layersOpen ? (
          <FadeUp distance={8} duration={200}>
            <LayerChips
              value={layer}
              onChange={(l) => {
                setLayer(l);
                setLayersOpen(false);
              }}
            />
          </FadeUp>
        ) : null}
      </View>

      {/* Zona do polegar, acima da barra de abas flutuante do iOS: 1 alerta (ou a missão) e o CORRER. */}
      <View style={{ position: 'absolute', left: space[4], right: space[4], bottom: tabBarClearance(insets.bottom), gap: space[3] }}>
        {top?.kind === 'mission' && mission ? (
          <FadeUp key={top.id} distance={24} duration={600} curve="reveal" delay={200}>
            <MissionCoachCard
              testID="mapa-missao"
              eyebrow={mission.eyebrow}
              title={mission.title}
              steps={mission.steps}
              done={mission.done}
              reward={mission.reward}
              demo={today?.demo}
              onPress={() => router.push(mission.href ?? '/corrida')}
            />
          </FadeUp>
        ) : top ? (
          <FadeUp key={top.id} distance={24} duration={600} curve="reveal" delay={200}>
            {/* O wrapper mantém o id dos fluxos Maestro ("mapa-alerta-ataque") enquanto eles não usam o do AlertSlot. */}
            <View testID={top.kind === 'attack' ? 'mapa-alerta-ataque' : undefined}>
              <AlertSlot alerts={[top]} testID="mapa-alerta" />
            </View>
          </FadeUp>
        ) : null}
        <BigRunButton testID="mapa-correr" onPress={() => router.push('/corrida')} />
      </View>
    </View>
  );
}
