import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { RUN_ROUTE } from './app-tabs-config';
import { TutorialArt } from './art';
import { BigRunButton } from './big-run-button';
import { NeonAmbient } from './neon-ambient';
import { Text } from './text';

/**
 * Tela da aba **Correr** (D-73). O toque na aba já abre a Nova corrida; esta tela é o que fica na aba quando a
 * corrida fecha (ou quando se chega por link): a arte "corra" e o botão grande, sem texto a mais.
 */
export function RunTabScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const faction = useSession((s) => s.profile?.faction ?? 'striders');
  return (
    <View testID="tela-correr" style={{ flex: 1, backgroundColor: colors.background }}>
      <NeonAmbient />
      <View style={{ flex: 1, justifyContent: 'center', gap: space[6], paddingTop: insets.top + space[6], paddingHorizontal: space[6], paddingBottom: space[12] }}>
        <View style={{ alignItems: 'center' }}>
          <TutorialArt step="corra" team={faction} size={260} />
        </View>
        <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Bora pintar a cidade?
        </Text>
        <BigRunButton testID="correr-aba-comecar" onPress={() => router.push(RUN_ROUTE)} />
      </View>
    </View>
  );
}
