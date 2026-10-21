import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { CaptureCelebration, CHALK_TOTAL_MS } from '@/components/capture-celebration';
import { Icon } from '@/components/icon';
import { CountUp, FadeUp, RevealText, Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { DEMO_CENTER } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { invalidReasons } from '@/features/run/summary-model';
import { NeonBackdrop } from '@/features/auth/neon-backdrop';
import { useRunRecord } from '@/features/run/use-run-record';
import { getInvalidStretches } from '@/services/api/track-repo';
import { useGame } from '@/store/game-store';
import { useZones } from '@/store/zones-store';
import { neon } from '@/theme/neon';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const OUTCOME_LABEL = { conquered: 'Conquistada', defended: 'Defendida', influence: 'Mais influência', none: 'Sem pontos' } as const;

/** Resumo da corrida (RF-006, UC-01 passos 9, A1, E1, E2): oficial do servidor ou provisório. */
export function SummaryScreen() {
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

  // A vibração da conquista (§6.2) fica no `CaptureCelebration`, que monta quando o servidor confirma.

  if (record.state === 'loading') {
    return (
      <View testID="tela-resumo" style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: space[6] }}>
        <ActivityIndicator color={colors.text} accessibilityLabel="Carregando" />
        <EmptyState title="Carregando a corrida" body="Buscando o resultado no servidor." />
      </View>
    );
  }

  if (!r) {
    return (
      <View testID="tela-resumo" style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: space[4] }}>
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

  // Momento herói (D-54, peak-end): celebração ou título por palavras → números contando → mapa e zonas em cascata.
  const T = highlight ? CHALK_TOTAL_MS + 400 : 300;
  return (
    <ScreenScroll
      testID="tela-resumo"
      // Neon (D-59): conquista = o fundo herói do login (rota animada); senão, a luz ambiente padrão.
      background={highlight ? <NeonBackdrop /> : undefined}
      footer={<Button testID="resumo-concluir" label="Concluir" size="lg" wide onPress={() => (router.canDismiss() ? router.dismissAll() : router.replace('/atividades'))} />}>
      {highlight ? (
        <Surface style={{ paddingVertical: space[6], alignItems: 'center', borderColor: colors.action, boxShadow: neon.cardGlow }}>
          <View testID="resumo-zona-conquistada" accessible accessibilityLabel={`Zona conquistada, mais ${highlight.rp} RP em ${highlight.name}`}>
            <CaptureCelebration faction={faction} zone={highlight.name} rp={highlight.rp} />
          </View>
        </Surface>
      ) : (
        <RevealText testID="resumo-titulo" variant="headline">
          Corrida concluída
        </RevealText>
      )}

      {banner ? (
        <FadeUp delay={reduced ? 0 : 150}>
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
        </FadeUp>
      ) : null}

      <FadeUp delay={reduced ? 0 : T - 200}>
        <Surface>
          <View testID="resumo-metricas" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space[4] }}>
            <StatCount label="Distância" value={r.meters} format={(n) => formatKm(n)} unit="km" a11y={`${formatKm(r.meters)} quilômetros`} delay={T} />
            <StatCount label="Tempo em movimento" value={r.movingSeconds} format={formatDuration} a11y={`Tempo em movimento ${formatDuration(r.movingSeconds)}`} delay={T + 60} />
            <StatCount
              label="Ritmo médio"
              value={r.avgPace ?? 0}
              from={r.avgPace ? r.avgPace + 120 : 0}
              format={(n) => (r.avgPace ? formatPace(n) : '--:--')}
              unit="/km"
              a11y={`Ritmo médio ${r.avgPace ? formatPace(r.avgPace) : 'indisponível'} por quilômetro`}
              delay={T + 120}
            />
            <StatCount label="Pontos de território" value={r.rpTotal} unit="RP" a11y={`${r.rpTotal} pontos de território`} delay={T + 180} accent />
            <StatCount label="Experiência" value={r.xp} format={(n) => `+${Math.round(n)}`} unit="XP" a11y={`mais ${r.xp} de experiência`} delay={T + 240} accent />
            <StatCount label="Ruas reveladas" value={r.newFogCells} unit="células" a11y={`${r.newFogCells} células reveladas`} delay={T + 300} />
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
      </FadeUp>

      <FadeUp delay={reduced ? 0 : T}>
        <Surface padded={false} style={{ overflow: 'hidden', height: 200 }}>
          <TerritoryMap zones={mapZones} myFaction={faction} center={center} span={1500} path={record.path} invalidPaths={invalidPaths.key === invalidKey ? invalidPaths.paths : undefined} interactive={false} />
        </Surface>
      </FadeUp>

      <FadeUp delay={reduced ? 0 : T + 80}>
        <Surface>
          <Text variant="title" accessibilityRole="header">
            Território
          </Text>
          {r.zones.length === 0 ? (
            <Text muted>{r.status === 'review' || r.status === 'rejected' ? 'Nenhuma zona pontua enquanto a corrida não for aprovada.' : 'Nenhuma zona pontuou nesta corrida. Passe por zonas neutras ou adversárias para ganhar território.'}</Text>
          ) : (
            <Stagger gap={space[3]} delay={reduced ? 0 : T + 160} step={50}>
              {r.zones.slice(0, 8).map((z) => (
                <View key={z.zoneId} testID={`resumo-zona-${z.zoneId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
                  <TeamBadge faction={z.ownerAfter} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyBold" numberOfLines={2}>
                      {z.name}
                    </Text>
                    <Text variant="small" muted>
                      {z.outcome === 'conquered' && official ? 'Zona conquistada' : OUTCOME_LABEL[z.outcome]}, {Math.round(z.meters)} m
                    </Text>
                  </View>
                  <Text variant="bodyBold" tabular color={z.rp > 0 ? colors.accentText : undefined}>
                    +{z.rp}
                  </Text>
                </View>
              ))}
            </Stagger>
          )}
          {!official && r.zones.length > 0 ? (
            <Text variant="caption" muted>
              Estimativa do aparelho. Os pontos oficiais vêm do servidor.
            </Text>
          ) : null}
        </Surface>
      </FadeUp>

      {reasons.length > 0 ? (
        <FadeUp delay={reduced ? 0 : T + 160}>
          <Surface style={{ borderWidth: 1, borderColor: colors.line }}>
            <View testID="resumo-trechos-invalidos" style={{ gap: space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon name="warning" size={20} color={colors.text} />
                <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
                  Trechos que não contaram
                </Text>
              </View>
              {reasons.map((reason) => (
                <Text key={reason}>{reason}</Text>
              ))}
              {invalidCount > 0 && r.status !== 'rejected' ? (
                <Text variant="small" muted>
                  {invalidCount} trecho{invalidCount > 1 ? 's' : ''} fora da contagem (em cinza no mapa): só os trechos válidos geram pontos.
                </Text>
              ) : null}
            </View>
          </Surface>
        </FadeUp>
      ) : null}

      <Button testID="resumo-compartilhar" label="Compartilhar corrida" icon="share" kind="secondary" wide onPress={share} />
    </ScreenScroll>
  );
}

/**
 * Métrica do resumo que conta até o valor (CountUp, algarismos tabulares); duas por linha em qualquer largura.
 * `accent` (neon, D-59): número em laranja com brilho — os pontos do jogo se destacam das métricas de corrida.
 */
function StatCount({
  label,
  value,
  from,
  format,
  unit,
  a11y,
  delay,
  accent,
}: {
  label: string;
  value: number;
  from?: number;
  format?: (n: number) => string;
  unit?: string;
  a11y: string;
  delay: number;
  accent?: boolean;
}) {
  return (
    <View style={{ width: '50%', gap: 2, paddingRight: space[2] }}>
      <Text variant="caption" muted numberOfLines={1}>
        {label}
      </Text>
      <CountUp
        value={value}
        from={from}
        format={format}
        unit={unit}
        variant="headline"
        delay={delay}
        accessibilityLabel={a11y}
        color={accent ? neon.orangeText : undefined}
        style={accent ? { textShadowColor: neon.textGlow.color, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } } : undefined}
      />
    </View>
  );
}
