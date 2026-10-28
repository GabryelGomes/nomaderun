/**
 * E10 (onda 4) — o selo fixo "Demonstração" (DemoSeal) fica no alto e no centro, por cima de tudo. Na revisão visual
 * ele cobria o nome do time no Mapa, a faixa da corrida e o "Zona conquistada" do resumo. Enquanto o selo está
 * montado, `useDemoSealSpace()` devolve a altura dele e o `Screen`/`ScreenScroll` descem o conteúdo; sem selo, nada muda.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

import { render } from '@/components/__tests__/render-helpers';
import { DEMO_SEAL_SPACE, registerDemoSeal, useDemoSealSpace } from '@/components/demo-badge';
import { Screen } from '@/components/screen';
/* eslint-enable import/first */

function Probe() {
  return <Text testID="folga">{String(useDemoSealSpace())}</Text>;
}

const paddingTopOf = (r: ReturnType<typeof render>) => {
  const inner = r.renderer.root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.paddingTop !== undefined)[0];
  return StyleSheet.flatten(inner.props.style).paddingTop as number;
};

describe('folga do selo de demonstração', () => {
  it('é 0 sem selo e a altura do selo enquanto ele está montado (conta mais de um)', () => {
    const r = render(<Probe />);
    expect(r.text()).toBe('0');
    let off1!: () => void;
    let off2!: () => void;
    act(() => {
      off1 = registerDemoSeal();
      off2 = registerDemoSeal();
    });
    expect(r.text()).toBe(String(DEMO_SEAL_SPACE));
    act(() => off1());
    expect(r.text()).toBe(String(DEMO_SEAL_SPACE));
    act(() => off2());
    expect(r.text()).toBe('0');
  });

  it('o Screen desce o conteúdo só enquanto o selo existe', () => {
    const before = paddingTopOf(render(<Screen testID="t">{null}</Screen>));
    let off!: () => void;
    act(() => {
      off = registerDemoSeal();
    });
    const during = paddingTopOf(render(<Screen testID="t">{null}</Screen>));
    act(() => off());
    expect(during - before).toBe(DEMO_SEAL_SPACE);
    expect(paddingTopOf(render(<Screen testID="t">{null}</Screen>))).toBe(before);
  });
});
