import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { EmptyState } from '@/components/empty-state';
import { CountUp, FadeUp, PressableScale, Stagger, useParallax } from '@/components/motion';
import { StatTile } from '@/components/stat-tile';
import { Surface } from '@/components/surface';
import { TeamBadge } from '@/components/team-badge';
import { Text } from '@/components/text';
import { CITY_MIN_ACTIVE_RUNNERS } from '@/domain/games';
import type { FactionId } from '@/domain/types';
import { demoCityWar } from '@/demo/demo-data';
import { CREW_MAX_MEMBERS, getMyCrew } from '@/services/api/crews-repo';
import { districtOf } from '@/domain/grid';
import type { Result } from '@/services/api/errors';
import { getCityRanking, getDistrictLabel, getMyRecentZoneId, rankCrews, rankFactions, rankRunners } from '@/services/api/leaderboard-repo';
import { useSession } from '@/store/session-store';
import { factions, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { emptyRankingText, rankingQuery, scopesFor, type Board, type Me, type Period, type Scope } from './club-ranking';
import { GrowPillar, SectionTitle, SwapFade } from './game-motion';
import { podiumOrder } from './game-motion-math';
import { useResource } from './use-resource';

export type RankingLine = { key: string; position: number; title: string; subtitle?: string; value: string; rp: number; faction?: FactionId | null; you?: boolean };

/** Linhas do ranking escolhido, já no formato da lista (RF-015). */
async function loadBoard(board: Board, scope: Scope, period: Period, me: Me): Promise<Result<RankingLine[]>> {
  const q = rankingQuery(board, scope, period, me);
  if (!q) return { ok: true, data: [] };
  if (board === 'crews') {
    const res = await rankCrews(q);
    return res.ok
      ? {
          ok: true as const,
          data: res.data.map(
            (r): RankingLine => ({
              key: r.crewId,
              position: r.position,
              title: `${r.name} [${r.tag}]`,
              subtitle: `${r.members} corredores`,
              value: `${r.rp.toLocaleString('pt-BR')} RP`,
              rp: r.rp,
              faction: r.faction,
            }),
          ),
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
              value: `${r.rp.toLocaleString('pt-BR')} RP`,
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
            subtitle: `${(r.meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km · ${r.runs} ${r.runs === 1 ? 'corrida' : 'corridas'}`,
            value: `${r.rp.toLocaleString('pt-BR')} RP`,
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

export function ClubScreen() {
  const { colors } = useTheme();
  const userId = useSession((s) => s.session?.userId ?? null);
  const city = useSession((s) => s.profile?.city ?? null);
  const faction = useSession((s) => s.profile?.faction ?? null);
  const [board, setBoard] = useState<Board>('individual');
  const [scope, setScope] = useState<Scope>('geral');
  const [period, setPeriod] = useState<Period>('season');
  const [headerH, setHeaderH] = useState(200);
  // Parallax sutil (0,3) no card da crew; com reduzir movimento ele só esmaece.
  const parallax = useParallax(headerH, 0.3);

  const crew = useResource(() => getMyCrew(userId ?? ''), [userId]);
  const district = useResource(() => loadMyDistrict(userId), [userId]);
  const districtId = district.data?.id ?? null;
  const me: Me = { id: userId, city, faction, district: districtId };
  const boardScope = scopesFor(board).includes(scope) ? scope : 'geral';
  const ranking = useResource(() => loadBoard(board, boardScope, period, me), [board, boardScope, period, userId, city, faction, districtId]);
  const scopeLabels: Record<Scope, string> = {
    geral: 'Todos',
    cidade: city ? `Em ${city}` : 'Minha cidade',
    time: 'Meu time',
    distrito: district.data ? `Em ${district.data.label}` : 'Meu distrito',
  };
  const cities = useResource(() => getCityRanking(20), []);
  const reloadCrew = crew.reload;
  useFocusEffect(
    useCallback(() => {
      void reloadCrew();
    }, [reloadCrew]),
  );

  // Placar real quando o servidor tem cidades; senão o de demonstração, identificado como tal.
  const realCities = cities.data && cities.data.length > 0 ? cities.data : null;
  const war = realCities ? realCities.map((c) => ({ city: c.city, runners: c.activeRunners, score: c.score })) : demoCityWar().map((c) => ({ city: c.city, runners: c.runners, score: c.score }));
  const myCity = city ?? 'Goiânia';
  const myCrew = crew.data;

  const lines = ranking.data ?? [];
  const showPodium = lines.length >= 3;
  const youLabel = (r: RankingLine) => (r.you && board === 'individual' ? `${r.title} (você)` : r.title);

  const crewBody = myCrew ? (
    <Surface>
      <Text variant="caption" muted>
        Sua Crew
      </Text>
      <Text variant="headline" numberOfLines={2}>
        {myCrew.crew.name}
      </Text>
      {/* E-26: a barra "membros ÷ 30" não era meta de nada; ficam os dois números reais da crew. */}
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile testID="clube-crew-membros" label="Corredores" value={String(myCrew.members.length)} unit={`de ${CREW_MAX_MEMBERS}`} />
        <StatTile
          testID="clube-crew-km"
          label="Na temporada"
          value={(myCrew.members.reduce((n, m) => n + m.meters, 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          unit="km"
        />
      </View>
    </Surface>
  ) : (
    <Surface>
      <Text variant="caption" muted>
        Sua Crew
      </Text>
      {crew.loading && !crew.error ? (
        <ActivityIndicator color={colors.action} />
      ) : (
        <>
          <Text variant="headline">{crew.error ? 'Crew indisponível' : 'Sem crew ainda'}</Text>
          <Text muted>{crew.error ? crew.error.message : 'Crie uma crew com seus amigos ou entre com um código de convite.'}</Text>
          <Button testID="clube-crew-abrir" label={crew.error ? 'Tentar de novo' : 'Criar ou entrar'} kind="secondary" onPress={() => (crew.error ? void crew.reload() : router.push('/clube/crew'))} />
        </>
      )}
    </Surface>
  );

  return (
    <Animated.ScrollView
      testID="tela-clube"
      contentInsetAdjustmentBehavior="automatic"
      onScroll={parallax.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space[4], gap: space[8], paddingBottom: space[12] }}>
      {/* Cabeçalho com parallax sutil. Com crew, o card inteiro abre a crew; sem crew, só o botão abre (sem botão dentro de botão). */}
      <Animated.View style={parallax.headerStyle} onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
        {myCrew ? (
          <PressableScale testID="clube-crew" accessibilityRole="button" accessibilityLabel={`Sua crew: ${myCrew.crew.name}. Abrir.`} onPress={() => router.push('/clube/crew')}>
            {crewBody}
          </PressableScale>
        ) : (
          <View testID="clube-crew">{crewBody}</View>
        )}
      </Animated.View>

      {/* D-76: o encontro era de demonstração ("17 confirmados" e um "Confirmar presença" que não gravava).
          Sem encontro real no servidor, fica o estado vazio; o modo demonstração (onda 2) mostra o exemplo com selo. */}
      <FadeUp delay={120} style={{ gap: space[3] }}>
        <SectionTitle title="Próximo encontro" />
        <Surface>
          <EmptyState testID="clube-encontro-vazio" icon="club" tag="Em breve" title="Nenhum encontro marcado" body="Os encontros da crew chegam numa próxima versão." compact />
        </Surface>
      </FadeUp>

      <View style={{ gap: space[3] }}>
        <SectionTitle title="Rankings" />
        <Text muted>{period === 'week' ? 'Pontos desta semana, desde segunda-feira.' : 'Pontos da temporada atual. A temporada fecha no fim do mês.'}</Text>
        <View style={{ gap: space[1] }}>
          <ChipRow
            testID="ranking-quadro"
            accessibilityLabel="Ranking"
            role="button"
            value={board}
            onChange={setBoard}
            options={
              [
                ['individual', 'Corredores'],
                ['crews', 'Crews'],
                ['faccoes', 'Times'],
              ] as const
            }
          />
          <ChipRow
            testID="ranking-periodo"
            accessibilityLabel="Período"
            role="button"
            value={period}
            onChange={setPeriod}
            options={
              [
                ['season', 'Temporada'],
                ['week', 'Semana'],
              ] as const
            }
          />
          <ChipRow testID="ranking-escopo" accessibilityLabel="Escopo" role="button" value={boardScope} onChange={setScope} options={scopesFor(board).map((k) => [k, scopeLabels[k]] as const)} />
        </View>
        <SwapFade swapKey={`${board}-${boardScope}-${period}`}>
          {ranking.error && !ranking.data ? (
            <Surface>
              <Text muted testID="ranking-erro">
                {ranking.error.message}
              </Text>
              <Button testID="ranking-tentar" label="Tentar de novo" kind="secondary" onPress={() => void ranking.reload()} />
            </Surface>
          ) : !ranking.data ? (
            <Surface>
              <ActivityIndicator color={colors.action} />
            </Surface>
          ) : lines.length === 0 ? (
            <Surface>
              <Text muted testID="ranking-vazio">
                {emptyRankingText(board, boardScope, period, me)}
              </Text>
            </Surface>
          ) : (
            <View style={{ gap: space[3] }}>
              {showPodium ? <Podium lines={lines.slice(0, 3)} label={youLabel} /> : null}
              {lines.length > (showPodium ? 3 : 0) ? (
                <Surface>
                  <Stagger delay={showPodium ? 400 : 100} gap={space[1]}>
                    {lines.slice(showPodium ? 3 : 0).map((r) => (
                      <View key={r.key} testID={`ranking-linha-${r.position}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
                        <Text variant="bodyBold" tabular style={{ width: 24 }}>
                          {r.position}
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
                        <CountUp value={r.rp} variant={r.you ? 'bodyBold' : 'body'} muted={!r.you} unit="RP" delay={450} accessibilityLabel={r.value} />
                      </View>
                    ))}
                  </Stagger>
                </Surface>
              ) : null}
            </View>
          )}
        </SwapFade>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title="Guerra de Cidades" />
        <Text muted>Pontos da temporada divididos pela raiz do número de corredores ativos, para cidades pequenas competirem com capitais.</Text>
        <Surface>
          <Stagger gap={space[1]}>
            {war.map((c, i) => (
              <View key={c.city} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
                <Text variant="bodyBold" tabular style={{ width: 24 }}>
                  {c.score === null ? '-' : i + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant={c.city === myCity ? 'bodyBold' : 'body'} numberOfLines={1}>
                    {c.city}
                  </Text>
                  <Text variant="caption" muted>
                    {c.score === null ? `Precisa de ${CITY_MIN_ACTIVE_RUNNERS} corredores ativos (tem ${c.runners.toLocaleString('pt-BR')})` : `${c.runners.toLocaleString('pt-BR')} corredores`}
                  </Text>
                </View>
                {c.score === null ? null : <CountUp value={Math.round(c.score)} variant="bodyBold" delay={200} accessibilityLabel={`${Math.round(c.score).toLocaleString('pt-BR')} pontos`} />}
              </View>
            ))}
          </Stagger>
        </Surface>
        <Text variant="caption" muted testID="cidades-rotulo">
          {realCities ? 'Temporada atual, com os corredores do NOMADE RUN.' : 'Placar de demonstração.'}
        </Text>
      </View>
    </Animated.ScrollView>
  );
}

const PODIUM_HEIGHT = [88, 64, 48] as const;

/** Momento herói do Clube: pódio dos 3 primeiros (pedestais crescem com expo.out, pontos contam). */
function Podium({ lines, label }: { lines: RankingLine[]; label: (r: RankingLine) => string }) {
  const { colors } = useTheme();
  // ordem visual: 2º · 1º · 3º
  // Altura pelo lugar na lista (empates no servidor repetem a posição, mas o pódio continua 1º · 2º · 3º na altura).
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
            <CountUp value={r.rp} variant="bodyBold" unit="RP" delay={200 + idx * 80} accessibilityLabel={r.value} />
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
