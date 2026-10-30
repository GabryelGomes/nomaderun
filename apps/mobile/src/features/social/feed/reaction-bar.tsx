/**
 * Barra de reações do feed (D-79): "Bora!" (principal), "Fogo" e "Raio". Só reações prontas, sem comentário.
 * 1 reação por pessoa por item (tocar de novo tira; tocar em outra troca). Trava de 300 ms contra toque
 * repetido. O próprio item mostra só os contadores (ninguém reage a si mesmo).
 *
 * T7.3.7: o momento é o `BoraReaction` da E5 (pulo com mola curta, 6 faíscas e vibração leve ao mandar;
 * tirar é silencioso; "Reduzir movimento" fica só com o fade). As 3 reações usam o mesmo componente, como a
 * E5 previu, e o contador muda ao vivo quando chega aplauso pelo Realtime.
 */
import { useRef } from 'react';
import { View } from 'react-native';

import { BoraReaction } from '@/components/celebration/bora';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { FEED_REACTIONS, type FeedReaction } from '@/services/api/feed-repo';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { REACTION_HINT, REACTION_LABEL, REACTION_LOCK_MS } from './feed-model';

const ICON: Record<FeedReaction, IconName> = { bora: 'heart', fogo: 'fire', raio: 'flag' };

export type ReactionBarProps = {
  itemId: string;
  reactions: Record<FeedReaction, number>;
  myReaction: FeedReaction | null;
  /** Item da própria pessoa: só leitura. */
  readOnly?: boolean;
  onReact: (reaction: FeedReaction) => void;
};

/** Texto para o leitor de tela: "Mandar Bora! (aplauso), 3" / "Tirar Bora!, 4" (o total sempre no fim). */
export function reactionA11yLabel(r: FeedReaction, count: number, mine: boolean): string {
  const what = mine ? `Tirar ${REACTION_LABEL[r]}` : `Mandar ${REACTION_LABEL[r]} (${REACTION_HINT[r]})`;
  return `${what}${count ? `, ${count}` : ''}`;
}

export function ReactionBar({ itemId, reactions, myReaction, readOnly, onReact }: ReactionBarProps) {
  const { colors } = useTheme();
  const locked = useRef(false);

  const press = (r: FeedReaction) => {
    if (locked.current) return;
    locked.current = true;
    setTimeout(() => {
      locked.current = false;
    }, REACTION_LOCK_MS);
    onReact(r);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {FEED_REACTIONS.map((r) => {
        const mine = myReaction === r;
        const count = reactions[r];
        if (readOnly) {
          return count ? (
            <View
              key={r}
              testID={`feed-${itemId}-${r}-total`}
              accessible
              accessibilityLabel={`${count} ${REACTION_HINT[r]}${count > 1 ? 's' : ''}`}
              style={{ minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Icon name={ICON[r]} size={16} color={colors.textSecondary} />
              <Text variant="small" tabular>
                {r === 'bora' ? `${REACTION_LABEL.bora} ` : ''}
                {count}
              </Text>
            </View>
          ) : null;
        }
        return (
          <BoraReaction
            key={r}
            testID={`feed-${itemId}-${r}`}
            active={mine}
            count={count || undefined}
            label={REACTION_LABEL[r]}
            icon={<Icon name={ICON[r]} size={18} color={mine ? neon.orangeText : colors.text} />}
            accessibilityLabel={reactionA11yLabel(r, count, mine)}
            onPress={() => press(r)}
          />
        );
      })}
    </View>
  );
}
