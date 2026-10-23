import { useState, type ReactNode } from 'react';
import { Pressable as RNPressable, type PressableProps as RNPressableProps, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { cssEasings, durations, type HapticPattern } from '@/theme/motion';
import { neon } from '@/theme/neon';

import { pressFeedback } from '../press-feedback';
import { haptic as vibrate } from './haptics';
import { useReducedMotionSetting } from './reduced-motion';

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
  /**
   * Vibração ao tocar (padrão desligada). `true` = `tap`; ou um padrão de `haptics.ts`. iOS e Android; nada
   * na web.
   */
  haptic?: HapticPattern | boolean;
  /** Preferência "Vibração" da pessoa (padrão ligada). */
  hapticsEnabled?: boolean;
  /** Brilho neon atrás do alvo, que sobe ao pressionar (só no CTA principal). */
  glow?: boolean;
  /** Cor do brilho (padrão: o neon laranja). */
  glowColor?: string;
  /** Escala ao pressionar (padrão 0,97). */
  scale?: number;
  /** Opacidade de repouso (ex.: 0,45 desabilitado). Padrão: 0,45 quando `disabled`, senão 1. */
  baseOpacity?: number;
};

/**
 * Alvo de toque com retorno: escala 0,97 em 120 ms (power2.out) + opacidade com "Reduzir movimento".
 * Mesmo retorno do `Button`/`IconButton` (`press-feedback.ts`). Use em cards, linhas de lista e chips.
 * `hitSlop` padrão de 8 pt: um alvo visual de 36 pt já vira 52 pt de toque.
 * Nada bloqueia o toque: a transição é só visual e o `onPress` dispara no mesmo frame.
 */
export function PressableScale({
  testID,
  accessibilityLabel,
  children,
  style,
  containerStyle,
  haptic,
  hapticsEnabled = true,
  glow,
  glowColor,
  scale,
  baseOpacity,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  hitSlop = 8,
  ...rest
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotionSetting();
  const base = baseOpacity ?? (disabled ? 0.45 : 1);
  const pattern: HapticPattern | null = haptic === true ? 'tap' : haptic ? haptic : null;
  const feedback = pressFeedback(pressed, reduced, base);
  const scaled = !reduced && scale !== undefined ? { ...feedback, transform: [{ scale: pressed ? scale : 1 }] } : feedback;
  const radius = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? 999;
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
        if (pattern) vibrate(pattern, { enabled: hapticsEnabled });
        onPress?.(e);
      }}
      style={containerStyle}>
      <Animated.View style={[style, scaled]}>
        {glow ? (
          // sombra fixa; só a opacidade da camada muda (sombra animada é cara no Android)
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: radius,
              boxShadow: glowColor ? `0 0 28px ${glowColor}8C, 0 0 8px ${glowColor}99` : neon.buttonGlow,
              opacity: pressed && !disabled ? 0.8 : 0.6,
              transitionProperty: 'opacity',
              transitionDuration: durations.press,
              transitionTimingFunction: cssEasings.standard,
            }}
          />
        ) : null}
        {glow ? <View style={{ zIndex: 1 }}>{children}</View> : children}
      </Animated.View>
    </RNPressable>
  );
}

/** Mesmo componente com o nome `Pressable`: o teste de testIDs (RNF-012) reconhece a tag e exige testID e descrição. */
export const Pressable = PressableScale;
