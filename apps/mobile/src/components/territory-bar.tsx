import { View } from 'react-native';

import type { Influence } from '@/domain/territory';
import { FACTION_IDS } from '@/domain/types';
import { neonTeam } from '@/theme/neon';
import { factions, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Share of influence per faction in one zone. Each segment is labelled for screen readers. */
export function TerritoryBar({ influence, height = 10 }: { influence: Influence; height?: number }) {
  const { colors } = useTheme();
  const total = FACTION_IDS.reduce((s, f) => s + influence[f], 0);
  const parts = FACTION_IDS.filter((f) => influence[f] > 0).sort((a, b) => influence[b] - influence[a]);
  const label = total
    ? parts.map((f) => `${factions[f].name} ${Math.round((influence[f] / total) * 100)}%`).join(', ')
    : 'Zona neutra';
  return (
    <View
      accessible
      accessibilityLabel={`Influência: ${label}`}
      style={{
        height,
        borderRadius: radius.pill,
        overflow: 'hidden',
        flexDirection: 'row',
        backgroundColor: colors.surfaceSunken,
        gap: total ? 2 : 0,
      }}>
      {parts.map((f) => (
        <View key={f} style={{ flex: influence[f], backgroundColor: neonTeam[f] }} />
      ))}
    </View>
  );
}

/** A single progress bar (e.g. "RP until you capture this zone"). Width animates via a CSS transition. */
export function ProgressBar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  );
}
