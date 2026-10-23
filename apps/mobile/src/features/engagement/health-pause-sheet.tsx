import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { useNow } from '@/features/use-now';
import { useEngagement } from '@/store/engagement-store';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { endPause, startPause } from './controller';
import { PAUSE_WEEKS, pauseActive, shortDate } from './model';

export type HealthPauseSheetProps = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
};

/**
 * Pausa de saúde (D-63): lesão, viagem ou descanso. De 1 a 4 semanas, 1 vez por temporada, começando na semana
 * atual; a sequência fica guardada. Encerrar antes mantém a semana atual protegida. A E6 abre pela tela de
 * conta ou pelo "Bem-vindo de volta".
 */
export function HealthPauseSheet({ visible, onClose, testID = 'pausa-saude' }: HealthPauseSheetProps) {
  const { colors } = useTheme();
  const now = useNow(60_000);
  const status = useEngagement((s) => s.status);
  const [weeks, setWeeks] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const streak = status.data?.streak ?? null;
  const active = pauseActive(streak?.pause ?? null, now);
  const used = streak?.pauseAvailable === false && !active;

  const start = async () => {
    setBusy(true);
    setMessage(null);
    const res = await startPause(weeks);
    setBusy(false);
    setMessage(res.ok ? `Pausa até ${shortDate(res.data.until)}. Descanse bem.` : res.error.message);
  };

  const finish = async () => {
    setBusy(true);
    setMessage(null);
    const res = await endPause();
    setBusy(false);
    setMessage(res.ok ? 'Pausa encerrada. Esta semana segue protegida.' : res.error.message);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 7, 8, 0.6)' }}>
        <Pressable testID={`${testID}-fundo`} accessibilityLabel="Fechar a pausa de saúde" onPress={onClose} style={{ flex: 1 }} />
        <Surface style={{ gap: space[4], padding: space[6], borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <View testID={testID} style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name="heart" size={22} color={colors.accentText} />
              <Text variant="title" accessibilityRole="header">
                Pausa de saúde
              </Text>
            </View>
            <Text muted>Lesão, viagem ou descanso: sua sequência fica guardada.</Text>
          </View>

          {!status.data ? (
            <Text testID={`${testID}-indisponivel`} muted>
              A pausa ainda não está disponível no servidor.
            </Text>
          ) : active ? (
            <View style={{ gap: space[3] }}>
              <Text testID={`${testID}-ativa`} variant="bodyBold">{`Em pausa até ${shortDate(streak!.pause!.until)}`}</Text>
              <Button testID={`${testID}-encerrar`} label="Encerrar pausa" kind="secondary" wide disabled={busy} busy={busy} onPress={() => void finish()} />
              <Text variant="caption" muted>
                Encerrar agora mantém esta semana protegida.
              </Text>
            </View>
          ) : used ? (
            <Text testID={`${testID}-usada`} muted>
              Você já usou a pausa desta temporada. Ela volta no mês que vem.
            </Text>
          ) : (
            <View style={{ gap: space[3] }}>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space[2] }}>
                {PAUSE_WEEKS.map((n) => {
                  const on = n === weeks;
                  return (
                    <PressableScale
                      key={n}
                      testID={`${testID}-semanas-${n}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={n === 1 ? '1 semana' : `${n} semanas`}
                      onPress={() => setWeeks(n)}
                      containerStyle={{ flex: 1 }}
                      style={{
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: on ? colors.action : colors.lineControl,
                        backgroundColor: on ? neon.activeFill : 'transparent',
                      }}>
                      <Text variant="bodyBold" color={on ? colors.accentText : colors.text}>
                        {n === 1 ? '1 sem.' : `${n} sem.`}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
              <Button testID={`${testID}-comecar`} label="Começar pausa" wide disabled={busy} busy={busy} onPress={() => void start()} />
              <Text variant="caption" muted>
                1 vez por temporada. Começa nesta semana.
              </Text>
            </View>
          )}

          {message ? (
            <Text testID={`${testID}-mensagem`} accessibilityLiveRegion="polite" variant="small">
              {message}
            </Text>
          ) : null}
          <Button testID={`${testID}-fechar`} label="Fechar" kind="ghost" wide onPress={onClose} />
        </Surface>
      </View>
    </Modal>
  );
}
