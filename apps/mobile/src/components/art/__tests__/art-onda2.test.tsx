/**
 * T7.2.8 (E4) — arte da onda 2: 1 teste de renderização por família nova (líderes, corredores, logo, partes
 * para a E5 e arte dentro de um SVG maior para a E8): renderiza sem erro, aplica cor e tamanho, cada
 * pose/variante gera uma árvore diferente e a acessibilidade segue a regra do sistema.
 */
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import Svg from 'react-native-svg';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useReducedMotion: () => false,
  useSharedValue: (v: number) => ({ value: v, get: () => v, set: () => undefined }),
  useAnimatedStyle: (fn: () => object) => fn(),
  withTiming: (v: number) => v,
  withRepeat: (v: number) => v,
  withSequence: (...v: number[]) => v[0],
  withDelay: (_d: number, v: number) => v,
  cancelAnimation: () => undefined,
  Easing: { inOut: () => (t: number) => t, sin: (t: number) => t, linear: (t: number) => t },
}));

/* eslint-disable import/first */
import { ART, LeaderBust, LEADER_NAMES, LEADER_POSES, MascotRunner } from '..';
import { leaderNodes } from '../leader/leader-art';
import { countPrims, expand, type Prim } from '../neon/core';
import { runnerNodes } from '../team/runner-art';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEAMS = ['striders', 'volt', 'owls', 'coyotes'] as const;

function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  return r!;
}
const svgOf = (r: ReactTestRenderer) => r.root.findAllByType(Svg)[0];
const strokes = (r: ReactTestRenderer, color: string) => r.root.findAll((n: ReactTestInstance) => n.props?.stroke === color).length;
const frame = (r: ReactTestRenderer) => r.root.findAll((n: ReactTestInstance) => String(n.type) === 'View' && ('aria-hidden' in n.props || 'accessibilityLabel' in n.props))[0];
const tags = (prims: Prim[]): string[] => prims.flatMap((p) => [p.tag, ...(p.c ? tags(p.c) : [])]);
const attrs = (prims: Prim[]): string[] => prims.flatMap((p) => [...Object.keys(p.a), ...(p.c ? attrs(p.c) : [])]);
const ALLOWED = new Set(['g', 'path', 'circle', 'rect', 'ellipse']);

describe('leader — bustos dos líderes', () => {
  it('4 líderes × 2 poses renderizam, aplicam cor e tamanho e cada pose é diferente', () => {
    expect(Object.values(LEADER_NAMES)).toEqual(['Íris Valente', 'Téo Faria', 'Nara Lis', 'Bento Rocha']);
    const all = new Set<string>();
    for (const team of TEAMS) {
      const seen = new Set<string>();
      for (const pose of LEADER_POSES) {
        const r = render(<LeaderBust team={team} pose={pose} size={150} color="#123456" />);
        expect(svgOf(r).props.width).toBe(150);
        expect(svgOf(r).props.height).toBe(165);
        expect(strokes(r, '#123456')).toBeGreaterThan(0);
        expect(frame(r).props['aria-hidden']).toBe(true); // decorativo por padrão: o nome vai em Text
        const prims = expand(leaderNodes(team, pose, '#123456'), 'completo');
        expect(tags(prims).filter((t) => !ALLOWED.has(t))).toEqual([]);
        expect(attrs(prims).some((a) => /filter|blur/i.test(a))).toBe(false);
        seen.add(JSON.stringify(prims));
      }
      expect(seen.size).toBe(2);
      seen.forEach((s) => all.add(s));
    }
    expect(all.size).toBe(8);
  });

  it('animado vira camadas (busto, cabeça, olhos, topo, 2 bocas e a mão) e aceita rótulo', () => {
    const r = render(<LeaderBust team="owls" pose="falando" animated accessibilityLabel="Nara Lis, líder dos Night Owls" />);
    expect(r.root.findAllByType(Svg).length).toBe(7);
    expect(frame(r).props.accessibilityLabel).toBe('Nara Lis, líder dos Night Owls');
    expect(strokes(r, ART.team.owls)).toBeGreaterThan(0);
    const still = render(<LeaderBust team="volt" animated />);
    expect(still.root.findAllByType(Svg).length).toBe(6); // parado: sem a mão
  });
});

describe('runner — mascotes em corrida', () => {
  it('4 corredores renderizam com cor, tamanho e custo controlado por qualidade', () => {
    const seen = new Set<string>();
    for (const team of TEAMS) {
      const r = render(<MascotRunner team={team} size={240} color="#ABCDEF" />);
      expect(svgOf(r).props.width).toBe(240);
      expect(svgOf(r).props.height).toBe(220);
      expect(strokes(r, '#ABCDEF')).toBeGreaterThan(0);
      expect(frame(r).props['aria-hidden']).toBe(true);
      const n = runnerNodes(team, '#ABCDEF');
      const [full, lite] = (['completo', 'leve'] as const).map((q) => countPrims(expand(n, q)));
      expect(full).toBeLessThanOrEqual(380);
      expect(lite).toBeLessThan(full * 0.75); // `leve` para os 4 juntos na escolha de time
      seen.add(JSON.stringify(expand(n, 'plano')));
    }
    expect(seen.size).toBe(4);
  });

  it('animado vira 2 camadas (rastro e corpo), só transform e opacidade', () => {
    const r = render(<MascotRunner team="coyotes" animated accessibilityLabel="Faro correndo" />);
    expect(r.root.findAllByType(Svg).length).toBe(2);
    expect(frame(r).props.accessibilityLabel).toBe('Faro correndo');
    const animatedStyles = r.root
      .findAll((n: ReactTestInstance) => String(n.type) === 'Animated.View')
      .flatMap((n) => [n.props.style].flat(3))
      .filter(Boolean)
      .flatMap((s: object) => Object.keys(s));
    expect(animatedStyles.filter((k) => !['position', 'left', 'right', 'top', 'bottom', 'pointerEvents', 'transformOrigin', 'transform', 'opacity'].includes(k))).toEqual([]);
  });
});
