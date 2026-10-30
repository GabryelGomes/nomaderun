import { View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

/** Segunda a domingo (a semana do jogo começa na segunda, D-63). */
export const WEEK_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;
const WEEK_NAMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;

/** Altura de cada barra (0..height). Dia com valor > 0 tem um mínimo visível; dia vazio fica com um traço de 3 pt. */
export function weekBarHeights(days: readonly number[], height: number, max?: number): number[] {
  const top = Math.max(max ?? 0, ...days.map((d) => (Number.isFinite(d) ? Math.max(0, d) : 0)));
  return days.map((d) => {
    const v = Number.isFinite(d) ? Math.max(0, d) : 0;
    if (v === 0 || top === 0) return 3;
    return Math.max(8, Math.round((v / top) * height));
  });
}

export type WeekBarsProps = {
  /** 7 valores, de segunda a domingo. */
  days: readonly number[];
  /** Índice de hoje (0 = segunda … 6 = domingo). Dias depois de hoje ficam apagados. */
  today: number;
  unit?: string;
  /** Formata o valor para o leitor de tela (padrão: 1 casa decimal). */
  format?: (n: number) => string;
  height?: number;
  /** Teto da escala (ex.: a meta da semana); padrão: o maior dia. */
  max?: number;
  testID?: string;
};

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Gráfico da semana (Você › Corridas, recap). Estático: o crescimento animado, se houver, é da E5 (só `scaleY`). */
export function WeekBars({ days, today, unit = 'km', format = fmt, height = 72, max, testID }: WeekBarsProps) {
  const { colors } = useTheme();
  const week = Array.from({ length: 7 }, (_, i) => days[i] ?? 0);
  const heights = weekBarHeights(week, height, max);
  const label = `Semana: ${week.map((v, i) => `${WEEK_NAMES[i]} ${v > 0 ? `${format(v)} ${unit}` : 'sem corrida'}`).join(', ')}`;
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label} style={{ gap: space[1] }}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
        {heights.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              borderRadius: radius.sm,
              backgroundColor: i === today ? colors.action : week[i] > 0 ? colors.text : colors.surfaceSunken,
              opacity: i > today ? 0.35 : 1,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {WEEK_INITIALS.map((d, i) => (
          <Text key={i} variant="caption" color={i === today ? colors.accentText : colors.textSecondary} style={{ flex: 1, textAlign: 'center' }} maxFontSizeMultiplier={1.3}>
            {d}
          </Text>
        ))}
      </View>
    </View>
  );
}
