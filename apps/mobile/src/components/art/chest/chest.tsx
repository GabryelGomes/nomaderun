import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { expand, pivot, resolveQuality, usesPrism, type ArtNode, type QualityProp } from '../neon/core';
import { ArtFrame, ArtLayer, originOf, StaticArt, useGradId, type ArtA11y, type ArtBox, type ArtPartStyle } from '../neon/render';
import { CHEST_BOX, CHEST_LABELS, CHEST_PIVOTS, chestLayerNodes, chestNodes, chestParts, type ChestLayer, type ChestRarity, type ChestState } from './chest-art';

export type ChestPart = 'tampa' | 'corpo';

export type ChestProps = ArtA11y & {
  rarity: ChestRarity;
  state?: ChestState;
  size?: number;
  /** Troca a cor da raridade (padrão: branco quente, laranja ou prisma). */
  color?: string;
  quality?: QualityProp;
  /**
   * Estilos animados da E5: `tampa` (gira na dobradiça, `CHEST_PIVOTS.tampa`) e `corpo` (o baú inteiro,
   * para o tremor). Com `parts`, o baú vira 4 camadas: fundo, corpo, tampa e frente.
   */
  parts?: Partial<Record<ChestPart, ArtPartStyle>>;
  /**
   * Só uma camada, na caixa inteira (as camadas empilhadas se alinham sozinhas): `corpo` (fundo, corpo,
   * cadeado e chão), `tampa` (pivô na dobradiça) ou `item` (o prêmio que sobe, pivô no centro). Para os
   * slots `chest`, `lid` e `item` do `ChestOpening` (E5). Decorativa, a menos que receba `accessibilityLabel`.
   */
  layer?: ChestLayer;
  decorative?: boolean;
};

export function chestLabel(rarity: ChestRarity, state: ChestState): string {
  return `Baú ${CHEST_LABELS[rarity]}, ${state}`;
}

/** Baú do dia em 3 raridades e 3 estados. Informativo por padrão ("Baú raro, fechado"). */
export function Chest({ rarity, state = 'fechado', size = 120, color, quality, parts, layer, decorative, accessibilityLabel, ...rest }: ChestProps) {
  const q = resolveQuality(quality, size);
  const box: ArtBox = { ...CHEST_BOX, width: size };
  const gradId = useGradId('bau');
  const a11y: ArtA11y = { ...rest, accessibilityLabel: decorative ? undefined : (accessibilityLabel ?? (layer ? undefined : chestLabel(rarity, state))) };
  if (layer) {
    const nodes = chestLayerNodes(rarity, state, layer, color);
    return <StaticArt box={box} prims={expand(nodes, q, gradId)} gradId={usesPrism(nodes) ? gradId : undefined} {...a11y} />;
  }
  if (!parts) {
    const nodes = chestNodes(rarity, state, color);
    return <StaticArt box={box} prims={expand(nodes, q, gradId)} gradId={usesPrism(nodes) ? gradId : undefined} {...a11y} />;
  }
  const p = chestParts(rarity, state, color);
  // Cada camada é um Svg próprio: o gradiente "prisma" precisa de um id por camada.
  const layerOf = (nodes: ArtNode[], suffix: string) => {
    const id = gradId + suffix;
    return { prims: expand(p.pose ? [pivot(nodes, p.pose)] : nodes, q, id), gradId: usesPrism(nodes) ? id : undefined };
  };
  const fundo = layerOf(p.fundo, 'f');
  const corpo = layerOf(p.corpo, 'c');
  const tampa = layerOf(p.tampa, 't');
  const frente = layerOf(p.frente, 'x');
  const P = CHEST_PIVOTS;
  return (
    <ArtFrame box={box} {...a11y}>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: originOf(box, P.corpo.x, P.corpo.y) }, parts.corpo]}>
        <ArtLayer box={box} {...fundo} />
        <ArtLayer box={box} {...corpo} />
        <ArtLayer box={box} {...tampa} origin={originOf(box, P.tampa.x, P.tampa.y)} style={parts.tampa} />
        <ArtLayer box={box} {...frente} />
      </Animated.View>
    </ArtFrame>
  );
}

