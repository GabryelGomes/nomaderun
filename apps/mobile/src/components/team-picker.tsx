import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Svg from 'react-native-svg';

import { FACTION_IDS, type FactionId } from '@/domain/types';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { PressableScale } from './motion/pressable';
import { TeamBadge, TeamShapeGlyph } from './team-badge';
import { TEAM_STORY } from './team-identity';
import { Text } from './text';

export type TeamPickerCardProps = {
  faction: FactionId;
  selected: boolean;
  onSelect: (f: FactionId) => void;
  /** Abre a folha do líder (`LeaderSheet`). */
  onLeader?: (f: FactionId) => void;
  /** Mascote animado da E4. Sem arte, usa o selo do time. */
  art?: ReactNode;
  /** Largura do card no carrossel. */
  width?: number;
  testID?: string;
};

/** Leitura do card: time, lema, estilo e se está escolhido. */
export function teamCardLabel(f: FactionId): string {
  const t = TEAM_STORY[f];
  return `${factions[f].name}. ${factions[f].motto}. Mascote: ${t.mascot}, ${t.mascotKind}. Estilo: ${t.style}.`;
}

/** Card grande de um time (escolha no estilo Pokémon GO): mascote, nome, forma, estilo e 1 frase. */
export function TeamPickerCard({ faction, selected, onSelect, onLeader, art, width, testID }: TeamPickerCardProps) {
  const { colors } = useTheme();
  const f = factions[faction];
  const t = TEAM_STORY[faction];
  const glow = neonTeam[faction];
  const id = testID ?? `time-${faction}`;
  return (
    <PressableScale
      testID={id}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={teamCardLabel(faction)}
      onPress={() => onSelect(faction)}
      hitSlop={0}
      containerStyle={width ? { width } : undefined}
      style={{
        gap: space[3],
        padding: space[4],
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: selected ? glow : colors.line,
        boxShadow: selected ? `0 0 28px ${glow}55` : undefined,
      }}>
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
        {art ?? <TeamBadge faction={faction} size={112} />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View aria-hidden>
          <Svg width={24} height={24}>
            <TeamShapeGlyph shape={f.shape} size={24} color={glow} />
          </Svg>
        </View>
        <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
          {f.name}
        </Text>
      </View>
      <Text variant="label" color={glow} style={{ textTransform: 'uppercase' }}>
        {t.style}
      </Text>
      <Text muted>{t.bio}</Text>
      {onLeader ? (
        <PressableScale
          testID={`${id}-lider`}
          accessibilityRole="button"
          accessibilityLabel={`Conhecer ${t.leader}, líder dos ${f.name}`}
          onPress={() => onLeader(faction)}
          hitSlop={0}
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Text variant="bodyBold" color={colors.accentText}>
            Conhecer {t.leader}
          </Text>
        </PressableScale>
      ) : null}
    </PressableScale>
  );
}

export type TeamCarouselProps = {
  value: FactionId | null;
  onChange: (f: FactionId) => void;
  onLeader?: (f: FactionId) => void;
  /** Arte do mascote por time (E4). */
  renderArt?: (f: FactionId, selected: boolean) => ReactNode;
  testID?: string;
};

/** Margem lateral que deixa o próximo card aparecendo (convite para deslizar). */
const PEEK = 32;

/**
 * Carrossel dos 4 times. Toque escolhe; deslizar só navega. As formas embaixo servem de paginação e repetem a
 * escolha sem depender da cor. A mola do carrossel é da E5 (o snap aqui é o nativo).
 */
export function TeamCarousel({ value, onChange, onLeader, renderArt, testID = 'times' }: TeamCarouselProps) {
  const { colors } = useTheme();
  const { width: screen } = useWindowDimensions();
  const cardW = Math.max(240, Math.min(screen - PEEK * 2, 420));
  const step = cardW + space[3];
  const ref = useRef<ScrollView>(null);
  // Leva o card escolhido para o centro (sem setState: só rola).
  useEffect(() => {
    if (!value) return;
    ref.current?.scrollTo({ x: FACTION_IDS.indexOf(value) * step, animated: true });
  }, [value, step]);
  return (
    <View testID={testID} style={{ gap: space[3] }}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: (screen - cardW) / 2, gap: space[3] }}
        accessibilityRole="radiogroup">
        {FACTION_IDS.map((f) => (
          <TeamPickerCard key={f} faction={f} width={cardW} selected={value === f} onSelect={onChange} onLeader={onLeader} art={renderArt?.(f, value === f)} testID={`${testID}-${f}`} />
        ))}
      </ScrollView>
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'center', gap: space[3] }}>
        {FACTION_IDS.map((f) => (
          <Svg key={f} width={20} height={20}>
            <TeamShapeGlyph shape={factions[f].shape} size={20} color={value === f ? neonTeam[f] : colors.textSecondary} />
          </Svg>
        ))}
      </View>
    </View>
  );
}
