/**
 * T7.1.10 (E4) — sistema de arte: 1 teste de renderização por família (renderiza sem erro, aplica cor e
 * tamanho, cada pose/estado gera uma árvore diferente) e as regras do traço (qualidade, sem filtro, sem texto
 * dentro do SVG, fundo ≤ 6%, decorativo fora do leitor de tela).
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
import {
  ART,
  Boss,
  BOSS_IDS,
  BOSS_STATES,
  Chest,
  CHEST_RARITIES,
  CHEST_STATES,
  EMPTY_KINDS,
  EmptyArt,
  Mascot,
  MASCOT_POSES,
  MAX_BACKGROUND_OPACITY,
  Medal,
  MEDAL_KINDS,
  MODE_ICON_KINDS,
  ModeIcon,
  TAB_BACKGROUND_KINDS,
  TabBackground,
  TeamEmblem,
  TUTORIAL_STEPS,
  TutorialArt,
  VILLAIN,
} from '..';
import { bossNodes } from '../boss/boss-art';
import { countPrims, expand, resolveQuality, type Prim } from '../neon/core';
import { mascotNodes } from '../team/mascot-art';
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

describe('neon — traço em camadas', () => {
  it('completo > leve > plano em elementos; `auto` escolhe pelo tamanho', () => {
    const n = mascotNodes('striders', 'parado', ART.team.striders);
    const [full, lite, flat] = (['completo', 'leve', 'plano'] as const).map((q) => countPrims(expand(n, q)));
    expect(full).toBeGreaterThan(lite);
    expect(lite).toBeGreaterThan(flat);
    expect(full).toBeLessThanOrEqual(240); // ~230 elementos no mascote completo
    expect(resolveQuality('auto', 200)).toBe('completo');
    expect(resolveQuality(undefined, 64)).toBe('leve');
    expect(resolveQuality('auto', 28)).toBe('plano');
    expect(resolveQuality('leve', 300)).toBe('leve');
  });

  it('sem filtro de desfoque e sem texto dentro do SVG', () => {
    const prims = expand(bossNodes('mormaco', 'furioso', 2, VILLAIN), 'completo');
    const allowed = new Set(['g', 'path', 'circle', 'rect', 'ellipse']);
    expect(tags(prims).filter((t) => !allowed.has(t))).toEqual([]);
    expect(attrs(prims).some((a) => /filter|blur/i.test(a))).toBe(false);
  });
});

describe('team — mascotes e emblemas', () => {
  it('4 times × 4 poses renderizam, aplicam cor e tamanho e cada pose é diferente', () => {
    for (const team of TEAMS) {
      const seen = new Set<string>();
      for (const pose of MASCOT_POSES) {
        const r = render(<Mascot team={team} pose={pose} size={140} color="#123456" />);
        expect(svgOf(r).props.width).toBe(140);
        expect(strokes(r, '#123456')).toBeGreaterThan(0);
        expect(frame(r).props['aria-hidden']).toBe(true); // decorativo por padrão
        seen.add(JSON.stringify(expand(mascotNodes(team, pose, '#123456'), 'plano')));
      }
      expect(seen.size).toBe(4);
    }
  });

  it('animado vira camadas (corpo, cabeça, olhos, topo) e aceita rótulo', () => {
    const r = render(<Mascot team="owls" animated accessibilityLabel="Breu, mascote dos Night Owls" />);
    expect(r.root.findAllByType(Svg).length).toBe(4);
    expect(frame(r).props.accessibilityLabel).toBe('Breu, mascote dos Night Owls');
    expect(strokes(r, ART.team.owls)).toBeGreaterThan(0);
  });

  it('emblema v2 (D-90): nunca escreve o nome dentro do SVG; aplica cor e tamanho no grande e no mini', () => {
    const full = render(<TeamEmblem team="coyotes" size={160} />);
    expect(svgOf(full).props.width).toBe(160);
    expect(full.root.findAll((n: ReactTestInstance) => n.props?.children === 'URBAN COYOTES').length).toBe(0);
    expect(strokes(full, ART.team.coyotes)).toBeGreaterThan(0); // o grande tem o rosto line-art
    const small = render(<TeamEmblem team="coyotes" size={32} color="#00FF00" />);
    expect(small.root.findAll((n: ReactTestInstance) => n.props?.children === 'URBAN COYOTES').length).toBe(0);
    expect(small.root.findAll((n: ReactTestInstance) => n.props?.fill === '#00FF00').length).toBeGreaterThan(0); // o mini é cheio, sem linha
    expect(strokes(small, '#00FF00')).toBe(0);
  });
});

describe('boss — chefões', () => {
  it('5 chefões × 4 estados × dano 0/1/2 renderizam, com rótulo e cor', () => {
    for (const id of BOSS_IDS) {
      const seen = new Set<string>();
      for (const state of BOSS_STATES) {
        const r = render(<Boss id={id} state={state} size={120} />);
        expect(svgOf(r).props.width).toBe(120);
        expect(frame(r).props.accessibilityLabel).toMatch(/^Chefão /);
        seen.add(JSON.stringify(bossNodes(id, state, 0, VILLAIN)));
      }
      expect(seen.size).toBe(4);
      const d = [0, 1, 2].map((n) => countPrims(expand(bossNodes(id, 'parado', n as 0 | 1 | 2, VILLAIN), 'plano')));
      expect(d[1]).toBeGreaterThan(d[0]);
      expect(d[2]).toBeGreaterThan(d[1]);
    }
    const r = render(<Boss id="paredao" color="#ABCDEF" animated decorative />);
    expect(strokes(r, '#ABCDEF')).toBeGreaterThan(0);
    expect(frame(r).props['aria-hidden']).toBe(true);
  });
});

describe('chest — baús', () => {
  it('3 raridades × 3 estados renderizam; o lendário declara o prisma; a tampa vira camada', () => {
    for (const rarity of CHEST_RARITIES)
      for (const state of CHEST_STATES) {
        const r = render(<Chest rarity={rarity} state={state} size={100} />);
        expect(svgOf(r).props.width).toBe(100);
        expect(frame(r).props.accessibilityLabel).toMatch(/^Baú /);
        const gradient = r.root.findAll((n: ReactTestInstance) => typeof n.props?.stroke === 'string' && n.props.stroke.startsWith('url(#'));
        expect(gradient.length > 0).toBe(rarity === 'lendario');
      }
    const r = render(<Chest rarity="raro" color="#FEDCBA" parts={{ tampa: { opacity: 1 } }} />);
    expect(r.root.findAllByType(Svg).length).toBe(4);
    expect(strokes(r, '#FEDCBA')).toBeGreaterThan(0);
  });
});

describe('medal — medalhas', () => {
  it('12 medalhas × 3 níveis + bloqueada renderizam, com rótulo, cor e tamanho', () => {
    expect(MEDAL_KINDS).toHaveLength(12);
    for (const kind of MEDAL_KINDS) {
      for (const tier of [1, 2, 3] as const) expect(svgOf(render(<Medal kind={kind} tier={tier} />)).props.width).toBe(72);
      const locked = render(<Medal kind={kind} locked size={64} />);
      expect(frame(locked).props.accessibilityLabel).toMatch(/bloqueada$/);
    }
    const r = render(<Medal kind="explorador" tier={3} color="#0F0F0F" size={80} />);
    expect(svgOf(r).props.width).toBe(80);
    expect(svgOf(r).props.height).toBe(100);
    expect(strokes(r, '#0F0F0F')).toBeGreaterThan(0);
  });
});

describe('mode-icons — ícones dos modos', () => {
  it('8 ícones renderizam em 28 pt (plano) e aplicam cor', () => {
    expect(MODE_ICON_KINDS).toHaveLength(8);
    for (const kind of MODE_ICON_KINDS) {
      const r = render(<ModeIcon kind={kind} size={28} color="#111111" accent="#222222" />);
      expect(svgOf(r).props.width).toBe(28);
      expect(strokes(r, '#111111') + strokes(r, '#222222')).toBeGreaterThan(0);
    }
  });
});

describe('empty — estados vazios', () => {
  it('13 estados (8 da onda 1 e 5 da onda 3) renderizam, decorativos; o mascote usa a cor do time', () => {
    expect(EMPTY_KINDS).toHaveLength(13);
    for (const kind of EMPTY_KINDS) {
      const r = render(<EmptyArt kind={kind} size={200} color="#ABABAB" team="volt" />);
      expect(svgOf(r).props.width).toBe(200);
      expect(frame(r).props['aria-hidden']).toBe(true);
      if (kind === 'sem-notificacoes') expect(strokes(r, ART.team.volt)).toBeGreaterThan(0);
      else if (kind === 'sem-chefao') expect(strokes(r, ART.villain)).toBeGreaterThan(0);
      else expect(strokes(r, '#ABABAB')).toBeGreaterThan(0);
    }
  });
});

describe('tutorial — cartões', () => {
  it('corra, pinte e defenda renderizam; pinte e defenda usam a cor do time', () => {
    for (const step of TUTORIAL_STEPS) {
      const r = render(<TutorialArt step={step} team="owls" size={240} />);
      expect(svgOf(r).props.width).toBe(240);
      if (step !== 'corra') expect(strokes(r, ART.team.owls)).toBeGreaterThan(0);
    }
    expect(strokes(render(<TutorialArt step="pinte" color="#C0FFEE" />), '#C0FFEE')).toBeGreaterThan(0);
  });
});

describe('backgrounds — fundos das abas', () => {
  it('4 fundos estáticos, decorativos e nunca acima de 6%', () => {
    for (const kind of TAB_BACKGROUND_KINDS) {
      const r = render(<TabBackground kind={kind} team="coyotes" opacity={0.5} />);
      const view = frame(r);
      expect(view.props['aria-hidden']).toBe(true);
      const style = [view.props.style].flat(3).reduce((a: Record<string, unknown>, s: object) => ({ ...a, ...s }), {});
      expect(style.opacity).toBeLessThanOrEqual(MAX_BACKGROUND_OPACITY);
      expect(svgOf(r).props.width).toBe('100%');
    }
  });
});
