import { router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/art';
import { IconButton } from '@/components/button';
import { MissionCoachCard } from '@/components/mission-coach-card';
import { FadeUp } from '@/components/motion';
import { useOnboardingFlow } from '@/features/auth/onboarding-flow';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';

import { welcomeMissionBottom, welcomeMissionCopy } from './welcome-mission';

/**
 * Card da missão de boas-vindas por cima do Mapa, só na sessão em que a pessoa acabou de escolher o time e só na
 * aba Mapa. Tocar abre a Nova corrida; o "x" fecha. Fica acima do "Correr" (nunca cobre o botão principal).
 *
 * Montado pelo layout das abas para não mexer na tela do Mapa (dona: E6b). Quando a E6b puser o card de missão
 * dela no Mapa, este componente pode ir para lá e sair do layout das abas (pedido no relatório E6a-onda2).
 */
export function WelcomeMissionOverlay() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const userId = useSession((s) => s.session?.userId ?? null);
  const faction = useSession((s) => s.profile?.faction ?? null);
  const welcomeFor = useOnboardingFlow((s) => s.welcomeFor);
  const dismiss = useOnboardingFlow((s) => s.dismissWelcome);
  if (!userId || welcomeFor !== userId || pathname !== '/') return null;
  const copy = welcomeMissionCopy();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: space[4], right: space[4], bottom: welcomeMissionBottom(insets.bottom) }}>
      <FadeUp delay={400} distance={24}>
        <View>
          <MissionCoachCard
            testID="mapa-missao-boas-vindas"
            eyebrow={copy.eyebrow}
            title={copy.title}
            steps={copy.steps}
            done={copy.done}
            art={faction ? <Mascot team={faction} size={44} /> : undefined}
            onPress={() => router.push('/corrida')}
          />
          <View style={{ position: 'absolute', top: -space[3], right: -space[2] }}>
            <IconButton testID="mapa-missao-boas-vindas-fechar" icon="close" label="Fechar a missão de boas-vindas" size={44} tone="sunken" onPress={dismiss} />
          </View>
        </View>
      </FadeUp>
    </View>
  );
}
