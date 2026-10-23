import { useEffect, type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Path } from 'react-native-svg';

import { easings } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { clamp01, crossedMilestones } from './particles';
import { useReducedMotionSetting } from './reduced-motion';

export type ProgressRingProps = {
  /** Progresso de 0 a 1. */
  value: number;
  /** Diâmetro (pt). */
  size: number;
  stroke?: number;
  color: string;
  trackColor?: string;
  /** Cortes fixos no anel (6 = os traços de giz da zona). */
  segments?: number;
  /** Cor dos cortes (o fundo atrás do anel). */
  gapColor?: string;
  /** Marcos (0–1): o anel pulsa 1× e avisa `onMilestone` quando os cruza subindo. Ex.: [0.25, 0.5, 0.75]. */
  pulseAt?: readonly number[];
  onMilestone?: (milestone: number) => void;
  duration?: number;
  delay?: number;
  /** Conteúdo no centro (número, ícone). */
  children?: ReactNode;
  /** Obrigatório: o que o leitor de tela diz, ex.: "Zona 50% pintada". */
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Anel de progresso só com transform: duas metades de anel (SVG estático) giram dentro de recortes, uma
 * por metade do progresso. Pulso 1 → 1,08 → 1 nos marcos. "Reduzir movimento": vai direto ao valor, sem pulso.
 */
export function ProgressRing({
  value,
  size,
  stroke = 10,
  color,
  trackColor,
  segments = 0,
  gapColor,
  pulseAt = [],
  onMilestone,
  duration = 600,
  delay = 0,
  children,
  accessibilityLabel,
  testID,
  style,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionSetting();
  const target = clamp01(value);
  const progress = useSharedValue(reduced ? target : 0);
  const pulse = useSharedValue(1);
  const fire = (marks: number[]) => {
    for (const m of marks) onMilestone?.(m);
  };

  useEffect(() => {
    const crossed = crossedMilestones(progress.get(), target, pulseAt);
    if (reduced) {
      progress.set(target);
      if (crossed.length > 0) fire(crossed);
      return;
    }
    progress.set(
      withDelay(
        delay,
        withTiming(target, { duration, easing: easings.enter }, (finished) => {
          if (finished && crossed.length > 0) scheduleOnRN(fire, crossed);
        }),
      ),
    );
    if (crossed.length > 0) {
      pulse.set(withDelay(delay + duration, withSequence(withTiming(1.08, { duration: 150, easing: easings.standard }), withTiming(1, { duration: 150, easing: easings.standard }))));
    }
    // `pulseAt` e `fire` mudam de identidade a cada render; o efeito só reage ao valor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced, delay, duration, progress, pulse]);

  const rightStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.min(progress.get(), 0.5) * 360}deg` }] }));
  const leftStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.max(0, progress.get() - 0.5) * 360}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  const c = size / 2;
  const r = (size - stroke) / 2;
  const top = c - r;
  const bottom = c + r;
  // metade esquerda do anel (12h → 6h passando pelas 9h) e metade direita (12h → 6h pelas 3h)
  const leftArc = `M ${c} ${top} A ${r} ${r} 0 0 0 ${c} ${bottom}`;
  const rightArc = `M ${c} ${top} A ${r} ${r} 0 0 1 ${c} ${bottom}`;
  const half = (side: 'left' | 'right') => (
    <View style={{ position: 'absolute', top: 0, width: c, height: size, overflow: 'hidden', left: side === 'right' ? c : 0 }}>
      <Animated.View style={[{ position: 'absolute', top: 0, width: size, height: size, left: side === 'right' ? -c : 0 }, side === 'right' ? rightStyle : leftStyle]}>
        <Svg width={size} height={size}>
          <Path d={side === 'right' ? leftArc : rightArc} stroke={color} strokeWidth={stroke} fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );

  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[{ width: size, height: size }, style, pulseStyle]}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={c} cy={c} r={r} stroke={trackColor ?? colors.surfaceSunken} strokeWidth={stroke} fill="none" />
      </Svg>
      {half('right')}
      {half('left')}
      {segments > 1
        ? Array.from({ length: segments }, (_, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{ position: 'absolute', left: c - 1.5, top: 0, width: 3, height: c, transformOrigin: 'bottom', transform: [{ rotate: `${(i * 360) / segments}deg` }] }}>
              <View style={{ width: 3, height: stroke + 2, marginTop: top - stroke / 2 - 1, backgroundColor: gapColor ?? colors.background }} />
            </View>
          ))
        : null}
      {children ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View> : null}
    </Animated.View>
  );
}
