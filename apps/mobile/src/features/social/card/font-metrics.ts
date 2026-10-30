/**
 * T7.1.9 — medida de texto sem DOM para o card (o SVG não mede texto antes de desenhar).
 *
 * Tabela de avanços das 4 fontes que o app já carrega (`_layout.tsx`), em milésimos do corpo, gerada dos TTF de
 * `@expo-google-fonts` por `docs/melhoria/F1/social/prototipo/metricas_fontes.py` (fontTools), mais o kerning
 * dos números. O erro contra a medida real do Chromium nas strings do card fica abaixo de 3% (teste
 * `font-metrics.test.ts`, com a referência medida no navegador em `__tests__/browser-widths.json`).
 */
import { fonts } from '@/theme/tokens';

/** Fontes usadas no card (as mesmas do app). */
export type CardFont = 'InterTight_800ExtraBold' | 'InterTight_600SemiBold' | 'Inter_700Bold' | 'Inter_500Medium';

export const cardFonts = {
  display: fonts.display,
  displayMedium: fonts.displayMedium,
  bold: fonts.textBold,
  medium: fonts.textMedium,
} as const satisfies Record<string, CardFont>;

const CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀÁÂÃÇÉÊÍÓÔÕÚàáâãçéêíóôõú·–—→’“”º°×";

const TABLE: Record<CardFont, { fallback: number; adv: readonly number[] }> = {
  InterTight_800ExtraBold: {
    fallback: 608.4,
    adv: [187.5, 334.5, 564, 627.9, 632.3, 846.7, 656.2, 328.6, 354, 354, 558.6, 658.2, 343.3, 443.4, 327.1, 373, 681.2, 414.1, 610.4, 639.2, 662.1, 632.8, 650.4, 563.5, 653.3, 650.4, 327.1, 334, 658.2, 658.2, 658.2, 553.7, 1034.2, 743.2, 636.2, 732.4, 701.7, 588.9, 556.6, 738.3, 719.7, 257.3, 550.8, 674.3, 541.5, 896, 700.7, 760.3, 624, 761.7, 634.3, 632.3, 649.4, 697.3, 743.2, 1035.2, 710.4, 716.8, 652.3, 354, 373, 354, 465.8, 457, 447.3, 562, 609.9, 567.9, 609.9, 573.2, 369.1, 611.8, 609.9, 255.9, 255.9, 565.9, 255.9, 900.4, 608.4, 591.3, 609.9, 609.9, 393.1, 546.9, 368.7, 607.4, 567.4, 834.5, 557.1, 567.4, 554.2, 460.4, 361.3, 460.4, 658.2, 743.2, 743.2, 743.2, 743.2, 732.4, 588.9, 588.9, 257.3, 760.3, 760.3, 760.3, 697.3, 562, 562, 562, 562, 567.9, 573.2, 573.2, 255.9, 591.3, 591.3, 591.3, 607.4, 327.1, 500, 1000, 925.8, 346.7, 599.6, 587.9, 468.8, 433.1, 658.2],
  },
  InterTight_600SemiBold: {
    fallback: 573.7,
    adv: [210.9, 292, 489.3, 606, 611.3, 806.2, 624.5, 289.1, 334, 334, 505.9, 635.3, 296.9, 427.7, 282.2, 341.3, 629.9, 384.8, 584.5, 614.3, 628.4, 594.2, 609.4, 539.6, 609.9, 609.4, 282.2, 292.5, 635.3, 635.3, 635.3, 506.8, 961.9, 686, 620.1, 706.5, 686.5, 569.8, 548.3, 717.3, 706.1, 237.3, 522.9, 639.6, 528.3, 871.1, 704.1, 737.3, 606, 738.3, 613.3, 611.3, 622.1, 695.8, 686, 972.2, 652.3, 667.5, 615.2, 334, 341.3, 334, 443.8, 431.2, 417.5, 540, 585.9, 541, 585.9, 553.2, 341.3, 586.9, 577.1, 223.1, 223.1, 531.2, 223.1, 861.8, 573.7, 570.3, 585.9, 585.9, 359.4, 511.2, 342.8, 570.8, 538.6, 799.8, 525.4, 538.6, 524.4, 417, 320.8, 417, 635.3, 686, 686, 686, 686, 706.5, 569.8, 569.8, 237.3, 737.3, 737.3, 737.3, 695.8, 540, 540, 540, 540, 541, 553.2, 553.2, 223.1, 570.3, 570.3, 570.3, 570.8, 282.2, 500, 1000, 916.5, 297.9, 514.2, 508.3, 435.5, 419.9, 635.3],
  },
  Inter_700Bold: {
    fallback: 622.6,
    adv: [236.8, 337.9, 551.8, 648.9, 654.8, 1015.6, 671.9, 338.9, 377, 377, 559.1, 678.7, 334, 467.8, 334, 388.2, 674.3, 431.2, 629.9, 645.5, 676.3, 622.1, 649.4, 581.5, 650.9, 649.4, 334, 342.8, 678.7, 678.7, 678.7, 559.6, 1016.1, 746.6, 661.6, 739.7, 722.2, 607.4, 586.9, 750.5, 747.1, 280.8, 584.5, 719.2, 565.4, 931.6, 762.2, 770.5, 647.9, 776.9, 656.7, 654.8, 667.5, 731.9, 746.6, 1037.6, 738.3, 731, 664.1, 377, 388.2, 377, 486.8, 476.1, 365.2, 580.6, 630.4, 588.4, 630.4, 595.7, 397.9, 631.8, 622.6, 271, 271, 580.1, 271, 912.6, 622.6, 613.3, 630.4, 630.4, 407.2, 560.1, 366.2, 622.6, 599.6, 850.1, 580.1, 602.1, 572.8, 468.8, 371.6, 468.8, 678.7, 746.6, 746.6, 746.6, 746.6, 739.7, 607.4, 607.4, 280.8, 770.5, 770.5, 770.5, 731.9, 580.6, 580.6, 580.6, 580.6, 588.4, 595.7, 595.7, 271, 613.3, 613.3, 613.3, 622.6, 334, 500, 1000, 954.1, 310.5, 540, 531.7, 489.7, 459.5, 678.7],
  },
  Inter_500Medium: {
    fallback: 601.6,
    adv: [266.6, 304.2, 494.1, 638.7, 646, 993.2, 653.3, 313, 368.7, 368.7, 520.5, 667.5, 303.2, 462.4, 303.2, 369.6, 645.5, 415, 616.2, 627, 656.2, 603, 629.9, 571.3, 629.4, 629.9, 303.2, 315.4, 667.5, 667.5, 667.5, 527.3, 982.4, 709, 656.7, 733.4, 721.7, 603, 589.4, 747.6, 744.6, 272.5, 575.2, 687.5, 565.4, 912.6, 756.3, 766.6, 641.6, 768.6, 647.9, 646, 652.8, 740.2, 709, 1002.9, 700.7, 696.3, 640.6, 368.7, 369.6, 368.7, 476.6, 462.9, 336.9, 567.9, 618.2, 577.1, 618.2, 587.4, 379.4, 619.6, 601.6, 252, 252, 559.1, 252, 888.2, 601.6, 604, 618.2, 618.2, 386.7, 538.6, 340.3, 601.6, 574.7, 829.1, 557.1, 575.2, 559.1, 440.4, 345.7, 440.4, 667.5, 709, 709, 709, 709, 733.4, 603, 603, 272.5, 766.6, 766.6, 766.6, 740.2, 567.9, 567.9, 567.9, 567.9, 577.1, 587.4, 587.4, 252, 604, 604, 604, 601.6, 303.2, 500, 1000, 954.1, 277.3, 473.6, 470.7, 484.9, 457, 667.5],
  },
};

/**
 * Kerning dos pares de números e pontuação (onde ele pesa: "4,1", "7,2", "1:04"), medido no Chromium com
 * `canvas.measureText` (par − letras isoladas), em milésimos do corpo. Formato: "ab-12.3 cd-4 …".
 */
const KERN_SOURCE: Record<CardFont, string> = {
  InterTight_800ExtraBold: "+2-15.6 +3-2.4 +7-31.2 ,0-30.8 ,1-92.3 ,3-21 ,5-2.9 ,6-30.8 ,7-30.8 ,8-31.2 ,9-15.6 -2-15.6 -3-2.4 -7-31.2 .0-30.8 .1-92.3 .3-21 .5-2.9 .6-30.8 .7-30.8 .8-31.2 .9-15.6 /,-39.6 /.-39.6 0,-30.8 0.-30.8 07-19.5 24-15.6 3,-20 3.-20 4,-6.8 4.-6.8 41-9.8 5,-21 5.-21 6,-28.3 6.-28.3 7,-125 7.-125 70-15.6 73-16.6 74-58.1 75-9.8 76-15.6 7719.5 78-14.2 79-9.8 7:-33.7 8,-20 8.-20 9,-30.8 9.-30.8 97-19.5 ·2-15.6 ·3-2.4 ·7-31.2",
  InterTight_600SemiBold: "+2-24.9 +3-6.8 +7-26.9 ,0-28.3 ,1-89.4 ,3-23.9 ,5-8.3 ,6-28.3 ,7-22.5 ,8-26.9 ,9-11.2 -2-24.9 -3-6.8 -7-26.9 .0-28.3 .1-89.4 .3-23.9 .5-8.3 .6-28.3 .7-22.5 .8-26.9 .9-11.2 /,-39.6 /.-39.6 0,-28.3 0.-28.3 07-19.5 24-15.6 3,-21.5 3.-21.5 4,-20 4.-20 41-9.8 5,-23.9 5.-23.9 6,-30.8 6.-30.8 7,-125 7.-125 70-15.6 73-16.6 74-58.1 75-9.8 76-15.6 7719.5 78-14.2 79-9.8 7:-33.7 8,-21.5 8.-21.5 9,-28.3 9.-28.3 97-19.5 ·2-24.9 ·3-6.8 ·7-26.9",
  Inter_700Bold: "+2-21.5 +3-5.4 +7-28.3 ,0-29.3 ,1-90.3 ,3-22.9 ,5-6.3 ,6-29.3 ,7-25.4 ,8-28.3 ,9-12.7 -2-21.5 -3-5.4 -7-28.3 .0-29.3 .1-90.3 .3-22.9 .5-6.3 .6-29.3 .7-25.4 .8-28.3 .9-12.7 /,-39.6 /.-39.6 0,-29.3 0.-29.3 07-19.5 24-15.6 3,-21 3.-21 4,-33.7 4.-33.7 41-38.1 5,-22.9 5.-22.9 6,-29.8 6.-29.8 7,-125 7.-125 70-15.6 73-16.6 74-58.1 75-9.8 76-15.6 7719.5 78-14.2 79-9.8 7:-33.7 8,-21 8.-21 9,-29.3 9.-29.3 97-19.5 ·2-21.5 ·3-5.4 ·7-28.3",
  Inter_500Medium: "+2-29.8 +3-9.3 +7-24.4 ,0-26.9 ,1-87.9 ,3-25.4 ,5-11.7 ,6-26.9 ,7-18.1 ,8-24.4 ,9-8.8 -2-29.8 -3-9.3 -7-24.4 .0-26.9 .1-87.9 .3-25.4 .5-11.7 .6-26.9 .7-18.1 .8-24.4 .9-8.8 /,-39.6 /.-39.6 0,-26.9 0.-26.9 07-19.5 24-15.6 3,-22 3.-22 4,-33.7 4.-33.7 41-25.9 5,-25.4 5.-25.4 6,-32.2 6.-32.2 7,-125 7.-125 70-15.6 73-16.6 74-58.1 75-9.8 76-15.6 7719.5 78-14.2 79-9.8 7:-33.7 8,-22 8.-22 9,-26.9 9.-26.9 97-19.5 ·2-29.8 ·3-9.3 ·7-24.4",
};

const KERN: Record<CardFont, Map<string, number>> = Object.fromEntries(
  (Object.entries(KERN_SOURCE) as [CardFont, string][]).map(([font, src]) => [
    font,
    new Map(src.split(' ').map((item) => [item.slice(0, 2), Number(item.slice(2))] as const)),
  ]),
) as Record<CardFont, Map<string, number>>;

const INDEX = new Map<string, number>([...CHARS].map((c, i) => [c, i]));

/**
 * Largura (em unidades do SVG) de `text` em `font` no corpo `size`, com o kerning dos números.
 * Espaços em sequência contam como um só e as pontas são aparadas, como o SVG faz por padrão.
 * `letterSpacing` entra entre os caracteres (n − 1 vezes), que é a largura visível do texto.
 */
export function measureText(text: string, font: CardFont, size: number, letterSpacing = 0): number {
  const table = TABLE[font];
  const kern = KERN[font];
  let units = 0;
  let count = 0;
  let prev = '';
  for (const ch of text.replace(/\s+/g, ' ').trim()) {
    const i = INDEX.get(ch);
    units += (i === undefined ? table.fallback : table.adv[i]) + (kern.get(prev + ch) ?? 0);
    prev = ch;
    count++;
  }
  return (units / 1000) * size + letterSpacing * Math.max(0, count - 1);
}

/** Maior corpo (até `maxSize`, sem passar de `minSize` para baixo) em que `text` cabe em `maxWidth`. */
export function fitFontSize(text: string, font: CardFont, maxSize: number, maxWidth: number, minSize = maxSize * 0.5, letterSpacingEm = 0): number {
  const width = measureText(text, font, maxSize, letterSpacingEm * maxSize);
  if (width <= maxWidth || width === 0) return maxSize;
  return Math.max(minSize, Math.floor(maxSize * (maxWidth / width) * 10) / 10);
}

/** Corta `text` com "…" para caber em `maxWidth` (no corpo dado). */
export function truncateToWidth(text: string, font: CardFont, size: number, maxWidth: number, letterSpacing = 0): string {
  if (measureText(text, font, size, letterSpacing) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 1 && measureText(`${chars.join('').trimEnd()}…`, font, size, letterSpacing) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}
