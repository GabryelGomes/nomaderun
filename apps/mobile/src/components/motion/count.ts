/** Funções puras do `CountUp` (testáveis sem React). */

/** Valor exibido em `progress` (0–1, já com a curva aplicada), arredondado nas casas pedidas. */
export function countValue(progress: number, from: number, to: number, decimals = 0): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 1));
  const raw = from + (to - from) * p;
  const f = 10 ** Math.max(0, decimals);
  return Math.round(raw * f) / f;
}

/** Número em pt-BR (vírgula decimal, ponto de milhar), sempre com `decimals` casas. */
export function formatCount(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
