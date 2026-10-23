import type { ReactNode } from 'react';
import { View } from 'react-native';

import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type PermissionPrimerProps = {
  testID: string;
  /** Ex.: "Ligue o GPS para pintar a cidade". */
  title: string;
  /** 1 frase com o motivo concreto. */
  body: string;
  /** Verbo do pedido (ex.: "Permitir localização"). */
  ctaLabel: string;
  onPress: () => void;
  /** Garantia curta (ex.: "Sua casa fica escondida dos outros."). */
  footnote?: string;
  /** Ilustração da E4 (rota pintando o bairro, sino…). */
  art?: ReactNode;
  icon?: IconName;
  secondaryLabel?: string;
  onSecondary?: () => void;
  busy?: boolean;
};

/**
 * Explicação antes do pedido do sistema (GPS no onboarding, GPS negado na pré-corrida, avisos depois da 1ª conquista).
 * Um motivo concreto por tela, a ação no polegar e uma saída honesta ("Agora não").
 */
export function PermissionPrimer({ testID, title, body, ctaLabel, onPress, footnote, art, icon = 'location', secondaryLabel, onSecondary, busy }: PermissionPrimerProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, gap: space[6], padding: space[6], justifyContent: 'space-between' }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space[4] }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
          {art ?? (
            <View style={{ width: 120, height: 120, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: neon.activeFill }}>
              <Icon name={icon} size={52} color={colors.accentText} />
            </View>
          )}
        </View>
        <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        <Text muted style={{ textAlign: 'center' }}>
          {body}
        </Text>
        {footnote ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
            <Icon name="lock" size={14} color={colors.textSecondary} />
            <Text variant="small" muted style={{ flexShrink: 1 }}>
              {footnote}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: space[2] }}>
        <Button testID={`${testID}-permitir`} label={ctaLabel} icon={icon} size="lg" wide disabled={busy} busy={busy} onPress={onPress} />
        {secondaryLabel && onSecondary ? <Button testID={`${testID}-agora-nao`} label={secondaryLabel} kind="ghost" wide onPress={onSecondary} /> : null}
      </View>
    </View>
  );
}
