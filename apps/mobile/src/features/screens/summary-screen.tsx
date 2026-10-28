import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CelebrationSequence, renderCelebrationMoment, type CelebrationEvent } from '@/components/celebration';
import { Icon, type IconName } from '@/components/icon';
import { CountUp, FadeUp, ProgressBar, RevealText, ShimmerSkeleton, Stagger, useReducedMotionSetting } from '@/components/motion';
import { PermissionPrimer } from '@/components/permission-primer';
import { ScreenScroll } from '@/components/screen';
import { StatTile } from '@/components/stat-tile';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import { levelFromXp } from '@/domain/games';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { DEMO_CENTER } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { NeonBackdrop } from '@/features/auth/neon-backdrop';
import { notificationPermissionStatus, requestNotificationPermission, shouldAskNotifications } from '@/features/run/notification-permission';
import { RouteDraw } from '@/features/run/route-draw';
import { ROUTE_DRAW_MS } from '@/features/run/route-draw.math';
import { summaryCelebrations, summaryIntro } from '@/features/run/summary-celebration';
import { invalidReasons, type RunSummary } from '@/features/run/summary-model';
import { useRunRecord } from '@/features/run/use-run-record';
import { getInvalidStretches } from '@/services/api/track-repo';
import { useGame } from '@/store/game-store';
import { useZones } from '@/store/zones-store';
import { neon, neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const OUTCOME_LABEL = { conquered: 'Conquistada', defended: 'Defendida', influence: 'Mais domínio', none: 'Sem pontos' } as const;

/** Ritmo do roteiro (ms): rota → números → conquistas (CelebrationSequence) → nível → Compartilhar. */
const NUMBERS_AT = ROUTE_DRAW_MS + 100;
const NUMBER_STEP = 80;
const COUNT_MS = 900;
const CONQUESTS_AT = NUMBERS_AT + 3 * NUMBER_STEP + COUNT_MS;
/** Altura do palco das conquistas (o maior momento, a zona conquistada, cabe inteiro). */
const CONQUEST_STAGE = 300;
const WEB = process.env.EXPO_OS === 'web';
const renderMoment = renderCelebrationMoment();

const CHIP_ICON: Partial<Record<CelebrationEvent['kind'], IconName>> = { 'zone-captured': 'flag', 'zone-defended': 'shield', xp: 'trophy' };

/** Depois do roteiro: as conquistas viram chips (wireframe 10), uma linha que quebra. */
function ConquestChips({ events }: { events: readonly CelebrationEvent[] }) {
  const { colors } = useTheme();
  return (
    <Stagger testID="resumo-conquistas-lista" gap={space[2]} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {events.map((e) => (
        <View
          key={e.id}
          accessible
          accessibilityLabel={e.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[1],
            minHeight: 36,
            paddingHorizontal: space[3],
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.lineControl,
            backgroundColor: colors.surface,
          }}>
          <Icon name={CHIP_ICON[e.kind] ?? 'check'} size={14} color={colors.accentText} />
          <Text variant="caption" numberOfLines={1}>
            {e.kind === 'zone-captured' ? e.payload.zone : e.kind === 'zone-defended' ? `${e.payload.zone} defendida` : e.kind === 'xp' ? `+${e.payload.gained} XP` : e.label}
          </Text>
        </View>
      ))}
    </Stagger>
  );
}

export type SummaryScreenProps = {
  /** Encaixe do bloco "Recompensas" da E7 (missões, baú, XP da semana). */
  rewards?: ReactNode;
  /** Encaixe do `<ShareButton>` da E8 (card com imagem). Sem ele, compartilha o texto. */
  renderShare?: (ctx: { runId: string; status: RunSummary['status'] | null; onShared?: () => void }) => ReactNode;
};

/**
 * Resumo da corrida (RF-006, UC-01 passos 9, A1, E1, E2): oficial do servidor ou provisório.
 * v2 (T7.2.7): sequência cinematográfica — a rota se desenha, os números contam, as conquistas aparecem uma
 * a uma (com "Pular"), o nível enche e o Compartilhar é a ação primária ("Concluir" vira link).
 */
export function SummaryScreen({ rewards, renderShare }: SummaryScreenProps = {}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotionSetting();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useRunRecord(id);
  const zones = useZones((s) => s.zones);
  const faction = useGame((s) => s.faction) ?? 'striders';
  const xpTotal = useGame((s) => s.xp);
  const center = record.path[Math.floor(record.path.length / 2)] ?? DEMO_CENTER;
  const [details, setDetails] = useState(false);
  const mapZones = useMemo(() => (details ? mapZonesNear(zones, center, 1200) : []), [details, zones, center]);

  const r = record.summary;
  const official = record.state === 'official';
  const conquered = official && r ? r.zones.filter((z) => z.outcome === 'conquered') : [];
  const highlight = conquered[0];
  const events = useMemo(() => (r ? summaryCelebrations(r, official, faction) : []), [r, official, faction]);
  const [sequenceDone, setSequenceDone] = useState(false);
  /** Sem conquista confirmada, o roteiro vai direto ao nível (depois dos números). */
  const done = sequenceDone || events.length === 0;
  // O palco das conquistas sobe por cima da tela depois da rota e dos números (no tempo do roteiro).
  const [stageOn, setStageOn] = useState(false);
  const hasEvents = events.length > 0;
  useEffect(() => {
    if (!hasEvents || sequenceDone) return;
    const t = setTimeout(() => setStageOn(true), reduced ? 0 : CONQUESTS_AT);
    return () => clearTimeout(t);
  }, [hasEvents, sequenceDone, reduced]);

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

  // D-72: a permissão de notificação é pedida depois da 1ª conquista, com a explicação antes.
  const [askNotif, setAskNotif] = useState(false);
  const conqueredCount = conquered.length;
  useEffect(() => {
    if (!done || conqueredCount === 0) return;
    let alive = true;
    void notificationPermissionStatus().then((st) => alive && setAskNotif(shouldAskNotifications(conqueredCount, st) === 'ask'));
    return () => {
      alive = false;
    };
  }, [done, conqueredCount]);

  if (record.state === 'loading') {
    return (
      <View testID="tela-resumo" style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: space[4], gap: space[4] }}>
        <ShimmerSkeleton shape="card" height={180} accessibilityLabel="Carregando a corrida" />
        <ShimmerSkeleton shape="line" lines={3} />
      </View>
    );
  }

  if (!r) {
    return (
      <View testID="tela-resumo" style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: space[4] }}>
        <EmptyState
          title={record.state === 'missing' ? 'Corrida não encontrada' : 'Resultado a caminho'}
          body={record.state === 'missing' ? 'Ela pode ter sido descartada.' : 'O resultado oficial aparece assim que ficar pronto.'}
          action={<Button testID="resumo-ver-atividades" label="Ver atividades" onPress={() => router.replace('/atividades')} />}
        />
      </View>
    );
  }

  const reasons = invalidReasons(r);
  const invalidCount = r.invalidSegments.length;
  const runId = id ?? '';
  const share = () =>
    Share.share({
      message: `Corri ${formatKm(r.meters)} km a ${r.avgPace ? formatPace(r.avgPace) : '--:--'}/km no NOMADE RUN e ${conquered.length ? `conquistei ${conquered.length} zona(s)` : 'pintei o bairro'}.`,
    });

  // 1 linha por estado (F1 §5.5); o porquê fica em "Ver detalhes".
  const banner =
    record.state === 'failed'
      ? { title: 'Não deu para enviar', body: record.error ?? 'O servidor recusou esta corrida.', tone: colors.danger }
      : record.state !== 'official'
        ? { title: 'Provisório', body: 'Confirmamos ao sincronizar.', tone: colors.line }
        : r.status === 'rejected'
          ? { title: 'Corrida rejeitada', body: 'Localização simulada.', tone: colors.danger }
          : r.status === 'review'
            ? { title: 'Em revisão', body: 'Pontua depois da aprovação.', tone: colors.line }
            : null;

  const at = (ms: number) => (reduced ? 0 : ms);
  const lvl = levelFromXp(xpTotal);
  const teamColor = neonTeam[faction];
  const time = formatDuration(r.movingSeconds);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll
        testID="tela-resumo"
        // Neon (D-59): conquista = o fundo herói do login (rota animada); senão, a luz ambiente padrão.
        background={highlight ? <NeonBackdrop /> : undefined}
        footer={
          <View style={{ gap: space[1] }}>
            {renderShare ? renderShare({ runId, status: official ? r.status : null }) : <Button testID="resumo-compartilhar" label="Compartilhar" icon="share" size="lg" wide onPress={share} />}
            <Button testID="resumo-concluir" label="Concluir" kind="ghost" wide onPress={() => (router.canDismiss() ? router.dismissAll() : router.replace('/atividades'))} />
          </View>
        }>
        {highlight ? (
          <View testID="resumo-zona-conquistada" accessible accessibilityRole="header" accessibilityLabel={`Zona conquistada: ${highlight.name}`} style={{ alignItems: 'center', gap: space[1] }}>
            <Text variant="label" color={neon.orangeText} style={{ textTransform: 'uppercase' }}>
              Zona conquistada
            </Text>
            <RevealText variant="headline" align="center" header={false}>
              {highlight.name}
            </RevealText>
          </View>
        ) : (
          <RevealText testID="resumo-titulo" variant="headline">
            Corrida concluída
          </RevealText>
        )}

        {banner ? (
          <FadeUp delay={at(150)}>
            <Surface style={{ borderWidth: 1, borderColor: banner.tone, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View testID={record.state === 'official' ? `resumo-status-${r.status}` : `resumo-status-${record.state}`} accessible accessibilityRole="summary" style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyBold">{banner.title}</Text>
                <Text variant="small" muted numberOfLines={2}>
                  {banner.body}
                </Text>
              </View>
              {record.state === 'provisional' || record.state === 'failed' ? (
                <Button
                  testID="resumo-sincronizar"
                  label={record.retrying ? 'Enviando…' : 'Enviar agora'}
                  kind="secondary"
                  disabled={record.retrying || record.state === 'failed'}
                  onPress={() => void record.retry()}
                />
              ) : null}
            </Surface>
          </FadeUp>
        ) : null}

        {/* 1. A rota se desenha (800 ms), na cor neon do time. */}
        <Surface padded={false} style={{ overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
          <RouteDraw testID="resumo-rota" path={record.path} color={teamColor} height={180} />
        </Surface>

        {/* 2. Os números contam (4 grandes; o resto fica em "Ver detalhes"). */}
        <View testID="resumo-metricas" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <View style={{ flexDirection: 'row', gap: space[2], width: '100%' }}>
            <StatTile
              label="Distância"
              value={formatKm(r.meters)}
              unit="km"
              valueSlot={
                <CountUp value={r.meters} format={(n) => formatKm(n)} variant="headline" delay={at(NUMBERS_AT)} duration={COUNT_MS} accessibilityLabel={`${formatKm(r.meters)} quilômetros`} />
              }
            />
            <StatTile
              label="Tempo"
              value={time}
              valueSlot={
                <CountUp
                  value={r.movingSeconds}
                  format={formatDuration}
                  variant="headline"
                  delay={at(NUMBERS_AT + NUMBER_STEP)}
                  duration={COUNT_MS}
                  accessibilityLabel={`Tempo em movimento ${time}`}
                />
              }
            />
          </View>
          <View style={{ flexDirection: 'row', gap: space[2], width: '100%' }}>
            <StatTile
              label="Ritmo"
              value={r.avgPace ? formatPace(r.avgPace) : '--:--'}
              unit="/km"
              valueSlot={
                <CountUp
                  value={r.avgPace ?? 0}
                  from={r.avgPace ? r.avgPace + 120 : 0}
                  format={(n) => (r.avgPace ? formatPace(n) : '--:--')}
                  variant="headline"
                  delay={at(NUMBERS_AT + 2 * NUMBER_STEP)}
                  duration={COUNT_MS}
                  accessibilityLabel={`Ritmo médio ${r.avgPace ? formatPace(r.avgPace) : 'indisponível'} por quilômetro`}
                />
              }
            />
            <StatTile
              label="Território"
              value={`+${r.rpTotal}`}
              unit="pts"
              accent={neon.orangeText}
              valueSlot={
                <CountUp
                  value={r.rpTotal}
                  format={(n) => `+${Math.round(n)}`}
                  variant="headline"
                  color={neon.orangeText}
                  delay={at(NUMBERS_AT + 3 * NUMBER_STEP)}
                  duration={COUNT_MS}
                  accessibilityLabel={`mais ${r.rpTotal} pontos de território`}
                />
              }
            />
          </View>
          {record.simulated ? (
            <Text variant="caption" muted>
              Corrida simulada (demonstração).
            </Text>
          ) : null}
          {r.beatGhost !== null ? <Text variant="bodyBold">{r.beatGhost ? 'Você venceu o fantasma.' : 'O fantasma venceu desta vez.'}</Text> : null}
        </View>

        {/* 3. As conquistas, uma a uma (E5): só o que o servidor confirmou. "Pular" leva tudo ao fim. */}
        {/* 3. As conquistas tocam no palco por cima da tela (abaixo); no fim, ficam aqui como chips. */}
        {events.length > 0 && sequenceDone ? <ConquestChips events={events} /> : null}

        {/* 4. O nível (XP do servidor) enche depois das conquistas. */}
        {done ? (
          <FadeUp delay={at(events.length ? 0 : CONQUESTS_AT)}>
            <Surface style={{ gap: space[2] }}>
              <View testID="resumo-nivel" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <TeamBadge faction={faction} size={32} />
                <Text variant="title" style={{ flex: 1 }}>
                  Nível {lvl.level}
                </Text>
                {r.xp > 0 ? (
                  <Text variant="bodyBold" tabular color={neon.orangeText}>
                    +{r.xp} XP
                  </Text>
                ) : null}
              </View>
              <ProgressBar
                value={lvl.needed > 0 ? lvl.intoLevel / lvl.needed : 0}
                color={factions[faction].color}
                ghost={false}
                height={10}
                delay={at(150)}
                accessibilityLabel={`${lvl.intoLevel} de ${lvl.needed} XP para o nível ${lvl.level + 1}`}
              />
            </Surface>
          </FadeUp>
        ) : null}

        {/* Encaixe do bloco "Recompensas" da E7 (missões, baú, semana). */}
        {done && rewards ? <FadeUp delay={at(200)}>{rewards}</FadeUp> : null}

        <Button testID="resumo-detalhes" label={details ? 'Esconder detalhes' : 'Ver detalhes'} kind="ghost" icon="route" onPress={() => setDetails((d) => !d)} />

        {details ? (
          <Stagger gap={space[4]}>
            <Surface padded={false} style={{ overflow: 'hidden', height: 200 }}>
              <TerritoryMap
                zones={mapZones}
                myFaction={faction}
                center={center}
                span={1500}
                path={record.path}
                pathColor={teamColor}
                invalidPaths={invalidPaths.key === invalidKey ? invalidPaths.paths : undefined}
                interactive={false}
              />
            </Surface>
            <Surface>
              <Text variant="title" accessibilityRole="header">
                Território
              </Text>
              {r.zones.length === 0 ? (
                <Text muted>{r.status === 'review' || r.status === 'rejected' ? 'Nada pontua antes da aprovação.' : 'Nenhuma zona pontuou desta vez.'}</Text>
              ) : (
                r.zones.slice(0, 8).map((z) => (
                  <View key={z.zoneId} testID={`resumo-zona-${z.zoneId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
                    <TeamBadge faction={z.ownerAfter} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyBold" numberOfLines={2}>
                        {z.name}
                      </Text>
                      <Text variant="small" muted>
                        {OUTCOME_LABEL[z.outcome]}, {Math.round(z.meters)} m
                      </Text>
                    </View>
                    <Text variant="bodyBold" tabular color={z.rp > 0 ? colors.accentText : undefined}>
                      +{z.rp}
                    </Text>
                  </View>
                ))
              )}
              {!official && r.zones.length > 0 ? (
                <Text variant="caption" muted>
                  Estimativa do aparelho.
                </Text>
              ) : null}
              <Text variant="small" muted>
                +{r.xp} XP · {r.newFogCells} ruas novas no Atlas
              </Text>
            </Surface>
            {reasons.length > 0 || r.review ? (
              <Surface style={{ borderWidth: 1, borderColor: colors.line }}>
                <View testID="resumo-trechos-invalidos" style={{ gap: space[2] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Icon name="warning" size={20} color={colors.text} />
                    <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
                      Por que não contou
                    </Text>
                  </View>
                  {r.review ? <Text>{r.review.message}</Text> : null}
                  {reasons.map((reason) => (
                    <Text key={reason}>{reason}</Text>
                  ))}
                  {invalidCount > 0 && r.status !== 'rejected' ? (
                    <Text variant="small" muted>
                      {invalidCount} trecho{invalidCount > 1 ? 's' : ''} em cinza no mapa.
                    </Text>
                  ) : null}
                </View>
              </Surface>
            ) : null}
          </Stagger>
        ) : null}
      </ScreenScroll>
      {stageOn && !sequenceDone && r ? (
        // Palco cinematográfico: um momento por vez, centralizado, com "Pular" (E5). Toque na área adianta.
        <FadeUp distance={0} duration={200} style={{ position: 'absolute', inset: 0 }}>
          <View
            style={{ flex: 1, justifyContent: 'center', paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[4], paddingHorizontal: space[4], backgroundColor: 'rgba(7,7,8,0.9)' }}>
            <CelebrationSequence
              testID="resumo-conquistas"
              events={events}
              layout="single"
              // react-native-web responde sempre "leitor de tela ligado" (`isScreenReaderEnabled` → true), o que
              // pularia o roteiro inteiro na web. Pedido à E5: tratar isso dentro do CelebrationSequence.
              screenReader={WEB ? false : undefined}
              intro={summaryIntro(formatKm(r.meters), formatDuration(r.movingSeconds))}
              renderMoment={(m, ctx) => <View style={{ minHeight: CONQUEST_STAGE, justifyContent: 'center' }}>{renderMoment(m, ctx)}</View>}
              onDone={() => setSequenceDone(true)}
            />
          </View>
        </FadeUp>
      ) : null}
      {askNotif ? (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <PermissionPrimer
            testID="resumo-avisos"
            icon="bell"
            title="Saiba quando atacarem"
            body="Avisamos quando um rival entrar na sua zona."
            ctaLabel="Ativar avisos"
            footnote="Dá para desligar quando quiser."
            onPress={() => {
              setAskNotif(false);
              void requestNotificationPermission();
            }}
            secondaryLabel="Agora não"
            onSecondary={() => setAskNotif(false)}
          />
        </View>
      ) : null}
    </View>
  );
}
