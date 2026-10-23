import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { Mascot } from '@/components/art';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { FadeUp } from '@/components/motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { useSession } from '@/store/session-store';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { HealthPauseSheet } from './health-pause-sheet';
import { useWelcomeBack } from './hooks';
import type { WelcomeCard } from './welcome-back';

export type WelcomeBackSheetProps = {
  visible: boolean;
  /** Dias sem atividade (14 ou mais). */
  daysAway: number | null;
  /** Até 3 cartões verdadeiros (`welcomeBackCards`). */
  cards: readonly WelcomeCard[];
  /** "Começar leve": a tela padrão leva às missões (onde está a missão de volta). */
  onStart: () => void;
  onClose: () => void;
  /** "Preciso de uma pausa" (abre a pausa de saúde). Sem ele, o botão não aparece. */
  onPause?: () => void;
  team?: FactionId | null;
  testID?: string;
};

/**
 * "Bem-vindo de volta" (E7, T7.2.4): acolhe quem passou 14+ dias sem correr. Mascote, 3 cartões verdadeiros e
 * um passo leve. Nenhuma perda, nenhuma culpa, nada em vermelho (prompt §5.4).
 */
export function WelcomeBackSheet({ visible, daysAway, cards, onStart, onClose, onPause, team, testID = 'bem-vindo' }: WelcomeBackSheetProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(7, 7, 8, 0.86)' }}>
        <ScrollView testID={testID} contentContainerStyle={{ padding: space[6], gap: space[4] }}>
          <View style={{ alignItems: 'center', gap: space[2] }}>
            {team ? <Mascot team={team} pose="vitoria" size={120} animated /> : null}
            <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
              Que bom te ver!
            </Text>
            <Text muted style={{ textAlign: 'center' }}>
              {daysAway !== null ? `Faz ${daysAway} dias. Comece leve, no seu ritmo.` : 'Comece leve, no seu ritmo.'}
            </Text>
          </View>
          {cards.map((c, i) => (
            <FadeUp key={c.key} delay={120 + i * 80}>
              <View
                testID={`${testID}-cartao-${c.key}`}
                accessible
                accessibilityLabel={`${c.title}. ${c.body}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
                <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: neon.activeFill }}>
                  <Icon name={c.icon} size={22} color={colors.accentText} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyBold">{c.title}</Text>
                  <Text variant="small" muted>
                    {c.body}
                  </Text>
                </View>
              </View>
            </FadeUp>
          ))}
          <View style={{ gap: space[2], marginTop: space[2] }}>
            <Button testID={`${testID}-comecar`} label="Começar leve" size="lg" wide onPress={onStart} />
            {onPause ? <Button testID={`${testID}-pausa`} label="Preciso de uma pausa" kind="secondary" wide onPress={onPause} /> : null}
            <Button testID={`${testID}-fechar`} label="Agora não" kind="ghost" wide onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Pronto para montar numa tela (ex.: o Mapa): aparece sozinho para quem está há 14+ dias sem correr, uma vez
 * por ausência, e liga "Começar leve" às missões e "Preciso de uma pausa" à pausa de saúde.
 */
export function WelcomeBackGate() {
  const wb = useWelcomeBack();
  const team = useSession((s) => s.profile?.faction ?? null);
  const [pause, setPause] = useState(false);
  return (
    <>
      <WelcomeBackSheet
        visible={wb.visible && !pause}
        daysAway={wb.daysAway}
        cards={wb.cards}
        team={team}
        onStart={() => {
          wb.dismiss();
          router.push('/missoes');
        }}
        onPause={() => setPause(true)}
        onClose={wb.dismiss}
      />
      <HealthPauseSheet
        visible={pause}
        onClose={() => {
          setPause(false);
          wb.dismiss();
        }}
      />
    </>
  );
}
