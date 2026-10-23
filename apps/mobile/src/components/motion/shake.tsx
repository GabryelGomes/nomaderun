import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { easings } from '@/theme/motion';

import { shakeOffsets } from './particles';
import { useReducedMotionSetting } from './reduced-motion';

export type ShakeProps = {
  /** Mudou (e não é 0) = treme. Ex.: um contador de golpes. */
  trigger: number;
  /** Amplitude: pt no eixo x, graus no giro. */
  amplitude?: number;
  cycles?: number;
  axis?: 'x' | 'rotate';
  /** Duração total do tremor. */
  duration?: number;
  /** Atraso antes de tremer. */
  delay?: number;
  /** Pivô do giro (o baú treme apoiado na base). */
  origin?: 'center' | 'bottom';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Envolve o filho e o faz tremer, amortecendo até parar (golpe no chefão, baú, erro de formulário). Roda na
 * thread de UI (shared value). "Reduzir movimento": não treme.
 */
export function Shake({ trigger, amplitude = 14, cycles = 3, axis = 'x', duration = 320, delay = 0, origin = 'center', children, style, testID }: ShakeProps) {
  const reduced = useReducedMotionSetting();
  const offset = useSharedValue(0);
  useEffect(() => {
    if (reduced || !trigger) {
      offset.set(0);
      return;
    }
    const seq = shakeOffsets(amplitude, cycles);
    const step = duration / seq.length;
    // espera parada (mesmo valor) e depois o tremor; tudo numa sequência só
    const steps = seq.map((v) => withTiming(v, { duration: step, easing: easings.linear }));
    offset.set(withSequence(withTiming(0, { duration: Math.max(0, delay) }), ...steps));
  }, [trigger, reduced, amplitude, cycles, duration, delay, offset]);
  const animated = useAnimatedStyle(() => (axis === 'rotate' ? { transform: [{ rotate: `${offset.get()}deg` }] } : { transform: [{ translateX: offset.get() }] }));
  return (
    <Animated.View testID={testID} style={[style, origin === 'bottom' ? { transformOrigin: 'bottom' } : null, animated]}>
      {children}
    </Animated.View>
  );
}
