import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyArt } from '@/components/art';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { NeonAmbient } from '@/components/neon-ambient';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Rota inexistente (UX-06): no lugar do "Unmatched Route" do Expo, em inglês, a arte de vazio da E4, 1 frase e
 * 1 ação. "Voltar ao mapa" vai para o início: o guarda de rotas leva quem não entrou para as boas-vindas.
 */
export default function NotFound() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View testID="tela-nao-encontrada" style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Página não encontrada', headerShown: false }} />
      <NeonAmbient />
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[6], paddingHorizontal: space[6] }}>
        <EmptyState
          art={<EmptyArt kind="sem-endereco" size={220} />}
          title="Essa página não existe"
          body="O link pode estar errado ou ter saído do app."
          action={<Button testID="nao-encontrada-voltar" label="Voltar ao mapa" icon="map" size="lg" wide onPress={() => router.replace('/')} />}
        />
      </View>
    </View>
  );
}
