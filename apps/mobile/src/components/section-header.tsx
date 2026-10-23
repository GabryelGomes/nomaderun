import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { PressableScale } from './motion/pressable';
import { Text } from './text';

export type SectionHeaderProps = {
  title: string;
  /** Ação pronta (qualquer nó). Prefira `actionLabel` + `onAction`. */
  action?: ReactNode;
  /** Ex.: "Ver todas". Vira um link com alvo de 44 pt. */
  actionLabel?: string;
  onAction?: () => void;
  /** testID do link (padrão: `${testID}-acao`). */
  actionTestID?: string;
  testID?: string;
};

/** Título de seção com o "Ver todas" opcional à direita (detalhe sob demanda, 3º nível da hierarquia). */
export function SectionHeader({ title, action, actionLabel, onAction, actionTestID, testID }: SectionHeaderProps) {
  const { colors } = useTheme();
  const link =
    actionLabel && onAction ? (
      <PressableScale
        testID={actionTestID ?? `${testID ?? 'secao'}-acao`}
        accessibilityRole="link"
        accessibilityLabel={`${actionLabel}: ${title}`}
        onPress={onAction}
        hitSlop={{ top: 0, bottom: 0, left: 8, right: 8 }}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text variant="bodyBold" color={colors.accentText}>
          {actionLabel}
        </Text>
        <Icon name="chevron" size={16} color={colors.accentText} />
      </PressableScale>
    ) : (
      action
    );
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingHorizontal: space[1], minHeight: 44 }}>
      <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {link}
    </View>
  );
}
