/**
 * Ícones dos 8 modos (Arena) — porte de `docs/melhoria/F1/arte/fonte/itens.cjs`. viewBox 64 × 64.
 * Traço único em branco quente com um acento laranja; a Raid usa o violeta dos vilões. Legíveis em 28 pt
 * (no tamanho pequeno a qualidade `auto` vira `plano`, sem halo largo que embaça). Puro.
 */
import { glowFill, memoArt, neon, type ArtNode, type Shape } from '../neon/core';
import { ART } from '../neon/palette';

export type ModeIconKind = 'dominio' | 'atlas' | 'fuga' | 'caca' | 'raid' | 'liga' | 'cidades' | 'crews';
export const MODE_ICON_KINDS: readonly ModeIconKind[] = ['dominio', 'atlas', 'fuga', 'caca', 'raid', 'liga', 'cidades', 'crews'];
export const MODE_ICON_LABELS: Record<ModeIconKind, string> = {
  dominio: 'Domínio',
  atlas: 'Atlas',
  fuga: 'Fuga',
  caca: 'Caça',
  raid: 'Raid',
  liga: 'Liga',
  cidades: 'Cidade × Cidade',
  crews: 'Crews',
};
export const MODE_ICON_BOX = { vbW: 64, vbH: 64 } as const;

const cache = new Map<string, ArtNode[]>();

/** `color` é o traço principal (padrão branco quente); `accent`, o acento (padrão laranja). */
export function modeIconNodes(kind: ModeIconKind, color: string = ART.ink, accent: string = ART.orange): ArtNode[] {
  return memoArt(cache, `${kind}|${color}|${accent}`, () => {
    const I = (d: Shape | Shape[], col = color, w = 3) => neon(d, col, w, { glow: 0.7, hot: 0.35 });
    switch (kind) {
      case 'dominio':
        return [
          neon('M14 40 Q 10 22 26 16 Q 30 15 33 15 Q 30 34 34 52 Q 22 54 14 40 Z', accent, 2.4, { fill: accent, glow: 0.6, hot: 0, opacity: 0.35 }),
          I('M14 40 Q 10 22 26 16 Q 42 10 50 24 Q 58 40 44 50 Q 26 58 14 40 Z'),
          I('M33 15 Q 30 34 34 52', accent, 3.4),
          glowFill({ tag: 'circle', cx: 33, cy: 15, r: 3.6 }, accent, { w: 1 }),
        ];
      case 'atlas':
        return [I('M10 18 L 24 12 L 40 18 L 54 12 L 54 46 L 40 52 L 24 46 L 10 52 Z'), I(['M24 12 L 24 46', 'M40 18 L 40 52'], color, 2), I('M14 34 Q 22 28 30 34 Q 38 40 50 32', accent, 3)];
      case 'fuga':
        return [
          neon([{ tag: 'circle', cx: 20, cy: 18, r: 5 }, 'M20 24 L 16 38 L 8 46 M16 38 L 24 44 L 24 54 M18 28 L 10 32'], ART.ink2, 2.4, { dash: '3 4', glow: 0.3, hot: 0 }),
          I([{ tag: 'circle', cx: 42, cy: 14, r: 5 }, 'M42 20 L 38 34 L 30 42 M38 34 L 46 40 L 46 52 M40 24 L 32 30 M40 24 L 52 26'], accent),
        ];
      case 'caca':
        return [I(['M14 40 L 50 40 L 48 54 L 16 54 Z', 'M14 40 L 16 32 Q 32 26 48 32 L 50 40'], accent), I(['M22 22 Q 32 14 42 22', 'M16 14 Q 32 2 48 14'], color, 2.4)];
      case 'raid':
        return [I('M14 26 L 18 12 L 26 22 L 38 22 L 46 12 L 50 26 L 48 44 L 38 54 L 26 54 L 16 44 Z', ART.villain), I('M34 24 L 26 38 L 34 38 L 28 50', accent, 2.6)];
      case 'liga':
        return [
          I(['M8 52 L 8 38 L 22 38 L 22 52', 'M24 52 L 24 26 L 40 26 L 40 52', 'M42 52 L 42 32 L 56 32 L 56 52', 'M4 52 L 60 52']),
          I('M32 6 L 35 13 L 42 13 L 36 18 L 38 24 L 32 20 L 26 24 L 28 18 L 22 13 L 29 13 Z', accent, 2.2),
        ];
      case 'cidades':
        return [
          I(['M6 54 L 6 30 L 16 24 L 16 54', 'M16 54 L 16 36 L 26 36 L 26 54']),
          I(['M58 54 L 58 22 L 48 28 L 48 54', 'M48 54 L 48 38 L 38 38 L 38 54']),
          I(['M28 14 L 36 22', 'M36 14 L 28 22'], accent, 3),
        ];
      case 'crews':
        return [
          I([{ tag: 'circle', cx: 32, cy: 18, r: 7 }, 'M18 46 Q 18 30 32 30 Q 46 30 46 46'], accent),
          I([{ tag: 'circle', cx: 12, cy: 26, r: 5 }, 'M2 50 Q 2 38 12 38 Q 18 38 20 42', { tag: 'circle', cx: 52, cy: 26, r: 5 }, 'M62 50 Q 62 38 52 38 Q 46 38 44 42'], color, 2.4),
        ];
    }
  });
}
