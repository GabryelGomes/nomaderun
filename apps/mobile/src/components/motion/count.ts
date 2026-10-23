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

/** Teto de quadros pré-calculados de uma contagem (2 s a 60 fps). */
export const COUNT_MAX_STEPS = 120;

/**
 * Valores de uma contagem amostrados em `steps + 1` instantes (curva já aplicada), do início ao fim.
 * O `CountUp` formata cada um uma vez (thread de JS) e a thread de UI só escolhe qual mostrar.
 * Sempre começa em `from` e termina exatamente em `to`.
 */
export function countSteps(from: number, to: number, ease: (t: number) => number, steps: number, decimals = 0): number[] {
  const n = Math.min(COUNT_MAX_STEPS, Math.max(1, Math.floor(Number.isFinite(steps) ? steps : 1)));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(i === n ? countValue(1, from, to, decimals) : countValue(i === 0 ? 0 : ease(i / n), from, to, decimals));
  return out;
}

/** Quantos quadros uma contagem de `durationMs` precisa (~1 a cada 16 ms, entre 1 e o teto). */
export function countStepsFor(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return Math.min(COUNT_MAX_STEPS, Math.max(1, Math.round(durationMs / 16)));
}

/** O texto mais largo (reserva o espaço do número para ele não pular durante a contagem). */
export function widestLabel(labels: readonly string[]): string {
  return labels.reduce((w, s) => (s.length > w.length ? s : w), '');
}
