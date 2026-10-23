import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { FactionId } from '@/domain/types';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { PressableScale } from './motion/pressable';
import { TeamBadge } from './team-badge';
import { ProgressBar } from './territory-bar';
import { Text } from './text';

export type PlayerCardProps = {
  name: string;
  faction: FactionId;
  level: number;
  /** XP dentro do nível atual e o que falta para o próximo. */
  xp: { into: number; needed: number };
  /** Título do nível (E7, ex.: "Exploradora de bairro"). */
  title?: string;
  /** Avatar (foto ou iniciais). Sem avatar, usa o selo do time. */
  avatar?: ReactNode;
  /** Mascote do time (E4), ao lado. Decorativo. */
  mascot?: ReactNode;
  /** Anel de nível da E5 (`ProgressRing`). Sem anel, mostra a barra de XP. */
  ring?: ReactNode;
  onPress?: () => void;
  testID: string;
};

/** Leitura do cartão numa frase (nome, time, nível, XP). */
export function playerCardLabel(p: Pick<PlayerCardProps, 'name' | 'faction' | 'level' | 'xp' | 'title'>): string {
  const team = factions[p.faction].name;
  return [p.name, p.title, `${team}, nível ${p.level}`, `${p.xp.into} de ${p.xp.needed} XP para o nível ${p.level + 1}`].filter(Boolean).join('. ');
}

/** Cartão de jogador (herói do "Você" e base do card de compartilhar da E8). */
export function PlayerCard({ name, faction, level, xp, title, avatar, mascot, ring, onPress, testID }: PlayerCardProps) {
  const { colors } = useTheme();
  const team = neonTeam[faction];
  const label = playerCardLabel({ name, faction, level, xp, title });
  const body = (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
          {ring ?? null}
          <View style={ring ? { position: 'absolute' } : undefined}>{avatar ?? <TeamBadge faction={faction} size={ring ? 56 : 64} />}</View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={1}>
            {name}
          </Text>
          {title ? (
            <Text variant="bodyBold" color={team} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <Text variant="small" muted numberOfLines={1}>
            {factions[faction].name} · nível {level}
          </Text>
        </View>
        {mascot ? (
          <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 72, height: 72 }}>
            {mascot}
          </View>
        ) : null}
      </View>
      {ring ? null : (
        <View style={{ gap: space[1] }}>
          <ProgressBar value={xp.needed > 0 ? xp.into / xp.needed : 0} color={factions[faction].color} />
          <Text variant="caption" muted tabular>
            {xp.into.toLocaleString('pt-BR')} / {xp.needed.toLocaleString('pt-BR')} XP
          </Text>
        </View>
      )}
    </View>
  );
  const frame = {
    padding: space[4],
    borderRadius: radius.lg,
    borderCurve: 'continuous' as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  };
  return onPress ? (
    <PressableScale testID={testID} accessibilityLabel={label} onPress={onPress} hitSlop={0} style={frame}>
      {body}
    </PressableScale>
  ) : (
    <View testID={testID} accessible accessibilityLabel={label} style={frame}>
      {body}
    </View>
  );
}
