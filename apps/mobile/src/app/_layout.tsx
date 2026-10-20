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
import { canModerate } from '@/features/moderation/guard';
import { useUserDataBootstrap } from '@/features/notifications/controller';
import { useOfflineSync } from '@/features/run/use-offline-sync';
import { useSession } from '@/store/session-store';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  useSessionBootstrap();
  useUserDataBootstrap();
  // Pedido do A4 (T2.2): sincroniza a fila de corridas ao abrir, ao voltar a conexão e ao primeiro plano.
  useOfflineSync();
  const staff = useSession((s) => canModerate(s.profile?.role));
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
  /** Telas empilhadas na raiz com o mesmo cabeçalho das telas de aba (ex.: `perfil/editar`). */
  const pushHeader = {
    headerShown: true,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { fontFamily: fonts.textBold, color: colors.text },
    headerTintColor: colors.text,
    contentStyle: { backgroundColor: colors.background },
  };
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
            <Stack.Screen name="notificacoes" options={{ ...pushHeader, title: 'Notificações' }} />
            {/* Arquivo da rota criado pelo A4 (Corrida Segura, T2.5). */}
            <Stack.Screen name="contatos-seguranca" options={{ ...pushHeader, title: 'Contatos de segurança' }} />
            <Stack.Screen name="zonas-privacidade" options={{ ...pushHeader, title: 'Zonas de privacidade' }} />
            <Stack.Protected guard={staff}>
              <Stack.Screen name="moderacao" />
            </Stack.Protected>
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
