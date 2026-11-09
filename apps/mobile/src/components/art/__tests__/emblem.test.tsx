/**
 * F8 · A1 (E4) — emblema do time v2 (D-90): cabeça do mascote na forma do time. Variantes (mini/médio/grande e
 * `auto`), piso de 18 pt, `on`/`mono`, neutro, `attack`, qualidade só no grande, acessibilidade, o alias
 * `TeamBadge` e o `TeamEmblemInSvg` do card.
 */
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import Svg, { G } from 'react-native-svg';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useReducedMotion: () => false,
}));

/* eslint-disable import/first */
import { ART, EMBLEM_MIN_SIZE, emblemLabel, resolveEmblemVariant, TeamEmblem, TeamEmblemInSvg } from '..';
import { countPrims, expand } from '../neon/core';
import { emblemNodes, EMBLEM_HEADS, EMBLEM_SHAPES, type EmblemVariant } from '../team/emblem-art';
import { TeamBadge } from '@/components/team-badge';
import { palette } from '@/theme/tokens';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEAMS = ['striders', 'volt', 'owls', 'coyotes'] as const;
const VARIANTS: readonly EmblemVariant[] = ['mini', 'medio', 'grande'];

function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  return r!;
}
const svgOf = (r: ReactTestRenderer) => r.root.findAllByType(Svg)[0];
const fills = (r: ReactTestRenderer, color: string) => r.root.findAll((n: ReactTestInstance) => n.props?.fill === color).length;
const strokes = (r: ReactTestRenderer, color: string) => r.root.findAll((n: ReactTestInstance) => n.props?.stroke === color).length;
const frame = (r: ReactTestRenderer) => r.root.findAll((n: ReactTestInstance) => String(n.type) === 'View' && ('aria-hidden' in n.props || 'accessibilityLabel' in n.props))[0];
const tree = (team: Parameters<typeof emblemNodes>[0], o: Parameters<typeof emblemNodes>[1]) => JSON.stringify(expand(emblemNodes(team, o), 'completo'));

describe('TeamEmblem — geometria', () => {
  it('as 4 cabeças e as 4 formas existem; cada time gera uma árvore diferente em cada variante', () => {
    expect(Object.keys(EMBLEM_HEADS).sort()).toEqual([...TEAMS].sort());
    expect(Object.keys(EMBLEM_SHAPES).sort()).toEqual(['circulo', 'losango', 'quadrado', 'triangulo']);
    for (const variant of VARIANTS) {
      const seen = new Set(TEAMS.map((t) => tree(t, { variant, size: 64 })));
      expect(seen.size).toBe(4);
    }
  });

  it('`auto` resolve pelo tamanho: < 40 mini · < 96 médio · ≥ 96 grande', () => {
    expect(resolveEmblemVariant('auto', 18)).toBe('mini');
    expect(resolveEmblemVariant(undefined, 39)).toBe('mini');
    expect(resolveEmblemVariant('auto', 40)).toBe('medio');
    expect(resolveEmblemVariant('auto', 95)).toBe('medio');
    expect(resolveEmblemVariant('auto', 96)).toBe('grande');
    expect(resolveEmblemVariant('mini', 200)).toBe('mini');
  });

  it('nenhuma linha no mini e no médio (só polígonos cheios e contorno da forma); o rosto line-art só no grande', () => {
    for (const team of TEAMS) {
      for (const variant of ['mini', 'medio'] as const) {
        const kinds = emblemNodes(team, { variant, size: 64 }).map((n) => n.kind);
        expect(kinds.filter((k) => k === 'neon' || k === 'glow')).toEqual([]);
      }
      const grande = emblemNodes(team, { variant: 'grande', size: 120 });
      expect(grande.some((n) => n.kind === 'group' && n.children.some((c) => c.kind === 'neon'))).toBe(true);
      expect(countPrims(expand(grande, 'completo'))).toBeGreaterThan(countPrims(expand(emblemNodes(team, { variant: 'medio', size: 64 }), 'completo')));
    }
  });

  it('a qualidade só muda o grande: mini e médio são iguais em plano e completo', () => {
    for (const team of TEAMS) {
      for (const variant of ['mini', 'medio'] as const) {
        const nodes = emblemNodes(team, { variant, size: 64 });
        expect(JSON.stringify(expand(nodes, 'plano'))).toBe(JSON.stringify(expand(nodes, 'completo')));
      }
      const g = emblemNodes(team, { variant: 'grande', size: 120 });
      expect(countPrims(expand(g, 'completo'))).toBeGreaterThan(countPrims(expand(g, 'plano')));
    }
  });

  it('mini ganha pupilas a partir de 24 pt', () => {
    for (const team of ['striders', 'volt', 'coyotes'] as const) {
      expect(tree(team, { variant: 'mini', size: 20 })).not.toBe(tree(team, { variant: 'mini', size: 24 }));
    }
  });
});

describe('TeamEmblem — componente', () => {
  it('4 times × 3 variantes renderizam, aplicam cor e tamanho e são decorativos por padrão', () => {
    for (const team of TEAMS) {
      for (const [variant, size] of [
        ['mini', 24],
        ['medio', 48],
        ['grande', 120],
      ] as const) {
        const r = render(<TeamEmblem team={team} variant={variant} size={size} color="#123456" />);
        expect(svgOf(r).props.width).toBe(size);
        expect(svgOf(r).props.height).toBe(size);
        expect(fills(r, '#123456') + strokes(r, '#123456')).toBeGreaterThan(0);
        expect(frame(r).props['aria-hidden']).toBe(true);
      }
    }
  });

  it('cor padrão é o neon do time (D-90), nunca a cor sólida dos tokens', () => {
    for (const team of TEAMS) {
      const r = render(<TeamEmblem team={team} size={24} />);
      expect(fills(r, ART.team[team])).toBeGreaterThan(0);
      expect(fills(r, '#0072B2') + fills(r, '#009E73') + fills(r, '#D7263D') + fills(r, '#D9B200')).toBe(0);
    }
  });

  it('piso de 18 pt: abaixo disso sobe para 18', () => {
    const r = render(<TeamEmblem team="owls" size={12} />);
    expect(svgOf(r).props.width).toBe(EMBLEM_MIN_SIZE);
    expect(EMBLEM_MIN_SIZE).toBe(18);
  });

  it('`on` é a cor das feições no mini; `mono` desenha a forma em `color` e a cabeça em `on`', () => {
    const mini = render(<TeamEmblem team="coyotes" size={24} on="#ABCDEF" />);
    expect(fills(mini, '#ABCDEF')).toBeGreaterThan(0);
    const mono = render(<TeamEmblem team="volt" size={40} mono color="#070708" on={ART.orange} />);
    expect(fills(mono, '#070708')).toBeGreaterThan(0);
    expect(fills(mono, ART.orange)).toBeGreaterThan(0);
    expect(fills(mono, ART.team.volt) + strokes(mono, ART.team.volt)).toBe(0); // uma cor só: nada do neon do time
    expect(strokes(mono, '#070708') + strokes(mono, ART.orange)).toBe(0); // sem halo
  });

  it('`team = null` é a zona neutra: anel tracejado cinza, sem cor de time', () => {
    const r = render(<TeamEmblem team={null} size={30} />);
    expect(svgOf(r).props.width).toBe(30);
    const dashed = r.root.findAll((n: ReactTestInstance) => n.props?.strokeDasharray !== undefined && n.props?.stroke === ART.ink2);
    expect(dashed.length).toBeGreaterThan(0);
    for (const team of TEAMS) expect(fills(r, ART.team[team]) + strokes(r, ART.team[team])).toBe(0);
  });

  it('`attack` acrescenta o anel tracejado vermelho do mapa por fora', () => {
    const calm = render(<TeamEmblem team="striders" size={34} />);
    const attacked = render(<TeamEmblem team="striders" size={34} attack />);
    expect(strokes(calm, palette.danger)).toBe(0);
    const ring = attacked.root.findAll((n: ReactTestInstance) => n.props?.stroke === palette.danger && n.props?.strokeDasharray !== undefined);
    expect(ring.length).toBe(1);
  });

  it('com rótulo vira imagem informativa; `emblemLabel` dá o texto', () => {
    const r = render(<TeamEmblem team="owls" size={48} accessibilityLabel={emblemLabel('owls')} testID="emblema-owls" />);
    const f = frame(r);
    expect(f.props.accessibilityRole).toBe('image');
    expect(f.props.accessibilityLabel).toBe('Emblema dos Night Owls');
    expect(f.props.testID).toBe('emblema-owls');
    expect(emblemLabel(null)).toBe('Zona neutra, sem time');
  });
});

describe('TeamBadge — alias do emblema (troca os 27 usos de uma vez)', () => {
  it('mantém a assinatura `faction`/`size`/`attack` e desenha o emblema `auto`', () => {
    const r = render(<TeamBadge faction="coyotes" size={34} />);
    expect(svgOf(r).props.width).toBe(34);
    expect(fills(r, ART.team.coyotes)).toBeGreaterThan(0);
    expect(fills(r, '#D9B200')).toBe(0); // o disco sólido antigo sumiu
    expect(frame(r).props['aria-hidden']).toBe(true);
    const neutral = render(<TeamBadge faction={null} />);
    expect(svgOf(neutral).props.width).toBe(28);
    const attacked = render(<TeamBadge faction="volt" size={40} attack />);
    expect(strokes(attacked, palette.danger)).toBe(1);
  });
});

describe('TeamEmblemInSvg — dentro do SVG do card', () => {
  it('vira um G na caixa { cx, cy, size }, sem View, com `on` nas feições', () => {
    const r = render(
      <Svg width={200} height={200}>
        <TeamEmblemInSvg team="striders" variant="mini" box={{ cx: 100, cy: 100, size: 54 }} on="#111111" />
      </Svg>,
    );
    expect(r.root.findAllByType(G).length).toBeGreaterThan(0);
    expect(r.root.findAll((n: ReactTestInstance) => String(n.type) === 'View').length).toBe(0);
    expect(fills(r, ART.team.striders)).toBeGreaterThan(0);
    expect(fills(r, '#111111')).toBeGreaterThan(0);
    const fitted = r.root.findAllByType(G).filter((g: ReactTestInstance) => typeof g.props.transform === 'string' && g.props.transform.startsWith('translate('));
    expect(fitted.length).toBe(1);
    expect(fitted[0].props.transform).toBe('translate(73 73) scale(0.54)');
  });
});
