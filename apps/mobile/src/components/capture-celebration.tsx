import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Line, Polygon } from 'react-native-svg';

import type { FactionId } from '@/domain/types';
import { EASE_OUT } from '@/theme/easing';
import { factions, motion, palette } from '@/theme/tokens';

import { hexPoints } from './hex-mark';
import { Text } from './text';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const SIZE = 132;
const STROKES = 6;

function ChalkStroke({ i, color, reduced }: { i: number; color: string; reduced: boolean }) {
  const length = SIZE * 1.6;
  const drawn = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) drawn.set(withDelay(i * motion.stagger, withTiming(1, { duration: 220, easing: EASE_OUT })));
  }, [drawn, i, reduced]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.get()) }));
  const x = (SIZE / (STROKES - 1)) * i;
  return (
    <AnimatedLine
      x1={x - SIZE * 0.45}
      y1={SIZE + 6}
      x2={x + SIZE * 0.45}
      y2={-6}
      stroke={color}
      strokeWidth={13}
      strokeLinecap="round"
      strokeDasharray={`${length} ${length}`}
      animatedProps={props}
      opacity={0.9}
    />
  );
}

/**
 * The one orchestrated moment of the app (frontend-design: spend boldness in one place).
 * The conquered hexagon is painted by six chalk strokes, 60 ms apart; haptic on the first stroke,
 * same frame as the visual (expo-animation). Reduced motion: the hexagon appears already painted.
 */
export function CaptureCelebration({ faction, zone, rp }: { faction: FactionId; zone: string; rp: number }) {
  const reduced = useReducedMotion();
  const f = factions[faction];
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  const pts = hexPoints(SIZE, 3);
  return (
    <View accessible accessibilityLabel={`Zona conquistada: ${zone}, mais ${rp} pontos`} style={{ alignItems: 'center', gap: 10 }}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <ClipPath id="hex-clip">
            <Polygon points={pts} />
          </ClipPath>
        </Defs>
        <Polygon points={pts} fill={f.soft} />
        <Svg width={SIZE} height={SIZE} clipPath="url(#hex-clip)">
          {Array.from({ length: STROKES }, (_, i) => (
            <ChalkStroke key={i} i={i} color={f.color} reduced={reduced} />
          ))}
        </Svg>
        <Polygon points={pts} fill="none" stroke={palette.asfalto} strokeWidth={3} />
      </Svg>
      <Animated.View
        style={{
          alignItems: 'center',
          animationName: reduced
            ? { from: { opacity: 0 }, to: { opacity: 1 } }
            : { from: { opacity: 0, transform: [{ translateY: 10 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
          animationDuration: reduced ? 150 : 400,
          animationDelay: reduced ? 0 : STROKES * motion.stagger,
          animationFillMode: 'both',
        }}>
        <Text variant="headline">Zona conquistada</Text>
        <Text variant="lead" muted>
          {zone} · +{rp} RP
        </Text>
      </Animated.View>
    </View>
  );
}
