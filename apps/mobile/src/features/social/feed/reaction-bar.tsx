/**
 * Barra de reações do feed (D-79): "Bora!" (principal), "Fogo" e "Raio". Só reações prontas, sem comentário.
 * 1 reação por pessoa por item (tocar de novo tira; tocar em outra troca). Trava de 300 ms contra toque
 * repetido. O próprio item mostra só os contadores (ninguém reage a si mesmo).
 *
 * Momento do "Bora!" (enquanto o da E5 não existe): 6 faíscas na cor do time, "+1" subindo e vibração `tap`.
 * Com "Reduzir movimento", só o contador muda (as primitivas da E5 já respeitam a preferência).
 */
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Burst, FloatingNumber, haptic, PressableScale } from '@/components/motion';
import { Text } from '@/components/text';
import { FEED_REACTIONS, type FeedReaction } from '@/services/api/feed-repo';
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
  /** Cor do momento "Bora!" (neon do time de quem correu). */
  color: string;
  onReact: (reaction: FeedReaction) => void;
};

export function ReactionBar({ itemId, reactions, myReaction, readOnly, color, onReact }: ReactionBarProps) {
  const { colors } = useTheme();
  const locked = useRef(false);
  const [moment, setMoment] = useState(0);

  const press = (r: FeedReaction) => {
    if (locked.current) return;
    locked.current = true;
    setTimeout(() => {
      locked.current = false;
    }, REACTION_LOCK_MS);
    if (r === 'bora' && myReaction !== 'bora') {
      setMoment((n) => n + 1);
      haptic('tap');
    } else haptic('selection');
    onReact(r);
  };

  return (
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      {FEED_REACTIONS.map((r) => {
        const mine = myReaction === r;
        const count = reactions[r];
        const label = `${REACTION_LABEL[r]}${count ? `, ${count}` : ''}`;
        const body = (
          <>
            <Icon name={ICON[r]} size={18} color={mine ? colors.onAction : colors.text} />
            <Text variant={r === 'bora' ? 'bodyBold' : 'small'} color={mine ? colors.onAction : colors.text} tabular>
              {r === 'bora' ? REACTION_LABEL.bora : ''}
              {count ? `${r === 'bora' ? ' ' : ''}${count}` : ''}
            </Text>
          </>
        );
        const style = {
          minHeight: 40,
          minWidth: r === 'bora' ? 88 : 52,
          paddingHorizontal: space[3],
          borderRadius: radius.pill,
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: space[1],
          backgroundColor: mine ? colors.action : colors.surfaceSunken,
          borderWidth: 1,
          borderColor: mine ? colors.action : colors.line,
        };
        if (readOnly) {
          return count ? (
            <View key={r} testID={`feed-${itemId}-${r}-total`} accessible accessibilityLabel={`${count} ${REACTION_HINT[r]}${count > 1 ? 's' : ''}`} style={style}>
              {body}
            </View>
          ) : null;
        }
        return (
          <View key={r}>
            <PressableScale
              testID={`feed-${itemId}-${r}`}
              accessibilityLabel={label}
              accessibilityHint={mine ? 'Toque para tirar a reação' : `Reagir com ${REACTION_HINT[r]}`}
              accessibilityState={{ selected: mine }}
              onPress={() => press(r)}
              hitSlop={4}
              style={style}>
              {body}
            </PressableScale>
            {r === 'bora' && moment > 0 ? (
              <View key={moment} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Burst count={6} color={color} distance={34} length={10} seed={moment} />
                <FloatingNumber text="+1" color={color} size={22} rise={36} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
