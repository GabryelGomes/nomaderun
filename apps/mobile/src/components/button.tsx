import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { neon } from '@/theme/neon';
import { floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { pressFeedback } from './press-feedback';
import { Text } from './text';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  kind?: Kind;
  icon?: IconName;
  size?: 'md' | 'lg';
  wide?: boolean;
  trailing?: ReactNode;
  /** Ocupado (ex.: "Entrando…"): anunciado ao leitor de tela junto com o desativado. */
  busy?: boolean;
};

/** Teto da fonte do sistema nos rótulos de botão: acima disso o rótulo quebra a pílula (QA, fonte grande). */
export const BUTTON_FONT_MAX = 1.4;

/** Press feedback per expo-animation: scale 0.97 on press-in, 120 ms (sem escala com "Reduzir movimento"). */
export function Button({ label, kind = 'primary', icon, size = 'md', wide, trailing, onPress, disabled, busy, accessibilityState, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const palette = {
    primary: { bg: colors.action, fg: colors.onAction, border: 'transparent' },
    // D-75: borda de controle com 3:1 e texto escuro no laranja e no vermelho.
    secondary: { bg: colors.surface, fg: colors.text, border: colors.lineControl },
    ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
    danger: { bg: colors.danger, fg: colors.onDanger, border: 'transparent' },
  }[kind];
  const height = size === 'lg' ? 60 : 48;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      // O desativado e o ocupado são anunciados (antes o leitor de tela lia um botão comum).
      accessibilityState={{ ...accessibilityState, disabled: !!disabled, busy: !!busy }}
      disabled={disabled}
      hitSlop={8}
      pressRetentionOffset={16}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={(e) => {
        if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={wide ? { alignSelf: 'stretch' } : undefined}>
      <Animated.View
        style={{
          // minHeight (não height): com fonte grande o rótulo cresce sem ser cortado.
          minHeight: height,
          paddingHorizontal: space[6],
          paddingVertical: space[1],
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: palette.bg,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: palette.border,
          // Neon (D-59): o botão principal acende com o brilho laranja da apresentação.
          boxShadow: kind === 'primary' && !disabled ? neon.buttonGlow : kind === 'danger' && !disabled ? neon.dangerGlow : undefined,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          ...pressFeedback(pressed, reduced, disabled ? 0.45 : 1),
        }}>
        {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} color={palette.fg} /> : null}
        <Text variant={size === 'lg' ? 'title' : 'bodyBold'} color={palette.fg} maxFontSizeMultiplier={BUTTON_FONT_MAX} style={{ flexShrink: 1, textAlign: 'center' }}>
          {label}
        </Text>
        {trailing ? <View>{trailing}</View> : null}
      </Animated.View>
    </Pressable>
  );
}

/** Round icon-only control (map controls, run controls). 44pt minimum target. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 48,
  tone = 'surface',
  testID,
}: {
  testID?: string;
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: 'surface' | 'action' | 'danger' | 'sunken';
}) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const bg = { surface: colors.surface, action: colors.action, danger: colors.danger, sunken: colors.surfaceSunken }[tone];
  const fg = tone === 'danger' ? colors.onDanger : tone === 'action' ? colors.onAction : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: tone === 'surface' || tone === 'sunken' ? 1 : 0,
          borderColor: colors.line,
          boxShadow: tone === 'action' ? neon.buttonGlow : tone === 'danger' ? neon.dangerGlow : tone === 'surface' ? floating : undefined,
          ...pressFeedback(pressed, reduced),
        }}>
        <Icon name={icon} size={size * 0.42} color={fg} />
      </Animated.View>
    </Pressable>
  );
}
