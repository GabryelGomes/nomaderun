import { useEffect, useRef, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { curveFn, durations, type CurveName } from '@/theme/motion';

import { Text, type TextVariant } from '../text';
import { countValue, formatCount } from './count';
import { enterAnimation } from './motion-styles';

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

/**
 * Número que conta até o valor (RP, km, ritmo, posição) com algarismos tabulares — a largura não pula.
 * expo.out em 1 s por padrão. O leitor de tela lê só o valor final. "Reduzir movimento": mostra o valor
 * final direto, com fade curto. A contagem roda por requestAnimationFrame e atualiza um único texto.
 */
export function CountUp({
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
  const reduced = useReducedMotion();
  const fmt = format ?? ((n: number) => formatCount(n, decimals));
  const [shown, setShown] = useState(reduced ? value : from);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reduced || duration <= 0) {
      // sem contagem: o valor final é exibido direto (ver `display`)
      shownRef.current = value;
      return;
    }
    const start = shownRef.current;
    let raf = 0;
    if (start === value) {
      // nada a contar; só garante o texto em dia (ex.: voltou de "Reduzir movimento")
      raf = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(raf);
    }
    const ease = curveFn(curve);
    let t0: number | null = null;
    const tick = (now: number) => {
      if (t0 === null) t0 = now + delay;
      const p = now < t0 ? 0 : Math.min(1, (now - t0) / duration);
      const v = countValue(ease(p), start, value, decimals);
      shownRef.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, duration, delay, curve, decimals]);

  const display = reduced || duration <= 0 ? value : shown;

  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? (unit ? `${fmt(value)} ${unit}` : fmt(value))}
      style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }, reduced ? enterAnimation({ reduced: true }) : null]}>
      <Text variant={variant} color={color} muted={muted} tabular style={style} importantForAccessibility="no" accessibilityElementsHidden>
        {fmt(display)}
      </Text>
      {unit ? (
        <Text variant="small" muted importantForAccessibility="no" accessibilityElementsHidden>
          {unit}
        </Text>
      ) : null}
    </Animated.View>
  );
}
