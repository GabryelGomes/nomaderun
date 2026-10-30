import { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { TeamCover } from '@/components/art/team/cover';
import { TeamEmblem } from '@/components/art/team/emblem';
import { TEAM_BIO } from '@/domain/team-bio';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { PressableScale } from './motion/pressable';
import { teamCardLabel } from './team-picker';
import { Text } from './text';

export type TeamCoverCardProps = {
  faction: FactionId;
  selected: boolean;
  /** O card está no centro do carrossel: só ele anima (regra 5 da Fase 8). */
  focused: boolean;
  /** O quiz sugeriu este time (chip "Combina com você"); a escolha continua com a pessoa. */
  suggested?: boolean;
  onSelect: (f: FactionId) => void;
  /** Abre a folha do líder (`LeaderSheet`). */
  onLeader?: (f: FactionId) => void;
  width: number;
  testID?: string;
};

/** Card de um time com a capa (D-93): capa animada + líder, valor e estilo em 1 linha + "Conhecer". */
export function TeamCoverCard({ faction, selected, focused, suggested, onSelect, onLeader, width, testID }: TeamCoverCardProps) {
  const { colors } = useTheme();
  const f = factions[faction];
  const b = TEAM_BIO[faction];
  const glow = neonTeam[faction];
  const id = testID ?? `time-${faction}`;
  const inner = width - 4; // borda de 2 pt
  return (
    <PressableScale
      testID={id}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${teamCardLabel(faction)}${suggested ? ' Combina com você, pelo quiz.' : ''}`}
      onPress={() => onSelect(faction)}
      hitSlop={0}
      containerStyle={{ width }}
      style={{
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: selected ? glow : colors.line,
        boxShadow: selected ? `0 0 28px ${glow}55` : undefined,
      }}>
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <TeamCover team={faction} width={inner} variant="card" animated focused={focused} />
        {suggested ? (
          <View style={{ position: 'absolute', left: space[3], top: space[3], paddingHorizontal: space[3], paddingVertical: 4, borderRadius: radius.pill, backgroundColor: glow }}>
            <Text variant="label" color="#070708">
              Combina com você
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], paddingRight: space[4] }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants">
          <TeamEmblem team={faction} size={40} variant="medio" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" numberOfLines={1}>
            {b.style}
          </Text>
          <Text variant="small" muted numberOfLines={1}>
            {b.value} · líder {b.leader}
          </Text>
        </View>
        {onLeader ? (
          <PressableScale
            testID={`${id}-lider`}
            accessibilityRole="button"
            accessibilityLabel={`Conhecer ${b.leader}, líder dos ${f.name}`}
            onPress={() => onLeader(faction)}
            hitSlop={8}
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
            <Text variant="bodyBold" color={colors.accentText}>
              Conhecer
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </PressableScale>
  );
}

export type TeamCoverCarouselProps = {
  value: FactionId | null;
  onChange: (f: FactionId) => void;
  onLeader?: (f: FactionId) => void;
  suggested?: FactionId | null;
  testID?: string;
};

/** Margem lateral que deixa o próximo card aparecendo (convite para deslizar). */
const PEEK = 28;

/**
 * Carrossel dos 4 times com as capas. Toque escolhe; deslizar só navega; só a capa no centro anima. A paginação
 * embaixo repete a forma de cada time pelo emblema mini (nunca uma bolinha). Leva o card escolhido ao centro.
 */
export function TeamCoverCarousel({ value, onChange, onLeader, suggested, testID = 'times' }: TeamCoverCarouselProps) {
  const { colors } = useTheme();
  const { width: screen } = useWindowDimensions();
  const cardW = Math.max(260, Math.min(screen - PEEK * 2, 420));
  const step = cardW + space[3];
  const ref = useRef<ScrollView>(null);
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    if (!value) return;
    ref.current?.scrollTo({ x: FACTION_IDS.indexOf(value) * step, animated: true });
  }, [value, step]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(FACTION_IDS.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    setFocused((cur) => (cur === i ? cur : i));
  };

  return (
    <View testID={testID} style={{ gap: space[3] }}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={120}
        contentContainerStyle={{ paddingHorizontal: (screen - cardW) / 2, gap: space[3] }}
        accessibilityRole="radiogroup">
        {FACTION_IDS.map((f, i) => (
          <TeamCoverCard key={f} faction={f} width={cardW} selected={value === f} focused={focused === i} suggested={suggested === f} onSelect={onChange} onLeader={onLeader} testID={`${testID}-${f}`} />
        ))}
      </ScrollView>
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'center', gap: space[4] }}>
        {FACTION_IDS.map((f) => (
          <TeamEmblem key={f} team={f} size={22} variant="mini" color={value === f ? neonTeam[f] : colors.textSecondary} />
        ))}
      </View>
    </View>
  );
}
