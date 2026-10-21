import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { type SharedValue, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { FactionId } from '@/domain/types';
import { cssEasings, durations, easings } from '@/theme/motion';
import { neon, neonTeam } from '@/theme/neon';
import { factions, palette } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CHALK_INTERVAL_MS, CHALK_STROKE_MS, CHALK_STROKES, CHALK_TOTAL_MS } from './capture-celebration.math';
import { FadeUp } from './motion/fade-up';
import { RevealText } from './motion/reveal-text';
import { TeamShapeGlyph } from './team-badge';
import { Text } from './text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 132;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * R;

export { CHALK_TOTAL_MS } from './capture-celebration.math';

/** Folga entre traços (graus), para lerem como traços separados de giz. */
const GAP_DEG = 5;
const SEG_DEG = 360 / CHALK_STROKES;
const SEG_LEN = (LENGTH * (SEG_DEG - GAP_DEG)) / 360;

function ChalkStroke({ index, clock, color }: { index: number; clock: SharedValue<number>; color: string }) {
  const props = useAnimatedProps(() => {
    // worklet: mesma conta de `chalkStrokeProgress`, com expo.out (1 - 2^(-10t), a definição do GSAP)
    const local = (clock.get() - index * CHALK_INTERVAL_MS) / CHALK_STROKE_MS;
    const p = local <= 0 ? 0 : local >= 1 ? 1 : 1 - Math.pow(2, -10 * local);
    return { strokeDashoffset: SEG_LEN * (1 - p), strokeOpacity: p > 0 ? 1 : 0 };
  });
  // Giro por `transform` de View (o `G rotation/origin` do react-native-svg gera aviso de DOM na web).
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, transform: [{ rotate: `${-90 + index * SEG_DEG + GAP_DEG / 2}deg` }] }}>
      <Svg width={SIZE} height={SIZE}>
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${SEG_LEN} ${LENGTH}`}
          animatedProps={props}
        />
      </Svg>
    </View>
  );
}

/**
 * O momento herói do app (pico do resumo, D-54). Seis traços na cor do time fecham a zona como uma volta
 * (ERS §6.2: 60 ms entre traços), a marca do time aparece e o título sobe palavra por palavra.
 * Vibra no mesmo frame em que o primeiro traço começa. "Reduzir movimento": anel já fechado, tudo só
 * com opacidade (sem traçar, deslocar ou escalar).
 */
export function CaptureCelebration({ faction, zone, rp }: { faction: FactionId; zone: string; rp: number }) {
  const reduced = useReducedMotion();
  const { scheme, colors } = useTheme();
  const night = scheme === 'dark';
  const f = factions[faction];
  const clock = useSharedValue(reduced ? CHALK_TOTAL_MS : 0);
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  useEffect(() => {
    // relógio linear da sequência; cada traço aplica a própria curva
    clock.set(reduced ? CHALK_TOTAL_MS : withTiming(CHALK_TOTAL_MS, { duration: CHALK_TOTAL_MS, easing: easings.linear }));
  }, [clock, reduced]);

  const glyphDelay = CHALK_TOTAL_MS - 180;
  const titleDelay = CHALK_TOTAL_MS - 60;
  return (
    <View accessible accessibilityLabel={`Zona conquistada: ${zone}, mais ${rp} pontos`} style={{ alignItems: 'center', gap: 12 }}>
      <Animated.View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          // Neon (D-59): o anel brilha na cor neon do time.
          boxShadow: night ? `0 0 36px ${neonTeam[faction]}66` : undefined,
          animationName: reduced ? { from: { opacity: 0 }, to: { opacity: 1 } } : undefined,
          animationDuration: durations.reducedFade,
          animationFillMode: 'both',
        }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill={night ? colors.surfaceSunken : f.tint} stroke={night ? colors.line : palette.line} strokeWidth={STROKE} />
        </Svg>
        {Array.from({ length: CHALK_STROKES }, (_, i) => (
          <ChalkStroke key={i} index={i} clock={clock} color={f.color} />
        ))}
        <Animated.View
          style={{
            position: 'absolute',
            inset: 0,
            animationName: reduced
              ? { from: { opacity: 0 }, to: { opacity: 1 } }
              : { from: { opacity: 0, transform: [{ scale: 0.6 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
            animationDuration: reduced ? durations.reducedFade : durations.enter,
            animationDelay: reduced ? 0 : glyphDelay,
            animationTimingFunction: cssEasings.reveal,
            animationFillMode: 'both',
          }}>
          <Svg width={SIZE} height={SIZE}>
            <TeamShapeGlyph shape={f.shape} size={SIZE} color={f.color} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <RevealText variant="headline" align="center" header={false} delay={reduced ? 0 : titleDelay}>
          Zona conquistada
        </RevealText>
        <FadeUp delay={reduced ? 0 : titleDelay + 200}>
          <Text
            variant="lead"
            tabular
            color={night ? neon.orangeText : undefined}
            muted={!night}
            style={[{ textAlign: 'center' }, night ? { textShadowColor: neon.textGlow.color, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } } : null]}>
            +{rp} RP em {zone}
          </Text>
        </FadeUp>
      </View>
    </View>
  );
}
