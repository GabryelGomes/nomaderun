import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { cssEasings, durations } from '@/theme/motion';

import { useReducedMotionSetting } from './reduced-motion';

export type FlashProps = {
  /** `radial`: clarão que cresce do centro; `screen`: a tela pisca; `edge`: a borda da tela acende. */
  kind: 'radial' | 'screen' | 'edge';
  color?: string;
  /** Opacidade no pico (0–1). */
  peak?: number;
  duration?: number;
  delay?: number;
  /** Diâmetro do clarão `radial` (pt). */
  size?: number;
  testID?: string;
};

/**
 * Clarão: só opacidade (o `radial` também escala). A sombra da borda é fixa e só a opacidade da camada
 * anima (sombra animada é cara no Android). "Reduzir movimento": `radial` e `screen` não piscam; `edge`
 * vira um fade curto.
 */
export function Flash({ kind, color = '#FFFFFF', peak = 0.9, duration = 320, delay = 0, size = 160, testID }: FlashProps) {
  const reduced = useReducedMotionSetting();
  if (reduced && kind !== 'edge') return null;
  const timing = {
    animationDuration: reduced ? durations.reducedFade * 2 : duration,
    animationDelay: reduced ? 0 : delay,
    animationTimingFunction: cssEasings.standard,
    animationFillMode: 'both' as const,
  };
  if (kind === 'radial') {
    return (
      <View testID={testID} aria-hidden pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
        <Animated.View
          style={{
            position: 'absolute',
            left: -size / 2,
            top: -size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            animationName: {
              '0%': { opacity: 0, transform: [{ scale: 0.3 }] },
              '30%': { opacity: peak, transform: [{ scale: 1 }] },
              '100%': { opacity: 0, transform: [{ scale: 1.8 }] },
            },
            ...timing,
          }}
        />
      </View>
    );
  }
  return (
    <Animated.View
      testID={testID}
      aria-hidden
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: kind === 'screen' ? color : 'transparent',
        boxShadow: kind === 'edge' ? `inset 0 0 0 3px ${color}, inset 0 0 70px ${color}` : undefined,
        animationName: { '0%': { opacity: 0 }, '35%': { opacity: peak }, '100%': { opacity: 0 } },
        ...timing,
      }}
    />
  );
}
