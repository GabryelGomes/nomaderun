/**
 * Ícone da aba **Correr** (T7.3.4): o "play" inclinado para a frente com 3 linhas de velocidade, sempre no
 * laranja. viewBox 32 × 32. Duas variantes, como os ícones do sistema: `padrao` (contorno, aba não
 * selecionada) e `selecionado` (cheio). Traço plano, sem halo: em 24–28 pt o halo embaça.
 *
 * Os PNGs de `apps/mobile/assets/art/aba-correr*.png` (1×, 2× e 3×) e os SVGs saem desta mesma geometria
 * (`docs/melhoria/relatorios/E4-onda3/gerar-assets.cjs`). Puro.
 */
import { memoArt, neon, type ArtNode } from '../neon/core';
import { ART } from '../neon/palette';

export type RunTabVariant = 'padrao' | 'selecionado';
export const RUN_TAB_VARIANTS: readonly RunTabVariant[] = ['padrao', 'selecionado'];
export const RUN_TAB_BOX = { vbW: 32, vbH: 32 } as const;

/** Triângulo com a borda de trás inclinada (itálico = velocidade). */
const PLAY = 'M13.5 6.5 L 27.5 16 L 9.5 25.5 Z';
const SPEED = ['M5 11 L 9 11', 'M2.5 16 L 7.5 16', 'M4 21 L 6.5 21'];

const cache = new Map<string, ArtNode[]>();

export function runTabNodes(variant: RunTabVariant, color: string = ART.orange): ArtNode[] {
  return memoArt(cache, `${variant}|${color}`, () => [
    neon(SPEED, color, 2.4, { glow: 0, hot: 0 }),
    variant === 'selecionado' ? neon(PLAY, color, 2.6, { fill: color, glow: 0, hot: 0 }) : neon(PLAY, color, 2.6, { glow: 0, hot: 0 }),
  ]);
}
