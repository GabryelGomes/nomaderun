import { describe, expect, it, jest } from '@jest/globals';

import { motion } from '@/theme/tokens';

import { pressFeedback } from '../press-feedback';

jest.mock('react-native-reanimated', () => ({ cubicBezier: () => 'ease-out', Easing: { bezier: () => 'ease' } }));

describe('Button/IconButton — retorno ao toque (RNF-011, QA-12)', () => {
  it('normal: encolhe 0,97 em 120 ms', () => {
    expect(pressFeedback(true, false)).toMatchObject({ transform: [{ scale: motion.press.scale }], transitionProperty: 'transform', transitionDuration: 120, opacity: 1 });
    expect(pressFeedback(false, false)).toMatchObject({ transform: [{ scale: 1 }] });
  });

  it('com "Reduzir movimento": sem escala, só opacidade (respeita o desabilitado)', () => {
    const on = pressFeedback(true, true, 0.45);
    expect(on).not.toHaveProperty('transform');
    expect(on).toMatchObject({ transitionProperty: 'opacity' });
    expect(on.opacity).toBeLessThan(0.45);
    expect(pressFeedback(false, true, 0.45)).toMatchObject({ opacity: 0.45 });
  });
});
