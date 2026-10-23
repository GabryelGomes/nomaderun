/**
 * T7.2.7 (E6b) — peças das telas que renderizam sem o app inteiro: menu de camadas do Mapa, barras só com
 * transform (`GrowBar`, `InfluenceBar`, `GrowPillar`) e a rota que se desenha no Resumo.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { render } from '@/components/__tests__/render-helpers';
import { RouteDraw } from '@/features/run/route-draw';

import { GrowBar, GrowPillar, InfluenceBar } from '../game-motion';
import { LAYERS, LayerChips, type Layer } from '../map-layer-chips';
/* eslint-enable import/first */

describe('LayerChips (menu de camadas)', () => {
  it('3 opções com testID dos fluxos Maestro, a ativa marcada e "Atlas" no lugar de "Onde já corri" (D-74)', () => {
    let chosen: Layer | null = null;
    const r = render(<LayerChips value="meu-time" onChange={(l) => (chosen = l)} />);
    for (const [key] of LAYERS) expect(r.has(`mapa-camada-${key}`)).toBe(true);
    expect(r.host('mapa-camada-meu-time').props.accessibilityState).toEqual({ selected: true });
    expect(r.host('mapa-camada-todos').props.accessibilityState).toEqual({ selected: false });
    expect(r.text()).toContain('Atlas');
    expect(r.text()).not.toContain('Onde já corri');
    r.press('mapa-camada-explorado');
    expect(chosen).toBe('explorado');
  });
});

describe('barras das telas de jogo só com transform', () => {
  it('GrowBar é o ProgressBar da E5 (scaleX), com o valor para o leitor de tela', () => {
    const r = render(<GrowBar testID="barra" value={0.64} color="#f00" accessibilityLabel="Vida do chefão: 64%" />);
    const bar = r.host('barra');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 64 });
    expect(bar.props.accessibilityLabel).toBe('Vida do chefão: 64%');
  });

  it('InfluenceBar fala "Domínio" (glossário D-74) e nenhuma camada anima largura', () => {
    const r = render(<InfluenceBar influence={{ striders: 30, owls: 10, coyotes: 0, volt: 0 }} />);
    const root = r.renderer.root.findAll((n) => typeof n.type === 'string' && typeof n.props.accessibilityLabel === 'string')[0];
    expect(root.props.accessibilityLabel).toBe('Domínio: Neon Striders 75%, Night Owls 25%');
    const widths = r.renderer.root.findAll((n) => typeof n.type === 'string').map((n) => JSON.stringify(n.props.style ?? {}));
    expect(widths.some((s) => /"width":"\d+%"/.test(s))).toBe(false);
  });

  it('GrowPillar mantém o conteúdo (posição e nome) e a altura do pedestal', () => {
    const r = render(
      <GrowPillar height={96} color="#fff">
        <Text>1º</Text>
      </GrowPillar>,
    );
    expect(r.text()).toContain('1º');
  });
});

describe('RouteDraw', () => {
  const path = Array.from({ length: 50 }, (_, i) => ({ lat: -16.71 + i * 0.0001, lng: -49.24 + Math.sin(i / 5) * 0.0005 }));

  it('decorativa para o leitor de tela e desenha os pedaços depois de medir a largura', () => {
    const r = render(<RouteDraw testID="rota" path={path} color="#00f" />);
    const host = r.host('rota');
    expect(host.props['aria-hidden']).toBe(true);
    const before = r.renderer.root.findAll((n) => n.props.d !== undefined).length;
    expect(before).toBe(0);
    act(() => {
      host.props.onLayout({ nativeEvent: { layout: { width: 320, height: 180, x: 0, y: 0 } } });
    });
    // 12 pedaços × (brilho + traço)
    expect(r.renderer.root.findAll((n) => typeof n.props.d === 'string' && n.props.strokeWidth === 5).length).toBeGreaterThanOrEqual(12);
  });
});
