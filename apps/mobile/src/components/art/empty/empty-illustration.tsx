import type { FactionId } from '@/domain/types';

import { expand, resolveQuality, type QualityProp } from '../neon/core';
import { StaticArt, type ArtA11y, type ArtBox } from '../neon/render';
import { EMPTY_BOX, emptyNodes, type EmptyKind } from './empty-art';

export type EmptyArtProps = ArtA11y & {
  kind: EmptyKind;
  /** Time da pessoa: o mascote aparece em "sem notificações" (dormindo) e "sem localização". */
  team?: FactionId;
  /** Largura em pontos (altura = 2/3). */
  size?: number;
  /** Acento (padrão laranja). */
  color?: string;
  quality?: QualityProp;
};

/** Ilustração de estado vazio. Decorativa por padrão: a frase da tela explica a situação. */
export function EmptyArt({ kind, team, size = 220, color, quality, ...a11y }: EmptyArtProps) {
  const box: ArtBox = { ...EMPTY_BOX, width: size };
  return <StaticArt box={box} prims={expand(emptyNodes(kind, color, team), resolveQuality(quality, size))} {...a11y} />;
}
