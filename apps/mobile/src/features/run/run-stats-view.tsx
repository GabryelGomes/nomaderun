import { View } from 'react-native';

import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { formatDuration } from '@/domain/geo';
import { distanceLabel, distanceSpoken, formatPaceIn, paceLabel } from '@/features/format';
import type { DistanceUnit } from '@/services/api/types';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { PersonalBest, SummaryStats } from './summary-model';

const CHART_HEIGHT = 72;
/** Mais barras que isso não cabem lado a lado num celular: agrupa as fatias. */
const MAX_BARS = 40;

/** Junta fatias vizinhas do ritmo (média) para caber `max` barras. */
export function chartBars(paceSeries: readonly number[], max = MAX_BARS): number[] {
  if (paceSeries.length <= max) return [...paceSeries];
  const size = paceSeries.length / max;
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    const part = paceSeries.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    out.push(part.reduce((s, v) => s + v, 0) / part.length);
  }
  return out;
}

/**
 * Detalhes de desempenho do resumo (RF-006): parciais por km (ou milha), gráfico de ritmo e recordes pessoais.
 * Defeito dos testes externos (baterias 1 a 3): o resumo não mostrava nenhum dos três.
 */
export function RunStatsView({ stats, bests, unit }: { stats: SummaryStats; bests: PersonalBest[]; unit: DistanceUnit }) {
  const { colors } = useTheme();
  const splits = unit === 'mi' ? stats.splitsMi : stats.splits;
  const bars = chartBars(stats.paceSeries);
  const fastest = bars.length ? Math.min(...bars) : 0;
  const slowest = bars.length ? Math.max(...bars) : 0;
  const unitShort = distanceLabel(unit);

  return (
    <Surface>
      <View testID="resumo-desempenho" style={{ gap: space[3] }}>
        <Text variant="title" accessibilityRole="header">
          Desempenho
        </Text>

        {bars.length > 1 ? (
          <View
            testID="resumo-grafico-ritmo"
            accessible
            accessibilityLabel={`Gráfico de ritmo: do mais rápido, ${formatPaceIn(fastest, unit)} por ${unit === 'mi' ? 'milha' : 'quilômetro'}, ao mais lento, ${formatPaceIn(slowest, unit)}.`}>
            <Text variant="small" muted>
              Ritmo ao longo da corrida
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 2, marginTop: space[2] }}>
              {bars.map((pace, i) => {
                // barra mais alta = mais rápido; o mais lento ainda aparece (20% da altura)
                const share = slowest > fastest ? (slowest - pace) / (slowest - fastest) : 1;
                return <View key={i} style={{ flex: 1, height: CHART_HEIGHT * (0.2 + 0.8 * share), borderRadius: 2, backgroundColor: colors.action }} />;
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" muted>
                Início
              </Text>
              <Text variant="caption" muted tabular>
                {`${formatPaceIn(fastest, unit)}${paceLabel(unit)} no melhor trecho`}
              </Text>
              <Text variant="caption" muted>
                Fim
              </Text>
            </View>
          </View>
        ) : null}

        <View testID="resumo-parciais">
          <Text variant="bodyBold">{`Parciais por ${unit === 'mi' ? 'milha' : 'km'}`}</Text>
          {splits.length === 0 ? (
            <Text variant="small" muted>{`As parciais aparecem a partir de 1 ${unitShort} corrido.`}</Text>
          ) : (
            splits.map((sec, i) => (
              <View
                key={i}
                testID={`resumo-parcial-${i + 1}`}
                accessible
                accessibilityLabel={`${unit === 'mi' ? 'Milha' : 'Quilômetro'} ${i + 1}: ${formatDuration(sec)}`}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space[1], borderBottomWidth: 1, borderColor: colors.line }}>
                <Text>{`${i + 1} ${unitShort}`}</Text>
                <Text tabular variant="bodyBold">
                  {formatDuration(sec)}
                </Text>
              </View>
            ))
          )}
        </View>

        {bests.length > 0 ? (
          <View testID="resumo-recordes">
            <Text variant="bodyBold">Melhores marcas desta corrida</Text>
            {bests.map((b) => (
              <View
                key={b.kind}
                testID={`resumo-recorde-${b.kind}`}
                accessible
                accessibilityLabel={`${b.label} em ${formatDuration(b.seconds)}${b.isNew ? ', novo recorde pessoal' : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[1] }}>
                <Text style={{ flex: 1 }}>{b.label}</Text>
                {b.isNew ? (
                  <View style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.action }}>
                    <Text variant="caption" color={colors.onAction}>
                      Recorde pessoal
                    </Text>
                  </View>
                ) : null}
                <Text tabular variant="bodyBold">
                  {formatDuration(b.seconds)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text variant="caption" muted>{`Distâncias em ${distanceSpoken(unit)}. Só os trechos que contaram entram na conta.`}</Text>
      </View>
    </Surface>
  );
}
