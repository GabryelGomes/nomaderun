import { Pressable, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { durations, easings } from '@/theme/motion';
import { motion } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { haptic } from './motion/haptics';
import { Text } from './text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 76;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Hold to finish the run (Product Book §4.3): a 600 ms ring fills while the finger is down,
 * so a stray tap in a pocket never ends a run. Purpose: feedback. Linear timing, UI thread.
 * "Reduzir movimento" (RNF-011, QA-12): o anel não é desenhado aos poucos; ele aparece inteiro
 * e vai da transparência à cor cheia nos mesmos 600 ms (só opacidade).
 */
export function HoldButton({ label, onConfirm, testID }: { label: string; onConfirm: () => void; testID?: string }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();

  const confirm = () => {
    haptic('success');
    onConfirm();
  };

  const ringProps = useAnimatedProps(() =>
    reduced ? { strokeDashoffset: 0, strokeOpacity: progress.get() } : { strokeDashoffset: CIRC * (1 - progress.get()), strokeOpacity: 1 },
  );

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Mantenha pressionado para confirmar"
        onPressIn={() => {
          progress.set(
            withTiming(1, { duration: motion.holdToConfirm, easing: easings.linear }, (finished) => {
              if (finished) scheduleOnRN(confirm);
            }),
          );
        }}
        onPressOut={() => {
          cancelAnimation(progress);
          // solta antes dos 600 ms: o anel volta rápido (power2.out), sem encerrar
          progress.set(withTiming(0, { duration: durations.reducedFade, easing: easings.standard }));
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
      <Text variant="caption" muted numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
