import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { enterAnimation, ProgressBar, RevealText } from '@/components/motion';
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

/**
 * Barra de progresso (vida do raid, vagas da crew). v2 (T7.2.7): é o `ProgressBar` da E5, só com transform
 * (`scaleX`), no lugar da barra que animava `width`.
 */
export function GrowBar({
  value,
  color,
  height = 8,
  delay = 0,
  testID,
  glow,
  accessibilityLabel,
}: {
  value: number;
  color: string;
  height?: number;
  delay?: number;
  testID?: string;
  glow?: boolean;
  accessibilityLabel?: string;
}) {
  const pct = clampFraction(value);
  return (
    <ProgressBar
      testID={testID}
      value={pct}
      color={color}
      height={height}
      delay={delay}
      duration={durations.count}
      ghost={false}
      glow={glow}
      accessibilityLabel={accessibilityLabel ?? `${Math.round(pct * 100)}%`}
    />
  );
}

/**
 * Barra de domínio por time (mesmo desenho do `TerritoryBar`). Só transform: a faixa inteira cresce da
 * esquerda com `scaleX` (expo.out) e as fatias são estáticas. Reduzir movimento: aparece já cheia.
 */
export function InfluenceBar({ influence, height = 12, delay = 0 }: { influence: Influence; height?: number; delay?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const total = FACTION_IDS.reduce((s, f) => s + influence[f], 0);
  const parts = FACTION_IDS.filter((f) => influence[f] > 0).sort((a, b) => influence[b] - influence[a]);
  const label = total ? parts.map((f) => `${factions[f].name} ${Math.round((influence[f] / total) * 100)}%`).join(', ') : 'Zona neutra';
  const grow = useGrowTo(1, delay, durations.count, reduced);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.get() }] }));
  return (
    <View accessible accessibilityLabel={`Domínio: ${label}`} style={{ height, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
      <Animated.View style={[{ height: '100%', flexDirection: 'row', gap: total ? 2 : 0, transformOrigin: 'left' }, fill]}>
        {parts.map((f) => (
          <View key={f} style={{ flex: influence[f], backgroundColor: factions[f].color }} />
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Pedestal do pódio: o bloco cresce de baixo para cima com expo.out (1,5 s, momento herói). Só transform:
 * o fundo é uma camada com `scaleY` a partir da base; o conteúdo (posição, nome) entra com opacidade.
 */
export function GrowPillar({ height, delay = 0, color, children }: { height: number; delay?: number; color: string; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const grow = useGrowTo(1, delay, durations.hero, reduced);
  const bg = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.get() }] }));
  const content = useAnimatedStyle(() => ({ opacity: grow.get() }));
  return (
    <View style={{ alignSelf: 'stretch', height, alignItems: 'center', paddingTop: space[2] }}>
      <Animated.View
        style={[{ position: 'absolute', inset: 0, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, borderCurve: 'continuous', backgroundColor: color, transformOrigin: 'bottom' }, bg]}
      />
      <Animated.View style={[{ alignItems: 'center' }, content]}>{children}</Animated.View>
    </View>
  );
}

/** Valor de 0 até `target` com expo.out ao montar. Reduzir movimento: valor final direto. */
function useGrowTo(target: number, delay: number, duration: number, reduced: boolean) {
  const v = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    v.set(reduced ? target : withDelay(delay, withTiming(target, { duration, easing: easings.reveal })));
  }, [target, delay, duration, reduced, v]);
  return v;
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
