import type { ReactNode } from 'react';
import { View } from 'react-native';

import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { PressableScale } from './motion/pressable';
import { Text } from './text';

export type BigRunButtonProps = {
  onPress: () => void;
  testID: string;
  /** Verbo de ação (padrão "Correr"). */
  label?: string;
  /** Linha curta abaixo do rótulo (ex.: "Missão 1 · 500 m"). */
  sublabel?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Camada atrás do botão para o pulso da E5 (só na 1ª vez). Decorativa. */
  halo?: ReactNode;
};

/** Altura do botão: o maior alvo da tela, na zona do polegar. */
export const BIG_RUN_HEIGHT = 72;

/**
 * O "Correr" grande (ação primária do Mapa, do vazio de Corridas e da Zona): pílula laranja de 72 pt com texto escuro
 * (D-75) e brilho neon. Correr fica sempre a 1 toque.
 */
export function BigRunButton({ onPress, testID, label = 'Correr', sublabel, accessibilityLabel, disabled, halo }: BigRunButtonProps) {
  const { colors } = useTheme();
  return (
    <View>
      {halo ? (
        <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          {halo}
        </View>
      ) : null}
      <PressableScale
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? (sublabel ? `${label}. ${sublabel}` : label)}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        haptic
        onPress={onPress}
        style={{
          minHeight: BIG_RUN_HEIGHT,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: colors.action,
          boxShadow: disabled ? undefined : neon.buttonGlow,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[3],
          paddingHorizontal: space[6],
          paddingVertical: space[2],
        }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.onAction, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="play" size={24} color={colors.action} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text variant="headline" color={colors.onAction} style={{ textTransform: 'uppercase' }} numberOfLines={1}>
            {label}
          </Text>
          {sublabel ? (
            <Text variant="caption" color={colors.onAction} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      </PressableScale>
    </View>
  );
}
