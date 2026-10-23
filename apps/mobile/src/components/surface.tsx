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

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space[1] }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

/** Empty states give direction, not mood (frontend-design). */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[8], paddingHorizontal: space[6] }}>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text muted style={{ textAlign: 'center' }}>
        {body}
      </Text>
      {action}
    </View>
  );
}

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
