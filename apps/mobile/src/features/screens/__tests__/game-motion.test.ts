import { describe, expect, it } from '@jest/globals';

import { badgeText, clampFraction, mapControlsTop, podiumOrder } from '../game-motion-math';

describe('contas das telas de jogo (T6.3)', () => {
  it('barra limita a fração entre 0 e 1 e trata valores inválidos', () => {
    expect(clampFraction(0.64)).toBe(0.64);
    expect(clampFraction(-1)).toBe(0);
    expect(clampFraction(3)).toBe(1);
    expect(clampFraction(Number.NaN)).toBe(0);
    expect(clampFraction(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('contador do sino some sem não lidas e vira "9+" acima de 9', () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(-2)).toBeNull();
    expect(badgeText(1)).toBe('1');
    expect(badgeText(9)).toBe('9');
    expect(badgeText(10)).toBe('9+');
    expect(badgeText(Number.NaN)).toBeNull();
  });

  it('controles do mapa ficam abaixo do status e dos filtros, na grade de 4 pt', () => {
    expect(mapControlsTop(0)).toBe(128);
    expect(mapControlsTop(47)).toBe(175);
    expect(mapControlsTop(-5)).toBe(128);
    expect(mapControlsTop(20) % 4).toBe(0);
  });

  it('pódio mostra 2º, 1º e 3º e aguenta menos de 3 linhas', () => {
    expect(podiumOrder(['a', 'b', 'c', 'd'])).toEqual(['b', 'a', 'c']);
    expect(podiumOrder(['a', 'b'])).toEqual(['b', 'a']);
    expect(podiumOrder([])).toEqual([]);
  });
});
