/**
 * Baús (3 raridades × 3 estados) — porte de `docs/melhoria/F1/arte/fonte/itens.cjs`. viewBox 160 × 160.
 * A raridade lê pela forma, não só pela cor: comum é liso; raro tem cantoneiras, rebites e nervura;
 * lendário tem coroa de cristal, gema e o "prisma" com as 4 cores dos times (o baú é da cidade).
 * A tampa é uma camada própria (`tampa`), com pivô na dobradiça, para a E5 animar a abertura. Puro.
 */
import { glowFill, memoArt, neon, pivot, pt, spark, star, type ArtNode, type PivotOpts } from '../neon/core';
import { ART, PRISM } from '../neon/palette';

/** Mesmos valores do tipo `ChestRarity` do app. */
export type ChestRarity = 'comum' | 'raro' | 'lendario';
export type ChestState = 'fechado' | 'abrindo' | 'aberto';
export const CHEST_RARITIES: readonly ChestRarity[] = ['comum', 'raro', 'lendario'];
export const CHEST_STATES: readonly ChestState[] = ['fechado', 'abrindo', 'aberto'];
export const CHEST_LABELS: Record<ChestRarity, string> = { comum: 'comum', raro: 'raro', lendario: 'lendário' };
export const CHEST_BOX = { vbW: 160, vbH: 160 } as const;
/**
 * Pivôs (viewBox 160 × 160): `tampa` gira na dobradiça; `corpo` treme a partir do chão; `item` (o prêmio que
 * sobe do baú, camada própria para a E5) cresce e gira em torno do próprio centro.
 */
export const CHEST_PIVOTS = {
  tampa: { x: 30, y: 86 },
  corpo: { x: 80, y: 148 },
  item: { x: 80, y: 56 },
} as const;
/** Camadas separadas para a E5 animar a abertura (`ChestOpening`: `chest`, `lid` e `item`). */
export type ChestLayer = 'corpo' | 'tampa' | 'item';
export const CHEST_LAYERS: readonly ChestLayer[] = ['corpo', 'tampa', 'item'];

export type ChestParts = {
  /** Raios e brilho do interior (atrás de tudo). */
  fundo: ArtNode[];
  corpo: ArtNode[];
  /** A tampa, já na posição estática do estado (em torno de `CHEST_PIVOTS.tampa`). */
  tampa: ArtNode[];
  /** Cadeado, tremor e chão (por cima). */
  frente: ArtNode[];
  /** Transformação do baú inteiro (o aberto fica um pouco menor para caber a tampa). */
  pose?: PivotOpts;
};

function rays(cx: number, cy: number, r1: number, r2: number, n: number, from = 0, span = 360): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = from + (span * (i + 0.5)) / n;
    out.push(`M${pt(cx, cy, r1, a)} L ${pt(cx, cy, i % 2 ? r2 * 0.86 : r2, a)}`);
  }
  return out;
}

const cache = new Map<string, ChestParts>();

/** `color` troca a cor da raridade (padrão: branco quente, laranja ou prisma). */
export function chestParts(rarity: ChestRarity, state: ChestState, color?: string): ChestParts {
  return memoArt(cache, `${rarity}|${state}|${color ?? ''}`, () => {
    const col = color ?? (rarity === 'lendario' ? PRISM : rarity === 'raro' ? ART.orange : ART.ink);
    const detail = rarity === 'comum' ? ART.ink2 : ART.ink;
    const body = 'M28 86 L 132 86 L 126 138 L 34 138 Z';
    const lid = 'M26 86 L 134 86 L 130 62 Q 80 42 30 62 Z';
    const open = state === 'aberto';
    const opening = state === 'abrindo';

    const lidArt: ArtNode[] = [neon(lid, col, 3.6, { fill: true, tint: 0.1 }), neon(['M54 86 L 54 54', 'M106 86 L 106 54'], detail, 2.2, { glow: 0.4, hot: 0, opacity: 0.7 })];
    if (rarity !== 'comum') lidArt.push(neon('M36 74 Q 80 58 124 74', detail, 1.6, { glow: 0.3, hot: 0, opacity: 0.6 }));
    if (rarity === 'lendario') {
      lidArt.push(neon(['M66 50 L 72 36 L 80 46 L 88 36 L 94 50'], col, 3, { hot: 0.6 }), glowFill('M80 30 L 87 40 L 80 50 L 73 40 Z', ART.ink, { w: 1.2, glow: 1.2 }));
    }

    const fundo: ArtNode[] = [];
    if (rarity === 'lendario' || open) {
      fundo.push(
        neon(rays(80, open ? 84 : 92, open ? 30 : 64, open ? 78 : 76, open ? 9 : 12, open ? 200 : 0, open ? 140 : 360), open && rarity !== 'lendario' ? col : ART.ink, 2, {
          hot: 0,
          opacity: open ? 0.85 : 0.3,
          glow: 0.8,
        }),
      );
    }
    if (open) {
      fundo.push(
        neon('M30 86 Q 80 76 130 86 Q 80 96 30 86 Z', col, 2.4, { fill: rarity === 'comum' ? ART.dark.neutral : ART.glowBg, glow: 1.6 }),
        glowFill(star(80, 62, 14, 5, 4, -90), ART.ink, { w: 1.2, glow: 1.4 }),
        spark(52, 44, 5, ART.ink),
        spark(112, 38, 6, rarity === 'comum' ? ART.ink : ART.orange),
      );
    }

    const corpo: ArtNode[] = [neon(body, col, 3.6, { fill: true, tint: 0.12 }), neon(['M54 88 L 56 138', 'M106 88 L 104 138'], detail, 2.2, { glow: 0.4, hot: 0, opacity: 0.7 })];
    if (rarity !== 'comum') {
      const corner = ['M28 100 L 28 86 L 42 86', 'M132 100 L 132 86 L 118 86', 'M34 124 L 34 138 L 48 138', 'M126 124 L 126 138 L 112 138'];
      corpo.push(
        neon(corner, ART.ink, 3, { glow: 0.6 }),
        glowFill(
          (
            [
              [40, 96],
              [120, 96],
              [44, 128],
              [116, 128],
            ] as const
          ).map(([cx, cy]) => ({ tag: 'circle' as const, cx, cy, r: 2 })),
          ART.ink,
          { w: 0.6, glow: 0.5 },
        ),
      );
    }
    // A fresta de luz do "abrindo" fica entre o corpo e a tampa.
    if (opening) corpo.push(neon('M32 86 L 128 86', ART.ink, 2.6, { glow: 2.2, hot: 0.9 }));

    const hinge = CHEST_PIVOTS.tampa;
    const tampa = open
      ? [pivot(lidArt, { ...hinge, rotate: -14, ty: -26 })]
      : opening
        ? [pivot(lidArt, { ...hinge, rotate: -4, ty: -6 })]
        : lidArt;

    const frente: ArtNode[] = [];
    if (!open) {
      frente.push(
        neon({ tag: 'rect', x: 70, y: 80, width: 20, height: 22, rx: 4 }, col, 2.6, { fill: true, tint: 0.2 }),
        glowFill('M80 86 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 M78.5 88 L 77.5 96 L 82.5 96 L 81.5 88 Z', ART.ink, { w: 0.5, glow: 0.6 }),
      );
    }
    if (opening) frente.push(neon(['M10 80 Q 4 92 10 104', 'M150 80 Q 156 92 150 104'], ART.ink, 2.2, { hot: 0, opacity: 0.8 }));
    frente.push(neon('M30 148 L 130 148', col === PRISM ? ART.ink : col, 2, { hot: 0, opacity: 0.25, dash: '2 7' }));

    return { fundo, corpo, tampa, frente, pose: open ? { x: 80, y: 148, scale: 0.84, ty: 8 } : undefined };
  });
}

export function chestNodes(rarity: ChestRarity, state: ChestState, color?: string): ArtNode[] {
  const p = chestParts(rarity, state, color);
  const all = [...p.fundo, ...p.corpo, ...p.tampa, ...p.frente];
  return p.pose ? [pivot(all, p.pose)] : all;
}

/**
 * O prêmio que sobe do baú: estrela de 4 pontas na cor da raridade (o prisma no lendário), com anel e
 * faíscas. Fica centrado em `CHEST_PIVOTS.item`, já na altura em que sai da boca do baú aberto.
 */
export function chestItemNodes(rarity: ChestRarity, color?: string): ArtNode[] {
  const col = color ?? (rarity === 'lendario' ? PRISM : rarity === 'raro' ? ART.orange : ART.ink);
  const { x, y } = CHEST_PIVOTS.item;
  return [
    neon({ tag: 'circle', cx: x, cy: y, r: 26 }, col, 2, { hot: 0, opacity: 0.55, dash: '3 6' }),
    neon(star(x, y, 22, 7, 4, -90), col, 2.6, { fill: true, tint: 0.2, glow: 1.4 }),
    glowFill(star(x, y, 9, 3.5, 4, -45), ART.ink, { w: 1, glow: 1.2 }),
    spark(x - 30, y - 18, 5, ART.ink),
    spark(x + 32, y - 10, 6, rarity === 'comum' ? ART.ink : ART.orange),
    spark(x + 22, y + 24, 4, ART.ink),
  ];
}

/** Nós de uma camada só (sem a pose do baú aberto: a E5 anima a partir do baú fechado). */
export function chestLayerNodes(rarity: ChestRarity, state: ChestState, layer: ChestLayer, color?: string): ArtNode[] {
  if (layer === 'item') return chestItemNodes(rarity, color);
  const p = chestParts(rarity, state, color);
  const nodes = layer === 'tampa' ? p.tampa : [...p.fundo, ...p.corpo, ...p.frente];
  return p.pose ? [pivot(nodes, p.pose)] : nodes;
}
