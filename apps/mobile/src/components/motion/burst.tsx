import { useMemo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { cssEasings } from '@/theme/motion';

import { burstRays } from './particles';
import { useReducedMotionSetting } from './reduced-motion';

export type BurstProps = {
  /** Faíscas (padrão 10; teto de 60). */
  count?: number;
  color: string;
  /** Distância percorrida (pt). */
  distance?: number;
  /** Comprimento de cada faísca (pt). */
  length?: number;
  delay?: number;
  duration?: number;
  /** Centro (pt) dentro do pai; padrão: o centro do pai. */
  origin?: { x: number; y: number };
  seed?: number;
  testID?: string;
};

/** Faíscas radiais que saem do centro e somem (280 ms). Decorativo. "Reduzir movimento": não renderiza. */
export function Burst({ count = 10, color, distance = 56, length = 14, delay = 0, duration = 280, origin, seed = 7, testID }: BurstProps) {
  const reduced = useReducedMotionSetting();
  const rays = useMemo(() => burstRays(count, { seed, distance, length }), [count, seed, distance, length]);
  if (reduced || rays.length === 0) return null;
  return (
    <View
      testID={testID}
      aria-hidden
      pointerEvents="none"
      style={[{ position: 'absolute', width: 0, height: 0 }, origin ? { left: origin.x, top: origin.y } : { left: '50%', top: '50%' }]}>
      {rays.map((r) => (
        // giro fixo do raio no invólucro; só o filho anima (translateX + scaleX + opacidade)
        <View key={r.id} style={{ position: 'absolute', left: 0, top: -1.5, width: 0, height: 3, transform: [{ rotate: `${r.angle}deg` }] }}>
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: r.length,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: color,
              transformOrigin: 'left',
              // escondido até o atraso acabar (com 'both' o raio aparecia parado antes do estouro)
              opacity: 0,
              animationName: {
                from: { opacity: 1, transform: [{ translateX: 6 }, { scaleX: 1 }] },
                to: { opacity: 0, transform: [{ translateX: r.distance }, { scaleX: 0.2 }] },
              },
              animationDuration: duration,
              animationDelay: delay + r.delay,
              animationTimingFunction: cssEasings.standard,
              animationFillMode: 'forwards',
            }}
          />
        </View>
      ))}
    </View>
  );
}
