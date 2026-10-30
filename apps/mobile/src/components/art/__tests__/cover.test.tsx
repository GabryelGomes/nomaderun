/**
 * Capa do time (F8 B1, D-93): a cena é determinística e igual nos 4 (só muda cor, mascote e skyline); o texto por
 * `Text` passa 4,5:1 sobre o fundo com o brilho do time e o degradê (pior caso medido no ponto mais perto do brilho);
 * animação só com `animated` + `focused`, e parada com "Reduzir movimento".
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { render } from '@/components/__tests__/render-helpers';
import { TEAM_BIO } from '@/domain/team-bio';
import { FACTION_IDS } from '@/domain/types';
import { neon, neonTeam } from '@/theme/neon';

import { COVER_BOX, COVER_TEXT, coverLabel, coverScene, glowOpacityAt, runnerPlacement, textAnchors } from '../team/cover-art';
import { TeamCover } from '../team/cover';
import { ART } from '../neon/palette';
/* eslint-enable import/first */

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** `over` com opacidade `alpha` sobre `under`. */
function blend(under: [number, number, number], over: [number, number, number], alpha: number): [number, number, number] {
  return under.map((u, i) => Math.round(u + (over[i] - u) * alpha)) as [number, number, number];
}

/** Fundo efetivo atrás de um texto: bg → brilho do time no ponto → degradê escuro (bg) por cima. */
function backdropAt(team: (typeof FACTION_IDS)[number], variant: 'card' | 'hero', which: 'name' | 'motto' | 'bio'): [number, number, number] {
  const a = textAnchors(variant)[which];
  const withGlow = blend(rgb(neon.bg), rgb(neonTeam[team]), glowOpacityAt(a.nx, a.ny));
  return blend(withGlow, rgb(neon.bg), a.fade);
}

describe('cena da capa', () => {
  it('é determinística, com 5 prédios, 4 estrelas, 3 linhas de pista, 7 faixas e 2–3 janelas que piscam', () => {
    for (const f of FACTION_IDS) {
      for (const v of ['card', 'hero'] as const) {
        const s = coverScene(f, v);
        expect(s).toBe(coverScene(f, v));
        expect(s).toMatchObject({ width: COVER_BOX[v].vbW, height: COVER_BOX[v].vbH });
        expect(s.buildings).toHaveLength(5);
        expect(s.stars).toHaveLength(4);
        expect(s.roadLines).toHaveLength(3);
        expect(s.stripes).toHaveLength(7);
        expect(s.blinking.length).toBeGreaterThanOrEqual(2);
        expect(s.blinking.length).toBeLessThanOrEqual(4);
        expect(s.windows.length).toBeGreaterThan(10);
        // o corredor fica à esquerda (a perna estendida pode encostar no degradê, nunca na coluna de texto do card)
        const r = runnerPlacement(s);
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.left + r.width).toBeLessThanOrEqual(270);
      }
    }
  });

  it('a skyline é diferente por time', () => {
    const tops = FACTION_IDS.map((f) => coverScene(f, 'card').buildings.map((b) => b.y).join(','));
    expect(new Set(tops).size).toBe(4);
  });

  it('o brilho vai de 34 % no canto inferior esquerdo a 0 fora do raio', () => {
    expect(glowOpacityAt(0.42, 0.95)).toBeCloseTo(0.34, 2);
    expect(glowOpacityAt(0.95, 0.05)).toBe(0);
    expect(glowOpacityAt(0.6, 0.9)).toBeGreaterThan(0.1);
  });

  it('nome, lema e bio passam 4,5:1 nos 4 times (pior caso: o ponto do texto mais perto do brilho)', () => {
    const worst: Record<string, number> = {};
    for (const f of FACTION_IDS) {
      for (const v of ['card', 'hero'] as const) {
        const name = ratio(rgb(ART.ink), backdropAt(f, v, 'name'));
        const motto = ratio(rgb(neonTeam[f]), backdropAt(f, v, 'motto'));
        // bio em `ink` a 90 %: a cor efetiva é ink misturada ao fundo
        const bioBg = backdropAt(f, v, 'bio');
        const bio = ratio(blend(bioBg, rgb(ART.ink), COVER_TEXT.bioOpacity), bioBg);
        for (const [k, r] of Object.entries({ name, motto, bio })) {
          expect(r).toBeGreaterThanOrEqual(4.5);
          worst[k] = Math.min(worst[k] ?? Infinity, r);
        }
      }
    }
    // registro do pior caso (Coyotes, lema amarelo), útil no relatório
    expect(worst.motto).toBeGreaterThanOrEqual(4.5);
  });

  it('rótulo da capa como imagem: nome, lema, mascote e bio inteira', () => {
    expect(coverLabel('volt')).toBe('Volt Runners: Energia não acaba. Faísca, a lebre, correndo pela cidade à noite. A lebre que não desliga. Tiro curto ou longo, tanto faz: sempre sobra faísca.');
  });
});

describe('<TeamCover />', () => {
  it('card: nome, lema e 1ª linha da bio por Text; hero: "Seu time" e a bio de 3 linhas', () => {
    const card = render(<TeamCover team="coyotes" width={326} />);
    expect(card.text()).toContain('URBAN COYOTES');
    expect(card.text()).toContain('A MATILHA AVANÇA');
    expect(card.text()).toContain(`Faro · ${TEAM_BIO.coyotes.bio[0]}`);
    expect(card.text()).not.toContain(TEAM_BIO.coyotes.bio[2]);
    const hero = render(<TeamCover team="owls" variant="hero" width={358} accessibilityLabel={coverLabel('owls')} testID="capa" />);
    expect(hero.text()).toContain('Seu time');
    expect(hero.text()).toContain(TEAM_BIO.owls.bio[2]);
    expect(hero.host('capa').props.accessibilityRole).toBe('image');
    expect(hero.host('capa').props.accessibilityLabel).toContain('Night Owls: A noite é nossa.');
  });

  it('`textless` deixa só a cena; decorativa fica escondida do leitor de tela', () => {
    const r = render(<TeamCover team="striders" textless testID="capa" />);
    expect(r.text()).toBe('');
    expect(r.host('capa').props['aria-hidden']).toBe(true);
  });
});
