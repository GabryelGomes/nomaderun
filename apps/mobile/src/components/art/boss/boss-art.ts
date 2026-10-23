/**
 * Chefões da Raid — porte de `docs/melhoria/F1/arte/fonte/chefoes.cjs` (Mormaço e Paredão, 4 estados) e os
 * estados que faltavam de Soneca, Rei Buzina e Fuligem, mais as camadas de dano 0/1/2. viewBox 240 × 240,
 * chão em y = 228.
 *
 * Regra da família: contorno violeta (só vilões) + 1 material (laranja, branco ou cinza) + olhos brancos
 * incandescentes. Estados: `parado`, `golpe` (flash, olhos espremidos, impacto), `furioso` (brasa, tremor,
 * presas) e `derrotado` (caído, olhos em X, peças soltas, 62% de opacidade). Puro: só geometria.
 */
import { glowFill, memoArt, mirror, neon, pivot, plain, pt, spark, star, type ArtNode, type PivotOpts } from '../neon/core';
import { ART, mix } from '../neon/palette';

export type BossId = 'soneca' | 'rei-buzina' | 'fuligem' | 'mormaco' | 'paredao';
export type BossState = 'parado' | 'golpe' | 'furioso' | 'derrotado';
export type BossDamage = 0 | 1 | 2;

export const BOSS_IDS: readonly BossId[] = ['soneca', 'rei-buzina', 'fuligem', 'mormaco', 'paredao'];
export const BOSS_STATES: readonly BossState[] = ['parado', 'golpe', 'furioso', 'derrotado'];
export const BOSS_NAMES: Record<BossId, string> = { soneca: 'Soneca', 'rei-buzina': 'Rei Buzina', fuligem: 'Fuligem', mormaco: 'Mormaço', paredao: 'Paredão' };
export const BOSS_STATE_LABELS: Record<BossState, string> = { parado: 'parado', golpe: 'levando um golpe', furioso: 'furioso', derrotado: 'derrotado' };
export const BOSS_BOX = { vbW: 240, vbH: 240 } as const;

/**
 * Pivôs (viewBox 240 × 240) para a E5: `corpo` flutua e treme a partir do chão; `raios` (só o Mormaço)
 * giram em torno do centro do sol.
 */
export const BOSS_PIVOTS = {
  corpo: { x: 120, y: 228 },
  raios: { x: 120, y: 112 },
} as const;

export type BossParts = {
  /** Chão, impacto, tremor e fumaça: não se movem com o corpo. */
  back: ArtNode[];
  /** Raios do Mormaço (camada própria para girar); vazio nos outros. */
  raios: ArtNode[];
  /** Corpo, rosto e dano. */
  corpo: ArtNode[];
  /** Transformação estática do estado (inclinação do golpe, queda do derrotado), aplicada a raios e corpo. */
  pose?: PivotOpts & { opacity?: number };
};

type Ctx = { V: string; state: BossState; dano: BossDamage; fur: boolean; hit: boolean; down: boolean; body: string };

const m = (d: string) => mirror(d, 120);
const HOT = ART.ember;

function zz(x: number, y: number, s: number): string {
  return `M${x} ${y} L ${x + s} ${y} L ${x} ${y + s} L ${x + s} ${y + s}`;
}
function puff(cx: number, cy: number, r: number, op = 0.7): ArtNode {
  return neon(
    [
      { tag: 'circle', cx, cy, r },
      { tag: 'circle', cx: cx + r * 0.9, cy: cy + r * 0.2, r: r * 0.7 },
      { tag: 'circle', cx: cx - r * 0.9, cy: cy + r * 0.3, r: r * 0.6 },
    ],
    ART.ink2,
    2,
    { fill: true, tint: 0.05, glow: 0.4, hot: 0, opacity: op },
  );
}
function ground(V: string, op = 0.35): ArtNode {
  return neon('M30 228 L 210 228', V, 2, { hot: 0, opacity: op, dash: '2 8' });
}
/** Impacto do golpe: estrela + estilhaços no ponto onde o golpe acerta. */
function impact(cx: number, cy: number): ArtNode[] {
  return [
    glowFill(star(cx, cy, 22, 9, 8, 10), ART.ink, { w: 1.2 }),
    neon(star(cx, cy, 34, 16, 8, 32), ART.orange, 2.6, { hot: 0.5 }),
    spark(cx + 40, cy - 22, 6, ART.orange),
    spark(cx - 10, cy + 40, 5, ART.ink),
  ];
}
function xEyes(x1: number, x2: number, y: number, s = 8): ArtNode {
  const x = (cx: number) => [`M${cx - s} ${y - s} L ${cx + s} ${y + s}`, `M${cx + s} ${y - s} L ${cx - s} ${y + s}`];
  return neon([...x(x1), ...x(x2)], ART.ink, 3.4, { glow: 0.6 });
}
function squint(x1: number, x2: number, y: number): ArtNode {
  return neon([`M${x1 - 10} ${y - 7} L ${x1 + 8} ${y} L ${x1 - 10} ${y + 7}`, `M${x2 + 10} ${y - 7} L ${x2 - 8} ${y} L ${x2 + 10} ${y + 7}`], ART.ink, 3.6);
}
function shake(op = 0.8): ArtNode {
  return neon(['M14 92 Q 8 104 14 116', 'M6 100 Q 0 112 6 124', m('M14 92 Q 8 104 14 116'), m('M6 100 Q 0 112 6 124')], ART.ink, 2.4, { hot: 0, opacity: op });
}
/** Rachadura: um sulco escuro e o traço aceso por cima. */
function crack(paths: string[], color: string): ArtNode[] {
  return [plain(paths, ART.bg, 5.6), neon(paths, color, 2.4, { glow: 1, hot: 0.7 })];
}
/** Lasca solta (quadradinho caindo). */
function chip(x: number, y: number, s: number, r: number, color: string): ArtNode {
  return pivot([neon({ tag: 'rect', x, y, width: s, height: s }, color, 1.8, { fill: true, hot: 0, glow: 0.5 })], { x, y, rotate: r });
}
/** Camadas de dano: `n1` entra no dano 1; `n1` + `n2` no dano 2. */
function damage(dano: BossDamage, n1: ArtNode[], n2: ArtNode[]): ArtNode[] {
  return dano >= 2 ? [...n1, ...n2] : dano === 1 ? n1 : [];
}
const HIT_POSE: PivotOpts = { x: 120, y: 224, rotate: 6, tx: 6, ty: 2, scale: 0.92 };
const DOWN_POSE = { x: 120, y: 180, rotate: 14, ty: 34, scale: 0.86, opacity: 0.62 };

// ---------------------------------------------------------------- Mormaço (calor)
function mormaco(k: Ctx): BossParts {
  const cx = 120;
  const cy = 112;
  const R0 = 64;
  const { fur, hit, down, body, V } = k;
  const accent = fur ? HOT : hit ? mix(ART.orange, ART.white, 0.55) : ART.orange;
  const rays: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (down && i % 2) continue;
    const a = -90 + i * 30;
    const R = down ? 82 : fur ? (i % 2 ? 100 : 112) : i % 2 ? 92 : 102;
    rays.push(`M${pt(cx, cy, R0, a - 10)} L ${pt(cx, cy, R, a + (fur ? 12 : 8))} L ${pt(cx, cy, R0, a + 10)}`);
  }
  let face: ArtNode[];
  if (down) {
    face = [xEyes(100, 140, 104, 7), neon('M98 132 Q 109 126 120 132 Q 131 138 142 132', body, 3)];
  } else if (hit) {
    face = [squint(100, 140, 104), neon('M94 132 L 102 127 L 110 134 L 118 127 L 126 134 L 134 127 L 144 132', ART.ink, 2.6)];
  } else {
    const eye = fur ? 'M84 95 L 113 104 L 108 117 L 88 113 Z' : 'M86 98 L 112 106 L 106 113 L 90 110 Z';
    const brow = fur ? 'M76 80 L 120 100' : 'M78 88 L 120 100';
    face = [
      neon([brow, m(brow)], body, 5.2),
      neon([eye, m(eye)], body, 2.6, { fill: true, tint: 0 }),
      glowFill([eye, m(eye)], mix(ART.ink, V, 0.15), { w: 0.6, glow: 0.4, opacity: 0.95 }),
      glowFill(
        [
          { tag: 'circle', cx: 104, cy: fur ? 108 : 107, r: 3 },
          { tag: 'circle', cx: 136, cy: fur ? 108 : 107, r: 3 },
        ],
        V,
        { w: 0.8, glow: 0 },
      ),
      ...(fur
        ? [
            neon('M88 124 Q 120 172 152 124 Q 120 134 88 124 Z', body, 3, { fill: ART.dark.villain }),
            neon(['M98 128 L 102 140 L 106 129', 'M134 129 L 138 140 L 142 128'], ART.ink, 2.2, { hot: 0.4 }),
          ]
        : [
            neon('M88 126 Q 120 148 152 126 Q 120 137 88 126 Z', body, 3, { fill: ART.dark.villain }),
            neon('M96 129 L 101 134 L 106 131 L 111 136 L 116 132 L 121 137 L 126 132 L 131 136 L 136 131 L 141 134 L 146 129', ART.ink, 1.8, { hot: 0.4 }),
          ]),
    ];
  }
  const cuts = [150, 158, 165].map((y, i) => {
    const hc = Math.sqrt(R0 * R0 - (y - cy) * (y - cy)) - 6;
    return plain(`M${(cx - hc).toFixed(1)} ${y} L ${(cx + hc).toFixed(1)} ${y}`, ART.bg, 2.2 + i * 1.4);
  });
  const crackC = fur ? HOT : ART.orange;
  const corpo: ArtNode[] = [
    neon({ tag: 'circle', cx, cy, r: R0 }, accent, 4.2, { fill: true, tint: fur ? 0.22 : 0.16, glow: fur ? 1.4 : 1 }),
    neon({ tag: 'circle', cx, cy, r: R0 - 10 }, body, 1.8, { hot: 0, opacity: 0.5, dash: '3 7' }),
    ...cuts,
    ...(down ? [] : damage(k.dano, crack(['M152 64 L 140 84 L 154 94 L 144 108', 'M140 84 L 128 82'], crackC), [...crack(['M70 90 L 86 100 L 78 114 L 88 124', 'M86 100 L 96 96'], crackC), chip(176, 54, 6, 25, accent)])),
    ...face,
    ...(down ? [plain('M150 66 L 140 84 L 152 92 L 142 110', ART.bg, 4), neon('M150 66 L 140 84 L 152 92 L 142 110', body, 1.6, { glow: 0.6, hot: 0 })] : []),
  ];
  const raios = [neon(rays, accent, 3.4, { fill: true, tint: 0.14, glow: fur ? 1.4 : 1 })];
  if (down) {
    return {
      back: [ground(V), neon(['M34 224 L 52 214 L 58 224', 'M176 226 L 196 220 L 194 228'], ART.orange, 2.6, { opacity: 0.6, hot: 0 }), puff(84, 30, 9, 0.5), puff(150, 20, 7, 0.4)],
      raios,
      corpo,
      pose: DOWN_POSE,
    };
  }
  if (hit) return { back: [ground(V), ...impact(48, 60)], raios, corpo, pose: { x: cx, y: 180, rotate: 7, tx: 6, ty: 2, scale: 0.92 } };
  if (fur) {
    const waves = ['M44 70 Q 36 60 44 50 Q 52 40 44 30', 'M196 70 Q 188 60 196 50 Q 204 40 196 30'];
    return { back: [ground(V), shake(), neon(waves, HOT, 2.4, { hot: 0, opacity: 0.7 })], raios, corpo, pose: { x: cx, y: 118, scale: 0.92 } };
  }
  return { back: [ground(V)], raios, corpo };
}

// ---------------------------------------------------------------- Paredão (concreto)
function paredao(k: Ctx): BossParts {
  const { fur, hit, down, body, V } = k;
  const crackC = fur ? HOT : ART.orange;
  if (down) {
    const blocks = [
      { x: 40, y: 196, w: 46, h: 28, r: -8 },
      { x: 92, y: 200, w: 58, h: 26, r: 3 },
      { x: 156, y: 194, w: 44, h: 30, r: 10 },
      { x: 66, y: 172, w: 40, h: 26, r: 14 },
      { x: 134, y: 170, w: 42, h: 26, r: -12 },
      { x: 18, y: 214, w: 20, h: 12, r: 20 },
      { x: 204, y: 212, w: 18, h: 14, r: -18 },
    ];
    const corpo: ArtNode[] = blocks.map((b) =>
      pivot([neon({ tag: 'rect', x: b.x, y: b.y, width: b.w, height: b.h, rx: 3 }, body, 3.2, { fill: true, glow: 0.6 })], { x: b.x + b.w / 2, y: b.y + b.h / 2, rotate: b.r }),
    );
    const head = [
      neon('M96 134 L 144 134 L 148 172 L 92 172 Z', body, 3.6, { fill: true, glow: 0.6 }),
      xEyes(108, 132, 150, 6),
      neon(['M74 172 L 66 150', 'M164 170 L 176 152'], ART.orange, 2.4, { opacity: 0.6, hot: 0 }),
    ];
    corpo.push(pivot(head, { x: 120, y: 152, rotate: -16, opacity: 0.7 }));
    return { back: [ground(V), puff(60, 150, 10, 0.4), puff(186, 140, 8, 0.35), puff(122, 120, 6, 0.3)], raios: [], corpo };
  }
  const L = (y: number) => 46 + ((y - 94) * 8) / 98;
  const R = (y: number) => 194 - ((y - 94) * 8) / 98;
  const rows = [120, 146, 170].map((y) => `M${L(y) + 3} ${y} L ${R(y) - 3} ${y}`);
  const joints = (
    [
      [100, 94, 120],
      [140, 94, 120],
      [80, 120, 146],
      [160, 120, 146],
      [104, 146, 170],
      [136, 146, 170],
      [84, 170, 192],
      [156, 170, 192],
    ] as const
  ).map(([x, a, b]) => `M${x} ${a + 3} L ${x} ${b - 3}`);
  const arm = fur ? 'M50 100 L 30 88 L 22 52 L 46 46 L 54 76' : 'M48 100 L 26 112 L 20 158 L 44 162 L 50 128';
  const fist = fur ? { tag: 'rect' as const, x: 10, y: 18, width: 44, height: 34, rx: 5 } : { tag: 'rect' as const, x: 8, y: 154, width: 42, height: 34, rx: 5 };
  const fistR = { ...fist, x: 240 - fist.x - fist.width };
  const eye = fur ? 'M96 70 L 116 76 L 114 86 L 96 80 Z' : 'M98 72 L 116 78 L 114 84 L 98 80 Z';
  const face: ArtNode[] = hit
    ? [squint(106, 134, 78)]
    : [neon([eye, m(eye)], body, 2.4, { fill: true, tint: 0 }), glowFill([eye, m(eye)], fur ? mix(ART.ink, HOT, 0.35) : ART.ink, { w: 0.6, glow: fur ? 1.2 : 0.5 })];
  const mouth = fur
    ? neon({ tag: 'rect', x: 104, y: 88, width: 32, height: 4, rx: 1 }, ART.ink, 2, { fill: ART.dark.villain, glow: 0.5 })
    : neon('M106 90 L 118 90 L 122 87 L 126 91 L 134 90', body, 2.6);
  const cracks = ['M120 98 L 112 114 L 124 126 L 114 144'].concat(fur ? ['M74 130 L 86 140 L 78 156', 'M166 104 L 156 118 L 168 128', 'M140 160 L 150 176 L 142 188'] : []);
  const rebar = ['M62 94 L 52 70', 'M76 94 L 72 62'];
  const corpo: ArtNode[] = [
    neon(
      [
        { tag: 'rect', x: 80, y: 188, width: 30, height: 36, rx: 4 },
        { tag: 'rect', x: 130, y: 188, width: 30, height: 36, rx: 4 },
      ],
      body,
      3.4,
      { fill: true },
    ),
    neon([...rebar, ...rebar.map(m)], fur ? HOT : ART.orange, 3, { glow: fur ? 1.4 : 0.9 }),
    neon('M92 60 L 148 60 L 154 104 L 86 104 Z', body, 3.8, { fill: true, tint: 0.1 }),
    neon('M46 94 L 194 94 L 186 192 L 54 192 Z', body, 4, { fill: true, tint: 0.1 }),
    neon([...rows, ...joints], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.45 }),
    neon(cracks, crackC, 2.6, { glow: fur ? 1.6 : 1, hot: 0.7 }),
    ...damage(k.dano, crack(['M150 140 L 140 156 L 152 166 L 144 182', 'M140 156 L 130 152', 'M60 106 L 74 116 L 66 130'], crackC), [
      ...crack(['M98 146 L 86 160 L 98 170 L 92 184', 'M178 124 L 166 138 L 172 150'], crackC),
      neon({ tag: 'rect', x: 110, y: 172, width: 24, height: 16, rx: 2 }, ART.ink2, 1.6, { fill: ART.bg, glow: 0, hot: 0, opacity: 0.9 }),
      chip(196, 196, 7, 30, body),
      chip(28, 200, 5, -20, body),
    ]),
    neon([arm, m(arm)], body, 3.6, { fill: true }),
    neon([fist, fistR], body, 3.6, { fill: true, tint: 0.16 }),
    neon(['M90 66 L 120 76 L 150 66'], body, 5.4),
    ...face,
    mouth,
  ];
  if (hit) {
    const chips = (
      [
        [34, 44, 8, 20],
        [70, 26, 6, -30],
        [20, 84, 5, 45],
      ] as const
    ).map(([x, y, s, r]) => pivot([neon({ tag: 'rect', x, y, width: s, height: s }, ART.ink2, 2, { fill: true, hot: 0 })], { x, y, rotate: r }));
    return { back: [ground(V), ...impact(56, 62), ...chips], raios: [], corpo, pose: { x: 120, y: 224, rotate: 5, tx: -4, scale: 0.94 } };
  }
  if (fur) return { back: [ground(V), shake(), puff(70, 40, 7, 0.55), puff(170, 36, 7, 0.55)], raios: [], corpo };
  return { back: [ground(V)], raios: [], corpo };
}

// ---------------------------------------------------------------- Soneca (preguiça, "só amanhã")
function soneca(k: Ctx): BossParts {
  const { fur, hit, down, body, V } = k;
  const cx = 120;
  const cy = 132;
  const bellC = fur ? HOT : hit ? mix(ART.ink, ART.white, 0.5) : ART.ink;
  const ticks: string[] = [];
  for (let i = 0; i < 12; i++) ticks.push(`M${pt(cx, cy, 52, i * 30)} L ${pt(cx, cy, i % 3 ? 47 : 43, i * 30)}`);
  const bell = 'M54 80 A 24 24 0 0 1 96 58 Z';
  const bellR = 'M186 80 A 24 24 0 0 0 144 58 Z';
  // Ponteiros-garra: os braços são ponteiros de relógio que terminam em garra (mais ameaça que na F1).
  const armL = fur ? 'M60 118 L 34 96 L 26 70' : down ? 'M58 150 L 46 172 L 44 194' : 'M58 146 L 32 136 L 20 116';
  const clawL = fur
    ? ['M26 70 L 18 74', 'M26 70 L 22 62', 'M26 70 L 32 64']
    : down
      ? ['M44 194 L 38 200', 'M44 194 L 44 202', 'M44 194 L 50 200']
      : ['M20 116 L 12 118', 'M20 116 L 14 108', 'M20 116 L 22 106'];
  const legs = ['M84 184 L 72 222 L 92 222', m('M84 184 L 72 222 L 92 222')];
  let face: ArtNode[];
  if (down) {
    face = [xEyes(100, 140, 128, 7), neon('M106 160 Q 120 154 134 160', body, 3)];
  } else if (hit) {
    face = [squint(102, 138, 128), neon('M100 160 L 108 154 L 116 162 L 124 154 L 132 162 L 140 156', ART.ink, 2.6)];
  } else if (fur) {
    const eye = 'M86 120 L 114 128 L 110 140 L 90 136 Z';
    face = [
      neon(['M80 106 L 116 122', m('M80 106 L 116 122')], body, 4.6),
      neon([eye, m(eye)], body, 2.6, { fill: true, tint: 0 }),
      glowFill([eye, m(eye)], mix(ART.ink, HOT, 0.25), { w: 0.6, glow: 1 }),
      glowFill(
        [
          { tag: 'circle', cx: 104, cy: 131, r: 3 },
          { tag: 'circle', cx: 136, cy: 131, r: 3 },
        ],
        V,
        { w: 0.8, glow: 0 },
      ),
      neon('M100 152 Q 120 182 140 152 Q 120 160 100 152 Z', body, 3, { fill: ART.dark.villain }),
      neon(['M106 155 L 110 166 L 114 157', 'M126 157 L 130 166 L 134 155'], ART.ink, 2.2, { hot: 0.4 }),
    ];
  } else {
    face = [
      neon(['M84 112 L 114 122', m('M84 112 L 114 122')], body, 4),
      neon(['M88 128 L 112 128 Q 100 138 88 128 Z', m('M88 128 L 112 128 Q 100 138 88 128 Z')], ART.ink, 2.4, { fill: true, tint: 0 }),
      glowFill(
        [
          { tag: 'circle', cx: 102, cy: 131, r: 3 },
          { tag: 'circle', cx: 138, cy: 131, r: 3 },
        ],
        V,
        { w: 0.8, glow: 0 },
      ),
      neon({ tag: 'ellipse', cx: 120, cy: 158, rx: 12, ry: 9 }, body, 3, { fill: ART.dark.villain }),
    ];
  }
  const crackC = fur ? HOT : ART.ink;
  const bellsArt: ArtNode[] = [
    neon([bell, bellR], bellC, 3.2, { fill: true, tint: 0.12, glow: fur ? 1.4 : 1 }),
    glowFill(
      [
        { tag: 'circle', cx: 70, cy: 52, r: 3.4 },
        { tag: 'circle', cx: 170, cy: 52, r: 3.4 },
      ],
      bellC,
      { w: 1 },
    ),
    neon('M120 68 L 120 46 M104 46 L 136 46', bellC, 3, { hot: 0.4 }),
  ];
  const corpo: ArtNode[] = [
    neon(legs, body, 3.4, { fill: true }),
    neon([armL, m(armL)], body, 3.4, { glow: 0.9 }),
    neon([...clawL, ...clawL.map(m)], bellC, 2.4, { hot: 0.4 }),
    ...(down ? [] : bellsArt),
    neon({ tag: 'circle', cx, cy, r: 64 }, body, 4.2, { fill: true, tint: fur ? 0.2 : 0.12, glow: fur ? 1.4 : 1 }),
    neon(ticks, ART.ink, 2, { glow: 0.4, hot: 0, opacity: 0.6 }),
    ...(down ? [] : damage(k.dano, crack(['M152 84 L 138 100 L 150 108 L 140 124', 'M138 100 L 126 98'], crackC), [...crack(['M68 136 L 86 146 L 78 160 L 90 170', 'M86 146 L 98 140'], crackC), chip(180, 170, 6, 20, body)])),
    ...face,
  ];
  if (down) {
    const spring = 'M168 196 L 176 188 L 184 196 L 192 188 L 200 196 L 208 188';
    return {
      back: [
        ground(V),
        pivot([neon(bell, bellC, 3.2, { fill: true, tint: 0.12 })], { x: 70, y: 70, rotate: -40, tx: -24, ty: 140, opacity: 0.7 }),
        neon(spring, ART.ink2, 2.4, { hot: 0, opacity: 0.7 }),
        puff(60, 40, 8, 0.45),
        puff(176, 30, 7, 0.4),
      ],
      raios: [],
      corpo,
      pose: DOWN_POSE,
    };
  }
  if (hit) {
    return { back: [ground(V), ...impact(40, 100), neon([zz(200, 70, 10)], ART.ink, 2.2, { hot: 0, opacity: 0.5 })], raios: [], corpo, pose: HIT_POSE };
  }
  if (fur) {
    const ring = ['M40 44 Q 32 56 40 68', 'M30 36 Q 20 56 30 76', m('M40 44 Q 32 56 40 68'), m('M30 36 Q 20 56 30 76')];
    return { back: [ground(V), shake(), neon(ring, HOT, 2.4, { hot: 0.3, opacity: 0.85 }), puff(60, 200, 8, 0.5), puff(184, 196, 8, 0.5)], raios: [], corpo, pose: { x: 120, y: 228, scale: 0.94 } };
  }
  return { back: [ground(V), neon([zz(192, 70, 12), zz(208, 50, 8), zz(220, 34, 6)], ART.ink, 2.6, { hot: 0.4 })], raios: [], corpo };
}

// ---------------------------------------------------------------- Rei Buzina (trânsito)
function reiBuzina(k: Ctx): BossParts {
  const { fur, hit, down, body, V } = k;
  const coneC = fur ? HOT : hit ? mix(ART.orange, ART.white, 0.55) : ART.orange;
  const cone = (x: number, y: number, s: number) => `M${x} ${y} L ${x + s * 0.55} ${y + s * 1.6} L ${x - s * 0.55} ${y + s * 1.6} Z`;
  const stripe = (x: number, y: number, s: number) => `M${x - s * 0.33} ${y + s * 0.95} L ${x + s * 0.33} ${y + s * 0.95}`;
  const waves = fur ? ['M30 120 Q 20 134 30 148', 'M18 108 Q 2 134 18 160', 'M6 98 Q -14 134 6 170'] : ['M30 120 Q 20 134 30 148', 'M18 112 Q 4 134 18 156'];
  const crown = (cones: [number, number, number][]): ArtNode[] => [
    neon(
      cones.map(([x, y, s]) => cone(x, y, s)),
      coneC,
      3,
      { fill: true, tint: 0.18 },
    ),
    neon(
      cones.map(([x, y, s]) => stripe(x, y, s)),
      ART.ink,
      2.4,
      { glow: 0.4, hot: 0 },
    ),
  ];
  const lightC = fur ? mix(ART.ink, HOT, 0.3) : ART.ink;
  let eyes: ArtNode[];
  if (down) eyes = [xEyes(84, 156, 134, 9)];
  else if (hit) eyes = [squint(84, 156, 134)];
  else
    eyes = [
      glowFill(
        [
          { tag: 'circle', cx: 84, cy: 134, r: fur ? 16 : 14 },
          { tag: 'circle', cx: 156, cy: 134, r: fur ? 16 : 14 },
        ],
        lightC,
        { w: 1.4, glow: fur ? 1.8 : 1.2 },
      ),
      glowFill([fur ? 'M66 118 L 102 130 L 102 116 L 66 112 Z' : 'M70 120 L 100 128 L 100 118 L 70 116 Z', m(fur ? 'M66 118 L 102 130 L 102 116 L 66 112 Z' : 'M70 120 L 100 128 L 100 118 L 70 116 Z')], ART.dark.villain, {
        glow: 0,
        w: 0.5,
      }),
    ];
  const grille = fur
    ? [
        neon({ tag: 'rect', x: 88, y: 154, width: 64, height: 30, rx: 4 }, body, 3, { fill: ART.dark.villain }),
        neon(['M98 156 L 102 168 L 106 156', 'M134 156 L 138 168 L 142 156', 'M110 182 L 114 172 L 118 182', 'M122 182 L 126 172 L 130 182'], ART.ink, 2.2, { hot: 0.4 }),
      ]
    : [
        neon({ tag: 'rect', x: 92, y: 156, width: 56, height: 24, rx: 4 }, body, 3, { fill: ART.dark.villain }),
        neon(['M102 158 L 102 178', 'M111 158 L 111 178', 'M120 158 L 120 178', 'M129 158 L 129 178', 'M138 158 L 138 178'], ART.ink, 2, { glow: 0.4, hot: 0 }),
      ];
  const crackC = fur ? HOT : ART.ink;
  const corpo: ArtNode[] = [
    neon(
      [
        { tag: 'circle', cx: 78, cy: 206, r: 16 },
        ...(down ? [] : [{ tag: 'circle' as const, cx: 162, cy: 206, r: 16 }]),
      ],
      body,
      3.4,
      { fill: true },
    ),
    neon('M72 60 L 168 60 L 184 100 L 56 100 Z', body, 3.6, { fill: true, tint: 0.08 }),
    neon('M50 100 L 190 100 L 198 196 L 42 196 Z', body, 4, { fill: true, tint: fur ? 0.18 : 0.12, glow: fur ? 1.4 : 1 }),
    neon(['M84 72 L 156 72 L 166 94 L 74 94 Z'], ART.ink2, 1.8, { glow: 0.3, hot: 0, opacity: 0.55 }),
    neon([fur ? 'M56 106 L 108 126' : 'M58 112 L 108 124', m(fur ? 'M56 106 L 108 126' : 'M58 112 L 108 124')], body, 5),
    ...(down ? [] : damage(k.dano, crack(['M92 72 L 108 84 L 100 94', 'M108 84 L 122 80'], crackC), [...crack(['M186 144 L 170 160 L 182 172 L 170 188', 'M170 160 L 158 156'], crackC), chip(204, 186, 6, 25, body)])),
    ...eyes,
    ...grille,
    ...(down ? [] : hit ? [pivot(crown([[92, 22, 22], [120, 10, 28]]), { x: 120, y: 60, rotate: -8 }), pivot(crown([[148, 22, 22]]), { x: 148, y: 40, rotate: 34, tx: 30, ty: -18 })] : crown([[92, 22, 22], [120, 10, 28], [148, 22, 22]])),
  ];
  if (down) {
    return {
      back: [
        ground(V),
        neon({ tag: 'circle', cx: 210, cy: 212, r: 14 }, body, 3.2, { fill: true, glow: 0.6, opacity: 0.7 }),
        pivot(crown([[0, 0, 22]]), { x: 0, y: 0, rotate: 100, tx: 56, ty: 210, opacity: 0.8 }),
        pivot(crown([[0, 0, 22]]), { x: 0, y: 0, rotate: -80, tx: 26, ty: 196, opacity: 0.8 }),
        puff(70, 40, 9, 0.45),
        puff(164, 28, 7, 0.4),
      ],
      raios: [],
      corpo,
      pose: DOWN_POSE,
    };
  }
  if (hit) return { back: [ground(V), ...impact(40, 96)], raios: [], corpo, pose: HIT_POSE };
  const waveArt = neon([...waves, ...waves.map(m)], fur ? HOT : ART.orange, 2.6, { hot: 0.4, opacity: 0.8 });
  if (fur) return { back: [ground(V), waveArt, puff(56, 50, 8, 0.55), puff(186, 46, 8, 0.55)], raios: [], corpo, pose: { x: 120, y: 228, scale: 0.94 } };
  return { back: [ground(V), waveArt], raios: [], corpo };
}

// ---------------------------------------------------------------- Fuligem (fumaça)
function fuligem(k: Ctx): BossParts {
  const { fur, hit, down, body, V } = k;
  const cloud = 'M64 150 Q 40 150 40 126 Q 40 104 62 102 Q 62 70 94 66 Q 108 40 138 50 Q 164 44 172 74 Q 200 78 198 108 Q 210 130 190 146 Q 186 170 160 166 Q 140 184 116 170 Q 88 182 76 164 Q 60 166 64 150 Z';
  const pipe = 'M56 148 L 28 178 L 44 192 L 72 162 Z';
  const rim = 'M22 172 L 50 198';
  const pipeC = fur ? HOT : ART.ink;
  let face: ArtNode[];
  if (down) {
    face = [xEyes(102, 138, 118, 7), neon('M104 146 Q 120 140 136 146', body, 2.6)];
  } else if (hit) {
    face = [squint(102, 138, 118), neon('M96 146 L 104 140 L 112 148 L 120 140 L 128 148 L 136 140 L 144 146', ART.ink, 2.6)];
  } else {
    const eye = fur ? 'M86 110 L 116 120 L 112 132 L 92 128 Z' : 'M90 114 L 114 120 L 110 128 L 94 124 Z';
    face = [
      neon([fur ? 'M80 96 L 118 114' : 'M84 104 L 116 116', m(fur ? 'M80 96 L 118 114' : 'M84 104 L 116 116')], body, 5),
      glowFill([eye, m(eye)], fur ? mix(ART.ink, HOT, 0.3) : ART.ink, { w: 0.8, glow: fur ? 1.4 : 0.8 }),
      ...(fur
        ? [
            neon('M96 142 Q 120 172 144 142 Q 120 150 96 142 Z', body, 3, { fill: ART.dark.villain }),
            neon(['M102 145 L 106 156 L 110 147', 'M130 147 L 134 156 L 138 145'], ART.ink, 2.2, { hot: 0.4 }),
          ]
        : [neon('M96 146 L 104 140 L 112 148 L 120 140 L 128 148 L 136 140 L 144 146', ART.ink, 2.6)]),
    ];
  }
  const crackC = fur ? HOT : ART.ink;
  const drawCloud = down ? pivot([neon(cloud, body, 4, { fill: true, tint: 0.12 })], { x: 120, y: 120, scale: 0.72, ty: 30 }) : neon(cloud, body, 4, { fill: true, tint: fur ? 0.2 : 0.12, glow: fur ? 1.4 : 1 });
  const corpo: ArtNode[] = [
    ...(down ? [] : [neon([pipe, m(pipe)], ART.ink2, 3.2, { fill: true, tint: 0.06, glow: 0.6 }), neon([rim, m(rim)], pipeC, 3.6, { glow: fur ? 1.2 : 0.5 })]),
    drawCloud,
    ...(down ? [] : [neon(['M84 96 Q 100 80 120 92', 'M120 92 Q 140 78 160 94', 'M70 132 Q 90 146 108 140'], ART.ink2, 2, { glow: 0.3, hot: 0, opacity: 0.55 })]),
    ...(down ? [] : damage(k.dano, crack(['M172 74 L 156 92 L 170 102 L 160 116'], crackC), [...crack(['M54 110 L 74 120 L 62 134 L 74 146'], crackC), puff(204, 72, 6, 0.5)])),
    ...face,
    ...(down ? [] : [neon(['M100 168 Q 98 180 102 188', 'M140 166 Q 144 178 140 186'], ART.ink2, 2.4, { hot: 0, opacity: 0.6 })]),
  ];
  if (down) {
    const wind = ['M20 70 Q 60 60 90 70 Q 110 76 104 88', 'M150 54 Q 190 46 220 56', 'M170 80 Q 196 76 214 84'];
    return {
      back: [
        ground(V),
        neon(wind, ART.ink2, 2, { hot: 0, glow: 0.3, opacity: 0.6 }),
        pivot([neon(pipe, ART.ink2, 3.2, { fill: true, glow: 0.4 })], { x: 50, y: 170, rotate: -60, tx: -10, ty: 40, opacity: 0.7 }),
        puff(50, 120, 10, 0.4),
        puff(194, 150, 9, 0.35),
        puff(170, 104, 6, 0.3),
      ],
      raios: [],
      corpo,
      pose: { x: 120, y: 180, rotate: 8, ty: 26, scale: 0.9, opacity: 0.62 },
    };
  }
  if (hit) {
    return { back: [ground(V), ...impact(38, 70), puff(214, 60, 6, 0.5), puff(204, 160, 5, 0.45)], raios: [], corpo, pose: HIT_POSE };
  }
  const smoke = fur ? [puff(22, 210, 13, 0.7), puff(218, 208, 14, 0.7), puff(16, 180, 8, 0.5), puff(224, 178, 8, 0.5)] : [puff(22, 210, 11, 0.6), puff(218, 208, 12, 0.6)];
  if (fur) return { back: [ground(V), shake(), ...smoke], raios: [], corpo, pose: { x: 120, y: 228, scale: 0.94 } };
  return { back: [ground(V), ...smoke], raios: [], corpo };
}

const DRAW: Record<BossId, (k: Ctx) => BossParts> = { soneca, 'rei-buzina': reiBuzina, fuligem, mormaco, paredao };
const cache = new Map<string, BossParts>();

export function bossParts(id: BossId, state: BossState, dano: BossDamage, color: string): BossParts {
  return memoArt(cache, `${id}|${state}|${dano}|${color}`, () => {
    const hit = state === 'golpe';
    return DRAW[id]({ V: color, state, dano, fur: state === 'furioso', hit, down: state === 'derrotado', body: hit ? mix(color, ART.white, 0.55) : color });
  });
}

/** O chefão inteiro numa árvore só (versão estática). */
export function bossNodes(id: BossId, state: BossState, dano: BossDamage, color: string): ArtNode[] {
  const p = bossParts(id, state, dano, color);
  const body = [...p.raios, ...p.corpo];
  return [...p.back, ...(p.pose ? [pivot(body, p.pose)] : body)];
}
