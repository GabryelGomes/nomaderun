import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { type CSSAnimationKeyframes } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { haptic } from '@/components/motion/haptics';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import { FACTION_IDS, type FactionId, type LatLng } from '@/domain/types';
import { cssEasings, durations, springCss, springs } from '@/theme/motion';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { flipLightDelays, flippedZones, NEIGHBORHOOD_FLIP as F } from './f8-choreography';
import { kf } from './moment';
import { projectNeighborhood, type NeighborhoodZone, type ProjectedZone } from './neighborhood-math';

export type NeighborhoodFlipProps = {
  /** Rota da corrida (a própria pessoa; nunca a de outra). */
  path: readonly LatLng[];
  /** Zonas que a corrida tocou, com o dono antes e depois (resultado oficial). */
  zones: readonly NeighborhoodZone[];
  /** Time da pessoa (cor da rota e texto do leitor de tela). */
  team: FactionId;
  /** Cor da rota (padrão: a do time). */
  routeColor?: string;
  height?: number;
  /** Atraso do início da transição (ms). */
  delay?: number;
  /** Vibra 1× quando a 1ª zona acende (padrão: sim). */
  haptics?: boolean;
  testID?: string;
};

const FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } };
const FADE_OUT = { from: { opacity: 1 }, to: { opacity: 0 } };
const NEUTRAL = 'neutro';

/** Texto do leitor de tela: quantas zonas mudaram para o time. */
export function neighborhoodFlipLabel(count: number, team: FactionId): string {
  const n = Math.max(0, Math.round(count));
  if (n === 0) return 'Antes e depois do bairro: nenhuma zona mudou de dono.';
  return `Antes e depois do bairro: ${n === 1 ? '1 zona agora é' : `${n} zonas agora são`} dos ${factions[team].name}.`;
}

/**
 * "Antes e depois do bairro" no resumo (F8 · C1): o mapa simplificado da corrida (rota + manchas suaves das zonas,
 * sem grade) troca do antes para o depois em 800 ms; as zonas que viraram acendem uma a uma (120 ms, no máximo 5)
 * com um anel que pulsa. Custo: 3 `Svg` + até 5 anéis (só transform e opacidade). "Reduzir movimento": o depois
 * aparece com um fade de 150 ms, sem anéis.
 */
export function NeighborhoodFlip({ path, zones, team, routeColor, height = 180, delay = 0, haptics = true, testID }: NeighborhoodFlipProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionSetting();
  const [width, setWidth] = useState(0);
  const scene = useMemo(() => (width > 0 ? projectNeighborhood(path, zones, width, height) : null), [path, zones, width, height]);
  const flipped = useMemo(() => flippedZones(scene?.zones ?? []), [scene]);
  const lights = flipLightDelays(flipped.length, reduced);
  const firstLight = lights.find((d): d is number => d !== null) ?? null;
  const route = routeColor ?? factions[team].color;

  useEffect(() => {
    if (!haptics || flipped.length === 0) return;
    const t = setTimeout(() => haptic('tap'), reduced ? 0 : delay + (firstLight ?? 0));
    return () => clearTimeout(t);
  }, [haptics, flipped.length, reduced, delay, firstLight]);

  const fill = (owner: FactionId | null) => `url(#nb-${owner ?? NEUTRAL})`;
  const layer = (which: 'before' | 'after') => (
    <Svg width={width} height={height}>
      <Defs>
        {[...FACTION_IDS, null].map((f) => (
          <RadialGradient key={f ?? NEUTRAL} id={`nb-${f ?? NEUTRAL}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={f ? factions[f].color : colors.textSecondary} stopOpacity={f ? 0.7 : 0.28} />
            <Stop offset="0.7" stopColor={f ? factions[f].color : colors.textSecondary} stopOpacity={f ? 0.35 : 0.12} />
            <Stop offset="1" stopColor={f ? factions[f].color : colors.textSecondary} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {scene?.zones.map((z) => <Circle key={z.id} cx={z.x} cy={z.y} r={scene.radius * 1.35} fill={fill(which === 'before' ? z.before : z.after)} />)}
    </Svg>
  );
  const timing = (kfs: CSSAnimationKeyframes, ms: number, at: number) => ({
    animationName: kf(kfs),
    animationDuration: reduced ? durations.reducedFade : ms,
    animationDelay: reduced ? 0 : at,
    animationTimingFunction: cssEasings.standard,
    animationFillMode: 'both' as const,
  });

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={neighborhoodFlipLabel(flipped.length, team)}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ height, width: '100%', overflow: 'hidden', borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceSunken }}>
      {scene ? (
        <>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, timing(FADE_OUT, F.crossMs, delay)]}>
            {layer('before')}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, timing(FADE_IN, F.crossMs, delay)]}>
            {layer('after')}
          </Animated.View>
          {scene.route ? (
            <Svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
              <Path d={scene.route} stroke={route} strokeOpacity={0.3} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Path d={scene.route} stroke={route} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          ) : null}
          {flipped.map((z, i) => (lights[i] === null ? null : <FlipLight key={z.id} zone={z} r={scene.radius} at={delay + (lights[i] as number)} testID={testID ? `${testID}-acende-${i}` : undefined} />))}
        </>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', top: space[2], left: space[2] }}>
        <Animated.View style={timing(FADE_OUT, F.crossMs / 2, delay)}>
          <Tag text="Antes" />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, timing(FADE_IN, F.crossMs / 2, delay + F.crossMs / 2)]}>
          <Tag text="Depois" />
        </Animated.View>
      </View>
    </View>
  );
}

function Tag({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface }}>
      <Text variant="label" muted>
        {text.toUpperCase()}
      </Text>
    </View>
  );
}

/** Zona virada que acende: a mancha cresce com mola e um anel pulsa e some. Só transform e opacidade. */
function FlipLight({ zone, r, at, testID }: { zone: ProjectedZone; r: number; at: number; testID?: string }) {
  const color = zone.after ? factions[zone.after].color : '#FFFFFF';
  const d = r * 2;
  return (
    <View testID={testID} pointerEvents="none" style={{ position: 'absolute', left: zone.x - r, top: zone.y - r, width: d, height: d }}>
      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: r,
          backgroundColor: color,
          animationName: kf({ '0%': { opacity: 0, transform: [{ scale: 0.4 }] }, '45%': { opacity: 0.85, transform: [{ scale: 1.05 }] }, '100%': { opacity: 0.55, transform: [{ scale: 1 }] } }),
          animationDuration: springs.snappy.duration,
          animationDelay: at,
          animationTimingFunction: springCss('snappy'),
          animationFillMode: 'both',
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: r,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          opacity: 0,
          animationName: kf({ from: { opacity: 0.9, transform: [{ scale: 0.8 }] }, to: { opacity: 0, transform: [{ scale: 1.9 }] } }),
          animationDuration: F.lightMs,
          animationDelay: at,
          animationTimingFunction: cssEasings.standard,
          animationFillMode: 'forwards',
        }}
      />
    </View>
  );
}
