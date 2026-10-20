import { Children, isValidElement, type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { distances, durations, STAGGER_LIMIT, staggerDelay, staggers, type CurveName } from '@/theme/motion';

import { enterAnimation } from './motion-styles';

export type FadeUpProps = {
  children: ReactNode;
  /** Atraso em ms. */
  delay?: number;
  /** Subida inicial em pt (16–24). */
  distance?: number;
  duration?: number;
  curve?: CurveName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Entrada de um bloco: sobe 16 pt com fade, power3.out 500 ms (D-54). Não bloqueia toque: o bloco já
 * está montado e tocável durante a animação. "Reduzir movimento": só opacidade.
 */
export function FadeUp({ children, delay = 0, distance = distances.enter, duration = durations.enter, curve = 'enter', style, testID }: FadeUpProps) {
  const reduced = useReducedMotion();
  return (
    <Animated.View testID={testID} style={[enterAnimation({ reduced, distance, duration, delay, curve }), style]}>
      {children}
    </Animated.View>
  );
}

export type StaggerProps = {
  children: ReactNode;
  /** Intervalo entre itens em ms (30–50; padrão 40). */
  step?: number;
  /** Atraso antes do primeiro item. */
  delay?: number;
  distance?: number;
  duration?: number;
  /** Quantos itens entram em cascata; os demais entram junto com o último (padrão 12). */
  limit?: number;
  /** Espaço entre itens (grade de 8 pt). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  /** Estilo de cada invólucro animado (ex.: `{ flex: 1 }` quando o pai é uma linha). */
  itemStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Cascata de cards/itens: cada filho direto entra com `FadeUp` e um atraso de `step` ms, até `limit` itens
 * e no máximo 0,5 s no total (`stagger: {amount: 0.5}` do site). Para `FlatList`, use `FadeUp` no
 * `renderItem` com `delay={staggerDelay(index)}`.
 */
export function Stagger({ children, step = staggers.item, delay = 0, distance, duration, limit = STAGGER_LIMIT, gap, style, itemStyle, testID }: StaggerProps) {
  const items = Children.toArray(children);
  return (
    <View testID={testID} style={[gap !== undefined ? { gap } : null, style]}>
      {items.map((child, i) => (
        <FadeUp key={isValidElement(child) && child.key != null ? child.key : i} delay={delay + staggerDelay(i, step, limit)} distance={distance} duration={duration} style={itemStyle}>
          {child}
        </FadeUp>
      ))}
    </View>
  );
}
