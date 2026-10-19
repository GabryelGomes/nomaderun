import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState } from '@/components/surface';
import { Text } from '@/components/text';
import { TerritoryBar } from '@/components/territory-bar';
import { DEFENSE_WINDOW_MS, SHIELD_REDUCTION } from '@/domain/territory';
import { FACTION_IDS } from '@/domain/types';
import { zoneName } from '@/demo/demo-data';
import { useNow } from '@/features/use-now';
import { useGame } from '@/store/game-store';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Zone detail as a native form sheet (expo-router skill): owner, influence, shield, attack countdown. */
export function ZoneSheet() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const zone = useGame((s) => (id ? s.zones[id] : undefined));
  const faction = useGame((s) => s.faction) ?? 'striders';
  const now = useNow(30_000);

  if (!zone) {
    return <EmptyState title="Zona sem dados" body="Ninguém correu aqui ainda. A primeira corrida pinta esta zona." />;
  }

  const attackLeftMs = zone.attackStartedAt ? Math.max(0, zone.attackStartedAt + DEFENSE_WINDOW_MS - now) : 0;
  const hours = Math.floor(attackLeftMs / 3_600_000);
  const minutes = Math.floor((attackLeftMs % 3_600_000) / 60_000);
  const ranked = FACTION_IDS.filter((f) => zone.influence[f] > 0).sort((a, b) => zone.influence[b] - zone.influence[a]);
  const isMine = zone.owner === faction;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.surface }}
      contentContainerStyle={{ padding: space[6], gap: space[4] }}>
      <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
        <TeamBadge faction={zone.owner} attack={!!zone.attackStartedAt} size={60} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" accessibilityRole="header">
            {zoneName(zone.id)}
          </Text>
          <Text muted>{zone.owner ? `Território dos ${factions[zone.owner].name}` : 'Zona neutra'}</Text>
        </View>
      </View>

      {zone.attackStartedAt ? (
        <View style={{ padding: space[4], borderRadius: radius.md, backgroundColor: colors.action, gap: 2 }}>
          <Text variant="bodyBold" color={colors.onAction}>
            Sob ataque dos {zone.attacker ? factions[zone.attacker].name : 'rivais'}
          </Text>
          <Text variant="small" color={colors.onAction}>
            Faltam {hours} h {minutes} min para o fim da defesa. Corridas do time dono valem pontos em dobro.
          </Text>
        </View>
      ) : null}

      <View style={{ gap: space[2] }}>
        <Text variant="caption" muted>
          Influência por time
        </Text>
        <TerritoryBar influence={zone.influence} height={12} />
        {ranked.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <TeamBadge faction={f} size={20} />
            <Text style={{ flex: 1 }}>{factions[f].name}</Text>
            <Text variant="bodyBold" tabular>
              {Math.round(zone.influence[f]).toLocaleString('pt-BR')}
            </Text>
          </View>
        ))}
      </View>

      {zone.owner ? (
        <Text variant="small" muted>
          Escudo nível {zone.shield}: rivais ganham {Math.round(SHIELD_REDUCTION[zone.shield] * 100)}% menos pontos aqui.
        </Text>
      ) : null}

      <Button
        label={isMine ? (zone.attackStartedAt ? 'Defender esta zona' : 'Reforçar esta zona') : 'Correr aqui'}
        icon="play"
        size="lg"
        wide
        onPress={() => {
          router.back();
          router.push('/corrida');
        }}
      />
    </ScrollView>
  );
}
