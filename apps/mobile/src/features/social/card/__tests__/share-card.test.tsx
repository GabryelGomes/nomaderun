/**
 * T7.1.9 — renderização dos cards (react-native-svg): 5 modelos × 2 formatos, com e sem rota, adesivo,
 * selo de demonstração, arte por props e privacidade (nenhuma coordenada desenhada dentro de zona).
 */
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import Svg, { Circle } from 'react-native-svg';

import { offset } from '@/domain/geo';
import { clipRouteForSharing, type SharedRoute } from '@/domain/share-privacy';
import type { LatLng } from '@/domain/types';

import { buildCarousel, buildWeekCarousel } from '../pick-models';
import { buildBossCard, buildLevelCard, buildRunCard, buildWeekCard, buildZoneCard, DEFAULT_CARD_CHOICES, type CardModel, type RunCardModel, type ShareCardFormat } from '../card-model';
import { LogoSvgArt, MascotSvgArt, BossSvgArt } from '@/components/art';

import { bossIdOf } from '../card-art';
import { CARD_FORMATS, CARD_SLOGAN_FEED, CARD_SLOGAN_STORIES, cardLogoLayout, STORIES_SAFE } from '../card-frame';
import { cardColors, DEMO_STAMP } from '../card-parts';
import { frameRoutes } from '../route-geometry';
import { ShareCard } from '../share-card';
import { ShareSticker } from '../sticker-card';
import { DEMO_ROUTE, demoRunInput, demoWeekInput } from './fixtures';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
// T7.3.7: a arte da E4 (logo, mascote, chefão) passa pelo render animável, que importa o Reanimated.
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
/* eslint-enable @typescript-eslint/no-require-imports */

function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  return r!;
}

const texts = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
/** Caminhos do núcleo claro do traço neon (rota ou pista oval da versão sem rota). */
const corePaths = (r: ReactTestRenderer) => r.root.findAll((n: ReactTestInstance) => typeof n.type !== 'string' && n.props.stroke === cardColors.orangeCore && typeof n.props.d === 'string').map((n) => n.props.d as string);
const routePaths = (r: ReactTestRenderer) => corePaths(r).filter((d) => d.includes('L') && !d.includes('a'));
const coords = (d: string) => [...d.matchAll(/[ML](-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

const input = demoRunInput();
const models: CardModel[] = [buildRunCard(input), buildZoneCard(input)!, buildLevelCard(input)!, buildBossCard(input)!, buildWeekCard(demoWeekInput())];
const formats: ShareCardFormat[] = ['stories', 'feed'];

const EXPECTED: Record<CardModel['kind'], string[]> = {
  run: ['2,02', 'km', 'TEMPO', '10:29', 'RITMO', '5:12', '/km', 'PONTOS', '+183', 'SEXTA · 23 OUT · GOIÂNIA', '1 zona conquistada · 3 reforçadas'],
  zone: ['ZONA CONQUISTADA', 'Jardim Goiás', 'Urban Coyotes', 'Neon Striders', '+46', 'pontos', '2,02 km · 10:29 · 5:12 /km'],
  level: ['NÍVEL', '8', 'NÍVEL NOVO', 'Cheguei ao nível 8', 'Faltam 1.900 XP para o nível 9', '86', 'KM NO TOTAL', 'ZONAS', 'CORRIDAS'],
  boss: ['DERROTADO', 'CHEFÃO DA CIDADE', 'Mormaço de Outubro', 'Goiânia correu 3.600 km em 5 dias', 'MEU DANO', '6,3', 'Flamboyant Runners · 1º lugar · 412 km'],
  week: ['MINHA SEMANA', '19 – 25 OUT', '12,4', '4,1', '3,6', '4,7', 'CORRIDAS', '1h04', 'EM MOVIMENTO', 'Sequência de 4 semanas'],
};

describe('ShareCard — 5 modelos × 2 formatos', () => {
  for (const model of models) {
    for (const format of formats) {
      it(`${model.kind} · ${format}: renderiza com os textos certos, logo, time e selo de demonstração`, () => {
        const r = render(<ShareCard model={model} format={format} width={360} testID="card" />);
        const svg = r.root.find((n) => n.type === Svg && n.props.testID === 'card');
        const { W, H } = CARD_FORMATS[format];
        expect(svg.props.viewBox).toBe(`0 0 ${W} ${H}`);
        expect(svg.props.height).toBeCloseTo((360 * H) / W, 5);
        expect(svg.props.accessibilityLabel).toBe(model.a11yLabel);
        const t = texts(r);
        // no feed, o recap com mini-rotas não tem espaço para a ficha da sequência (só no Stories)
        const expected = model.kind === 'week' && format === 'feed' ? EXPECTED.week.filter((s) => !s.startsWith('Sequência')) : EXPECTED[model.kind];
        for (const s of expected) expect(t).toContain(s);
        expect(t).toEqual(expect.arrayContaining(['NEON STRIDERS', DEMO_STAMP, format === 'stories' ? CARD_SLOGAN_STORIES : CARD_SLOGAN_FEED]));
        // T7.3.7: o logo é o oficial da E4 (traço, sem <text>), não mais o logotipo provisório em texto.
        const logos = r.root.findAllByType(LogoSvgArt);
        expect(logos).toHaveLength(1);
        expect(logos[0].props.variant).toBe('horizontal');
        expect(t).not.toContain('NOMADE');
      });
    }
  }

  it('sem demonstração, sem selo', () => {
    for (const model of models) {
      const r = render(<ShareCard model={{ ...model, isDemo: false }} format="stories" />);
      expect(texts(r)).not.toContain(DEMO_STAMP);
    }
  });

  it('@ e selo de status aparecem quando pedidos', () => {
    const m = buildRunCard(demoRunInput({ status: 'provisional' }), { ...DEFAULT_CARD_CHOICES, showUsername: true });
    const t = texts(render(<ShareCard model={m} format="feed" />));
    expect(t).toEqual(expect.arrayContaining(['@gabryel', 'PROVISÓRIO']));
    expect(t).not.toContain('PONTOS');
  });
});

describe('com rota e sem rota', () => {
  it('corrida e conquista desenham a rota quando há rota', () => {
    for (const model of models.slice(0, 2))
      for (const format of formats) {
        const r = render(<ShareCard model={model} format={format} />);
        expect(routePaths(r).length).toBe(1);
        expect(texts(r)).not.toContain('ROTA PROTEGIDA');
      }
  });

  it('sem rota: arte "ROTA PROTEGIDA" e nenhum traço de rota', () => {
    for (const format of formats) {
      const run = render(<ShareCard model={buildRunCard(input, { ...DEFAULT_CARD_CHOICES, withRoute: false })} format={format} />);
      expect(texts(run)).toContain('ROTA PROTEGIDA');
      expect(routePaths(run)).toHaveLength(0);
      const zone = render(<ShareCard model={buildZoneCard(input, { ...DEFAULT_CARD_CHOICES, withRoute: false })!} format={format} />);
      expect(routePaths(zone)).toHaveLength(0);
      expect(texts(zone)).toContain('Jardim Goiás');
      const week = render(<ShareCard model={buildWeekCard(demoWeekInput(), { ...DEFAULT_CARD_CHOICES, withRoute: false })} format={format} />);
      expect(routePaths(week)).toHaveLength(0);
      expect(texts(week)).toContain('12,4');
    }
  });

  it('recap com 3 mini-rotas', () => {
    expect(routePaths(render(<ShareCard model={buildWeekCard(demoWeekInput())} format="stories" />))).toHaveLength(3);
  });

  it('carrossel de "mais de 60% escondido" renderiza tudo sem rota', () => {
    const home = { ...offset(DEMO_ROUTE[0], 120, 0), radiusM: 1000 };
    const route = clipRouteForSharing(DEMO_ROUTE, [home], { seed: 3 });
    expect(route.mode).toBe('noRoute');
    for (const m of buildCarousel(demoRunInput({ route }))) expect(routePaths(render(<ShareCard model={m} format="stories" />))).toHaveLength(0);
    expect(buildWeekCarousel(demoWeekInput())).toHaveLength(1);
  });

  it('rota montada à mão não é desenhada (conferência em tempo de execução)', () => {
    const fake = { ...input.route } as SharedRoute;
    const model: RunCardModel = { ...buildRunCard(input), route: fake };
    expect(routePaths(render(<ShareCard model={model} format="stories" />))).toHaveLength(0);
  });

  it('o tipo do card não aceita LatLng[] como rota', () => {
    const raw: LatLng[] = DEMO_ROUTE;
    // @ts-expect-error — a rota do card só pode ser SharedRoute (saída de clipRouteForSharing)
    const bad: RunCardModel = { ...buildRunCard(input), route: raw };
    expect(bad.route).toBe(raw);
  });
});

describe('privacidade no desenho', () => {
  it('30 cortes com a casa no caminho: nenhuma coordenada desenhada dentro da zona', () => {
    const zones = [
      { ...DEMO_ROUTE[0], radiusM: 100 },
      { ...DEMO_ROUTE[30], radiusM: 60 },
    ];
    let drawn = 0;
    for (let seed = 0; seed < 30; seed++) {
      const route = clipRouteForSharing(DEMO_ROUTE, zones, { seed });
      const model = buildRunCard(demoRunInput({ route }));
      const r = render(<ShareCard model={model} format="stories" />);
      const paths = routePaths(r);
      if (route.mode === 'noRoute') {
        expect(paths).toHaveLength(0);
        continue;
      }
      drawn++;
      const frame = frameRoutes([route], { x: 60, y: 370, w: 960, h: 760 }, 40)!;
      for (const z of zones) {
        const [cx, cy] = frame.toPoint(z);
        const rpx = z.radiusM * frame.scale;
        for (const [x, y] of coords(paths[0])) expect(Math.hypot(x - cx, y - cy)).toBeGreaterThan(rpx);
      }
    }
    expect(drawn).toBeGreaterThan(5);
  });
});

describe('arte por props', () => {
  it('função de arte recebe a caixa; ReactNode substitui o marcador', () => {
    const boxes: unknown[] = [];
    const art = {
      mascot: (box: { cx: number; cy: number; size: number }) => {
        boxes.push(box);
        return <Circle testID="mascote-e4" cx={box.cx} cy={box.cy} r={box.size / 2} />;
      },
      boss: <Circle testID="chefao-e4" cx={0} cy={0} r={10} />,
    };
    const level = render(<ShareCard model={buildLevelCard(input)!} format="stories" art={art} />);
    expect(level.root.findAllByProps({ testID: 'mascote-e4' }).length).toBeGreaterThan(0);
    expect(boxes[0]).toEqual({ cx: 540 + 300 * 0.8, cy: 790 + 300 * 0.66, size: 230 });
    const boss = render(<ShareCard model={buildBossCard(input)!} format="feed" art={art} />);
    expect(boss.root.findAllByProps({ testID: 'chefao-e4' }).length).toBeGreaterThan(0);
    const noRoute = render(<ShareCard model={buildRunCard(input, { ...DEFAULT_CARD_CHOICES, withRoute: false })} format="feed" art={art} />);
    expect(noRoute.root.findAllByProps({ testID: 'mascote-e4' }).length).toBeGreaterThan(0);
    const zone = render(<ShareCard model={buildZoneCard(input, { ...DEFAULT_CARD_CHOICES, withRoute: false })!} format="stories" art={art} />);
    expect(zone.root.findAllByProps({ testID: 'mascote-e4' }).length).toBeGreaterThan(0);
  });

  it('sem art por props: mascote e chefão da E4 (nenhum marcador provisório)', () => {
    const level = render(<ShareCard model={buildLevelCard(input)!} format="stories" />);
    const mascot = level.root.findAllByType(MascotSvgArt);
    expect(mascot).toHaveLength(1);
    expect(mascot[0].props).toMatchObject({ team: 'striders', pose: 'vitoria' });
    const boss = render(<ShareCard model={buildBossCard(input)!} format="feed" />);
    expect(boss.root.findAllByType(BossSvgArt)[0].props).toMatchObject({ id: 'mormaco', state: 'derrotado', dano: 2 });
    // chefão desconhecido: o card não inventa um chefão, mostra o mascote comemorando
    const other = render(<ShareCard model={{ ...buildBossCard(input)!, bossName: 'Chefão Novo' }} format="stories" />);
    expect(other.root.findAllByType(BossSvgArt)).toHaveLength(0);
    expect(other.root.findAllByType(MascotSvgArt)).toHaveLength(1);
    const noRoute = render(<ShareCard model={buildRunCard(input, { ...DEFAULT_CARD_CHOICES, withRoute: false })} format="stories" />);
    expect(noRoute.root.findAllByType(MascotSvgArt)).toHaveLength(1);
    // a arte é vetor dentro do SVG do card: nenhum <Image> (sairia em branco no toDataURL)
    for (const r of [level, boss, noRoute]) expect(r.root.findAll((n) => n.type === 'Image' || (typeof n.type === 'function' && n.type.name === 'Image'))).toHaveLength(0);
  });

  it('nome do chefão → arte da E4 (com temporada, sem acento, desconhecido)', () => {
    expect(bossIdOf('Mormaço de Outubro')).toBe('mormaco');
    expect(bossIdOf('mormaco')).toBe('mormaco');
    expect(bossIdOf('Rei Buzina')).toBe('rei-buzina');
    expect(bossIdOf('  Paredão da Serra ')).toBe('paredao');
    expect(bossIdOf('Sonecas')).toBeNull();
    expect(bossIdOf('')).toBeNull();
    expect(bossIdOf(null)).toBeNull();
  });

  it('logo dos Stories dentro da área segura; @ e pílula alinhados ao símbolo', () => {
    const st = cardLogoLayout('stories');
    const k = st.box.size / 640;
    const boxTop = st.box.cy - (200 * k) / 2;
    expect(boxTop + 14 * k).toBeGreaterThanOrEqual(STORIES_SAFE.top - 2); // topo do símbolo
    expect(boxTop + 186 * k).toBeLessThan(400);
    expect(st.box.cx - st.box.size / 2 + 8 * k).toBeCloseTo(72, 5); // símbolo na margem
    expect(st.userX).toBeGreaterThan(72 + 180 * k); // o @ não cai sobre o símbolo
    const r = render(<ShareCard model={{ ...buildRunCard(input), username: '@gabryel' }} format="stories" />);
    const user = r.root.findAll((n) => n.props.children === '@gabryel' && typeof n.props.y === 'number')[0];
    expect(user.props.x).toBeCloseTo(st.userX, 5);
  });

  it('nome longo de zona e de chefão reduz o corpo em vez de vazar', () => {
    const long = 'Residencial Jardim das Palmeiras Expansão Sul';
    const z = render(<ShareCard model={{ ...buildZoneCard(input)!, zoneName: long }} format="stories" />);
    const node = z.root.findAll((n) => n.props.children === long)[0];
    expect(node.props.size).toBeLessThan(128);
    const b = render(<ShareCard model={{ ...buildBossCard(input)!, bossName: long }} format="feed" />);
    expect(b.root.findAll((n) => n.props.children === long)[0].props.size).toBeLessThan(70);
  });
});

describe('ShareSticker (adesivo transparente)', () => {
  it('com rota: rota, km, números e selo; sem fundo', () => {
    const r = render(<ShareSticker model={buildRunCard(input)} width={300} testID="adesivo" />);
    const svg = r.root.find((n) => n.type === Svg && n.props.testID === 'adesivo');
    expect(svg.props.viewBox).toBe('0 0 1080 1080');
    expect(svg.props.accessibilityLabel).toMatch(/^Adesivo\. Card de corrida/);
    expect(texts(r)).toEqual(expect.arrayContaining(['2,02 km', '10:29 · 5:12 /km · +183 pontos', DEMO_STAMP]));
    // logotipo da E4 (sombra + traço), sem texto "NOMADE RUN"
    expect(r.root.findAllByType(LogoSvgArt).map((n) => n.props.variant)).toEqual(['logotipo', 'logotipo']);
    expect(routePaths(r)).toHaveLength(1);
    expect(r.root.findAll((n) => n.props.fill === cardColors.bg)).toHaveLength(0);
  });

  it('sem rota e sem pontos oficiais: só os números', () => {
    const m = buildRunCard(demoRunInput({ status: 'provisional', isDemo: false }), { ...DEFAULT_CARD_CHOICES, withRoute: false });
    const r = render(<ShareSticker model={m} />);
    expect(routePaths(r)).toHaveLength(0);
    expect(texts(r)).toContain('10:29 · 5:12 /km');
    expect(texts(r)).not.toContain(DEMO_STAMP);
  });
});
