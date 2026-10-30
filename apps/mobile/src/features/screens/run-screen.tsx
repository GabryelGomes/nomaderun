import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Switch, useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModeIcon, type ModeIconKind } from '@/components/art';
import { Button, IconButton } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { useDemoSealSpace } from '@/components/demo-badge';
import { RewardToast } from '@/components/celebration';
import { FadeUp, haptic, PressableScale, ProgressBar, ProgressRing, RevealText, ScreenEnter, ShimmerSkeleton, Stagger } from '@/components/motion';
import { Screen, ScreenScroll } from '@/components/screen';
import { TeamBadge } from '@/components/team-badge';
import { HoldButton } from '@/components/hold-button';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import { ghostStatus } from '@/domain/games';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { isUnderAttackAt } from '@/domain/territory';
import { DEMO_CENTER, zoneName } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { readableBackground } from '@/features/run/banner-color';
import { anchorFromKey, hudFor, mapAnchorKey } from '@/features/run/live-hud';
import { loadSafetyContacts } from '@/features/run/run-controller';
import { timeFontSize, TickerText } from '@/features/run/ticker-text';
import { useGpsPreflight } from '@/features/run/use-gps-preflight';
import { bootstrapOfflineSync } from '@/features/run/use-offline-sync';
import { useRunSession, type RunMode } from '@/features/run/use-run-session';
import { useRunSafety } from '@/features/safety/use-run-safety';
import { useNow } from '@/features/use-now';
import { bboxAround } from '@/services/api/zones-repo';
import { isDemoActive } from '@/services/demo-mode';
import { accessMessage, openAppSettings } from '@/services/location/permissions';
import { WEAK_ACCURACY_M } from '@/services/location/signal';
import { useGame, type MissionId } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
import { cssEasings, durations } from '@/theme/motion';
import { factions, floating, palette, radius, space } from '@/theme/tokens';
import { neon, neonTeam } from '@/theme/neon';
import { useTheme } from '@/theme/use-theme';

// D-74: 1 linha curta por modo. UX-08: "Modo" (missão é tarefa, modo é jogo) e os ícones da Arena (`ModeIcon`, E4).
const MODES: { id: MissionId; title: string; body: string; art: ModeIconKind }[] = [
  { id: 'livre', title: 'Corrida livre', body: 'Corra e pinte a cidade.', art: 'dominio' },
  { id: 'fuga', title: 'Fuga', body: 'Vença o seu fantasma.', art: 'fuga' },
  { id: 'caca', title: 'Caça', body: 'Abra baús a 25 m.', art: 'caca' },
];

/** Fecha a Nova corrida; aberta por link (`/correr`, `/corrida`) sem tela embaixo, volta ao Mapa. */
function closeRun() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Ritmos do fantasma oferecidos na Fuga (s/km). */
const GHOST_PACES = [300, 330, 360, 420];

/** Pre-run choices: mission, signal source and Corrida Segura. Then the session starts. */
export function RunScreen() {
  const { colors } = useTheme();
  const mission = useGame((s) => s.mission);
  const setMission = useGame((s) => s.setMission);
  const ghostPace = useGame((s) => s.ghostPace);
  const setGhostPace = useGame((s) => s.setGhostPace);
  const escortOn = useGame((s) => s.escortOn);
  const toggleEscort = useGame((s) => s.toggleEscort);
  const stopAlertOn = useGame((s) => s.stopAlertOn);
  const toggleStopAlert = useGame((s) => s.toggleStopAlert);
  const contacts = useGame((s) => s.contacts);
  const [mode, setMode] = useState<RunMode | null>(null);
  // D-76: o GPS real é o padrão. A simulação só existe no modo demonstração (E10: `isDemoActive`).
  const demo = isDemoActive();
  const [source, setSource] = useState<RunMode>('gps');
  const [checkingGps, setCheckingGps] = useState(false);

  useEffect(() => {
    void loadSafetyContacts();
    // Garante a fila/sync ligados mesmo antes do layout raiz montar `useOfflineSync`.
    const userId = useSession.getState().session?.userId;
    if (userId) void bootstrapOfflineSync(userId);
  }, []);

  if (mode) return <ActiveRun mode={mode} />;
  if (checkingGps)
    return (
      <GpsPreflight
        onReady={() => setMode('gps')}
        onSimulate={
          demo
            ? () => {
                setSource('simulacao');
                setCheckingGps(false);
                setMode('simulacao');
              }
            : undefined
        }
        onCancel={() => setCheckingGps(false)}
      />
    );

  // CTA fixo na zona do polegar; o ScreenScroll reserva o espaço dele (o botão não cobre mais a Corrida Segura).
  return (
    <ScreenScroll
      testID="tela-nova-corrida"
      footer={
        <Button
          testID="corrida-comecar"
          label="Começar"
          icon="play"
          size="lg"
          wide
          onPress={() => {
            haptic('impact');
            if (source === 'gps' || !demo) setCheckingGps(true);
            else setMode(source);
          }}
        />
      }>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
        <RevealText testID="corrida-titulo" style={{ flex: 1 }}>
          Nova corrida
        </RevealText>
        <IconButton testID="corrida-fechar" icon="close" label="Fechar" tone="sunken" size={44} onPress={closeRun} />
      </View>

      <ScreenEnter delay={120} style={{ gap: space[4] }}>
        <Text variant="title" accessibilityRole="header">
          Modo
        </Text>
        <Stagger gap={space[2]} delay={80}>
          {MODES.map((m) => {
            const on = mission === m.id;
            return (
              <PressableScale
                key={m.id}
                testID={`corrida-missao-${m.id}`}
                accessibilityLabel={m.title}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                hitSlop={0}
                onPress={() => setMission(m.id)}
                style={{
                  flexDirection: 'row',
                  gap: space[3],
                  alignItems: 'center',
                  padding: space[4],
                  borderRadius: radius.lg,
                  borderCurve: 'continuous',
                  backgroundColor: colors.surface,
                  borderWidth: 2,
                  // Selecionado aceso em neon (D-59).
                  borderColor: on ? colors.action : 'transparent',
                  boxShadow: on ? neon.cardGlow : undefined,
                }}>
                <ModeIcon kind={m.art} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyBold">{m.title}</Text>
                  <Text variant="small" muted>
                    {m.body}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </Stagger>

        {mission === 'fuga' ? (
          <FadeUp style={{ gap: space[2] }}>
            <Text variant="caption" muted>
              Ritmo do fantasma
            </Text>
            <ChipRow
              testID="corrida-fantasma"
              accessibilityLabel="Ritmo do fantasma"
              size="md"
              tabular
              value={String(ghostPace)}
              onChange={(v) => setGhostPace(Number(v))}
              options={GHOST_PACES.map((p) => ({ key: String(p), label: `${formatPace(p)} /km`, accessibilityLabel: `Fantasma a ${formatPace(p)} por quilômetro` }))}
            />
          </FadeUp>
        ) : null}

        {demo ? (
          <>
            <Text variant="title" accessibilityRole="header" style={{ marginTop: space[2] }}>
              Sinal
            </Text>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              {(
                [
                  ['gps', 'GPS real', 'Use na rua'],
                  ['simulacao', 'Simulação (demonstração)', 'Volta no parque em 10×'],
                ] as const
              ).map(([key, title, body]) => (
                <PressableScale
                  key={key}
                  testID={`corrida-sinal-${key}`}
                  accessibilityLabel={title}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: source === key }}
                  hitSlop={0}
                  onPress={() => setSource(key)}
                  containerStyle={{ flex: 1 }}
                  style={{
                    flexGrow: 1,
                    minHeight: 56,
                    padding: space[4],
                    gap: 2,
                    borderRadius: radius.lg,
                    borderCurve: 'continuous',
                    backgroundColor: colors.surface,
                    borderWidth: 2,
                    borderColor: source === key ? colors.action : 'transparent',
                    boxShadow: source === key ? neon.cardGlow : undefined,
                  }}>
                  <Text variant="bodyBold">{title}</Text>
                  <Text variant="caption" muted>
                    {body}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </>
        ) : null}

        {/* UX-12: um nome só, "Corrida Segura", com as 2 opções (as mesmas dos Ajustes). */}
        <Text variant="title" accessibilityRole="header" style={{ marginTop: space[2] }}>
          Corrida Segura
        </Text>
        <View style={{ borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' }}>
          <SafetyToggle
            testID="corrida-escolta"
            icon="location"
            title="Compartilhar ao vivo"
            body={contacts.length === 0 ? 'Adicione alguém de confiança.' : escortOn ? `${contacts.join(' e ')} veem onde você está.` : 'Seus contatos veem onde você está.'}
            value={escortOn}
            onChange={toggleEscort}
          />
          <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: space[4] }} />
          <SafetyToggle testID="corrida-alerta-parada" icon="timer" title="Avisar se eu parar" body="Parado 10 min, avisamos seus contatos." value={stopAlertOn} onChange={toggleStopAlert} />
        </View>
        <Button testID="corrida-contatos" label="Contatos de segurança" kind="ghost" wide onPress={() => router.push('/contatos-seguranca')} />
      </ScreenEnter>
    </ScreenScroll>
  );
}

/** Opção da Corrida Segura: ícone, nome, 1 frase e o interruptor (alvo da linha inteira ≥ 44 pt). */
function SafetyToggle({ testID, icon, title, body, value, onChange }: { testID: string; icon: IconName; title: string; body: string; value: boolean; onChange: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], minHeight: 64 }}>
      <Icon name={icon} size={22} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{title}</Text>
        <Text variant="small" muted>
          {body}
        </Text>
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} accessibilityLabel={`Corrida Segura: ${title}`} trackColor={{ true: colors.action, false: colors.lineControl }} />
    </View>
  );
}

function ActiveRun({ mode }: { mode: RunMode }) {
  // E10 (onda 4): na demonstração, a faixa do território e os avisos descem a altura do selo "Demonstração".
  const safeInsets = useSafeAreaInsets();
  const sealSpace = useDemoSealSpace();
  const insets = { ...safeInsets, top: safeInsets.top + sealSpace };
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const s = useRunSession(mode);
  const now = useNow(5000);
  const zones = useZones((st) => st.zones);
  const zoneMeta = useZones((st) => st.meta);
  const faction = useGame((st) => st.faction) ?? 'striders';
  const safety = useRunSafety({ position: s.position, active: s.phase === 'running' || s.phase === 'paused' });
  const [finishError, setFinishError] = useState<string | null>(null);

  // Regiões do mapa: a âncora só muda ao cruzar a grade de ~500 m, então a suavização das zonas não é
  // refeita a cada ponto de GPS (só quando as zonas ou a âncora mudam).
  const anchorKey = mapAnchorKey(s.position ?? DEMO_CENTER);
  const mapZones = useMemo(() => mapZonesNear(zones, anchorFromKey(anchorKey), 1600), [zones, anchorKey]);
  // Zonas em volta da corrida: carga por área a cada troca de âncora (~500 m), não a cada ponto.
  useEffect(() => {
    void useZones.getState().loadBbox(bboxAround(anchorFromKey(anchorKey), 2000));
  }, [anchorKey]);

  // Zona atual: a da previsão ao vivo (E3) quando houver; senão a do motor da corrida.
  const zoneId = s.live.current?.zoneId ?? s.run.currentZone;
  const zone = zoneId ? zones[zoneId] : undefined;
  const owner = s.live.current ? s.live.current.owner : (zone?.owner ?? null);
  const rival = owner !== null && owner !== faction;
  const defending = !!zone && owner === faction && isUnderAttackAt(zone, now);
  // Faixa "Defendendo" amarela (ERS, QA-12): texto escuro sobre o amarelo para manter o contraste.
  const bannerInk = rival ? factions[owner!].onColor : defending ? palette.ink : palette.white;
  const hud = hudFor(s.live.current, faction, s.live.conquered);

  // Uma vibração de aviso ao entrar em zona rival, no mesmo quadro da faixa.
  const lastRival = useRef<string | null>(null);
  useEffect(() => {
    if (rival && zoneId && lastRival.current !== zoneId) {
      lastRival.current = zoneId;
      haptic('warning');
    }
    if (!rival) lastRival.current = null;
  }, [rival, zoneId]);

  // Segurou 600 ms: grava o fim, envia o que falta e abre o resumo (oficial ou provisório, UC-01 A1).
  const finish = async () => {
    const out = await s.finish();
    if (!out.run) {
      setFinishError('A corrida foi curta demais para ser salva (menos de 2 pontos de GPS).');
      return;
    }
    router.replace({ pathname: '/resumo', params: { id: out.run.id } });
  };

  const ghost = s.ghost !== null ? ghostStatus(s.ghost) : null;

  if (s.phase === 'countdown') return <Countdown count={s.count} />;
  const zoneLabel = zoneId ? (zoneMeta[zoneId]?.name ?? zoneName(zoneId)) : null;

  const timeText = formatDuration(s.elapsed);
  const bannerOn = rival || defending;
  const toast = s.toasts[0] ?? null;

  // Layout (RNF-015, 360×640): o painel tem a altura do conteúdo e o mapa fica com o resto. Nada de
  // reticências nos números: 3 métricas (tempo ≥ 72 pt, distância e ritmo em 48 pt); controles ≥ 56 pt
  // na zona do polegar, acima da área segura; SOS sempre visível no mapa, abaixo do entalhe.
  return (
    <View testID="tela-corrida" style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, minHeight: 160 }}>
        <TerritoryMap
          zones={mapZones}
          myFaction={faction}
          center={s.position ?? DEMO_CENTER}
          span={900}
          user={s.position}
          path={s.path}
          pathVersion={s.pathVersion}
          // "A cidade pinta": o rastro sai na cor neon do time (D-70), nunca em hexágonos.
          pathColor={neonTeam[faction]}
          chests={s.chests}
          followUser
          interactive={false}
        />
        <Animated.View
          testID="corrida-faixa-territorio"
          // Escondida (opacidade 0) não pode ser lida pelo leitor de tela (QA-18).
          accessibilityLiveRegion={bannerOn ? 'polite' : 'none'}
          aria-hidden={!bannerOn}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + space[2],
            left: space[4],
            right: space[4],
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[3],
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: rival ? readableBackground(factions[owner!].color, bannerInk) : defending ? palette.warning : colors.surface,
            boxShadow: floating,
            // ERS §6.2: entra de cima em ≤ 3 s (power3.out, 300 ms). Reduzir movimento: só opacidade.
            opacity: bannerOn ? 1 : 0,
            transform: [{ translateY: bannerOn || reduced ? 0 : -(insets.top + 72) }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: bannerOn ? durations.state : durations.quick,
            transitionTimingFunction: bannerOn ? cssEasings.enter : cssEasings.standard,
          }}>
          {/* UX-13: o emblema do dono da zona (informação neutra), não o ícone de alerta. */}
          {rival ? <TeamBadge faction={owner} size={32} /> : <Icon name="shield" size={24} color={bannerInk} />}
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" color={bannerInk} numberOfLines={2}>
              {defending ? 'Defendendo sua zona' : rival ? `Zona dos ${factions[owner!].name}` : ''}
            </Text>
            <Text variant="caption" color={bannerInk}>
              {defending ? 'Seus pontos valem em dobro aqui' : rival ? 'Corra aqui para ajudar seu time' : ''}
            </Text>
          </View>
        </Animated.View>
        {toast ? (
          // Avisos de recompensa ao vivo (E5): pequeno ou médio, sem partículas (o GPS vem primeiro).
          <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + (bannerOn ? 72 : 0), left: space[4], right: space[4] }}>
            <RewardToast
              key={toast.id}
              testID="corrida-aviso"
              size={toast.size}
              placement="top"
              particles={false}
              edgeGlow={toast.edgeGlow}
              haptics={toast.haptics}
              color={neonTeam[toast.faction]}
              title={toast.title}
              subtitle={toast.subtitle}
              onDone={() => s.dismissToast(toast.id)}
            />
          </View>
        ) : null}
        <View
          style={{ position: 'absolute', bottom: space[6] + space[3], left: space[4], right: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
          <Pressable
            testID="corrida-escolta-alternar"
            accessibilityRole="switch"
            accessibilityState={{ checked: safety.escortOn }}
            accessibilityLabel={
              safety.escortOn ? 'Corrida Segura ligada: compartilhando ao vivo. Toque para desligar' : 'Corrida Segura desligada. Toque para compartilhar sua localização ao vivo'
            }
            onPress={safety.toggleEscort}
            hitSlop={12}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.surface,
              paddingHorizontal: space[3],
              height: 32,
              borderRadius: radius.pill,
              boxShadow: floating,
              opacity: safety.escortOn ? 1 : 0.85,
            }}>
            <Icon name="shield" size={14} color={colors.text} />
            <Text variant="caption">{safety.escortOn ? 'Corrida Segura ligada' : 'Corrida Segura desligada'}</Text>
          </Pressable>
          <IconButton testID="corrida-sos" icon="sos" label="SOS: avisar meus contatos" tone="danger" size={56} onPress={() => void safety.sos()} />
        </View>
      </View>

      <View
        style={{
          marginTop: -space[6],
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: 'continuous',
          paddingHorizontal: space[4],
          paddingTop: space[3],
          paddingBottom: insets.bottom + space[3],
          gap: space[3],
        }}>
        <View style={{ gap: space[1] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[2] }}>
            <Text variant="caption" muted>
              {mode === 'simulacao' ? 'Simulação (demonstração)' : 'GPS'}
              {s.run.autoPaused ? '  Pausa automática' : s.phase === 'paused' ? '  Pausada' : ''}
            </Text>
            <Text variant="caption" muted>
              {MODES.find((m) => m.id === s.mission)?.title}
            </Text>
          </View>
          <TickerText testID="corrida-tempo" variant="hero" animate={mode === 'gps'} value={timeText} fontSize={timeFontSize(timeText)} accessibilityLabel={`Tempo ${timeText}`} />
          <View style={{ flexDirection: 'row' }}>
            <Metric animate={mode === 'gps'} testID="corrida-metrica-km" label="km" value={formatKm(s.run.meters)} a11y={`${formatKm(s.run.meters)} quilômetros`} />
            <Metric animate={mode === 'gps'} testID="corrida-metrica-ritmo" label="ritmo /km" value={formatPace(s.pace)} a11y={`Ritmo ${formatPace(s.pace)} por quilômetro`} />
          </View>
        </View>

        <View
          testID="corrida-zona"
          style={{ gap: space[2], paddingHorizontal: space[3], paddingVertical: space[3], borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: colors.surfaceSunken }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            {hud.kind === 'gap' ? (
              <ProgressRing
                testID="corrida-anel"
                value={hud.progress}
                size={52}
                stroke={6}
                color={neonTeam[faction]}
                pulseAt={[0.25, 0.5, 0.75]}
                accessibilityLabel={`${Math.round(hud.progress * 100)}% para conquistar`}>
                <Text variant="caption" tabular>
                  {Math.round(hud.progress * 100)}%
                </Text>
              </ProgressRing>
            ) : (
              <TeamBadge faction={hud.kind === 'searching' ? owner : faction} size={40} attack={!!zone && isUnderAttackAt(zone, now)} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyBold" numberOfLines={1}>
                {zoneLabel ?? 'Procurando sinal'}
              </Text>
              <Text variant="small" muted numberOfLines={2} accessibilityLiveRegion="polite" testID="corrida-zona-status">
                {/* E-01: previsão do aparelho com a regra de pintura (E3); quem decide é o servidor. */}
                {hud.kind === 'conquered'
                  ? 'Conquista provável: confirma no fim'
                  : hud.kind === 'mine'
                    ? 'Seu time: cada rua reforça'
                    : hud.kind === 'gap'
                      ? `Faltam ~${hud.gapMeters} m para conquistar`
                      : 'Corra para pintar'}
              </Text>
            </View>
          </View>
          {s.ghost !== null ? (
            // Ícone do fantasma + 2 palavras; o leitor de tela recebe a frase inteira.
            <View
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={ghost === 'ahead' ? `${Math.round(s.ghost)} metros à frente do fantasma` : ghost === 'tied' ? 'Lado a lado com o fantasma' : `Fantasma ${Math.round(-s.ghost)} metros à frente`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name="ghost" size={16} color={ghost === 'caught' ? colors.textSecondary : neonTeam[faction]} />
              <Text variant="small">{ghost === 'ahead' ? `Você +${Math.round(s.ghost)} m` : ghost === 'tied' ? 'Lado a lado' : `Fantasma +${Math.round(-s.ghost)} m`}</Text>
            </View>
          ) : null}
          {s.mission === 'caca' ? (
            <Text variant="small">
              {s.chestToast
                ? `Baú ${s.chestToast.rarity === 'lendario' ? 'lendário' : s.chestToast.rarity}: +${s.chestToast.xp} XP`
                : s.nearestChest
                  ? `Baú a ${Math.round(s.nearestChest.meters)} m`
                  : 'Procurando baús'}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around' }}>
          <View style={{ width: 88, alignItems: 'center', paddingTop: 10 }}>
            <IconButton testID="corrida-voz" icon={s.voice ? 'speaker' : 'mute'} label={s.voice ? 'Silenciar Guia' : 'Ativar Guia'} tone="sunken" size={56} onPress={s.toggleVoice} />
          </View>
          <HoldButton testID="corrida-encerrar" label="Segure para encerrar" onConfirm={finish} />
          <View style={{ width: 88, alignItems: 'center', paddingTop: 6 }}>
            <IconButton
              testID="corrida-pausar"
              icon={s.phase === 'paused' ? 'play' : 'pause'}
              label={s.phase === 'paused' ? 'Retomar corrida' : 'Pausar corrida'}
              tone="action"
              size={64}
              onPress={s.phase === 'paused' ? s.resume : s.pause}
            />
          </View>
        </View>
      </View>

      {safety.notice ? (
        <Pressable
          testID="corrida-aviso-seguranca"
          accessibilityRole="alert"
          accessibilityLabel={`${safety.notice.result.message} Toque para fechar o aviso.`}
          onPress={safety.dismissNotice}
          style={{
            position: 'absolute',
            top: insets.top + space[2],
            left: space[4],
            right: space[4],
            backgroundColor: safety.notice.kind === 'escort' ? colors.surface : colors.danger,
            padding: space[4],
            borderRadius: radius.lg,
            gap: 2,
            boxShadow: floating,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="bodyBold" color={safety.notice.kind === 'escort' ? colors.text : colors.onDanger} style={{ flex: 1 }}>
              {safety.notice.kind === 'sos' ? 'SOS com sua localização' : safety.notice.kind === 'stop' ? 'Aviso de parada enviado' : 'Localização compartilhada ao vivo'}
            </Text>
            {/* O "x" substitui o "Toque para fechar." (o aviso inteiro fecha no toque). */}
            <Icon name="close" size={18} color={safety.notice.kind === 'escort' ? colors.text : colors.onDanger} />
          </View>
          <Text variant="small" color={safety.notice.kind === 'escort' ? colors.text : colors.onDanger}>
            {safety.notice.result.message}
          </Text>
        </Pressable>
      ) : null}
      {safety.asking ? (
        <View
          testID="corrida-alerta-parada"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={{
            position: 'absolute',
            left: space[4],
            right: space[4],
            top: insets.top + 80,
            backgroundColor: colors.surface,
            padding: space[6],
            borderRadius: radius.lg,
            gap: space[3],
            boxShadow: floating,
          }}>
          <Text variant="title">Está tudo bem?</Text>
          <Text muted>Parado há 10 min: sem resposta em {safety.asking.secondsLeft} s, seus contatos recebem sua localização.</Text>
          <Button testID="corrida-alerta-estou-bem" label="Estou bem" icon="check" size="lg" wide onPress={() => safety.confirmOk()} />
        </View>
      ) : null}
      {s.phase === 'finishing' ? (
        <View
          testID="corrida-finalizando"
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6] }}>
          <ShimmerSkeleton shape="circle" width={56} height={56} accessibilityLabel="Enviando" />
          <Text variant="title">Enviando sua corrida…</Text>
          <Text muted style={{ textAlign: 'center' }}>
            Sem internet, enviamos depois.
          </Text>
        </View>
      ) : null}
      {finishError ? (
        <View
          style={{
            position: 'absolute',
            left: space[4],
            right: space[4],
            bottom: insets.bottom + space[4],
            backgroundColor: colors.surface,
            padding: space[4],
            borderRadius: radius.lg,
            gap: space[3],
            boxShadow: floating,
          }}>
          <Text variant="bodyBold">{finishError}</Text>
          <Button testID="corrida-curta-fechar" label="Fechar" wide onPress={closeRun} />
        </View>
      ) : null}
      {s.error ? (
        <View style={{ position: 'absolute', top: insets.top + 80, left: space[4], right: space[4], backgroundColor: colors.surface, padding: space[4], borderRadius: radius.lg, boxShadow: floating }}>
          <Text variant="bodyBold">{s.error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const METRIC_PT = 48;

function Metric({ label, value, a11y, testID, animate }: { label: string; value: string; a11y: string; testID: string; animate: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {/* RNF-015: métricas com pelo menos 48 pt e algarismos tabulares, sem encolher para caber (QA-12). */}
      <TickerText testID={testID} value={value} fontSize={METRIC_PT} animate={animate} accessibilityLabel={a11y} />
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

/** ERS §6.2: cada número da contagem fica 0,8 s na tela (o tempo vem de `useRunSession`). */
export const COUNTDOWN_STEP_MS = 800;

/**
 * Contagem 3-2-1 em tela cheia (ERS §6.2): o número enorme sobe de dentro de uma máscara (expo.out) e
 * a barrinha do número atual enche em 0,8 s; vibração leve em cada número (no hook). Reduzir movimento:
 * o número só aparece (opacidade) e a barra fica cheia.
 */
function Countdown({ count }: { count: number }) {
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  // D-75: texto escuro sobre o laranja (7:1); antes era branco (2,9:1).
  const ink = colors.onAction;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = Math.round(Math.min(width * 0.62, height * 0.42, 280));
  const label = count > 0 ? String(count) : 'Vai!';
  return (
    <View
      testID="corrida-contagem"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={count > 0 ? `Começa em ${count}` : 'Vai!'}
      style={{ position: 'absolute', inset: 0, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center', gap: space[4], paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ height: size, overflow: 'hidden', justifyContent: 'center' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View
          key={count}
          style={{
            animationName: reduced ? { from: { opacity: 0 }, to: { opacity: 1 } } : { from: { transform: [{ translateY: size }] }, to: { transform: [{ translateY: 0 }] } },
            animationDuration: reduced ? durations.reducedFade : durations.screen,
            animationTimingFunction: reduced ? cssEasings.standard : cssEasings.reveal,
            animationFillMode: 'both',
          }}>
          <Text variant="hero" tabular color={ink} style={{ fontSize: count > 0 ? size : size * 0.45, lineHeight: size, letterSpacing: -4, textAlign: 'center' }}>
            {label}
          </Text>
        </Animated.View>
      </View>
      <Text variant="lead" color={ink}>
        Prepare-se
      </Text>
      <View style={{ flexDirection: 'row', gap: space[2] }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {[3, 2, 1].map((n) => (
          // Barrinha de cada número: `ProgressBar` só com transform (enche em 0,8 s; antes animava `width`).
          <View key={n} style={{ width: 40 }}>
            <ProgressBar
              key={n === count ? `agora-${count}` : n > count ? 'cheia' : 'vazia'}
              value={n >= count ? 1 : 0}
              from={n > count ? 1 : 0}
              color={ink}
              trackColor="rgba(7,7,8,0.22)"
              ghost={false}
              height={4}
              duration={COUNTDOWN_STEP_MS}
              accessibilityLabel={`Número ${n}`}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * GPS real: permissão com explicação antes do pedido, GPS desligado, negado de vez (Ajustes) e
 * sinal fraco por mais de 15 s com "iniciar mesmo assim" (UC-01 passo 2 e E3, RNF-013).
 */
function GpsPreflight({ onReady, onSimulate, onCancel }: { onReady: () => void; onSimulate?: () => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const pf = useGpsPreflight(true);
  const ready = pf.step.kind === 'ready';
  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);

  const step = pf.step;
  let title = 'Verificando o GPS';
  let body = 'Só um instante.';
  let actions: ReactNode = null;
  if (step.kind === 'access') {
    const a = step.access;
    body = accessMessage(a) ?? body;
    if (a.status === 'undetermined') {
      title = 'Localização durante a corrida';
      actions = <Button testID="gps-permitir" label="Permitir localização" icon="location" size="lg" wide onPress={() => void pf.request()} />;
    } else if (a.status === 'denied') {
      title = 'Sem acesso à localização';
      actions = (
        <>
          {a.canAskAgain ? (
            <Button testID="gps-permitir" label="Permitir localização" icon="location" size="lg" wide onPress={() => void pf.request()} />
          ) : (
            <Button testID="gps-ajustes" label="Abrir Ajustes" size="lg" wide onPress={() => void openAppSettings()} />
          )}
          <Button testID="gps-tentar" label="Já permiti, tentar de novo" kind="secondary" wide onPress={pf.retry} />
        </>
      );
    } else if (a.status === 'services-off') {
      title = 'GPS desligado';
      actions = (
        <>
          <Button testID="gps-ajustes" label="Abrir Ajustes" size="lg" wide onPress={() => void openAppSettings()} />
          <Button testID="gps-tentar" label="Tentar de novo" kind="secondary" wide onPress={pf.retry} />
        </>
      );
    } else {
      title = 'GPS indisponível';
      actions = <Button testID="gps-tentar" label="Tentar de novo" kind="secondary" wide onPress={pf.retry} />;
    }
  } else if (step.kind === 'signal') {
    const acc = step.accuracy !== null ? `Precisão atual: ${Math.round(step.accuracy)} m.` : 'Ainda sem posição.';
    if (step.signal === 'weak') {
      title = 'Sinal do GPS fraco';
      body = `Precisão pior que ${WEAK_ACCURACY_M} m. ${acc} Trechos com sinal ruim não contam. Vá para um lugar aberto.`;
      actions = <Button testID="gps-iniciar-mesmo-assim" label="Iniciar mesmo assim" icon="play" size="lg" wide onPress={pf.startAnyway} />;
    } else {
      title = 'Procurando sinal do GPS';
      body = `Fique num lugar aberto por alguns segundos. ${acc}`;
    }
  }

  return (
    <Screen
      testID="tela-gps-verificacao"
      gap={space[4]}
      footer={
        <>
          {actions}
          {/* D-76: a simulação só existe no modo demonstração. */}
          {onSimulate ? <Button testID="gps-usar-simulacao" label="Usar simulação (demonstração)" kind="ghost" wide onPress={onSimulate} /> : null}
        </>
      }>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
        <RevealText style={{ flex: 1 }}>GPS real</RevealText>
        <IconButton testID="gps-voltar" icon="close" label="Voltar" tone="sunken" size={44} onPress={onCancel} />
      </View>
      <FadeUp delay={120} style={{ flex: 1, justifyContent: 'center', gap: space[3] }}>
        <Icon name={step.kind === 'signal' && step.signal === 'weak' ? 'warning' : 'location'} size={40} color={colors.text} />
        <Text variant="title" testID="gps-titulo">
          {title}
        </Text>
        <Text muted testID="gps-mensagem" accessibilityLiveRegion="polite">
          {body}
        </Text>
      </FadeUp>
    </Screen>
  );
}
