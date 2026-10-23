import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { IconButton } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type HelpCard = {
  key: string;
  /** Verbo curto (ex.: "Corra"). */
  title: string;
  /** 1 frase de até 90 caracteres. */
  body: string;
  /** Cartão ilustrado da E4 (tutorial). */
  art?: ReactNode;
  icon?: IconName;
};

export type HelpSheetProps = {
  testID: string;
  title: string;
  /** A regra em 3 passos (desenho, não parágrafo). */
  cards: readonly HelpCard[];
  onClose?: () => void;
};

/** Conteúdo do "?" (Arena, Zona, Liga, Cidades): a regra em 3 cartões numerados. A folha em si é da rota. */
export function HelpSheet({ testID, title, cards, onClose }: HelpSheetProps) {
  const { colors } = useTheme();
  return (
    <ScrollView testID={testID} contentContainerStyle={{ padding: space[6], gap: space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {onClose ? <IconButton testID={`${testID}-fechar`} icon="close" label="Fechar ajuda" tone="sunken" size={44} onPress={onClose} /> : null}
      </View>
      {cards.map((c, i) => (
        <View
          key={c.key}
          accessible
          accessibilityLabel={`Passo ${i + 1} de ${cards.length}: ${c.title}. ${c.body}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: neon.activeFill }}>
            {c.art ?? (c.icon ? <Icon name={c.icon} size={32} color={colors.accentText} /> : <Text variant="headline" color={colors.accentText}>{String(i + 1)}</Text>)}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" muted>
              {`${i + 1} de ${cards.length}`}
            </Text>
            <Text variant="title">{c.title}</Text>
            <Text muted>{c.body}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
