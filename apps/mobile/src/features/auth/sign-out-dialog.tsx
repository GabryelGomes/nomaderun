import { useState } from 'react';
import { Modal, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { signOut } from './session-controller';

/**
 * UX-36 (D-95): "Sair da conta?" antes de desconectar. Sair sem querer é caro: a pessoa precisa do e-mail e da senha
 * para voltar. Recusa neutra ("Cancelar"), sem culpa. O "Sair" mora só em Ajustes → Conta.
 */
export function SignOutDialog({ visible, onClose, testID = 'sair-dialogo' }: { visible: boolean; onClose: () => void; testID?: string }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space[6], backgroundColor: 'rgba(7, 7, 8, 0.7)' }}>
        <Surface style={{ gap: space[4], padding: space[6] }}>
          <View testID={testID} accessible accessibilityRole="alert" style={{ gap: space[3] }}>
            <Icon name="logout" size={32} color={colors.text} />
            <Text variant="title" accessibilityRole="header">
              Sair da conta?
            </Text>
            <Text muted>Para voltar, use e-mail e senha.</Text>
          </View>
          <View style={{ gap: space[3] }}>
            <Button testID={`${testID}-confirmar`} label="Sair" kind="danger" size="lg" wide disabled={busy} busy={busy} onPress={() => void confirm()} />
            <Button testID={`${testID}-cancelar`} label="Cancelar" kind="secondary" size="lg" wide disabled={busy} onPress={onClose} />
          </View>
        </Surface>
      </View>
    </Modal>
  );
}
