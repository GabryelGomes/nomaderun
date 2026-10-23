/**
 * Item do feed da crew (F1 §6): quem correu, selo do time, data sem hora, mini-mapa 16:9 da rota cortada
 * no servidor, km · tempo · ritmo, até 3 fichas de conquista e a barra de reações.
 */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { DemoBadge } from '@/components/demo-badge';
import { PressableScale } from '@/components/motion';
import { TeamBadge } from '@/components/team-badge';
import { Text } from '@/components/text';
import { listFeedItemKudos, type FeedItem, type FeedKudo, type FeedReaction } from '@/services/api/feed-repo';
import { neonTeam } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { feedDateLabel, feedItemLabel, feedStats, highlightLabel, REACTION_LABEL, totalReactions } from './feed-model';
import { ReactionBar } from './reaction-bar';
import { ServerRouteMap } from './server-route-map';

export type CrewFeedCardProps = {
  item: FeedItem;
  today: string;
  onReact: (itemId: string, reaction: FeedReaction) => void;
  /** Tirar a própria corrida do feed (só no item da pessoa). */
  onRemove?: (itemId: string) => void;
};

export function CrewFeedCard({ item, today, onReact, onRemove }: CrewFeedCardProps) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const color = item.author.faction ? neonTeam[item.author.faction] : colors.action;
  const s = feedStats(item);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  return (
    <View
      testID={`feed-item-${item.id}`}
      style={{ gap: space[3], padding: space[3], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <View accessible accessibilityLabel={feedItemLabel(item, today)} style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <TeamBadge faction={item.author.faction} size={24} />
          <Text variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.you ? 'Você' : item.author.username}
          </Text>
          <Text variant="small" muted>
            · {feedDateLabel(item.day, today)}
          </Text>
          <View style={{ flex: 1 }} />
          {item.isDemo ? <DemoBadge /> : null}
        </View>
        <View onLayout={onLayout}>{w > 0 ? <ServerRouteMap route={item.route} color={color} width={w} /> : <View style={{ aspectRatio: 16 / 9 }} />}</View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[3], flexWrap: 'wrap' }}>
          <Text variant="headline" tabular maxFontSizeMultiplier={1.3}>
            {s.km}
          </Text>
          <Text variant="small" muted tabular>
            {s.time} · {s.pace}
          </Text>
        </View>
        {item.highlights.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
            {item.highlights.map((h) => (
              <View key={highlightLabel(h)} style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: color }}>
                <Text variant="caption" maxFontSizeMultiplier={1.3}>
                  {highlightLabel(h)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <ReactionBar itemId={item.id} reactions={item.kudos} myReaction={item.myReaction} readOnly={item.you} color={color} onReact={(r) => onReact(item.id, r)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] }}>
        {totalReactions(item.kudos) > 0 ? <WhoReacted itemId={item.id} total={totalReactions(item.kudos)} /> : null}
        {item.you && onRemove ? (
          <PressableScale testID={`feed-${item.id}-tirar`} accessibilityLabel="Tirar esta corrida do feed" onPress={() => onRemove(item.id)} hitSlop={8} style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text variant="small" muted>
              Tirar do feed
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

/** "Quem reagiu" (só nomes da crew, sob demanda). */
function WhoReacted({ itemId, total }: { itemId: string; total: number }) {
  const [list, setList] = useState<FeedKudo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const open = () =>
    void listFeedItemKudos(itemId).then((r) => {
      if (r.ok) setList(r.data);
      else setFailed(true);
    });
  if (list)
    return (
      <Text variant="small" muted testID={`feed-${itemId}-quem-lista`}>
        {list.map((k) => `${k.username} (${REACTION_LABEL[k.reaction]})`).join(' · ') || 'Ninguém ainda'}
      </Text>
    );
  return (
    <PressableScale testID={`feed-${itemId}-quem`} accessibilityLabel={`Ver quem reagiu, ${total}`} onPress={open} hitSlop={8} style={{ minHeight: 36, justifyContent: 'center' }}>
      <Text variant="small" muted>
        {failed ? 'Não deu para carregar' : total === 1 ? '1 reação' : `${total} reações`}
      </Text>
    </PressableScale>
  );
}
