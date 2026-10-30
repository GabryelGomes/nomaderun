import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { cssEasings, durations } from '@/theme/motion';
import { floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { CHIP_FONT_MAX } from '@/components/chip-row';

export type Layer = 'todos' | 'meu-time' | 'explorado';

/** Glossário D-74: "Onde já corri" (neblina) vira "Atlas". */
export const LAYERS: readonly (readonly [Layer, string, string])[] = [
  ['todos', 'Todos os times', 'Mostra as zonas de todos os times'],
  ['meu-time', 'Só meu time', 'Mostra só as zonas do seu time'],
  ['explorado', 'Atlas', 'Mostra as ruas onde você já correu'],
];

/**
 * Menu de camadas do mapa (v2, F1 §5.2): um único botão de camadas abre este cartão, no lugar da linha de
 * filtros que ficava sempre visível (menos texto na 1ª dobra). Cada opção tem alvo ≥ 44 pt. A troca de
 * seleção cruza as cores com power2.inOut (300 ms, sem movimento: vale com "Reduzir movimento").
 */
export function LayerChips({ value, onChange }: { value: Layer; onChange: (l: Layer) => void }) {
  const { colors } = useTheme();
  return (
    <View
      testID="mapa-camadas"
      accessibilityRole="menu"
      accessibilityLabel="Camadas do mapa"
      style={{ padding: space[1], gap: 2, minWidth: 176, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, boxShadow: floating }}>
      {LAYERS.map(([key, label, hint]) => {
        const on = value === key;
        return (
          <Pressable
            key={key}
            testID={`mapa-camada-${key}`}
            accessibilityRole="menuitem"
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(key)}>
            <Animated.View
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                paddingHorizontal: space[3],
                borderRadius: radius.md,
                // Neon (D-59): ativo com fundo laranja escuro, como os chips do resto do app.
                backgroundColor: on ? '#2A1609' : colors.surface,
                transitionProperty: 'backgroundColor',
                transitionDuration: durations.state,
                transitionTimingFunction: cssEasings.swap,
              }}>
              <View style={{ width: 18 }}>{on ? <Icon name="check" size={18} color={colors.accentText} /> : null}</View>
              <Text variant="bodyBold" color={on ? colors.accentText : colors.text} numberOfLines={1} maxFontSizeMultiplier={CHIP_FONT_MAX}>
                {label}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}
