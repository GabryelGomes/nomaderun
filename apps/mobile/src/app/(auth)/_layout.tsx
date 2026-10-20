import { Stack } from 'expo-router';

import { useTheme } from '@/theme/use-theme';

/** Telas de conta para quem não está logado. "entrar" vem primeiro: é a rota inicial do grupo. */
export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="entrar" />
      <Stack.Screen name="cadastro" />
      <Stack.Screen name="recuperar-senha" />
    </Stack>
  );
}
