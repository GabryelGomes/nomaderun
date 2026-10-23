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

import { expand, pivot, resolveQuality, type QualityProp } from '../neon/core';
import { ART } from '../neon/palette';
import { ArtFrame, ArtLayer, ArtSvg, originOf, StaticArt, type ArtA11y, type ArtBox, type ArtPartStyle } from '../neon/render';
import { MASCOT_BOX, MASCOT_PIVOTS, mascotNodes, mascotParts, type MascotPose } from './mascot-art';

export type MascotPart = keyof typeof MASCOT_PIVOTS;

export type MascotProps = ArtA11y & {
  team: FactionId;
  pose?: MascotPose;
  /** Largura em pontos (a altura segue o viewBox 200 × 220). */
  size?: number;
  /** Cor do traço; padrão: a neon do time (`neonTeam`). */
  color?: string;
  quality?: QualityProp;
  /** "Parado" vivo: respira, balança a cabeça e pisca. Fica parado com "Reduzir movimento". */
  animated?: boolean;
  /**
   * Estilos animados da E5 (resultado de `useAnimatedStyle`) para cada grupo, já com o pivô certo
   * em `transformOrigin` (`MASCOT_PIVOTS`): `corpo` (desenho inteiro), `cabeca` e `olhos`.
   */
  parts?: Partial<Record<MascotPart, ArtPartStyle>>;
};

/** Intervalos de piscada por time (ms): determinísticos, "aleatórios" entre 3 e 6 s. */
const BLINKS: Record<FactionId, readonly number[]> = {
  striders: [3200, 5200, 4100],
  volt: [2600, 4400, 3600],
  owls: [4200, 3000, 5600],
  coyotes: [3600, 4800, 2900],
};

/**
 * Mascote do time (Lume, Faísca, Breu ou Faro) em 4 poses. Sem lógica de jogo: quem decide a pose é a tela.
 * Estático por padrão (uma camada só, o mais barato); com `animated` ou `parts`, vira 4 camadas
 * (`corpo`, `cabeca`, `olhos` e o topo do rosto) que se movem por `Animated.View`.
 */
export function Mascot({ team, pose = 'parado', size = 120, color, quality, animated = false, parts, ...a11y }: MascotProps) {
  const c = color ?? ART.team[team];
  const q = resolveQuality(quality, size);
  const box: ArtBox = { ...MASCOT_BOX, width: size };
  if (!animated && !parts) return <StaticArt box={box} prims={expand(mascotNodes(team, pose, c), q)} {...a11y} />;
  return <MascotLayers team={team} pose={pose} color={c} q={q} box={box} animated={animated} parts={parts} a11y={a11y} />;
}

function MascotLayers({
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
  pose: MascotPose;
  color: string;
  q: ReturnType<typeof resolveQuality>;
  box: ArtBox;
  animated: boolean;
  parts?: MascotProps['parts'];
  a11y: ArtA11y;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const p = mascotParts(team, pose, color);
  const canBlink = p.eyesOpen;
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    if (!live) return;
    const half = pose === 'dormindo' ? 2600 : 2000;
    const ease = Easing.inOut(Easing.sin);
    breath.set(withRepeat(withTiming(1, { duration: half, easing: ease }), -1, true));
    sway.set(
      withDelay(1000, withSequence(withTiming(1, { duration: half / 2, easing: ease }), withRepeat(withTiming(-1, { duration: half, easing: ease }), -1, true))),
    );
    if (canBlink) {
      const steps = BLINKS[team].flatMap((d) => [withDelay(d, withTiming(0.1, { duration: 60 })), withTiming(1, { duration: 60 })]);
      blink.set(withRepeat(withSequence(...steps), -1, false));
    }
    return () => {
      cancelAnimation(breath);
      cancelAnimation(sway);
      cancelAnimation(blink);
      breath.set(0);
      sway.set(0);
      blink.set(1);
    };
  }, [live, pose, canBlink, team, breath, sway, blink]);

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 + 0.015 * breath.get() }] }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.get() * 1.5}deg` }] }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));

  const head = (nodes: typeof p.head.base) => expand([pivot(nodes, p.tilt)], q);
  const P = MASCOT_PIVOTS;
  return (
    <ArtFrame box={box} {...a11y}>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: originOf(box, P.corpo.x, P.corpo.y), opacity: p.dim }, bodyStyle, parts?.corpo]}>
        <ArtSvg box={box} prims={expand(p.back, q)} />
        <ArtLayer box={box} prims={head(p.head.base)} origin={originOf(box, P.cabeca.x, P.cabeca.y)} style={[headStyle, parts?.cabeca]}>
          <ArtLayer box={box} prims={head(p.head.eyes)} origin={originOf(box, P.olhos.x, P.olhos.y)} style={[eyeStyle, parts?.olhos]} />
          <ArtLayer box={box} prims={head(p.head.top)} />
        </ArtLayer>
      </Animated.View>
    </ArtFrame>
  );
}
