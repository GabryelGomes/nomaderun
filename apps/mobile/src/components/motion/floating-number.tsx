import { useEffect } from 'react';
import Animated from 'react-native-reanimated';

import { durations } from '@/theme/motion';

import { Text } from '../text';
import { useReducedMotionSetting } from './reduced-motion';

export type FloatingNumberProps = {
  /** Texto curto: "−8,4 km", "+40 XP". */
  text: string;
  color?: string;
  /** Tamanho da fonte (pt). */
  size?: number;
  /** Quanto sobe (pt). */
  rise?: number;
  delay?: number;
  duration?: number;
  /** Deslocamento lateral (pt), para empilhar vários (ver `floatingStack`). */
  offsetX?: number;
  onEnd?: () => void;
  testID?: string;
};

/**
 * Número que pula (0,5 → 1,2 → 1 nos primeiros 200 ms), sobe e some (800 ms). Decorativo: o momento que o
 * usa anuncia o valor ao leitor de tela. "Reduzir movimento": aparece e some só com opacidade, sem subir.
 */
export function FloatingNumber({ text, color = '#FFFFFF', size = 46, rise = 78, delay = 0, duration = durations.damageFloat, offsetX = 0, onEnd, testID }: FloatingNumberProps) {
  const reduced = useReducedMotionSetting();
  useEffect(() => {
    if (!onEnd) return;
    const t = setTimeout(onEnd, (reduced ? 0 : delay) + duration);
    return () => clearTimeout(t);
  }, [onEnd, reduced, delay, duration]);
  return (
    <Animated.View
      testID={testID}
      aria-hidden
      pointerEvents="none"
      style={{
        position: 'absolute',
        alignSelf: 'center',
        transform: [{ translateX: offsetX }],
        animationName: reduced
          ? { '0%': { opacity: 0 }, '20%': { opacity: 1 }, '80%': { opacity: 1 }, '100%': { opacity: 0 } }
          : {
              '0%': { opacity: 0, transform: [{ translateX: offsetX }, { translateY: 0 }, { scale: 0.5 }] },
              '12%': { opacity: 1, transform: [{ translateX: offsetX }, { translateY: 0 }, { scale: 1.2 }] },
              '25%': { opacity: 1, transform: [{ translateX: offsetX }, { translateY: 0 }, { scale: 1 }] },
              '100%': { opacity: 0, transform: [{ translateX: offsetX }, { translateY: -rise }, { scale: 1 }] },
            },
        animationDuration: duration,
        animationDelay: reduced ? 0 : delay,
        animationTimingFunction: 'linear',
        animationFillMode: 'both',
      }}>
      <Text variant="metric" tabular color={color} style={{ fontSize: size, lineHeight: size * 1.1, textShadowColor: color, textShadowRadius: 12 }}>
        {text}
      </Text>
    </Animated.View>
  );
}
