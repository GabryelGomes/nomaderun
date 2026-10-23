import type { ReactNode } from 'react';
import { View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type StatTileProps = {
  /** Rótulo curto (ex.: "Distância"). */
  label: string;
  /** Valor já formatado (ex.: "5,02"). */
  value: string;
  unit?: string;
  icon?: IconName;
  /** Cor do número (ex.: neon do time). Padrão: texto. */
  accent?: string;
  /** Variação (ex.: "+1,2 km"). `good` pinta de laranja; sem `good`, fica neutra. Nunca vermelho de culpa. */
  delta?: { value: string; good?: boolean };
  /** Troca o número estático por um `CountUp` da E5 (o rótulo de leitura continua o do `value`). */
  valueSlot?: ReactNode;
  size?: 'md' | 'lg';
  testID?: string;
};

/** Leitura completa do bloco, numa frase só (o leitor de tela não lê pedaço por pedaço). */
export function statTileLabel(label: string, value: string, unit?: string, delta?: string): string {
  return [`${label}: ${value}${unit ? ` ${unit}` : ''}`, delta].filter(Boolean).join(', ');
}

/** Número grande (2º nível da hierarquia): Resumo, Você e Corridas. */
export function StatTile({ label, value, unit, icon, accent, delta, valueSlot, size = 'md', testID }: StatTileProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={statTileLabel(label, value, unit, delta?.value)}
      style={{
        flex: 1,
        minWidth: 96,
        gap: space[1],
        padding: space[3],
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceSunken,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        {icon ? <Icon name={icon} size={14} color={colors.textSecondary} /> : null}
        <Text variant="caption" muted numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, flexWrap: 'wrap' }}>
        {valueSlot ?? (
          <Text variant={size === 'lg' ? 'metric' : 'headline'} color={accent} tabular numberOfLines={1}>
            {value}
          </Text>
        )}
        {unit ? (
          <Text variant="small" muted maxFontSizeMultiplier={1.4}>
            {unit}
          </Text>
        ) : null}
      </View>
      {delta ? (
        <Text variant="caption" color={delta.good ? colors.accentText : colors.textSecondary} tabular maxFontSizeMultiplier={1.4}>
          {delta.value}
        </Text>
      ) : null}
    </View>
  );
}
