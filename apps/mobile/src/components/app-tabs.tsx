import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/theme/use-theme';

import { tabIcon } from './icon';

/** The platform's real tab bar (expo-router skill). Tab switches never animate (expo-animation). */
export default function AppTabs() {
  const { colors } = useTheme();
  return (
    <NativeTabs labelStyle={{ selected: { color: colors.action } }} tintColor={colors.action}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon {...tabIcon('map')} />
        <NativeTabs.Trigger.Label>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="arena">
        <NativeTabs.Trigger.Icon {...tabIcon('arena')} />
        <NativeTabs.Trigger.Label>Arena</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="atividades">
        <NativeTabs.Trigger.Icon {...tabIcon('activities')} />
        <NativeTabs.Trigger.Label>Atividades</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="clube">
        <NativeTabs.Trigger.Icon {...tabIcon('club')} />
        <NativeTabs.Trigger.Label>Clube</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon {...tabIcon('profile')} />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
