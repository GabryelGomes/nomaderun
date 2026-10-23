import { Pressable, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/text';
import { cssEasings, durations } from '@/theme/motion';
import { floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { CHIP_FONT_MAX, GLOW_ROOM } from '@/components/chip-row';

export type Layer = 'todos' | 'meu-time' | 'explorado';

export const LAYERS: readonly (readonly [Layer, string])[] = [
  ['todos', 'Todos os times'],
  ['meu-time', 'Só meu time'],
  ['explorado', 'Onde já corri'],
];

/**
 * Filtros de camada flutuando sobre o mapa. Mesmo comportamento do `ChipRow` (uma linha que rola na
 * horizontal de ponta a ponta, alvo ≥ 44 pt), com a sombra flutuante que os chips precisam sobre o mapa.
 * Não usa o `ChipRow` porque o testID do grupo viraria "mapa-camada", que já é o botão de camadas.
 * A troca de seleção cruza as cores com power2.inOut (300 ms, sem movimento: vale com "Reduzir movimento").
 */
export function LayerChips({ value, onChange }: { value: Layer; onChange: (l: Layer) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Camadas do mapa"
      // Folga para o brilho do filtro ativo (no iOS a ScrollView recorta o que passa das bordas).
      style={{ flexGrow: 0, marginVertical: -GLOW_ROOM }}
      contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4], paddingVertical: GLOW_ROOM }}>
      {LAYERS.map(([key, label]) => {
        const on = value === key;
        return (
          <Pressable
            key={key}
            testID={`mapa-camada-${key}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Filtra as zonas mostradas no mapa"
            accessibilityState={{ selected: on }}
            // QA-12: o desenho continua com 36 pt; a área de toque chega a 44 pt.
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={() => onChange(key)}>
            <Animated.View
              style={{
                paddingHorizontal: space[4],
                minHeight: 36,
                paddingVertical: space[1],
                justifyContent: 'center',
                borderRadius: radius.pill,
                // Neon (D-59): ativo com contorno e brilho laranja, como os chips do resto do app.
                backgroundColor: on ? '#2A1609' : colors.surface,
                borderWidth: 1,
                borderColor: on ? colors.action : colors.lineControl,
                boxShadow: on ? '0 0 14px rgba(255,106,19,0.45)' : floating,
                transitionProperty: 'backgroundColor',
                transitionDuration: durations.state,
                transitionTimingFunction: cssEasings.swap,
              }}>
              <Text variant="caption" color={on ? colors.accentText : colors.text} numberOfLines={1} maxFontSizeMultiplier={CHIP_FONT_MAX}>
                {label}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
