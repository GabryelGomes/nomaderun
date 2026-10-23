import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chest } from '@/components/art';
import { Burst } from '@/components/motion/burst';
import { Confetti } from '@/components/motion/confetti';
import { formatCount } from '@/components/motion/count';
import { CountUp } from '@/components/motion/count-up';
import { Flash } from '@/components/motion/flash';
import { Shake } from '@/components/motion/shake';
import { SpinRays } from '@/components/motion/spin-rays';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import { cssEasings, springCss, springs } from '@/theme/motion';
import { neon } from '@/theme/neon';

import { CHEST_TIMELINE as C, chestLidKeyframes, oddsLabel, RARITY_COLORS, RARITY_CONFETTI, RARITY_NAMES, RARITY_PALETTES, RARITY_TEXT } from './choreography';
import { type MomentBaseProps, kf, pop, rise, step, useMoment } from './moment';
import { defaultLevel, type ChestRarity } from './queue';

export type ChestOpeningProps = MomentBaseProps & {
  rarity: ChestRarity;
  xp: number;
  /** Chances reais de cada raridade (0–1), visíveis (ética §5.4, D-66). Sem elas, a linha não aparece. */
  odds?: Record<ChestRarity, number>;
  /**
   * Troca a arte (padrão: o `Chest` da E4, com a tampa animada na dobradiça). Com `chest`/`lid`, o corpo e a
   * tampa vêm de fora e a tampa voa no estouro.
   */
  chest?: ReactNode;
  lid?: ReactNode;
  /** O que saiu do baú (arte do item). Sem item: brilha a estrela que o próprio baú aberto já tem. */
  item?: ReactNode;
};

/** Largura da arte do baú (pt). */
const CHEST_SIZE = 150;

/**
 * Baú da E4 (padrão): o fechado chacoalha a tampa na dobradiça (`parts.tampa`), abre de vez no estouro e
 * some no clarão, onde o aberto (com raios e estrela) entra com mola curta. Só transform e opacidade.
 */
function ArtChest({ rarity, still, at }: { rarity: ChestRarity; still: boolean; at: (ms: number) => number }) {
  if (still) {
    return (
      <Animated.View style={step(true, pop(1), 0, 0)}>
        <Chest rarity={rarity} state="aberto" size={CHEST_SIZE} decorative />
      </Animated.View>
    );
  }
  const lid = chestLidKeyframes({ shakeMs: at(C.shakeMs), burst: at(C.burst) });
  return (
    <View style={{ width: CHEST_SIZE, height: CHEST_SIZE }}>
      <Shake trigger={1} axis="rotate" amplitude={8} cycles={3} duration={at(C.shakeMs)} origin="bottom">
        <Animated.View style={{ transformOrigin: 'bottom', ...squash(at) }}>
          <Animated.View style={{ animationName: kf({ from: { opacity: 1 }, to: { opacity: 0 } }), animationDuration: 140, animationDelay: at(C.burst) + 40, animationTimingFunction: cssEasings.standard, animationFillMode: 'both' }}>
            <Chest
              rarity={rarity}
              state="fechado"
              size={CHEST_SIZE}
              decorative
              parts={{ tampa: { animationName: kf(lid.keyframes), animationDuration: lid.durationMs, animationTimingFunction: cssEasings.standard, animationFillMode: 'both' } }}
            />
          </Animated.View>
        </Animated.View>
      </Shake>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, transformOrigin: 'bottom' },
          step(false, { from: { opacity: 0, transform: [{ scale: 0.86 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } }, springs.snappy.duration, at(C.burst), springCss('snappy')),
        ]}>
        <Chest rarity={rarity} state="aberto" size={CHEST_SIZE} decorative />
      </Animated.View>
    </View>
  );
}

/** Achata antes do estouro (catálogo §4.2). */
function squash(at: (ms: number) => number) {
  return {
    animationName: kf({
      '0%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
      '50%': { transform: [{ scaleX: 1.08 }, { scaleY: 0.86 }] },
      '80%': { transform: [{ scaleX: 0.96 }, { scaleY: 1.08 }] },
      '100%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
    }),
    animationDuration: at(C.squashMs),
    animationDelay: at(C.squash),
    animationTimingFunction: cssEasings.standard,
    animationFillMode: 'both' as const,
  };
}

/** Arte de fora (`chest` + `lid`): a tampa voa no estouro; no estado final ela já saiu. */
function CustomChest({ chest, lid, still, at }: { chest?: ReactNode; lid?: ReactNode; still: boolean; at: (ms: number) => number }) {
  return (
    <Shake trigger={still ? 0 : 1} axis="rotate" amplitude={8} cycles={3} duration={at(C.shakeMs)} origin="bottom">
      <Animated.View style={still ? null : { transformOrigin: 'bottom', ...squash(at) }}>
        <View style={{ alignItems: 'center' }}>
          {still || !lid ? null : (
            <Animated.View
              style={{
                animationName: kf({ from: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }] }, to: { opacity: 0, transform: [{ translateX: -30 }, { translateY: -120 }, { rotate: '-40deg' }] } }),
                animationDuration: 380,
                animationDelay: at(C.burst),
                animationTimingFunction: cssEasings.enter,
                animationFillMode: 'both',
              }}>
              {lid}
            </Animated.View>
          )}
          {chest}
        </View>
      </Animated.View>
    </Shake>
  );
}

/**
 * Baú abrindo (catálogo §4.2) com a arte da E4: treme 3× (4°, 6°, 8°) com a tampa chacoalhando na dobradiça,
 * achata, estoura (a tampa abre, clarão, raios e o baú aberto com a estrela), a raridade e o XP aparecem e
 * as chances ficam visíveis. Vibração em crescendo + sucesso. Cores da raridade: as da E4 (nunca o violeta).
 * "Reduzir movimento": baú aberto no lugar, com fade.
 */
export function ChestOpening(props: ChestOpeningProps) {
  const { rarity, xp, odds, chest, lid, item, testID } = props;
  const color = RARITY_COLORS[rarity];
  const text = `Baú ${RARITY_NAMES[rarity].toLowerCase()} aberto: mais ${xp} XP.${odds ? ` ${oddsLabel(odds)}` : ''}`;
  const level = defaultLevel({ kind: 'chest', payload: { rarity, xp } });
  const reduced = useReducedMotionSetting();
  const { still, at } = useMoment('chest', level, props, text, reduced);
  const confetti = RARITY_CONFETTI[rarity];
  const custom = chest !== undefined || lid !== undefined;
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'flex-end' }}>
        {/* halo da raridade */}
        <Animated.View
          style={[
            { position: 'absolute', width: 180, height: 180, borderRadius: 90, bottom: 10, backgroundColor: color, opacity: 0.14 },
            step(still, { from: { opacity: 0 }, to: { opacity: 0.14 } }, at(C.shakeMs), 0, cssEasings.standard),
          ]}
        />
        {!still ? <SpinRays color={color} size={240} delay={at(C.burst)} opacity={rarity === 'comum' ? 0.16 : 0.3} /> : null}
        {!still ? <Flash kind="radial" color="#FFFFFF" size={160} delay={at(C.burst)} /> : null}
        {item ? (
          <Animated.View
            style={[{ position: 'absolute', bottom: 70 }, step(still, { from: { opacity: 0, transform: [{ translateY: 80 }, { scale: 0.3 }] }, to: { opacity: 1, transform: [{ translateY: -60 }, { scale: 1 }] } }, springs.bouncy.duration, at(C.item), springCss('bouncy'))]}>
            {item}
          </Animated.View>
        ) : null}
        {!still ? <Burst color={color} count={10} distance={70} delay={at(C.burst + 10)} origin={{ x: 110, y: 130 }} /> : null}
        {custom ? <CustomChest chest={chest} lid={lid} still={still} at={at} /> : <ArtChest rarity={rarity} still={still} at={at} />}
        {!still && confetti > 0 ? <Confetti count={confetti} colors={[...RARITY_PALETTES[rarity], '#FFFFFF']} width={300} height={420} origin={{ x: 110, y: 120 }} delay={at(C.item)} seed={5} /> : null}
      </View>
      <Animated.View style={step(still, rise(14), 450, at(C.rarity))}>
        <Text variant="title" color={RARITY_TEXT[rarity]} style={{ textAlign: 'center' }}>
          {RARITY_NAMES[rarity]}
        </Text>
      </Animated.View>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }, step(still, { from: { opacity: 0, transform: [{ scale: 0.8 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } }, springs.snappy.duration, at(C.xp), springCss('snappy'))]}>
        <CountUp value={xp} format={(n) => `+${formatCount(n)}`} duration={still ? 0 : 500} delay={still ? 0 : at(C.xp)} variant="headline" color={neon.orangeText} unit="XP" accessibilityLabel={`mais ${xp} XP`} />
      </Animated.View>
      {odds ? (
        <Animated.View style={step(still, { from: { opacity: 0 }, to: { opacity: 1 } }, 300, at(C.odds), cssEasings.standard)}>
          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            {oddsLabel(odds)}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
