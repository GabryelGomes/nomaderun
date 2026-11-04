import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/theme/use-theme';

import { APP_TABS } from './app-tabs-config';
import { tabIcon } from './icon';

/**
 * Barra de abas nativa do sistema (expo-router skill), D-89: Mapa · Arena · Clube · Você. Troca de aba nunca anima
 * (expo-animation). Correr não é aba: é o CORRER grande do Mapa (o ícone `aba-correr*.png` da E4 fica nos assets,
 * sem uso).
 */
export default function AppTabs() {
  const { colors } = useTheme();
  return (
    <NativeTabs labelStyle={{ selected: { color: colors.action } }} tintColor={colors.action}>
      {APP_TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.name} testID={t.testID}>
          <NativeTabs.Trigger.Icon {...tabIcon(t.icon)} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
