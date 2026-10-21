/**
 * T6.1 (A7) — tokens de motion (D-54) e as contas puras das primitivas.
 * RNF-011: com "Reduzir movimento", nenhuma primitiva desloca ou escala — só opacidade.
 */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View', ScrollView: 'Animated.ScrollView' },
  cubicBezier: (...p: number[]) => ({ css: p }),
  Easing: {
    bezier: (...p: number[]) => ({ factory: p }),
    // curva de verdade não importa aqui; basta ser monotônica de 0 a 1
    bezierFn: () => (t: number) => t,
    linear: (t: number) => t,
  },
  useReducedMotion: () => false,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

/* eslint-disable import/first */
import { bottomBarReserve, layout } from '../../screen';
import { pressFeedback } from '../../press-feedback';
import { countValue, formatCount } from '../count';
import { enterAnimation, maskKeyframes, riseKeyframes, splitReveal } from '../motion-styles';
import { parallaxValues } from '../parallax-math';
import { screenTransition } from '../screen-enter';
import { curves, durations, press, STAGGER_LIMIT, staggerDelay, staggers } from '@/theme/motion';
import { motion as legacy } from '@/theme/tokens';
/* eslint-enable import/first */

const hasTransform = (o: object) => JSON.stringify(o).includes('transform') || JSON.stringify(o).includes('translate') || JSON.stringify(o).includes('scale');

describe('tokens de motion (perfil landonorris.com)', () => {
  it('curvas exatas do perfil: power2.out, power3.out, expo.out, expo.inOut, power2.inOut', () => {
    expect(curves.standard).toEqual([0.25, 0.46, 0.45, 0.94]);
    expect(curves.enter).toEqual([0.215, 0.61, 0.355, 1]);
    expect(curves.reveal).toEqual([0.19, 1, 0.22, 1]);
    expect(curves.screen).toEqual([0.87, 0, 0.13, 1]);
    expect(curves.swap).toEqual([0.455, 0.03, 0.515, 0.955]);
  });

  it('durações dentro das faixas da D-54 e staggers de 15–50 ms', () => {
    expect(durations.press).toBe(120);
    expect(durations.enter).toBeGreaterThanOrEqual(500);
    expect(durations.screen).toBeLessThanOrEqual(600);
    expect(durations.reveal).toBe(800);
    expect(durations.hero).toBeGreaterThanOrEqual(1500);
    for (const s of [staggers.word, staggers.wordFast, staggers.line]) expect(s >= 15 && s <= 30).toBe(true);
    for (const s of [staggers.item, staggers.itemRelaxed]) expect(s >= 30 && s <= 50).toBe(true);
  });

  it('o toque continua igual ao token antigo (compatibilidade)', () => {
    expect(press.scale).toBe(legacy.press.scale);
    expect(durations.press).toBe(legacy.press.duration);
  });
});

describe('staggerDelay — cascata com limite', () => {
  it('cresce de `step` em `step` a partir de 0', () => {
    expect([0, 1, 2, 3].map((i) => staggerDelay(i, 40))).toEqual([0, 40, 80, 120]);
  });

  it('itens além do limite entram com o atraso do último animado', () => {
    const last = staggerDelay(STAGGER_LIMIT - 1, 40);
    expect(staggerDelay(STAGGER_LIMIT, 40)).toBe(last);
    expect(staggerDelay(500, 40)).toBe(last);
  });

  it('nunca passa do teto total (0,5 s) nem fica negativo', () => {
    for (let i = -3; i < 200; i++) {
      const d = staggerDelay(i, 50, 1000);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(staggers.maxTotal);
    }
    expect(staggerDelay(Number.NaN)).toBe(0);
  });
});

describe('enterAnimation — RNF-011', () => {
  it('normal: sobe a distância pedida com a curva e o atraso', () => {
    const a = enterAnimation({ reduced: false, distance: 24, duration: 500, delay: 80, curve: 'enter' });
    expect(a.animationName).toEqual({ from: { opacity: 0, transform: [{ translateY: 24 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } });
    expect(a).toMatchObject({ animationDuration: 500, animationDelay: 80, animationFillMode: 'both', animationTimingFunction: { css: [...curves.enter] } });
  });

  it('máscara: só translada (a máscara já esconde), sem fade', () => {
    const a = enterAnimation({ reduced: false, kind: 'mask', distance: 40 });
    expect(a.animationName).toEqual({ from: { transform: [{ translateY: 40 }] }, to: { transform: [{ translateY: 0 }] } });
  });

  it('"Reduzir movimento": só opacidade, curta e sem atraso — para qualquer combinação', () => {
    for (const kind of ['rise', 'mask'] as const) {
      for (const distance of [0, 16, 120]) {
        const a = enterAnimation({ reduced: true, kind, distance, delay: 400, duration: 2000 });
        expect(hasTransform(a)).toBe(false);
        expect(a.animationName).toEqual({ from: { opacity: 0 }, to: { opacity: 1 } });
        expect(a.animationDelay).toBe(0);
        expect(a.animationDuration).toBe(durations.reducedFade);
      }
    }
  });

  it('keyframes reaproveitados entre renders (a animação não reinicia à toa)', () => {
    expect(riseKeyframes(16)).toBe(riseKeyframes(16));
    expect(maskKeyframes(32)).toBe(maskKeyframes(32));
  });
});

describe('splitReveal — RevealText', () => {
  it('separa por palavras sem perder nenhuma', () => {
    const phrase = '  Zona   conquistada no Flamboyant ';
    expect(splitReveal(phrase, 'words')).toEqual(['Zona', 'conquistada', 'no', 'Flamboyant']);
    expect(splitReveal(phrase, 'words').join(' ')).toBe(phrase.trim().replace(/\s+/g, ' '));
  });

  it('por linhas, quebra em \\n e ignora linhas vazias', () => {
    expect(splitReveal('Corra.\n\nConquiste.', 'lines')).toEqual(['Corra.', 'Conquiste.']);
  });
});

describe('CountUp — contas', () => {
  it('vai de `from` a `to` e para exatamente no valor final', () => {
    expect(countValue(0, 0, 1250)).toBe(0);
    expect(countValue(0.5, 0, 1250)).toBe(625);
    expect(countValue(1, 0, 1250)).toBe(1250);
    expect(countValue(1, 0, 5.24, 2)).toBe(5.24);
  });

  it('progresso fora de 0–1 ou inválido não ultrapassa o alvo', () => {
    expect(countValue(1.7, 0, 10)).toBe(10);
    expect(countValue(-1, 3, 10)).toBe(3);
    expect(countValue(Number.NaN, 0, 10)).toBe(10);
  });

  it('formata em pt-BR com casas fixas (largura estável)', () => {
    expect(formatCount(5.2, 1)).toBe('5,2');
    expect(formatCount(5, 2)).toBe('5,00');
    expect(formatCount(1250)).toMatch(/^1\.?250$/);
  });
});

describe('parallaxValues — cabeçalho', () => {
  it('rolando, anda a metade e esmaece', () => {
    expect(parallaxValues(100, 240, 0.5, false)).toEqual({ translateY: 50, scale: 1, opacity: expect.any(Number) });
    expect(parallaxValues(0, 240, 0.5, false)).toEqual({ translateY: 0, scale: 1, opacity: 1 });
    expect(parallaxValues(400, 240, 0.5, false).opacity).toBe(0);
  });

  it('rolagem negativa (título grande do iOS ou puxão) não amplia nem desloca o cabeçalho', () => {
    for (const y of [-160, -60, -1]) expect(parallaxValues(y, 240, 0.5, false)).toEqual({ translateY: 0, scale: 1, opacity: 1 });
  });

  it('"Reduzir movimento": parado em qualquer rolagem, só a opacidade muda', () => {
    for (const y of [-200, -10, 0, 50, 300]) {
      const v = parallaxValues(y, 240, 0.5, true);
      expect(v.translateY).toBe(0);
      expect(v.scale).toBe(1);
    }
    expect(parallaxValues(120, 240, 0.5, true).opacity).toBeLessThan(1);
  });
});

describe('screenTransition — Expo Router', () => {
  it('push desliza, modal sobe, fade esmaece', () => {
    expect(screenTransition('push', false)).toEqual({ animation: 'slide_from_right', animationDuration: durations.navigation });
    expect(screenTransition('modal', false)).toEqual({ animation: 'fade_from_bottom', animationDuration: durations.navigation });
    expect(screenTransition('fade', false).animation).toBe('fade');
    expect(screenTransition('none', false)).toEqual({ animation: 'none' });
  });

  it('"Reduzir movimento": tudo vira fade', () => {
    for (const k of ['push', 'modal', 'fade'] as const) expect(screenTransition(k, true).animation).toBe('fade');
  });
});

describe('pressFeedback — Pressable/Button', () => {
  it('normal: 0,97 em 120 ms com power2.out', () => {
    expect(pressFeedback(true, false)).toMatchObject({ transform: [{ scale: 0.97 }], transitionDuration: 120, transitionTimingFunction: { css: [...curves.standard] } });
  });
});

describe('bottomBarReserve — CTA fixo nunca cobre o conteúdo', () => {
  it('reserva a altura medida da barra mais a folga', () => {
    expect(bottomBarReserve({ barHeight: 102, insetBottom: 34, hasBar: true })).toBe(102 + layout.footerBreathing);
  });

  it('antes de medir, estima pelo CTA grande + área segura (nunca menos que o botão)', () => {
    const r = bottomBarReserve({ insetBottom: 34, hasBar: true });
    expect(r).toBeGreaterThanOrEqual(layout.ctaHeight + 34 + layout.footerOffset);
  });

  it('o espaço reservado sempre cobre o botão: topo do botão fica acima do fim do conteúdo', () => {
    for (const inset of [0, 20, 34, 48]) {
      // barra medida = paddingTop 8 + botão 60 + recuo 16 + área segura
      const bar = 8 + layout.ctaHeight + layout.footerOffset + inset;
      const reserve = bottomBarReserve({ barHeight: bar, insetBottom: inset, hasBar: true });
      const buttonTopFromBottom = inset + layout.footerOffset + layout.ctaHeight;
      expect(reserve).toBeGreaterThan(buttonTopFromBottom);
    }
  });

  it('sem barra: só a área segura e a margem (ou só a margem dentro de abas)', () => {
    expect(bottomBarReserve({ insetBottom: 34, hasBar: false })).toBe(34 + layout.gutter);
    expect(bottomBarReserve({ insetBottom: 34, hasBar: false, safeBottom: false })).toBe(layout.gutter);
  });

  it('grade de 8 pt nos espaços do layout', () => {
    for (const v of [layout.gutter, layout.gap, layout.sectionGap, layout.footerOffset, layout.footerBreathing]) expect(v % 8 === 0 || v % 4 === 0).toBe(true);
  });
});
