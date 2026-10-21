import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Surface } from '@/components/surface';
import { FadeUp, RevealText } from '@/components/motion';
import { Text } from '@/components/text';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { FormScaffold } from './form-ui';
import { loadProfile, signOut } from './session-controller';

/**
 * Tela de bloqueio clara em vez de quebrar:
 *  - backend não configurado (faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY);
 *  - perfil não carregou (sem internet no primeiro acesso, servidor fora do ar).
 */
export function UnavailableScreen() {
  const { colors } = useTheme();
  const status = useSession((s) => s.status);
  const profileError = useSession((s) => s.profileError);
  const [busy, setBusy] = useState(false);

  if (status === 'unconfigured') {
    return (
      <FormScaffold testID="tela-backend-nao-configurado">
        <View style={{ gap: space[4] }}>
          <Icon name="warning" size={40} color={colors.text} />
          <RevealText testID="indisponivel-titulo">Backend não configurado</RevealText>
          <Text>O app precisa saber o endereço do servidor do NOMADE RUN para criar contas e salvar corridas.</Text>
        </View>
        <FadeUp delay={200}>
          <Surface>
            <Text variant="bodyBold">Como resolver</Text>
            <Text muted>1. Copie apps/mobile/.env.example para apps/mobile/.env.</Text>
            <Text muted>2. Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (veja npx supabase status).</Text>
            <Text muted>3. Reinicie o servidor do Expo com npx expo start --clear.</Text>
          </Surface>
        </FadeUp>
      </FormScaffold>
    );
  }

  const retry = async () => {
    setBusy(true);
    await loadProfile();
    setBusy(false);
  };

  return (
    <FormScaffold
      testID="tela-perfil-indisponivel"
      footer={
        <>
          <Button testID="indisponivel-tentar" label={busy ? 'Tentando…' : 'Tentar de novo'} size="lg" wide disabled={busy} onPress={retry} />
          <Button testID="indisponivel-sair" label="Sair da conta" kind="secondary" size="lg" wide onPress={() => signOut()} />
        </>
      }>
      <View style={{ gap: space[4] }}>
        <Icon name="warning" size={40} color={colors.text} />
        <RevealText testID="indisponivel-titulo">Não foi possível carregar seu perfil</RevealText>
        <Text>{profileError?.message ?? 'Tente de novo em instantes.'}</Text>
      </View>
    </FormScaffold>
  );
}
