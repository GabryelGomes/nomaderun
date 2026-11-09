import type { ReactNode } from 'react';
import { View } from 'react-native';

import { neon } from '@/theme/neon';
import { floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './motion/pressable';
import { Text } from './text';

/**
 * Tipos de alerta do Mapa, da maior para a menor prioridade (E6 F1 §4.1; F8 B2, UX-02/UX-32): a missão inicial de
 * quem tem 0 corridas (`welcome`) vence o ataque (quem nunca correu aprende a correr antes de defender); depois o
 * ataque, a missão em andamento, o baú pronto, o chefão, a sequência e, por último, o recap da semana (F8 B3).
 */
export const ALERT_PRIORITY = ['welcome', 'attack', 'mission', 'chest', 'boss', 'streak', 'recap'] as const;
export type AlertKind = (typeof ALERT_PRIORITY)[number];

export type SlotAlert = {
  id: string;
  kind: AlertKind;
  /** Até ~30 caracteres (ex.: "Lago do Flamboyant sob ataque"). */
  title: string;
  /** 1 linha curta (ex.: "Defenda até 18h"). */
  body: string;
  onPress: () => void;
  onDismiss?: () => void;
  /** Arte pequena da E4 (mascote, chefão, baú). Sem arte, usa o ícone do tipo. */
  art?: ReactNode;
};

const ICON: Record<AlertKind, IconName> = { welcome: 'flag', attack: 'warning', mission: 'flag', chest: 'chest', boss: 'raid', streak: 'fire', recap: 'share' };

/** O alerta que aparece: o de maior prioridade; empate fica com o primeiro da lista. */
export function pickAlert(alerts: readonly SlotAlert[]): SlotAlert | null {
  let best: SlotAlert | null = null;
  for (const a of alerts) {
    if (!best || ALERT_PRIORITY.indexOf(a.kind) < ALERT_PRIORITY.indexOf(best.kind)) best = a;
  }
  return best;
}

/** Espaço único de alerta na zona do polegar: 1 alerta por vez, escolhido por prioridade. */
export function AlertSlot({ alerts, testID = 'alerta' }: { alerts: readonly SlotAlert[]; testID?: string }) {
  const { colors } = useTheme();
  const a = pickAlert(alerts);
  if (!a) return null;
  const tint = a.kind === 'boss' ? neon.villain : a.kind === 'attack' ? colors.danger : colors.accentText;
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', boxShadow: floating }}>
      <PressableScale
        testID={`${testID}-${a.kind}`}
        accessibilityLabel={`Alerta: ${a.title}. ${a.body}`}
        onPress={a.onPress}
        hitSlop={0}
        containerStyle={{ flex: 1 }}
        style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], paddingLeft: space[3], paddingRight: a.onDismiss ? 0 : space[3] }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          {a.art ?? <Icon name={ICON[a.kind]} size={22} color={tint} />}
        </View>
        <View style={{ flex: 1 }}>
          {/* F8-D (fonte ×1,3): 2 linhas cada (o nome da zona e o prazo não somem); o rótulo do botão é o texto inteiro. */}
          <Text variant="bodyBold" numberOfLines={2}>
            {a.title}
          </Text>
          <Text variant="caption" muted numberOfLines={2}>
            {a.body}
          </Text>
        </View>
      </PressableScale>
      {a.onDismiss ? (
        <PressableScale
          testID={`${testID}-fechar`}
          accessibilityLabel="Fechar alerta"
          onPress={a.onDismiss}
          hitSlop={0}
          style={{ width: 48, minHeight: 56, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={colors.textSecondary} />
        </PressableScale>
      ) : null}
    </View>
  );
}
