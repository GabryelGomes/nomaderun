import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReducedMotionSetting } from '@/components/motion';
import type { LatLng } from '@/domain/types';
import { cssEasings, durations } from '@/theme/motion';
import { palette } from '@/theme/tokens';

import { routeChunkDelay, routeChunks, ROUTE_DRAW_MS } from './route-draw.math';

const FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } } as const;
/** Cada pedaço acende em 160 ms; a cascata inteira leva `ROUTE_DRAW_MS`. */
const CHUNK_MS = 160;

/**
 * A rota da corrida se desenhando (1º passo do resumo cinematográfico, T7.2.7): traço neon na cor do time,
 * pedaço por pedaço, só com opacidade. Sem mapa-base e sem grade (o mapa nunca mostra hexágonos).
 * "Reduzir movimento": a rota inteira aparece com um fade de 150 ms. Decorativa para o leitor de tela
 * (os números ao lado dizem o que importa).
 */
export function RouteDraw({ path, color, height = 180, delay = 0, testID }: { path: readonly LatLng[]; color: string; height?: number; delay?: number; testID?: string }) {
  const reduced = useReducedMotionSetting();
  const [width, setWidth] = useState(0);
  const draw = useMemo(() => (width > 0 ? routeChunks(path, width, height) : null), [path, width, height]);
  const n = draw?.chunks.length ?? 0;
  const fade = (i: number) => ({
    animationName: FADE_IN,
    animationDuration: reduced ? durations.reducedFade : CHUNK_MS,
    animationDelay: delay + (reduced ? 0 : routeChunkDelay(i, n)),
    animationTimingFunction: cssEasings.standard,
    animationFillMode: 'both' as const,
  });
  return (
    <View testID={testID} aria-hidden importantForAccessibility="no-hide-descendants" onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height, width: '100%' }}>
      {draw?.chunks.map((d, i) => (
        <Animated.View key={i} pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, fade(i)]}>
          <Svg width={width} height={height}>
            <Path d={d} stroke={color} strokeOpacity={0.28} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={d} stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Animated.View>
      ))}
      {draw?.start ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, fade(0)]}>
          <Svg width={width} height={height}>
            <Circle cx={draw.start.x} cy={draw.start.y} r={5} fill={palette.white} stroke={color} strokeWidth={2} />
          </Svg>
        </Animated.View>
      ) : null}
      {draw?.end ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', inset: 0 },
            { ...fade(n), animationDelay: delay + (reduced ? 0 : ROUTE_DRAW_MS) },
          ]}>
          <Svg width={width} height={height}>
            <Circle cx={draw.end.x} cy={draw.end.y} r={8} fill={palette.orange} stroke={palette.white} strokeWidth={3} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
