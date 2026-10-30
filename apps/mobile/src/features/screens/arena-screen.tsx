import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Boss, ModeIcon, type ModeIconKind } from '@/components/art';
import { DemoBadge } from '@/components/demo-badge';
import { EmptyState } from '@/components/empty-state';
import { OfflineNotice } from '@/components/offline-notice';
import { Icon } from '@/components/icon';
import { PressableScale, ProgressBar, ProgressRing, ShimmerSkeleton, Stagger, useParallax } from '@/components/motion';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { Text } from '@/components/text';
import { formatPace } from '@/domain/geo';
import { useEngagementData } from '@/features/engagement';
import { NO_DATA } from '@/features/format';
import { missionA11y, missionRatio, pct } from '@/features/engagement/model';
import { useNow } from '@/features/use-now';
import { isDemoMode } from '@/services/api/env';
import { fetchLeagueCurrent, type LeagueCurrent } from '@/services/api/league-repo';
import { fetchRaidCurrent, type RaidCurrent, type Unavailable } from '@/services/api/raid-repo';
import { useGame, type MissionId } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { ArenaHelp, ArenaHelpButton } from './arena-screen-help';
import { atlasPercent, bossLook, hpRatio, missionRings, percentLabel, timeLeft } from './arena-screen.model';
import { useResource } from './use-resource';

/**
 * A Arena (T7.3.3, E6c): "o que jogar hoje" em 3 segundos.
 * 1. herói: o chefão da semana ilustrado (E4), com vida, fase, prazo e "Sua parte" REAIS (`raid_current`);
 * 2. as 3 missões do dia em anéis (E7) → `/missoes`;
 * 3. os 4 modos numa grade 2×2 com o estado ao vivo de cada um;
 * 4. a faixa da Liga (`league_current`).
 * D-76: sem dado verdadeiro (servidor antigo, recurso desligado, erro), estado ilustrado — nunca número inventado.
 * No modo demonstração, os dados de demonstração aparecem com o selo.
 */
export function ArenaScreen() {
  const faction = useSession((s) => s.profile?.faction ?? null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [headerH, setHeaderH] = useState(240);
  // Parallax sutil (0,3) no herói; com "Reduzir movimento" ele só esmaece.
  const parallax = useParallax(headerH, 0.3);

  const raid = useResource(() => fetchRaidCurrent(), []);
  const league = useResource(() => fetchLeagueCurrent(), []);
  const reloadRaid = raid.reload;
  const reloadLeague = league.reload;
  // Voltar à aba atualiza a vida do chefão e a posição na liga (e registra a visita, para o "desde a última").
  useFocusEffect(
    useCallback(() => {
      void reloadRaid();
      void reloadLeague();
    }, [reloadRaid, reloadLeague]),
  );

  return (
    <Animated.ScrollView
      testID="tela-arena"
      contentInsetAdjustmentBehavior="automatic"
      onScroll={parallax.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Stack.Screen options={{ headerRight: () => <ArenaHelpButton onPress={() => setHelpOpen(true)} /> }} />

      {/* D-95: um aviso só para o que falhou (chefão e liga); as seções ficam com "—" ou a arte, nunca com zero. */}
      {(raid.error && !raid.data) || (league.error && !league.data) ? (
        <OfflineNotice
          testID="arena-sem-conexao"
          code={(raid.error ?? league.error)?.code}
          hasData={raid.data !== null || league.data !== null}
          savedAt={raid.savedAt ?? league.savedAt}
          busy={raid.loading || league.loading}
          onRetry={() => {
            void reloadRaid();
            void reloadLeague();
          }}
        />
      ) : null}

      <Animated.View style={parallax.headerStyle} onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
        <RaidHero data={raid.data} failed={raid.error !== null && raid.data === null} />
      </Animated.View>

      <TodayMissions />

      <View style={{ gap: space[2] }}>
        <SectionHeader title="Modos" testID="arena-modos" />
        <ModesGrid />
      </View>

      <LeagueStrip data={league.data} failed={league.error !== null && league.data === null} />

      <ArenaHelp visible={helpOpen} team={faction ?? 'striders'} onClose={() => setHelpOpen(false)} />
    </Animated.ScrollView>
  );
}

/* ------------------------------------------------------------------ herói: o chefão da semana */

function RaidHero({ data, failed }: { data: RaidCurrent | Unavailable | null; failed: boolean }) {
  const { colors } = useTheme();
  const now = useNow(60_000);

  if (data === null && !failed) {
    return <ShimmerSkeleton shape="card" height={300} accessibilityLabel="Carregando o chefão da semana" testID="arena-raid-carregando" />;
  }

  const boss = data && data.available ? data.raid : null;
  if (!data || !data.available || !boss) {
    // Sem chefão verdadeiro: o vilão aparece só em silhueta (D-76: nada de vida ou dano inventados). Falhou a carga
    // (D-95): a mesma silhueta e "—" no lugar da vida; quem explica e tenta de novo é o `OfflineNotice` do topo.
    return (
      <HeroFrame testID={failed ? 'arena-raid-sem-dado' : 'arena-raid-vazio'}>
        <EmptyState
          art={<Boss id="soneca" silhouette={neon.villain} size={128} decorative />}
          tag="Raid"
          title={failed ? 'Chefão da semana' : data && data.available ? 'Chefão chega segunda, 6h' : 'O chefão ainda não chegou'}
          body={failed ? `Vida: ${NO_DATA} · Prazo: ${NO_DATA}` : undefined}
          compact
        />
      </HeroFrame>
    );
  }

  const look = bossLook(boss);
  const life = hpRatio(boss);
  const active = boss.status === 'active';
  return (
    <HeroFrame testID="arena-raid">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <Text variant="label" color={neon.villain} style={{ textTransform: 'uppercase' }} numberOfLines={1}>
          Chefão da semana
        </Text>
        {boss.isDemo || isDemoMode() ? <DemoBadge testID="arena-raid-demonstracao" /> : null}
      </View>
      <View style={{ alignItems: 'center' }}>
        <Boss id={boss.bossId ?? 'soneca'} state={look.state} dano={look.dano} size={168} animated={active} accessibilityLabel={`${boss.name}, fase ${boss.phase} de 3`} testID="arena-raid-chefao" />
      </View>
      <Text variant="headline" accessibilityRole="header" numberOfLines={2} testID="arena-raid-nome">
        {boss.name}
      </Text>
      <ProgressBar value={life} color={neon.villain} trackColor={colors.surfaceSunken} segments={3} height={12} glow accessibilityLabel={`Vida do chefão: ${percentLabel(life)}`} testID="arena-raid-vida" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' }}>
        <Text variant="small" muted tabular>{`${percentLabel(life)} de vida · Fase ${boss.phase}`}</Text>
        <Text variant="small" color={active ? colors.accentText : colors.textSecondary} testID="arena-raid-prazo">
          {boss.status === 'defeated' ? 'A cidade venceu!' : boss.status === 'escaped' ? 'Fugiu desta vez' : `Foge em ${timeLeft(boss.endsAt - now)}`}
        </Text>
      </View>
      <StatTile testID="arena-raid-parte" label="Sua parte" value={percentLabel(data.share)} accent={colors.accentText} />
    </HeroFrame>
  );
}

/** Moldura do herói: filete violeta (D-67: violeta só para vilões). */
function HeroFrame({ children, testID }: { children: ReactNode; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View aria-hidden style={{ height: 3, backgroundColor: neon.villain }} />
      <View style={{ padding: space[4], gap: space[3] }}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ missões do dia (E7) */

function TodayMissions() {
  const { colors } = useTheme();
  const { missions } = useEngagementData();
  const rings = missionRings(missions.data);
  const loading = missions.status === 'loading' && missions.data === null;
  // Sem missão de verdade (servidor antigo, recurso desligado, erro), a seção some: nada de anel vazio.
  if (!loading && rings.length === 0) return null;
  return (
    <View style={{ gap: space[2] }}>
      <SectionHeader title="Missões de hoje" actionLabel="Ver todas" onAction={() => router.push('/missoes')} testID="arena-missoes" />
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {loading
          ? [0, 1, 2].map((i) => <ShimmerSkeleton key={i} shape="card" height={128} style={{ flex: 1 }} accessibilityLabel="Carregando as missões" testID={`arena-missao-carregando-${i}`} />)
          : rings.map((m) => {
              const done = m.completedAt !== null;
              const ratio = missionRatio(m);
              return (
                <PressableScale
                  key={m.id}
                  testID={`arena-missao-${m.slot}`}
                  accessibilityRole="button"
                  accessibilityLabel={missionA11y(m)}
                  accessibilityHint="Abre as missões"
                  onPress={() => router.push('/missoes')}
                  containerStyle={{ flex: 1 }}
                  style={{ flex: 1, alignItems: 'center', gap: space[2], padding: space[3], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: done ? colors.action : colors.line }}>
                  <ProgressRing value={ratio} size={56} stroke={6} color={colors.action} trackColor={colors.surfaceSunken} accessibilityLabel={missionA11y(m)}>
                    {done ? (
                      <Icon name="check" size={22} color={colors.accentText} />
                    ) : (
                      <Text variant="caption" tabular maxFontSizeMultiplier={1.2}>
                        {pct(ratio)}
                      </Text>
                    )}
                  </ProgressRing>
                  <Text variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                    {m.title}
                  </Text>
                </PressableScale>
              );
            })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ modos (grade 2×2) */

type Tile = { kind: ModeIconKind; title: string; status: string; hint: string; onPress: () => void };

function ModesGrid() {
  const setMission = useGame((s) => s.setMission);
  const ghostPace = useGame((s) => s.ghostPace);
  const chests = useGame((s) => s.openedChests.length);
  const fog = useGame((s) => s.fog);
  const zones = useGame((s) => s.serverRuns.reduce((n, r) => n + (r.result?.zones ?? []).filter((z) => z.outcome === 'conquered').length, 0));
  // D-95: zonas e Atlas só com o dado do servidor; antes dele (ou sem conexão), "—" em vez de "0 zonas" e "0%".
  const zonesKnown = useGame((s) => s.sync.history.at !== null);
  const fogKnown = useGame((s) => s.sync.fog.at !== null);
  const play = (mission: MissionId) => () => {
    setMission(mission);
    router.push('/corrida');
  };
  const tiles: Tile[] = [
    { kind: 'fuga', title: 'Fuga', status: `Fantasma a ${formatPace(ghostPace)}/km`, hint: 'Corre com este modo', onPress: play('fuga') },
    { kind: 'caca', title: 'Caça', status: `${chests} baús abertos`, hint: 'Corre com este modo', onPress: play('caca') },
    { kind: 'dominio', title: 'Domínio', status: zonesKnown ? `${zones} ${zones === 1 ? 'zona' : 'zonas'}` : `${NO_DATA} zonas`, hint: 'Abre o mapa', onPress: () => router.navigate('/') },
    { kind: 'atlas', title: 'Atlas', status: fogKnown ? `${atlasPercent(fog)}% do bairro` : `${NO_DATA} do bairro`, hint: 'Abre o mapa', onPress: () => router.navigate('/') },
  ];
  return (
    <Stagger delay={120} gap={space[2]} style={{ flexDirection: 'row', flexWrap: 'wrap' }} itemStyle={{ flexBasis: '46%', flexGrow: 1 }}>
      {tiles.map((t) => (
        <ModeTile key={t.kind} tile={t} />
      ))}
    </Stagger>
  );
}

function ModeTile({ tile }: { tile: Tile }) {
  const { colors } = useTheme();
  const playable = tile.kind === 'fuga' || tile.kind === 'caca';
  return (
    <PressableScale
      testID={`arena-modo-${tile.kind}`}
      accessibilityRole="button"
      accessibilityLabel={`${tile.title}: ${tile.status}`}
      accessibilityHint={tile.hint}
      onPress={tile.onPress}
      containerStyle={{ flex: 1 }}
      style={{ flex: 1, minHeight: 132, gap: space[2], padding: space[3], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: playable ? colors.action : colors.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <ModeIcon kind={tile.kind} size={48} />
        <Icon name={playable ? 'play' : 'chevron'} size={16} color={playable ? colors.accentText : colors.textSecondary} />
      </View>
      <Text variant="bodyBold">{tile.title}</Text>
      <Text variant="caption" muted numberOfLines={2}>
        {tile.status}
      </Text>
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ faixa da Liga */

function LeagueStrip({ data, failed }: { data: LeagueCurrent | Unavailable | null; failed: boolean }) {
  const { colors } = useTheme();
  // D-95: o esqueleto termina. Falhou a carga: a faixa fica com "—" (o aviso do topo explica e tenta de novo).
  if (data === null && failed) {
    return (
      <View
        testID="arena-liga-sem-dado"
        accessible
        accessibilityLabel="Liga: sem dado agora"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], minHeight: 72, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <ModeIcon kind="liga" size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyBold">Liga</Text>
          <Text variant="caption" muted>
            {`Posição: ${NO_DATA}`}
          </Text>
        </View>
      </View>
    );
  }
  if (data === null) return <ShimmerSkeleton shape="row" height={72} accessibilityLabel="Carregando a liga" testID="arena-liga-carregando" />;
  const live = data.available ? data : null;
  const me = live?.me ?? null;
  return (
    <View
      testID={live ? 'arena-liga' : 'arena-liga-vazio'}
      accessible
      accessibilityLabel={live ? `Liga ${live.divisionName}. ${me ? `${me.position}º de ${live.groupSize}${live.promoteSlots > 0 ? `, os ${live.promoteSlots} primeiros sobem` : ''}` : 'Sua primeira corrida da semana entra na liga'}` : 'Liga em breve'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], minHeight: 72, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: live ? 1 : 0.8 }}>
      <ModeIcon kind="liga" size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold" numberOfLines={1}>
          {live ? `Liga ${live.divisionName}` : 'Liga em breve'}
        </Text>
        {live ? (
          <Text variant="caption" muted numberOfLines={1}>
            {me ? `${me.position}º de ${live.groupSize}${live.promoteSlots > 0 ? ` · top ${live.promoteSlots} sobe` : ''}` : 'Corra para entrar'}
          </Text>
        ) : null}
        {/* Selo embaixo do texto: ao lado, ele cortava a posição em 390 pt. */}
        {live && isDemoMode() ? <DemoBadge testID="arena-liga-demonstracao" /> : null}
      </View>
    </View>
  );
}
