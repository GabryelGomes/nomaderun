import { expand, resolveQuality, type QualityProp } from '../neon/core';
import { StaticArt, type ArtA11y, type ArtBox } from '../neon/render';
import { MODE_ICON_BOX, modeIconNodes, type ModeIconKind } from './mode-icon-art';

export type ModeIconProps = ArtA11y & {
  kind: ModeIconKind;
  /** Lado em pontos (legível a partir de 28). */
  size?: number;
  /** Traço principal (padrão branco quente). */
  color?: string;
  /** Acento (padrão laranja). */
  accent?: string;
  quality?: QualityProp;
};

/**
 * Ícone de modo de jogo da Arena. Decorativo por padrão: o card do modo já tem o nome em texto.
 * Passe `accessibilityLabel` se o ícone aparecer sozinho.
 */
export function ModeIcon({ kind, size = 44, color, accent, quality, ...a11y }: ModeIconProps) {
  const box: ArtBox = { ...MODE_ICON_BOX, width: size };
  return <StaticArt box={box} prims={expand(modeIconNodes(kind, color, accent), resolveQuality(quality, size))} {...a11y} />;
}
