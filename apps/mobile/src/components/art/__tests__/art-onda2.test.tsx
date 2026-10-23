/**
 * T7.2.8 (E4) — arte da onda 2: 1 teste de renderização por família nova (líderes, corredores, logo, partes
 * para a E5 e arte dentro de um SVG maior para a E8): renderiza sem erro, aplica cor e tamanho, cada
 * pose/variante gera uma árvore diferente e a acessibilidade segue a regra do sistema.
 */
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import Svg, { G } from 'react-native-svg';

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
  bossSlot,
  BossSvgArt,
  Chest,
  CHEST_LAYERS,
  LeaderBust,
  LEADER_NAMES,
  LEADER_POSES,
  Logo,
  LOGO_VARIANTS,
  LogoSvgArt,
  MascotRunner,
  mascotSlot,
  MascotSvgArt,
  VILLAIN,
} from '..';
import { neon } from '@/theme/neon';
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

describe('logo — símbolo, logotipo e horizontal', () => {
  it('3 variantes renderizam como imagem "NOMADE RUN", com tamanho, cores da marca e sem texto no SVG', () => {
    for (const variant of LOGO_VARIANTS) {
      const r = render(<Logo variant={variant} size={200} testID={`logo-${variant}`} />);
      expect(svgOf(r).props.width).toBe(200);
      expect(frame(r).props.accessibilityLabel).toBe('NOMADE RUN');
      expect(frame(r).props.accessibilityRole).toBe('image');
      expect(frame(r).props.testID).toBe(`logo-${variant}`);
      expect(strokes(r, ART.orange)).toBeGreaterThan(0);
      expect(r.root.findAll((n: ReactTestInstance) => String(n.type) === 'Text' || n.props?.children === 'NOMADE RUN').length).toBe(0);
    }
    const sym = render(<Logo size={96} />);
    for (const c of Object.values(ART.team)) expect(strokes(sym, c)).toBeGreaterThan(0); // as 4 cores dos times no anel
    const mono = render(<Logo variant="horizontal" size={240} mono="#FFFFFF" decorative />);
    expect(frame(mono).props['aria-hidden']).toBe(true);
    expect(strokes(mono, ART.orange)).toBe(0);
    expect(strokes(mono, '#FFFFFF')).toBeGreaterThan(0);
  });
});

describe('partes para a E5 — baú em camadas e silhueta do chefão', () => {
  it('cada camada do baú desenha só a sua parte, decorativa, na caixa inteira', () => {
    const sizes = new Set<number>();
    for (const rarity of ['comum', 'raro', 'lendario'] as const) {
      const counts = CHEST_LAYERS.map((layer) => {
        const r = render(<Chest rarity={rarity} layer={layer} size={120} />);
        expect(svgOf(r).props.width).toBe(120);
        expect(frame(r).props['aria-hidden']).toBe(true);
        return r.root.findAll((n: ReactTestInstance) => n.props?.stroke !== undefined).length;
      });
      const full = render(<Chest rarity={rarity} size={120} />).root.findAll((n: ReactTestInstance) => n.props?.stroke !== undefined).length;
      expect(counts[0] + counts[1]).toBe(full); // corpo + tampa = o baú fechado inteiro
      counts.forEach((c) => sizes.add(c));
    }
    expect(sizes.size).toBeGreaterThan(3);
    expect(frame(render(<Chest rarity="raro" layer="item" accessibilityLabel="Prêmio do baú" />)).props.accessibilityLabel).toBe('Prêmio do baú');
  });

  it('a silhueta do chefão é a mesma arte numa cor só, sem o chão, e decorativa', () => {
    const r = render(<Boss id="paredao" state="golpe" silhouette size={140} />);
    expect(svgOf(r).props.width).toBe(140);
    expect(frame(r).props['aria-hidden']).toBe(true);
    const colors = new Set(r.root.findAll((n: ReactTestInstance) => typeof n.props?.stroke === 'string' && n.props.stroke !== 'none').map((n) => n.props.stroke));
    expect([...colors]).toEqual([ART.white]);
    const tinted = render(<Boss id="mormaco" silhouette="#FFEEDD" animated parts={{ corpo: { opacity: 1 } }} />);
    expect(r.root.findAllByType(Svg).length).toBe(1);
    expect(tinted.root.findAllByType(Svg).length).toBe(2); // sem a camada do chão: raios + corpo
    expect(strokes(tinted, '#FFEEDD')).toBeGreaterThan(0);
    expect(strokes(tinted, VILLAIN)).toBe(0);
    expect(VILLAIN).toBe(neon.villain); // o violeta vem do token
  });
});

describe('dentro de um SVG maior — contrato { cx, cy, size } da E8', () => {
  it('mascote, chefão e logo viram <G> encaixados na caixa, sem View e sem Image', () => {
    const box = { cx: 540, cy: 900, size: 440 };
    const r = render(
      <Svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <MascotSvgArt team="owls" pose="vitoria" box={box} />
        <BossSvgArt id="soneca" state="derrotado" box={{ cx: 540, cy: 600, size: 480 }} />
        <BossSvgArt id="soneca" state="golpe" box={{ cx: 540, cy: 600, size: 480 }} silhouette="#FFFFFF" />
        <LogoSvgArt variant="horizontal" box={{ cx: 540, cy: 1700, size: 640 }} />
        {mascotSlot('volt')({ cx: 200, cy: 200, size: 120 })}
        {bossSlot('fuligem')({ cx: 880, cy: 200, size: 120 })}
      </Svg>,
    );
    const groups = r.root.findAll((n: ReactTestInstance) => n.type === G && typeof n.props.transform === 'string' && n.props.transform.startsWith('translate('));
    expect(groups.length).toBe(6);
    // Mascote 200 × 220 no quadrado de 440: escala 2, centrado em (540, 900).
    expect(groups[0].props.transform).toBe('translate(340 680) scale(2)');
    expect(r.root.findAll((n: ReactTestInstance) => ['View', 'Image'].includes(String(n.type))).length).toBe(0);
    expect(strokes(r, ART.team.owls)).toBeGreaterThan(0);
    expect(strokes(r, ART.team.volt)).toBeGreaterThan(0);
  });
});
