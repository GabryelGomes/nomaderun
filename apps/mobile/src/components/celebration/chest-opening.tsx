import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

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
import { radius } from '@/theme/tokens';

import { CHEST_TIMELINE as C, oddsLabel, RARITY_COLORS, RARITY_CONFETTI, RARITY_NAMES } from './choreography';
import { type MomentBaseProps, kf, rise, step, useMoment } from './moment';
import { defaultLevel, type ChestRarity } from './queue';

export type ChestOpeningProps = MomentBaseProps & {
  rarity: ChestRarity;
  xp: number;
  /** Chances reais de cada raridade (0–1), visíveis (ética §5.4, D-66). Sem elas, a linha não aparece. */
  odds?: Record<ChestRarity, number>;
  /** Arte do baú (E4): corpo e tampa separados. Sem arte: marcador geométrico provisório. */
  chest?: ReactNode;
  lid?: ReactNode;
  /** O que saiu do baú (arte do item). */
  item?: ReactNode;
};

/** Marcador provisório (até a arte da E4 chegar na onda 2). */
function PlaceholderBody({ color }: { color: string }) {
  return <View style={{ width: 96, height: 60, borderRadius: radius.sm, backgroundColor: '#1A1B20', borderWidth: 3, borderColor: color }} />;
}
function PlaceholderLid({ color }: { color: string }) {
  return <View style={{ width: 104, height: 26, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: color }} />;
}
function PlaceholderItem({ color }: { color: string }) {
  return <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color, boxShadow: `0 0 24px ${color}` }} />;
}

/**
 * Baú abrindo (catálogo §4.2): treme 3× (4°, 6°, 8°), achata, estoura (tampa voa, clarão, raios), o item
 * sobe com mola, a raridade e o XP aparecem e as chances ficam visíveis. Vibração em crescendo + sucesso.
 * "Reduzir movimento": baú aberto e item no lugar, com fade.
 */
export function ChestOpening(props: ChestOpeningProps) {
  const { rarity, xp, odds, chest, lid, item, testID } = props;
  const color = RARITY_COLORS[rarity];
  const text = `Baú ${RARITY_NAMES[rarity].toLowerCase()} aberto: mais ${xp} XP.${odds ? ` ${oddsLabel(odds)}` : ''}`;
  const level = defaultLevel({ kind: 'chest', payload: { rarity, xp } });
  const reduced = useReducedMotionSetting();
  const { still, at } = useMoment('chest', level, props, text, reduced);
  const confetti = RARITY_CONFETTI[rarity];
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'flex-end' }}>
        {/* halo da raridade */}
        <Animated.View
          style={[
            { position: 'absolute', width: 180, height: 180, borderRadius: 90, bottom: 10, backgroundColor: color, opacity: 0.18 },
            step(still, { from: { opacity: 0 }, to: { opacity: 0.18 } }, at(C.shakeMs), 0, cssEasings.standard),
          ]}
        />
        {!still ? <SpinRays color={color} size={240} delay={at(C.burst)} opacity={rarity === 'comum' ? 0.18 : 0.32} /> : null}
        {!still ? <Flash kind="radial" color="#FFFFFF" size={160} delay={at(C.burst)} /> : null}
        {/* item sobe de dentro do baú */}
        <Animated.View
          style={[{ position: 'absolute', bottom: 70 }, step(still, { from: { opacity: 0, transform: [{ translateY: 80 }, { scale: 0.3 }] }, to: { opacity: 1, transform: [{ translateY: -60 }, { scale: 1 }] } }, springs.bouncy.duration, at(C.item), springCss('bouncy'))]}>
          {item ?? <PlaceholderItem color={color} />}
        </Animated.View>
        {!still ? <Burst color={color} count={10} distance={70} delay={at(C.burst + 10)} origin={{ x: 110, y: 130 }} /> : null}
        <Shake trigger={still ? 0 : 1} axis="rotate" amplitude={8} cycles={3} duration={at(C.shakeMs)} origin="bottom">
          <Animated.View
            style={
              still
                ? null
                : {
                    transformOrigin: 'bottom',
                    animationName: kf({
                      '0%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
                      '50%': { transform: [{ scaleX: 1.08 }, { scaleY: 0.86 }] },
                      '80%': { transform: [{ scaleX: 0.96 }, { scaleY: 1.08 }] },
                      '100%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
                    }),
                    animationDuration: at(C.squashMs),
                    animationDelay: at(C.squash),
                    animationTimingFunction: cssEasings.standard,
                    animationFillMode: 'both',
                  }
            }>
            <View style={{ alignItems: 'center' }}>
              {/* a tampa voa no estouro; no estado final ela já saiu */}
              {still ? null : (
                <Animated.View
                  style={{
                    animationName: kf({ from: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }] }, to: { opacity: 0, transform: [{ translateX: -30 }, { translateY: -120 }, { rotate: '-40deg' }] } }),
                    animationDuration: 380,
                    animationDelay: at(C.burst),
                    animationTimingFunction: cssEasings.enter,
                    animationFillMode: 'both',
                  }}>
                  {lid ?? <PlaceholderLid color={color} />}
                </Animated.View>
              )}
              {chest ?? <PlaceholderBody color={color} />}
            </View>
          </Animated.View>
        </Shake>
        {!still && confetti > 0 ? <Confetti count={confetti} colors={[color, '#FFFFFF', neon.orange]} width={300} height={420} origin={{ x: 110, y: 120 }} delay={at(C.item)} seed={5} /> : null}
      </View>
      <Animated.View style={step(still, rise(14), 450, at(C.rarity))}>
        <Text variant="title" color={color} style={{ textAlign: 'center' }}>
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
