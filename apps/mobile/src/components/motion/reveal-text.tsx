import { View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { distances, durations, staggers } from '@/theme/motion';

import { TEXT_VARIANTS, Text, type TextVariant } from '../text';
import { enterAnimation, splitReveal } from './motion-styles';

export type RevealTextProps = {
  /** A frase inteira. O leitor de tela lê esta string uma vez (as palavras animadas ficam escondidas dele). */
  children: string;
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  tabular?: boolean;
  /** Revela por palavras (padrão) ou por linhas (quebre com `\n`). */
  by?: 'words' | 'lines';
  /** Atraso antes da primeira palavra, em ms (para encadear com outra entrada). */
  delay?: number;
  /** Intervalo entre palavras/linhas: 15–30 ms (padrão 20 por palavra, 30 por linha). */
  stagger?: number;
  duration?: number;
  align?: 'left' | 'center';
  /** Título da tela: anuncia como cabeçalho. Padrão `true` para `hero`/`headline`. */
  header?: boolean;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Texto de destaque que "sobe" de dentro de uma máscara, palavra por palavra (SplitText do landonorris.com:
 * yPercent 100 → 0, expo.out ~0,8 s, stagger 15–30 ms). Use em títulos de tela e no número/frase herói.
 * "Reduzir movimento": aparece só com opacidade, sem deslocamento.
 * A máscara tem folga em cima e embaixo para não cortar acentos (É, Ç) nem descendentes (g, p).
 */
export function RevealText({
  children,
  variant = 'headline',
  color,
  muted,
  tabular,
  by = 'words',
  delay = 0,
  stagger,
  duration = durations.reveal,
  align = 'left',
  header,
  accessibilityRole,
  testID,
  style,
}: RevealTextProps) {
  const reduced = useReducedMotion();
  const metrics = TEXT_VARIANTS[variant];
  const lineHeight = metrics.lineHeight ?? metrics.fontSize * 1.3;
  const pad = Math.ceil(metrics.fontSize * 0.12);
  const step = stagger ?? (by === 'lines' ? staggers.line : staggers.word);
  const parts = splitReveal(children, by);
  const isHeader = header ?? (variant === 'hero' || variant === 'headline');
  const role: AccessibilityRole = accessibilityRole ?? (isHeader ? 'header' : 'text');

  return (
    <View testID={testID} accessible accessibilityRole={role} accessibilityLabel={children} style={style}>
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          flexDirection: by === 'lines' ? 'column' : 'row',
          flexWrap: by === 'lines' ? 'nowrap' : 'wrap',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          alignItems: by === 'lines' ? (align === 'center' ? 'center' : 'flex-start') : undefined,
          columnGap: Math.round(metrics.fontSize * 0.26),
        }}>
        {parts.map((part, i) => (
          <View key={`${i}-${part}`} style={{ overflow: 'hidden', paddingVertical: pad, marginVertical: -pad }}>
            <Animated.View
              style={enterAnimation({
                reduced,
                kind: 'mask',
                distance: Math.round((lineHeight + pad) * distances.revealFraction),
                duration,
                delay: delay + i * step,
                curve: 'reveal',
              })}>
              <Text variant={variant} color={color} muted={muted} tabular={tabular} style={align === 'center' ? { textAlign: 'center' } : undefined}>
                {part}
              </Text>
            </Animated.View>
          </View>
        ))}
      </View>
    </View>
  );
}
