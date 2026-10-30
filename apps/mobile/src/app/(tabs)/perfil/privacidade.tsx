import { Stack } from 'expo-router';

// A tela vem primeiro: a régua de texto (`medir-texto.mjs`) liga a rota ao 1º import `@/`.
import { PrivacySettingsScreen } from '@/features/screens/settings-pages';

/** Ajustes → Privacidade (UX-16): zonas de privacidade, feed da crew e dados de uso. A política fica em `/privacidade`. */
export default function VocePrivacidade() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacidade', headerLargeTitleEnabled: false }} />
      <PrivacySettingsScreen />
    </>
  );
}
