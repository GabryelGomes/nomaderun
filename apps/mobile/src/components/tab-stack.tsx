import { Stack } from 'expo-router';
import { View } from 'react-native';

import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { NeonAmbient } from './neon-ambient';

/** Native stack inside a tab, with the platform large title (expo-router skill). */
export function TabStack({ title }: { title: string }) {
  const { colors, scheme } = useTheme();
  const ambient = scheme === 'dark';
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Luz ambiente neon atrás das telas da aba (D-59); as telas ficam transparentes por cima. */}
      {ambient ? <NeonAmbient /> : null}
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
          contentStyle: { backgroundColor: ambient ? 'transparent' : colors.background },
        }}>
        <Stack.Screen name="index" options={{ title }} />
      </Stack>
    </View>
  );
}
