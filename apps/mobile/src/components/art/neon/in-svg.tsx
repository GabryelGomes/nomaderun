/**
 * Arte desenhada **dentro de um SVG maior** (contrato da E8 para o card de compartilhar): devolve um `<G>`
 * com a arte encaixada numa caixa `{ cx, cy, size }` nas unidades do SVG de fora, sem `<Image>` e sem
 * `View` (raster sai em branco no `toDataURL`). A arte cabe inteira no quadrado de lado `size`, centrada em
 * (cx, cy), mantendo a proporção do viewBox da família.
 */
import { G } from 'react-native-svg';

import { expand, fitTransform, recolorPrims, resolveQuality, type ArtNode, type QualityProp, type SvgArtBox } from './core';
import { Prims } from './render';

export { fitTransform, type SvgArtBox };

export type InSvgArtProps = {
  nodes: ArtNode[];
  vb: { vbW: number; vbH: number };
  box: SvgArtBox;
  /** `auto` usa o tamanho da caixa em unidades do SVG de fora (num card de 1080, quase sempre `completo`). */
  quality?: QualityProp;
  /** Silhueta numa cor só (ex.: o branco do flash). */
  silhouette?: string;
  opacity?: number;
};

/** Desenha nós de arte quaisquer dentro de um SVG maior. As outras funções deste arquivo usam esta. */
export function InSvgArt({ nodes, vb, box, quality, silhouette, opacity }: InSvgArtProps) {
  const { scale, x, y } = fitTransform(vb, box);
  const prims = expand(nodes, resolveQuality(quality, box.size));
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return (
    <G transform={`translate(${r(x)} ${r(y)}) scale(${r(scale)})`} opacity={opacity}>
      <Prims prims={silhouette ? recolorPrims(prims, silhouette) : prims} />
    </G>
  );
}
