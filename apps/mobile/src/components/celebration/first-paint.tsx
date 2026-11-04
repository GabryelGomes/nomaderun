import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { TrailGlow } from '@/components/motion/trail-glow';
import { Text } from '@/components/text';
import { cssEasings, durations, springCss } from '@/theme/motion';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { FIRST_PAINT, firstPaintHoldMs } from './f8-choreography';
import { kf, step, type MomentBaseProps, useMoment } from './moment';

export type FirstPaintSealProps = MomentBaseProps & {
  /** Cor do rastro (a neon do time). */
  color: string;
  title?: string;
  subtitle?: string;
};

const ENTER = { from: { opacity: 0, transform: [{ translateY: FIRST_PAINT.slideFrom }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } };
const EXIT = { from: { opacity: 1, transform: [{ translateY: 0 }] }, to: { opacity: 0, transform: [{ translateY: -40 }] } };
const FADE_OUT = { from: { opacity: 1 }, to: { opacity: 0 } };

/**
 * "Primeiro trecho!" na corrida ativa (F8 · C1, 1 vez na vida): o selo desliza do topo (mola `snappy`), fica e sai
 * em 1,5 s no total; um brilho corre pela linha do rastro (opacidade 0 → 1 → 0, 400 ms) quando ele chega; 1
 * vibração leve. Leve de propósito (o GPS vem primeiro): 2 `Svg` e 1 valor compartilhado, sem partícula.
 * "Reduzir movimento": o selo aparece e some com fades de 150 ms, sem brilho.
 */
export function FirstPaintSeal(props: FirstPaintSealProps) {
  const { color, title = 'Primeiro trecho!', subtitle = 'Seu rastro já pinta a cidade', testID } = props;
  const { colors } = useTheme();
  const text = `${title} ${subtitle}`;
  const reduced = useReducedMotionSetting();
  const { still } = useMoment('group', 'small', props, text, reduced, { durationMs: FIRST_PAINT.lifeMs, beats: [{ offsetMs: 0, pattern: 'tap' }] });
  const hold = firstPaintHoldMs();
  const exitDelay = (still ? durations.reducedFade : FIRST_PAINT.enterMs) + hold;
  return (
    <View testID={testID} pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: space[4] }}>
      <Animated.View
        style={{
          alignSelf: 'center',
          animationName: kf(still ? FADE_OUT : EXIT),
          animationDuration: still ? durations.reducedFade : FIRST_PAINT.exitMs,
          animationDelay: exitDelay,
          animationTimingFunction: cssEasings.exit,
          animationFillMode: 'both',
        }}>
        <Animated.View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={text}
          style={[
            { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4], minWidth: 260, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: color, boxShadow: `0 0 24px ${color}55` },
            step(still, ENTER, FIRST_PAINT.enterMs, 0, springCss('snappy')),
          ]}>
          <TrailGlow color={color} width={64} play={!still} delay={FIRST_PAINT.glowAt} duration={FIRST_PAINT.glowMs} testID={testID ? `${testID}-brilho` : undefined} />
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text variant="bodyBold">{title}</Text>
            <Text variant="small" muted>
              {subtitle}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
