import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CaptureCelebration } from '@/components/capture-celebration';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState, Stat, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { DEMO_CENTER } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { invalidReasons } from '@/features/run/summary-model';
import { useRunRecord } from '@/features/run/use-run-record';
import { getInvalidStretches } from '@/services/api/track-repo';
import { useGame } from '@/store/game-store';
import { useZones } from '@/store/zones-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const OUTCOME_LABEL = { conquered: 'Conquistada', defended: 'Defendida', influence: 'Mais influência', none: 'Sem pontos' } as const;

/** Resumo da corrida (RF-006, UC-01 passos 9, A1, E1, E2): oficial do servidor ou provisório. */
export function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useRunRecord(id);
  const zones = useZones((s) => s.zones);
  const faction = useGame((s) => s.faction) ?? 'striders';
  const center = record.path[Math.floor(record.path.length / 2)] ?? DEMO_CENTER;
  const mapZones = useMemo(() => mapZonesNear(zones, center, 1200), [zones, center]);

  const r = record.summary;
  const official = record.state === 'official';
  const conquered = official && r ? r.zones.filter((z) => z.outcome === 'conquered') : [];
  const highlight = conquered[0];

  // UC-01 E1 (P-20): trechos inválidos do resultado oficial em cinza no mapa.
  const invalidKey = official && r ? JSON.stringify(r.invalidSegments.map((g) => [g.fromSeq, g.toSeq])) : '[]';
  const [invalidPaths, setInvalidPaths] = useState<{ key: string; paths: { lat: number; lng: number }[][] }>({ key: '[]', paths: [] });
  useEffect(() => {
    if (!id || invalidKey === '[]') return;
    let alive = true;
    const ranges = (JSON.parse(invalidKey) as [number, number][]).map(([fromSeq, toSeq]) => ({ fromSeq, toSeq }));
    void getInvalidStretches(id, ranges).then((res) => alive && res.ok && setInvalidPaths({ key: invalidKey, paths: res.data }));
    return () => {
      alive = false;
    };
  }, [id, invalidKey]);

  // Vibra quando a conquista é confirmada pelo servidor (retorno visual obrigatório, §6.2).
  const celebrated = useRef(false);
  useEffect(() => {
    if (highlight && !celebrated.current) {
      celebrated.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [highlight]);

  if (record.state === 'loading') {
    return (
      <View testID="tela-resumo" style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <EmptyState title="Carregando a corrida" body="Buscando o resultado no servidor." />
      </View>
    );
  }

  if (!r) {
    return (
      <View testID="tela-resumo" style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <EmptyState
          title={record.state === 'missing' ? 'Corrida não encontrada' : 'Resultado ainda não disponível'}
          body={record.state === 'missing' ? 'Ela pode ter sido descartada. Suas corridas salvas ficam em Atividades.' : 'A corrida está no servidor e o resultado oficial aparece assim que ficar pronto.'}
          action={<Button testID="resumo-ver-atividades" label="Ver atividades" onPress={() => router.replace('/atividades')} />}
        />
      </View>
    );
  }

  const reasons = invalidReasons(r);
  const invalidCount = r.invalidSegments.length;
  const entering = (i: number) => (reduced ? undefined : FadeInDown.duration(250).delay(i * 40));
  const share = () =>
    Share.share({
      message: `Corri ${formatKm(r.meters)} km a ${r.avgPace ? formatPace(r.avgPace) : '--:--'}/km no NOMADE RUN e ${conquered.length ? `conquistei ${conquered.length} zona(s)` : 'pintei o bairro'}.`,
    });

  const banner =
    record.state === 'failed'
      ? { title: 'Não foi possível enviar', body: record.error ?? 'O servidor recusou esta corrida.', tone: colors.danger }
      : record.state !== 'official'
        ? {
            title: 'Resumo provisório',
            body: 'Provisório — será confirmado ao sincronizar. Os pontos estão guardados no aparelho e vão para o servidor assim que houver conexão.',
            tone: colors.line,
          }
        : r.status === 'rejected'
          ? { title: 'Corrida rejeitada', body: `Localização simulada detectada: a corrida não gera pontos e seu Índice de Confiança caiu para ${r.trust ?? '--'}.`, tone: colors.danger }
          : r.status === 'review'
            ? { title: 'Em revisão', body: r.review?.message ?? 'A corrida vai para a moderação e só pontua depois da aprovação.', tone: colors.line }
            : null;

  return (
    <ScrollView
      testID="tela-resumo"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space[4], paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[8], gap: space[4] }}>
      {highlight ? (
        <Surface style={{ paddingVertical: space[6], alignItems: 'center' }}>
          <View testID="resumo-zona-conquistada" accessible accessibilityLabel={`Zona conquistada, mais ${highlight.rp} RP em ${highlight.name}`}>
            <CaptureCelebration faction={faction} zone={highlight.name} rp={highlight.rp} />
          </View>
        </Surface>
      ) : (
        <Text variant="headline" accessibilityRole="header">
          Corrida concluída
        </Text>
      )}

      {banner ? (
        <Surface style={{ borderWidth: 1, borderColor: banner.tone }}>
          <View testID={record.state === 'official' ? `resumo-status-${r.status}` : `resumo-status-${record.state}`} accessible accessibilityRole="summary" style={{ gap: space[1] }}>
            <Text variant="title">{banner.title}</Text>
            <Text muted>{banner.body}</Text>
          </View>
          {record.state === 'provisional' || record.state === 'failed' ? (
            <Button
              testID="resumo-sincronizar"
              label={record.retrying ? 'Enviando…' : 'Tentar enviar agora'}
              kind="secondary"
              disabled={record.retrying || record.state === 'failed'}
              onPress={() => void record.retry()}
            />
          ) : null}
        </Surface>
      ) : null}

      <Animated.View entering={entering(0)}>
        <Surface padded={false} style={{ overflow: 'hidden', height: 220 }}>
          <TerritoryMap zones={mapZones} myFaction={faction} center={center} span={1500} path={record.path} invalidPaths={invalidPaths.key === invalidKey ? invalidPaths.paths : undefined} interactive={false} />
        </Surface>
      </Animated.View>

      <Animated.View entering={entering(1)}>
        <Surface>
          <View testID="resumo-metricas" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space[4], columnGap: space[6] }}>
            <Stat label="Distância" value={formatKm(r.meters)} unit="km" />
            <Stat label="Tempo em movimento" value={formatDuration(r.movingSeconds)} />
            <Stat label="Ritmo médio" value={r.avgPace ? formatPace(r.avgPace) : '--:--'} unit="/km" />
            <Stat label="Pontos de território" value={String(r.rpTotal)} unit="RP" />
            <Stat label="Experiência" value={`+${r.xp}`} unit="XP" />
            <Stat label="Ruas reveladas" value={String(r.newFogCells)} unit="células" />
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
            <Text muted>{r.status === 'review' || r.status === 'rejected' ? 'Nenhuma zona pontua enquanto a corrida não for aprovada.' : 'Nenhuma zona pontuou nesta corrida.'}</Text>
          ) : (
            r.zones.slice(0, 8).map((z) => (
              <View key={z.zoneId} testID={`resumo-zona-${z.zoneId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <TeamBadge faction={z.ownerAfter} size={30} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {z.name}
                  </Text>
                  <Text variant="small" muted>
                    {z.outcome === 'conquered' && official ? 'Zona conquistada' : OUTCOME_LABEL[z.outcome]}, {Math.round(z.meters)} m
                  </Text>
                </View>
                <Text variant="bodyBold" tabular>
                  +{z.rp}
                </Text>
              </View>
            ))
          )}
          {!official && r.zones.length > 0 ? (
            <Text variant="caption" muted>
              Estimativa do aparelho. Os pontos oficiais vêm do servidor.
            </Text>
          ) : null}
        </Surface>
      </Animated.View>

      {reasons.length > 0 ? (
        <Animated.View entering={entering(3)}>
          <Surface style={{ borderWidth: 1, borderColor: colors.line }}>
            <View testID="resumo-trechos-invalidos" style={{ gap: space[2] }}>
              <Text variant="title">Trechos que não contaram</Text>
              {reasons.map((reason) => (
                <Text key={reason} muted>
                  {reason}
                </Text>
              ))}
              {invalidCount > 0 && r.status !== 'rejected' ? (
                <Text variant="small" muted>
                  {invalidCount} trecho{invalidCount > 1 ? 's' : ''} fora da contagem: só os trechos válidos geram pontos.
                </Text>
              ) : null}
            </View>
          </Surface>
        </Animated.View>
      ) : null}

      <View style={{ gap: space[3], marginTop: space[2] }}>
        <Button testID="resumo-compartilhar" label="Compartilhar corrida" icon="share" kind="secondary" wide onPress={share} />
        <Button testID="resumo-concluir" label="Concluir" size="lg" wide onPress={() => (router.canDismiss() ? router.dismissAll() : router.replace('/atividades'))} />
      </View>
      <View style={{ height: radius.sm }} />
    </ScrollView>
  );
}
