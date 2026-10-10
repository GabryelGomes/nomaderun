import { Stack } from 'expo-router';

import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Native stack inside a tab, with the platform large title (expo-router skill). */
export function TabStack({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTransparent: process.env.EXPO_OS === 'ios',
        headerShadowVisible: false,
        headerLargeTitleEnabled: true,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerBlurEffect: process.env.EXPO_OS === 'ios' ? 'systemChromeMaterial' : undefined,
        headerStyle: process.env.EXPO_OS === 'ios' ? undefined : { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.textBold, color: colors.text },
        headerLargeTitleStyle: { fontFamily: fonts.display, color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
