import { useState } from 'react';
import { type DimensionValue, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { radius as radii } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useReducedMotionSetting } from './reduced-motion';
import { usePausedWhenHidden } from './use-paused-when-hidden';

export type ShimmerSkeletonProps = {
  /** `line`: linha de texto; `circle`: avatar/ícone; `card`: bloco; `row`: avatar + 2 linhas. */
  shape: 'line' | 'card' | 'circle' | 'row';
  width?: DimensionValue;
  height?: number;
  /** Quantas linhas (só `line`); a última é mais curta. */
  lines?: number;
  /** O que o leitor de tela diz (padrão "Carregando"). */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const SHIMMER_MS = 1200;

/** Um bloco cinza com a faixa de brilho que atravessa (só `translateX`). */
function Block({ width, height, radius, paused }: { width: DimensionValue; height: number; radius: number; paused: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotionSetting();
  const [w, setW] = useState(0);
  const band = Math.max(40, w * 0.6);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ width, height, borderRadius: radius, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
      {!reduced && w > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: band,
            backgroundColor: 'rgba(255,255,255,0.07)',
            animationName: { from: { transform: [{ translateX: -band }] }, to: { transform: [{ translateX: w }] } },
            animationDuration: SHIMMER_MS,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Esqueleto de carregamento no formato do conteúdo (substitui o `ActivityIndicator`). "Reduzir movimento":
 * sem faixa; o bloco inteiro pulsa a opacidade (0,5 ↔ 0,8 a cada 1,6 s).
 */
export function ShimmerSkeleton({ shape, width = '100%', height, lines = 1, accessibilityLabel = 'Carregando', testID, style }: ShimmerSkeletonProps) {
  const reduced = useReducedMotionSetting();
  // o laço para fora de foco e com o app no fundo (T7.2.9)
  const paused = usePausedWhenHidden();
  let body;
  if (shape === 'circle') {
    const d = height ?? 48;
    body = <Block width={d} height={d} radius={d / 2} paused={paused} />;
  } else if (shape === 'card') {
    body = <Block width={width} height={height ?? 120} radius={radii.lg} paused={paused} />;
  } else if (shape === 'row') {
    const d = height ?? 40;
    body = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Block width={d} height={d} radius={d / 2} paused={paused} />
        <View style={{ flex: 1, gap: 8 }}>
          <Block width="70%" height={12} radius={6} paused={paused} />
          <Block width="45%" height={10} radius={5} paused={paused} />
        </View>
      </View>
    );
  } else {
    const h = height ?? 14;
    const n = Math.max(1, Math.floor(lines));
    body = (
      <View style={{ gap: 8 }}>
        {Array.from({ length: n }, (_, i) => (
          <Block key={i} width={n > 1 && i === n - 1 ? '60%' : width} height={h} radius={h / 2} paused={paused} />
        ))}
      </View>
    );
  }
  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      style={[
        { width: shape === 'circle' ? undefined : width },
        reduced
          ? {
              animationName: { from: { opacity: 0.5 }, to: { opacity: 0.8 } },
              animationDuration: 800,
              animationDirection: 'alternate',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
              animationPlayState: paused ? 'paused' : 'running',
            }
          : null,
        style,
      ]}>
      {body}
    </Animated.View>
  );
}
