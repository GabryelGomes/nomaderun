import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

/** A grouped surface. Hierarchy comes from spacing and type, not from a shadow on every card. */
export function Surface({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          // Neon (D-59): superfície grafite com borda fina, como os cards da apresentação.
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: padded ? space[4] : 0,
          gap: space[3],
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Movidos para arquivos próprios na v2 (T7.1.17); reexportados aqui para não quebrar as telas. */
export { EmptyState, type EmptyStateProps } from './empty-state';
export { SectionHeader, type SectionHeaderProps } from './section-header';

export function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={{ gap: 2, minWidth: 88 }}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text variant="headline" color={color} tabular selectable>
          {value}
        </Text>
        {unit ? (
          <Text variant="small" muted>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
