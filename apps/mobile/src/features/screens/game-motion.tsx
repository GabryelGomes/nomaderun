import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { enterAnimation, RevealText } from '@/components/motion';
import { Text } from '@/components/text';
import type { Influence } from '@/domain/territory';
import { FACTION_IDS } from '@/domain/types';
import { cssEasings, durations, easings } from '@/theme/motion';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { badgeText, clampFraction } from './game-motion-math';

/**
 * Peças de motion das telas de jogo (T6.3, D-54). Ficam na feature porque são específicas do jogo
 * (barras de influência/vida, pódio, troca de filtro, contador do sino); o resto vem de `@/components/motion`.
 */

/** Valor que cresce até `target` com expo.out ao montar e quando muda. Reduzir movimento: valor final direto. */
function useGrowTo(target: number, delay: number, duration: number) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      v.set(target);
      return;
    }
    v.set(withDelay(delay, withTiming(target, { duration, easing: easings.reveal })));
  }, [target, delay, duration, reduced, v]);
  return { v, reduced };
}

/** Barra de progresso (vida do raid, vagas da crew) que cresce com expo.out. Mesmo desenho do `ProgressBar`. */
export function GrowBar({ value, color, height = 8, delay = 0, testID, glow }: { value: number; color: string; height?: number; delay?: number; testID?: string; glow?: boolean }) {
  const { colors } = useTheme();
  const pct = clampFraction(value) * 100;
  const { v, reduced } = useGrowTo(pct, delay, durations.count);
  const fill = useAnimatedStyle(() => ({ width: `${v.get()}%` }));
  return (
    <Animated.View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      // `glow` (neon, D-59): brilho laranja em volta da trilha (o recorte da barra cortaria o do preenchimento).
      style={[{ height, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceSunken, boxShadow: glow ? '0 0 16px rgba(255,106,19,0.45)' : undefined }, reduced ? enterAnimation({ reduced: true }) : null]}>
      <Animated.View style={[{ height: '100%', backgroundColor: color, borderRadius: radius.pill }, fill]} />
    </Animated.View>
  );
}

/** Barra de influência por time (mesmo desenho do `TerritoryBar`) que cresce da esquerda com expo.out. */
export function InfluenceBar({ influence, height = 12, delay = 0 }: { influence: Influence; height?: number; delay?: number }) {
  const { colors } = useTheme();
  const total = FACTION_IDS.reduce((s, f) => s + influence[f], 0);
  const parts = FACTION_IDS.filter((f) => influence[f] > 0).sort((a, b) => influence[b] - influence[a]);
  const label = total ? parts.map((f) => `${factions[f].name} ${Math.round((influence[f] / total) * 100)}%`).join(', ') : 'Zona neutra';
  const { v } = useGrowTo(100, delay, durations.count);
  const fill = useAnimatedStyle(() => ({ width: `${v.get()}%` }));
  return (
    <View accessible accessibilityLabel={`Influência: ${label}`} style={{ height, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
      <Animated.View style={[{ height: '100%', flexDirection: 'row', gap: total ? 2 : 0 }, fill]}>
        {parts.map((f) => (
          <View key={f} style={{ flex: influence[f], backgroundColor: factions[f].color }} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Pedestal do pódio: a altura cresce de baixo para cima com expo.out (1,5 s, momento herói). */
export function GrowPillar({ height, delay = 0, color, children }: { height: number; delay?: number; color: string; children?: ReactNode }) {
  const { v } = useGrowTo(height, delay, durations.hero);
  const grow = useAnimatedStyle(() => ({ height: v.get() }));
  return (
    <Animated.View
      style={[
        {
          alignSelf: 'stretch',
          borderTopLeftRadius: radius.md,
          borderTopRightRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: color,
          alignItems: 'center',
          paddingTop: space[2],
          overflow: 'hidden',
        },
        grow,
      ]}>
      {children}
    </Animated.View>
  );
}

const SWAP_IN = { from: { opacity: 0 }, to: { opacity: 1 } } as const;

/**
 * Troca suave de conteúdo quando um filtro muda (power2.inOut, 300 ms, só opacidade — vale igual com
 * "Reduzir movimento"). `swapKey` diferente remonta o conteúdo com o fade.
 */
export function SwapFade({ swapKey, children, style, testID }: { swapKey: string; children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <Animated.View key={swapKey} testID={testID} style={[{ animationName: SWAP_IN, animationDuration: durations.state, animationTimingFunction: cssEasings.swap, animationFillMode: 'both' }, style]}>
      {children}
    </Animated.View>
  );
}

const POP = { from: { opacity: 0, transform: [{ scale: 0.4 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } } as const;

/** Contador do sino: entra com escala (power2.out) a cada número novo. Reduzir movimento: só fade, nada pulsa. */
export function CounterBadge({ unread, color, textColor }: { unread: number; color: string; textColor: string }) {
  const reduced = useReducedMotion();
  const text = badgeText(unread);
  if (!text) return null;
  const anim = reduced
    ? enterAnimation({ reduced: true })
    : { animationName: POP, animationDuration: durations.state, animationTimingFunction: cssEasings.standard, animationFillMode: 'both' as const };
  return (
    <Animated.View
      key={text}
      pointerEvents="none"
      style={[
        { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color },
        anim,
      ]}>
      <Text variant="label" color={textColor} tabular>
        {text}
      </Text>
    </Animated.View>
  );
}

/** Título de seção (mesmo desenho do `SectionHeader`) revelado por palavras. `action` fica à direita. */
export function SectionTitle({ title, action, delay = 0, testID }: { title: string; action?: ReactNode; delay?: number; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3], paddingHorizontal: space[1] }}>
      <RevealText variant="title" header delay={delay} testID={testID} style={{ flexShrink: 1 }}>
        {title}
      </RevealText>
      {action}
    </View>
  );
}
