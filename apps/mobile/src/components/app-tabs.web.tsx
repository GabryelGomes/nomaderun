import { router } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { neon } from '@/theme/neon';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { APP_TABS, type AppTab, WEB_RUN_TAB_SIZE, WEB_TAB_BAR_HEIGHT } from './app-tabs-config';
import { Icon, type IconName } from './icon';
import { Text } from './text';

type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName; run?: boolean; testID: string };

function TabButton({ isFocused, label, icon, run, testID, ...props }: TabButtonProps) {
  const { colors } = useTheme();
  const color = run ? colors.accentText : isFocused ? colors.action : colors.textSecondary;
  return (
    <Pressable
      {...props}
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={run ? 'Correr: abrir a Nova corrida' : label}
      accessibilityState={{ selected: isFocused }}
      style={{ flex: 1, minHeight: WEB_TAB_BAR_HEIGHT - space[2], alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingBottom: space[1] }}>
      {run ? (
        // Correr: círculo laranja elevado (D-73; só na web: nas abas nativas é uma aba comum).
        <View
          style={{
            width: WEB_RUN_TAB_SIZE,
            height: WEB_RUN_TAB_SIZE,
            borderRadius: WEB_RUN_TAB_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.action,
            borderWidth: 3,
            borderColor: colors.surface,
            boxShadow: `0 0 18px ${neon.orange}66`,
          }}>
          <Icon name={icon} size={24} color={colors.onAction} />
        </View>
      ) : (
        <View style={{ paddingVertical: 4 }}>
          <Icon name={icon} size={24} color={color} />
        </View>
      )}
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

/** O toque na Correr abre a Nova corrida em vez de trocar de aba. */
function openInstead(t: AppTab) {
  return (e: GestureResponderEvent) => {
    if (!t.opens) return;
    e.preventDefault();
    router.push(t.opens);
  };
}

/** Barra de abas da web (substitui a NativeTabs): altura fixa de celular e o Correr elevado no centro. */
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
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild onPress={t.opens ? openInstead(t) : undefined}>
            <TabButton label={t.label} icon={t.icon} run={Boolean(t.opens)} testID={t.testID} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
