import { Stack } from 'expo-router';

import { useScreenTransition } from '@/components/motion';
import { useTheme } from '@/theme/use-theme';

/**
 * Telas de conta para quem não está logado. "boas-vindas" vem primeiro (D-72): é a rota inicial do grupo, com
 * "Começar" (cadastro) e "Já tenho conta" (entrar). As outras entram empilhadas (`push`, D-54); com
 * "Reduzir movimento", só fade.
 */
export default function AuthLayout() {
  const { colors } = useTheme();
  const push = useScreenTransition('push');
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, ...push }}>
      <Stack.Screen name="boas-vindas" />
      <Stack.Screen name="entrar" />
      <Stack.Screen name="cadastro" />
      <Stack.Screen name="recuperar-senha" />
    </Stack>
  );
}
