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
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useScreenTransition } from '@/components/motion';
import { useDemoActive } from '@/features/auth/demo-entry';
import { DemoSeal } from '@/features/auth/demo-seal';
import { LinkConfirmDialog } from '@/features/auth/link-confirm-dialog';
import { onboardingInProgressFor, useOnboardingFlow } from '@/features/auth/onboarding-flow';
import { resolveRouteGroup, type RouteGroup } from '@/features/auth/route-guard';
import { useSessionBootstrap } from '@/features/auth/session-controller';
import { canModerate } from '@/features/moderation/guard';
import { useUserDataBootstrap } from '@/features/notifications/controller';
import { useReminderPlanner } from '@/features/notifications/use-reminder-planner';
import { useOfflineSync } from '@/features/run/use-offline-sync';
import { useSession } from '@/store/session-store';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();
// App sempre escuro no visual neon (D-59): barra de abas nativa, teclado e alertas do sistema também.
if (process.env.EXPO_OS !== 'web') Appearance.setColorScheme('dark');

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  useSessionBootstrap();
  useUserDataBootstrap();
  // Pedido do A4 (T2.2): sincroniza a fila de corridas ao abrir, ao voltar a conexão e ao primeiro plano.
  useOfflineSync();
  // Lembretes locais da E7 (D-69): replaneja ao abrir, ao voltar ao primeiro plano, ao sincronizar uma corrida e
  // quando as preferências mudam; ao sair da conta, cancela os lembretes deste aparelho.
  useReminderPlanner();
  // Modo demonstração (D-77): o interruptor da E10 (`@/services/demo-mode`) zera as stores pelo ouvinte de
  // `session-controller.ts`; aqui só o selo acompanha o modo.
  const staff = useSession((s) => canModerate(s.profile?.role));
  const onboardingFor = useOnboardingFlow((s) => s.activeFor);
  const demo = useDemoActive();
  const computed = useSession((s) =>
    resolveRouteGroup({
      status: s.status,
      profileStatus: s.profileStatus,
      hasProfile: s.profile !== null,
      hasFaction: Boolean(s.profile?.faction),
      recovering: s.recovering,
      // D-72: a confirmação épica e o GPS vêm depois de gravar o time, ainda no onboarding.
      onboardingInProgress: onboardingInProgressFor(onboardingFor, s.session?.userId),
    }),
  );
  // Depois que a navegação montou, um "splash" passageiro (ex.: carregando o perfil logo após
  // o login) mantém a tela anterior em vez de desmontar o Stack.
  const [lastGroup, setLastGroup] = useState<Exclude<RouteGroup, 'splash'> | null>(null);
  if (computed !== 'splash' && computed !== lastGroup) setLastGroup(computed);
  const group = computed === 'splash' ? lastGroup : computed;
  // Transições de tela (D-54): empilhadas deslizam da direita, telas cheias sobem com fade, troca de
  // contexto (entrar ↔ onboarding ↔ app) só esmaece. "Reduzir movimento": tudo vira fade curto.
  const push = useScreenTransition('push');
  const modal = useScreenTransition('modal');
  const fade = useScreenTransition('fade');
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
            <Stack.Screen name="(tabs)" options={fade} />
            <Stack.Screen name="corrida" options={{ presentation: 'fullScreenModal', gestureEnabled: false, ...modal }} />
            <Stack.Screen name="resumo" options={{ presentation: 'modal', ...modal }} />
            {/* Folha nativa (formSheet): mantém a animação de folha do sistema, que já respeita "Reduzir movimento". */}
            <Stack.Screen
              name="zona/[id]"
              options={{
                presentation: 'formSheet',
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.55, 0.9],
                contentStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.surface },
              }}
            />
            <Stack.Screen name="notificacoes" options={{ ...pushHeader, ...push, title: 'Notificações' }} />
            {/* Arquivo da rota criado pelo A4 (Corrida Segura, T2.5). */}
            <Stack.Screen name="contatos-seguranca" options={{ ...pushHeader, ...push, title: 'Contatos de segurança' }} />
            <Stack.Screen name="zonas-privacidade" options={{ ...pushHeader, ...push, title: 'Zonas de privacidade' }} />
            {/* Engajamento (E7): missões do dia e da semana, trilha da temporada e baús. */}
            <Stack.Screen name="missoes" options={{ ...pushHeader, ...push, title: 'Missões' }} />
            <Stack.Screen name="recompensas" options={{ ...pushHeader, ...push, title: 'Recompensas' }} />
            {/* D-73: Atividades moraram para "Você"; o endereço antigo só redireciona. */}
            <Stack.Screen name="atividades" options={fade} />
            {/* D-78/D-79 (E8): compartilhar a corrida e o feed da crew precisam de sessão. */}
            <Stack.Screen name="compartilhar/[id]" options={{ presentation: 'modal', ...modal }} />
            <Stack.Screen name="compartilhar/feed" options={{ ...pushHeader, ...push, title: 'Feed da crew' }} />
            <Stack.Protected guard={staff}>
              <Stack.Screen name="moderacao" options={push} />
            </Stack.Protected>
          </Stack.Protected>
          <Stack.Protected guard={group === 'onboarding'}>
            <Stack.Screen name="onboarding" options={fade} />
          </Stack.Protected>
          <Stack.Protected guard={group === 'auth'}>
            <Stack.Screen name="(auth)" options={fade} />
          </Stack.Protected>
          <Stack.Protected guard={group === 'auth' || group === 'recovery'}>
            <Stack.Screen name="nova-senha" options={fade} />
          </Stack.Protected>
          <Stack.Protected guard={group === 'unavailable'}>
            <Stack.Screen name="indisponivel" options={fade} />
          </Stack.Protected>
          {/* Convite (E8): quem recebe o link pode ainda não ter conta, por isso fica fora dos guards. */}
          <Stack.Screen name="compartilhar/convite/[codigo]" options={{ presentation: 'modal', ...modal }} />
          <Stack.Screen name="termos" options={{ presentation: 'modal', ...modal }} />
          <Stack.Screen name="privacidade" options={{ presentation: 'modal', ...modal }} />
        </Stack>
        <LinkConfirmDialog />
        {/* D-77: dado de demonstração sempre identificado; o selo fica fixo por cima de tudo. */}
        {demo ? <DemoSeal /> : null}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
