import { Modal, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { HelpSheet, type HelpCard } from '@/components/help-sheet';
import { PressableScale } from '@/components/motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { howToPlayCards } from '@/features/engagement/how-to-play';
import { useTheme } from '@/theme/use-theme';

/**
 * "?" da Arena (T7.3.3; F8 B2, UX-07/UX-19): "Como jogar" em 6 cartões ilustrados (E4) — Corra, Pinte, Defenda,
 * Chefão, Missões e baú, Liga. Os cartões são da E7 (`howToPlayCards`); abre sozinho 1 vez na 1ª visita à Arena.
 * É detalhe sob demanda, numa folha à parte: as palavras daqui não somam na régua da Arena.
 */
export function arenaHelpCards(team: FactionId): HelpCard[] {
  return howToPlayCards(team);
}

/** Folha com a regra. Com "Reduzir movimento", aparece por esmaecimento, sem deslizar. */
export function ArenaHelp({ visible, team, onClose }: { visible: boolean; team: FactionId; onClose: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} animationType={reduced ? 'fade' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose} transparent={false}>
      {/* Fundo do tema atrás da folha (a Modal não herda a cor da tela). */}
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <HelpSheet testID="arena-ajuda" title="Como jogar" cards={arenaHelpCards(team)} onClose={onClose} />
      </View>
    </Modal>
  );
}

/** Botão "?" do cabeçalho da Arena: 44 × 44, com nome para o leitor de tela. */
export function ArenaHelpButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID="arena-ajuda-abrir"
      accessibilityRole="button"
      accessibilityLabel="Como jogar: a regra em 6 cartões"
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineControl }}>
      <Text variant="title" aria-hidden maxFontSizeMultiplier={1.2}>
        ?
      </Text>
    </PressableScale>
  );
}
