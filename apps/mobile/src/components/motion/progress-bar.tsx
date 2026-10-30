import { useEffect } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { durations, easings } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { clamp01, crossedMilestones } from './particles';
import { useReducedMotionSetting } from './reduced-motion';

export type ProgressBarProps = {
  /** Progresso de 0 a 1. Ao mudar, a barra anda até o valor novo. */
  value: number;
  /** De onde a barra parte ao montar (padrão 0; ex.: a vida antes do golpe). */
  from?: number;
  color: string;
  trackColor?: string;
  /** Barra fantasma (clara) que mostra quanto caiu ou subiu. Padrão: ligada. */
  ghost?: boolean;
  ghostColor?: string;
  /** Separadores fixos (ex.: 10 na vida do chefão). */
  segments?: number;
  /** Marcos (0–1) desenhados na trilha; `onMilestone` avisa quando a barra os cruza subindo. */
  milestones?: readonly number[];
  onMilestone?: (milestone: number) => void;
  height?: number;
  duration?: number;
  delay?: number;
  /** Brilho neon fixo na trilha (a sombra não anima). */
  glow?: boolean;
  /** Obrigatório: o que o leitor de tela diz, ex.: "Vida do chefão: 31%". */
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Barra de progresso só com transform (`scaleX` a partir da esquerda; nada de animar `width`). Descendo, a
 * barra da frente cai em 150 ms e a fantasma espera 300 ms e escoa em 420 ms; subindo, a fantasma marca o
 * ganho e a da frente enche (power3.out). "Reduzir movimento": vai direto ao valor.
 */
export function ProgressBar({
  value,
  from = 0,
  color,
  trackColor,
  ghost = true,
  ghostColor,
  segments = 0,
  milestones = [],
  onMilestone,
  height = 8,
  duration = 600,
  delay = 0,
  glow,
  accessibilityLabel,
  testID,
  style,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionSetting();
  const target = clamp01(value);
  const front = useSharedValue(reduced ? target : clamp01(from));
  const back = useSharedValue(reduced ? target : clamp01(from));
  const fire = (marks: number[]) => {
    for (const m of marks) onMilestone?.(m);
  };

  useEffect(() => {
    const from = front.get();
    const crossed = crossedMilestones(from, target, milestones);
    if (reduced) {
      front.set(target);
      back.set(target);
      if (crossed.length > 0) fire(crossed);
      return;
    }
    if (target < from) {
      front.set(withDelay(delay, withTiming(target, { duration: 150, easing: easings.standard })));
      back.set(withDelay(delay + durations.ghostHold, withTiming(target, { duration: durations.ghostDrain, easing: easings.reveal })));
      return;
    }
    back.set(withDelay(delay, withTiming(target, { duration: 150, easing: easings.standard })));
    front.set(
      withDelay(
        delay,
        withTiming(target, { duration, easing: easings.enter }, (finished) => {
          if (finished && crossed.length > 0) scheduleOnRN(fire, crossed);
        }),
      ),
    );
    // `milestones` e `fire` mudam de identidade a cada render; o efeito só reage ao valor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced, delay, duration, front, back]);

  const frontStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: front.get() }] }));
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: back.get() }] }));
  const radius = height / 2;
  const fill = { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius, transformOrigin: 'left' as const };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[{ height, borderRadius: radius, backgroundColor: trackColor ?? colors.surfaceSunken, overflow: 'hidden' }, glow ? { boxShadow: `0 0 12px ${color}66` } : null, style]}>
      {ghost ? <Animated.View style={[fill, { backgroundColor: ghostColor ?? color, opacity: 0.35 }, backStyle]} /> : null}
      <Animated.View style={[fill, { backgroundColor: color }, frontStyle]} />
      {segments > 1
        ? Array.from({ length: segments - 1 }, (_, i) => (
            <View key={`s${i}`} style={{ position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, left: `${((i + 1) / segments) * 100}%`, backgroundColor: trackColor ?? colors.background, opacity: 0.8 }} />
          ))
        : null}
      {milestones.map((m) => (
        <View key={`m${m}`} style={{ position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, left: `${clamp01(m) * 100}%`, backgroundColor: colors.text, opacity: 0.35 }} />
      ))}
    </View>
  );
}
