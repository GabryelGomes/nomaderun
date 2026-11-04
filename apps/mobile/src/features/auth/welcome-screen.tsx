import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useWindowDimensions, View } from 'react-native';

import { Logo, MascotRunner } from '@/components/art';
import { Button } from '@/components/button';
import { FadeUp, Stagger } from '@/components/motion';
import { Text } from '@/components/text';
import { FACTION_IDS } from '@/domain/types';
import { useSession } from '@/store/session-store';
import { neon } from '@/theme/neon';
import { space } from '@/theme/tokens';
import { ForceScheme } from '@/theme/use-theme';

import { FormScaffold } from './form-ui';
import { NeonBackdrop } from './neon-backdrop';

/** Os 4 corredores em pelotão (x e y relativos à largura do herói), correndo para a direita. */
const PACK: readonly { x: number; y: number }[] = [
  { x: 0, y: 0.1 },
  { x: 0.2, y: 0.26 },
  { x: 0.4, y: 0.02 },
  { x: 0.6, y: 0.2 },
];

/**
 * Boas-vindas (D-72, D-91, UX-20): a primeira tela de quem nunca usou o app. Herói do jogo: os 4 mascotes correndo
 * em pelotão (arte da E4, `leve`) e o logo oficial; 1 frase. "Começar" leva ao valor antes da conta ("A cidade
 * está dividida" → times → cerimônia → cadastro); "Já tenho conta" vai direto a Entrar, sem nada disso. Se a sessão
 * acabou de ser encerrada pelo servidor, o aviso mora na tela Entrar: vai direto para lá.
 */
export function WelcomeScreen() {
  const notice = useSession((s) => s.signedOutNotice);
  const { width } = useWindowDimensions();
  const heroW = Math.min(width - space[6] * 2, 420);
  const runner = heroW * 0.42;
  if (notice) return <Redirect href="/entrar" />;
  return (
    <ForceScheme scheme="dark">
      <StatusBar style="light" />
      <FormScaffold
        testID="tela-boas-vindas"
        background={<NeonBackdrop />}
        footer={
          <View style={{ gap: space[3] }}>
            <Button testID="boas-vindas-comecar" label="Começar" size="lg" wide onPress={() => router.push('/cidade')} />
            <Button testID="boas-vindas-entrar" label="Já tenho conta" kind="secondary" size="lg" wide onPress={() => router.push('/entrar')} />
          </View>
        }>
        <View style={{ flex: 1, justifyContent: 'flex-end', gap: space[4] }}>
          <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: heroW, height: runner * 1.2, alignSelf: 'center' }}>
            <Stagger style={{ flex: 1 }}>
              {FACTION_IDS.map((f, i) => (
                <View key={f} style={{ position: 'absolute', left: PACK[i].x * heroW, top: PACK[i].y * runner }}>
                  <MascotRunner team={f} size={runner} quality="leve" animated />
                </View>
              ))}
            </Stagger>
          </View>
          <FadeUp delay={300}>
            <Logo variant="logotipo" size={Math.min(heroW, 340)} testID="boas-vindas-titulo" />
          </FadeUp>
          <FadeUp delay={500}>
            <Text variant="lead" color={neon.ink2}>
              Corra a sua cidade: cada rua conta.
            </Text>
          </FadeUp>
        </View>
      </FormScaffold>
    </ForceScheme>
  );
}
