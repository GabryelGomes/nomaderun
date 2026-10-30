import type { ReactNode } from 'react';
import { View } from 'react-native';

import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './motion/pressable';
import { Text } from './text';

/**
 * `play`: toca e vai correr com o modo · `info`: toca e abre "Como funciona" ·
 * `soon`: não é botão (não tem seta nem retorno de toque) e mostra "Em breve".
 */
export type ModeVariant = 'play' | 'info' | 'soon';

export type ModeCardProps = {
  testID: string;
  title: string;
  /** 1 frase curta (o que o modo é). */
  body: string;
  variant: ModeVariant;
  /** Ícone ilustrado do modo (E4). Sem arte, usa `icon`. */
  art?: ReactNode;
  icon?: IconName;
  /** Etiqueta curta ao lado do título (ex.: "Em toda corrida"). Em `soon`, padrão "Em breve". */
  tag?: string;
  selected?: boolean;
  onPress?: () => void;
};

const HINT: Record<Exclude<ModeVariant, 'soon'>, string> = {
  play: 'Toque para correr com este modo.',
  info: 'Toque para ver como funciona.',
};

/** Card de modo de jogo (Arena e pré-corrida). Corrige o card desativado que parecia botão (E6 F1, Arena). */
export function ModeCard({ testID, title, body, variant, art, icon, tag, selected, onPress }: ModeCardProps) {
  const { colors } = useTheme();
  const soon = variant === 'soon';
  const label = soon ? tag ?? 'Em breve' : tag;
  const visual = art ?? (icon ? <Icon name={icon} size={24} color={variant === 'play' ? colors.onAction : colors.text} /> : null);
  const content = (
    <>
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: variant === 'play' && !art ? colors.action : colors.surfaceSunken,
        }}>
        {visual}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2], flexWrap: 'wrap' }}>
          <Text variant="bodyBold">{title}</Text>
          {label ? (
            <Text variant="caption" color={soon ? colors.textSecondary : colors.accentText} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          ) : null}
        </View>
        <Text variant="small" muted>
          {body}
        </Text>
      </View>
      {soon || !onPress ? null : (
        <View aria-hidden>
          <Icon name={variant === 'play' ? 'play' : 'chevron'} size={18} color={variant === 'play' ? colors.accentText : colors.textSecondary} />
        </View>
      )}
    </>
  );
  const frame = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[3],
    padding: space[4],
    minHeight: 72,
    borderRadius: radius.lg,
    borderCurve: 'continuous' as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: selected ? colors.action : colors.line,
    boxShadow: selected ? neon.cardGlow : undefined,
  };
  if (soon || !onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={[title, label, body].filter(Boolean).join('. ')} style={[frame, soon ? { opacity: 0.72, borderStyle: 'dashed' } : null]}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={`${title}. ${body}`}
      accessibilityHint={HINT[variant]}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      hitSlop={0}
      style={frame}>
      {content}
    </PressableScale>
  );
}
