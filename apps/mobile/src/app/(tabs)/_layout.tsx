import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { WelcomeBackGate } from '@/features/engagement';
import { WelcomeMissionOverlay } from '@/features/screens/onboarding/welcome-mission-card';

/**
 * Abas (D-89): Mapa · Arena · Clube · Você (correr é o CORRER grande do Mapa). Por cima:
 *  - só na 1ª sessão depois do onboarding, a missão de boas-vindas no Mapa (D-72), sem mexer na tela do Mapa;
 *  - "Bem-vindo de volta" (E7): aparece sozinho depois de 14 dias ou mais sem correr, 1 vez por ausência.
 */
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
      <WelcomeMissionOverlay />
      <WelcomeBackGate />
    </View>
  );
}
