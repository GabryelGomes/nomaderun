import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { FadeUp, Pressable, RevealText, Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ErrorNotice, InfoNotice, TextField } from '@/features/auth/form-ui';
import { signOut, signOutAfterDeletion } from '@/features/auth/session-controller';
import { saveAndShareJson } from '@/lib/share-json';
import { DELETE_CONFIRMATION, deleteMyAccount, exportMyData, isWrongPasswordError } from '@/services/api/account-repo';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Conta e privacidade (RF-002, RNF-013/LGPD): exportar dados, excluir conta, sair, textos legais. */
export function AccountScreen() {
  const { colors } = useTheme();
  const email = useSession((s) => s.session?.email);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const doExport = async () => {
    setExporting(true);
    setError(null);
    setExportMsg(null);
    const res = await exportMyData();
    if (!res.ok) {
      setExporting(false);
      setError(res.error.message);
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await saveAndShareJson(`nomade-run-meus-dados-${stamp}.json`, res.data);
      setExportMsg('Arquivo gerado. Se a folha de compartilhamento não abriu, ele está salvo no app.');
    } catch {
      setError('Não foi possível salvar o arquivo neste aparelho. Tente de novo.');
    }
    setExporting(false);
  };

  const doDelete = async () => {
    const typed = confirmText.trim().toUpperCase() === DELETE_CONFIRMATION;
    setPasswordError(password ? null : 'Digite sua senha atual para confirmar.');
    setDeleteError(typed ? null : `Digite ${DELETE_CONFIRMATION} para confirmar.`);
    if (!typed || !password) return;
    setDeleting(true);
    const res = await deleteMyAccount(password);
    if (!res.ok) {
      setDeleting(false);
      // QA-06: senha errada aparece no próprio campo; o resto (rede, servidor) embaixo do EXCLUIR.
      if (isWrongPasswordError(res.error)) setPasswordError(res.error.message);
      else setDeleteError(res.error.message);
      return;
    }
    await signOutAfterDeletion();
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setConfirmText('');
    setPassword('');
    setPasswordError(null);
    setDeleteError(null);
  };

  return (
    <ScreenScroll testID="tela-conta" edges={[]} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Stack.Screen options={{ title: 'Conta e privacidade', headerLargeTitleEnabled: false }} />
      <Stagger gap={space[6]}>

        <Surface>
          <Text variant="caption" muted>
            E-mail da conta
          </Text>
          <Text variant="bodyBold" selectable>
            {email ?? '—'}
          </Text>
        </Surface>

        <View style={{ gap: space[3] }}>
          <RevealText variant="title" header delay={100} style={{ paddingHorizontal: space[1] }}>
            Seus dados
          </RevealText>
          <Surface>
            <Text variant="bodyBold">Exportar meus dados</Text>
            <Text variant="small" muted>
              Gera um arquivo JSON com seu perfil, corridas, pontos de GPS, contatos da Corrida Segura e notificações.
            </Text>
            <Button testID="conta-exportar" label={exporting ? 'Gerando arquivo…' : 'Exportar meus dados'} kind="secondary" icon="share" wide disabled={exporting} onPress={doExport} />
            <ErrorNotice message={error} testID="conta-exportar-erro" />
            {exportMsg ? (
              <FadeUp>
                <InfoNotice testID="conta-exportar-ok" title="Pronto" body={exportMsg} />
              </FadeUp>
            ) : null}
          </Surface>
          <Surface>
            <LinkRow testID="conta-termos" label="Termos de Uso" onPress={() => router.push('/termos')} />
            <LinkRow testID="conta-privacidade" label="Política de Privacidade" onPress={() => router.push('/privacidade')} />
          </Surface>
        </View>

        <View style={{ gap: space[3] }}>
          <SectionHeader title="Sessão" />
          <Button testID="conta-sair" label="Sair" kind="secondary" size="lg" wide onPress={() => signOut()} />
        </View>

        <View style={{ gap: space[3] }}>
          <SectionHeader title="Excluir conta" />
          <Surface>
            <Text variant="small" muted>
              Apaga seu perfil, corridas, pontos de GPS, contatos e notificações. As zonas continuam no mapa, sem seu nome.
              Não dá para desfazer.
            </Text>
            {deleteOpen ? (
              <FadeUp style={{ gap: space[3] }}>
                <TextField
                  testID="conta-excluir-senha"
                  label="Sua senha atual"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    setPasswordError(null);
                  }}
                  secret
                  autoComplete="current-password"
                  textContentType="password"
                  error={passwordError}
                />
                <TextField
                  testID="conta-excluir-confirmacao"
                  label={`Para confirmar, digite ${DELETE_CONFIRMATION}`}
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={deleteError}
                />
                <Button
                  testID="conta-excluir-confirmar"
                  label={deleting ? 'Excluindo…' : 'Excluir minha conta'}
                  kind="danger"
                  wide
                  disabled={deleting || !password || confirmText.trim().toUpperCase() !== DELETE_CONFIRMATION}
                  onPress={doDelete}
                />
                <Button
                  testID="conta-excluir-cancelar"
                  label="Cancelar"
                  kind="ghost"
                  wide
                  onPress={closeDelete}
                />
              </FadeUp>
            ) : (
              <Button testID="conta-excluir" label="Excluir conta" kind="secondary" wide onPress={() => setDeleteOpen(true)} trailing={<Icon name="warning" size={16} color={colors.danger} />} />
            )}
          </Surface>
        </View>
      </Stagger>
    </ScreenScroll>
  );
}

function LinkRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={label} hitSlop={0} onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Text variant="bodyBold" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="chevron" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}
