import { View } from 'react-native';

import { neon } from '@/theme/neon';
import { floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './motion/pressable';
import { Text } from './text';

export type DailyItem = {
  key: string;
  testID: string;
  icon: IconName;
  /** O número curto do chip (ex.: "1/2", "36%"). */
  value: string;
  /** O nome do chip (ex.: "Sequência", "Chefão"). */
  label: string;
  /** `villain` = violeta dos chefões (D-67). */
  tone?: 'action' | 'villain' | 'neutral';
  onPress?: () => void;
};

/** No máximo 3 chips (o Mapa precisa continuar sendo o herói). */
export const DAILY_MAX = 3;

/**
 * Faixa de hoje no Mapa: até 3 chips com ícone e número, **só os que são verdade** (sem dado, o chip não existe).
 * Sem nenhum item, não desenha nada.
 */
export function DailyStrip({ items, testID = 'hoje' }: { items: readonly DailyItem[]; testID?: string }) {
  const { colors } = useTheme();
  const shown = items.slice(0, DAILY_MAX);
  if (shown.length === 0) return null;
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: space[2] }}>
      {shown.map((it) => {
        const tint = it.tone === 'villain' ? neon.villain : it.tone === 'neutral' ? colors.text : colors.accentText;
        const chip = (
          <>
            <Icon name={it.icon} size={16} color={tint} />
            <Text variant="bodyBold" tabular color={tint} maxFontSizeMultiplier={1.3}>
              {it.value}
            </Text>
            <Text variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }} maxFontSizeMultiplier={1.3}>
              {it.label}
            </Text>
          </>
        );
        const style = {
          minHeight: 44,
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: space[1],
          paddingHorizontal: space[3],
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          boxShadow: floating,
        };
        return it.onPress ? (
          <PressableScale key={it.key} testID={it.testID} accessibilityLabel={`${it.label}: ${it.value}`} onPress={it.onPress} hitSlop={0} containerStyle={{ flexShrink: 1 }} style={style}>
            {chip}
          </PressableScale>
        ) : (
          <View key={it.key} testID={it.testID} accessible accessibilityLabel={`${it.label}: ${it.value}`} style={[style, { flexShrink: 1 }]}>
            {chip}
          </View>
        );
      })}
    </View>
  );
}
