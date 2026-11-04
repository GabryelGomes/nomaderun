import { reloadAppAsync } from 'expo';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyArt } from '@/components/art';
import { EmptyState } from '@/components/empty-state';
import { Text } from '@/components/text';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';

import { startDemo } from './demo-entry';
import { ErrorNotice, FormScaffold } from './form-ui';
import { loadProfile } from './session-controller';
import { SignOutDialog } from './sign-out-dialog';

/**
 * "Ver demonstração" (D-77): sem servidor, a pessoa ainda pode conhecer o app com dados de exemplo (o interruptor
 * da E10 liga o servidor em memória; nada vai para a rede).
 */
function DemoButton({ onError }: { onError: (message: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      testID="indisponivel-ver-demonstracao"
      label={busy ? 'Abrindo…' : 'Ver demonstração'}
      accessibilityLabel="Ver demonstração com dados de exemplo"
      kind="ghost"
      icon="eye"
      wide
      disabled={busy}
      busy={busy}
      onPress={async () => {
        onError(null);
        setBusy(true);
        const e = await startDemo();
        setBusy(false);
        onError(e?.message ?? null);
      }}
    />
  );
}

/**
 * Tela de bloqueio clara em vez de quebrar (falha 3 da E10): uma frase e uma ação, sem instrução de desenvolvedor.
 *  - servidor não configurado (faltam as variáveis do Supabase no build): "Tentar de novo" recarrega o app;
 *  - perfil não carregou (sem internet no primeiro acesso, servidor fora do ar): "Tentar de novo" busca o perfil.
 */
export function UnavailableScreen() {
  const status = useSession((s) => s.status);
  const profileError = useSession((s) => s.profileError);
  const [busy, setBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  if (status === 'unconfigured') {
    return (
      <FormScaffold
        testID="tela-backend-nao-configurado"
        footer={
          <View style={{ gap: space[2] }}>
            <Button
              testID="indisponivel-tentar"
              label={busy ? 'Tentando…' : 'Tentar de novo'}
              size="lg"
              wide
              disabled={busy}
              busy={busy}
              onPress={() => {
                setBusy(true);
                void reloadAppAsync('servidor não configurado').catch(() => setBusy(false));
              }}
            />
            <DemoButton onError={setDemoError} />
          </View>
        }>
        <View style={{ flex: 1, justifyContent: 'center', gap: space[4] }}>
          <EmptyState testID="indisponivel-titulo" icon="warning" title="Servidor indisponível" body="Não conseguimos falar com o servidor do NOMADE RUN agora." />
          <ErrorNotice message={demoError} testID="indisponivel-erro" />
          {/* Só no Expo de desenvolvimento: quem roda o app localmente vê a causa em 1 linha. */}
          {__DEV__ ? (
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              Desenvolvimento: confira as variáveis EXPO_PUBLIC_SUPABASE_* do .env.
            </Text>
          ) : null}
        </View>
      </FormScaffold>
    );
  }

  const retry = async () => {
    setBusy(true);
    await loadProfile();
    setBusy(false);
  };

  // D-95/UX-05: sem rede ou com o servidor fora do ar, só "Tentar de novo" (sair sem rede pode perder corrida não
  // enviada; com cópia salva, o app nem chega aqui). "Sair" só quando tentar de novo não resolve (sessão ou conta
  // recusada), e com confirmação.
  const stuck = profileError?.code === 'UNAUTHORIZED' || profileError?.code === 'NOT_FOUND';
  return (
    <FormScaffold
      testID="tela-perfil-indisponivel"
      footer={
        <View style={{ gap: space[2] }}>
          <Button testID="indisponivel-tentar" label={busy ? 'Tentando…' : 'Tentar de novo'} size="lg" wide disabled={busy} busy={busy} onPress={retry} />
          {stuck ? <Button testID="indisponivel-sair" label="Sair da conta" kind="ghost" wide onPress={() => setSignOutOpen(true)} /> : null}
          <SignOutDialog visible={signOutOpen} onClose={() => setSignOutOpen(false)} testID="indisponivel-sair-dialogo" />
        </View>
      }>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          testID="indisponivel-titulo"
          art={<EmptyArt kind="sem-conexao" size={180} />}
          title="Não deu para abrir seu perfil"
          body={profileError?.code === 'NETWORK' ? 'Sem internet. Confira a conexão e tente de novo.' : (profileError?.message ?? 'Confira a internet e tente de novo.')}
        />
      </View>
    </FormScaffold>
  );
}
