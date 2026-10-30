/**
 * Sequência semanal (T7.3.4): a chama e o gelo do `StreakFlame` (E5). viewBox 120 × 140. Puro: só geometria.
 *
 * - **acesa** (semana garantida): chama inclinada para a frente, como quem corre (linhas de velocidade atrás),
 *   com 3 camadas (contorno laranja, miolo quente e núcleo branco), brasas e faíscas.
 * - **fraca** (falta 1 atividade): a mesma chama, baixa e apagada, dentro do **contorno tracejado** da chama
 *   cheia (o que falta para acender, na mesma linguagem do "tracejado = ainda não" dos estados vazios).
 * - **gelo** (congelamento usado): a chama parada, em azul-gelo, presa num **cristal** hexagonal com facetas,
 *   pingentes e flocos. O gelo é uma camada própria e translúcida (`gelo`): a E5 a põe por cima da chama.
 *
 * O estado lê pela forma, não só pela cor (chama cheia, chama baixa + tracejado, cristal). O gelo usa o
 * `ICE`, bem mais claro e menos saturado que o azul dos Striders (ΔE2000 ≈ 23, ver o relatório E4-onda3).
 */
import { glowFill, memoArt, neon, pivot, speedLines, spark, type ArtNode } from '../neon/core';
import { ART, ICE, mix } from '../neon/palette';

export type StreakState = 'acesa' | 'fraca' | 'gelo';
export const STREAK_STATES: readonly StreakState[] = ['acesa', 'fraca', 'gelo'];
export const STREAK_LABELS: Record<StreakState, string> = {
  acesa: 'Chama acesa',
  fraca: 'Chama fraca',
  gelo: 'Chama congelada',
};
export const STREAK_BOX = { vbW: 120, vbH: 140 } as const;
/**
 * Pivôs (viewBox 120 × 140): a `chama` tremula a partir da base (escala em Y e giro curto); o `gelo` cresce
 * do centro do cristal; o `brilho` (reflexo do gelo, faíscas da chama) só pisca.
 */
export const STREAK_PIVOTS = {
  chama: { x: 60, y: 122 },
  gelo: { x: 60, y: 70 },
} as const;
/** Camadas para a E5: `chama` (fundo + chama) e `gelo` (o cristal translúcido, para pôr por cima). */
export type StreakLayer = 'chama' | 'gelo';
export const STREAK_LAYERS: readonly StreakLayer[] = ['chama', 'gelo'];

// Chama: duas línguas (a principal, inclinada para a direita, e uma menor à esquerda).
const FLAME = 'M60 122 Q 28 122 28 92 Q 28 74 40 62 Q 36 50 40 36 Q 52 46 55 56 Q 54 30 70 10 Q 74 34 87 50 Q 96 64 92 88 Q 89 122 60 122 Z';
const FLAME_MID = 'M60 114 Q 41 114 41 96 Q 41 83 53 72 Q 54 82 60 86 Q 60 67 69 52 Q 73 66 79 76 Q 84 86 81 99 Q 77 114 60 114 Z';
const FLAME_CORE = 'M60 109 Q 51 109 51 100 Q 51 92 60 82 Q 69 92 69 100 Q 69 109 60 109 Z';
// Cristal hexagonal (pontas em cima e embaixo), com folga para a chama inteira.
const CRYSTAL = 'M60 9 L 106 33 L 106 103 L 60 128 L 14 103 L 14 33 Z';

export type StreakParts = {
  /** Atrás da chama: linhas de velocidade, chão, contorno tracejado da chama cheia (fraca). */
  fundo: ArtNode[];
  /** A chama (camada animável, pivô em `STREAK_PIVOTS.chama`). */
  chama: ArtNode[];
  /** O cristal de gelo (só no estado `gelo`), translúcido, por cima da chama. */
  gelo: ArtNode[];
  /** Brilhos por cima de tudo (faíscas, reflexos do gelo, flocos): a camada que pisca no "parado". */
  brilho: ArtNode[];
};

function flame(color: string, opts: { core: string; coreGlow: number; glow: number; opacity?: number; mid?: string }): ArtNode[] {
  const { core, coreGlow, glow, opacity = 1, mid = mix(color, ART.ink, 0.45) } = opts;
  return [
    neon(FLAME, color, 3.4, { fill: true, tint: 0.16, glow, hot: glow ? 0.5 : 0, opacity }),
    neon(FLAME_MID, mid, 2.4, { fill: mid, glow: glow * 0.7, hot: 0, opacity: opacity * 0.22 }),
    neon(FLAME_MID, mid, 2.4, { glow: glow * 0.7, hot: glow ? 0.4 : 0, opacity }),
    glowFill(FLAME_CORE, core, { w: 1, glow: coreGlow, opacity }),
  ];
}

const floor = (color: string, opacity: number): ArtNode => neon('M30 130 L 90 130', color, 2, { glow: 0.4, hot: 0, opacity, dash: '10 6' });

/** Floco de 6 pontas (gelo). */
function flake(cx: number, cy: number, r: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const dx = Math.round(Math.cos(a) * r * 100) / 100;
    const dy = Math.round(Math.sin(a) * r * 100) / 100;
    out.push(`M${cx - dx} ${cy - dy} L ${cx + dx} ${cy + dy}`);
  }
  return out;
}

/** O cristal de gelo sozinho (camada `gelo`): escurece o que está atrás e põe a tinta do gelo por cima. */
export function iceNodes(color: string = ICE): ArtNode[] {
  return [
    // Fosco: escurece a chama de trás (preenchimento escuro a 32%) e tinge de gelo.
    neon(CRYSTAL, ART.panel, 3, { fill: ART.panel, glow: 0, hot: 0, opacity: 0.32 }),
    neon(CRYSTAL, color, 3, { fill: color, glow: 0, hot: 0, opacity: 0.12 }),
    // Facetas: a mesa de cima e as quinas da frente, como um bloco lapidado (bem apagadas).
    neon(['M14 33 L 36 44 L 60 33 L 84 44 L 106 33', 'M36 44 L 36 92 L 14 103', 'M84 44 L 84 92 L 106 103', 'M36 92 L 60 104 L 84 92', 'M60 104 L 60 128'], color, 1.5, {
      glow: 0.3,
      hot: 0,
      opacity: 0.38,
    }),
    neon(CRYSTAL, color, 3.2, { glow: 1, hot: 0.6 }),
    // Pingentes: triângulos finos pendurados nas arestas de baixo.
    glowFill(['M24 108.4 L 33 113.3 L 29.5 125 Z', 'M87 113.3 L 96 108.4 L 90.5 123 Z', 'M42 118.2 L 48 121.4 L 45.5 129 Z'], color, { w: 0.8, glow: 0.5, opacity: 0.9 }),
  ];
}

function iceGlints(color: string = ICE): ArtNode[] {
  return [
    // Reflexo na face da esquerda: dois riscos paralelos à aresta.
    neon(['M22 52 L 30 46', 'M22 64 L 34 55'], ART.white, 2.2, { glow: 0.6, hot: 0, opacity: 0.9 }),
    neon(flake(104, 14, 7), color, 1.6, { glow: 0.6, hot: 0.4 }),
    neon(['M104 7 L 101.5 4.5', 'M104 7 L 106.5 4.5', 'M104 21 L 101.5 23.5', 'M104 21 L 106.5 23.5'], color, 1.2, { glow: 0.3, hot: 0 }),
    spark(16, 18, 3.5, ART.white, 1.4),
  ];
}

const cache = new Map<string, StreakParts>();

/** `color` troca a cor da chama (padrão laranja). O gelo usa sempre o `ICE`. */
export function streakParts(state: StreakState, color: string = ART.orange): StreakParts {
  return memoArt(cache, `${state}|${color}`, () => {
    if (state === 'acesa') {
      return {
        fundo: [speedLines(color, [[4, 82, 20], [8, 96, 22], [14, 110, 24]], 2.4, 0.65), floor(color, 0.5)],
        chama: flame(color, { core: ART.white, coreGlow: 1.2, glow: 1.2 }),
        gelo: [],
        brilho: [
          spark(98, 26, 5, ART.ink),
          spark(24, 26, 3.5, color),
          glowFill([{ tag: 'circle', cx: 101, cy: 48, r: 2 }, { tag: 'circle', cx: 92, cy: 10, r: 1.6 }, { tag: 'circle', cx: 30, cy: 46, r: 1.4 }], color, { w: 0.6, glow: 0.8 }),
        ],
      };
    }
    if (state === 'fraca') {
      // A chama cheia fica só no contorno tracejado (a meta); a acesa de verdade é baixa e apagada.
      const dim = mix(color, ART.ink2, 0.2);
      return {
        fundo: [neon(FLAME, ART.ink2, 2, { glow: 0.2, hot: 0, dash: '4 6', opacity: 0.75 }), floor(ART.ink2, 0.45)],
        chama: [pivot(flame(dim, { core: mix(color, ART.ink, 0.55), coreGlow: 0.4, glow: 0.6 }), { x: 60, y: 122, scale: 0.6, rotate: -4 })],
        gelo: [],
        // Um "+" laranja onde a chama cheia termina: falta 1.
        brilho: [neon(['M96 26 L 96 40', 'M89 33 L 103 33'], color, 2.6, { glow: 0.8, hot: 0.5 })],
      };
    }
    return {
      fundo: [neon('M34 136 L 86 136', ICE, 2, { glow: 0.4, hot: 0, opacity: 0.35, dash: '10 6' })],
      chama: [pivot(flame(ICE, { core: ART.white, coreGlow: 0.5, glow: 0.6, mid: mix(ICE, ART.white, 0.5) }), { x: 60, y: 122, scale: 0.78, ty: -10 })],
      gelo: iceNodes(),
      brilho: iceGlints(),
    };
  });
}

const NONE: ArtNode[] = [];

/**
 * As partes de uma camada só (as camadas empilhadas se alinham sozinhas, na mesma caixa):
 * - `chama` = fundo + chama (+ as faíscas da acesa e o "+" da fraca; no gelo, a chama congelada sem o cristal);
 * - `gelo` = o cristal translúcido e os reflexos, em qualquer estado (a E5 o põe por cima da chama).
 * Sem `layer`, todas.
 */
export function streakLayerParts(state: StreakState, layer?: StreakLayer, color?: string): StreakParts {
  if (layer === 'gelo') {
    const ice = streakParts('gelo');
    return { fundo: NONE, chama: NONE, gelo: ice.gelo, brilho: ice.brilho };
  }
  const p = streakParts(state, color);
  if (layer === 'chama') return { fundo: p.fundo, chama: p.chama, gelo: NONE, brilho: state === 'gelo' ? NONE : p.brilho };
  return p;
}

export function streakNodes(state: StreakState, color?: string): ArtNode[] {
  const p = streakParts(state, color);
  return [...p.fundo, ...p.chama, ...p.gelo, ...p.brilho];
}

export function streakLayerNodes(state: StreakState, layer: StreakLayer, color?: string): ArtNode[] {
  const p = streakLayerParts(state, layer, color);
  return [...p.fundo, ...p.chama, ...p.gelo, ...p.brilho];
}
