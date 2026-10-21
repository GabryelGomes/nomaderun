/** Contas puras da celebração de zona conquistada (ERS §6.2), testáveis sem React. */

/** A zona é "pintada" por seis traços em sequência, com 60 ms de intervalo. */
export const CHALK_STROKES = 6;
export const CHALK_INTERVAL_MS = 60;
/** Duração de cada traço (expo.out). */
export const CHALK_STROKE_MS = 420;
/** Fim do último traço: 5 × 60 + 420 = 720 ms (dentro de 1 s após a confirmação). */
export const CHALK_TOTAL_MS = (CHALK_STROKES - 1) * CHALK_INTERVAL_MS + CHALK_STROKE_MS;

/** expo.out do GSAP (1 − 2^(−10t)). */
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Progresso (0–1, já com a curva) do traço `index` no instante `ms` da sequência. */
export function chalkStrokeProgress(index: number, ms: number, ease: (t: number) => number = expoOut): number {
  const local = (ms - index * CHALK_INTERVAL_MS) / CHALK_STROKE_MS;
  if (local <= 0) return 0;
  if (local >= 1) return 1;
  return ease(local);
}
