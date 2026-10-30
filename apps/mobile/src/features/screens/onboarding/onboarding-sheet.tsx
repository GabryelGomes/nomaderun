import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Folha de baixo do onboarding (líder e quiz). `Modal` do sistema: prende o foco do leitor de tela e fecha com o
 * "voltar" do Android. Com "Reduzir movimento", aparece com fade em vez de subir.
 */
export function OnboardingSheet({ visible, onClose, children, testID, label }: { visible: boolean; onClose: () => void; children: ReactNode; testID: string; label: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          testID={`${testID}-fundo`}
          accessibilityRole="button"
          accessibilityLabel={`Fechar ${label}`}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderCurve: 'continuous',
            paddingBottom: insets.bottom + space[2],
            maxHeight: '92%',
          }}>
          {children}
        </View>
      </View>
    </Modal>
  );
}
