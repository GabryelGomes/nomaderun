import { describe, expect, it } from '@jest/globals';

import { IOS_TAB_BAR_HEIGHT, tabBarClearance } from '../screen';

describe('tabBarClearance — elementos flutuantes acima da barra de abas', () => {
  it('no iOS soma a barra flutuante à área segura (iPhone 15: 34 pt)', () => {
    expect(tabBarClearance(34, 'ios')).toBe(34 + IOS_TAB_BAR_HEIGHT + 8);
    expect(tabBarClearance(34, 'ios')).toBeGreaterThanOrEqual(95);
  });

  it('no Android e na web mantém os 16 pt de antes', () => {
    expect(tabBarClearance(24, 'android')).toBe(16);
    expect(tabBarClearance(0, 'web')).toBe(16);
  });
});
