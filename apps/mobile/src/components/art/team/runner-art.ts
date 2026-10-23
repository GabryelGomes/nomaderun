/**
 * Mascotes de corpo inteiro em corrida (T7.2.8, tela de escolha de time): Lume, Faísca, Breu e Faro em
 * passada, de perfil para a direita, com a cabeça de frente (a mesma dos bustos, em escala) e o corpo de
 * atleta: regata na cor do time com o número de peito (a forma do time), shorts, tênis com sola laranja e o
 * detalhe de cada bicho (cauda com anéis, pompom com raio, asas no lugar dos braços, cauda peluda e bandana).
 * viewBox 240 × 220, chão em y = 210. Puro: só geometria.
 *
 * Os membros são contornos fechados gerados por `limb()` (largura por articulação), então o traço continua
 * geométrico e cada membro tapa o que está atrás (preenchimento escuro), sem filtro nenhum.
 */
import type { FactionId } from '@/domain/types';

import { glowFill, glyph, memoArt, neon, pivot, speedLines, type ArtNode } from '../neon/core';
import { ART, teamShape } from '../neon/palette';
import { faceNodes } from './mascot-art';

export const RUNNER_BOX = { vbW: 240, vbH: 220 } as const;
/**
 * Pivôs (viewBox 240 × 220): `corpo` balança a partir do chão, embaixo do centro de massa; `rastro` são as
 * linhas de velocidade e a sombra (deslizam para trás).
 */
export const RUNNER_PIVOTS = {
  corpo: { x: 128, y: 210 },
  rastro: { x: 60, y: 140 },
} as const;

const W = 3.2;
type P = readonly [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Contorno fechado de um membro ao longo de uma linha com larguras por ponto (cápsula com pontas redondas).
 * As juntas usam a normal média dos 2 segmentos: o joelho e o cotovelo ficam angulosos, no traço do sistema.
 */
export function limb(pts: readonly P[], ws: readonly number[]): string {
  const n = pts.length;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const h = ws[i] / 2;
    left.push(`${r1(pts[i][0] + nx * h)} ${r1(pts[i][1] + ny * h)}`);
    right.push(`${r1(pts[i][0] - nx * h)} ${r1(pts[i][1] - ny * h)}`);
  }
  const hEnd = r1(ws[n - 1] / 2);
  const hStart = r1(ws[0] / 2);
  return `M${left.join(' L ')} A ${hEnd} ${hEnd} 0 0 0 ${right[n - 1]} L ${right.slice(0, -1).reverse().join(' L ')} A ${hStart} ${hStart} 0 0 0 ${left[0]} Z`;
}

/** Tênis de perfil (bico para a direita), com a sola laranja; `rot` inclina o pé em torno do tornozelo. */
function shoe(x: number, y: number, rot: number): ArtNode {
  return pivot(
    [
      neon('M-10 -7 Q -10 -11 -5 -11 L 3 -9 Q 14 -6 17 1 L 17 4 L -11 4 Z', ART.ink, 2.4, { fill: true, tint: 0.04, glow: 0.7 }),
      neon('M-11 5 L 17 5', ART.orange, 2.4, { hot: 0 }),
    ],
    { x: 0, y: 0, rotate: rot, tx: x, ty: y },
  );
}

/** Pontos ao longo de uma curva quadrática (para caudas e asas sem quinas). */
function curve(p0: P, p1: P, p2: P, n: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}

const taper = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));

// ---------------------------------------------------------------- a passada (igual para os 4)
const HIP_F: P = [126, 158];
const HIP_B: P = [116, 156];
const LEG_F: P[] = [HIP_F, [154, 168], [148, 194]];
const LEG_B: P[] = [HIP_B, [100, 180], [74, 188]];
const ARM_F: P[] = [[146, 112], [158, 134], [176, 122]];
const ARM_B: P[] = [[130, 110], [108, 118], [100, 138]];
const TORSO = 'M118 102 Q 138 97 157 106 Q 162 110 158 118 L 142 153 Q 138 161 130 158 L 112 152 Q 104 149 107 141 L 111 116 Q 112 104 118 102 Z';
const SHORTS = 'M108 146 L 138 154 L 140 168 Q 128 172 118 166 L 112 170 Q 102 168 102 160 Z';

/** Cauda/detalhe de cada time (atrás do corpo). */
function tail(team: FactionId, c: string): ArtNode[] {
  switch (team) {
    case 'striders': {
      const pts = curve([110, 154], [52, 160], [60, 98], 9);
      return [
        neon(limb(pts, taper(9, 9, 4)), c, W, { fill: true, tint: 0.08, hot: 0 }),
        glowFill(
          [
            { tag: 'circle', cx: 92, cy: 155, r: 2.2 },
            { tag: 'circle', cx: 72, cy: 148, r: 2 },
            { tag: 'circle', cx: 60, cy: 128, r: 1.8 },
          ],
          c,
          { w: 0.8 },
        ),
        neon('M56 106 L 65 104', ART.orange, 2.4, { hot: 0.4 }),
      ];
    }
    case 'volt':
      return [neon({ tag: 'circle', cx: 104, cy: 150, r: 9 }, c, W, { fill: true, tint: 0.16 }), neon('M100 144 L 106 150 L 101 152 L 108 158', ART.orange, 2, { hot: 0.5 })];
    case 'owls':
      return [neon('M112 148 Q 92 148 78 160 Q 96 168 112 158 Z', c, 2.8, { fill: true, tint: 0.14, hot: 0 }), neon('M108 153 L 88 160', c, 1.6, { glow: 0, hot: 0, opacity: 0.6 })];
    case 'coyotes':
      return [neon('M112 150 C 92 134 64 130 46 146 C 60 148 70 160 84 162 C 94 164 104 162 112 158 Z', c, W, { fill: true, tint: 0.14 }), neon('M46 146 C 52 150 56 154 60 158', ART.orange, 2.4, { hot: 0.4 })];
  }
}

/** Braço (ou asa, no Breu). `front` = o braço da frente, por cima do corpo. */
function arm(team: FactionId, c: string, front: boolean): ArtNode[] {
  if (team === 'owls') {
    // Asas varridas para trás, afinando até a ponta, com 2 penas marcadas na borda de fuga.
    const pts = front ? curve([150, 112], [128, 138], [96, 148], 6) : curve([130, 110], [110, 112], [90, 92], 6);
    const feathers = front ? ['M122 141 L 114 152', 'M110 145 L 102 155'] : ['M108 108 L 98 112', 'M100 102 L 90 104'];
    return [neon(limb(pts, taper(6, front ? 18 : 15, 3)), c, W, { fill: true, tint: front ? 0.14 : 0.08, hot: front ? 0.5 : 0 }), neon(feathers, c, 2, { glow: 0.5, hot: 0, opacity: 0.8 })];
  }
  const pts = front ? ARM_F : ARM_B;
  const end = pts[pts.length - 1];
  return [neon([limb(pts, [11, 9, 8]), { tag: 'circle', cx: end[0], cy: end[1], r: 6.5 }], c, W, { fill: true, tint: front ? 0.12 : 0.06, hot: front ? 0.5 : 0 })];
}

function leg(c: string, front: boolean): ArtNode[] {
  const pts = front ? LEG_F : LEG_B;
  return [neon(limb(pts, [16, 12, 10]), c, W, { fill: true, tint: front ? 0.08 : 0.04, hot: front ? 0.5 : 0 }), front ? shoe(152, 198, 6) : shoe(70, 194, 38)];
}

const cache = new Map<string, { rastro: ArtNode[]; corpo: ArtNode[] }>();

/** Partes animáveis do corredor: `rastro` (linhas de velocidade e sombra) e `corpo` (o resto). */
export function runnerParts(team: FactionId, color: string): { rastro: ArtNode[]; corpo: ArtNode[] } {
  return memoArt(cache, `${team}|${color}`, () => {
    const c = color;
    const face = faceNodes(team, 'parado', c);
    const head = pivot(face, { x: 100, y: 100, scale: 0.6, rotate: 7, tx: 46, ty: -30 });
    const neck = team === 'coyotes' ? [neon('M128 100 L 156 104 L 140 118 Z', ART.orange, 2.4, { fill: true, tint: 0.14 })] : [];
    const rastro: ArtNode[] = [
      glowFill({ tag: 'ellipse', cx: 118, cy: 210, rx: 56, ry: 3.5 }, c, { glow: 0.6, opacity: 0.22 }),
      neon('M20 210 L 230 210', c, 1.8, { hot: 0, opacity: 0.3, dash: '2 8' }),
      speedLines(c, [
        [14, 92, 52],
        [4, 128, 34],
        [22, 176, 50],
      ]),
      speedLines(ART.orange, [[30, 112, 50]], 2, 0.7),
    ];
    const corpo: ArtNode[] = [
      ...tail(team, c),
      ...arm(team, c, false),
      ...leg(c, false),
      neon(TORSO, c, W, { fill: true, tint: 0.16 }),
      neon(SHORTS, ART.ink2, 2.4, { fill: true, tint: 0.06, glow: 0.4, hot: 0 }),
      pivot([neon({ tag: 'rect', x: 124, y: 120, width: 20, height: 16, rx: 3 }, ART.ink, 2, { fill: true, tint: 0, glow: 0.5, hot: 0 }), glowFill(glyph(teamShape(team), 134, 128, 4.4), c, { w: 1.2 })], {
        x: 134,
        y: 128,
        rotate: 16,
      }),
      ...leg(c, true),
      ...neck,
      head,
      ...arm(team, c, true),
    ];
    return { rastro, corpo };
  });
}

/** O corredor inteiro numa árvore só (versão estática). */
export function runnerNodes(team: FactionId, color: string): ArtNode[] {
  const p = runnerParts(team, color);
  return [...p.rastro, ...p.corpo];
}
