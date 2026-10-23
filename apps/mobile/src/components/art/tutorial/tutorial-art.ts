/**
 * Cartões do tutorial (corra, pinte, defenda) — base de `docs/melhoria/F1/arte/fonte/itens.cjs`, viewBox
 * 240 × 180, sobre um "mapa" de ruas apagadas. O "pinte" segue a regra v2 (D-62): as **ruas** por onde a
 * pessoa corre ganham a cor do time, e a zona fica com o time que pintou mais ruas nela. Puro.
 */
import { glowFill, glyph, memoArt, neon, spark, type ArtNode, type GlyphKind } from '../neon/core';
import { ART } from '../neon/palette';

export type TutorialStep = 'corra' | 'pinte' | 'defenda';
export const TUTORIAL_STEPS: readonly TutorialStep[] = ['corra', 'pinte', 'defenda'];
export const TUTORIAL_LABELS: Record<TutorialStep, string> = { corra: 'Corra', pinte: 'Pinte', defenda: 'Defenda' };
export const TUTORIAL_BOX = { vbW: 240, vbH: 180 } as const;

const STREETS = ['M0 40 L 240 56', 'M0 128 L 240 112', 'M60 0 L 76 180', 'M170 0 L 158 180'];
const ZONE = 'M70 52 Q 110 30 158 58 Q 176 92 156 122 Q 112 142 74 120 Q 52 88 70 52 Z';
const streets = (): ArtNode => neon(STREETS, ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.22 });

const cache = new Map<string, ArtNode[]>();

/** `color` e `shape` = cor e forma do time; `rival` = cor do anel de ataque no "defenda". */
export function tutorialNodes(step: TutorialStep, color: string, rival: string, shape: GlyphKind = 'circulo'): ArtNode[] {
  return memoArt(cache, `${step}|${color}|${rival}|${shape}`, () => {
    if (step === 'corra') {
      return [
        streets(),
        neon('M20 150 Q 60 150 74 116 Q 88 80 124 84 Q 164 88 176 54 Q 184 32 214 26', ART.orange, 4, { glow: 1.2 }),
        neon(['M10 150 L 18 150'], ART.orange, 3, { hot: 0, opacity: 0.4 }),
        glowFill({ tag: 'circle', cx: 214, cy: 26, r: 8 }, ART.orange, { w: 1.4 }),
        neon({ tag: 'circle', cx: 214, cy: 26, r: 16 }, ART.orange, 2, { hot: 0, opacity: 0.4 }),
        glowFill({ tag: 'circle', cx: 214, cy: 26, r: 3 }, ART.ink, { glow: 0, w: 0.5 }),
      ];
    }
    if (step === 'pinte') {
      // Trechos de rua já pintados (na cor do time), dentro da zona.
      const painted = ['M64.4 50 L 70.8 122', 'M70 44.7 L 160 50.7', 'M78 122.8 L 150 118'];
      return [
        streets(),
        neon(ZONE, color, 2.4, { fill: color, glow: 0, hot: 0, opacity: 0.14 }),
        neon(ZONE, color, 2.2, { glow: 0.6, hot: 0, dash: '6 7', opacity: 0.7 }),
        neon(painted, color, 5, { glow: 1.2, hot: 0.5 }),
        neon('M12 160 Q 50 150 64 124 L 70.8 122 L 64.4 50 L 70 44.7 L 160 50.7', ART.orange, 2.2, { glow: 0.6, hot: 0.4, opacity: 0.9 }),
        glowFill({ tag: 'circle', cx: 160, cy: 50.7, r: 6.5 }, ART.orange, { w: 1.2 }),
        neon(glyph(shape, 114, 88, 12), color, 3, { fill: true, tint: 0.3 }),
        spark(196, 34, 7, ART.ink),
        spark(36, 34, 5, color),
      ];
    }
    return [
      streets(),
      neon({ tag: 'ellipse', cx: 116, cy: 90, rx: 92, ry: 66 }, rival, 2.6, { dash: '8 8', glow: 0.8, hot: 0, opacity: 0.9 }),
      neon(ZONE, color, 3, { fill: color, glow: 0.8, hot: 0, opacity: 0.22 }),
      neon(ZONE, color, 3.4, { glow: 1.2 }),
      neon('M116 58 L 140 66 Q 140 104 116 118 Q 92 104 92 66 Z', ART.ink, 3.2, { fill: true, tint: 0.06, glow: 1 }),
      neon('M104 86 L 113 96 L 130 76', ART.orange, 3.4),
      neon(['M206 40 L 192 52', 'M214 64 L 196 70', 'M22 132 L 38 124'], rival, 2.4, { hot: 0, opacity: 0.8 }),
    ];
  });
}
