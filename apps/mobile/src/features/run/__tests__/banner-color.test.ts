import { describe, expect, it } from '@jest/globals';

import { FACTION_IDS } from '@/domain/types';
import { factions } from '@/theme/tokens';

import { contrastRatio, darken, readableBackground } from '../banner-color';

describe('faixa de território com contraste AA (QA-19)', () => {
  it.each(FACTION_IDS)('texto do time %s fica ≥ 4,5:1 sobre o fundo da faixa', (id) => {
    const f = factions[id];
    expect(contrastRatio(readableBackground(f.color, f.onColor), f.onColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('não altera a cor quando o contraste já basta', () => {
    expect(readableBackground('#0072B2', '#FFFFFF')).toBe('#0072B2');
  });

  it('escurece só o necessário (Volt continua verde)', () => {
    const bg = readableBackground('#009E73', '#FFFFFF');
    expect(bg).not.toBe('#009E73');
    expect(contrastRatio(darken('#009E73', 0.1), '#FFFFFF')).toBeLessThan(4.5);
  });
});
