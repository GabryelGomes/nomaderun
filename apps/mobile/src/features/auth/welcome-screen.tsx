import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { FadeUp } from '@/components/motion';
import { Text } from '@/components/text';
import { useSession } from '@/store/session-store';
import { neon } from '@/theme/neon';
import { space } from '@/theme/tokens';
import { ForceScheme } from '@/theme/use-theme';

import { FormScaffold } from './form-ui';
import { HeroWordmark } from './hero-wordmark';
import { NeonBackdrop } from './neon-backdrop';
import { NeonBadges } from './neon-badges';

/**
 * Boas-vindas (D-72, wireframe `00`): a primeira tela de quem nunca usou o app. Fundo neon com as rotas se
 * desenhando, as 4 formas dos times, o wordmark e 1 frase; "Começar" leva ao cadastro enxuto e "Já tenho conta",
 * à tela Entrar. Se a sessão acabou de ser encerrada pelo servidor, o aviso mora na tela Entrar: vai direto para lá.
 */
export function WelcomeScreen() {
  const notice = useSession((s) => s.signedOutNotice);
  if (notice) return <Redirect href="/entrar" />;
  return (
    <ForceScheme scheme="dark">
      <StatusBar style="light" />
      <FormScaffold
        testID="tela-boas-vindas"
        background={<NeonBackdrop />}
        footer={
          <View style={{ gap: space[3] }}>
            <Button testID="boas-vindas-comecar" label="Começar" size="lg" wide onPress={() => router.push('/cadastro')} />
            <Button testID="boas-vindas-entrar" label="Já tenho conta" kind="secondary" size="lg" wide onPress={() => router.push('/entrar')} />
          </View>
        }>
        <View style={{ flex: 1, justifyContent: 'flex-end', gap: space[4] }}>
          <NeonBadges />
          <HeroWordmark testID="boas-vindas-titulo" delay={120} neon />
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
