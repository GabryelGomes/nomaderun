import { cubicBezier, Easing, linear } from 'react-native-reanimated';

/** Curva CSS paramétrica do Reanimated (`linear(...)`). */
type CSSTimingFunction = ReturnType<typeof linear>;

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
  /** power3.in — saída (v2): acelera e some; dura ~60% da entrada. */
  exit: [0.55, 0.055, 0.675, 0.19],
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
  exit: bez(curves.exit),
  linear: Easing.linear,
} as const;

/** Para transições e animações CSS do Reanimated 4. */
export const cssEasings = {
  standard: css(curves.standard),
  enter: css(curves.enter),
  reveal: css(curves.reveal),
  screen: css(curves.screen),
  swap: css(curves.swap),
  exit: css(curves.exit),
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
  /** Saída (v2): mais curta que a entrada, com `exit` (power3.in). */
  exit: 200,
  /** Toast parado na tela, legível correndo (v2). */
  toastHold: 2250,
  /** Barra fantasma: espera antes de escoar e o tempo de escoar (v2). */
  ghostHold: 300,
  ghostDrain: 420,
  /** Número de dano que pula e sobe (v2). */
  damageFloat: 800,
  /** "Pular" leva todas as celebrações ao estado final em no máximo isto (v2). */
  skip: 200,
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

/* ------------------------------------------------------------------------------------------------
 * v2 (Fase 7, T7.1.12, D-71): molas, escala de celebração e padrões de vibração.
 * ---------------------------------------------------------------------------------------------- */

/**
 * As 4 molas do app. Valem igual em `withSpring(v, springConfig(nome))` (worklets) e nas animações CSS
 * (`animationTimingFunction: springCss(nome)`), porque a curva CSS é a própria mola amostrada.
 * `duration` é a duração percebida (Reanimated 4); `dampingRatio` < 1 passa do alvo e volta.
 */
export const springs = {
  /** Toast, chip, troca de estado (passa ~1,5%). */
  snappy: { duration: 350, dampingRatio: 0.8 },
  /** Cards, folhas, layout (sem passar do alvo). */
  gentle: { duration: 500, dampingRatio: 1 },
  /** Item do baú, emblema, nível (passa ~16%). */
  bouncy: { duration: 650, dampingRatio: 0.5 },
  /** Carimbo: PR, "derrotado", número do nível (passa ~23%). */
  stamp: { duration: 550, dampingRatio: 0.42 },
} as const satisfies Record<string, { duration: number; dampingRatio: number }>;

export type SpringName = keyof typeof springs;

/** Pontos de amostragem da mola em `springCss` (49 valores: 0 … 1). */
export const SPRING_SAMPLES = 48;

/**
 * Posição normalizada (0 → 1) de uma mola com amortecimento `dampingRatio` em `samples + 1` instantes
 * igualmente espaçados. Começa em 0 e termina exatamente em 1. A frequência é escolhida para a
 * oscilação cair a 0,1% no fim (a mola "assenta" dentro da duração). Função pura.
 */
export function springPoints(dampingRatio: number, samples: number = SPRING_SAMPLES): number[] {
  const z = Number.isFinite(dampingRatio) && dampingRatio > 0 ? dampingRatio : 1;
  const n = Math.max(2, Math.floor(samples));
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x: number;
    if (z < 1) {
      // subamortecida: oscila e passa do alvo
      const w = Math.log(1000) / z;
      const wd = w * Math.sqrt(1 - z * z);
      x = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
    } else if (z === 1) {
      // crítica: chega sem passar
      const w = 9.23;
      x = 1 - Math.exp(-w * t) * (1 + w * t);
    } else {
      // superamortecida: chega devagar, sem passar
      const s = Math.sqrt(z * z - 1);
      const w = 6.91 / (z - s);
      const wd = w * s;
      x = 1 - Math.exp(-z * w * t) * (Math.cosh(wd * t) + ((z * w) / wd) * Math.sinh(wd * t));
    }
    pts.push(i === n ? 1 : i === 0 ? 0 : Math.round(x * 1e4) / 1e4);
  }
  return pts;
}

const SPRING_CSS = new Map<string, CSSTimingFunction>();

/**
 * Curva CSS da mola (`linear(0, …, 1)` do Reanimated 4.5) para `animationTimingFunction` e
 * `transitionTimingFunction`. Cacheada por nome: o mesmo objeto entre renders (a animação não reinicia).
 */
export function springCss(spring: SpringName | { dampingRatio: number }): CSSTimingFunction {
  const z = typeof spring === 'string' ? springs[spring].dampingRatio : spring.dampingRatio;
  const key = String(z);
  let fn = SPRING_CSS.get(key);
  if (!fn) {
    fn = linear(...springPoints(z));
    SPRING_CSS.set(key, fn);
  }
  return fn;
}

/** Configuração para `withSpring` (mesma mola da curva CSS). */
export function springConfig(name: SpringName): { duration: number; dampingRatio: number } {
  return { duration: springs[name].duration, dampingRatio: springs[name].dampingRatio };
}

/** Padrões de vibração do app (`components/motion/haptics.ts` mapeia para iOS e Android). */
export const HAPTIC_PATTERNS = ['selection', 'tap', 'impact', 'heavy', 'success', 'warning', 'error', 'crescendo'] as const;
export type HapticPattern = (typeof HAPTIC_PATTERNS)[number];

/** Intervalo mínimo entre duas vibrações (D-71): nunca vibrar em cascata. */
export const HAPTIC_MIN_GAP_MS = 150;

/** Níveis de celebração, do menor ao maior. */
export const CELEBRATION_LEVELS = ['micro', 'small', 'medium', 'epic'] as const;
export type CelebrationLevel = (typeof CELEBRATION_LEVELS)[number];

/**
 * Escala de celebração (orçamento por nível): duração mínima e máxima, teto de partículas e a vibração
 * principal. Uma corrida comum nunca ganha confete; um nível novo sempre ganha.
 */
export const celebrationLevels = {
  /** Toque, chip, seleção: no próprio elemento. */
  micro: { minMs: 120, maxMs: 300, particles: 0, haptic: 'tap' },
  /** XP ganho, dano no chefão, marco da zona, sequência mantida: no elemento ou num toast. */
  small: { minMs: 300, maxMs: 800, particles: 8, haptic: 'impact' },
  /** Zona conquistada, baú raro, subir na liga, PR: cartão em destaque. */
  medium: { minMs: 800, maxMs: 1500, particles: 24, haptic: 'success' },
  /** Nível novo, chefão derrotado, baú lendário, escolha de time: tela cheia. */
  epic: { minMs: 1500, maxMs: 2500, particles: 60, haptic: 'success' },
} as const satisfies Record<CelebrationLevel, { minMs: number; maxMs: number; particles: number; haptic: HapticPattern }>;

/** Regras de ritmo do orquestrador (§5.3 do prompt mestre). */
export const celebration = {
  ...celebrationLevels,
  /** Respiro entre dois momentos da fila. */
  gapMs: 200,
  /** Teto do resumo inteiro. */
  summaryBudgetMs: 8500,
  /** No máximo 1 épica por sequência (as outras viram média). */
  maxEpic: 1,
  /** No máximo 3 médias; o excedente vira um momento agrupado. */
  maxMedium: 3,
  /** "Reduzir movimento": cascata de fades curtos. */
  reducedStepMs: 60,
} as const;

/** Contagens de partículas permitidas e o teto absoluto por tela. */
export const PARTICLE_COUNTS = [8, 12, 24, 36, 60] as const;
export const MAX_PARTICLES = 60;

export const motionTokens = { curves, durations, staggers, distances, press, STAGGER_LIMIT, springs, celebration } as const;
