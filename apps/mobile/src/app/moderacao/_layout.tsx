import { Redirect, Stack } from 'expo-router';

import { useScreenTransition } from '@/components/motion';
import { canModerate } from '@/features/moderation/guard';
import { useSession } from '@/store/session-store';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Painel de moderação (RF-018, D-08): só `moderator`/`admin`; qualquer outro papel volta ao mapa. */
export default function ModerationLayout() {
  const { colors } = useTheme();
  const role = useSession((s) => s.profile?.role);
  const push = useScreenTransition('push');
  if (!canModerate(role)) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.textBold, color: colors.text },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        ...push,
      }}>
      <Stack.Screen name="index" options={{ title: 'Moderação' }} />
      <Stack.Screen name="[id]" options={{ title: 'Revisar corrida' }} />
      <Stack.Screen name="contas" options={{ title: 'Contas' }} />
    </Stack>
  );
}
