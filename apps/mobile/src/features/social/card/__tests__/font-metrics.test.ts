/**
 * T7.1.9 — medida de texto do card: erro < 3% contra a largura real no Chromium (com as mesmas fontes),
 * medida por `docs/melhoria/relatorios/E8/medir-texto-navegador.cjs`.
 */
import { describe, expect, it } from '@jest/globals';

import { cardFonts, fitFontSize, measureText, truncateToWidth, type CardFont } from '../font-metrics';
import reference from './browser-widths.json';

type Ref = { font: CardFont; size: number; text: string; width: number };

describe('measureText', () => {
  const refs = reference as Ref[];

  it('tem referência das 4 fontes do card', () => {
    expect(new Set(refs.map((r) => r.font))).toEqual(new Set(Object.values(cardFonts)));
    expect(refs.length).toBeGreaterThanOrEqual(60);
  });

  it.each(refs.map((r) => [r.font, r.text, r] as const))('%s · "%s": erro < 3%%', (_font, _text, r) => {
    const ours = measureText(r.text, r.font, r.size);
    expect(Math.abs(ours - r.width) / r.width).toBeLessThan(0.03);
  });

  it('erro médio < 1%', () => {
    const mean = refs.reduce((s, r) => s + Math.abs(measureText(r.text, r.font, r.size) - r.width) / r.width, 0) / refs.length;
    expect(mean).toBeLessThan(0.01);
  });

  it('escala com o corpo, soma o espaçamento entre letras e usa a largura média para caractere desconhecido', () => {
    const a = measureText('NOMADE', 'InterTight_800ExtraBold', 50);
    expect(measureText('NOMADE', 'InterTight_800ExtraBold', 100)).toBeCloseTo(a * 2, 6);
    expect(measureText('NOMADE', 'InterTight_800ExtraBold', 50, 3)).toBeCloseTo(a + 15, 6);
    expect(measureText('', 'Inter_700Bold', 40, 5)).toBe(0);
    expect(measureText('漢', 'Inter_700Bold', 100)).toBeCloseTo(measureText('n', 'Inter_700Bold', 100), 0);
  });
});

describe('fitFontSize e truncateToWidth', () => {
  it('mantém o corpo quando cabe e reduz até o mínimo quando não cabe', () => {
    expect(fitFontSize('Vila Nova', 'InterTight_800ExtraBold', 128, 900)).toBe(128);
    const fitted = fitFontSize('Jardim Goiás Setor Sul Expansão', 'InterTight_800ExtraBold', 128, 900, 40);
    expect(fitted).toBeLessThan(128);
    expect(measureText('Jardim Goiás Setor Sul Expansão', 'InterTight_800ExtraBold', fitted)).toBeLessThanOrEqual(900);
    expect(fitFontSize('x'.repeat(200), 'Inter_700Bold', 100, 300, 40)).toBe(40);
    expect(fitFontSize('', 'Inter_700Bold', 100, 0)).toBe(100);
  });

  it('corta com reticências só quando precisa', () => {
    expect(truncateToWidth('Corrida', 'Inter_700Bold', 30, 1000)).toBe('Corrida');
    const cut = truncateToWidth('Flamboyant Runners da Avenida Principal', 'Inter_700Bold', 30, 300);
    expect(cut.endsWith('…')).toBe(true);
    expect(measureText(cut, 'Inter_700Bold', 30)).toBeLessThanOrEqual(300);
    expect(truncateToWidth('ABC', 'Inter_700Bold', 100, 1)).toBe('A…');
  });
});
