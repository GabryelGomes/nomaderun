import { Stack } from 'expo-router';

// A tela vem primeiro: a régua de texto (`medir-texto.mjs`) liga a rota ao 1º import `@/`.
import { RemindersSettingsScreen } from '@/features/screens/settings-pages';

/** Ajustes → Lembretes (UX-16): o único lugar das notificações e da Pausa de saúde. */
export default function VoceLembretes() {
  return (
    <>
      <Stack.Screen options={{ title: 'Lembretes', headerLargeTitleEnabled: false }} />
      <RemindersSettingsScreen />
    </>
  );
}
