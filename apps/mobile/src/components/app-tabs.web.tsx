import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { APP_TABS, WEB_TAB_BAR_HEIGHT } from './app-tabs-config';
import { Icon, type IconName } from './icon';
import { Text } from './text';

type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName; testID: string };

function TabButton({ isFocused, label, icon, testID, ...props }: TabButtonProps) {
  const { colors } = useTheme();
  const color = isFocused ? colors.action : colors.textSecondary;
  return (
    <Pressable
      {...props}
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={{ flex: 1, minHeight: WEB_TAB_BAR_HEIGHT - space[2], alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingBottom: space[1] }}>
      <View style={{ paddingVertical: 4 }}>
        <Icon name={icon} size={24} color={color} />
      </View>
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Barra de abas da web (substitui a NativeTabs), D-89: 4 abas iguais, altura fixa de celular. */
export default function AppTabs() {
  const { colors } = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          height: WEB_TAB_BAR_HEIGHT,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}>
        {APP_TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabButton label={t.label} icon={t.icon} testID={t.testID} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
