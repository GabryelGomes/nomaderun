import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { easings } from '@/theme/motion';
import { neon } from '@/theme/neon';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Rota de corrida estilizada (viewBox 390×844), atravessando a tela atrás da marca e do formulário. */
const ROUTE =
  'M -20 214 C 60 150, 140 300, 210 236 S 330 120, 410 196 M 410 196 C 360 330, 250 360, 290 470 S 120 560, 70 690 S 220 820, 420 760';
/** Comprimento aproximado da rota (sobra garante que o traço termina inteiro). */
const ROUTE_LENGTH = 1700;
const COMET = 90;

/**
 * Fundo neon das telas de entrada (D-58, "Pit Lane Neon" da apresentação + motion do landonorris.com):
 * manchas de luz laranja que respiram e uma rota neon que se desenha (2,8 s, expo.out), depois um
 * "corredor" de luz percorre a rota sem parar. Puramente decorativo: escondido do leitor de tela e sem
 * toque. "Reduzir movimento": tudo estático, rota já desenhada, sem corredor e sem respiração.
 */
export function NeonBackdrop() {
  const reduced = useReducedMotion();
  const drawn = useSharedValue(reduced ? 1 : 0);
  const comet = useSharedValue(0);
  const breathe = useSharedValue(reduced ? 0.85 : 0.6);

  useEffect(() => {
    if (reduced) return;
    drawn.set(withDelay(200, withTiming(1, { duration: neon.routeDrawMs, easing: easings.reveal })));
    comet.set(withDelay(neon.routeDrawMs, withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false)));
    breathe.set(withRepeat(withSequence(withTiming(1, { duration: neon.pulseMs }), withTiming(0.6, { duration: neon.pulseMs })), -1, false));
  }, [reduced, drawn, comet, breathe]);

  const routeProps = useAnimatedProps(() => ({ strokeDashoffset: ROUTE_LENGTH * (1 - drawn.get()) }));
  const cometProps = useAnimatedProps(() => ({
    strokeDashoffset: -comet.get() * ROUTE_LENGTH,
    strokeOpacity: drawn.get() >= 1 && !reduced ? 1 : 0,
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: breathe.get() }));

  return (
    <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: neon.bg }]}>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="glowTop" cx="78%" cy="12%" r="60%">
              <Stop offset="0" stopColor={neon.orange} stopOpacity="0.38" />
              <Stop offset="0.45" stopColor={neon.glowBg} stopOpacity="0.55" />
              <Stop offset="1" stopColor={neon.bg} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="glowBottom" cx="10%" cy="96%" r="55%">
              <Stop offset="0" stopColor={neon.orange} stopOpacity="0.22" />
              <Stop offset="1" stopColor={neon.bg} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="390" height="844" fill="url(#glowTop)" />
          <Rect width="390" height="844" fill="url(#glowBottom)" />
        </Svg>
      </Animated.View>

      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        {/* Brilho em camadas da mesma cor (largo e fraco → fino e forte), como o glow do CSS. */}
        {[
          { w: 16, o: 0.08 },
          { w: 7, o: 0.22 },
          { w: 2.5, o: 0.9 },
        ].map((l) => (
          <AnimatedPath
            key={l.w}
            d={ROUTE}
            fill="none"
            stroke={neon.orange}
            strokeWidth={l.w}
            strokeOpacity={l.o}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${ROUTE_LENGTH} ${ROUTE_LENGTH}`}
            animatedProps={routeProps}
          />
        ))}
        <AnimatedPath
          d={ROUTE}
          fill="none"
          stroke="#FFD2B3"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${COMET} ${ROUTE_LENGTH}`}
          animatedProps={cometProps}
        />
      </Svg>

      {/* Escurece embaixo para o formulário ler bem sobre a rota. */}
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="veil" cx="50%" cy="78%" r="65%">
            <Stop offset="0" stopColor={neon.bg} stopOpacity="0.82" />
            <Stop offset="1" stopColor={neon.bg} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="844" fill="url(#veil)" />
      </Svg>
    </View>
  );
}
