import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { EmptyState, SectionHeader, Stat, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { STREAK_RUNS_PER_WEEK } from '@/domain/games';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { useNow } from '@/features/use-now';
import { useGame } from '@/store/game-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MISSION_LABEL = { livre: 'Corrida livre', fuga: 'Fuga', caca: 'Caça', rabisco: 'Rabisco' } as const;

export function ActivitiesScreen() {
  const { colors } = useTheme();
  const history = useGame((s) => s.history);
  const streakWeeks = useGame((s) => s.streakWeeks);
  const freezesLeft = useGame((s) => s.freezesLeft);
  const now = useNow(60_000);
  const weekStart = now - 7 * 86_400_000;
  const thisWeek = history.filter((h) => h.endedAt >= weekStart && h.result.validation.status !== 'rejected');
  const totalKm = history.reduce((s, h) => s + h.meters, 0);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
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
        {history.length === 0 ? (
          <Surface>
            <EmptyState
              title="Sua primeira corrida aparece aqui"
              body="Grave uma corrida pelo GPS ou experimente a simulação no Parque Flamboyant."
              action={<Button label="Correr" icon="play" onPress={() => router.push('/corrida')} />}
            />
          </Surface>
        ) : (
          history.map((h) => (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/resumo', params: { id: h.id } })}
              style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, gap: space[2] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyBold">{MISSION_LABEL[h.mission]}</Text>
                <Text variant="caption" muted>
                  {new Date(h.endedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {h.simulated ? ', simulada' : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: space[6] }}>
                <Text tabular>{formatKm(h.meters)} km</Text>
                <Text tabular>{formatDuration(h.movingSeconds)}</Text>
                <Text tabular>{formatPace(h.avgPace)} /km</Text>
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
