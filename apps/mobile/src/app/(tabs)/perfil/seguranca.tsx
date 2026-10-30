import { Stack } from 'expo-router';

// A tela vem primeiro: a régua de texto (`medir-texto.mjs`) liga a rota ao 1º import `@/`.
import { SafetySettingsScreen } from '@/features/screens/settings-pages';

/** Ajustes → Segurança na corrida (UX-16): Corrida Segura e contatos. */
export default function VoceSeguranca() {
  return (
    <>
      <Stack.Screen options={{ title: 'Segurança na corrida', headerLargeTitleEnabled: false }} />
      <SafetySettingsScreen />
    </>
  );
}
