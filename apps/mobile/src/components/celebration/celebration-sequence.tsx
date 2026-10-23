import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable as RNPressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { cancelAnimation, type SharedValue, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/components/motion/haptics';
import { PressableScale } from '@/components/motion/pressable';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import { easings } from '@/theme/motion';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { nextStepAt, planCelebrations, skipHaptic, skipTo, type CelebrationEvent, type CelebrationPlan, type ScheduledMoment } from './queue';

/** O que cada momento recebe do orquestrador (espalhe `props` no componente do momento). */
export type MomentContext = {
  state: 'playing' | 'done';
  compact: boolean;
  /** Relógio único do roteiro (ms), na thread de UI, para quem quiser sincronizar com ele. */
  clock: SharedValue<number>;
  /** Props prontas para os momentos: o orquestrador cuida da vibração e do anúncio. */
  props: { state: 'playing' | 'done'; compact: boolean; haptics: false; announce: false; testID: string };
};

export type CelebrationSequenceProps = {
  events: readonly CelebrationEvent[];
  /** Desenho de cada momento: a tela decide o desenho; o orquestrador decide o tempo. */
  renderMoment: (moment: ScheduledMoment, ctx: MomentContext) => ReactNode;
  /** Obrigatório: base dos testIDs ("resumo-conquistas" → "resumo-conquistas-pular"). */
  testID: string;
  /** Atraso antes do primeiro momento (ex.: 2700 no resumo, depois da rota e dos números). */
  startDelayMs?: number;
  /** Teto do roteiro (padrão 8,5 s). */
  budgetMs?: number;
  /** Frase antes das conquistas no anúncio ao leitor de tela. */
  intro?: string;
  /** `stack`: os momentos se acumulam (resumo); `single`: só o atual fica na tela. */
  layout?: 'stack' | 'single';
  /** Preferência "Vibração" da pessoa (padrão ligada). */
  hapticsEnabled?: boolean;
  /** Força o modo leitor de tela (testes e galeria). Padrão: o ajuste do sistema. */
  screenReader?: boolean;
  onStepChange?: (index: number) => void;
  onDone?: () => void;
  skipLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type Run = { plan: CelebrationPlan; started: number; doneIds: readonly string[]; finished: boolean };

/** Estado inicial de um roteiro: com leitor de tela, tudo já mostrado no estado final. */
function initialRun(plan: CelebrationPlan): Run {
  const all = plan.mode === 'screen-reader';
  return { plan, started: all ? plan.moments.length : 0, doneIds: all ? plan.moments.map((m) => m.id) : [], finished: all || plan.moments.length === 0 };
}

/** Quantos itens de `times` já passaram em `t` (função pura usada também no worklet). */
function countUpTo(times: readonly number[], t: number): number {
  'worklet';
  let n = 0;
  for (let i = 0; i < times.length; i++) if (times[i] <= t) n++;
  return n;
}

/**
 * Orquestrador de celebrações (T7.1.14): toca os momentos um a um, com um **único relógio** na thread de UI
 * (`withTiming` linear). O estado React muda só nos limites dos momentos (via `scheduleOnRN`), nunca por
 * quadro; as vibrações saem do mesmo relógio, com ≥ 150 ms entre elas.
 *  - "Pular": tudo vai ao estado final (fade ≤ 200 ms), sem as vibrações pendentes (no máximo 1 sucesso);
 *  - tocar na área adianta o momento atual;
 *  - leitor de tela: nada roteirizado, tudo no estado final e **um** anúncio;
 *  - "Reduzir movimento": fades curtos em cascata e 1 vibração.
 */
export function CelebrationSequence({
  events,
  renderMoment,
  testID,
  startDelayMs = 0,
  budgetMs,
  intro,
  layout = 'stack',
  hapticsEnabled = true,
  screenReader,
  onStepChange,
  onDone,
  skipLabel = 'Pular',
  style,
}: CelebrationSequenceProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionSetting();
  const [systemReader, setSystemReader] = useState(false);
  useEffect(() => {
    if (screenReader !== undefined) return;
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (alive) setSystemReader(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setSystemReader);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [screenReader]);
  const reader = screenReader ?? systemReader;

  const plan: CelebrationPlan = useMemo(() => planCelebrations(events, { reduced, screenReader: reader, startAtMs: startDelayMs, budgetMs, intro }), [events, reduced, reader, startDelayMs, budgetMs, intro]);
  const starts = useMemo(() => plan.moments.map((m) => m.startMs), [plan]);
  const hapticTimes = useMemo(() => plan.haptics.map((h) => h.atMs), [plan]);
  const all = plan.mode === 'screen-reader';

  const clock = useSharedValue(0);
  /** Estado do roteiro atual; volta ao início quando o plano muda (ajuste durante a renderização). */
  const [run, setRun] = useState(() => initialRun(plan));
  if (run.plan !== plan) setRun(initialRun(plan));
  const { started, doneIds, finished } = run;
  const fired = useRef(0);
  const ended = useRef(false);
  const handlers = useRef({ onDone, onStepChange });
  useEffect(() => {
    handlers.current = { onDone, onStepChange };
  }, [onDone, onStepChange]);

  /** Avisa o fim uma vez só. */
  const notifyDone = () => {
    if (ended.current) return;
    ended.current = true;
    handlers.current.onDone?.();
  };
  const finish = () => {
    setRun((r) => (r.finished ? r : { ...r, finished: true }));
    notifyDone();
  };

  /** Chamado nos limites: quantos momentos começaram e quantas vibrações já passaram. */
  const onTick = (code: number) => {
    const n = Math.floor(code / 1000);
    const h = code % 1000;
    setRun((r) => {
      if (n <= r.started) return r;
      handlers.current.onStepChange?.(n - 1);
      return { ...r, started: n };
    });
    for (let i = fired.current; i < h; i++) haptic(plan.haptics[i].pattern, { enabled: hapticsEnabled });
    fired.current = Math.max(fired.current, h);
  };

  // (re)começa o relógio quando o plano muda
  useEffect(() => {
    ended.current = false;
    fired.current = 0;
    if (plan.mode === 'screen-reader') {
      if (plan.announcement) AccessibilityInfo.announceForAccessibility(plan.announcement);
      clock.set(plan.totalMs);
      notifyDone();
      return;
    }
    if (plan.moments.length === 0) {
      notifyDone();
      return;
    }
    clock.set(0);
    clock.set(
      withTiming(plan.totalMs, { duration: plan.totalMs, easing: easings.linear }, (done) => {
        if (done) scheduleOnRN(finish);
      }),
    );
    return () => cancelAnimation(clock);
    // `finish`/`notifyDone` só usam refs e o setter; o relógio recomeça só com um plano novo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, clock]);

  useAnimatedReaction(
    () => countUpTo(starts, clock.get()) * 1000 + countUpTo(hapticTimes, clock.get()),
    (code, prev) => {
      if (code !== prev) scheduleOnRN(onTick, code);
    },
    [starts, hapticTimes],
  );

  /** "Pular": tudo ao estado final; sem as vibrações pendentes; no máximo 1 sucesso. */
  const skip = () => {
    if (finished) return;
    const now = clock.get();
    cancelAnimation(clock);
    clock.set(plan.totalMs);
    fired.current = plan.haptics.length;
    const { finishedIds } = skipTo(plan, now);
    const played = new Set(finishedIds);
    // os que já tocaram inteiros ficam como estão (sem piscar); os outros vão ao estado final
    setRun((r) => ({ ...r, started: plan.moments.length, doneIds: plan.moments.filter((m) => !played.has(m.id) || r.doneIds.includes(m.id)).map((m) => m.id) }));
    const h = skipHaptic(plan, now);
    if (h) haptic(h, { enabled: hapticsEnabled });
    finish();
  };

  /** Toque na área: o momento atual vai ao fim e o próximo começa. */
  const advance = () => {
    if (finished) return;
    const now = clock.get();
    const target = nextStepAt(plan, now);
    if (target >= plan.totalMs) {
      skip();
      return;
    }
    const { currentId } = skipTo(plan, now);
    if (currentId) setRun((r) => (r.doneIds.includes(currentId) ? r : { ...r, doneIds: [...r.doneIds, currentId] }));
    fired.current = countUpTo(hapticTimes, target);
    cancelAnimation(clock);
    clock.set(target);
    clock.set(
      withTiming(plan.totalMs, { duration: plan.totalMs - target, easing: easings.linear }, (done) => {
        if (done) scheduleOnRN(finish);
      }),
    );
  };

  const visible = plan.moments.map((m, i) => ({ m, i })).filter(({ i }) => i < started && (layout === 'stack' || i === started - 1));

  return (
    <View testID={testID} style={[{ gap: space[3] }, style]}>
      {!finished && !all ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <PressableScale
            testID={`${testID}-pular`}
            accessibilityLabel="Pular celebrações"
            onPress={skip}
            style={{ minHeight: 44, minWidth: 64, paddingHorizontal: space[4], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="bodyBold">{skipLabel}</Text>
          </PressableScale>
        </View>
      ) : null}
      <RNPressable testID={`${testID}-avancar`} accessibilityLabel="Avançar celebração" accessible={false} disabled={finished || all} onPress={advance} style={{ gap: space[4] }}>
        {visible.map(({ m }) => {
          const state = doneIds.includes(m.id) ? 'done' : 'playing';
          const ctx: MomentContext = { state, compact: m.compact, clock, props: { state, compact: m.compact, haptics: false, announce: false, testID: `${testID}-${m.kind}-${m.id}` } };
          return <View key={m.id}>{renderMoment(m, ctx)}</View>;
        })}
      </RNPressable>
    </View>
  );
}
