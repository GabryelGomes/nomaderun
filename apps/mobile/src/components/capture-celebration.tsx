import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import type { FactionId } from '@/domain/types';
import { EASE_OUT } from '@/theme/easing';
import { factions, motion, palette } from '@/theme/tokens';

import { TeamShapeGlyph } from './team-badge';
import { Text } from './text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 132;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * R;
const DRAW_MS = 600;

/**
 * The one orchestrated moment of the app (frontend-design: spend boldness in one place).
 * A ring in the team color closes around the zone like a lap, then the team mark appears;
 * haptic on the same frame the ring starts (expo-animation). Reduced motion: shown already closed.
 */
export function CaptureCelebration({ faction, zone, rp }: { faction: FactionId; zone: string; rp: number }) {
  const reduced = useReducedMotion();
  const f = factions[faction];
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  const drawn = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) drawn.set(withTiming(1, { duration: DRAW_MS, easing: EASE_OUT }));
  }, [drawn, reduced]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - drawn.get()) }));
  return (
    <View accessible accessibilityLabel={`Zona conquistada: ${zone}, mais ${rp} pontos`} style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill={f.tint} stroke={palette.line} strokeWidth={STROKE} />
          <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={f.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${LENGTH} ${LENGTH}`}
              animatedProps={ring}
            />
          </G>
        </Svg>
        <Animated.View
          style={{
            position: 'absolute',
            inset: 0,
            animationName: reduced
              ? { from: { opacity: 0 }, to: { opacity: 1 } }
              : { from: { opacity: 0, transform: [{ scale: 0.6 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
            animationDuration: reduced ? 150 : motion.spring.duration,
            animationDelay: reduced ? 0 : DRAW_MS - 120,
            animationFillMode: 'both',
          }}>
          <Svg width={SIZE} height={SIZE}>
            <TeamShapeGlyph shape={f.shape} size={SIZE} color={f.color} />
          </Svg>
        </Animated.View>
      </View>
      <Animated.View
        style={{
          alignItems: 'center',
          animationName: reduced
            ? { from: { opacity: 0 }, to: { opacity: 1 } }
            : { from: { opacity: 0, transform: [{ translateY: 10 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
          animationDuration: reduced ? 150 : 400,
          animationDelay: reduced ? 0 : DRAW_MS,
          animationFillMode: 'both',
        }}>
        <Text variant="headline">Zona conquistada</Text>
        <Text variant="lead" muted>
          +{rp} RP em {zone}
        </Text>
      </Animated.View>
    </View>
  );
}
