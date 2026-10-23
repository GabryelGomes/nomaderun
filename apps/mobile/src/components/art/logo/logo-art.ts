/**
 * Logo oficial do NOMADE RUN (T7.2.8): símbolo + logotipo, no mesmo traço neon do sistema. Puro: só geometria.
 *
 * - **Símbolo** (viewBox 200 × 200): a cidade dividida em 4 (anel em 4 arcos, um por time, com folga entre
 *   eles) e, dentro, uma rota laranja que escreve um "N" (largada no anel branco embaixo à esquerda, chegada
 *   com a seta para cima à direita). Lê em 48 px como "anel colorido + N laranja".
 * - **Logotipo** (viewBox 400 × 64): "NOMADE RUN" em letras geométricas de traço único, inclinadas para a
 *   frente (velocidade); "NOMADE" no branco quente e "RUN" no laranja, como o herói das telas de entrada.
 *   As letras são **paths** (nunca `<text>`): não dependem de fonte e saem iguais no PNG do card.
 * - **Horizontal** (viewBox 640 × 200): símbolo + logotipo.
 */
import { glowFill, group, neon, type ArtNode } from '../neon/core';
import { ART } from '../neon/palette';

export type LogoVariant = 'simbolo' | 'logotipo' | 'horizontal';
export const LOGO_VARIANTS: readonly LogoVariant[] = ['simbolo', 'logotipo', 'horizontal'];
export const LOGO_BOX: Record<LogoVariant, { vbW: number; vbH: number }> = {
  simbolo: { vbW: 200, vbH: 200 },
  logotipo: { vbW: 400, vbH: 64 },
  horizontal: { vbW: 640, vbH: 200 },
};
export const LOGO_LABEL = 'NOMADE RUN';

const r1 = (n: number) => Math.round(n * 100) / 100;

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${r1(cx + r * Math.cos((a * Math.PI) / 180))} ${r1(cy + r * Math.sin((a * Math.PI) / 180))}`;
  return `M${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
}

/** Cores do símbolo; `mono` desenha tudo numa cor só (ícone monocromático do Android, carimbos). */
export type LogoPalette = { ring: readonly [string, string, string, string]; route: string; start: string };
export const LOGO_COLORS: LogoPalette = {
  // Do canto superior esquerdo, no sentido horário: Striders, Volt, Coyotes, Owls.
  ring: [ART.team.striders, ART.team.volt, ART.team.coyotes, ART.team.owls],
  route: ART.orange,
  start: ART.ink,
};

export function logoSymbolNodes(mono?: string): ArtNode[] {
  const ring = mono ? [mono, mono, mono, mono] : LOGO_COLORS.ring;
  const route = mono ?? LOGO_COLORS.route;
  const start = mono ?? LOGO_COLORS.start;
  // 4 arcos de 78° com 12° de folga, começando no alto à esquerda.
  const arcs = [0, 1, 2, 3].map((i) => neon(arc(100, 100, 84, 186 + i * 90, 264 + i * 90), ring[i], 7, { glow: 1, hot: 0.5 }));
  return [
    ...arcs,
    // A rota em N: sobe, cruza em diagonal, sobe de novo até a seta.
    neon('M66 138 L 66 64 L 134 136 L 134 70', route, 12, { glow: 0.75, hot: 0.55 }),
    neon('M118 82 L 134 62 L 150 82', route, 12, { glow: 0.75, hot: 0.55 }),
    // Largada: anel branco no pé da primeira haste.
    neon({ tag: 'circle', cx: 66, cy: 150, r: 8 }, start, 5, { fill: true, tint: 0, glow: 0.8, hot: 0.4 }),
    ...(mono ? [] : [glowFill({ tag: 'circle', cx: 66, cy: 150, r: 2.6 }, route, { glow: 0, w: 0.6 })]),
  ];
}

// ---------------------------------------------------------------- logotipo
type Letter = { w: number; d: (x: number) => string };
const CAP = 40;
const LETTERS: Record<string, Letter> = {
  N: { w: 30, d: (x) => `M${x} ${CAP} L ${x} 0 L ${x + 30} ${CAP} L ${x + 30} 0` },
  O: { w: 34, d: (x) => `M${x + 12} 0 L ${x + 22} 0 Q ${x + 34} 0 ${x + 34} 12 L ${x + 34} 28 Q ${x + 34} ${CAP} ${x + 22} ${CAP} L ${x + 12} ${CAP} Q ${x} ${CAP} ${x} 28 L ${x} 12 Q ${x} 0 ${x + 12} 0 Z` },
  M: { w: 38, d: (x) => `M${x} ${CAP} L ${x} 0 L ${x + 19} 24 L ${x + 38} 0 L ${x + 38} ${CAP}` },
  A: { w: 32, d: (x) => `M${x} ${CAP} L ${x + 16} 0 L ${x + 32} ${CAP} M${x + 8} 26 L ${x + 24} 26` },
  D: { w: 31, d: (x) => `M${x} 0 L ${x} ${CAP} L ${x + 16} ${CAP} Q ${x + 31} ${CAP} ${x + 31} 26 L ${x + 31} 14 Q ${x + 31} 0 ${x + 16} 0 Z` },
  E: { w: 26, d: (x) => `M${x + 26} 0 L ${x} 0 L ${x} ${CAP} L ${x + 26} ${CAP} M${x} 20 L ${x + 20} 20` },
  R: { w: 29, d: (x) => `M${x} ${CAP} L ${x} 0 L ${x + 18} 0 Q ${x + 29} 0 ${x + 29} 11 Q ${x + 29} 22 ${x + 18} 22 L ${x} 22 M${x + 14} 22 L ${x + 29} ${CAP}` },
  U: { w: 30, d: (x) => `M${x} 0 L ${x} 26 Q ${x} ${CAP} ${x + 15} ${CAP} Q ${x + 30} ${CAP} ${x + 30} 26 L ${x + 30} 0` },
};
const GAP = 9;
const SPACE = 20;

function word(text: string, x0: number): { paths: string[]; end: number } {
  let x = x0;
  const paths: string[] = [];
  for (const ch of text) {
    const l = LETTERS[ch];
    paths.push(l.d(x));
    x += l.w + GAP;
  }
  return { paths, end: x - GAP };
}

/** Inclinação para a frente (skewX ≈ -12°), em torno da linha de base. */
const SKEW = Math.tan((12 * Math.PI) / 180);

export function logoWordmarkNodes(mono?: string): ArtNode[] {
  const nomade = word('NOMADE', 0);
  const run = word('RUN', nomade.end + SPACE);
  const width = run.end;
  // Centraliza no viewBox 400 × 64 (cap height 40 + folga do brilho), já descontando a inclinação.
  const tx = (400 - width - SKEW * CAP) / 2;
  const ty = 12;
  return [
    group(
      [
        neon(nomade.paths, mono ?? ART.ink, 6, { glow: 0.55, hot: 0.4 }),
        neon(run.paths, mono ?? ART.orange, 6, { glow: 1.1, hot: 0.55 }),
      ],
      { matrix: [1, 0, -SKEW, 1, tx + SKEW * CAP, ty] },
    ),
  ];
}

/** Logo na variante pedida, no viewBox de `LOGO_BOX[variant]`. */
export function logoNodes(variant: LogoVariant, mono?: string): ArtNode[] {
  if (variant === 'simbolo') return logoSymbolNodes(mono);
  if (variant === 'logotipo') return logoWordmarkNodes(mono);
  return [group(logoSymbolNodes(mono), { matrix: [0.86, 0, 0, 0.86, 8, 14] }), group(logoWordmarkNodes(mono), { matrix: [1.06, 0, 0, 1.06, 196, 66] })];
}
