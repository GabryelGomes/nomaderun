import { View } from 'react-native';

import { Stagger } from '@/components/motion';
import { TeamBadge } from '@/components/team-badge';
import { FACTION_IDS } from '@/domain/types';
import { neonTeam } from '@/theme/neon';
import { space } from '@/theme/tokens';

/** Os quatro selos dos times entrando em cascata, cada um com brilho na sua cor neon (D-58). */
export function NeonBadges({ size = 44 }: { size?: number }) {
  return (
    <Stagger style={{ flexDirection: 'row', gap: space[3] }}>
      {FACTION_IDS.map((f) => (
        <View key={f} style={{ borderRadius: size / 2, boxShadow: `0 0 18px ${neonTeam[f]}88` }}>
          <TeamBadge faction={f} size={size} />
        </View>
      ))}
    </Stagger>
  );
}
