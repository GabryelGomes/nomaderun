import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EmptyArt, TeamEmblem } from '@/components/art';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip-row';
import { DemoBadge } from '@/components/demo-badge';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { CountUp, PressableScale, ProgressBar, ShimmerSkeleton, Stagger, useParallax } from '@/components/motion';
import { SectionHeader } from '@/components/section-header';
import { TeamBadge } from '@/components/team-badge';
import { Text } from '@/components/text';
import { districtOf } from '@/domain/grid';
import type { FactionId } from '@/domain/types';
import { markRankingOpened } from '@/features/engagement';
import { CrewFeed } from '@/features/social/feed';
import { InviteCard } from '@/features/social/invite/invite-card';
import { getCrewWeekGoal, getMyCrew, type MyCrew } from '@/services/api/crews-repo';
import { isDemoMode } from '@/services/api/env';
import type { Result } from '@/services/api/errors';
import { getCityRanking, getDistrictLabel, getMyRecentZoneId, rankCrews, rankFactions, rankRunners } from '@/services/api/leaderboard-repo';
import { useSession } from '@/store/session-store';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { crewWeek, crewWeekFromGoal, emptyRankingText, hasPeriod, rankingQuery, scopesFor, type Board, type Me, type Period, type Scope } from './club-ranking';
import { GrowPillar, SwapFade } from './game-motion';
import { podiumOrder } from './game-motion-math';
import { useResource } from './use-resource';

export type RankingLine = { key: string; position: number; title: string; subtitle?: string; value: string; rp: number; faction?: FactionId | null; you?: boolean; unranked?: boolean };

const pts = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} pontos`;

/** Linhas do ranking escolhido, já no formato da lista (RF-015). */
async function loadBoard(board: Board, scope: Scope, period: Period, me: Me): Promise<Result<RankingLine[]>> {
  if (board === 'cidades') {
    // Guerra de Cidades (RN-013): só a temporada; cidade sem o mínimo de corredores fica sem posição.
    const res = await getCityRanking(20);
    return res.ok
      ? {
          ok: true as const,
          data: res.data.map(
            (c): RankingLine => ({
              key: c.city,
              position: c.position,
              title: c.city,
              subtitle: `${c.activeRunners.toLocaleString('pt-BR')} corredores`,
              value: c.score === null ? 'sem posição' : pts(c.score),
              rp: c.score === null ? 0 : Math.round(c.score),
              you: me.city !== null && c.city === me.city,
              unranked: c.score === null,
            }),
          ),
        }
      : res;
  }
  const q = rankingQuery(board, scope, period, me);
  if (!q) return { ok: true, data: [] };
  if (board === 'crews') {
    const res = await rankCrews(q);
    return res.ok
      ? {
          ok: true as const,
          data: res.data.map((r): RankingLine => ({ key: r.crewId, position: r.position, title: `${r.name} [${r.tag}]`, subtitle: `${r.members} corredores`, value: pts(r.rp), rp: r.rp, faction: r.faction })),
        }
      : res;
  }
  if (board === 'faccoes') {
    const res = await rankFactions(q);
    return res.ok
      ? {
          ok: true as const,
          data: res.data.map(
            (r): RankingLine => ({
              key: r.faction,
              position: r.position,
              title: factions[r.faction].name,
              subtitle: `${r.zones} zonas · ${r.runners} corredores`,
              value: pts(r.rp),
              rp: r.rp,
              faction: r.faction,
              you: r.faction === me.faction,
            }),
          ),
        }
      : res;
  }
  const res = await rankRunners(q);
  return res.ok
    ? {
        ok: true as const,
        data: res.data.map(
          (r): RankingLine => ({
            key: r.userId,
            position: r.position,
            title: r.crewTag ? `${r.username} [${r.crewTag}]` : r.username,
            subtitle: `${(r.meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`,
            value: pts(r.rp),
            rp: r.rp,
            faction: r.faction,
            you: r.userId === me.id,
          }),
        ),
      }
    : res;
}

/** Distrito da corrida mais recente (H3 res. 7) e o nome dele, para o escopo "distrito". */
async function loadMyDistrict(userId: string | null): Promise<Result<{ id: string; label: string } | null>> {
  if (!userId) return { ok: true, data: null };
  const zone = await getMyRecentZoneId(userId);
  if (!zone.ok) return zone;
  if (!zone.data) return { ok: true, data: null };
  const id = districtOf(zone.data);
  const label = await getDistrictLabel(id);
  return { ok: true, data: { id, label: label.ok ? label.data : 'Meu distrito' } };
}

type CrewWeekView = ReturnType<typeof crewWeek> & { goalMeters?: number };

/**
 * A semana da crew com a meta oficial de km (D-88, `crew_week_goal()`). Servidor antigo (sem a RPC): o ranking
 * semanal real (`ranking_runners`, período `week`), no time da crew, com a meta "todos correrem".
 */
async function loadCrewWeek(crew: MyCrew | null): Promise<Result<CrewWeekView | null>> {
  if (!crew) return { ok: true, data: null };
  const goal = await getCrewWeekGoal();
  if (goal.ok && goal.data) return { ok: true, data: crewWeekFromGoal(goal.data) };
  const f = crew.crew.faction;
  const res = await rankRunners({ period: 'week', scope: f ? 'faction' : 'general', value: f, limit: 500 });
  return res.ok ? { ok: true, data: crewWeek(res.data, crew.crew.tag, crew.members.length) } : res;
}

const BOARDS: readonly (readonly [Board, string])[] = [
  ['individual', 'Corredores'],
  ['crews', 'Crews'],
  ['faccoes', 'Times'],
  ['cidades', 'Cidades'],
];

/**
 * O Clube (T7.3.3, E6c): pertencer e competir.
 * 1. herói da crew: emblema (E4), a semana real da crew (km e quantos já correram) → abre a crew;
 *    sem crew: estado ilustrado com 1 ação;
 * 2. as corridas da crew (`<CrewFeed>` da E8, com "Bora!");
 * 3. o pódio com 1 linha de filtro (quadro + período/escopo recolhidos num chip).
 */
export function ClubScreen() {
  const { colors } = useTheme();
  const userId = useSession((s) => s.session?.userId ?? null);
  const city = useSession((s) => s.profile?.city ?? null);
  const faction = useSession((s) => s.profile?.faction ?? null);
  const [headerH, setHeaderH] = useState(200);
  // Parallax sutil (0,3) no herói da crew; com "Reduzir movimento" ele só esmaece.
  const parallax = useParallax(headerH, 0.3);

  const crew = useResource(() => getMyCrew(userId ?? ''), [userId]);
  const myCrew = crew.data;
  const week = useResource(() => loadCrewWeek(myCrew), [myCrew?.crew.id ?? null, myCrew?.members.length ?? 0]);
  const reloadCrew = crew.reload;
  useFocusEffect(
    useCallback(() => {
      void reloadCrew();
    }, [reloadCrew]),
  );

  return (
    <Animated.ScrollView
      testID="tela-clube"
      contentInsetAdjustmentBehavior="automatic"
      onScroll={parallax.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Animated.View style={parallax.headerStyle} onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
        {myCrew ? (
          <CrewHero crew={myCrew} week={week.data} />
        ) : crew.loading && !crew.error ? (
          <ShimmerSkeleton shape="card" height={200} accessibilityLabel="Carregando a sua crew" testID="clube-crew-carregando" />
        ) : (
          <View testID="clube-crew" style={{ borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line }}>
            <EmptyState
              testID="clube-sem-crew"
              art={<EmptyArt kind={crew.error ? 'sem-conexao' : 'sem-crew'} team={faction ?? undefined} size={160} />}
              title={crew.error ? 'Crew indisponível' : 'Corra junto, conquiste mais'}
              action={<Button testID="clube-crew-abrir" label={crew.error ? 'Tentar de novo' : 'Entrar ou criar crew'} onPress={() => (crew.error ? void crew.reload() : router.push('/clube/crew'))} />}
            />
          </View>
        )}
      </Animated.View>

      {myCrew && myCrew.members.length === 1 ? <InviteCard kind="crew" crewName={myCrew.crew.name} code={myCrew.crew.inviteCode} faction={myCrew.crew.faction} city={city} testID="clube-convite" /> : null}

      {myCrew ? (
        <View style={{ gap: space[2] }}>
          <SectionHeader title="Corridas da crew" testID="clube-feed" />
          <CrewFeed faction={faction} onJoinCrew={() => router.push('/clube/crew')} onCreateCrew={() => router.push('/clube/crew')} />
        </View>
      ) : null}

      <Rankings userId={userId} city={city} faction={faction} />
    </Animated.ScrollView>
  );
}

/* ------------------------------------------------------------------ herói da crew */

function CrewHero({ crew, week }: { crew: MyCrew; week: CrewWeekView | null }) {
  const { colors } = useTheme();
  const n = crew.members.length;
  const km = week ? Math.round(week.meters / 100) / 10 : null;
  const goalKm = week?.goalMeters ? Math.round(week.goalMeters / 1000) : null;
  return (
    <PressableScale
      testID="clube-crew"
      accessibilityRole="button"
      accessibilityLabel={`Sua crew: ${crew.crew.name}, ${n} corredores.${week ? ` ${km} km nesta semana${goalKm ? ` de ${goalKm} km da meta` : ''}, ${week.ran} de ${n} já correram.` : ''} Abrir.`}
      onPress={() => router.push('/clube/crew')}
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View aria-hidden style={{ height: 3, backgroundColor: crew.crew.faction ? factions[crew.crew.faction].color : colors.action }} />
      <View style={{ padding: space[4], gap: space[3] }}>
        {/* Selo numa linha própria: ao lado do nome, ele espremia o nome da crew em 360–390 pt. */}
        {isDemoMode() ? <DemoBadge testID="clube-crew-demonstracao" /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          {crew.crew.faction ? <TeamEmblem team={crew.crew.faction} size={72} /> : <TeamBadge faction={null} size={56} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" accessibilityRole="header" numberOfLines={2}>
              {crew.crew.name}
            </Text>
            <Text variant="small" muted numberOfLines={1}>{`[${crew.crew.tag}] · ${n} corredores`}</Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textSecondary} />
        </View>
        {week && km !== null ? (
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
              <CountUp testID="clube-crew-km" value={km} decimals={1} variant="metric" accessibilityLabel={`${km} km`} />
              <Text muted>km esta semana</Text>
            </View>
            <ProgressBar value={week.ratio} color={colors.action} trackColor={colors.surfaceSunken} accessibilityLabel={goalKm ? `${km} de ${goalKm} km da meta da semana` : `${week.ran} de ${n} já correram nesta semana`} testID="clube-crew-meta" />
            <Text variant="caption" muted>{goalKm ? `Meta ${goalKm} km · ${week.ran} de ${n} correram` : `${week.ran} de ${n} correram`}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ ranking: pódio + 1 linha de filtro */

function Rankings({ userId, city, faction }: { userId: string | null; city: string | null; faction: FactionId | null }) {
  const { colors } = useTheme();
  const [board, setBoard] = useState<Board>('individual');
  const [scope, setScope] = useState<Scope>('geral');
  const [period, setPeriod] = useState<Period>('week');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // E7: abrir o ranking conta para a missão "veja o ranking" (encaixe da onda 3).
  useEffect(() => {
    void markRankingOpened();
  }, []);
  const district = useResource(() => loadMyDistrict(userId), [userId]);
  const districtId = district.data?.id ?? null;
  const me: Me = { id: userId, city, faction, district: districtId };
  const boardScope = scopesFor(board).includes(scope) ? scope : 'geral';
  const ranking = useResource(() => loadBoard(board, boardScope, period, me), [board, boardScope, period, userId, city, faction, districtId]);
  const scopeLabels: Record<Scope, string> = { geral: 'Todos', cidade: city ?? 'Cidade', time: 'Time', distrito: district.data?.label ?? 'Bairro' };
  const periodLabels: Record<Period, string> = { week: 'Semana', season: 'Temporada' };
  const lines = ranking.data ?? [];
  const showPodium = lines.length >= 3 && !lines.slice(0, 3).some((l) => l.unranked);
  const youLabel = (r: RankingLine) => (r.you && board === 'individual' ? `${r.title} (você)` : r.title);
  const filterLabel = hasPeriod(board) ? `${periodLabels[period]} · ${scopeLabels[boardScope]}` : periodLabels.season;

  return (
    <View style={{ gap: space[3] }}>
      <SectionHeader title="Ranking" testID="ranking" />
      <ChipRow testID="ranking-quadro" accessibilityLabel="Ranking" role="button">
        {BOARDS.map(([key, label]) => (
          <Chip key={key} testID={`ranking-quadro-${key}`} accessibilityLabel={`Ranking: ${label}`} label={label} selected={board === key} role="button" onPress={() => setBoard(key)} />
        ))}
        {hasPeriod(board) ? (
          <Chip testID="ranking-filtros" accessibilityLabel={`Filtros: ${filterLabel}. ${filtersOpen ? 'Fechar' : 'Abrir'}`} label={`${filterLabel} ${filtersOpen ? '▴' : '▾'}`} selected={filtersOpen} role="button" onPress={() => setFiltersOpen((o) => !o)} />
        ) : null}
      </ChipRow>
      {filtersOpen && hasPeriod(board) ? (
        <View style={{ gap: space[1] }}>
          <ChipRow testID="ranking-periodo" accessibilityLabel="Período" role="button" size="sm" value={period} onChange={setPeriod} options={[['week', periodLabels.week], ['season', periodLabels.season]] as const} />
          <ChipRow testID="ranking-escopo" accessibilityLabel="Onde" role="button" size="sm" value={boardScope} onChange={setScope} options={scopesFor(board).map((k) => [k, scopeLabels[k]] as const)} />
        </View>
      ) : null}
      <SwapFade swapKey={`${board}-${boardScope}-${period}`}>
        {ranking.error && !ranking.data ? (
          <EmptyState
            testID="ranking-erro"
            art={<EmptyArt kind="sem-conexao" size={120} />}
            title={ranking.error.message}
            action={<Button testID="ranking-tentar" label="Tentar de novo" kind="secondary" onPress={() => void ranking.reload()} />}
            compact
          />
        ) : !ranking.data ? (
          <ShimmerSkeleton shape="card" height={220} accessibilityLabel="Carregando o ranking" testID="ranking-carregando" />
        ) : lines.length === 0 ? (
          <Text muted testID="ranking-vazio" style={{ textAlign: 'center', paddingVertical: space[4] }}>
            {emptyRankingText(board, boardScope, period, me)}
          </Text>
        ) : (
          <View style={{ gap: space[3] }}>
            {showPodium ? <Podium lines={lines.slice(0, 3)} label={youLabel} /> : null}
            {lines.length > (showPodium ? 3 : 0) ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line, paddingHorizontal: space[3], paddingVertical: space[2] }}>
                <Stagger delay={showPodium ? 400 : 100} gap={space[1]}>
                  {lines.slice(showPodium ? 3 : 0).map((r) => (
                    <View
                      key={r.key}
                      testID={`ranking-linha-${r.position}`}
                      accessible
                      accessibilityLabel={`${r.unranked ? '' : `${r.position}º `}${youLabel(r)}${r.subtitle ? `, ${r.subtitle}` : ''}: ${r.value}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44, borderRadius: radius.md, backgroundColor: r.you ? colors.surfaceSunken : undefined, paddingHorizontal: r.you ? space[2] : 0 }}>
                      <Text variant="bodyBold" tabular style={{ width: 24 }}>
                        {r.unranked ? '–' : r.position}
                      </Text>
                      {r.faction !== undefined ? <TeamBadge faction={r.faction} size={22} /> : null}
                      <View style={{ flex: 1 }}>
                        <Text variant={r.you ? 'bodyBold' : 'body'} numberOfLines={1}>
                          {youLabel(r)}
                        </Text>
                        {r.subtitle ? (
                          <Text variant="caption" muted numberOfLines={1}>
                            {r.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {r.unranked ? <Text muted>–</Text> : <CountUp value={r.rp} variant={r.you ? 'bodyBold' : 'body'} muted={!r.you} unit="pts" delay={450} accessibilityLabel={r.value} />}
                    </View>
                  ))}
                </Stagger>
              </View>
            ) : null}
          </View>
        )}
      </SwapFade>
    </View>
  );
}

const PODIUM_HEIGHT = [88, 64, 48] as const;

/** Momento herói do ranking: pódio dos 3 primeiros (pedestais crescem com expo.out, pontos contam). */
function Podium({ lines, label }: { lines: RankingLine[]; label: (r: RankingLine) => string }) {
  const { colors } = useTheme();
  // ordem visual: 2º · 1º · 3º. A altura vai pelo lugar na lista (empate repete a posição, o pódio não).
  const order = podiumOrder(lines.map((r, i) => ({ r, i })));
  return (
    <View
      testID="ranking-podio"
      accessible
      accessibilityLabel={`Pódio: ${lines.map((r) => `${r.position}º ${label(r)}, ${r.value}`).join('; ')}`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2], paddingTop: space[2] }}>
      {order.map(({ r, i: idx }) => {
        const first = idx === 0;
        return (
          <View key={r.key} style={{ flex: 1, alignItems: 'center', gap: space[1] }}>
            {r.faction !== undefined ? <TeamBadge faction={r.faction} size={first ? 40 : 32} /> : null}
            <Text variant="caption" muted={!r.you} numberOfLines={2} style={{ textAlign: 'center', alignSelf: 'stretch', minHeight: 34 }}>
              {label(r)}
            </Text>
            <CountUp value={r.rp} variant="bodyBold" unit="pts" delay={200 + idx * 80} accessibilityLabel={r.value} />
            <GrowPillar height={PODIUM_HEIGHT[idx]} delay={100 + idx * 80} color={first ? colors.text : colors.surface}>
              <Text variant="title" tabular color={first ? colors.surface : colors.text}>
                {r.position}
              </Text>
            </GrowPillar>
          </View>
        );
      })}
    </View>
  );
}
