import { Modal, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { TutorialArt } from '@/components/art';
import { HelpSheet, type HelpCard } from '@/components/help-sheet';
import { PressableScale } from '@/components/motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { useTheme } from '@/theme/use-theme';

/**
 * "?" da Arena (T7.3.3): a regra do território em 3 cartões ilustrados (E4, `TutorialArt`). É detalhe sob
 * demanda, numa folha à parte: as palavras daqui não somam na régua da Arena e vão à parte no relatório.
 * As frases valem para a regra v1 e para a v2 (D-62), porque a virada é por flag do servidor.
 */
export function arenaHelpCards(team: FactionId): HelpCard[] {
  return [
    { key: 'corra', title: 'Corra', body: 'Cada metro que você corre conta para o seu time.', art: <TutorialArt step="corra" team={team} size={64} /> },
    { key: 'pinte', title: 'Pinte', body: 'A zona fica com o time que mais correu nela.', art: <TutorialArt step="pinte" team={team} size={64} /> },
    { key: 'defenda', title: 'Defenda', body: 'Rival na sua zona? Corra lá para segurar a cor.', art: <TutorialArt step="defenda" team={team} size={64} /> },
  ];
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
      accessibilityLabel="Como jogar: a regra em 3 passos"
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineControl }}>
      <Text variant="title" aria-hidden maxFontSizeMultiplier={1.2}>
        ?
      </Text>
    </PressableScale>
  );
}
