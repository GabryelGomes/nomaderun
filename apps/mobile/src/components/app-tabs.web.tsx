import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

const TABS: { name: string; href: '/' | '/arena' | '/atividades' | '/clube' | '/perfil'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Mapa', icon: 'map' },
  { name: 'arena', href: '/arena', label: 'Arena', icon: 'arena' },
  { name: 'atividades', href: '/atividades', label: 'Atividades', icon: 'activities' },
  { name: 'clube', href: '/clube', label: 'Clube', icon: 'club' },
  { name: 'perfil', href: '/perfil', label: 'Perfil', icon: 'profile' },
];

function TabButton({ isFocused, label, icon, ...props }: TabTriggerSlotProps & { label: string; icon: IconName }) {
  const { colors } = useTheme();
  const color = isFocused ? colors.action : colors.textSecondary;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: space[2] }}>
      <View style={{ paddingVertical: 4 }}>
        <Icon name={icon} size={24} color={color} />
      </View>
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Web fallback for NativeTabs: a bottom bar sized like a phone tab bar. */
export default function AppTabs() {
  const { colors } = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingBottom: space[2],
        }}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabButton label={t.label} icon={t.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
