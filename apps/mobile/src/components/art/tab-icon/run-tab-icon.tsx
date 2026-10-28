import { expand } from '../neon/core';
import { StaticArt, type ArtA11y, type ArtBox } from '../neon/render';
import { RUN_TAB_BOX, runTabNodes, type RunTabVariant } from './run-tab-art';

export type RunTabIconProps = ArtA11y & {
  /** `padrao` = contorno (aba não selecionada); `selecionado` = cheio. Os dois no laranja. */
  variant?: RunTabVariant;
  /** Lado em pontos (padrão 28, o tamanho dos PNGs de `assets/art/aba-correr*.png`). */
  size?: number;
  color?: string;
};

/**
 * Ícone da aba Correr em vetor (o mesmo desenho dos PNGs do nativo), para a barra da web ou qualquer lugar
 * que precise do "correr" laranja. Decorativo por padrão: o rótulo "Correr" fica na aba.
 */
export function RunTabIcon({ variant = 'padrao', size = 28, color, ...a11y }: RunTabIconProps) {
  const box: ArtBox = { ...RUN_TAB_BOX, width: size };
  return <StaticArt box={box} prims={expand(runTabNodes(variant, color), 'plano')} {...a11y} />;
}
