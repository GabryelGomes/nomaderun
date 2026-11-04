import { useEffect, useMemo, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { cssEasings, durations, springCss, springs } from '@/theme/motion';

import { haptic } from './haptics';
import { useReducedMotionSetting } from './reduced-motion';

export type StampInProps = {
  children: ReactNode;
  /** Escala de partida (padrão 1,3: o carimbo desce "de cima" da tela). */
  from?: number;
  /** Rotação de partida em graus (padrão −6°). */
  rotate?: number;
  delay?: number;
  /** Pulsa N vezes depois de assentar (escala 1 → 1,08 → 1, 260 ms cada; padrão 0). */
  pulses?: number;
  /** Vibra 1× (`impact`) quando o carimbo assenta (padrão: não). */
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } };

/** Duração de um pulso e a escala do pico. */
export const STAMP_PULSE = { ms: 260, scale: 1.08 } as const;

/** Quadros-chave do pulso repetido `n` vezes numa animação só (sem `iterationCount`, que a web trata diferente). */
export function pulseKeyframes(n: number, scale = STAMP_PULSE.scale): Record<string, { transform: { scale: number }[] }> {
  const count = Math.max(1, Math.round(n));
  const out: Record<string, { transform: { scale: number }[] }> = { '0%': { transform: [{ scale: 1 }] } };
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 100;
    const b = ((i + 1) / count) * 100;
    out[`${Math.round((a + (b - a) / 2) * 10) / 10}%`] = { transform: [{ scale }] };
    out[`${Math.round(b * 10) / 10}%`] = { transform: [{ scale: 1 }] };
  }
  return out;
}

/**
 * Entrada de carimbo (F8 · C1): escala `from` → 1 e giro `rotate` → 0 com a mola `stamp` (passa do alvo e volta),
 * com fade; opcionalmente pulsa depois de assentar. Usado no carimbo de bairro novo (1,3 → 1, −6° → 0) e no selo
 * do recorde (pulsa 2×). "Reduzir movimento": fade de 150 ms, sem escala, giro nem pulso.
 */
export function StampIn({ children, from = 1.3, rotate = -6, delay = 0, pulses = 0, haptics = false, style, testID }: StampInProps) {
  const reduced = useReducedMotionSetting();
  useEffect(() => {
    if (!haptics) return;
    // a mola `stamp` assenta perto de 40% da duração: é ali que o carimbo "bate"
    const t = setTimeout(() => haptic('impact'), reduced ? delay : delay + Math.round(springs.stamp.duration * 0.4));
    return () => clearTimeout(t);
  }, [haptics, reduced, delay]);

  // os mesmos objetos de quadros-chave entre renders (a animação não reinicia)
  const stampFrames = useMemo(() => ({ from: { opacity: 0, transform: [{ scale: from }, { rotate: `${rotate}deg` }] }, to: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] } }), [from, rotate]);
  const pulseFrames = useMemo(() => pulseKeyframes(pulses), [pulses]);

  if (reduced) {
    return (
      <Animated.View testID={testID} style={[style, { animationName: FADE_IN, animationDuration: durations.reducedFade, animationDelay: delay, animationFillMode: 'both' }]}>
        {children}
      </Animated.View>
    );
  }
  const stamp = {
    animationName: stampFrames,
    animationDuration: springs.stamp.duration,
    animationDelay: delay,
    animationTimingFunction: springCss('stamp'),
    animationFillMode: 'both' as const,
  };
  const body = (
    <Animated.View testID={testID} style={[style, stamp]}>
      {children}
    </Animated.View>
  );
  if (pulses <= 0) return body;
  return (
    <Animated.View
      testID={testID ? `${testID}-pulso` : undefined}
      style={{
        animationName: pulseFrames,
        animationDuration: STAMP_PULSE.ms * pulses,
        animationDelay: delay + springs.stamp.duration,
        animationTimingFunction: cssEasings.swap,
        animationFillMode: 'both',
      }}>
      {body}
    </Animated.View>
  );
}
