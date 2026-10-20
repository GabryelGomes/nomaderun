import { cubicBezier, Easing } from 'react-native-reanimated';

/**
 * Tokens de motion da Fase 6 (D-54, T6.1). Perfil extraído do landonorris.com (GSAP) e traduzido para
 * Reanimated: tudo roda na UI thread. Os números vêm da contagem no código do site — não aproxime.
 *
 * Três formas de cada curva:
 *  - `curves`   → tupla [x1, y1, x2, y2] (pura, testável, serve para documentação e para `bezierFn`);
 *  - `easings`  → `Easing.bezier(...)` para `withTiming` (worklets);
 *  - `css`      → `cubicBezier(...)` para transições/animações CSS do Reanimated 4 (`transitionTimingFunction`,
 *                 `animationTimingFunction`).
 *
 * Regra de uso (ver docs/DESIGN_MOBILE_MOTION.md):
 *  - interação (toque, troca de estado) → `standard` (power2.out), 120–300 ms;
 *  - entrada de cards e listas           → `enter` (power3.out), 500–600 ms;
 *  - texto de destaque, conteúdo da tela → `reveal` (expo.out), 600–800 ms;
 *  - transição entre telas               → `screen` (expo.inOut);
 *  - progresso contínuo (anel, barra)    → linear.
 */
export const curves = {
  /** power2.out — padrão de interação do site (108 usos). */
  standard: [0.25, 0.46, 0.45, 0.94],
  /** power3.out — entradas em cascata (30 usos). */
  enter: [0.215, 0.61, 0.355, 1],
  /** expo.out — `cubic-bezier(.19, 1, .22, 1)` do CSS do site; revelações e entrada de tela. */
  reveal: [0.19, 1, 0.22, 1],
  /** expo.inOut — transições de tela (36 usos). */
  screen: [0.87, 0, 0.13, 1],
  /** power2.inOut — movimentos que vão e voltam (47 usos), ex.: indicador que troca de lugar. */
  swap: [0.455, 0.03, 0.515, 0.955],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type CurveName = keyof typeof curves;

const bez = (c: readonly [number, number, number, number]) => Easing.bezier(c[0], c[1], c[2], c[3]);
const css = (c: readonly [number, number, number, number]) => cubicBezier(c[0], c[1], c[2], c[3]);

/** Para `withTiming(…, { easing })`. */
export const easings = {
  standard: bez(curves.standard),
  enter: bez(curves.enter),
  reveal: bez(curves.reveal),
  screen: bez(curves.screen),
  swap: bez(curves.swap),
  linear: Easing.linear,
} as const;

/** Para transições e animações CSS do Reanimated 4. */
export const cssEasings = {
  standard: css(curves.standard),
  enter: css(curves.enter),
  reveal: css(curves.reveal),
  screen: css(curves.screen),
  swap: css(curves.swap),
} as const;

/** Função pura (JS) da curva — para quem anima fora de worklet, como o `CountUp`. */
export function curveFn(name: CurveName): (t: number) => number {
  const c = curves[name];
  return Easing.bezierFn(c[0], c[1], c[2], c[3]);
}

/** Durações em ms (as mais usadas no site: 0,5 s, 2 s, 0,6 s, 0,3 s, 1 s, 1,5 s, 0,8 s, 0,4 s). */
export const durations = {
  /** Toque: escala do botão. */
  press: 120,
  /** Hover/realce curto, troca de chip, mostrar/esconder ícone. */
  quick: 200,
  /** Pequenas mudanças de estado (cor, opacidade, abrir dica). */
  state: 300,
  /** Entrada de card/item (FadeUp/Stagger). */
  enter: 500,
  /** Entrada do conteúdo de uma tela (ScreenEnter). */
  screen: 600,
  /** Revelação de título (RevealText). */
  reveal: 800,
  /** Contador de número (CountUp). */
  count: 1000,
  /** Momento herói (celebração, recorde): 1,5–2,5 s, no máximo um por tela. */
  hero: 1500,
  heroLong: 2000,
  /** Transição nativa entre telas do Expo Router (iOS respeita; Android usa a do sistema). */
  navigation: 400,
  /** "Reduzir movimento": só opacidade, curta. */
  reducedFade: 150,
} as const;

/** Intervalo entre itens em cascata, em ms (site: 0,02 s, 0,015 s, 0,03 s, 0,05 s). */
export const staggers = {
  /** Palavras/letras de um título. */
  word: 20,
  wordFast: 15,
  /** Linhas de texto. */
  line: 30,
  /** Cards e itens de lista. */
  item: 40,
  itemRelaxed: 50,
  /** Teto da cascata inteira (site: `stagger: {amount: 0.5}`): a lista nunca demora mais que isso para começar o último item. */
  maxTotal: 500,
} as const;

/** Distâncias de deslocamento em pt (grade de 4/8). */
export const distances = {
  /** Subida de cards/itens na entrada. */
  enter: 16,
  enterLarge: 24,
  /** Subida do conteúdo da tela. */
  screen: 16,
  /** Fração da altura da linha que o texto "sobe" de dentro da máscara (yPercent 100 → 0). */
  revealFraction: 1,
  /** Fator de parallax do cabeçalho (0,5 = anda na metade da velocidade da rolagem). */
  parallax: 0.5,
} as const;

/** Escala e opacidade do toque. */
export const press = {
  scale: 0.97,
  /** Opacidade do pressionado com "Reduzir movimento" (sem escala). */
  reducedOpacity: 0.7,
} as const;

/** Máximo de itens que entram em cascata; do 13º em diante entram juntos com o último atraso. */
export const STAGGER_LIMIT = 12;

/**
 * Atraso do item `index` numa cascata: `index × step`, com teto no número de itens animados (`limit`)
 * e no tempo total (`maxTotal`). Itens além do limite entram com o mesmo atraso do último animado.
 */
export function staggerDelay(index: number, step: number = staggers.item, limit: number = STAGGER_LIMIT, maxTotal: number = staggers.maxTotal): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  const i = Math.min(Math.floor(index), Math.max(0, limit - 1));
  return Math.min(i * step, maxTotal);
}

export const motionTokens = { curves, durations, staggers, distances, press, STAGGER_LIMIT } as const;
