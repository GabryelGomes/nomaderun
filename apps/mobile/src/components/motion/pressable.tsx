import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable as RNPressable, type PressableProps as RNPressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { pressFeedback } from '../press-feedback';

export type PressableScaleProps = Omit<RNPressableProps, 'style' | 'children' | 'testID' | 'accessibilityLabel'> & {
  /** Obrigatório (RNF-012, fluxos Maestro). */
  testID: string;
  /** Obrigatório (RNF-011): o que o leitor de tela diz. */
  accessibilityLabel: string;
  children: ReactNode;
  /** Estilo visual (fundo, borda, padding): fica no invólucro que encolhe. */
  style?: StyleProp<ViewStyle>;
  /** Estilo de layout do alvo de toque (ex.: `{ flex: 1 }` numa linha). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Vibração leve no iOS ao tocar (padrão desligado). */
  haptic?: boolean;
  /** Opacidade de repouso (ex.: 0,45 desabilitado). Padrão: 0,45 quando `disabled`, senão 1. */
  baseOpacity?: number;
};

/**
 * Alvo de toque com retorno: escala 0,97 em 120 ms (power2.out) + opacidade com "Reduzir movimento".
 * Mesmo retorno do `Button`/`IconButton` (`press-feedback.ts`). Use em cards, linhas de lista e chips.
 * `hitSlop` padrão de 8 pt: um alvo visual de 36 pt já vira 52 pt de toque.
 * Nada bloqueia o toque: a transição é só visual e o `onPress` dispara no mesmo frame.
 */
export function PressableScale({ testID, accessibilityLabel, children, style, containerStyle, haptic, baseOpacity, disabled, onPress, onPressIn, onPressOut, hitSlop = 8, ...rest }: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const base = baseOpacity ?? (disabled ? 0.45 : 1);
  return (
    <RNPressable
      {...rest}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={containerStyle}>
      <Animated.View style={[style, pressFeedback(pressed, reduced, base)]}>{children}</Animated.View>
    </RNPressable>
  );
}

/** Mesmo componente com o nome `Pressable`: o teste de testIDs (RNF-012) reconhece a tag e exige testID e descrição. */
export const Pressable = PressableScale;
