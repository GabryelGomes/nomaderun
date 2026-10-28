import { useEffect } from 'react';
import {
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

import { expand, resolveQuality, type ArtNode, type Quality, type QualityProp } from '../neon/core';
import { ArtFrame, ArtLayer, originOf, StaticArt, type ArtA11y, type ArtBox, type ArtPartStyle } from '../neon/render';
import { STREAK_BOX, STREAK_PIVOTS, streakLayerParts, type StreakLayer, type StreakState } from './streak-art';

/** Grupos animáveis: `chama` (pivô na base), `gelo` (pivô no centro do cristal) e `brilho` (só opacidade). */
export type StreakPart = 'chama' | 'gelo' | 'brilho';

export type StreakArtProps = ArtA11y & {
  /** `acesa` = semana garantida; `fraca` = falta 1 atividade; `gelo` = congelamento usado. */
  state: StreakState;
  /** Largura em pontos (altura = 7/6 da largura, viewBox 120 × 140). */
  size?: number;
  /** Cor da chama (padrão laranja). O gelo é sempre azul-gelo (`ICE`). */
  color?: string;
  quality?: QualityProp;
  /**
   * Só uma camada, na caixa inteira: `chama` (fundo + chama) ou `gelo` (o cristal translúcido, para pôr por
   * cima da chama). Para os slots `flame` e `ice` do `StreakFlame` (E5).
   */
  layer?: StreakLayer;
  /**
   * "Parado" vivo: a acesa tremula (escala na base e giro curto) e as faíscas piscam; a fraca oscila devagar,
   * quase apagando, e o "+" pulsa; o gelo só cintila. Fica parado com "Reduzir movimento".
   */
  animated?: boolean;
  /** Estilos animados da E5 (`useAnimatedStyle`) para `chama`, `gelo` e `brilho`, com o pivô já certo. */
  parts?: Partial<Record<StreakPart, ArtPartStyle>>;
};

/** Rótulo para quem usa a arte como informação (a frase da tela, de preferência, explica o estado). */
export function streakLabel(state: StreakState): string {
  return state === 'acesa' ? 'Sequência garantida nesta semana' : state === 'fraca' ? 'Falta 1 atividade para garantir a semana' : 'Congelamento usado: sequência salva';
}

/**
 * Chama e gelo da sequência semanal (T7.3.4). Decorativa por padrão (o `StreakFlame` e as telas dizem o estado
 * em texto); com `accessibilityLabel`, vira imagem. Estática = 1 `Svg`; animada = até 3 (fundo, chama, brilho).
 */
export function StreakArt({ state, size = 96, color, quality, layer, animated = false, parts, ...a11y }: StreakArtProps) {
  const q = resolveQuality(quality, size);
  const box: ArtBox = { ...STREAK_BOX, width: size };
  const p = streakLayerParts(state, layer, color);
  if (!animated && !parts) return <StaticArt box={box} prims={expand([...p.fundo, ...p.chama, ...p.gelo, ...p.brilho], q)} {...a11y} />;
  return <StreakLayers state={state} q={q} box={box} p={p} animated={animated} parts={parts} a11y={a11y} />;
}

/** Ritmo do "parado" por estado (ms): meia-volta da chama, do giro e do brilho. */
const RHYTHM: Record<StreakState, { flicker: number; sway: number; glint: number; low: number; high: number; tilt: number }> = {
  acesa: { flicker: 320, sway: 470, glint: 650, low: 1, high: 1.06, tilt: 1.6 },
  fraca: { flicker: 700, sway: 560, glint: 450, low: 0.93, high: 1.02, tilt: 2.4 },
  gelo: { flicker: 0, sway: 0, glint: 1200, low: 1, high: 1, tilt: 0 },
};

function StreakLayers({
  state,
  q,
  box,
  p,
  animated,
  parts,
  a11y,
}: {
  state: StreakState;
  q: Quality;
  box: ArtBox;
  p: ReturnType<typeof streakLayerParts>;
  animated: boolean;
  parts?: StreakArtProps['parts'];
  a11y: ArtA11y;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const flicker = useSharedValue(0);
  const sway = useSharedValue(0);
  const glint = useSharedValue(1);
  const r = RHYTHM[state];

  useEffect(() => {
    if (!live) return;
    const ease = Easing.inOut(Easing.sin);
    if (r.flicker) {
      // Chama: sobe e desce num ritmo irregular (dois períodos que não se alinham).
      flicker.set(withRepeat(withSequence(withTiming(1, { duration: r.flicker, easing: ease }), withTiming(0.35, { duration: r.flicker * 0.7, easing: ease }), withTiming(0, { duration: r.flicker * 1.3, easing: ease })), -1, false));
      sway.set(withRepeat(withSequence(withTiming(1, { duration: r.sway, easing: ease }), withTiming(-1, { duration: r.sway * 2, easing: ease }), withTiming(0, { duration: r.sway, easing: ease })), -1, false));
    }
    glint.set(withDelay(300, withRepeat(withTiming(0.35, { duration: r.glint, easing: ease }), -1, true)));
    return () => {
      cancelAnimation(flicker);
      cancelAnimation(sway);
      cancelAnimation(glint);
      flicker.set(0);
      sway.set(0);
      glint.set(1);
    };
  }, [live, r, flicker, sway, glint]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: r.low + (r.high - r.low) * flicker.get() }, { rotate: `${sway.get() * r.tilt}deg` }],
  }));
  const glintStyle = useAnimatedStyle(() => ({ opacity: glint.get() }));

  const prims = (nodes: ArtNode[]) => expand(nodes, q);
  const P = STREAK_PIVOTS;
  return (
    <ArtFrame box={box} {...a11y}>
      {p.fundo.length ? <ArtLayer box={box} prims={prims(p.fundo)} /> : null}
      {p.chama.length ? <ArtLayer box={box} prims={prims(p.chama)} origin={originOf(box, P.chama.x, P.chama.y)} style={[flameStyle, parts?.chama]} /> : null}
      {p.gelo.length ? <ArtLayer box={box} prims={prims(p.gelo)} origin={originOf(box, P.gelo.x, P.gelo.y)} style={parts?.gelo} /> : null}
      {p.brilho.length ? <ArtLayer box={box} prims={prims(p.brilho)} style={[glintStyle, parts?.brilho]} /> : null}
    </ArtFrame>
  );
}

