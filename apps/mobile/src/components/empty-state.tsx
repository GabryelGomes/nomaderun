import type { ReactNode } from 'react';
import { View } from 'react-native';

import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type EmptyStateProps = {
  title: string;
  /** No máximo 1 frase de até 90 caracteres (D-74). */
  body?: string;
  /** Ilustração da E4 (`components/art`). Decorativa: fica fora do leitor de tela. */
  art?: ReactNode;
  /** Ícone provisório enquanto a arte não existe. Ignorado quando há `art`. */
  icon?: IconName;
  /** Etiqueta curta acima do título (ex.: "Em breve"). */
  tag?: string;
  /** Uma ação só (normalmente um `Button`). */
  action?: ReactNode;
  testID?: string;
  /** Versão baixa, para dentro de cartões e listas. */
  compact?: boolean;
};

/**
 * Estado vazio = ilustração + 1 frase + 1 botão (regras de UX da E6). Nunca inventa número:
 * é o que aparece quando não há dado real (D-76).
 */
export function EmptyState({ title, body, art, icon, tag, action, testID, compact }: EmptyStateProps) {
  const { colors } = useTheme();
  const artSize = compact ? 72 : 112;
  const visual = art ?? (icon ? (
    <View style={{ width: compact ? 56 : 72, height: compact ? 56 : 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: neon.activeFill }}>
      <Icon name={icon} size={compact ? 26 : 32} color={colors.accentText} />
    </View>
  ) : null);
  return (
    <View testID={testID} style={{ alignItems: 'center', gap: space[2], paddingVertical: compact ? space[4] : space[8], paddingHorizontal: space[6] }}>
      {visual ? (
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ minHeight: art ? artSize : undefined, alignItems: 'center', justifyContent: 'center', marginBottom: space[2] }}>
          {visual}
        </View>
      ) : null}
      {tag ? (
        <Text variant="label" color={colors.accentText} style={{ textTransform: 'uppercase' }}>
          {tag}
        </Text>
      ) : null}
      <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text muted style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space[2], alignSelf: 'stretch', alignItems: 'center' }}>{action}</View> : null}
    </View>
  );
}
