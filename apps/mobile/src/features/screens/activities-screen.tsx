import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { EmptyArt } from '@/components/art';
import { Button } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { EmptyState } from '@/components/empty-state';
import { FeedRunCard } from '@/components/feed-run-card';
import { Icon } from '@/components/icon';
import { CountUp, FadeUp, staggerDelay } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { WeekBars } from '@/components/week-bars';
import { STREAK_RUNS_PER_WEEK } from '@/domain/games';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import type { LatLng } from '@/domain/types';
import { mergeHistory, periodStart, PERIODS, TAG_LABEL, type PeriodId } from '@/features/run/history-model';
import { loadHistory, refreshLocalRuns } from '@/features/run/run-controller';
import { bootstrapOfflineSync } from '@/features/run/use-offline-sync';
import { RecapButton } from '@/features/social/recap';
import { useNow } from '@/features/use-now';
import { getActivityPath } from '@/services/api/activities-repo';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { runBadges, runsThisWeek, weekKm } from './profile-screen.model';

const MISSION_LABEL = { livre: 'Livre', fuga: 'Fuga', caca: 'Caça', rabisco: 'Rabisco' } as const;
/** Mini-mapas buscados no servidor por abertura (as primeiras corridas da lista; o resto fica só com o traço local). */
const PATHS_TO_FETCH = 8;
const PATH_POINTS = 120;

/** Rotas das corridas do servidor que ainda não estão no aparelho (para o mini-mapa do card). */
function useServerPaths(ids: readonly string[]): Record<string, LatLng[]> {
  const [paths, setPaths] = useState<Record<string, LatLng[]>>({});
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    let alive = true;
    for (const id of key.split(',')) {
      void getActivityPath(id, PATH_POINTS).then((r) => {
        if (alive && r.ok && r.data.length > 1) setPaths((p) => (p[id] ? p : { ...p, [id]: r.data }));
      });
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return paths;
}

/**
 * Você › Corridas (T7.3.1, wireframe 12): o herói é a semana (quilômetros grandes + barras de segunda a domingo e a
 * sequência); embaixo, cada corrida com o mini-mapa da rota (`FeedRunCard`). Vazio = arte + 1 frase + Correr.
 */
export function ActivitiesScreen() {
  const { colors } = useTheme();
  const serverRuns = useGame((s) => s.serverRuns);
  const localRuns = useGame((s) => s.localRuns);
  const streakWeeks = useGame((s) => s.streakWeeks);
  const freezesLeft = useGame((s) => s.freezesLeft);
  const userId = useSession((s) => s.session?.userId);
  const now = useNow(60_000);
  const [period, setPeriod] = useState<PeriodId>('30d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void bootstrapOfflineSync(userId);
    void refreshLocalRuns(userId)
      .catch(() => undefined)
      .then(() => loadHistory({ from: periodStart(period, Date.now()) }))
      .then((res) => {
        if (!alive) return;
        setError(res.ok ? null : res.error.code === 'NETWORK' ? 'Sem conexão: só as corridas do aparelho.' : res.error.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [period, userId, nonce]);

  const history = mergeHistory(serverRuns, localRuns, periodStart(period, now));
  const everything = mergeHistory(serverRuns, localRuns);
  const week = weekKm(everything, now);
  const missing = Math.max(0, STREAK_RUNS_PER_WEEK - runsThisWeek(everything, now));
  const localPath = new Map(localRuns.map((l) => [l.id, l.path]));
  const resultOf = new Map(serverRuns.map((r) => [r.id, r.result]));
  const toFetch = history
    .filter((h) => (localPath.get(h.id)?.length ?? 0) < 2)
    .slice(0, PATHS_TO_FETCH)
    .map((h) => h.id);
  const serverPaths = useServerPaths(toFetch);

  return (
    <ScreenScroll
      testID="tela-atividades"
      edges={[]}
      gap={space[6]}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            setNonce((n) => n + 1);
          }}
        />
      }>
      <FadeUp>
        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] }}>
            <View style={{ flexShrink: 1 }}>
              <CountUp
                testID="atividades-semana-km"
                value={week.total * 1000}
                format={(n) => formatKm(n, 1)}
                unit="km"
                variant="metric"
                delay={150}
                accessibilityLabel={`${formatKm(week.total * 1000, 1)} quilômetros nesta semana`}
              />
              <Text variant="small" muted>
                esta semana
              </Text>
            </View>
            <View
              testID="atividades-sequencia"
              accessible
              accessibilityLabel={`${streakWeeks} semanas seguidas. ${freezesLeft} congelamento disponível.`}
              style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                <Icon name="fire" size={20} color={colors.accentText} />
                <Text variant="headline" color={colors.accentText} tabular>
                  {streakWeeks}
                </Text>
              </View>
              <Text variant="small" muted>
                semanas seguidas
              </Text>
            </View>
          </View>
          <WeekBars testID="atividades-semana" days={week.days} today={week.today} height={88} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon name="shield" size={14} color={colors.textSecondary} />
            <Text testID="atividades-meta-semana" variant="caption" muted style={{ flex: 1 }}>
              {missing === 0 ? 'Semana garantida.' : `Mais ${missing} corrida${missing > 1 ? 's' : ''} até domingo.`} {freezesLeft} congelamento.
            </Text>
          </View>
          <RecapButton testID="atividades-recap" wide />
        </Surface>
      </FadeUp>

      <View style={{ gap: space[3] }}>
        <SectionHeader
          title="Corridas"
          action={
            <Text testID="atividades-total-corridas" variant="small" muted tabular>
              {history.length}
            </Text>
          }
        />
        {/* Filtros numa linha que rola na horizontal (não quebram mais em 2 linhas em 360 pt). */}
        <ChipRow testID="atividades-periodo" accessibilityLabel="Período" size="md" value={period} onChange={setPeriod} chipLabel={(l) => `Período: ${l}`} options={PERIODS.map((p) => [p.id, p.label] as const)} />
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text testID="atividades-erro" variant="small" muted style={{ flex: 1 }}>
              {error}
            </Text>
            <Button
              testID="atividades-tentar"
              label="Tentar de novo"
              kind="ghost"
              onPress={() => {
                setLoading(true);
                setNonce((n) => n + 1);
              }}
            />
          </View>
        ) : null}
        {history.length === 0 ? (
          <FadeUp delay={120}>
            <Surface>
              <EmptyState
                testID="atividades-vazio"
                art={<EmptyArt kind="sem-corridas" size={200} />}
                title={period === 'tudo' ? 'Sua 1ª corrida aparece aqui' : 'Nada neste período'}
                body={period === 'tudo' ? undefined : 'Escolha um período maior.'}
                action={<Button testID="atividades-correr" label="Correr" icon="play" onPress={() => router.push('/corrida')} />}
              />
            </Surface>
          </FadeUp>
        ) : (
          history.map((h, index) => {
            const when = new Date(h.startedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            return (
              <FadeUp key={h.id} delay={120 + staggerDelay(index)}>
                <FeedRunCard
                  testID={`atividade-${h.id}`}
                  path={localPath.get(h.id) ?? serverPaths[h.id] ?? []}
                  title={`${when} · ${MISSION_LABEL[h.mission]}`}
                  distance={`${formatKm(h.meters)} km`}
                  detail={`${formatDuration(h.movingSeconds)} · ${h.avgPace ? formatPace(h.avgPace) : '--:--'} /km`}
                  badges={runBadges(h, resultOf.get(h.id), (t) => TAG_LABEL[t])}
                  onPress={() => router.push({ pathname: '/resumo', params: { id: h.id } })}
                />
              </FadeUp>
            );
          })
        )}
      </View>
    </ScreenScroll>
  );
}
