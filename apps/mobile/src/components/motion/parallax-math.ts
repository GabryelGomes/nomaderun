/**
 * Conta do parallax do cabeçalho (pura, roda como worklet na UI thread e no Jest).
 * - rolando para cima (`y > 0`): o cabeçalho anda a `factor` da velocidade e some até `height`;
 * - puxando para baixo (`y < 0`, iOS): cresce um pouco, ancorado no topo;
 * - "Reduzir movimento": parado, só a opacidade muda.
 */
export function parallaxValues(y: number, height: number, factor: number, reduced: boolean): { translateY: number; scale: number; opacity: number } {
  'worklet';
  const h = height > 0 ? height : 1;
  const opacity = y <= 0 ? 1 : Math.max(0, 1 - y / (h * 0.8));
  if (reduced) return { translateY: 0, scale: 1, opacity };
  if (y < 0) {
    const scale = 1 + Math.min(-y, h) / h;
    // compensa a escala (que cresce pelo centro) para o topo ficar preso: desce metade do crescimento + o puxão
    return { translateY: y / 2, scale, opacity };
  }
  return { translateY: y * factor, scale: 1, opacity };
}
