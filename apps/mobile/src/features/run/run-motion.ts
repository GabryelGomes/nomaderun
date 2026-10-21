/** Contas puras do motion da corrida (T6.4, RNF-015), testáveis sem React. */

/**
 * Chaves estáveis por posição a partir da direita (o segundo é sempre a última casa), para que só o
 * caractere que mudou seja remontado e anime.
 */
export function tickerChars(value: string): { key: string; char: string }[] {
  const chars = Array.from(value);
  return chars.map((char, i) => ({ key: `${chars.length - i}-${char}`, char }));
}

/** Tamanho do tempo (RNF-015: ≥ 72 pt): 88 pt até "59:59", 72 pt com horas ("1:02:03"), para caber em 360 pt. */
export function timeFontSize(text: string): number {
  return text.length <= 5 ? 88 : 72;
}
