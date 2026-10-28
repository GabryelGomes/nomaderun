/**
 * T7.2.5 — selo "DADOS DE DEMONSTRAÇÃO" dentro da área segura dos Stories (a barra do Instagram cobre o
 * topo e o rodapé). Antes ficava em y = 1830.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { buildCarousel } from '../pick-models';
import { CARD_FORMATS, STORIES_SAFE, storiesDemoStampY } from '../card-frame';
import { DEMO_STAMP } from '../card-parts';
import { ShareCard } from '../share-card';
import { demoRunInput } from './fixtures';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
// T7.3.7: a arte da E4 (logo, mascote, chefão) passa pelo render animável, que importa o Reanimated.
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
/* eslint-enable @typescript-eslint/no-require-imports */

function stampY(r: ReactTestRenderer): number[] {
  // O `CardText` e o `<Text>` do SVG dentro dele levam o mesmo `y`: 1 posição distinta = 1 selo.
  return [...new Set(r.root.findAll((n) => n.props.children === DEMO_STAMP && typeof n.props.y === 'number').map((n) => n.props.y as number))];
}

describe('selo de demonstração nos Stories', () => {
  it('posição dentro da área segura, com e sem selo de status', () => {
    for (const tag of [null, 'PROVISÓRIO']) {
      const y = storiesDemoStampY(tag);
      expect(y).toBeGreaterThan(STORIES_SAFE.top);
      expect(y).toBeLessThan(STORIES_SAFE.bottom);
    }
    expect(storiesDemoStampY('EM REVISÃO')).toBeGreaterThan(storiesDemoStampY(null)); // não encosta no selo de status
  });

  it('todo modelo desenha o selo dentro da área segura (Stories) e no rodapé (Feed)', () => {
    for (const status of ['valid', 'provisional'] as const) {
      for (const model of buildCarousel(demoRunInput({ status }))) {
        let r: ReactTestRenderer | undefined;
        act(() => {
          r = create(<ShareCard model={model} format="stories" width={270} />);
        });
        const ys = stampY(r!);
        expect(ys).toHaveLength(1);
        expect(ys[0]).toBeGreaterThan(STORIES_SAFE.top);
        expect(ys[0]).toBeLessThan(STORIES_SAFE.bottom);
        act(() => {
          r = create(<ShareCard model={model} format="feed" width={270} />);
        });
        expect(stampY(r!)[0]).toBeLessThanOrEqual(CARD_FORMATS.feed.H);
      }
    }
  });
});
