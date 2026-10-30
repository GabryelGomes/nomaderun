import { useMemo } from 'react';

import type { FactionId } from '@/domain/types';

import { expand, resolveQuality, type QualityProp } from '../neon/core';
import { ArtFrame, ArtSvg, type ArtA11y, type ArtBox } from '../neon/render';
import { EMBLEM_BOX, EMBLEM_MIN_SIZE, emblemNodes, resolveEmblemVariant, type EmblemVariantProp } from './emblem-art';

export type TeamEmblemProps = ArtA11y & {
  /** `null` desenha a zona neutra (anel tracejado). */
  team: FactionId | null;
  /** Largura (e altura) em pontos; padrão 24. Abaixo de 18 sobe para 18 (D-90). */
  size?: number;
  /** `auto` (padrão): < 40 mini · < 96 médio · ≥ 96 grande. */
  variant?: EmblemVariantProp;
  /** Cor do time; padrão `neonTeam[team]`. */
  color?: string;
  /** Cor do fundo onde o emblema está (as feições são desenhadas nesta cor); padrão `neon.bg`. */
  on?: string;
  /** Uma cor só: forma em `color`, cabeça em `on` (botões laranja, chips coloridos). */
  mono?: boolean;
  /** Anel tracejado vermelho por fora (zona sob ataque), o mesmo sinal do mapa. */
  attack?: boolean;
  /** Só afeta o `grande` (o rosto line-art); mini e médio são polígonos cheios, iguais em qualquer qualidade. */
  quality?: QualityProp;
};

/**
 * Emblema do time (D-90): a cabeça do mascote dentro da forma do time, que continua sendo a moldura em
 * qualquer tamanho (pista para daltônicos). Decorativo por padrão; com `accessibilityLabel` vira imagem
 * informativa (use `emblemLabel(team)`).
 */
export function TeamEmblem({ team, size = 24, variant = 'auto', color, on, mono, attack, quality, ...a11y }: TeamEmblemProps) {
  const px = Math.max(EMBLEM_MIN_SIZE, size);
  const v = resolveEmblemVariant(variant, px);
  const q = resolveQuality(quality, px);
  const prims = useMemo(() => expand(emblemNodes(team, { variant: v, size: px, color, on, mono, attack }), q), [team, v, px, color, on, mono, attack, q]);
  const box: ArtBox = { ...EMBLEM_BOX, width: px };
  return (
    <ArtFrame box={box} {...a11y}>
      <ArtSvg box={box} prims={prims} />
    </ArtFrame>
  );
}
