/**
 * T7.3.4 (E4) — arte da onda 3: 1 teste de renderização por família nova (chama e gelo da sequência, ícone da
 * aba Correr e os estados vazios novos): renderiza sem erro, aplica cor e tamanho, cada estado gera uma árvore
 * diferente, não usa filtro nem texto e segue a regra de acessibilidade do sistema.
 */
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import Svg from 'react-native-svg';

let mockReduced = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useReducedMotion: () => mockReduced,
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
import { ART, EMPTY_KINDS, EMPTY_LABELS, EmptyArt, ICE, RUN_TAB_VARIANTS, RunTabIcon, STREAK_STATES, StreakArt, streakLabel } from '..';
import { emptyNodes, type EmptyKind } from '../empty/empty-art';
import { expand, type Prim } from '../neon/core';
import { streakLayerNodes, streakNodes } from '../streak/streak-art';
import { runTabNodes } from '../tab-icon/run-tab-art';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
const clean = (prims: Prim[]) => {
  expect(tags(prims).filter((t) => !ALLOWED.has(t))).toEqual([]);
  expect(attrs(prims).some((a) => /filter|blur/i.test(a))).toBe(false);
};

describe('streak — chama e gelo da sequência', () => {
  it('3 estados renderizam com cor e tamanho, são diferentes e decorativos por padrão', () => {
    const seen = new Set<string>();
    for (const state of STREAK_STATES) {
      const r = render(<StreakArt state={state} size={120} color="#123456" testID={`seq-${state}`} />);
      expect(svgOf(r).props.width).toBe(120);
      expect(svgOf(r).props.height).toBe(140);
      expect(frame(r).props['aria-hidden']).toBe(true);
      expect(frame(r).props.testID).toBe(`seq-${state}`);
      if (state !== 'gelo') expect(strokes(r, '#123456')).toBeGreaterThan(0);
      else expect(strokes(r, ICE)).toBeGreaterThan(0); // o gelo é sempre azul-gelo
      const prims = expand(streakNodes(state, '#123456'), 'completo');
      clean(prims);
      seen.add(JSON.stringify(prims));
    }
    expect(seen.size).toBe(3);
    const labeled = render(<StreakArt state="fraca" accessibilityLabel={streakLabel('fraca')} />);
    expect(frame(labeled).props.accessibilityLabel).toBe('Falta 1 atividade para garantir a semana');
  });

  it('camadas: "gelo" é só o cristal (sem laranja) e "chama" do gelo não tem o cristal', () => {
    const ice = render(<StreakArt state="acesa" layer="gelo" />);
    expect(strokes(ice, ICE)).toBeGreaterThan(0);
    expect(strokes(ice, ART.orange)).toBe(0);
    const iceStr = JSON.stringify(expand(streakLayerNodes('gelo', 'gelo'), 'completo'));
    const flameStr = JSON.stringify(expand(streakLayerNodes('gelo', 'chama'), 'completo'));
    expect(flameStr.length).toBeGreaterThan(0);
    expect(iceStr).not.toEqual(flameStr);
    expect(JSON.stringify(expand(streakNodes('gelo'), 'completo')).length).toBeGreaterThan(iceStr.length);
  });

  it('animado vira camadas (fundo, chama, brilho) só com transform e opacidade; com movimento reduzido, fica parado', () => {
    const r = render(<StreakArt state="acesa" animated />);
    expect(r.root.findAllByType(Svg).length).toBe(3);
    const styles = r.root.findAll((n: ReactTestInstance) => String(n.type) === 'Animated.View').flatMap((n) => [n.props.style].flat(3));
    const keys = new Set(styles.filter(Boolean).flatMap((s) => Object.keys(s as object)));
    for (const k of keys) expect(['transform', 'opacity', 'transformOrigin', 'position', 'left', 'right', 'top', 'bottom', 'pointerEvents']).toContain(k);
    expect(render(<StreakArt state="gelo" animated />).root.findAllByType(Svg).length).toBe(4); // fundo, chama, gelo, brilho
    mockReduced = true;
    const still = render(<StreakArt state="acesa" animated />);
    expect(still.root.findAllByType(Svg).length).toBe(3); // mesmas camadas, sem animação rodando
    mockReduced = false;
  });
});

describe('run-tab — ícone laranja da aba Correr', () => {
  it('padrão e selecionado renderizam no laranja e no tamanho pedido, sem halo e decorativos', () => {
    const seen = new Set<string>();
    for (const v of RUN_TAB_VARIANTS) {
      const r = render(<RunTabIcon variant={v} size={28} />);
      expect(svgOf(r).props.width).toBe(28);
      expect(svgOf(r).props.height).toBe(28);
      expect(strokes(r, ART.orange)).toBeGreaterThan(0);
      expect(frame(r).props['aria-hidden']).toBe(true);
      const prims = expand(runTabNodes(v), 'plano');
      clean(prims);
      seen.add(JSON.stringify(prims));
    }
    expect(seen.size).toBe(2);
    expect(strokes(render(<RunTabIcon color="#ABCDEF" />), '#ABCDEF')).toBeGreaterThan(0);
  });
});

describe('empty — estados vazios novos', () => {
  const NEW: EmptyKind[] = ['sem-liga', 'sem-chefao', 'feed-vazio', 'volte-amanha', 'sem-endereco'];
  it('os novos e o "sem medalhas" redesenhado renderizam com acento e tamanho, todos diferentes', () => {
    expect(EMPTY_KINDS).toEqual(expect.arrayContaining([...NEW, 'sem-medalhas']));
    expect(EMPTY_KINDS.length).toBe(13);
    const seen = new Set<string>();
    for (const kind of [...NEW, 'sem-medalhas'] as EmptyKind[]) {
      expect(EMPTY_LABELS[kind].length).toBeGreaterThan(3);
      const r = render(<EmptyArt kind={kind} size={240} color="#654321" team="volt" testID={`vazio-${kind}`} />);
      expect(svgOf(r).props.width).toBe(240);
      expect(svgOf(r).props.height).toBe(160);
      expect(frame(r).props['aria-hidden']).toBe(true);
      // O "sem chefão" usa o violeta dos vilões, não o acento.
      expect(strokes(r, kind === 'sem-chefao' ? ART.villain : '#654321')).toBeGreaterThan(0);
      const prims = expand(emptyNodes(kind, '#654321', 'volt'), 'completo');
      clean(prims);
      seen.add(JSON.stringify(prims));
    }
    expect(seen.size).toBe(6);
    // "Volte amanhã" traz o mascote do time da pessoa.
    expect(strokes(render(<EmptyArt kind="volte-amanha" team="coyotes" />), ART.team.coyotes)).toBeGreaterThan(0);
  });
});
