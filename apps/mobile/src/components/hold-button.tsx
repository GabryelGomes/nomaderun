import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 76;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Hold to finish the run (Product Book §4.3): a 600 ms ring fills while the finger is down,
 * so a stray tap in a pocket never ends a run. Purpose: feedback. Linear timing, UI thread.
 */
export function HoldButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  const confirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - progress.get()) }));

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Mantenha pressionado para confirmar"
        onPressIn={() => {
          progress.set(
            withTiming(1, { duration: motion.holdToConfirm, easing: Easing.linear }, (finished) => {
              if (finished) scheduleOnRN(confirm);
            }),
          );
        }}
        onPressOut={() => {
          cancelAnimation(progress);
          progress.set(withTiming(0, { duration: 150 }));
        }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.line} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={colors.danger}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              animatedProps={ringProps}
            />
          </Svg>
          <View
            style={{
              width: SIZE - 18,
              height: SIZE - 18,
              borderRadius: SIZE,
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="stop" size={26} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}
