import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { CountUp, FadeUp, Pressable, staggerDelay } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { Icon } from '@/components/icon';
import { EmptyState, SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { STREAK_RUNS_PER_WEEK } from '@/domain/games';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { mergeHistory, periodStart, PERIODS, TAG_LABEL, type PeriodId } from '@/features/run/history-model';
import { loadHistory, refreshLocalRuns } from '@/features/run/run-controller';
import { bootstrapOfflineSync } from '@/features/run/use-offline-sync';
import { useNow } from '@/features/use-now';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MISSION_LABEL = { livre: 'Corrida livre', fuga: 'Fuga', caca: 'Caça', rabisco: 'Rabisco' } as const;

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
        setError(res.ok ? null : res.error.code === 'NETWORK' ? 'Sem conexão: mostrando só as corridas guardadas no aparelho.' : res.error.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [period, userId, nonce]);

  const history = mergeHistory(serverRuns, localRuns, periodStart(period, now));
  const weekStart = now - 7 * 86_400_000;
  const thisWeek = mergeHistory(serverRuns, localRuns, weekStart).filter((h) => h.counts);
  const totalKm = history.reduce((s, h) => s + h.meters, 0);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Icon name="fire" size={28} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{streakWeeks} semanas seguidas</Text>
              <Text variant="small" muted>
                {thisWeek.length >= STREAK_RUNS_PER_WEEK
                  ? 'Semana garantida. Descanse sem culpa.'
                  : `Mais ${STREAK_RUNS_PER_WEEK - thisWeek.length} corrida${STREAK_RUNS_PER_WEEK - thisWeek.length > 1 ? 's' : ''} até domingo mantém a sequência.`}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {Array.from({ length: STREAK_RUNS_PER_WEEK }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: i < thisWeek.length ? colors.text : colors.surfaceSunken }} />
            ))}
          </View>
          <Text variant="caption" muted>
            {freezesLeft} congelamento disponível este mês. Ele protege a sequência numa semana corrida.
          </Text>
        </Surface>
      </FadeUp>

      <FadeUp delay={80} style={{ flexDirection: 'row', gap: space[6], paddingHorizontal: space[1] }}>
        <View style={{ gap: 2, minWidth: 88 }}>
          <Text variant="caption" muted>
            Corridas
          </Text>
          <CountUp testID="atividades-total-corridas" value={history.length} variant="headline" delay={200} accessibilityLabel={`${history.length} corridas`} />
        </View>
        <View style={{ gap: 2, minWidth: 88 }}>
          <Text variant="caption" muted>
            Distância total
          </Text>
          <CountUp
            testID="atividades-total-km"
            value={totalKm}
            format={(n) => formatKm(n, 1)}
            unit="km"
            variant="headline"
            delay={260}
            accessibilityLabel={`${formatKm(totalKm, 1)} quilômetros no período`}
          />
        </View>
      </FadeUp>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Histórico" />
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
                title={period === 'tudo' ? 'Sua primeira corrida aparece aqui' : 'Nenhuma corrida neste período'}
                body={period === 'tudo' ? 'Grave uma corrida pelo GPS ou experimente a simulação no Parque Flamboyant.' : 'Escolha um período maior acima, grave uma corrida pelo GPS ou experimente a simulação no Parque Flamboyant.'}
                action={<Button testID="atividades-correr" label="Correr" icon="play" onPress={() => router.push('/corrida')} />}
              />
            </Surface>
          </FadeUp>
        ) : (
          history.map((h, index) => (
            <FadeUp key={h.id} delay={120 + staggerDelay(index)}>
              <Pressable
                testID={`atividade-${h.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${MISSION_LABEL[h.mission]}, ${formatKm(h.meters)} quilômetros${h.tag ? `, ${TAG_LABEL[h.tag]}` : ''}`}
                hitSlop={0}
                onPress={() => router.push({ pathname: '/resumo', params: { id: h.id } })}
                style={{ padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, gap: space[2] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <Text variant="bodyBold">{MISSION_LABEL[h.mission]}</Text>
                  <Text variant="caption" muted style={{ flexShrink: 1, textAlign: 'right' }}>
                    {new Date(h.startedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {h.simulated ? ', simulada' : ''}
                    {h.tag ? `, ${TAG_LABEL[h.tag]}` : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4], rowGap: space[1] }}>
                  <Text tabular>{formatKm(h.meters)} km</Text>
                  <Text tabular>{formatDuration(h.movingSeconds)}</Text>
                  <Text tabular>{h.avgPace ? formatPace(h.avgPace) : '--:--'} /km</Text>
                  <Text tabular muted>
                    +{h.rp} RP
                  </Text>
                </View>
              </Pressable>
            </FadeUp>
          ))
        )}
      </View>
    </ScreenScroll>
  );
}
