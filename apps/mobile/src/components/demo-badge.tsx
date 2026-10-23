import { View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

export type DemoBadgeProps = {
  label?: string;
  testID?: string;
};

/**
 * Selo padrão de dado de demonstração (regra do projeto: demonstração sempre identificada).
 * Neutro e tracejado de propósito: não parece botão nem conquista.
 */
export function DemoBadge({ label = 'Demonstração', testID }: DemoBadgeProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: dados de exemplo, não são reais`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: space[1],
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.lineControl,
      }}>
      <Icon name="eye" size={12} color={colors.textSecondary} />
      <Text variant="label" muted style={{ textTransform: 'uppercase' }} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </View>
  );
}
