import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SectionHeader, Surface } from '@/components/surface';
import { TeamBadge } from '@/components/team-badge';
import { Text } from '@/components/text';
import { ProgressBar } from '@/components/territory-bar';
import { CITY_MIN_ACTIVE_RUNNERS } from '@/domain/games';
import type { FactionId } from '@/domain/types';
import { DEMO_CREW, demoCityWar } from '@/demo/demo-data';
import { CREW_MAX_MEMBERS, getMyCrew } from '@/services/api/crews-repo';
import { districtOf } from '@/domain/grid';
import type { Result } from '@/services/api/errors';
import { getCityRanking, getDistrictLabel, getMyRecentZoneId, rankCrews, rankFactions, rankRunners } from '@/services/api/leaderboard-repo';
import { useSession } from '@/store/session-store';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { emptyRankingText, rankingQuery, scopesFor, type Board, type Me, type Period, type Scope } from './club-ranking';
import { useResource } from './use-resource';

export type RankingLine = { key: string; position: number; title: string; subtitle?: string; value: string; faction?: FactionId | null; you?: boolean };

/** Linhas do ranking escolhido, já no formato da lista (RF-015). */
async function loadBoard(board: Board, scope: Scope, period: Period, me: Me): Promise<Result<RankingLine[]>> {
  const q = rankingQuery(board, scope, period, me);
  if (!q) return { ok: true, data: [] };
  if (board === 'crews') {
    const res = await rankCrews(q);
    return res.ok
      ? { ok: true as const, data: res.data.map((r): RankingLine => ({ key: r.crewId, position: r.position, title: `${r.name} [${r.tag}]`, subtitle: `${r.members} corredores`, value: `${r.rp.toLocaleString('pt-BR')} RP`, faction: r.faction })) }
      : res;
  }
  if (board === 'faccoes') {
    const res = await rankFactions(q);
    return res.ok
      ? {
          ok: true as const,
          data: res.data.map((r): RankingLine => ({
            key: r.faction,
            position: r.position,
            title: factions[r.faction].name,
            subtitle: `${r.zones} zonas · ${r.runners} corredores`,
            value: `${r.rp.toLocaleString('pt-BR')} RP`,
            faction: r.faction,
            you: r.faction === me.faction,
          })),
        }
      : res;
  }
  const res = await rankRunners(q);
  return res.ok
    ? {
        ok: true as const,
        data: res.data.map((r): RankingLine => ({
          key: r.userId,
          position: r.position,
          title: r.crewTag ? `${r.username} [${r.crewTag}]` : r.username,
          subtitle: `${(r.meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km · ${r.runs} ${r.runs === 1 ? 'corrida' : 'corridas'}`,
          value: `${r.rp.toLocaleString('pt-BR')} RP`,
          faction: r.faction,
          you: r.userId === me.id,
        })),
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

function Chips<T extends string>({ options, value, onChange, testID }: { options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable
            key={key}
            testID={`${testID}-${key}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(key)}
            style={{ paddingHorizontal: space[4], height: 36, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? colors.text : colors.surface }}>
            <Text variant="caption" color={on ? colors.surface : colors.text}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ClubScreen() {
  const { colors } = useTheme();
  const [going, setGoing] = useState(false);
  const userId = useSession((s) => s.session?.userId ?? null);
  const city = useSession((s) => s.profile?.city ?? null);
  const faction = useSession((s) => s.profile?.faction ?? null);
  const [board, setBoard] = useState<Board>('individual');
  const [scope, setScope] = useState<Scope>('geral');
  const [period, setPeriod] = useState<Period>('season');

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
  const war = realCities
    ? realCities.map((c) => ({ city: c.city, runners: c.activeRunners, score: c.score }))
    : demoCityWar().map((c) => ({ city: c.city, runners: c.runners, score: c.score }));
  const myCity = city ?? 'Goiânia';
  const myCrew = crew.data;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Pressable testID="clube-crew" accessibilityRole="button" accessibilityLabel={myCrew ? `Sua crew: ${myCrew.crew.name}. Abrir.` : 'Criar ou entrar numa crew'} onPress={() => router.push('/clube/crew')}>
        <Surface>
          <Text variant="caption" muted>
            Sua Crew
          </Text>
          {myCrew ? (
            <>
              <Text variant="headline">{myCrew.crew.name}</Text>
              <Text muted>
                {myCrew.members.length} {myCrew.members.length === 1 ? 'corredor' : 'corredores'}.{' '}
                {(myCrew.members.reduce((n, m) => n + m.meters, 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km na temporada.
              </Text>
              <ProgressBar value={myCrew.members.length / CREW_MAX_MEMBERS} color={colors.text} height={10} />
            </>
          ) : crew.loading && !crew.error ? (
            <ActivityIndicator color={colors.action} />
          ) : (
            <>
              <Text variant="headline">{crew.error ? 'Crew indisponível' : 'Sem crew ainda'}</Text>
              <Text muted>{crew.error ? crew.error.message : 'Crie uma crew com seus amigos ou entre com um código de convite.'}</Text>
              <Button testID="clube-crew-abrir" label="Criar ou entrar" kind="secondary" onPress={() => router.push('/clube/crew')} />
            </>
          )}
        </Surface>
      </Pressable>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Próximo encontro" />
        <Surface>
          <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
            <Icon name="club" size={26} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">{DEMO_CREW.nextMeetup.when}</Text>
              <Text variant="small" muted>
                {DEMO_CREW.nextMeetup.where}
              </Text>
            </View>
          </View>
          <Text variant="small" muted>
            {DEMO_CREW.nextMeetup.going + (going ? 1 : 0)} confirmados. Correr junto vale pontos ×1,25 para todos.
          </Text>
          <Button label={going ? 'Presença confirmada' : 'Confirmar presença'} icon={going ? 'check' : undefined} kind={going ? 'secondary' : 'primary'} onPress={() => setGoing((g) => !g)} />
        </Surface>
        <Text variant="caption" muted>
          Encontro de demonstração.
        </Text>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Rankings" />
        <Text muted>{period === 'week' ? 'Pontos desta semana, desde segunda-feira.' : 'Pontos da temporada atual. A temporada fecha no fim do mês.'}</Text>
        <Chips
          testID="ranking-quadro"
          value={board}
          onChange={setBoard}
          options={[
            ['individual', 'Corredores'],
            ['crews', 'Crews'],
            ['faccoes', 'Times'],
          ] as const}
        />
        <Chips
          testID="ranking-periodo"
          value={period}
          onChange={setPeriod}
          options={[
            ['season', 'Temporada'],
            ['week', 'Semana'],
          ] as const}
        />
        <Chips testID="ranking-escopo" value={boardScope} onChange={setScope} options={scopesFor(board).map((k) => [k, scopeLabels[k]] as const)} />
        <Surface>
          {ranking.error && !ranking.data ? (
            <Text muted testID="ranking-erro">
              {ranking.error.message}
            </Text>
          ) : !ranking.data ? (
            <ActivityIndicator color={colors.action} />
          ) : ranking.data.length === 0 ? (
            <Text muted testID="ranking-vazio">
              {emptyRankingText(board, boardScope, period, me)}
            </Text>
          ) : (
            ranking.data.map((r) => (
              <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 4 }}>
                <Text variant="bodyBold" tabular style={{ width: 24 }}>
                  {r.position}
                </Text>
                {r.faction !== undefined ? <TeamBadge faction={r.faction} size={22} /> : null}
                <View style={{ flex: 1 }}>
                  <Text variant={r.you ? 'bodyBold' : 'body'}>{r.you && board === 'individual' ? `${r.title} (você)` : r.title}</Text>
                  {r.subtitle ? (
                    <Text variant="caption" muted>
                      {r.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Text tabular muted={!r.you}>
                  {r.value}
                </Text>
              </View>
            ))
          )}
        </Surface>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Guerra de Cidades" />
        <Text muted>
          Pontos da temporada divididos pela raiz do número de corredores ativos, para cidades pequenas competirem com capitais.
        </Text>
        <Surface>
          {war.map((c, i) => (
            <View key={c.city} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 4 }}>
              <Text variant="bodyBold" tabular style={{ width: 24 }}>
                {c.score === null ? '-' : i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant={c.city === myCity ? 'bodyBold' : 'body'}>{c.city}</Text>
                <Text variant="caption" muted>
                  {c.score === null ? `Precisa de ${CITY_MIN_ACTIVE_RUNNERS} corredores ativos (tem ${c.runners.toLocaleString('pt-BR')})` : `${c.runners.toLocaleString('pt-BR')} corredores`}
                </Text>
              </View>
              <Text variant="bodyBold" tabular>
                {c.score === null ? '' : Math.round(c.score).toLocaleString('pt-BR')}
              </Text>
            </View>
          ))}
        </Surface>
        <Text variant="caption" muted testID="cidades-rotulo">
          {realCities ? 'Temporada atual, com os corredores do NOMADE RUN.' : 'Placar de demonstração.'}
        </Text>
      </View>
    </ScrollView>
  );
}
