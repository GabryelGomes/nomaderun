/**
 * Medalhas (12) — base de `docs/melhoria/F1/arte/fonte/itens.cjs`, viewBox 120 × 150: fita em V, roseta de
 * 24 dentes, anel interno e ícone central. Nível por **estrelas e brilho**, nunca por dourado (o amarelo é
 * dos Coyotes): nível 1 = 1 estrela, laranja apagado; nível 2 = 2 estrelas, branco quente; nível 3 =
 * 3 estrelas, laranja pleno e raios. Bloqueada = roseta tracejada em cinza, ícone em silhueta e cadeado.
 * Os critérios de cada medalha são da E3/E7; aqui só o desenho. Puro.
 */
import { glowFill, memoArt, mirror, neon, pivot, star, type ArtNode } from '../neon/core';
import { modeIconNodes } from '../mode-icons/mode-icon-art';
import { ART, mix } from '../neon/palette';

export type MedalKind =
  | 'primeiros-passos'
  | 'explorador'
  | 'conquistador'
  | 'defensor'
  | 'sequencia'
  | 'cacador'
  | 'chefao'
  | 'fuga'
  | 'liga'
  | 'crew'
  | 'temporada'
  | 'desafio-mes';
export type MedalTier = 1 | 2 | 3;

export const MEDAL_KINDS: readonly MedalKind[] = [
  'primeiros-passos',
  'explorador',
  'conquistador',
  'defensor',
  'sequencia',
  'cacador',
  'chefao',
  'fuga',
  'liga',
  'crew',
  'temporada',
  'desafio-mes',
];
export const MEDAL_LABELS: Record<MedalKind, string> = {
  'primeiros-passos': 'Primeiros passos',
  explorador: 'Explorador',
  conquistador: 'Conquistador',
  defensor: 'Defensor',
  sequencia: 'Sequência',
  cacador: 'Caçador',
  chefao: 'Chefão',
  fuga: 'Fuga',
  liga: 'Liga',
  crew: 'Crew',
  temporada: 'Temporada',
  'desafio-mes': 'Desafio do mês',
};
export const MEDAL_BOX = { vbW: 120, vbH: 150 } as const;
/** Pivô (viewBox 120 × 150) do carimbo: o centro da roseta. */
export const MEDAL_PIVOTS = { roseta: { x: 60, y: 98 } } as const;

/** Cor de cada nível (sem dourado). */
export function tierColor(tier: MedalTier): string {
  return tier === 1 ? mix(ART.orange, ART.ink2, 0.42) : tier === 2 ? ART.ink : ART.orange;
}

function icon(kind: MedalKind, col: string): ArtNode[] {
  switch (kind) {
    case 'primeiros-passos':
      return [
        neon(['M32 92 L 38 92', 'M30 99 L 37 99'], ART.orange, 2, { hot: 0, opacity: 0.7 }),
        neon('M42 108 L 44 97 Q 50 96 55 90 L 60 91 Q 66 98 77 100 Q 86 101 86 106 L 86 108 Z', col, 2.6, { fill: true, tint: 0.2 }),
        neon(['M42 108 L 86 108', 'M45 113 L 84 113'], ART.ink, 1.8, { glow: 0.4, hot: 0 }),
        neon(['M58 95 L 62 92', 'M62 98 L 66 95'], ART.ink, 1.6, { glow: 0.3, hot: 0 }),
      ];
    case 'explorador':
      return [
        neon({ tag: 'circle', cx: 60, cy: 98, r: 21 }, ART.ink, 1.6, { glow: 0.3, hot: 0, opacity: 0.6 }),
        glowFill(star(60, 98, 20, 5, 4, -90), ART.ink, { w: 1, glow: 0.8 }),
        glowFill(star(60, 98, 9, 3, 4, -45), col, { w: 0.6, glow: 0.4 }),
      ];
    case 'conquistador':
      return [neon(['M50 120 L 50 76'], ART.ink, 3), neon('M50 77 L 78 84 L 50 94 Z', col, 2.6, { fill: true, tint: 0.3 }), neon('M38 120 Q 60 110 82 120', ART.ink, 2.4, { hot: 0 })];
    case 'defensor':
      return [neon('M60 76 L 79 83 Q 79 106 60 119 Q 41 106 41 83 Z', ART.ink, 2.6, { fill: true, tint: 0.06 }), neon('M51 97 L 58 104 L 70 89', col, 3)];
    case 'sequencia':
      return [
        neon('M60 72 Q 80 92 74 108 Q 70 120 60 120 Q 48 120 45 108 Q 43 96 53 87 Q 53 98 60 101 Q 57 86 60 72 Z', col, 2.8, { fill: true, tint: 0.2 }),
        glowFill('M60 96 Q 68 104 66 111 Q 64 116 60 116 Q 55 116 54 111 Q 53 104 60 96 Z', ART.ink, { w: 0.6, glow: 0.8 }),
      ];
    case 'cacador':
      return [
        neon('M43 98 L 77 98 L 75 116 L 45 116 Z', col, 2.6, { fill: true, tint: 0.16 }),
        neon('M42 98 L 78 98 L 76 88 Q 60 80 44 88 Z', col, 2.6, { fill: true, tint: 0.1 }),
        neon({ tag: 'rect', x: 56, y: 94, width: 8, height: 9, rx: 2 }, ART.ink, 1.8, { fill: true, tint: 0, glow: 0.4, hot: 0 }),
      ];
    case 'chefao':
      return [
        neon('M42 86 L 46 70 L 55 82 L 65 82 L 74 70 L 78 86 L 76 104 L 66 116 L 54 116 L 44 104 Z', col === ART.ink2 ? ART.ink2 : ART.villain, 2.6, { fill: true, tint: 0.2 }),
        glowFill(['M49 92 L 57 95 L 55 100 L 50 98 Z', mirror('M49 92 L 57 95 L 55 100 L 50 98 Z', 60)], ART.ink, { w: 0.5, glow: 0.6 }),
        neon(['M64 74 L 58 90 L 64 98 L 58 114'], ART.ink, 1.8, { hot: 0 }),
      ];
    case 'fuga':
      return [pivot(modeIconNodes('fuga', ART.ink, col), { x: 32, y: 32, scale: 0.72, tx: 28, ty: 66 })];
    case 'liga':
      return [pivot(modeIconNodes('liga', ART.ink, col), { x: 32, y: 32, scale: 0.7, tx: 28, ty: 66 })];
    case 'crew':
      return [pivot(modeIconNodes('crews', ART.ink, col), { x: 32, y: 32, scale: 0.7, tx: 28, ty: 68 })];
    case 'temporada':
      return [neon(star(60, 98, 21, 10, 8, -90), col, 2.6, { fill: true, tint: 0.2 }), glowFill({ tag: 'circle', cx: 60, cy: 98, r: 4.5 }, ART.ink, { w: 1 })];
    case 'desafio-mes':
      return [
        neon({ tag: 'rect', x: 43, y: 82, width: 34, height: 32, rx: 4 }, ART.ink, 2.4, { fill: true, tint: 0.06 }),
        neon(['M43 91 L 77 91'], ART.ink, 2, { glow: 0.4, hot: 0 }),
        neon(['M51 78 L 51 85', 'M69 78 L 69 85'], ART.ink, 2.4, { hot: 0 }),
        glowFill(
          (
            [
              [51, 99],
              [60, 99],
              [69, 99],
              [51, 107],
              [60, 107],
            ] as const
          ).map(([x, y]) => ({ tag: 'rect' as const, x: x - 2, y: y - 2, width: 4, height: 4 })),
          ART.ink2,
          { w: 0.5, glow: 0 },
        ),
        glowFill({ tag: 'rect', x: 66, y: 104, width: 7, height: 7, rx: 1.5 }, col, { w: 0.8, glow: 1 }),
      ];
  }
}

const cache = new Map<string, ArtNode[]>();

/** `color` troca a cor do nível (padrão: `tierColor(tier)`). */
export function medalNodes(kind: MedalKind, tier: MedalTier, locked: boolean, color?: string): ArtNode[] {
  return memoArt(cache, `${kind}|${tier}|${locked}|${color ?? ''}`, () => {
    const col = locked ? ART.ink2 : (color ?? tierColor(tier));
    const strap = 'M30 2 L 48 60 L 62 60 L 44 2 Z';
    const glow = locked ? 0.2 : tier === 1 ? 0.45 : 1;
    const out: ArtNode[] = [];
    if (!locked && tier === 3) {
      const rays: string[] = [];
      for (let i = 0; i < 16; i++) {
        const a = ((i + 0.5) * 360) / 16;
        const rad = (a * Math.PI) / 180;
        const r2 = i % 2 ? 54 : 60;
        rays.push(`M${(60 + Math.cos(rad) * 49).toFixed(1)} ${(98 + Math.sin(rad) * 49).toFixed(1)} L ${(60 + Math.cos(rad) * r2).toFixed(1)} ${(98 + Math.sin(rad) * r2).toFixed(1)}`);
      }
      out.push(neon(rays, col, 2, { hot: 0, glow: 0.8, opacity: 0.75 }));
    }
    out.push(
      neon([strap, mirror(strap, 60)], col, 2.4, { fill: true, tint: 0.14, glow: locked ? 0.2 : 0.6, hot: 0, opacity: locked ? 0.5 : 1 }),
      neon(['M37 4 L 54 58', mirror('M37 4 L 54 58', 60)], ART.ink, 1.4, { glow: 0, hot: 0, opacity: locked ? 0.3 : 0.6 }),
      neon(star(60, 98, 44, 40, 24), col, 3, { fill: true, tint: 0.1, glow, hot: tier === 1 ? 0.25 : 0.5, dash: locked ? '4 5' : undefined }),
      neon({ tag: 'circle', cx: 60, cy: 98, r: 33 }, col, 1.6, { glow: 0, hot: 0, opacity: 0.55 }),
    );
    if (locked) {
      out.push(pivot(icon(kind, ART.ink2), { opacity: 0.3 }));
      out.push(
        neon({ tag: 'rect', x: 51, y: 124, width: 18, height: 14, rx: 3 }, ART.ink2, 2, { fill: true, tint: 0, glow: 0.3, hot: 0 }),
        neon('M55 124 L 55 120 Q 55 115 60 115 Q 65 115 65 120 L 65 124', ART.ink2, 2, { glow: 0.3, hot: 0 }),
      );
      return out;
    }
    out.push(...icon(kind, col));
    // Placa de estrelas no encontro da fita com a roseta.
    const pw = tier * 13 + 9;
    out.push(neon({ tag: 'rect', x: 60 - pw / 2, y: 49, width: pw, height: 15, rx: 7.5 }, col, 1.6, { fill: true, tint: 0.12, glow: 0.4, hot: 0 }));
    const stars = Array.from({ length: tier }, (_, i) => star(60 - ((tier - 1) * 13) / 2 + i * 13, 56.5, 5, 2.1, 5, -90));
    out.push(glowFill(stars, tier === 2 ? ART.ink : ART.orange, { w: 0.6, glow: tier === 1 ? 0.3 : 0.8 }));
    if (tier >= 2) out.push(neon([`M96 56 L 96 64`, `M92 60 L 100 60`], ART.ink, 1.6, { hot: 0.6 }));
    return out;
  });
}
