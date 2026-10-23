import { Stack } from 'expo-router';

import { useScreenTransition } from '@/components/motion';
import { useTheme } from '@/theme/use-theme';

/**
 * Telas de conta para quem não está logado. "entrar" vem primeiro: é a rota inicial do grupo.
 * Cadastro e recuperar senha entram empilhados (`push`, D-54); com "Reduzir movimento", só fade.
 */
export default function AuthLayout() {
  const { colors } = useTheme();
  const push = useScreenTransition('push');
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, ...push }}>
      <Stack.Screen name="entrar" />
      <Stack.Screen name="cadastro" />
      <Stack.Screen name="recuperar-senha" />
    </Stack>
  );
}
