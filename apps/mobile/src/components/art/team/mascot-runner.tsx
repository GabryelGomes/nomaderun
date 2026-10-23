import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { FactionId } from '@/domain/types';

import { expand, resolveQuality, type QualityProp } from '../neon/core';
import { ART } from '../neon/palette';
import { ArtFrame, ArtLayer, originOf, StaticArt, type ArtA11y, type ArtBox, type ArtPartStyle } from '../neon/render';
import { RUNNER_BOX, RUNNER_PIVOTS, runnerNodes, runnerParts } from './runner-art';

export type RunnerPart = keyof typeof RUNNER_PIVOTS;

export type MascotRunnerProps = ArtA11y & {
  team: FactionId;
  /** Largura em pontos (a altura segue o viewBox 240 × 220). */
  size?: number;
  /** Cor do traço; padrão: a neon do time. */
  color?: string;
  /**
   * Qualidade do traço. Na tela de escolha com os 4 juntos, use `leve`; `completo` para o herói (1 por tela).
   * `auto` (padrão) escolhe pelo tamanho.
   */
  quality?: QualityProp;
  /**
   * Passada viva: o corpo inteiro quica e inclina (`Animated.View`, só transform) e o rastro desliza para
   * trás. Nenhum path é animado. Fica parado com "Reduzir movimento".
   */
  animated?: boolean;
  /** Estilos animados da E5 por grupo (`corpo` e `rastro`), com o pivô em `RUNNER_PIVOTS`. */
  parts?: Partial<Record<RunnerPart, ArtPartStyle>>;
};

/** Meia passada (ms): ~2,9 passos por segundo, cadência de corrida leve. */
const STEP = 170;

/**
 * Mascote de corpo inteiro em corrida (Lume, Faísca, Breu ou Faro), para a escolha de time. Estático por
 * padrão (um `Svg`); com `animated` ou `parts`, vira 2 camadas: `rastro` (atrás) e `corpo`.
 */
export function MascotRunner({ team, size = 200, color, quality, animated = false, parts, ...a11y }: MascotRunnerProps) {
  const c = color ?? ART.team[team];
  const q = resolveQuality(quality, size);
  const box: ArtBox = { ...RUNNER_BOX, width: size };
  if (!animated && !parts) return <StaticArt box={box} prims={expand(runnerNodes(team, c), q)} {...a11y} />;
  return <RunnerLayers team={team} color={c} q={q} box={box} animated={animated} parts={parts} a11y={a11y} />;
}

function RunnerLayers({
  team,
  color,
  q,
  box,
  animated,
  parts,
  a11y,
}: {
  team: FactionId;
  color: string;
  q: ReturnType<typeof resolveQuality>;
  box: ArtBox;
  animated: boolean;
  parts?: MascotRunnerProps['parts'];
  a11y: ArtA11y;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const step = useSharedValue(0);
  const trail = useSharedValue(0);

  useEffect(() => {
    if (!live) return;
    step.set(withRepeat(withTiming(1, { duration: STEP, easing: Easing.inOut(Easing.sin) }), -1, true));
    trail.set(withRepeat(withTiming(1, { duration: STEP * 4, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(step);
      cancelAnimation(trail);
      step.set(0);
      trail.set(0);
    };
  }, [live, step, trail]);

  const k = box.width / box.vbW;
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * k * step.get() }, { rotate: `${step.get() * 1.5}deg` }] }));
  const trailStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -10 * k * trail.get() }], opacity: 1 - 0.5 * trail.get() }));

  const p = runnerParts(team, color);
  const P = RUNNER_PIVOTS;
  return (
    <ArtFrame box={box} {...a11y}>
      <ArtLayer box={box} prims={expand(p.rastro, q)} origin={originOf(box, P.rastro.x, P.rastro.y)} style={[trailStyle, parts?.rastro]} />
      <ArtLayer box={box} prims={expand(p.corpo, q)} origin={originOf(box, P.corpo.x, P.corpo.y)} style={[bodyStyle, parts?.corpo]} />
    </ArtFrame>
  );
}
