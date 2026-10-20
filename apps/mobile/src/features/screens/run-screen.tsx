import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { HoldButton } from '@/components/hold-button';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { ProgressBar } from '@/components/territory-bar';
import TerritoryMap from '@/components/territory-map';
import { ghostStatus } from '@/domain/games';
import { formatDuration, formatKm, formatPace } from '@/domain/geo';
import { CAPTURE_THRESHOLD, defenseWindowOpen, TAKEOVER_RATIO } from '@/domain/territory';
import { DEMO_CENTER, zoneName } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { loadSafetyContacts } from '@/features/run/run-controller';
import { useGpsPreflight } from '@/features/run/use-gps-preflight';
import { bootstrapOfflineSync } from '@/features/run/use-offline-sync';
import { useRunSession, type RunMode } from '@/features/run/use-run-session';
import { useRunSafety } from '@/features/safety/use-run-safety';
import { useNow } from '@/features/use-now';
import { accessMessage, openAppSettings } from '@/services/location/permissions';
import { WEAK_ACCURACY_M } from '@/services/location/signal';
import { useGame, type MissionId } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
import { CSS_EASE_OUT } from '@/theme/easing';
import { factions, floating, palette, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MISSIONS: { id: MissionId; title: string; body: string; icon: IconName }[] = [
  { id: 'livre', title: 'Corrida livre', body: 'Só correr. Território e neblina contam do mesmo jeito.', icon: 'activities' },
  { id: 'fuga', title: 'Fuga', body: 'Um fantasma corre no ritmo que você escolher. Termine à frente: pontos ×1,5.', icon: 'ghost' },
  { id: 'caca', title: 'Caça', body: 'Baús escondidos pela cidade. Passe a 25 m para abrir.', icon: 'chest' },
];

/** Pre-run choices: mission, signal source and Corrida Segura. Then the session starts. */
export function RunScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const mission = useGame((s) => s.mission);
  const setMission = useGame((s) => s.setMission);
  const ghostPace = useGame((s) => s.ghostPace);
  const setGhostPace = useGame((s) => s.setGhostPace);
  const escortOn = useGame((s) => s.escortOn);
  const toggleEscort = useGame((s) => s.toggleEscort);
  const contacts = useGame((s) => s.contacts);
  const [mode, setMode] = useState<RunMode | null>(null);
  const [source, setSource] = useState<RunMode>('simulacao');
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
        onSimulate={() => {
          setSource('simulacao');
          setCheckingGps(false);
          setMode('simulacao');
        }}
        onCancel={() => setCheckingGps(false)}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: space[4], paddingTop: insets.top + space[4], gap: space[4], paddingBottom: 140 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="headline" accessibilityRole="header">
            Nova corrida
          </Text>
          <IconButton testID="corrida-fechar" icon="close" label="Fechar" tone="sunken" size={44} onPress={() => router.back()} />
        </View>

        <Text variant="title">Missão</Text>
        <View style={{ gap: space[2] }}>
          {MISSIONS.map((m) => {
            const on = mission === m.id;
            return (
              <Pressable
                key={m.id}
                testID={`corrida-missao-${m.id}`}
                accessibilityLabel={m.title}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
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
                  borderColor: on ? colors.text : 'transparent',
                }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: on ? colors.action : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={m.icon} size={22} color={on ? colors.onAction : colors.text} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyBold">{m.title}</Text>
                  <Text variant="small" muted>
                    {m.body}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {mission === 'fuga' ? (
          <View style={{ gap: space[2] }}>
            <Text variant="caption" muted>
              Ritmo do fantasma
            </Text>
            <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
              {[300, 330, 360, 420].map((p) => (
                <Pressable
                  key={p}
                  testID={`corrida-fantasma-${p}`}
                  accessibilityLabel={`Fantasma a ${formatPace(p)} por quilômetro`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ghostPace === p }}
                  onPress={() => setGhostPace(p)}
                  style={{
                    paddingHorizontal: space[4],
                    height: 40,
                    justifyContent: 'center',
                    borderRadius: radius.pill,
                    backgroundColor: ghostPace === p ? colors.text : colors.surface,
                  }}>
                  <Text variant="bodyBold" tabular color={ghostPace === p ? colors.surface : colors.text}>
                    {formatPace(p)} /km
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text variant="title">Sinal</Text>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {(
            [
              ['simulacao', 'Simulação', 'Volta no Flamboyant em 10×'],
              ['gps', 'GPS real', 'Use na rua'],
            ] as const
          ).map(([key, title, body]) => (
            <Pressable
              key={key}
              testID={`corrida-sinal-${key}`}
              accessibilityLabel={title}
              accessibilityRole="radio"
              accessibilityState={{ checked: source === key }}
              onPress={() => setSource(key)}
              style={{
                flex: 1,
                padding: space[4],
                gap: 2,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: source === key ? colors.text : 'transparent',
              }}>
              <Text variant="bodyBold">{title}</Text>
              <Text variant="caption" muted>
                {body}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <Icon name="shield" size={24} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">Corrida Segura</Text>
            <Text variant="small" muted>
              {contacts.length === 0
                ? 'Cadastre até 5 contatos para a Escolta e o SOS.'
                : escortOn
                  ? `Ao começar, sua localização vai para ${contacts.join(' e ')}.`
                  : 'Compartilhe sua localização com seus contatos.'}
            </Text>
          </View>
          <Switch testID="corrida-escolta" value={escortOn} onValueChange={toggleEscort} accessibilityLabel="Corrida Segura" />
        </View>
        <Button testID="corrida-contatos" label="Contatos de segurança" icon="shield" kind="secondary" wide onPress={() => router.push('/contatos-seguranca')} />
      </ScrollView>

      <View style={{ position: 'absolute', left: space[4], right: space[4], bottom: insets.bottom + space[4] }}>
        <Button
          testID="corrida-comecar"
          label="Começar"
          icon="play"
          size="lg"
          wide
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (source === 'gps') setCheckingGps(true);
            else setMode(source);
          }}
        />
      </View>
    </View>
  );
}

function ActiveRun({ mode }: { mode: RunMode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const s = useRunSession(mode);
  const now = useNow(5000);
  const zones = useZones((st) => st.zones);
  const zoneMeta = useZones((st) => st.meta);
  const faction = useGame((st) => st.faction) ?? 'striders';
  const safety = useRunSafety({ position: s.position, active: s.phase === 'running' || s.phase === 'paused' });
  const [finishError, setFinishError] = useState<string | null>(null);

  const mapZones = useMemo(() => mapZonesNear(zones, s.position ?? DEMO_CENTER, 1400), [zones, s.position]);

  const zoneId = s.run.currentZone;
  const zone = zoneId ? zones[zoneId] : undefined;
  const owner = zone?.owner ?? null;
  const rival = owner !== null && owner !== faction;
  const defending = !!zone && owner === faction && defenseWindowOpen(zone, now);
  // Faixa "Defendendo" amarela (ERS, QA-12): texto escuro sobre o amarelo para manter o contraste.
  const bannerInk = rival ? factions[owner!].onColor : defending ? palette.ink : palette.white;
  const myInfluence = zone ? zone.influence[faction] : 0;
  const runRp = zoneId ? (s.run.zoneMeters[zoneId] ?? 0) * 0.1 : 0;
  const target = owner === null ? CAPTURE_THRESHOLD : rival ? zone!.influence[owner!] * TAKEOVER_RATIO : 0;
  const progress = target > 0 ? (myInfluence + runRp) / target : 1;

  // One warning haptic when entering a rival zone, in the same frame as the banner (expo-animation).
  const lastRival = useRef<string | null>(null);
  useEffect(() => {
    if (rival && zoneId && lastRival.current !== zoneId) {
      lastRival.current = zoneId;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: '44%' }}>
        <TerritoryMap
          zones={mapZones}
          myFaction={faction}
          center={s.position ?? DEMO_CENTER}
          span={900}
          user={s.position}
          path={s.path}
          chests={s.chests}
          followUser
          interactive={false}
        />
        <Animated.View
          accessibilityLiveRegion="polite"
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
            backgroundColor: rival ? factions[owner!].color : defending ? palette.warning : colors.surface,
            boxShadow: floating,
            opacity: rival || defending ? 1 : 0,
            transform: [{ translateY: rival || defending || reduced ? 0 : -12 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: 220,
            transitionTimingFunction: CSS_EASE_OUT,
          }}>
          <Icon name={defending ? 'shield' : 'warning'} size={24} color={bannerInk} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" color={bannerInk}>
              {defending ? 'Defendendo seu território' : rival ? `Território dos ${factions[owner!].name}` : ''}
            </Text>
            <Text variant="caption" color={bannerInk}>
              {defending ? 'Pontos em dobro nesta zona' : 'Corra aqui para conquistar'}
            </Text>
          </View>
        </Animated.View>
        <Pressable
          testID="corrida-escolta-alternar"
          accessibilityRole="switch"
          accessibilityState={{ checked: safety.escortOn }}
          accessibilityLabel={safety.escortOn ? 'Escolta ligada. Toque para desligar' : 'Escolta desligada. Toque para ligar e compartilhar sua localização'}
          onPress={safety.toggleEscort}
          hitSlop={12}
          style={{ position: 'absolute', bottom: space[6] + space[3], left: space[4], flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: space[3], height: 32, borderRadius: radius.pill, boxShadow: floating, opacity: safety.escortOn ? 1 : 0.85 }}>
          <Icon name="shield" size={14} color={colors.text} />
          <Text variant="caption">{safety.escortOn ? 'Escolta ligada' : 'Escolta desligada'}</Text>
        </Pressable>
        <View style={{ position: 'absolute', bottom: space[6] + space[3], right: space[4] }}>
          <IconButton testID="corrida-sos" icon="sos" label="SOS: avisar meus contatos" tone="danger" size={56} onPress={() => void safety.sos()} />
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -space[6], backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: space[6], paddingTop: space[4], paddingBottom: insets.bottom + space[3], justifyContent: 'space-between' }}>
        <View style={{ gap: space[1] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="caption" muted>
              {mode === 'simulacao' ? 'Simulação 10×' : 'GPS'}
              {s.run.autoPaused ? '  Pausa automática' : ''}
            </Text>
            <Text variant="caption" muted>
              {MISSIONS.find((m) => m.id === s.mission)?.title}
            </Text>
          </View>
          <Text variant="hero" tabular accessibilityLabel={`Tempo ${formatDuration(s.elapsed)}`} style={{ textAlign: 'center' }}>
            {formatDuration(s.elapsed)}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <Metric label="km" value={formatKm(s.run.meters)} />
            <Metric label="ritmo /km" value={formatPace(s.pace)} />
            <Metric label="média /km" value={formatPace(s.avgPace)} />
          </View>
        </View>

        <View style={{ gap: space[2], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <TeamBadge faction={owner} size={26} attack={!!zone?.attackStartedAt} />
            <Text variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
              {zoneLabel ?? 'Procurando sinal'}
            </Text>
            <Text variant="small" tabular muted>
              +{Math.round(runRp)} RP
            </Text>
          </View>
          {owner === faction ? (
            <Text variant="small" muted>
              Zona do seu time. Cada metro reforça a defesa.
            </Text>
          ) : (
            <>
              <ProgressBar value={progress} color={factions[faction].color} />
              <Text variant="small" muted>
                {progress >= 1 ? 'Conquista garantida ao terminar' : `Faltam ${Math.ceil(target - myInfluence - runRp)} RP para conquistar`}
              </Text>
            </>
          )}
          {s.ghost !== null ? (
            <Text variant="small" accessibilityLiveRegion="polite">
              {ghost === 'ahead' ? `${Math.round(s.ghost)} m à frente do fantasma` : ghost === 'tied' ? 'Lado a lado com o fantasma' : `O fantasma está ${Math.round(-s.ghost)} m à frente`}
            </Text>
          ) : null}
          {s.mission === 'caca' ? (
            <Text variant="small">
              {s.chestToast
                ? `Baú ${s.chestToast.rarity === 'lendario' ? 'lendário' : s.chestToast.rarity} aberto: +${s.chestToast.xp} XP`
                : s.nearestChest
                  ? `Baú mais próximo a ${Math.round(s.nearestChest.meters)} m`
                  : 'Procurando baús por perto'}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <IconButton
            testID="corrida-voz"
            icon={s.voice ? 'speaker' : 'mute'}
            label={s.voice ? 'Silenciar o Guia' : 'Ativar o Guia'}
            tone="sunken"
            size={56}
            onPress={s.toggleVoice}
          />
          <HoldButton testID="corrida-encerrar" label="Segure para encerrar" onConfirm={finish} />
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

      {safety.notice ? (
        <Pressable
          testID="corrida-aviso-seguranca"
          accessibilityRole="alert"
          accessibilityLabel="Fechar aviso"
          onPress={safety.dismissNotice}
          style={{ position: 'absolute', top: insets.top + space[2], left: space[4], right: space[4], backgroundColor: safety.notice.kind === 'escort' ? colors.surface : colors.danger, padding: space[4], borderRadius: radius.lg, gap: 2, boxShadow: floating }}>
          <Text variant="bodyBold" color={safety.notice.kind === 'escort' ? colors.text : '#FFFFFF'}>
            {safety.notice.kind === 'sos' ? 'SOS com sua localização' : safety.notice.kind === 'stop' ? 'Alerta de parada enviado' : 'Escolta: localização compartilhada'}
          </Text>
          <Text variant="small" color={safety.notice.kind === 'escort' ? colors.text : '#FFFFFF'}>
            {safety.notice.result.message} Toque para fechar.
          </Text>
        </Pressable>
      ) : null}
      {safety.asking ? (
        <View
          testID="corrida-alerta-parada"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={{ position: 'absolute', left: space[4], right: space[4], top: insets.top + 80, backgroundColor: colors.surface, padding: space[6], borderRadius: radius.lg, gap: space[3], boxShadow: floating }}>
          <Text variant="title">Está tudo bem?</Text>
          <Text muted>
            Você está parado há mais de 10 minutos. Sem resposta em {safety.asking.secondsLeft} s, avisamos seus contatos com a sua localização.
          </Text>
          <Button testID="corrida-alerta-estou-bem" label="Estou bem" icon="check" size="lg" wide onPress={() => safety.confirmOk()} />
        </View>
      ) : null}
      {s.phase === 'finishing' ? (
        <View
          testID="corrida-finalizando"
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6] }}>
          <Text variant="title">Enviando sua corrida…</Text>
          <Text muted style={{ textAlign: 'center' }}>
            O servidor confere os trechos e calcula os pontos oficiais. Sem internet, você vê o resumo provisório e ele é confirmado depois.
          </Text>
        </View>
      ) : null}
      {finishError ? (
        <View style={{ position: 'absolute', left: space[4], right: space[4], bottom: insets.bottom + space[4], backgroundColor: colors.surface, padding: space[4], borderRadius: radius.lg, gap: space[3], boxShadow: floating }}>
          <Text variant="bodyBold">{finishError}</Text>
          <Button testID="corrida-curta-fechar" label="Fechar" wide onPress={() => router.back()} />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {/* RNF-015: métricas com pelo menos 48 pt (o token `metric` tem 40), sem encolher para caber (QA-12). */}
      <Text variant="metric" tabular numberOfLines={1} style={{ fontSize: METRIC_PT, lineHeight: METRIC_PT * 1.05 }}>
        {value}
      </Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

/** 3-2-1: scale 0.95 → 1 with opacity, 300 ms ease-out, one light haptic per number (hook). */
function Countdown({ count }: { count: number }) {
  const reduced = useReducedMotion();
  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
      <Animated.View
        key={count}
        style={{
          animationName: reduced
            ? { from: { opacity: 0 }, to: { opacity: 1 } }
            : { from: { opacity: 0, transform: [{ scale: 0.95 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
          animationDuration: 300,
          animationTimingFunction: CSS_EASE_OUT,
        }}>
        <Text variant="hero" color={palette.white} style={{ fontSize: 160, lineHeight: 160 }}>
          {count > 0 ? count : 'Vai!'}
        </Text>
      </Animated.View>
      <Text variant="lead" color="#FFFFFF">
        Prepare-se
      </Text>
    </View>
  );
}


/**
 * GPS real: permissão com explicação antes do pedido, GPS desligado, negado de vez (Ajustes) e
 * sinal fraco por mais de 15 s com "iniciar mesmo assim" (UC-01 passo 2 e E3, RNF-013).
 */
function GpsPreflight({ onReady, onSimulate, onCancel }: { onReady: () => void; onSimulate: () => void; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
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
      body = `A precisão está pior que ${WEAK_ACCURACY_M} m há mais de 15 segundos. ${acc} Trechos com sinal ruim não contam pontos. Vá para um lugar aberto ou inicie mesmo assim.`;
      actions = <Button testID="gps-iniciar-mesmo-assim" label="Iniciar mesmo assim" icon="play" size="lg" wide onPress={pf.startAnyway} />;
    } else {
      title = 'Procurando sinal do GPS';
      body = `Fique num lugar aberto por alguns segundos. ${acc}`;
    }
  }

  return (
    <View testID="tela-gps-verificacao" style={{ flex: 1, backgroundColor: colors.background, padding: space[6], paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[6], gap: space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="headline" accessibilityRole="header">
          GPS real
        </Text>
        <IconButton testID="gps-voltar" icon="close" label="Voltar" tone="sunken" size={44} onPress={onCancel} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: space[3] }}>
        <Icon name={step.kind === 'signal' && step.signal === 'weak' ? 'warning' : 'location'} size={40} color={colors.text} />
        <Text variant="title" testID="gps-titulo">
          {title}
        </Text>
        <Text muted testID="gps-mensagem" accessibilityLiveRegion="polite">
          {body}
        </Text>
      </View>
      <View style={{ gap: space[3] }}>
        {actions}
        <Button testID="gps-usar-simulacao" label="Usar simulação" kind="ghost" wide onPress={onSimulate} />
      </View>
    </View>
  );
}
