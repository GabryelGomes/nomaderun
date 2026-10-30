import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyArt, TeamEmblem } from '@/components/art';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState } from '@/components/surface';
import { Text } from '@/components/text';
import { CountUp, FadeUp, ProgressBar, RevealText, ShimmerSkeleton, Stagger } from '@/components/motion';
import { cellCenter } from '@/domain/grid';
import type { LiveSnapshot } from '@/domain/live-events';
import type { Zone } from '@/domain/territory';
import { neonTeam } from '@/theme/neon';
import type { FactionId } from '@/domain/types';
import { zoneName } from '@/demo/demo-data';
import { useNow } from '@/features/use-now';
import { fetchPaintNear } from '@/services/api/paint-repo';
import { fetchZoneDetail, type ZoneDetail, type ZoneEventType } from '@/services/api/zones-repo';
import { selectBasePace, useGame } from '@/store/game-store';
import { useZones } from '@/store/zones-store';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useResource } from './use-resource';
import { countdownText, shortTeam, zoneView, type ZoneView } from './zone-sheet.model';

const EVENT_TEXT: Record<ZoneEventType, (f: string, from: string | null) => string> = {
  // Ajuste de texto (E6): o selo do time fica ao lado de cada linha; o texto diz só o que aconteceu.
  captured: (f, from) => (from ? `${f} tomaram dos ${from}` : `${f} conquistaram`),
  under_attack: (f) => `${f} atacaram`,
  defended: (f) => `${f} defenderam`,
  neutralized: (_f, from) => `Neutra${from ? ` (era dos ${from})` : ''}`,
  shield_up: (f) => `${f}: escudo ligado`,
  shield_down: (f) => `${f}: escudo caiu`,
};

const teamName = (f: FactionId | null) => (f ? factions[f].name : 'Rivais');

export function eventText(e: ZoneDetail['events'][number]): string {
  const fn = EVENT_TEXT[e.type];
  return fn ? fn(teamName(e.faction), e.from ? factions[e.from].name : null) : 'Atualização da zona';
}

function timeAgo(at: number, now: number): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/** Raio do retrato pedido para a folha: só a zona (H3 res 9, ~175 m de lado) e a borda. */
const SHEET_PAINT_RADIUS_M = 400;

/**
 * Retrato da pintura em volta da zona: `LiveSnapshot` (regra v2), `null` (regra v1: o servidor não tem a
 * pintura) ou `undefined` enquanto a resposta não chega.
 */
function useZonePaint(id: string | undefined): LiveSnapshot | null | undefined {
  const [state, setState] = useState<{ id: string; paint: LiveSnapshot | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let center;
    try {
      center = cellCenter(id);
    } catch {
      return;
    }
    void fetchPaintNear(center, SHEET_PAINT_RADIUS_M).then((res) => {
      if (alive) setState({ id, paint: res.ok && res.data.available ? res.data.snapshot : null });
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return state && state.id === id ? state.paint : undefined;
}

/** Placar de 2 cores (dono × rival mais forte), com o emblema de cada time: nunca só a cor. */
function ZoneScore({ view }: { view: ZoneView }) {
  const { colors } = useTheme();
  const bar = view.bar;
  if (!bar) return null;
  const label = `${shortTeam(bar.left)} ${bar.leftValue}${bar.right ? ` contra ${bar.rightValue} ${shortTeam(bar.right)}` : ''}`;
  return (
    <View testID="zona-placar" style={{ gap: space[2] }} accessible accessibilityLabel={`Placar: ${label}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <TeamBadge faction={bar.left} size={16} />
        <Text variant="bodyBold" tabular style={{ flex: 1 }} numberOfLines={1}>
          {shortTeam(bar.left)} {bar.leftValue.toLocaleString('pt-BR')}
        </Text>
        {bar.right ? (
          <>
            <Text variant="bodyBold" tabular numberOfLines={1}>
              {bar.rightValue.toLocaleString('pt-BR')} {shortTeam(bar.right)}
            </Text>
            <TeamBadge faction={bar.right} size={16} />
          </>
        ) : null}
      </View>
      <ProgressBar
        value={bar.share}
        color={neonTeam[bar.left]}
        trackColor={bar.right ? neonTeam[bar.right] : colors.surfaceSunken}
        ghost={false}
        height={12}
        delay={200}
        accessibilityLabel={`${Math.round(bar.share * 100)}% para ${factions[bar.left].name}`}
      />
    </View>
  );
}

/**
 * Folha da zona (T7.3.2, wireframe 15): o dono ilustrado, o placar de 2 cores, o relógio da defesa, 1 frase de
 * regra, "faltam X m" e a ação — tudo no detent 0,55. Histórico e maiores corredores ficam recolhidos.
 */
export function ZoneSheet() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cached = useZones((s) => (id ? s.zones[id] : undefined));
  const cachedName = useZones((s) => (id ? s.meta[id]?.name : null));
  const faction = useGame((s) => s.faction) ?? 'striders';
  const basePace = useGame(selectBasePace);
  const now = useNow(30_000);
  const paint = useZonePaint(id);
  const [history, setHistory] = useState(false);
  const {
    data: detail,
    error,
    loading,
    reload: load,
  } = useResource(async () => {
    const res = await fetchZoneDetail(String(id));
    if (res.ok) useZones.getState().upsertZones({ [res.data.zone.id]: res.data.zone }, { [res.data.zone.id]: res.data.meta });
    return res;
  }, [id]);

  // Realtime: a troca de dono que chega no store aparece aqui sem recarregar a folha.
  const zone: Zone | undefined = cached ?? detail?.zone;
  const name = detail?.meta.name ?? cachedName ?? (id ? zoneName(id) : '');
  const sheetBg = process.env.EXPO_OS === 'ios' ? 'transparent' : colors.surface;
  const goRun = () => {
    router.back();
    router.push('/corrida');
  };

  if (!zone) {
    if (loading) {
      return (
        <View testID="zona-carregando" style={{ flex: 1, padding: space[6], gap: space[4], backgroundColor: sheetBg }}>
          <ShimmerSkeleton shape="card" height={72} accessibilityLabel="Carregando a zona" />
          <ShimmerSkeleton shape="line" lines={2} />
        </View>
      );
    }
    if (error && error.code !== 'NOT_FOUND') {
      return (
        <EmptyState
          title={error.code === 'NETWORK' ? 'Sem internet' : 'Zona indisponível'}
          body={error.code === 'NETWORK' ? 'Confira a conexão.' : error.message}
          action={<Button testID="zona-tentar" label="Tentar de novo" kind="secondary" onPress={load} />}
        />
      );
    }
    return (
      <View testID="zona-vazia" style={{ flex: 1, alignItems: 'center', padding: space[6], gap: space[3], backgroundColor: sheetBg }}>
        <EmptyArt kind="sem-zonas" team={faction} size={160} />
        <Text variant="title">Ninguém correu aqui</Text>
        <Text muted>A 1ª corrida pinta a zona.</Text>
        <Button testID="zona-vazia-correr" label="Correr aqui" icon="play" size="lg" wide onPress={goRun} />
      </View>
    );
  }

  const view = zoneView({ zone, faction, now, paint: paint ?? null, basePaceSecPerKm: basePace });
  const ranked = detail?.topRunners ?? [];
  const events = detail?.events ?? [];

  return (
    <ScrollView testID="tela-zona" style={{ flex: 1, backgroundColor: sheetBg }} contentContainerStyle={{ padding: space[6], paddingBottom: space[12], gap: space[4] }}>
      {/* 1. Herói: o dono ilustrado (mascote do time) ou a zona vazia. */}
      <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
        <View style={{ width: 64, height: 70, alignItems: 'center', justifyContent: 'center' }}>
          {zone.owner ? <TeamEmblem team={zone.owner} size={64} variant="medio" /> : <EmptyArt kind="sem-zonas" size={64} quality="plano" />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <RevealText variant="title" header testID="zona-nome">
            {name}
          </RevealText>
          <FadeUp delay={120} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <TeamBadge faction={zone.owner} size={16} attack={view.attackEndsAt !== null} />
            <Text variant="small" muted numberOfLines={1} testID="zona-dono">
              {view.ownerLine}
            </Text>
          </FadeUp>
        </View>
      </View>

      {/* 2. Placar de 2 cores (trechos na v2, domínio na v1). */}
      <ZoneScore view={view} />

      {/* 3. O relógio da defesa: número grande. */}
      {view.attackEndsAt !== null ? (
        <View
          testID="zona-ataque"
          accessible
          accessibilityLabel={`Sob ataque dos ${teamName(zone.attacker)}. ${countdownText(view.attackEndsAt, now)} para defender`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.lineControl }}>
          <Icon name="shield" size={24} color={colors.text} />
          {/* UX-09: contagem por extenso ("Faltam 17 h 30 min"); "17:30" parecia horário. */}
          <View style={{ flex: 1 }}>
            <Text variant="title" tabular>
              {countdownText(view.attackEndsAt, now)}
            </Text>
            <Text variant="small" muted>
              para defender
            </Text>
          </View>
        </View>
      ) : null}

      {/* 4. 1 frase de regra e o "faltam X m" (E3: paintZoneGap na v2, influenceGapV1 na v1). */}
      <View style={{ gap: 2 }}>
        <Text testID="zona-regra">{view.ruleLine}</Text>
        {paint === undefined ? (
          <ShimmerSkeleton shape="line" width={180} height={14} accessibilityLabel="Calculando quanto falta" />
        ) : view.gapLine ? (
          <Text variant="bodyBold" color={colors.accentText} testID="zona-faltam" accessibilityLiveRegion="polite">
            {view.gapLine}
          </Text>
        ) : null}
      </View>

      {/* 5. A ação: sempre visível no detent 0,55. */}
      <Button testID="zona-correr" label={view.cta} icon={view.attackEndsAt !== null && zone.owner === faction ? 'shield' : 'play'} size="lg" wide onPress={goRun} />

      {error && error.code === 'NETWORK' ? (
        <View testID="zona-offline" accessible accessibilityLabel="Sem internet: últimos dados salvos" style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Icon name="warning" size={14} color={colors.textSecondary} />
          <Text variant="small" muted>
            Offline · dados salvos
          </Text>
        </View>
      ) : null}

      {/* 6. Detalhes sob demanda: maiores corredores e acontecimentos. */}
      {ranked.length > 0 || events.length > 0 ? (
        <Button
          testID="zona-historico"
          label={history ? 'Esconder histórico' : 'Ver histórico'}
          kind="ghost"
          icon="activities"
          accessibilityState={{ expanded: history }}
          onPress={() => setHistory((h) => !h)}
        />
      ) : null}
      {history && ranked.length > 0 ? (
        <View style={{ gap: space[2] }} testID="zona-corredores">
          <Text variant="caption" muted>
            Top da temporada
          </Text>
          <Stagger gap={space[2]}>
            {ranked.map((r, i) => (
              <View key={`${r.username}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 24 }}>
                <Text variant="bodyBold" tabular style={{ width: 20 }}>
                  {i + 1}
                </Text>
                <TeamBadge faction={r.faction} size={20} />
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {r.username}
                </Text>
                <CountUp value={r.rp} variant="bodyBold" unit="pts" delay={120} accessibilityLabel={`${r.username}: ${r.rp.toLocaleString('pt-BR')} pontos`} />
              </View>
            ))}
          </Stagger>
        </View>
      ) : null}
      {history && events.length > 0 ? (
        <View style={{ gap: space[2] }} testID="zona-eventos">
          <Text variant="caption" muted>
            Últimos acontecimentos
          </Text>
          <Stagger gap={space[2]}>
            {events.slice(0, 5).map((e, i) => (
              <View key={`${e.at}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <TeamBadge faction={e.faction} size={16} />
                <Text variant="small" style={{ flex: 1 }}>
                  {eventText(e)}
                </Text>
                <Text variant="small" muted>
                  {timeAgo(e.at, now)}
                </Text>
              </View>
            ))}
          </Stagger>
        </View>
      ) : null}
    </ScrollView>
  );
}
