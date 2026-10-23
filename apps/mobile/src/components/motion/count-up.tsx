import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type StyleProp, TextInput, type TextInputProps, type TextStyle, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { curveFn, durations, easings, type CurveName } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Text, TEXT_VARIANTS, type TextVariant } from '../text';
import { countSteps, countStepsFor, countValue, formatCount, widestLabel } from './count';
import { enterAnimation } from './motion-styles';
import { useReducedMotionSetting } from './reduced-motion';

export type CountUpProps = {
  /** Valor final. Ao mudar, conta do valor exibido até o novo. */
  value: number;
  /** Valor inicial da primeira contagem (padrão 0). */
  from?: number;
  decimals?: number;
  /** Formatação própria (ex.: `formatPace`). Padrão: pt-BR com `decimals` casas. */
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  curve?: CurveName;
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  /** Unidade ao lado, menor e discreta, alinhada pela linha de base (como o `Stat`). */
  unit?: string;
  /** Texto lido pelo leitor de tela (padrão: o valor final formatado). Inclua a unidade: "5,2 quilômetros". */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<TextStyle>;
};

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Número que conta até o valor (pontos, km, ritmo, posição) com algarismos tabulares — a largura não pula.
 * expo.out em 1 s por padrão. O leitor de tela lê só o valor final. "Reduzir movimento": valor final direto,
 * com fade curto.
 *
 * v2 (T7.1.13): no celular a contagem roda na thread de UI — os textos de cada quadro são formatados uma vez
 * (thread de JS) e um `TextInput` não editável troca o texto por `useAnimatedProps`, sem re-render. Na web,
 * `requestAnimationFrame` limitado a 30 quadros por segundo. Mesma API de antes.
 */
export function CountUp(props: CountUpProps) {
  return process.env.EXPO_OS === 'web' ? <CountUpWeb {...props} /> : <CountUpNative {...props} />;
}

/** Invólucro comum: o leitor de tela lê o valor final; o número animado fica escondido dele. */
function Shell({ label, testID, reduced, unit, children }: { label: string; testID?: string; reduced: boolean; unit?: string; children: ReactNode }) {
  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }, reduced ? enterAnimation({ reduced: true }) : null]}>
      {children}
      {unit ? (
        <Text variant="small" muted importantForAccessibility="no" accessibilityElementsHidden>
          {unit}
        </Text>
      ) : null}
    </Animated.View>
  );
}

function CountUpNative({
  value,
  from = 0,
  decimals = 0,
  format,
  duration = durations.count,
  delay = 0,
  curve = 'reveal',
  variant = 'metric',
  color,
  muted,
  unit,
  accessibilityLabel,
  testID,
  style,
}: CountUpProps) {
  const reduced = useReducedMotionSetting();
  const { colors } = useTheme();
  const fmt = format ?? ((n: number) => formatCount(n, decimals));
  const still = reduced || duration <= 0;
  /** Textos de cada quadro da contagem atual (o último é o valor final). */
  const [frames, setFrames] = useState<string[]>(() => [fmt(still ? value : from)]);
  const numbers = useRef<number[]>([still ? value : from]);
  const progress = useSharedValue(1);

  useEffect(() => {
    // de onde contar: o número que está na tela agora (mesmo no meio de outra contagem)
    const shown = numbers.current;
    const start = shown[Math.min(shown.length - 1, Math.max(0, Math.round(progress.get() * (shown.length - 1))))];
    if (still || start === value) {
      numbers.current = [value];
      setFrames([fmt(value)]);
      progress.set(1);
      return;
    }
    const steps = countSteps(start, value, curveFn(curve), countStepsFor(duration), decimals);
    numbers.current = steps;
    setFrames(steps.map(fmt));
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration, easing: easings.linear })));
    // `fmt` muda de identidade a cada render; a contagem só recomeça quando o valor ou o tempo mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, still, duration, delay, curve, decimals, progress]);

  const animatedProps = useAnimatedProps(() => {
    const i = Math.min(frames.length - 1, Math.max(0, Math.round(progress.get() * (frames.length - 1))));
    return { text: frames[i], defaultValue: frames[i] } as unknown as TextInputProps;
  });

  const label = accessibilityLabel ?? (unit ? `${fmt(value)} ${unit}` : fmt(value));
  const textStyle = [TEXT_VARIANTS[variant], { color: color ?? (muted ? colors.textSecondary : colors.text), fontVariant: ['tabular-nums' as const] }, style];
  return (
    <Shell label={label} testID={testID} reduced={reduced} unit={unit}>
      <View>
        {/* reserva a largura do maior texto (início ou fim) e dá a linha de base para a unidade */}
        <Text variant={variant} tabular style={[style, { opacity: 0 }]} importantForAccessibility="no" accessibilityElementsHidden>
          {widestLabel([frames[0], frames[frames.length - 1]])}
        </Text>
        <AnimatedTextInput
          testID={testID ? `${testID}-valor` : undefined}
          accessibilityLabel={label}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          editable={false}
          pointerEvents="none"
          caretHidden
          underlineColorAndroid="transparent"
          defaultValue={frames[frames.length - 1]}
          animatedProps={animatedProps}
          style={[textStyle, { position: 'absolute', top: 0, left: 0, right: 0, padding: 0, margin: 0, borderWidth: 0 }]}
        />
      </View>
    </Shell>
  );
}

/** Web: `requestAnimationFrame` limitado a ~30 quadros por segundo, atualizando um único texto. Exportado para teste. */
export function CountUpWeb({
  value,
  from = 0,
  decimals = 0,
  format,
  duration = durations.count,
  delay = 0,
  curve = 'reveal',
  variant = 'metric',
  color,
  muted,
  unit,
  accessibilityLabel,
  testID,
  style,
}: CountUpProps) {
  const reduced = useReducedMotionSetting();
  const fmt = format ?? ((n: number) => formatCount(n, decimals));
  const [shown, setShown] = useState(reduced ? value : from);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reduced || duration <= 0) {
      shownRef.current = value;
      return;
    }
    const start = shownRef.current;
    let raf = 0;
    if (start === value) {
      raf = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(raf);
    }
    const ease = curveFn(curve);
    let t0: number | null = null;
    let last = -Infinity;
    const tick = (now: number) => {
      if (t0 === null) t0 = now + delay;
      const p = now < t0 ? 0 : Math.min(1, (now - t0) / duration);
      const v = countValue(ease(p), start, value, decimals);
      shownRef.current = v;
      if (p >= 1 || now - last >= 33) {
        last = now;
        setShown(v);
      }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, duration, delay, curve, decimals]);

  const display = reduced || duration <= 0 ? value : shown;
  return (
    <Shell label={accessibilityLabel ?? (unit ? `${fmt(value)} ${unit}` : fmt(value))} testID={testID} reduced={reduced} unit={unit}>
      <Text variant={variant} color={color} muted={muted} tabular style={style} importantForAccessibility="no" accessibilityElementsHidden>
        {fmt(display)}
      </Text>
    </Shell>
  );
}
