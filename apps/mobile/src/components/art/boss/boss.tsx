import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { expand, pivot, recolorPrims, resolveQuality, type ArtNode, type Prim, type Quality, type QualityProp } from '../neon/core';
import { ART, VILLAIN } from '../neon/palette';
import { ArtFrame, ArtLayer, ArtSvg, originOf, StaticArt, type ArtA11y, type ArtBox, type ArtPartStyle } from '../neon/render';
import { BOSS_BOX, BOSS_NAMES, BOSS_PIVOTS, BOSS_STATE_LABELS, bossBodyNodes, bossNodes, bossParts, type BossDamage, type BossId, type BossState } from './boss-art';

export type BossPart = keyof typeof BOSS_PIVOTS;

export type BossProps = ArtA11y & {
  id: BossId;
  state?: BossState;
  /** Camadas de rachadura: 0 (inteiro), 1 e 2. Quem decide o nível é a tela (sem lógica de jogo aqui). */
  dano?: BossDamage;
  size?: number;
  /** Cor do contorno; padrão: o violeta dos vilões. */
  color?: string;
  quality?: QualityProp;
  /** "Parado" vivo: flutua ±3 e o Mormaço gira os raios. Fica parado com "Reduzir movimento". */
  animated?: boolean;
  /** Estilos animados da E5 por grupo (`corpo` e `raios`), com o pivô em `BOSS_PIVOTS`. */
  parts?: Partial<Record<BossPart, ArtPartStyle>>;
  /** Esconde do leitor de tela (quando o texto ao lado já diz o nome e o estado). */
  decorative?: boolean;
  /**
   * Silhueta da mesma arte numa cor só (`true` = branco): o clarão do golpe (`bossFlash` da E5), empilhado
   * sobre o chefão com a opacidade indo de 1 a 0. Decorativa, a menos que receba `accessibilityLabel`.
   */
  silhouette?: boolean | string;
};

/** Silhueta: a mesma arte numa cor só. */
function paint(prims: Prim[], flat: string | undefined): Prim[] {
  return flat ? recolorPrims(prims, flat) : prims;
}

/** Rótulo padrão para o leitor de tela: "Chefão Mormaço, furioso". */
export function bossLabel(id: BossId, state: BossState): string {
  return `Chefão ${BOSS_NAMES[id]}, ${BOSS_STATE_LABELS[state]}`;
}

/**
 * Chefão da Raid (Soneca, Rei Buzina, Fuligem, Mormaço, Paredão) em 4 estados e 3 níveis de dano.
 * Informativo por padrão (`accessibilityLabel` com nome e estado).
 */
export function Boss({
  id,
  state = 'parado',
  dano = 0,
  size = 160,
  color = VILLAIN,
  quality,
  animated = false,
  parts,
  decorative,
  silhouette,
  accessibilityLabel,
  ...rest
}: BossProps) {
  const q = resolveQuality(quality, size);
  const box: ArtBox = { ...BOSS_BOX, width: size };
  const flat = silhouette ? (silhouette === true ? ART.white : silhouette) : undefined;
  const a11y: ArtA11y = { ...rest, accessibilityLabel: decorative ? undefined : (accessibilityLabel ?? (flat ? undefined : bossLabel(id, state))) };
  if (!animated && !parts) return <StaticArt box={box} prims={paint(expand((flat ? bossBodyNodes : bossNodes)(id, state, dano, color), q), flat)} {...a11y} />;
  return <BossLayers id={id} state={state} dano={dano} color={color} q={q} flat={flat} box={box} animated={animated} parts={parts} a11y={a11y} />;
}

function BossLayers({
  id,
  state,
  dano,
  color,
  q,
  flat,
  box,
  animated,
  parts,
  a11y,
}: {
  id: BossId;
  state: BossState;
  dano: BossDamage;
  color: string;
  q: Quality;
  flat?: string;
  box: ArtBox;
  animated: boolean;
  parts?: BossProps['parts'];
  a11y: ArtA11y;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced && state !== 'derrotado';
  const spins = id === 'mormaco';
  const float = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!live) return;
    const ease = Easing.inOut(Easing.sin);
    float.set(withSequence(withTiming(1, { duration: 600, easing: ease }), withRepeat(withTiming(-1, { duration: 1200, easing: ease }), -1, true)));
    if (spins) spin.set(withRepeat(withTiming(360, { duration: 40000, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(float);
      cancelAnimation(spin);
      float.set(0);
      spin.set(0);
    };
  }, [live, spins, float, spin]);

  const k = box.width / box.vbW;
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 3 * k * float.get() }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  const p = bossParts(id, state, dano, color);
  const posed = (nodes: ArtNode[]) => paint(expand(p.pose ? [pivot(nodes, p.pose)] : nodes, q), flat);
  const P = BOSS_PIVOTS;
  return (
    <ArtFrame box={box} {...a11y}>
      {flat ? null : <ArtSvg box={box} prims={expand(p.back, q)} />}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: originOf(box, P.corpo.x, P.corpo.y) }, floatStyle, parts?.corpo]}>
        {p.raios.length ? <ArtLayer box={box} prims={posed(p.raios)} origin={originOf(box, P.raios.x, P.raios.y)} style={[spinStyle, parts?.raios]} /> : null}
        <ArtLayer box={box} prims={posed(p.corpo)} />
      </Animated.View>
    </ArtFrame>
  );
}
