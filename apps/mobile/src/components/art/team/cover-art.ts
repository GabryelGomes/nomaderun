import { TEAM_BIO } from '@/domain/team-bio';
import type { FactionId } from '@/domain/types';

import { RUNNER_BOX } from './runner-art';

/**
 * Geometria da "capa" do time (F8, `docs/melhoria/F8/02-direcao-de-arte.md` §3.1), portada de
 * `docs/melhoria/F8/arte/fonte/capa.cjs`: brilho radial na cor do time saindo do canto inferior esquerdo, skyline
 * neon mínima (5 prédios em traço fino com janelas acesas), 4 estrelas, pista em perspectiva com 6 faixas laranja e
 * o `MascotRunner` corpo inteiro à esquerda, correndo para a direita (para o texto). O texto (nome, lema, bio) fica
 * fora do SVG, por `Text`, numa coluna à direita com um degradê escuro atrás.
 *
 * Puro (sem React): o componente `cover.tsx` desenha 1:1 e o teste de contraste usa os mesmos números.
 */
export type CoverVariant = 'card' | 'hero';

/** viewBox: 390 de largura; 220 de altura no card da escolha, 260 na capa de "Meu time". */
export const COVER_BOX: Record<CoverVariant, { vbW: number; vbH: number }> = {
  card: { vbW: 390, vbH: 220 },
  hero: { vbW: 390, vbH: 260 },
};

/** Brilho radial (coordenadas relativas à caixa) e paradas de opacidade. */
export const COVER_GLOW = { cx: 0.42, cy: 0.95, r: 0.75, stops: [[0, 0.34], [0.55, 0.08], [1, 0]] as const } as const;

/** Skyline por time (x, altura do topo, largura): silhueta diferente para cada capa ter a sua. */
export const SKYLINE: Record<FactionId, readonly (readonly [number, number, number])[]> = {
  striders: [
    [250, 60, 26],
    [282, 40, 30],
    [318, 74, 22],
    [346, 52, 28],
    [380, 86, 20],
  ],
  volt: [
    [250, 80, 24],
    [280, 30, 22],
    [308, 64, 30],
    [344, 46, 24],
    [374, 90, 26],
  ],
  owls: [
    [246, 50, 30],
    [282, 24, 24],
    [312, 70, 26],
    [344, 40, 30],
    [380, 80, 20],
  ],
  coyotes: [
    [250, 90, 28],
    [284, 56, 26],
    [316, 36, 24],
    [346, 70, 30],
    [382, 60, 18],
  ],
};

/** Espaço entre as faixas laranja da pista (o laço do idle desliza exatamente isso: −76 em 1,6 s). */
export const STRIPE_STEP = 76;
export const STRIPE_COUNT = 6;

/** Idle da capa (§3.3): trote do corredor, faixas deslizando, janelas piscando e o brilho respirando. */
export const COVER_IDLE = { stripesMs: 1600, blinkMs: 2600, blinkOpacity: [0.55, 0.2] as const, breatheMs: 2200, breatheScale: 1.04 } as const;

export type CoverScene = {
  width: number;
  height: number;
  /** y da linha do chão (a 1ª linha da pista). */
  ground: number;
  buildings: { x: number; y: number; w: number; h: number }[];
  /** Janelas fixas (3 × 4) e as 3 que piscam (camada própria). */
  windows: { x: number; y: number }[];
  blinking: { x: number; y: number }[];
  stars: { cx: number; cy: number; r: number; opacity: number }[];
  /** 3 linhas horizontais em perspectiva. */
  roadLines: { y: number; opacity: number; w: number }[];
  /** y das faixas laranja (7 faixas: 1 a mais para o laço fechar). */
  stripes: { x1: number; x2: number; y: number }[];
  /** Caixa do corredor (centro e lado maior). */
  runner: { cx: number; cy: number; size: number };
  /** Degradê escuro atrás da coluna de texto (x, largura, altura). */
  fade: { x: number; w: number; h: number };
  /** Degradê escuro no pé do card (só no card: atrás da 1ª linha da bio). */
  bottomFade: { y: number; h: number } | null;
};

const cache = new Map<string, CoverScene>();

/** A cena da capa de um time, nos números do viewBox. */
export function coverScene(team: FactionId, variant: CoverVariant = 'card'): CoverScene {
  const key = `${team}|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const hero = variant === 'hero';
  const { vbW: width, vbH: height } = COVER_BOX[variant];
  const ground = height - 34;
  const buildings: CoverScene['buildings'] = [];
  const windows: CoverScene['windows'] = [];
  const blinking: CoverScene['blinking'] = [];
  let n = 0;
  for (const [x, top0, w] of SKYLINE[team]) {
    const top = top0 + (hero ? 92 : 64);
    buildings.push({ x, y: top, w, h: ground - top });
    for (let yy = top + 10; yy < ground - 8; yy += 12) {
      for (let xx = x + 5; xx < x + w - 4; xx += 8) {
        if ((xx * 7 + yy * 3) % 5 < 2) {
          // padrão determinístico; 1 janela a cada 9 pisca (dá 2–3 por capa)
          (n++ % 9 === 4 ? blinking : windows).push({ x: xx, y: yy });
        }
      }
    }
  }
  const scene: CoverScene = {
    width,
    height,
    ground,
    buildings,
    windows,
    blinking,
    stars: [
      { cx: 300, cy: 18, r: 1.2, opacity: 0.6 },
      { cx: 360, cy: 30, r: 1.6, opacity: 0.5 },
      { cx: 330, cy: 12, r: 1, opacity: 0.4 },
      { cx: 270, cy: 28, r: 1, opacity: 0.5 },
    ],
    roadLines: [
      { y: ground, opacity: 0.7, w: 1.5 },
      { y: ground + 12, opacity: 0.25, w: 1 },
      { y: ground + 24, opacity: 0.12, w: 1 },
    ],
    stripes: Array.from({ length: STRIPE_COUNT + 1 }, (_, i) => ({ x1: i * STRIPE_STEP - 30, x2: i * STRIPE_STEP + 10, y: ground + 6 })),
    // um pouco menor e mais à esquerda que no protótipo: no card de 326 pt o texto não escala junto, e as orelhas
    // da lebre encostavam no nome (conferido na captura `F8-B1/depois/04-times-volt.png`)
    runner: hero ? { cx: 126, cy: 132, size: 230 } : { cx: 118, cy: 118, size: 190 },
    fade: { x: 190, w: 200, h: hero ? 150 : 110 },
    bottomFade: hero ? null : { y: height - 40, h: 40 },
  };
  cache.set(key, scene);
  return scene;
}

/** Posição e largura do `MascotRunner` (a largura é o lado do viewBox 240 × 220 escalado). */
export function runnerPlacement(scene: CoverScene): { left: number; top: number; width: number } {
  const scale = scene.runner.size / Math.max(RUNNER_BOX.vbW, RUNNER_BOX.vbH);
  const width = RUNNER_BOX.vbW * scale;
  const height = RUNNER_BOX.vbH * scale;
  return { left: scene.runner.cx - width / 2, top: scene.runner.cy - height / 2, width };
}

/** Opacidade do brilho do time num ponto relativo (0–1) da caixa: a mesma rampa do gradiente radial. */
export function glowOpacityAt(nx: number, ny: number): number {
  const d = Math.hypot(nx - COVER_GLOW.cx, ny - COVER_GLOW.cy) / COVER_GLOW.r;
  if (d >= 1) return 0;
  const stops = COVER_GLOW.stops;
  for (let i = 1; i < stops.length; i++) {
    const [p0, o0] = stops[i - 1];
    const [p1, o1] = stops[i];
    if (d <= p1) return o0 + ((d - p0) / (p1 - p0)) * (o1 - o0);
  }
  return 0;
}

/** Tipografia da coluna de texto (pt, no card de 390; o componente escala com a largura). */
export const COVER_TEXT = {
  nameSize: { card: 22, hero: 24 },
  mottoSize: 11,
  mottoTracking: 3,
  bioSize: 12.5,
  bioLineHeight: 17,
  /** Opacidade do degradê escuro atrás da coluna de texto (garante o contraste sobre o brilho e a cidade). */
  fadeOpacity: 0.92,
  bottomFadeOpacity: 0.85,
  bioOpacity: 0.9,
  /** Recuo do texto em relação à borda direita e ao topo. */
  inset: { right: 18, top: 16, bottom: 14 },
  /** Largura da coluna de texto da capa "hero" (cabe o nome em 1 linha e a bio sem quebrar a 358 pt). */
  columnWidth: 216,
} as const;

/**
 * Pontos onde cada texto encosta na cena (relativos à caixa), no canto mais perto do brilho: é o pior caso para o
 * contraste. O teste de contraste blenda o fundo com o brilho e o degradê nesses pontos.
 */
export function textAnchors(variant: CoverVariant): Record<'name' | 'motto' | 'bio', { nx: number; ny: number; fade: number }> {
  const { vbW, vbH } = COVER_BOX[variant];
  const f = COVER_TEXT.fadeOpacity;
  if (variant === 'hero') {
    return {
      name: { nx: (vbW - COVER_TEXT.inset.right - COVER_TEXT.columnWidth) / vbW, ny: 56 / vbH, fade: f },
      motto: { nx: (vbW - COVER_TEXT.inset.right - COVER_TEXT.columnWidth) / vbW, ny: 70 / vbH, fade: f },
      bio: { nx: (vbW - COVER_TEXT.inset.right - COVER_TEXT.columnWidth) / vbW, ny: 134 / vbH, fade: f },
    };
  }
  return {
    name: { nx: (vbW - COVER_TEXT.inset.right - 180) / vbW, ny: 40 / vbH, fade: f },
    motto: { nx: (vbW - COVER_TEXT.inset.right - 180) / vbW, ny: 56 / vbH, fade: f },
    // a bio fica no pé, fora do degradê lateral: conta com o degradê do pé do card
    bio: { nx: 150 / vbW, ny: (vbH - COVER_TEXT.inset.bottom) / vbH, fade: COVER_TEXT.bottomFadeOpacity },
  };
}

/** Rótulo da capa como imagem informativa. */
export function coverLabel(team: FactionId): string {
  const b = TEAM_BIO[team];
  return `${b.name}: ${b.motto}. ${b.mascot}, ${b.mascotKind}, correndo pela cidade à noite. ${b.bio.join(' ')}`;
}
