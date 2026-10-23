import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { FactionId } from '@/domain/types';
import { neon, neonTeam } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

export type HeroTone = FactionId | 'action' | 'villain';

/** Cor de destaque do herói: neon do time (texto 4,5:1), laranja de ação ou violeta dos vilões (D-67). */
export function heroToneColor(tone: HeroTone, accentText: string): string {
  if (tone === 'action') return accentText;
  if (tone === 'villain') return neon.villain;
  return neonTeam[tone];
}

export type HeroHeaderProps = {
  title: string;
  /** Linha curta acima do título (ex.: "Raid da semana"). */
  eyebrow?: string;
  /** 1 frase de até 90 caracteres. */
  body?: string;
  /** Mascote, chefão, mapa ou gráfico (E4). Decorativo: fora do leitor de tela. */
  art?: ReactNode;
  tone?: HeroTone;
  /** Selo ou ação no canto (ex.: `DemoBadge`). */
  aside?: ReactNode;
  /** Números grandes, barra de vida, `ProgressRing` da E5… */
  children?: ReactNode;
  testID?: string;
};

/**
 * Herói visual do topo das abas (1º nível da hierarquia): a arte domina, o título nomeia e os números vêm logo abaixo.
 * Sem arte, o herói continua legível (título + filete de cor), e a arte entra depois sem mudar o layout.
 */
export function HeroHeader({ title, eyebrow, body, art, tone = 'action', aside, children, testID }: HeroHeaderProps) {
  const { colors } = useTheme();
  const accent = heroToneColor(tone, colors.accentText);
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.line,
        overflow: 'hidden',
      }}>
      {/* Filete de cor do tom no topo: identifica o time (ou o vilão) sem depender só do texto. */}
      <View aria-hidden style={{ height: 3, backgroundColor: accent }} />
      <View style={{ padding: space[4], gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ flex: 1, gap: space[1] }}>
            {eyebrow ? (
              <Text variant="label" color={accent} style={{ textTransform: 'uppercase' }} numberOfLines={1}>
                {eyebrow}
              </Text>
            ) : null}
            <Text variant="headline" accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            {body ? <Text muted>{body}</Text> : null}
          </View>
          {art ? (
            <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}>
              {art}
            </View>
          ) : null}
        </View>
        {aside ? <View style={{ flexDirection: 'row' }}>{aside}</View> : null}
        {children}
      </View>
    </View>
  );
}
