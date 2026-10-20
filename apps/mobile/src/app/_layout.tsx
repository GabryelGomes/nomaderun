import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { InterTight_800ExtraBold } from '@expo-google-fonts/inter-tight/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { resolveRouteGroup, type RouteGroup } from '@/features/auth/route-guard';
import { useSessionBootstrap } from '@/features/auth/session-controller';
import { useSession } from '@/store/session-store';
import { useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  useSessionBootstrap();
  const computed = useSession((s) =>
    resolveRouteGroup({
      status: s.status,
      profileStatus: s.profileStatus,
      hasProfile: s.profile !== null,
      hasFaction: Boolean(s.profile?.faction),
      recovering: s.recovering,
    }),
  );
  // Depois que a navegação montou, um "splash" passageiro (ex.: carregando o perfil logo após
  // o login) mantém a tela anterior em vez de desmontar o Stack.
  const [lastGroup, setLastGroup] = useState<Exclude<RouteGroup, 'splash'> | null>(null);
  if (computed !== 'splash' && computed !== lastGroup) setLastGroup(computed);
  const group = computed === 'splash' ? lastGroup : computed;
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    InterTight_600SemiBold,
    InterTight_800ExtraBold,
  });

  const ready = loaded && group !== null;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider
        value={{ ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.action, border: colors.line } }}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={group === 'app'}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="corrida" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="resumo" options={{ presentation: 'modal' }} />
            <Stack.Screen
              name="zona/[id]"
              options={{
                presentation: 'formSheet',
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.55, 0.9],
                contentStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.surface },
              }}
            />
          </Stack.Protected>
          <Stack.Protected guard={group === 'onboarding'}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={group === 'auth'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={group === 'auth' || group === 'recovery'}>
            <Stack.Screen name="nova-senha" />
          </Stack.Protected>
          <Stack.Protected guard={group === 'unavailable'}>
            <Stack.Screen name="indisponivel" />
          </Stack.Protected>
          <Stack.Screen name="termos" options={{ presentation: 'modal' }} />
          <Stack.Screen name="privacidade" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
