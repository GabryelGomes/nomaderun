import { Stack } from 'expo-router';

// A tela vem primeiro: a régua de texto (`medir-texto.mjs`) liga a rota ao 1º import `@/`.
import { SettingsScreen } from '@/features/screens/profile-screen.settings';

/** Ajustes de "Você" (engrenagem): conta, Corrida Segura, lembretes, jogo, feed e convite. */
export default function VoceAjustes() {
  return (
    <>
      <Stack.Screen options={{ title: 'Ajustes', headerLargeTitleEnabled: false }} />
      <SettingsScreen />
    </>
  );
}
