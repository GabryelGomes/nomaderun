/**
 * Estados vazios (8) — 4 portados de `docs/melhoria/F1/arte/fonte/itens.cjs` e 4 novos no mesmo traço.
 * viewBox 240 × 160. Regra da tela (E6): 1 ilustração + 1 frase + 1 ação; o texto fica fora do SVG.
 * Quando faz sentido, o mascote do time da pessoa aparece (o vazio vira personalidade). Puro.
 */
import type { FactionId } from '@/domain/types';

import { glowFill, memoArt, mirror, neon, pivot, pt, star, type ArtNode, type Shape } from '../neon/core';
import { ART } from '../neon/palette';
import { mascotNodes } from '../team/mascot-art';

export type EmptyKind = 'sem-corridas' | 'sem-crew' | 'sem-conexao' | 'sem-notificacoes' | 'sem-zonas' | 'sem-medalhas' | 'sem-contatos' | 'sem-localizacao';
export const EMPTY_KINDS: readonly EmptyKind[] = ['sem-corridas', 'sem-crew', 'sem-conexao', 'sem-notificacoes', 'sem-zonas', 'sem-medalhas', 'sem-contatos', 'sem-localizacao'];
export const EMPTY_LABELS: Record<EmptyKind, string> = {
  'sem-corridas': 'Sem corridas',
  'sem-crew': 'Sem crew',
  'sem-conexao': 'Sem conexão',
  'sem-notificacoes': 'Sem notificações',
  'sem-zonas': 'Sem zonas',
  'sem-medalhas': 'Sem medalhas',
  'sem-contatos': 'Sem contatos de segurança',
  'sem-localizacao': 'Sem localização',
};
/** Estados que usam o mascote do time (a prop `team`). */
export const EMPTY_USES_TEAM: readonly EmptyKind[] = ['sem-notificacoes', 'sem-localizacao'];
export const EMPTY_BOX = { vbW: 240, vbH: 160 } as const;

const dashedFloor = (y = 140): ArtNode => neon(`M40 ${y} L 200 ${y}`, ART.ink2, 1.8, { glow: 0, hot: 0, dash: '2 7' });

function semCorridas(a: string): ArtNode[] {
  const shoe = 'M38 120 L 44 100 Q 60 98 72 86 L 84 88 Q 100 104 134 108 Q 160 112 162 122 L 162 126 L 38 126 Z';
  return [
    neon('M168 122 Q 196 116 198 88 Q 200 62 216 54', ART.ink2, 2.2, { hot: 0, dash: '1 8', glow: 0.3 }),
    neon({ tag: 'circle', cx: 216, cy: 50, r: 10 }, a, 2, { hot: 0, opacity: 0.45 }),
    glowFill({ tag: 'circle', cx: 216, cy: 50, r: 4.5 }, a, { w: 1 }),
    neon(['M8 96 L 30 96', 'M14 108 L 34 108'], a, 2.2, { hot: 0, opacity: 0.6 }),
    neon(shoe, a, 3.4, { fill: true, tint: 0.1 }),
    neon(['M38 126 L 162 126', 'M50 134 L 158 134'], ART.ink, 2.2, { glow: 0.4, hot: 0, opacity: 0.8 }),
    neon(['M82 94 L 90 89', 'M89 100 L 97 94', 'M96 105 L 104 99'], ART.ink, 2.2, { glow: 0.3, hot: 0 }),
    neon('M46 112 Q 90 110 120 118 L 150 120', a, 2, { hot: 0, opacity: 0.7 }),
  ];
}

function semCrew(a: string): ArtNode[] {
  const person = (x: number, y: number, s: number): Shape[] => [
    { tag: 'circle', cx: x, cy: y, r: 13 * s },
    `M${x - 24 * s} ${y + 46 * s} Q ${x - 24 * s} ${y + 18 * s} ${x} ${y + 18 * s} Q ${x + 24 * s} ${y + 18 * s} ${x + 24 * s} ${y + 46 * s}`,
  ];
  return [
    neon(person(66, 60, 0.85), ART.ink2, 2.4, { dash: '3 6', glow: 0.2, hot: 0 }),
    neon(person(174, 60, 0.85), ART.ink2, 2.4, { dash: '3 6', glow: 0.2, hot: 0 }),
    neon(person(120, 46, 1.1), a, 3.4, { fill: true, tint: 0.1 }),
    neon(['M66 52 L 66 68', 'M58 60 L 74 60', 'M174 52 L 174 68', 'M166 60 L 182 60'], a, 2.4, { hot: 0.4 }),
    neon('M40 132 Q 120 120 200 132', ART.ink2, 1.8, { glow: 0, hot: 0, dash: '2 7' }),
  ];
}

function semConexao(a: string): ArtNode[] {
  const arc = (r: number) => `M${pt(120, 118, r, 225)} A ${r} ${r} 0 0 1 ${pt(120, 118, r, 315)}`;
  return [
    glowFill({ tag: 'circle', cx: 120, cy: 118, r: 6 }, a, { w: 1.2 }),
    neon(arc(26), a, 3.4),
    neon(arc(48), a, 3.4, { opacity: 0.55, dash: '22 10' }),
    neon(arc(70), ART.ink2, 2.6, { dash: '4 10', glow: 0.2, hot: 0 }),
    neon(['M178 34 L 194 50', 'M194 34 L 178 50'], ART.ink, 3),
    dashedFloor(),
  ];
}

function semNotificacoes(team: FactionId): ArtNode[] {
  // Mascote do time dormindo (os "Z" já vêm na pose).
  return [pivot(mascotNodes(team, 'dormindo', ART.team[team]), { scale: 0.66, tx: 54, ty: 8 })];
}

function semZonas(a: string): ArtNode[] {
  const region = 'M58 120 Q 46 92 76 76 Q 118 58 160 74 Q 194 90 182 120 Q 164 142 120 140 Q 74 142 58 120 Z';
  return [
    neon(region, ART.ink2, 2.2, { fill: ART.ink2, glow: 0, hot: 0, opacity: 0.08 }),
    neon(region, ART.ink2, 2.2, { dash: '4 8', glow: 0.2, hot: 0, opacity: 0.8 }),
    neon(['M84 100 Q 104 92 120 104', 'M128 92 Q 146 86 160 98'], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.35 }),
    neon('M106 124 Q 120 118 134 124', ART.ink2, 2.2, { hot: 0, glow: 0.3 }),
    neon('M120 122 L 120 48', ART.ink, 3),
    neon('M120 50 L 154 60 L 120 74 Z', a, 2.6, { fill: true, tint: 0.12, dash: '5 5', hot: 0.3 }),
    glowFill({ tag: 'circle', cx: 120, cy: 46, r: 3.4 }, ART.ink, { w: 1 }),
    neon(['M36 60 L 36 70', 'M31 65 L 41 65', 'M196 44 L 196 52', 'M192 48 L 200 48'], ART.ink, 2, { hot: 0.5, opacity: 0.8 }),
  ];
}

function semMedalhas(a: string): ArtNode[] {
  const medal = (cx: number, col: string, op: number, lock: boolean): ArtNode[] => [
    neon(['M' + (cx - 14) + ' 52 L ' + (cx - 5) + ' 78', 'M' + (cx + 14) + ' 52 L ' + (cx + 5) + ' 78'], col, 2, { glow: 0.2, hot: 0, opacity: op * 0.7 }),
    neon(star(cx, 98, 22, 20, 16), col, 2.2, { fill: true, tint: 0.06, dash: '3 4', glow: 0.3, hot: 0, opacity: op }),
    ...(lock
      ? [
          neon({ tag: 'rect', x: cx - 7, y: 98, width: 14, height: 11, rx: 2.5 }, col, 1.8, { fill: true, tint: 0, glow: 0.3, hot: 0, opacity: op }),
          neon(`M${cx - 4} 98 L ${cx - 4} 94 Q ${cx - 4} 89 ${cx} 89 Q ${cx + 4} 89 ${cx + 4} 94 L ${cx + 4} 98`, col, 1.8, { glow: 0.3, hot: 0, opacity: op }),
        ]
      : []),
  ];
  return [
    ...medal(70, ART.ink2, 0.6, true),
    ...medal(170, ART.ink2, 0.6, true),
    ...medal(120, a, 1, true),
    neon(['M30 128 L 210 128'], ART.ink, 2.6, { glow: 0.5, hot: 0.3 }),
    neon(['M36 136 L 204 136'], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.6 }),
    neon(['M40 128 L 40 140', 'M200 128 L 200 140'], ART.ink2, 2, { glow: 0, hot: 0, opacity: 0.6 }),
  ];
}

function semContatos(a: string): ArtNode[] {
  const shield = 'M120 26 L 162 40 Q 162 102 120 132 Q 78 102 78 40 Z';
  return [
    neon(shield, ART.ink, 3.4, { fill: true, tint: 0.06 }),
    neon([{ tag: 'circle', cx: 120, cy: 66, r: 11 }, 'M98 108 Q 98 84 120 84 Q 142 84 142 108'], ART.ink2, 2.4, { dash: '3 5', glow: 0.2, hot: 0 }),
    neon(['M182 42 L 182 62', 'M172 52 L 192 52'], a, 3, { hot: 0.5 }),
    neon(['M44 70 Q 34 84 44 98', mirror('M44 70 Q 34 84 44 98', 120)], ART.ink2, 2, { hot: 0, glow: 0.2, opacity: 0.5 }),
    dashedFloor(146),
  ];
}

function semLocalizacao(a: string, team?: FactionId): ArtNode[] {
  const pin = 'M120 118 Q 96 90 96 70 Q 96 46 120 46 Q 144 46 144 70 Q 144 90 120 118 Z';
  const out: ArtNode[] = [
    neon('M40 140 L 80 128 L 120 140 L 160 128 L 200 140', ART.ink2, 2, { glow: 0, hot: 0, dash: '3 6', opacity: 0.8 }),
    neon({ tag: 'ellipse', cx: 120, cy: 124, rx: 26, ry: 7 }, ART.ink2, 2, { dash: '3 5', glow: 0.2, hot: 0 }),
    neon(['M84 48 Q 74 66 84 84', mirror('M84 48 Q 74 66 84 84', 120), 'M70 38 Q 54 66 70 94', mirror('M70 38 Q 54 66 70 94', 120)], ART.ink2, 2.2, {
      dash: '3 6',
      glow: 0.2,
      hot: 0,
    }),
    neon(pin, a, 3.4, { fill: true, tint: 0.1 }),
    neon({ tag: 'circle', cx: 120, cy: 70, r: 9 }, ART.ink, 2.4, { fill: true, tint: 0, hot: 0.3 }),
  ];
  // O mascote do time espia o mapa no canto (opcional), por cima do mapa.
  if (team) out.push(pivot(mascotNodes(team, 'parado', ART.team[team]), { scale: 0.36, tx: 2, ty: 82 }));
  return out;
}

const cache = new Map<string, ArtNode[]>();

/** `color` é o acento (padrão laranja); `team` escolhe o mascote nos estados que o usam. */
export function emptyNodes(kind: EmptyKind, color: string = ART.orange, team?: FactionId): ArtNode[] {
  return memoArt(cache, `${kind}|${color}|${team ?? ''}`, () => {
    switch (kind) {
      case 'sem-corridas':
        return semCorridas(color);
      case 'sem-crew':
        return semCrew(color);
      case 'sem-conexao':
        return semConexao(color);
      case 'sem-notificacoes':
        return semNotificacoes(team ?? 'owls');
      case 'sem-zonas':
        return semZonas(color);
      case 'sem-medalhas':
        return semMedalhas(color);
      case 'sem-contatos':
        return semContatos(color);
      case 'sem-localizacao':
        return semLocalizacao(color, team);
    }
  });
}
