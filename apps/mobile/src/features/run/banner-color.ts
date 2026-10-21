/**
 * Fundo da faixa "Território dos {time}" com contraste ≥ 4,5:1 para o texto (WCAG AA, RNF-011, QA-19).
 * Mantém a cor do time; só escurece o necessário quando o texto do time é claro e não atinge o mínimo.
 */
const MIN_CONTRAST = 4.5;
const STEP = 0.02;
const MAX_DARKEN = 0.6;

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function darken(hex: string, amount: number): string {
  const out = channels(hex).map((c) => Math.round(c * (1 - amount)));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Cor de fundo legível para `ink` sobre `color` (texto escuro já passa: devolve a cor original). */
export function readableBackground(color: string, ink: string): string {
  let amount = 0;
  let bg = color;
  while (contrastRatio(bg, ink) < MIN_CONTRAST && amount < MAX_DARKEN) {
    amount += STEP;
    bg = darken(color, amount);
  }
  return bg;
}
