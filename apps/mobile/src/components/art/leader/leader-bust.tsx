import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FactionId } from '@/domain/types';

import { expand, pivot, resolveQuality, type ArtNode, type QualityProp } from '../neon/core';
import { ART } from '../neon/palette';
import { ArtFrame, ArtLayer, ArtSvg, originOf, StaticArt, type ArtA11y, type ArtBox, type ArtPartStyle } from '../neon/render';
import { LEADER_BOX, LEADER_PIVOTS, leaderNodes, leaderParts, type LeaderPose } from './leader-art';

export type LeaderPart = keyof typeof LEADER_PIVOTS;

export type LeaderBustProps = ArtA11y & {
  team: FactionId;
  /** `parado` (boca fechada) ou `falando` (boca aberta + gesto de mão). */
  pose?: LeaderPose;
  /** Largura em pontos (a altura segue o viewBox 200 × 220). */
  size?: number;
  /** Cor do traço; padrão: a neon do time. */
  color?: string;
  quality?: QualityProp;
  /**
   * "Parado" vivo: respira, balança a cabeça e pisca; no `falando`, a boca abre e fecha e a mão acena.
   * Fica parado com "Reduzir movimento".
   */
  animated?: boolean;
  /**
   * Estilos animados da E5 (resultado de `useAnimatedStyle`) por grupo, com o pivô em `LEADER_PIVOTS`:
   * `corpo`, `cabeca`, `olhos`, `boca` (as 2 bocas juntas) e `mao` (só no `falando`).
   */
  parts?: Partial<Record<LeaderPart, ArtPartStyle>>;
};

/** Ritmo da fala (ms por sílaba): abre e fecha com pausas, para não parecer um pisca-pisca. */
const TALK = [140, 120, 160, 110, 200, 130, 420] as const;

/**
 * Busto do líder do time (Íris Valente, Téo Faria, Nara Lis ou Bento Rocha) em 2 poses. Sem lógica de jogo:
 * quem decide a pose é a tela. Decorativo por padrão (o nome e a fala vão em `Text` ao lado); com
 * `accessibilityLabel`, vira imagem. Estático por padrão; com `animated` ou `parts`, vira camadas.
 */
export function LeaderBust({ team, pose = 'parado', size = 140, color, quality, animated = false, parts, ...a11y }: LeaderBustProps) {
  const c = color ?? ART.team[team];
  const q = resolveQuality(quality, size);
  const box: ArtBox = { ...LEADER_BOX, width: size };
  if (!animated && !parts) return <StaticArt box={box} prims={expand(leaderNodes(team, pose, c), q)} {...a11y} />;
  return <LeaderLayers team={team} pose={pose} color={c} q={q} box={box} animated={animated} parts={parts} a11y={a11y} />;
}

function LeaderLayers({
  team,
  pose,
  color,
  q,
  box,
  animated,
  parts,
  a11y,
}: {
  team: FactionId;
  pose: LeaderPose;
  color: string;
  q: ReturnType<typeof resolveQuality>;
  box: ArtBox;
  animated: boolean;
  parts?: LeaderBustProps['parts'];
  a11y: ArtA11y;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const talking = pose === 'falando';
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const blink = useSharedValue(1);
  /** 1 = boca aberta, 0 = fechada. Sem animação, a boca fica como a pose manda. */
  const mouth = useSharedValue(talking ? 1 : 0);
  const wave = useSharedValue(0);

  useEffect(() => {
    if (!live) return;
    const ease = Easing.inOut(Easing.sin);
    breath.set(withRepeat(withTiming(1, { duration: 2200, easing: ease }), -1, true));
    sway.set(withDelay(800, withSequence(withTiming(1, { duration: 1200, easing: ease }), withRepeat(withTiming(-1, { duration: 2400, easing: ease }), -1, true))));
    blink.set(withRepeat(withSequence(withDelay(3400, withTiming(0.1, { duration: 60 })), withTiming(1, { duration: 60 })), -1, false));
    if (talking) {
      const steps = TALK.map((d, i) => withTiming(i % 2 ? 1 : 0, { duration: d }));
      mouth.set(withRepeat(withSequence(...steps), -1, false));
      wave.set(withSequence(withTiming(1, { duration: 260, easing: ease }), withRepeat(withTiming(-1, { duration: 520, easing: ease }), -1, true)));
    }
    return () => {
      [breath, sway, blink, mouth, wave].forEach((v) => cancelAnimation(v));
      breath.set(0);
      sway.set(0);
      blink.set(1);
      mouth.set(talking ? 1 : 0);
      wave.set(0);
    };
  }, [live, talking, breath, sway, blink, mouth, wave]);

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 + 0.012 * breath.get() }] }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.get() * 1.2}deg` }] }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));
  const openStyle = useAnimatedStyle(() => ({ opacity: mouth.get() }));
  const closedStyle = useAnimatedStyle(() => ({ opacity: 1 - mouth.get() }));
  const handStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wave.get() * 4}deg` }] }));

  const p = leaderParts(team, pose, color);
  const head = (nodes: ArtNode[]) => expand([pivot(nodes, p.tilt)], q);
  const P = LEADER_PIVOTS;
  return (
    <ArtFrame box={box} {...a11y}>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: originOf(box, P.corpo.x, P.corpo.y) }, bodyStyle, parts?.corpo]}>
        <ArtSvg box={box} prims={expand(p.back, q)} />
        <ArtLayer box={box} prims={head(p.head.base)} origin={originOf(box, P.cabeca.x, P.cabeca.y)} style={[headStyle, parts?.cabeca]}>
          <ArtLayer box={box} prims={head(p.head.eyes)} origin={originOf(box, P.olhos.x, P.olhos.y)} style={[eyeStyle, parts?.olhos]} />
          <ArtLayer box={box} prims={head(p.head.top)} />
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: originOf(box, P.boca.x, P.boca.y) }, parts?.boca]}>
            <ArtLayer box={box} prims={head(p.head.closed)} style={closedStyle} />
            <ArtLayer box={box} prims={head(p.head.open)} style={openStyle} />
          </Animated.View>
        </ArtLayer>
        {p.hand.length ? <ArtLayer box={box} prims={expand(p.hand, q)} origin={originOf(box, P.mao.x, P.mao.y)} style={[handStyle, parts?.mao]} /> : null}
      </Animated.View>
    </ArtFrame>
  );
}
