import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { finishRun } from '@/domain/run-engine';
import { CAPTURE_THRESHOLD, defenseWindowOpen, TAKEOVER_RATIO } from '@/domain/territory';
import { DEMO_CENTER, zoneName } from '@/demo/demo-data';
import { mapZonesNear } from '@/features/map-data';
import { useRunSession, type RunMode } from '@/features/run/use-run-session';
import { useNow } from '@/features/use-now';
import { selectBasePace, useGame, type MissionId } from '@/store/game-store';
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

  if (mode) return <ActiveRun mode={mode} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: space[4], paddingTop: insets.top + space[4], gap: space[4], paddingBottom: 140 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="headline" accessibilityRole="header">
            Nova corrida
          </Text>
          <IconButton icon="close" label="Fechar" tone="sunken" size={44} onPress={() => router.back()} />
        </View>

        <Text variant="title">Missão</Text>
        <View style={{ gap: space[2] }}>
          {MISSIONS.map((m) => {
            const on = mission === m.id;
            return (
              <Pressable
                key={m.id}
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
              {escortOn ? `${contacts.join(' e ')} acompanham sua localização ao vivo.` : 'Compartilhe sua localização ao vivo com seus contatos.'}
            </Text>
          </View>
          <Switch value={escortOn} onValueChange={toggleEscort} accessibilityLabel="Corrida Segura" />
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: space[4], right: space[4], bottom: insets.bottom + space[4] }}>
        <Button
          label="Começar"
          icon="play"
          size="lg"
          wide
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMode(source);
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
  const zones = useGame((st) => st.zones);
  const faction = useGame((st) => st.faction) ?? 'striders';
  const basePace = useGame(selectBasePace);
  const streakWeeks = useGame((st) => st.streakWeeks);
  const fog = useGame((st) => st.fog);
  const commitRun = useGame((st) => st.commitRun);
  const escortOn = useGame((st) => st.escortOn);
  const contacts = useGame((st) => st.contacts);
  const [sosSent, setSosSent] = useState(false);

  const mapZones = useMemo(() => mapZonesNear(zones, s.position ?? DEMO_CENTER, 1400), [zones, s.position]);

  const zoneId = s.run.currentZone;
  const zone = zoneId ? zones[zoneId] : undefined;
  const owner = zone?.owner ?? null;
  const rival = owner !== null && owner !== faction;
  const defending = !!zone && owner === faction && defenseWindowOpen(zone, now);
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

  const finish = () => {
    const result = finishRun(s.run, {
      faction,
      basePace,
      streakDays: Math.min(10, streakWeeks), // RN-001: weeks of the weekly streak (RN-014)
      zones,
      revealedFog: new Set(fog),
      now: Date.now(),
      ghostPace: s.mission === 'fuga' ? useGame.getState().ghostPace : undefined,
    });
    const record = commitRun({
      endedAt: Date.now(),
      meters: result.meters,
      movingSeconds: result.movingSeconds,
      avgPace: result.avgPace,
      rp: result.rpTotal,
      xp: result.xp,
      mission: s.mission,
      path: s.path,
      result,
      simulated: mode === 'simulacao',
    });
    router.replace({ pathname: '/resumo', params: { id: record.id } });
  };

  const ghost = s.ghost !== null ? ghostStatus(s.ghost) : null;

  if (s.phase === 'countdown') return <Countdown count={s.count} />;

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
            backgroundColor: rival ? factions[owner!].color : defending ? palette.success : colors.surface,
            boxShadow: floating,
            opacity: rival || defending ? 1 : 0,
            transform: [{ translateY: rival || defending || reduced ? 0 : -12 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: 220,
            transitionTimingFunction: CSS_EASE_OUT,
          }}>
          <Icon name={defending ? 'shield' : 'warning'} size={24} color={rival ? factions[owner!].onColor : palette.white} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" color={rival ? factions[owner!].onColor : palette.white}>
              {defending ? 'Defendendo seu território' : rival ? `Território dos ${factions[owner!].name}` : ''}
            </Text>
            <Text variant="caption" color={rival ? factions[owner!].onColor : palette.white}>
              {defending ? 'Pontos em dobro nesta zona' : 'Corra aqui para conquistar'}
            </Text>
          </View>
        </Animated.View>
        {escortOn ? (
          <View style={{ position: 'absolute', bottom: space[3], left: space[4], flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: space[3], height: 32, borderRadius: radius.pill, boxShadow: floating }}>
            <Icon name="shield" size={14} color={colors.text} />
            <Text variant="caption">Escolta ligada</Text>
          </View>
        ) : null}
        <View style={{ position: 'absolute', bottom: space[3], right: space[4] }}>
          <IconButton
            icon="sos"
            label="SOS: avisar meus contatos"
            tone="danger"
            size={44}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setSosSent(true);
            }}
          />
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
              {zoneId ? zoneName(zoneId) : 'Procurando sinal'}
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
            icon={s.voice ? 'speaker' : 'mute'}
            label={s.voice ? 'Silenciar o Guia' : 'Ativar o Guia'}
            tone="sunken"
            size={56}
            onPress={s.toggleVoice}
          />
          <HoldButton label="Segure para encerrar" onConfirm={finish} />
          <IconButton
            icon={s.phase === 'paused' ? 'play' : 'pause'}
            label={s.phase === 'paused' ? 'Retomar corrida' : 'Pausar corrida'}
            tone="action"
            size={64}
            onPress={s.phase === 'paused' ? s.resume : s.pause}
          />
        </View>
      </View>

      {sosSent ? (
        <Pressable
          accessibilityRole="alert"
          onPress={() => setSosSent(false)}
          style={{ position: 'absolute', top: insets.top + space[2], left: space[4], right: space[4], backgroundColor: colors.danger, padding: space[4], borderRadius: radius.lg, gap: 2 }}>
          <Text variant="bodyBold" color="#FFFFFF">
            SOS enviado para {contacts.join(' e ')}
          </Text>
          <Text variant="small" color="#FFFFFF">
            Eles receberam sua localização atual. Toque para fechar. (No protótipo, o envio é simulado.)
          </Text>
        </Pressable>
      ) : null}
      {s.error ? (
        <View style={{ position: 'absolute', top: insets.top + 80, left: space[4], right: space[4], backgroundColor: colors.surface, padding: space[4], borderRadius: radius.lg, boxShadow: floating }}>
          <Text variant="bodyBold">{s.error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="metric" tabular>
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

