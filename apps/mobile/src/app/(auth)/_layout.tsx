import { Stack } from 'expo-router';

import { useScreenTransition } from '@/components/motion';
import { useTheme } from '@/theme/use-theme';

/**
 * Telas de quem não está logado. "boas-vindas" é a rota inicial do grupo (D-72); "Começar" leva ao valor antes da
 * conta (D-91): "cidade" (a cidade dividida) → "times" (as 4 capas e a cerimônia) → "cadastro". "Já tenho conta" vai
 * direto a "entrar", sem passar por nada disso. As telas entram empilhadas (`push`, D-54); com "Reduzir movimento",
 * só fade.
 */
export default function AuthLayout() {
  const { colors } = useTheme();
  const push = useScreenTransition('push');
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, ...push }}>
      <Stack.Screen name="boas-vindas" />
      <Stack.Screen name="cidade" />
      <Stack.Screen name="times" />
      <Stack.Screen name="entrar" />
      <Stack.Screen name="cadastro" />
      <Stack.Screen name="recuperar-senha" />
    </Stack>
  );
}
