import { space } from '@/theme/tokens';

/** Largura de "NOMADE" em Inter Tight 800 ≈ 4,05 × o tamanho da fonte (medido no navegador). */
const WORDMARK_WIDTH_RATIO = 4.15;
const MAX_SIZE = 76;

/** Tamanho da marca que cabe na largura útil (360 pt de tela com 24 pt de margem → 75). Função pura. */
export function wordmarkSize(screenWidth: number, gutter: number = space[6]): number {
  return Math.max(48, Math.min(MAX_SIZE, Math.floor((screenWidth - gutter * 2) / WORDMARK_WIDTH_RATIO)));
}
