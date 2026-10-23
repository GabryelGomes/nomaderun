import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Mascot, Medal } from '@/components/art';
import { Confetti } from '@/components/motion/confetti';
import { CountUp } from '@/components/motion/count-up';
import { haptic } from '@/components/motion/haptics';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { SpinRays } from '@/components/motion/spin-rays';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { cssEasings, durations, springCss, springs } from '@/theme/motion';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { LEVEL_TIMELINE as L, rankOffsets } from './choreography';
import { type MomentBaseProps, kf, pop, rise, step, useMoment } from './moment';

/* ------------------------------------------------------------------ LevelUp */

export type LevelUpProps = MomentBaseProps & {
  level: number;
  /** Título do nível (D-64: 8 títulos), ex.: "Desbravador". */
  title?: string;
  reward?: { label: string; icon?: ReactNode };
  /** Time da pessoa: o mascote dele (arte da E4, pose "vitória") sobe atrás do número. */
  team?: FactionId;
};

/**
 * Nível novo (épica, catálogo §3 item 22): a tela escurece, raios abrem e giram, o número carimba com a mola
 * `stamp`, o título sobe, a recompensa entra e caem 60 confetes. "Reduzir movimento": fundo e textos com fade.
 */
export function LevelUp(props: LevelUpProps) {
  const { level, title, reward, team, testID } = props;
  const text = `Nível ${level}${title ? `: ${title}` : ''}${reward ? `. Recompensa: ${reward.label}` : ''}`;
  const reduced = useReducedMotionSetting();
  const { still, at } = useMoment('level-up', 'epic', props, text, reduced);
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', justifyContent: 'center', minWidth: 280, minHeight: 320, gap: 8 }}>
      <Animated.View
        style={[{ position: 'absolute', top: -40, bottom: -40, left: -40, right: -40, borderRadius: radius.lg, backgroundColor: 'rgba(7,7,8,0.88)' }, step(still, { from: { opacity: 0 }, to: { opacity: 1 } }, 200, at(L.dim), cssEasings.standard)]}
      />
      {!still ? <SpinRays color={neon.orange} size={320} delay={at(L.rays)} /> : null}
      {team ? (
        <View style={{ position: 'absolute', top: -24, opacity: 0.35 }}>
          <Animated.View style={step(still, rise(40), 600, at(L.number), cssEasings.enter)}>
            <Mascot team={team} pose="vitoria" size={180} />
          </Animated.View>
        </View>
      ) : null}
      <Animated.View style={step(still, rise(10), 400, at(L.rays))}>
        <Text variant="label" color={neon.orangeText}>
          NÍVEL NOVO
        </Text>
      </Animated.View>
      <Animated.View style={step(still, pop(0.3), springs.stamp.duration, at(L.number), springCss('stamp'))}>
        <Text variant="hero" tabular color="#FFFFFF" style={{ textShadowColor: neon.orange, textShadowRadius: 24 }}>
          {level}
        </Text>
      </Animated.View>
      {title ? (
        <Animated.View style={step(still, rise(14), 500, at(L.title))}>
          <Text variant="title" style={{ textAlign: 'center' }}>
            {title}
          </Text>
        </Animated.View>
      ) : null}
      {reward ? (
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: space[2] }, step(still, pop(0.6), springs.bouncy.duration, at(L.reward), springCss('bouncy'))]}>
          {reward.icon}
          <Text variant="bodyBold">{reward.label}</Text>
        </Animated.View>
      ) : null}
      {!still ? <Confetti count={60} colors={[neon.orange, '#FFFFFF', '#FFD60A']} width={320} height={520} origin={{ x: 140, y: 160 }} delay={at(L.number)} seed={8} /> : null}
    </View>
  );
}

/* ------------------------------------------------------------- StreakFlame */

export type StreakFlameProps = MomentBaseProps & {
  /** Semanas seguidas (sequência semanal, D-63). */
  weeks: number;
  /** `kept`: a chama acende; `frozen`: o congelamento salvou a semana. */
  status: 'kept' | 'frozen';
  /** Troca a chama (padrão: a medalha "Sequência" da E4, com a chama). */
  flame?: ReactNode;
  /** Troca o gelo do congelamento (a E4 ainda não tem arte de gelo: há um bloco provisório). */
  ice?: ReactNode;
};

/** Bloco de gelo provisório, até a E4 desenhar o congelamento. */
function PlaceholderIce() {
  return <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(160,220,255,0.55)', borderWidth: 2, borderColor: '#BFE6FF' }} />;
}

/** Sequência semanal mantida (chama acende com mola) ou salva pelo congelamento (gelo cobre a chama). */
export function StreakFlame(props: StreakFlameProps) {
  const { weeks, status, flame, ice, testID } = props;
  const text = status === 'kept' ? `Sequência mantida: ${weeks} semanas seguidas` : `Congelamento usado: sua sequência de ${weeks} semanas está salva`;
  const reduced = useReducedMotionSetting();
  const { still } = useMoment('streak', 'small', props, text, reduced);
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={step(still, pop(0.6), springs.bouncy.duration, 0, springCss('bouncy'))}>{flame ?? <Medal kind="sequencia" size={56} decorative />}</Animated.View>
        {status === 'frozen' ? (
          <Animated.View style={[{ position: 'absolute' }, step(still, { from: { opacity: 0, transform: [{ scale: 0.9 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } }, springs.gentle.duration, 150, springCss('gentle'))]}>
            {ice ?? <PlaceholderIce />}
          </Animated.View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <CountUp value={weeks} from={Math.max(0, weeks - 1)} duration={still ? 0 : 400} delay={still ? 0 : 150} variant="headline" accessibilityLabel={`${weeks} semanas`} />
        <Text variant="body" muted>
          {weeks === 1 ? 'semana' : 'semanas'}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ PRStamp */

export type PRStampProps = MomentBaseProps & {
  /** Selo (padrão "PR"). */
  label?: string;
  /** O recorde: "5 km em 24:10". */
  metric: string;
};

/** Recorde pessoal: o selo carimba (1,6 → 1, giro −8° → 0, mola `stamp`) e um brilho varre o selo. */
export function PRStamp(props: PRStampProps) {
  const { label = 'PR', metric, testID } = props;
  const text = `Recorde pessoal: ${metric}`;
  const reduced = useReducedMotionSetting();
  const { still } = useMoment('personal-record', 'medium', props, text, reduced);
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', gap: 8 }}>
      <Animated.View
        style={[
          { paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.sm, borderWidth: 3, borderColor: neon.orange, overflow: 'hidden', boxShadow: `0 0 18px ${neon.orange}66` },
          step(still, { from: { opacity: 0, transform: [{ scale: 1.6 }, { rotate: '-8deg' }] }, to: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] } }, springs.stamp.duration, 0, springCss('stamp')),
        ]}>
        <Text variant="headline" color={neon.orangeText}>
          {label}
        </Text>
        {!still ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -10,
              bottom: -10,
              width: 18,
              backgroundColor: 'rgba(255,255,255,0.55)',
              animationName: kf({ from: { transform: [{ translateX: -40 }, { rotate: '20deg' }] }, to: { transform: [{ translateX: 140 }, { rotate: '20deg' }] } }),
              animationDuration: 500,
              animationDelay: 400,
              animationTimingFunction: cssEasings.standard,
              animationFillMode: 'both',
            }}
          />
        ) : null}
      </Animated.View>
      <Animated.View style={step(still, rise(10), 400, 250)}>
        <Text variant="bodyBold">{metric}</Text>
      </Animated.View>
    </View>
  );
}

/* ---------------------------------------------------------------- RankShift */

export type RankRow = { id: string; label: string; value: string; you?: boolean };

export type RankShiftProps = {
  /** Linhas na ordem nova. */
  rows: RankRow[];
  /** Ordem anterior (ids). Ao montar, as linhas saem dela e trocam de lugar até a ordem nova. */
  previousOrder?: string[];
  rowHeight?: number;
  /** Vibra (seleção) quando as linhas trocam. */
  haptics?: boolean;
  hapticsEnabled?: boolean;
  testID: string;
};

/**
 * Ranking que troca de lugar (liga, crew): cada linha é posicionada só com `translateY` e anda com uma
 * transição CSS de 600 ms (power2.inOut). A linha da pessoa brilha. "Reduzir movimento": troca direto, com fade.
 */
export function RankShift({ rows, previousOrder, rowHeight = 48, haptics = true, hapticsEnabled = true, testID }: RankShiftProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionSetting();
  const finalOrder = rows.map((r) => r.id);
  const startOrder = previousOrder && previousOrder.length === rows.length && !reduced ? previousOrder : finalOrder;
  const [order, setOrder] = useState(startOrder);
  const finalKey = finalOrder.join('|');
  useEffect(() => {
    const next = finalKey.split('|');
    const t = setTimeout(() => {
      setOrder(next);
      if (haptics) haptic('selection', { enabled: hapticsEnabled });
    }, 50);
    return () => clearTimeout(t);
    // só reage à ordem nova
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalKey]);
  const y = rankOffsets(order, rowHeight);
  const you = rows.find((r) => r.you);
  const label = you ? `Você está em ${finalOrder.indexOf(you.id) + 1}º lugar` : 'Ranking atualizado';
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={label} style={{ height: rows.length * rowHeight, alignSelf: 'stretch' }}>
      {rows.map((r) => {
        const pos = order.indexOf(r.id) + 1;
        return (
          <Animated.View
            key={r.id}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: rowHeight - 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              paddingHorizontal: space[3],
              borderRadius: radius.sm,
              // fundo opaco: a linha da pessoa passa por cima das outras ao trocar de lugar
              backgroundColor: r.you ? neon.glowBg : colors.surface,
              borderWidth: r.you ? 1 : 0,
              borderColor: neon.orange,
              transform: [{ translateY: y[r.id] ?? 0 }],
              transitionProperty: reduced ? 'opacity' : 'transform',
              transitionDuration: reduced ? durations.reducedFade : 600,
              transitionTimingFunction: cssEasings.swap,
              zIndex: r.you ? 1 : 0,
            }}>
            <Text variant="bodyBold" tabular style={{ width: 28 }}>
              {pos}
            </Text>
            <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
              {r.label}
            </Text>
            <Text variant="bodyBold" tabular muted={!r.you}>
              {r.value}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}
