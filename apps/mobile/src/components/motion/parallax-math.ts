/**
 * Conta do parallax do cabeçalho (pura, roda como worklet na UI thread e no Jest).
 * - rolando para cima (`y > 0`): o cabeçalho anda a `factor` da velocidade e some até `height`;
 * - `y <= 0` não mexe em nada. No iOS, com título grande nativo (`contentInsetAdjustmentBehavior`),
 *   a rolagem já começa negativa (~ −150 pt); tratar isso como "puxão" ampliava o cabeçalho até 2×
 *   e o cortava na tela (bug visto no iPhone 15). Sem zoom ao puxar.
 * - "Reduzir movimento": parado, só a opacidade muda.
 */
export function parallaxValues(y: number, height: number, factor: number, reduced: boolean): { translateY: number; scale: number; opacity: number } {
  'worklet';
  const h = height > 0 ? height : 1;
  if (y <= 0) return { translateY: 0, scale: 1, opacity: 1 };
  const opacity = Math.max(0, 1 - y / (h * 0.8));
  if (reduced) return { translateY: 0, scale: 1, opacity };
  return { translateY: y * factor, scale: 1, opacity };
}
