import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { FactionId } from '@/domain/types';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Button } from './button';
import { TeamBadge } from './team-badge';
import { TEAM_BALANCE_LINE, TEAM_STORY } from './team-identity';
import { Text } from './text';

export type LeaderSheetProps = {
  faction: FactionId;
  onJoin: () => void;
  onBack: () => void;
  /** Busto do líder (E4). Sem arte, usa o selo do time. */
  art?: ReactNode;
  /** Gravando o time: o botão principal fica ocupado. */
  busy?: boolean;
  testID?: string;
};

/**
 * Conteúdo da folha "o líder fala" (onboarding e página do time). A apresentação em folha (formSheet) é da rota;
 * aqui fica só o miolo: busto, balão com a fala e a linha de equilíbrio.
 */
export function LeaderSheet({ faction, onJoin, onBack, art, busy, testID = 'lider' }: LeaderSheetProps) {
  const { colors } = useTheme();
  const f = factions[faction];
  const t = TEAM_STORY[faction];
  const glow = neonTeam[faction];
  return (
    <View testID={testID} style={{ gap: space[4], padding: space[6] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
          {art ?? <TeamBadge faction={faction} size={72} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" color={glow} style={{ textTransform: 'uppercase' }}>
            Líder dos {f.name}
          </Text>
          <Text variant="headline" accessibilityRole="header">
            {t.leader}
          </Text>
        </View>
      </View>
      <View style={{ padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceSunken, borderLeftWidth: 3, borderLeftColor: glow }}>
        <Text variant="lead">“{t.leaderLine}”</Text>
      </View>
      <Text variant="small" muted>
        {TEAM_BALANCE_LINE}
      </Text>
      <View style={{ gap: space[2] }}>
        <Button testID={`${testID}-entrar`} label={busy ? 'Entrando…' : `Entrar para os ${f.name}`} size="lg" wide disabled={busy} busy={busy} onPress={onJoin} />
        <Button testID={`${testID}-voltar`} label="Ver outros times" kind="ghost" wide onPress={onBack} />
      </View>
    </View>
  );
}
