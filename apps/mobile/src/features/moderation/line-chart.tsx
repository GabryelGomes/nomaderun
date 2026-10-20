import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { Text } from '@/components/text';
import { palette, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { SeriesPoint } from './series';

/**
 * Gráfico de linha simples em SVG (react-native-svg) para o painel de moderação.
 * `threshold` desenha uma linha de referência (ex.: 25 km/h, velocidade de veículo da RN-007).
 */
export function LineChart({
  data,
  label,
  unit,
  color,
  threshold,
  thresholdLabel,
  height = 120,
  testID,
}: {
  data: SeriesPoint[];
  label: string;
  unit: string;
  color: string;
  threshold?: number;
  thresholdLabel?: string;
  height?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const maxY = Math.max(1, threshold ? threshold * 1.15 : 0, ...data.map((d) => d.y)) * 1.05;
  const maxX = Math.max(1, ...data.map((d) => d.x));
  const px = (x: number) => (x / maxX) * width;
  const py = (y: number) => height - (y / maxY) * height;
  const peak = data.reduce((m, d) => Math.max(m, d.y), 0);

  return (
    <View style={{ gap: space[2] }} testID={testID} accessible accessibilityLabel={`${label}: máximo ${Math.round(peak)} ${unit}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" muted>
          {label}
        </Text>
        <Text variant="caption" muted tabular>
          máx. {Math.round(peak)} {unit}
        </Text>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Rect x={0} y={0} width={width} height={height} fill={colors.surfaceSunken} rx={8} />
            {threshold !== undefined ? (
              <Line x1={0} x2={width} y1={py(threshold)} y2={py(threshold)} stroke={palette.danger} strokeWidth={1.5} strokeDasharray="6 4" />
            ) : null}
            {data.length > 1 ? (
              <Polyline points={data.map((d) => `${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            ) : null}
          </Svg>
        ) : null}
      </View>
      {threshold !== undefined && thresholdLabel ? (
        <Text variant="caption" muted>
          Linha tracejada: {thresholdLabel}
        </Text>
      ) : null}
    </View>
  );
}
