import { describe, expect, it } from '@jest/globals';

import { wordmarkSize } from '../wordmark';

describe('wordmarkSize (T6.2)', () => {
  it('mantém 76 pt do visual aprovado nos celulares comuns', () => {
    expect(wordmarkSize(375)).toBe(76);
    expect(wordmarkSize(390)).toBe(76);
    expect(wordmarkSize(430)).toBe(76);
  });

  it('encolhe para "NOMADE" caber em 360 pt com 24 pt de margem', () => {
    const size = wordmarkSize(360);
    expect(size).toBeLessThanOrEqual(76);
    expect(size * 4.05).toBeLessThanOrEqual(360 - 48);
  });

  it('nunca fica menor que 48 pt', () => {
    expect(wordmarkSize(200)).toBe(48);
  });
});
