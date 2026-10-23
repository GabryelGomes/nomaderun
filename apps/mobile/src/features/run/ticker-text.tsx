import { View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Text, type TextVariant } from '@/components/text';
import { enterAnimation } from '@/components/motion';
import { durations } from '@/theme/motion';

import { tickerChars } from './run-motion';

export { tickerChars, timeFontSize } from './run-motion';

export type TickerTextProps = {
  value: string;
  /** Lido pelo leitor de tela no lugar dos caracteres. */
  accessibilityLabel: string;
  variant?: TextVariant;
  fontSize: number;
  /**
   * Anima a troca (padrão: sim). Desligue quando o valor muda mais rápido que a animação (Simulação 10×:
   * o segundo troca a cada 100 ms e ficaria sempre no meio do movimento, ilegível).
   */
  animate?: boolean;
  color?: string;
  testID?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Número da corrida que troca de valor sem "pular" o layout (algarismos tabulares, RNF-015): cada
 * caractere fica numa máscara e só o que mudou sobe de baixo (power2.out, 200 ms — D-54).
 * "Reduzir movimento": a troca é imediata, sem deslocamento.
 */
export function TickerText({ value, accessibilityLabel, variant = 'metric', fontSize, animate = true, color, testID, style }: TickerTextProps) {
  const reduced = useReducedMotion();
  const lineHeight = Math.round(fontSize * 1.05);
  const textStyle = [{ fontSize, lineHeight, textAlign: 'center' as const }, style];
  if (reduced || !animate) {
    return (
      <Text testID={testID} variant={variant} tabular numberOfLines={1} color={color} accessibilityLabel={accessibilityLabel} style={textStyle}>
        {value}
      </Text>
    );
  }
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', justifyContent: 'center' }}>
      {tickerChars(value).map(({ key, char }) => (
        <View key={key.split('-')[0]} style={{ overflow: 'hidden', height: lineHeight }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Animated.View key={key} style={enterAnimation({ reduced: false, kind: 'mask', distance: lineHeight, duration: durations.quick, curve: 'standard' })}>
            <Text variant={variant} tabular color={color} style={textStyle}>
              {char}
            </Text>
          </Animated.View>
        </View>
      ))}
    </View>
  );
}
