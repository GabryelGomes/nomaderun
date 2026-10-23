/**
 * Fundos sutis das abas (estáticos, decorativos, opacidade ≤ 6%). viewBox 390 × 844 (proporção de celular),
 * desenhados para cobrir a tela com `preserveAspectRatio="xMidYMid slice"`. O Mapa não tem fundo (o mapa é
 * o herói). Puro.
 */
import type { FactionId } from '@/domain/types';

import { glyph, memoArt, neon, type ArtNode } from '../neon/core';
import { ART, teamShape } from '../neon/palette';

export type TabBackgroundKind = 'arena' | 'clube' | 'voce' | 'atividades';
export const TAB_BACKGROUND_KINDS: readonly TabBackgroundKind[] = ['arena', 'clube', 'voce', 'atividades'];
export const TAB_BACKGROUND_LABELS: Record<TabBackgroundKind, string> = { arena: 'Arena', clube: 'Clube', voce: 'Você', atividades: 'Atividades' };
export const BACKGROUND_BOX = { vbW: 390, vbH: 844 } as const;
/** Teto de opacidade dos fundos (o texto por cima não pode perder contraste). */
export const MAX_BACKGROUND_OPACITY = 0.06;
/** Opacidade de cada fundo (4–6% na Arena e em Você, 3–4% nos padrões). */
export const BACKGROUND_OPACITY: Record<TabBackgroundKind, number> = { arena: 0.06, clube: 0.04, voce: 0.06, atividades: 0.035 };

function arena(): ArtNode[] {
  const horizon = 210;
  const floor = 430;
  const vx = 195;
  const rows: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const y = horizon + (floor - horizon) * (i / 7) ** 2;
    rows.push(`M-20 ${y.toFixed(1)} L 410 ${y.toFixed(1)}`);
  }
  const cols: string[] = [];
  for (let x = -455; x <= 845; x += 65) cols.push(`M${(vx + (x - vx) * 0.06).toFixed(1)} ${horizon} L ${x} ${floor}`);
  return [
    neon([...rows, ...cols], ART.ink, 2, { glow: 0.6, hot: 0 }),
    neon(`M-20 ${horizon} L 410 ${horizon}`, ART.orange, 4, { glow: 1.4, hot: 0.6 }),
    neon([{ tag: 'circle', cx: 195, cy: 350, r: 130 }, { tag: 'circle', cx: 195, cy: 350, r: 96 }], ART.villain, 6, { glow: 1.6, hot: 0 }),
  ];
}

function clube(): ArtNode[] {
  const teams: FactionId[] = ['striders', 'volt', 'owls', 'coyotes'];
  const shapes: ArtNode[] = [];
  let k = 0;
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 5; col++) {
      const t = teams[(row + col * 3) % 4];
      const x = 39 + col * 78 + (row % 2 ? 39 : 0);
      const y = 40 + row * 78;
      shapes.push(neon(glyph(teamShape(t), x, y, 12 + ((k++ * 7) % 5)), ART.team[t], 2.4, { glow: 0.6, hot: 0 }));
    }
  }
  return shapes;
}

function voce(team: FactionId): ArtNode[] {
  const shape = teamShape(team);
  const c = ART.team[team];
  return [neon(glyph(shape, 195, 330, 250), c, 8, { glow: 1.2, hot: 0 }), neon(glyph(shape, 195, 330, 200), c, 3, { glow: 0.8, hot: 0 })];
}

function atividades(): ArtNode[] {
  const contours: string[] = [];
  for (let i = 0; i < 9; i++) {
    const r = 40 + i * 34;
    const cx = 280;
    const cy = 560;
    contours.push(
      `M${cx - r} ${cy} C ${cx - r} ${cy - r * 0.9} ${cx - r * 0.2} ${cy - r * 1.1} ${cx + r * 0.3} ${cy - r * 0.8} C ${cx + r * 0.9} ${cy - r * 0.5} ${cx + r * 1.1} ${cy + r * 0.3} ${cx + r * 0.6} ${cy + r * 0.8} C ${cx + r * 0.1} ${cy + r * 1.2} ${cx - r * 1.05} ${cy + r * 0.8} ${cx - r} ${cy} Z`,
    );
  }
  return [
    neon(contours, ART.ink, 2, { glow: 0.4, hot: 0 }),
    neon('M-10 180 Q 90 140 140 220 Q 190 300 120 380 Q 60 450 150 520', ART.ink, 4, { glow: 0.8, hot: 0, dash: '2 14' }),
  ];
}

const cache = new Map<string, ArtNode[]>();

export function backgroundNodes(kind: TabBackgroundKind, team: FactionId = 'striders'): ArtNode[] {
  return memoArt(cache, `${kind}|${team}`, () => (kind === 'arena' ? arena() : kind === 'clube' ? clube() : kind === 'voce' ? voce(team) : atividades()));
}
