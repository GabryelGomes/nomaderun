import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { EmptyState, SectionHeader, Stat, Surface } from '@/components/surface';
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
    <ScrollView
      testID="tela-atividades"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            setNonce((n) => n + 1);
          }}
        />
      }>
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

      <View style={{ flexDirection: 'row', gap: space[6], paddingHorizontal: space[1] }}>
        <Stat label="Corridas" value={String(history.length)} />
        <Stat label="Distância total" value={formatKm(totalKm, 1)} unit="km" />
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Histórico" />
        <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }} accessibilityRole="radiogroup" accessibilityLabel="Período">
          {PERIODS.map((p) => {
            const on = period === p.id;
            return (
              <Pressable
                key={p.id}
                testID={`atividades-periodo-${p.id}`}
                accessibilityRole="radio"
                accessibilityLabel={`Período: ${p.label}`}
                accessibilityState={{ checked: on }}
                onPress={() => setPeriod(p.id)}
                style={{ paddingHorizontal: space[4], height: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? colors.text : colors.surface }}>
                <Text variant="bodyBold" color={on ? colors.surface : colors.text}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {error ? (
          <Text testID="atividades-erro" variant="small" muted>
            {error}
          </Text>
        ) : null}
        {history.length === 0 ? (
          <Surface>
            <EmptyState
              title={period === 'tudo' ? 'Sua primeira corrida aparece aqui' : 'Nenhuma corrida neste período'}
              body="Grave uma corrida pelo GPS ou experimente a simulação no Parque Flamboyant."
              action={<Button testID="atividades-correr" label="Correr" icon="play" onPress={() => router.push('/corrida')} />}
            />
          </Surface>
        ) : (
          history.map((h) => (
            <Pressable
              key={h.id}
              testID={`atividade-${h.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${MISSION_LABEL[h.mission]}, ${formatKm(h.meters)} quilômetros${h.tag ? `, ${TAG_LABEL[h.tag]}` : ''}`}
              onPress={() => router.push({ pathname: '/resumo', params: { id: h.id } })}
              style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, gap: space[2] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyBold">{MISSION_LABEL[h.mission]}</Text>
                <Text variant="caption" muted>
                  {new Date(h.startedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {h.simulated ? ', simulada' : ''}
                  {h.tag ? `, ${TAG_LABEL[h.tag]}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: space[6] }}>
                <Text tabular>{formatKm(h.meters)} km</Text>
                <Text tabular>{formatDuration(h.movingSeconds)}</Text>
                <Text tabular>{h.avgPace ? formatPace(h.avgPace) : '--:--'} /km</Text>
                <Text tabular muted>
                  +{h.rp} RP
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}
