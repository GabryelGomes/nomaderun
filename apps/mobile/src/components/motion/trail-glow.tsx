import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { cssEasings } from '@/theme/motion';

import { useReducedMotionSetting } from './reduced-motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Trecho de rastro estilizado (viewBox 72 × 28): sobe e desce como uma rua, termina à direita. */
export const TRAIL_GLOW_PATH = 'M 4 20 C 16 20, 20 6, 34 8 S 52 22, 68 10';
/** Comprimento aproximado do traço (unidades do viewBox) e do brilho que corre por ele. */
export const TRAIL_GLOW_LENGTH = 80;
export const TRAIL_GLOW_SEGMENT = 18;
/** Opacidade do brilho: 0 → 1 → 0. */
const GLOW_FRAMES = { '0%': { opacity: 0 }, '40%': { opacity: 1 }, '100%': { opacity: 0 } };
const VB_W = 72;
const VB_H = 28;

/** Deslocamento do traço do brilho no progresso `p` (0 → 1): entra antes do começo e sai depois do fim. */
export function glowDashOffset(p: number, length = TRAIL_GLOW_LENGTH, segment = TRAIL_GLOW_SEGMENT): number {
  'worklet';
  const t = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  return segment - t * (segment + length);
}

export type TrailGlowProps = {
  /** Cor do rastro (a neon do time). */
  color: string;
  /** Largura em pt (a altura segue o viewBox 72 × 28). Padrão 72. */
  width?: number;
  /** Toca o brilho uma vez ao montar (padrão: sim). */
  play?: boolean;
  /** Atraso do brilho (ms). */
  delay?: number;
  /** Duração do brilho inteiro: opacidade 0 → 1 → 0 enquanto corre pela linha (padrão 400 ms). */
  duration?: number;
  testID?: string;
};

/**
 * Linha do rastro com um brilho que corre por ela (F8 · C1, "Primeiro trecho!"): 2 traços parados (halo e linha) e
 * 1 traço curto branco que anda do começo ao fim (`strokeDashoffset` na thread de UI) com a opacidade 0 → 1 → 0.
 * Custo: 2 `Svg`, 1 valor compartilhado. "Reduzir movimento": a linha fica parada e o brilho não aparece.
 * Decorativa (quem usa diz o feito em texto).
 */
export function TrailGlow({ color, width = 72, play = true, delay = 0, duration = 400, testID }: TrailGlowProps) {
  const reduced = useReducedMotionSetting();
  const live = play && !reduced;
  const height = (width * VB_H) / VB_W;
  const p = useSharedValue(0);
  useEffect(() => {
    if (!live) return;
    p.set(0);
    p.set(withDelay(delay, withTiming(1, { duration, easing: Easing.linear })));
  }, [live, delay, duration, p]);
  const glowProps = useAnimatedProps(() => ({ strokeDashoffset: glowDashOffset(p.get()) }));
  return (
    <View testID={testID} aria-hidden importantForAccessibility="no-hide-descendants" style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Path d={TRAIL_GLOW_PATH} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={8} strokeLinecap="round" />
        <Path d={TRAIL_GLOW_PATH} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
      </Svg>
      {live ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            opacity: 0,
            animationName: GLOW_FRAMES,
            animationDuration: duration,
            animationDelay: delay,
            animationTimingFunction: cssEasings.standard,
            animationFillMode: 'forwards',
          }}>
          <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <AnimatedPath
              d={TRAIL_GLOW_PATH}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${TRAIL_GLOW_SEGMENT} ${TRAIL_GLOW_LENGTH}`}
              animatedProps={glowProps}
            />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
