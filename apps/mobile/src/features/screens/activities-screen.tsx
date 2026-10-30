import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { EmptyArt } from '@/components/art';
import { Button, IconButton } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { EmptyState } from '@/components/empty-state';
import { FeedRunCard } from '@/components/feed-run-card';
import { Icon } from '@/components/icon';
import { CountUp, FadeUp, ShimmerSkeleton, staggerDelay } from '@/components/motion';
import { OfflineNotice } from '@/components/offline-notice';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { WeekBars } from '@/components/week-bars';
import { STREAK_RUNS_PER_WEEK } from '@/domain/games';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import type { LatLng } from '@/domain/types';
import { NO_DATA } from '@/features/format';
import { mergeHistory, periodStart, PERIODS, TAG_LABEL, type PeriodId } from '@/features/run/history-model';
import { loadHistory, refreshLocalRuns } from '@/features/run/run-controller';
import { bootstrapOfflineSync } from '@/features/run/use-offline-sync';
import { RecapButton } from '@/features/social/recap';
import { useNow } from '@/features/use-now';
import { getActivityPath, listMyActivities } from '@/services/api/activities-repo';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { runBadges, runsThisWeek, weekKm } from './profile-screen.model';
import { useResource } from './use-resource';

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
 * Você › Atividades (T7.3.1, wireframe 12): o herói é a semana (quilômetros grandes + barras de segunda a domingo e a
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
  /** Código do erro da última carga (D-95: o `OfflineNotice` diz "Sem internet" ou "Servidor fora do ar"). */
  const [error, setError] = useState<string | null>(null);
  const historySync = useGame((s) => s.sync.history);
  const progressSync = useGame((s) => s.sync.progress);

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
        setError(res.ok ? null : res.error.code);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [period, userId, nonce]);

  const history = mergeHistory(serverRuns, localRuns, periodStart(period, now));
  const everything = mergeHistory(serverRuns, localRuns);
  // UX-14: o store só guarda o período escolhido. Lista vazia → 1 pergunta ao servidor ("tem alguma, em qualquer data?").
  const emptyNow = historySync.at !== null && everything.length === 0;
  const anyRun = useResource(() => (emptyNow && userId ? listMyActivities({ limit: 1 }) : Promise.resolve({ ok: true as const, data: null })), [emptyNow, userId, nonce]);
  /** Conta nova: o servidor respondeu e não há nenhuma atividade, em período nenhum. */
  const neverRan = emptyNow && Array.isArray(anyRun.data) && anyRun.data.length === 0;
  const week = weekKm(everything, now);
  const missing = Math.max(0, STREAK_RUNS_PER_WEEK - runsThisWeek(everything, now));
  const localPath = new Map(localRuns.map((l) => [l.id, l.path]));
  const resultOf = new Map(serverRuns.map((r) => [r.id, r.result]));
  const toFetch = history
    .filter((h) => (localPath.get(h.id)?.length ?? 0) < 2)
    .slice(0, PATHS_TO_FETCH)
    .map((h) => h.id);
  const serverPaths = useServerPaths(toFetch);
  // D-95: sem o histórico do servidor, a semana e a sequência não são conhecidas: esqueleto carregando, "—" se falhou.
  const runsKnown = historySync.at !== null;
  const runsFailed = !runsKnown && (error !== null || historySync.failed);
  const streakKnown = progressSync.at !== null;
  const retry = () => {
    setLoading(true);
    setNonce((n) => n + 1);
  };

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
      {error ? <OfflineNotice testID="atividades-sem-conexao" code={error} hasData={runsKnown || localRuns.length > 0} savedAt={historySync.at} onRetry={retry} busy={loading} /> : null}

      <FadeUp>
        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] }}>
            <View style={{ flexShrink: 1 }}>
              {runsKnown ? (
                <CountUp
                  testID="atividades-semana-km"
                  value={week.total * 1000}
                  format={(n) => formatKm(n, 1)}
                  unit="km"
                  variant="metric"
                  delay={150}
                  accessibilityLabel={`${formatKm(week.total * 1000, 1)} quilômetros nesta semana`}
                />
              ) : runsFailed ? (
                <Text testID="atividades-semana-km" variant="metric" muted accessibilityLabel="Quilômetros desta semana: sem dado agora">
                  {NO_DATA}
                </Text>
              ) : (
                <ShimmerSkeleton testID="atividades-semana-carregando" shape="line" width={140} height={40} accessibilityLabel="Carregando a semana" />
              )}
              <Text variant="small" muted>
                esta semana
              </Text>
            </View>
            <View
              testID="atividades-sequencia"
              accessible
              accessibilityLabel={streakKnown ? `${streakWeeks} semanas seguidas. ${freezesLeft} congelamento disponível.` : 'Semanas seguidas: sem dado agora.'}
              style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                <Icon name="fire" size={20} color={colors.accentText} />
                <Text variant="headline" color={streakKnown ? colors.accentText : colors.textSecondary} tabular>
                  {streakKnown ? streakWeeks : NO_DATA}
                </Text>
              </View>
              <Text variant="small" muted>
                semanas seguidas
              </Text>
            </View>
          </View>
          {runsKnown ? <WeekBars testID="atividades-semana" days={week.days} today={week.today} height={88} /> : null}
          {runsKnown && streakKnown ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name="shield" size={14} color={colors.textSecondary} />
              <Text testID="atividades-meta-semana" variant="caption" muted style={{ flex: 1 }}>
                {missing === 0 ? 'Semana garantida.' : `Mais ${missing} corrida${missing > 1 ? 's' : ''} até domingo.`} {freezesLeft} congelamento.
              </Text>
            </View>
          ) : null}
          {/* Sem a semana conhecida (D-95) ou com 0 km (UX-14), nada para compartilhar. */}
          {runsKnown && week.total > 0 ? <RecapButton testID="atividades-recap" wide /> : null}
        </Surface>
      </FadeUp>

      <View style={{ gap: space[3] }}>
        <SectionHeader
          title="Histórico"
          action={
            <Text testID="atividades-total-corridas" variant="small" muted tabular>
              {runsKnown ? history.length : NO_DATA}
            </Text>
          }
        />
        {/* Filtros numa linha que rola na horizontal. Sem nenhuma atividade ainda (UX-14), não há o que filtrar. */}
        {neverRan ? null : (
          <ChipRow testID="atividades-periodo" accessibilityLabel="Período" size="md" value={period} onChange={setPeriod} chipLabel={(l) => `Período: ${l}`} options={PERIODS.map((p) => [p.id, p.label] as const)} />
        )}
        {history.length === 0 && (!runsKnown || (emptyNow && anyRun.data === null && !anyRun.error)) ? (
          // D-95: sem o histórico do servidor, "Sua 1ª corrida aparece aqui" seria falso: esqueleto ou nada (o aviso explica).
          runsFailed ? null : <ShimmerSkeleton testID="atividades-lista-carregando" shape="row" height={88} accessibilityLabel="Carregando as corridas" />
        ) : history.length === 0 ? (
          <FadeUp delay={120}>
            <Surface>
              {/* UX-14: quem nunca correu vê o convite certo; "Nada neste período" só quando há corridas fora do filtro. */}
              <EmptyState
                testID="atividades-vazio"
                art={<EmptyArt kind="sem-corridas" size={200} />}
                title={neverRan ? 'Sua 1ª corrida aparece aqui' : 'Nada neste período'}
                body={neverRan ? undefined : 'Escolha um período maior.'}
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
                  aside={
                    // §4.3: compartilhar cada corrida já oficial (a local ainda não tem card no servidor).
                    resultOf.has(h.id) ? (
                      <IconButton testID={`atividade-${h.id}-compartilhar`} icon="share" label={`Compartilhar a corrida de ${when}`} tone="sunken" size={44} onPress={() => router.push(`/compartilhar/${encodeURIComponent(h.id)}` as Href)} />
                    ) : undefined
                  }
                />
              </FadeUp>
            );
          })
        )}
      </View>
    </ScreenScroll>
  );
}
