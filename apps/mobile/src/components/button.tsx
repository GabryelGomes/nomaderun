import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CSS_EASE_OUT } from '@/theme/easing';
import { motion, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  kind?: Kind;
  icon?: IconName;
  size?: 'md' | 'lg';
  wide?: boolean;
  trailing?: ReactNode;
};

/**
 * Press feedback per expo-animation: scale 0.97 on press-in, 120 ms, strong ease-out,
 * as a Reanimated CSS transition (no shared value for a two-state toggle).
 */
export function Button({ label, kind = 'primary', icon, size = 'md', wide, trailing, onPress, disabled, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const palette = {
    primary: { bg: colors.action, fg: colors.onAction, border: 'transparent' },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.line },
    ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
    danger: { bg: colors.danger, fg: '#FFFFFF', border: 'transparent' },
  }[kind];
  const height = size === 'lg' ? 60 : 48;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
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
          height,
          paddingHorizontal: space[6],
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: palette.bg,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? motion.press.scale : 1 }],
          transitionProperty: 'transform',
          transitionDuration: motion.press.duration,
          transitionTimingFunction: CSS_EASE_OUT,
        }}>
        {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} color={palette.fg} /> : null}
        <Text variant={size === 'lg' ? 'title' : 'bodyBold'} color={palette.fg}>
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
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: 'surface' | 'action' | 'danger' | 'sunken';
}) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const bg = { surface: colors.surface, action: colors.action, danger: colors.danger, sunken: colors.surfaceSunken }[tone];
  const fg = tone === 'danger' ? '#FFFFFF' : tone === 'action' ? colors.onAction : colors.text;
  return (
    <Pressable
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
          boxShadow: tone === 'surface' ? '0 2px 12px rgba(37, 42, 49, 0.12)' : undefined,
          transform: [{ scale: pressed ? motion.press.scale : 1 }],
          transitionProperty: 'transform',
          transitionDuration: motion.press.duration,
          transitionTimingFunction: CSS_EASE_OUT,
        }}>
        <Icon name={icon} size={size * 0.42} color={fg} />
      </Animated.View>
    </Pressable>
  );
}
