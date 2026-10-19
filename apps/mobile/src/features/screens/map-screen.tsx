import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import { isUnderAttack } from '@/domain/territory';
import { DEMO_CENTER, zoneName } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { useGame } from '@/store/game-store';
import { factions, floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Layer = 'todos' | 'meu-time' | 'explorado';

/** Home: the living map is the product (Zenly lesson); everything else floats over it. */
export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const zones = useGame((s) => s.zones);
  const faction = useGame((s) => s.faction) ?? 'striders';
  const fog = useGame((s) => s.fog);
  const [layer, setLayer] = useState<Layer>('todos');

  const mapZones = useMemo(() => mapZonesNear(zones, DEMO_CENTER, 2300), [zones]);
  const explored = useMemo(() => (layer === 'explorado' ? fog.slice(-600) : undefined), [fog, layer]);

  const mine = Object.values(zones).filter((z) => z.owner === faction);
  const attacked = mine.filter(isUnderAttack);
  const alert = attacked[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TerritoryMap
        zones={layer === 'explorado' ? [] : mapZones}
        myFaction={faction}
        onlyMine={layer === 'meu-time'}
        explored={explored}
        center={{ lat: DEMO_CENTER.lat - 0.0035, lng: DEMO_CENTER.lng }}
        span={2600}
        user={DEMO_CENTER}
        onZonePress={(id) => router.push({ pathname: '/zona/[id]', params: { id } })}
      />

      <View style={{ position: 'absolute', top: insets.top + space[2], left: space[4], right: space[4], gap: space[2] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            backgroundColor: colors.surface,
            borderRadius: radius.pill,
            paddingVertical: space[2],
            paddingLeft: space[2],
            paddingRight: space[4],
            boxShadow: floating,
          }}>
          <TeamBadge faction={faction} size={34} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">{factions[faction].name}</Text>
            <Text variant="caption" muted>
              {mine.length} zonas em Goiânia
            </Text>
          </View>
          <Icon name="city" size={18} color={colors.textSecondary} />
        </View>

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {(
            [
              ['todos', 'Todos os times'],
              ['meu-time', 'Só meu time'],
              ['explorado', 'Onde já corri'],
            ] as const
          ).map(([key, label]) => {
            const on = layer === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setLayer(key)}
                style={{
                  paddingHorizontal: space[4],
                  height: 36,
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  backgroundColor: on ? colors.text : colors.surface,
                  boxShadow: floating,
                }}>
                <Text variant="caption" color={on ? colors.surface : colors.text}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ position: 'absolute', right: space[4], bottom: 190 + insets.bottom, gap: space[3] }}>
        <IconButton
          icon="layers"
          label="Trocar camada do mapa"
          onPress={() => setLayer((l) => (l === 'todos' ? 'meu-time' : l === 'meu-time' ? 'explorado' : 'todos'))}
        />
      </View>

      <View style={{ position: 'absolute', left: space[4], right: space[4], bottom: space[4], gap: space[3] }}>
        {alert ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Alerta: ${zoneName(alert.id)} sob ataque. Abrir zona.`}
            onPress={() => router.push({ pathname: '/zona/[id]', params: { id: alert.id } })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: space[3],
              boxShadow: floating,
            }}>
            <TeamBadge faction={alert.owner} attack size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">{zoneName(alert.id)} está sob ataque</Text>
              <Text variant="small" muted>
                {alert.attacker ? factions[alert.attacker].name : 'Rivais'} avançando. Corra lá e ganhe pontos em dobro.
              </Text>
            </View>
          </Pressable>
        ) : null}
        <Button label="Correr" icon="play" size="lg" wide onPress={() => router.push('/corrida')} />
      </View>
    </View>
  );
}
