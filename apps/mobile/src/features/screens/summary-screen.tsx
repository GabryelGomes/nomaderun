import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Share, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CaptureCelebration } from '@/components/capture-celebration';
import { HexMark } from '@/components/hex-mark';
import { EmptyState, Stat, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import { FLAG_EXPLANATION } from '@/domain/anti-cheat';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { DEMO_CENTER, zoneName } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { useGame } from '@/store/game-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const OUTCOME_LABEL = { conquered: 'Conquistada', defended: 'Defendida', influence: 'Mais influência', none: 'Sem pontos' } as const;

export function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useGame((s) => s.history.find((h) => h.id === id));
  const zones = useGame((s) => s.zones);
  const faction = useGame((s) => s.faction) ?? 'striders';
  const center = record?.path[Math.floor(record.path.length / 2)] ?? DEMO_CENTER;
  const mapZones = useMemo(() => mapZonesNear(zones, center, 1200), [zones, center]);

  if (!record) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <EmptyState
          title="Corrida não encontrada"
          body="Ela pode ter sido descartada. Suas corridas salvas ficam em Atividades."
          action={<Button label="Ver atividades" onPress={() => router.replace('/atividades')} />}
        />
      </View>
    );
  }

  const r = record.result;
  const conquered = r.zones.filter((z) => z.outcome === 'conquered');
  const highlight = conquered[0];
  const entering = (i: number) => (reduced ? undefined : FadeInDown.duration(250).delay(i * 40));
  const share = () =>
    Share.share({
      message: `Corri ${formatKm(record.meters)} km a ${formatPace(record.avgPace)}/km no NOMADE RUN e ${conquered.length ? `conquistei ${conquered.length} zona(s) em Goiânia` : 'pintei o bairro'}.`,
    });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space[4], paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[8], gap: space[4] }}>
      {highlight ? (
        <Surface style={{ paddingVertical: space[6], alignItems: 'center' }}>
          <CaptureCelebration faction={faction} zone={zoneName(highlight.zoneId)} rp={highlight.rp} />
        </Surface>
      ) : (
        <Text variant="headline" accessibilityRole="header">
          Corrida concluída
        </Text>
      )}

      <Animated.View entering={entering(0)}>
        <Surface padded={false} style={{ overflow: 'hidden', height: 220 }}>
          <TerritoryMap zones={mapZones} center={center} span={1500} path={record.path} interactive={false} />
        </Surface>
      </Animated.View>

      <Animated.View entering={entering(1)}>
        <Surface>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space[4], columnGap: space[6] }}>
            <Stat label="Distância" value={formatKm(record.meters)} unit="km" />
            <Stat label="Tempo em movimento" value={formatDuration(record.movingSeconds)} />
            <Stat label="Ritmo médio" value={formatPace(record.avgPace)} unit="/km" />
            <Stat label="Pontos de território" value={String(record.rp)} unit="RP" />
            <Stat label="Experiência" value={`+${record.xp}`} unit="XP" />
            <Stat label="Ruas reveladas" value={String(r.newFogCells.length)} unit="células" />
          </View>
          {record.simulated ? (
            <Text variant="caption" muted>
              Corrida simulada para demonstração.
            </Text>
          ) : null}
          {r.beatGhost !== null ? (
            <Text variant="bodyBold">{r.beatGhost ? 'Você terminou à frente do fantasma: pontos ×1,5.' : 'O fantasma venceu desta vez.'}</Text>
          ) : null}
        </Surface>
      </Animated.View>

      <Animated.View entering={entering(2)}>
        <Surface>
          <Text variant="title">Território</Text>
          {r.zones.length === 0 ? (
            <Text muted>Nenhuma zona pontuou nesta corrida.</Text>
          ) : (
            r.zones.slice(0, 8).map((z) => (
              <View key={z.zoneId} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <HexMark faction={z.ownerAfter} size={30} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {zoneName(z.zoneId)}
                  </Text>
                  <Text variant="small" muted>
                    {OUTCOME_LABEL[z.outcome]}, {Math.round(z.meters)} m
                  </Text>
                </View>
                <Text variant="bodyBold" tabular>
                  +{z.rp}
                </Text>
              </View>
            ))
          )}
        </Surface>
      </Animated.View>

      {r.validation.flags.filter((f) => f !== 'NO_PEDOMETER').length > 0 || r.validation.status === 'rejected' ? (
        <Animated.View entering={entering(3)}>
          <Surface style={{ borderWidth: 1, borderColor: colors.line }}>
            <Text variant="title">Trechos que não contaram</Text>
            {r.validation.flags
              .filter((f) => f !== 'NO_PEDOMETER')
              .map((f) => (
                <Text key={f} muted>
                  {FLAG_EXPLANATION[f]}
                </Text>
              ))}
            <Text variant="small" muted>
              {formatKm(r.validation.invalidMeters)} km fora da contagem.
            </Text>
          </Surface>
        </Animated.View>
      ) : null}

      <View style={{ gap: space[3], marginTop: space[2] }}>
        <Button label="Compartilhar corrida" icon="share" kind="secondary" wide onPress={share} />
        <Button label="Concluir" size="lg" wide onPress={() => router.dismissAll()} />
      </View>
      <View style={{ height: radius.sm }} />
    </ScrollView>
  );
}
