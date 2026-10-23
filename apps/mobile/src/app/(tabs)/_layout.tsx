import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { WelcomeMissionOverlay } from '@/features/screens/onboarding/welcome-mission-card';

/**
 * Abas (D-73): Mapa · Arena · Correr · Clube · Você. Por cima, só na 1ª sessão depois do onboarding, a missão de
 * boas-vindas no Mapa (D-72), sem mexer na tela do Mapa.
 */
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
      <WelcomeMissionOverlay />
    </View>
  );
}
