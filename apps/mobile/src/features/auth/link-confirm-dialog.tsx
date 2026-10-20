import { useState } from 'react';
import { Modal, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { ErrorNotice } from './form-ui';
import { confirmPendingLink, dismissPendingLink } from './session-controller';

/**
 * QA-03: chegou um link de acesso (recuperação de senha, confirmação, login social) com alguém
 * já conectado. O link só é usado se a pessoa confirmar a troca de conta. Montado no layout raiz.
 */
export function LinkConfirmDialog() {
  const { colors } = useTheme();
  const pending = useSession((s) => s.pendingLink);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visible = pending !== null || error !== null;

  const confirm = async () => {
    setBusy(true);
    const e = await confirmPendingLink();
    setBusy(false);
    setError(e ? e.message : null);
  };

  const close = () => {
    dismissPendingLink();
    setError(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space[6], backgroundColor: 'rgba(18, 18, 20, 0.45)' }}>
        <Surface style={{ gap: space[4], padding: space[6] }}>
          <View testID="link-confirmar-dialogo" accessible accessibilityRole="alert" style={{ gap: space[3] }}>
            <Icon name="warning" size={32} color={colors.text} />
            <Text variant="title" accessibilityRole="header">
              {error ? 'Não deu para usar o link' : 'Trocar de conta?'}
            </Text>
            <Text muted>
              {error
                ? 'Você continua conectado na conta de antes.'
                : `Você está conectado${pending?.currentEmail ? ` como ${pending.currentEmail}` : ''}. Este link de acesso pode ser de outra conta. Só continue se foi você quem pediu o link.`}
            </Text>
          </View>
          <ErrorNotice message={error} testID="link-confirmar-erro" />
          {error ? (
            <Button testID="link-confirmar-fechar" label="Fechar" size="lg" wide onPress={close} />
          ) : (
            <View style={{ gap: space[3] }}>
              <Button testID="link-confirmar-trocar" label={busy ? 'Abrindo…' : 'Usar o link'} size="lg" wide disabled={busy} onPress={confirm} />
              <Button testID="link-confirmar-cancelar" label="Continuar nesta conta" kind="secondary" size="lg" wide disabled={busy} onPress={close} />
            </View>
          )}
        </Surface>
      </View>
    </Modal>
  );
}
