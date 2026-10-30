import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { cssEasings, durations } from '@/theme/motion';

import { useReducedMotionSetting } from './reduced-motion';
import { usePausedWhenHidden } from './use-paused-when-hidden';

export type SpinRaysProps = {
  color: string;
  /** Diâmetro (pt). */
  size: number;
  rays?: number;
  /** Uma volta a cada `periodMs` (padrão 9 s). */
  periodMs?: number;
  delay?: number;
  /** Pausa o giro. Fora de foco e com o app no fundo ele já pausa sozinho (`usePausedWhenHidden`). */
  paused?: boolean;
  /** Opacidade dos raios. */
  opacity?: number;
  testID?: string;
};

/** Pontos de cada raio (triângulos finos saindo do centro). Puro. */
export function rayPolygons(rays: number, size: number): string[] {
  const c = size / 2;
  const n = Math.max(3, Math.floor(rays));
  const half = (Math.PI / n) * 0.45;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const p1 = `${(c + Math.cos(a - half) * c).toFixed(2)},${(c + Math.sin(a - half) * c).toFixed(2)}`;
    const p2 = `${(c + Math.cos(a + half) * c).toFixed(2)},${(c + Math.sin(a + half) * c).toFixed(2)}`;
    return `${c},${c} ${p1} ${p2}`;
  });
}

/**
 * Raios que abrem (0,3 → 1, girando 25°) e depois giram devagar. O desenho é um SVG estático; só a `View`
 * gira. "Reduzir movimento": raios parados, com fade curto.
 */
export function SpinRays({ color, size, rays = 16, periodMs = 9000, delay = 0, paused = false, opacity = 0.35, testID }: SpinRaysProps) {
  const reduced = useReducedMotionSetting();
  const hidden = usePausedWhenHidden({ paused });
  const art = (
    <Svg width={size} height={size}>
      {rayPolygons(rays, size).map((points, i) => (
        <Polygon key={i} points={points} fill={color} />
      ))}
    </Svg>
  );
  return (
    <View testID={testID} aria-hidden pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          animationName: reduced
            ? { from: { opacity: 0 }, to: { opacity } }
            : { from: { opacity: 0, transform: [{ scale: 0.3 }, { rotate: '0deg' }] }, to: { opacity, transform: [{ scale: 1 }, { rotate: '25deg' }] } },
          animationDuration: reduced ? durations.reducedFade : 450,
          animationDelay: reduced ? 0 : delay,
          animationTimingFunction: cssEasings.reveal,
          animationFillMode: 'both',
        }}>
        {reduced ? (
          art
        ) : (
          <Animated.View
            style={{
              width: size,
              height: size,
              animationName: { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } },
              animationDuration: periodMs,
              animationDelay: delay,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
              animationPlayState: hidden ? 'paused' : 'running',
            }}>
            {art}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}
