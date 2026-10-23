/**
 * Mascotes (busto de emblema esportivo) e emblemas dos 4 times — porte de `docs/melhoria/F1/arte/fonte/times.cjs`.
 * viewBox do mascote 200 × 220; do emblema 200 × 200. Puro: só geometria.
 *
 * O rosto vem separado em 3 camadas (`base`, `olhos`, `topo`) para a E5 animar os olhos sem animar paths.
 */
import type { FactionId } from '@/domain/types';

import { glowFill, glyph, memoArt, mirror, neon, pivot, speedLines, spark, type ArtNode, type PivotOpts } from '../neon/core';
import { ART, teamShape } from '../neon/palette';

export type MascotPose = 'parado' | 'vitoria' | 'derrota' | 'dormindo';
export const MASCOT_POSES: readonly MascotPose[] = ['parado', 'vitoria', 'derrota', 'dormindo'];
export const MASCOT_NAMES: Record<FactionId, string> = { striders: 'Lume', volt: 'Faísca', owls: 'Breu', coyotes: 'Faro' };
export const MASCOT_BOX = { vbW: 200, vbH: 220 } as const;
export const EMBLEM_BOX = { vbW: 200, vbH: 200 } as const;

/**
 * Pivôs (no viewBox 200 × 220) dos grupos que a E5 anima:
 * - `corpo`: o desenho inteiro respira a partir da base do busto;
 * - `cabeca`: gira em torno do pescoço;
 * - `olhos`: piscam (scaleY) em torno da linha dos olhos.
 */
export const MASCOT_PIVOTS = {
  corpo: { x: 100, y: 220 },
  cabeca: { x: 100, y: 150 },
  olhos: { x: 100, y: 100 },
} as const;

const W = 3.6; // traço principal

type Face = { base: ArtNode[]; eyes: ArtNode[]; top: ArtNode[] };
type FaceFn = (pose: MascotPose, c: string) => Face;

const zz = (x: number, y: number, s: number) => `M${x} ${y} L ${x + s} ${y} L ${x} ${y + s} L ${x + s} ${y + s}`;
const sleepEyes = (color: string, w = 2.8): ArtNode => neon(['M64 100 Q 77 107 90 100', mirror('M64 100 Q 77 107 90 100')], color, w);

/** Busto comum: ombros, regata e número de peito com a forma do time. */
function bust(c: string, shape: ReturnType<typeof teamShape>, extra: ArtNode[]): ArtNode[] {
  const sh = 'M80 150 C 78 166 66 172 48 176 C 34 180 24 190 20 220';
  const strap = 'M62 174 C 70 190 74 204 76 220';
  return [
    neon([`${sh} L 180 220 C 176 190 166 180 152 176 C 134 172 122 166 120 150 Z`], c, W, { fill: true, tint: 0.06, glow: 0.6, hot: 0 }),
    neon([sh, mirror(sh)], c, W, { glow: 0.8 }),
    neon([strap, mirror(strap)], ART.ink, 2, { glow: 0.4, hot: 0, opacity: 0.55 }),
    ...extra,
    neon({ tag: 'rect', x: 82, y: 186, width: 36, height: 26, rx: 4 }, ART.ink, 2.2, { fill: true, tint: 0, glow: 0.5, hot: 0 }),
    glowFill(glyph(shape, 100, 199, 7), c, { w: 1.5 }),
  ];
}

/** Aura: a forma do time grande e apagada atrás da cabeça (forma + cor: não depende só da cor). */
function aura(c: string, shape: ReturnType<typeof teamShape>): ArtNode {
  return neon(glyph(shape, 100, 100, 84), c, 2.2, { glow: 0.9, hot: 0, opacity: 0.35 });
}

// ---------------------------------------------------------------- rostos

const lume: FaceFn = (pose, c) => {
  const earL = 'M56 84 C 46 72 46 52 60 46 C 72 42 82 50 84 62';
  const earIn = 'M58 70 C 55 62 58 54 64 53';
  const head = 'M100 58 C 120 58 136 63 144 74 L 154 96 C 157 110 152 122 144 130 C 134 142 118 150 100 152 C 82 150 66 142 56 130 C 48 122 43 110 46 96 L 56 74 C 64 63 80 58 100 58 Z';
  const tuft = 'M48 110 L 34 114 L 45 120 L 36 128 L 50 131';
  let eyeL: string;
  let brow: string;
  let pupilY = 99;
  let mouth: string[];
  if (pose === 'vitoria') {
    eyeL = 'M62 98 Q 76 86 90 98';
    brow = 'M60 82 L 88 84';
    mouth = ['M84 132 Q 100 152 116 132 Z'];
  } else if (pose === 'derrota') {
    eyeL = 'M64 98 L 90 102 Q 78 108 66 104 Z';
    brow = 'M62 86 L 88 89';
    pupilY = 104;
    mouth = ['M88 134 Q 100 150 112 134 Q 100 138 88 134 Z'];
  } else if (pose === 'dormindo') {
    eyeL = '';
    brow = 'M62 86 L 88 89';
    mouth = ['M100 129 L 100 134', 'M90 136 C 95 140 105 140 110 136'];
  } else {
    eyeL = 'M62 92 L 90 100 Q 78 108 66 102 Z';
    brow = 'M58 82 L 90 92';
    mouth = ['M100 129 L 100 134', 'M86 135 C 92 142 98 140 100 134 C 102 140 108 142 115 133'];
  }
  const closed = pose === 'vitoria';
  const spots = [
    { tag: 'circle' as const, cx: 100, cy: 69, r: 3 },
    { tag: 'circle' as const, cx: 90, cy: 73, r: 2 },
    { tag: 'circle' as const, cx: 110, cy: 73, r: 2 },
    { tag: 'circle' as const, cx: 58, cy: 116, r: 2.2 },
    { tag: 'circle' as const, cx: 142, cy: 116, r: 2.2 },
    { tag: 'circle' as const, cx: 64, cy: 126, r: 1.6 },
    { tag: 'circle' as const, cx: 136, cy: 126, r: 1.6 },
  ];
  const eyes: ArtNode[] =
    pose === 'dormindo'
      ? [sleepEyes(ART.ink)]
      : [
          neon([eyeL, mirror(eyeL)], ART.ink, 2.6, { fill: closed ? undefined : true, tint: 0 }),
          ...(closed ? [] : [glowFill([{ tag: 'circle', cx: 81, cy: pupilY, r: 4.6 }, { tag: 'circle', cx: 119, cy: pupilY, r: 4.6 }], c, { w: 1.2 })]),
        ];
  return {
    base: [
      neon([earL, mirror(earL)], c, W, { fill: true }),
      neon([earIn, mirror(earIn)], ART.orange, 2.2, { hot: 0 }),
      neon([tuft, mirror(tuft)], c, 2.6, { hot: 0 }),
      neon(head, c, W, { fill: true }),
      glowFill(spots, c, { w: 1 }),
    ],
    eyes,
    top: [
      neon([brow, mirror(brow)], c, 3.4),
      neon(['M88 106 C 86 116 84 124 86 132', mirror('M88 106 C 86 116 84 124 86 132')], ART.orange, 2.6),
      glowFill('M91 120 L 109 120 L 100 129 Z', ART.ink, { w: 1 }),
      neon(mouth, ART.ink, 2.4, { fill: pose === 'vitoria' || pose === 'derrota' ? ART.dark.striders : undefined }),
      glowFill(
        [
          { tag: 'circle', cx: 84, cy: 128, r: 1.1 },
          { tag: 'circle', cx: 80, cy: 124, r: 1.1 },
          { tag: 'circle', cx: 116, cy: 128, r: 1.1 },
          { tag: 'circle', cx: 120, cy: 124, r: 1.1 },
        ],
        ART.ink,
        { glow: 0, w: 0.4, opacity: 0.7 },
      ),
    ],
  };
};

const faisca: FaceFn = (pose, c) => {
  const droop = pose === 'derrota' || pose === 'dormindo';
  const earL = droop ? 'M80 72 L 50 30 Q 48 22 56 22 L 94 64' : 'M80 72 L 66 14 Q 70 6 78 10 L 96 64';
  const earR = droop ? 'M108 64 L 132 40 L 160 44 Q 164 50 158 52 L 136 56 L 122 72' : 'M106 64 L 122 20 L 140 6 Q 147 10 142 16 L 130 30 L 122 72';
  const boltL = droop ? 'M60 34 L 72 44 L 66 48 L 82 58' : 'M73 24 L 81 38 L 75 41 L 86 58';
  const boltR = droop ? 'M138 50 L 128 54 L 132 58 L 120 64' : 'M126 32 L 119 44 L 125 47 L 116 62';
  const face = 'M62 74 Q 100 62 138 74 L 150 100 Q 142 122 112 148 L 100 154 L 88 148 Q 58 122 50 100 Z';
  let eyes: ArtNode[];
  let brow: string;
  let mouth: string;
  if (pose === 'vitoria') {
    eyes = [neon(['M66 100 Q 78 86 90 100', mirror('M66 100 Q 78 86 90 100')], ART.ink, 2.8)];
    brow = 'M64 80 Q 76 72 90 78';
    mouth = 'M80 122 Q 100 130 122 120 Q 116 150 100 150 Q 84 148 80 122 Z';
  } else if (pose === 'derrota') {
    eyes = [
      neon([{ tag: 'ellipse', cx: 78, cy: 102, rx: 10, ry: 8 }, { tag: 'ellipse', cx: 122, cy: 102, rx: 10, ry: 8 }], ART.ink, 2.6, { fill: true, tint: 0 }),
      glowFill([{ tag: 'circle', cx: 78, cy: 106, r: 4 }, { tag: 'circle', cx: 122, cy: 106, r: 4 }], c, { w: 1.2 }),
      neon(['M67 99 L 89 97', 'M111 97 L 133 99'], c, 3),
    ];
    brow = 'M66 86 L 88 88';
    mouth = 'M88 128 Q 100 132 112 127 Q 108 142 100 142 Q 92 142 88 128 Z';
  } else if (pose === 'dormindo') {
    eyes = [sleepEyes(ART.ink)];
    brow = 'M66 86 L 88 88';
    mouth = 'M90 128 Q 100 133 110 128';
  } else {
    const eye = 'M90 98 L 62 89 Q 63 106 80 107 Q 89 105 90 98 Z';
    eyes = [
      neon([eye, mirror(eye)], ART.ink, 2.6, { fill: true, tint: 0 }),
      glowFill([{ tag: 'circle', cx: 80, cy: 99, r: 5 }, { tag: 'circle', cx: 124, cy: 99, r: 5 }], c, { w: 1.2 }),
      glowFill([{ tag: 'circle', cx: 82.5, cy: 96.5, r: 1.5 }, { tag: 'circle', cx: 126.5, cy: 96.5, r: 1.5 }], ART.ink, { w: 0.6, glow: 0 }),
    ];
    brow = 'M60 80 Q 76 76 90 86';
    mouth = 'M82 123 Q 100 131 121 120 Q 113 141 98 141 Q 86 139 82 123 Z';
  }
  const teeth = pose === 'parado' || pose === 'vitoria';
  return {
    base: [neon([earL, earR], c, W, { fill: true }), neon([boltL, boltR], ART.orange, 2.4), neon(face, c, W, { fill: true })],
    eyes,
    top: [
      neon([brow, mirror(brow)], c, 3.2),
      glowFill('M95 117 L 105 117 L 100 123 Z', ART.ink, { w: 1 }),
      neon(mouth, ART.ink, 2.4, { fill: pose === 'parado' || pose === 'vitoria' ? ART.dark.volt : undefined }),
      ...(teeth
        ? [
            glowFill([`M95 ${pose === 'vitoria' ? 127 : 127.5} L 105 ${pose === 'vitoria' ? 127 : 126.5} L 105 133 Q 100 134.5 95 133 Z`], ART.ink, { w: 0.6, glow: 0.4 }),
            neon('M100 127 L 100 133.5', ART.panel, 1, { glow: 0, hot: 0 }),
          ]
        : []),
      neon(['M58 116 L 40 112 L 46 118 L 34 120', mirror('M58 116 L 40 112 L 46 118 L 34 120')], c, 2, { hot: 0, opacity: 0.85 }),
    ],
  };
};

function glyphD(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r * 1.3} L${cx + r * 0.8} ${cy} L${cx} ${cy + r * 1.3} L${cx - r * 0.8} ${cy} Z`;
}

const breu: FaceFn = (pose, c) => {
  const head = 'M100 58 L 122 46 L 138 30 L 148 18 L 146 38 L 154 32 L 148 58 L 156 92 Q 152 130 100 164 Q 48 130 44 92 L 52 58 L 46 32 L 54 38 L 52 18 L 62 30 L 78 46 Z';
  const ring = (x: number) => `M${x} 76 L ${x + 22} 98 L ${x} 120 L ${x - 22} 98 Z`;
  let eyes: ArtNode[];
  let brow: string;
  let beakY = 0;
  if (pose === 'vitoria') {
    eyes = [neon(['M66 102 Q 78 88 90 102', mirror('M66 102 Q 78 88 90 102')], ART.orange, 3)];
    brow = 'M54 78 L 96 84';
  } else if (pose === 'derrota') {
    eyes = [
      glowFill([{ tag: 'circle', cx: 78, cy: 100, r: 9 }, { tag: 'circle', cx: 122, cy: 100, r: 9 }], ART.orange, { w: 1.2, glow: 0.5 }),
      neon(['M66 98 L 90 98', 'M110 98 L 134 98'], c, 3.4, { fill: true }),
      glowFill(['M70 92 L 90 92 L 90 98 L 66 98 Z', 'M110 92 L 130 92 L 134 98 L 110 98 Z'], ART.panel, { glow: 0, w: 0.5 }),
    ];
    brow = 'M56 86 L 96 89';
    beakY = 2;
  } else if (pose === 'dormindo') {
    eyes = [sleepEyes(ART.orange, 3)];
    brow = 'M56 86 L 96 89';
    beakY = 2;
  } else {
    eyes = [
      glowFill([{ tag: 'circle', cx: 78, cy: 99, r: 10 }, { tag: 'circle', cx: 122, cy: 99, r: 10 }], ART.orange, { w: 1.4 }),
      glowFill([glyphD(80, 100, 4.2), glyphD(124, 100, 4.2)], ART.panel, { glow: 0, w: 0.5 }),
      neon(['M64 93 L 92 95', 'M108 95 L 136 93'], c, 3.2),
      glowFill([{ tag: 'circle', cx: 74, cy: 102, r: 1.4 }, { tag: 'circle', cx: 118, cy: 102, r: 1.4 }], ART.ink, { glow: 0, w: 0.4 }),
    ];
    brow = 'M52 76 L 98 90';
  }
  return {
    base: [
      neon(head, c, W, { fill: true }),
      neon(['M54 30 L 66 52', mirror('M54 30 L 66 52')], c, 2, { hot: 0, opacity: 0.7 }),
      neon([ring(78), ring(122)], c, 2.4, { fill: true, tint: 0.16, hot: 0.3 }),
    ],
    eyes,
    top: [
      neon([brow, mirror(brow)], c, 4),
      glowFill(`M100 ${106 + beakY} L 107 ${116 + beakY} L 100 ${130 + beakY} L 93 ${116 + beakY} Z`, ART.ink, { w: 1 }),
      neon(['M70 136 L 80 142 L 90 136', 'M110 136 L 120 142 L 130 136', 'M90 148 L 100 154 L 110 148'], c, 2, { hot: 0, opacity: 0.6 }),
    ],
  };
};

const faro: FaceFn = (pose, c) => {
  const droop = pose === 'derrota' || pose === 'dormindo';
  const earL = droop ? 'M58 78 L 30 40 L 86 60' : 'M58 78 L 48 16 L 90 58';
  const earR = droop ? 'M142 78 L 168 44 L 160 50 L 166 38 L 114 60' : 'M142 78 L 147 42 L 140 37 L 152 16 L 110 58';
  const inL = droop ? 'M60 66 L 42 46 L 74 60' : 'M60 64 L 54 32 L 78 56';
  const head = 'M70 58 L 130 58 L 152 84 L 150 106 L 124 120 L 114 150 L 86 150 L 76 120 L 50 106 L 48 84 Z';
  const ruff = 'M52 100 L 36 106 L 48 111 L 38 120 L 60 116';
  let eyes: ArtNode[];
  let browL: string;
  let browR: string;
  let mouth: ArtNode[];
  if (pose === 'vitoria') {
    eyes = [neon(['M64 98 Q 76 86 90 98', mirror('M64 98 Q 76 86 90 98')], ART.ink, 2.8)];
    browL = 'M60 82 L 90 86';
    browR = mirror(browL);
    mouth = [
      neon('M84 139 Q 100 147 118 137 Q 112 152 100 152 Q 88 151 84 139 Z', ART.ink, 2.4, { fill: ART.dark.coyotes }),
      neon('M109 143 L 111 149 L 114 141', ART.ink, 1.8, { glow: 0.3, hot: 0 }),
    ];
  } else if (pose === 'derrota') {
    eyes = [
      neon(['M64 98 L 90 100 L 86 106 L 68 104 Z', mirror('M64 98 L 90 100 L 86 106 L 68 104 Z')], ART.ink, 2.4, { fill: true, tint: 0 }),
      glowFill([{ tag: 'rect', x: 74, y: 100, width: 5, height: 5 }, { tag: 'rect', x: 121, y: 100, width: 5, height: 5 }], c, { w: 1 }),
    ];
    browL = 'M62 88 L 88 90';
    browR = mirror(browL);
    mouth = [neon('M88 140 Q 100 144 112 139 Q 108 152 100 152 Q 92 152 88 140 Z', ART.ink, 2.4, { fill: ART.dark.coyotes })];
  } else if (pose === 'dormindo') {
    eyes = [sleepEyes(ART.ink)];
    browL = 'M62 88 L 88 90';
    browR = mirror(browL);
    mouth = [neon('M88 141 Q 100 145 112 140', ART.ink, 2.4)];
  } else {
    eyes = [
      neon(['M62 92 L 90 99 L 85 106 L 67 102 Z', 'M138 94 L 110 99 L 115 106 L 133 102 Z'], ART.ink, 2.4, { fill: true, tint: 0 }),
      glowFill([{ tag: 'rect', x: 74, y: 98, width: 6, height: 6, rx: 1 }, { tag: 'rect', x: 120, y: 98, width: 6, height: 6, rx: 1 }], c, { w: 1 }),
    ];
    browL = 'M58 82 L 90 90';
    browR = 'M108 88 Q 124 76 142 82';
    mouth = [neon('M86 142 Q 100 147 118 137', ART.ink, 2.4), neon('M109 141.5 L 111 148 L 114 139.5', ART.ink, 1.8, { glow: 0.3, hot: 0 })];
  }
  return {
    base: [
      neon([earL, earR], c, W, { fill: true }),
      neon([inL, mirror(inL)], ART.orange, 2.2, { hot: 0 }),
      neon([ruff, mirror(ruff)], c, 2.6, { hot: 0 }),
      neon(head, c, W, { fill: true }),
      neon(['M84 106 L 89 126', 'M116 106 L 111 126'], c, 2.2, { hot: 0, opacity: 0.75 }),
    ],
    eyes,
    top: [neon([browL, browR], c, 3.4), glowFill({ tag: 'rect', x: 91, y: 125, width: 18, height: 11, rx: 3.5 }, ART.ink, { w: 1 }), ...mouth],
  };
};

const FACES: Record<FactionId, FaceFn> = { striders: lume, volt: faisca, owls: breu, coyotes: faro };

function bandana(): ArtNode[] {
  return [
    neon('M72 157 L 128 157 L 100 186 Z', ART.orange, 2.6, { fill: true, tint: 0.12 }),
    glowFill(
      [
        { tag: 'rect', x: 90, y: 161, width: 5, height: 5 },
        { tag: 'rect', x: 105, y: 161, width: 5, height: 5 },
        { tag: 'rect', x: 97.5, y: 170, width: 5, height: 5 },
      ],
      ART.orange,
      { w: 0.8, glow: 0.4 },
    ),
  ];
}

function feathers(c: string): ArtNode[] {
  return [neon(['M84 168 L 100 176 L 116 168', 'M88 178 L 100 184 L 112 178'], c, 2.2, { hot: 0, opacity: 0.7 })];
}

/** Efeitos de pose ao redor do busto. */
function poseFx(c: string, pose: MascotPose): ArtNode[] {
  if (pose === 'vitoria') {
    const rays: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (-170 + i * 17.8) * (Math.PI / 180);
      const r1 = 82;
      const r2 = i % 2 ? 90 : 97;
      rays.push(`M${(100 + Math.cos(a) * r1).toFixed(1)} ${(104 + Math.sin(a) * r1).toFixed(1)} L${(100 + Math.cos(a) * r2).toFixed(1)} ${(104 + Math.sin(a) * r2).toFixed(1)}`);
    }
    return [neon(rays, c, 2.6, { hot: 0.4 }), spark(28, 52, 7, ART.orange), spark(172, 40, 5, ART.ink), spark(176, 130, 6, ART.orange)];
  }
  if (pose === 'dormindo') return [neon([zz(176, 22, 11), zz(190, 4, 7)], ART.ink, 2.4, { hot: 0.4 })];
  if (pose === 'derrota') {
    return [
      neon('M150 64 Q 156 74 150 80 Q 144 74 150 64 Z', ART.ink, 1.8, { glow: 0.4, opacity: 0.8 }),
      neon(['M150 140 Q 158 136 164 140', 'M154 150 Q 164 146 172 150'], ART.ink, 2, { glow: 0.3, hot: 0, opacity: 0.6 }),
    ];
  }
  return [
    speedLines(c, [
      [6, 70, 30],
      [2, 92, 22],
      [10, 136, 28],
    ]),
  ];
}

export type MascotParts = {
  /** Aura, efeitos da pose e busto (fica parado). */
  back: ArtNode[];
  /** Cabeça em 3 camadas; `tilt` é a inclinação estática da pose em torno de `MASCOT_PIVOTS.cabeca`. */
  head: Face;
  tilt: PivotOpts;
  /** Opacidade geral (a derrota fica um pouco apagada). */
  dim: number;
  /** Olhos abertos (a pose pode piscar). */
  eyesOpen: boolean;
};

const partsCache = new Map<string, MascotParts>();

export function mascotParts(team: FactionId, pose: MascotPose, color: string): MascotParts {
  return memoArt(partsCache, `${team}|${pose}|${color}`, () => {
    const shape = teamShape(team);
    const extra = team === 'coyotes' ? bandana() : team === 'owls' ? feathers(color) : [];
    const tilt: PivotOpts =
      pose === 'vitoria' ? { rotate: -6 } : pose === 'derrota' ? { rotate: 5, ty: 6 } : pose === 'dormindo' ? { rotate: 9, ty: 4 } : { rotate: -3 };
    return {
      back: [aura(color, shape), ...poseFx(color, pose), ...bust(color, shape, extra)],
      head: FACES[team](pose, color),
      tilt: { x: MASCOT_PIVOTS.cabeca.x, y: MASCOT_PIVOTS.cabeca.y, ...tilt },
      dim: pose === 'derrota' ? 0.82 : 1,
      eyesOpen: pose === 'parado' || pose === 'derrota',
    };
  });
}

/** O mascote inteiro numa árvore só (versão estática, uma camada). */
export function mascotNodes(team: FactionId, pose: MascotPose, color: string): ArtNode[] {
  const p = mascotParts(team, pose, color);
  return [pivot([...p.back, pivot([...p.head.base, ...p.head.eyes, ...p.head.top], p.tilt)], { opacity: p.dim })];
}

/** Faixa do emblema completo (o nome entra por `Text` por cima, fora do SVG). */
export const EMBLEM_BAND = { x: 34, y: 168, width: 132, height: 26 } as const;

/** Emblema: moldura com a forma do time + cabeça do mascote + (no completo) a faixa do nome. */
export function emblemNodes(team: FactionId, color: string, compact: boolean): ArtNode[] {
  const shape = teamShape(team);
  const frames = {
    circulo: [
      { tag: 'circle' as const, cx: 100, cy: 96, r: 82 },
      { tag: 'circle' as const, cx: 100, cy: 96, r: 72 },
    ],
    triangulo: ['M100 6 L 190 166 L 10 166 Z', 'M100 26 L 172 156 L 28 156 Z'],
    losango: ['M100 4 L 188 96 L 100 188 L 12 96 Z', 'M100 20 L 172 96 L 100 172 L 28 96 Z'],
    quadrado: [
      { tag: 'rect' as const, x: 18, y: 14, width: 164, height: 164, rx: 18 },
      { tag: 'rect' as const, x: 30, y: 26, width: 140, height: 140, rx: 12 },
    ],
  }[shape];
  const headScale = { circulo: 0.8, triangulo: 0.64, losango: 0.7, quadrado: 0.78 }[shape];
  const headTy = { circulo: -4, triangulo: 22, losango: -2, quadrado: -6 }[shape];
  const face = FACES[team]('parado', color);
  return [
    neon(frames[0], color, 4, { fill: true, tint: 0.08 }),
    neon(frames[1], color, 2, { hot: 0, opacity: 0.6 }),
    pivot([...face.base, ...face.eyes, ...face.top], { x: 100, y: 100, scale: headScale, ty: headTy }),
    ...(compact ? [] : [neon({ tag: 'rect', ...EMBLEM_BAND, rx: 5 }, ART.orange, 2.6, { fill: true, tint: 0.14 })]),
  ];
}
