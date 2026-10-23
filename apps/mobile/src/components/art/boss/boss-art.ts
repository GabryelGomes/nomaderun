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
// Onda 2: o Mormaço deixou de ser um "sol de emoji". As lâminas são curvas e varridas para o mesmo lado
// (um cata-vento de serra, que lê como giro mesmo parado), e o rosto virou uma máscara: uma crista em V
// de ponta a ponta do disco, órbitas escuras e angulosas com a fenda incandescente dentro, marcas de
// máscara nas bochechas e uma boca de serra presa entre os cortes "synthwave" do horizonte.
function mormaco(k: Ctx): BossParts {
  const cx = 120;
  const cy = 112;
  const R0 = 60;
  const { fur, hit, down, body, V } = k;
  const accent = fur ? HOT : hit ? mix(ART.orange, ART.white, 0.55) : ART.orange;
  const blades: string[] = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    if (down && i % 2) continue;
    const a = -90 + (i * 360) / n;
    const R = down ? 80 : fur ? (i % 2 ? 100 : 114) : i % 2 ? 92 : 106;
    const sweep = down ? 6 : fur ? 26 : 20;
    blades.push(`M${pt(cx, cy, R0 - 2, a - 12)} Q ${pt(cx, cy, (R0 + R) / 2 + 8, a - 2)} ${pt(cx, cy, R, a + sweep)} L ${pt(cx, cy, R0 - 2, a + 10)}`);
  }
  let face: ArtNode[];
  if (down) {
    face = [xEyes(100, 140, 106, 7), neon('M96 132 Q 108 126 120 132 Q 132 138 144 132', body, 3)];
  } else if (hit) {
    face = [squint(100, 140, 106), neon('M92 132 L 100 127 L 108 134 L 116 127 L 124 134 L 132 127 L 140 134 L 148 129', ART.ink, 2.6)];
  } else {
    const socket = fur ? 'M72 90 L 114 106 L 108 122 L 82 116 Z' : 'M74 94 L 114 107 L 108 119 L 84 114 Z';
    const slit = fur ? 'M90 106 L 110 112 L 106 118 L 92 114 Z' : 'M92 108 L 108 112 L 105 115 L 94 113 Z';
    face = [
      // Crista em V de ponta a ponta (a máscara).
      neon([fur ? 'M64 80 L 120 104' : 'M66 84 L 120 104', m(fur ? 'M64 80 L 120 104' : 'M66 84 L 120 104')], body, 5.4),
      neon([socket, m(socket)], body, 2.2, { fill: ART.dark.villain, glow: 0.5, hot: 0 }),
      glowFill([slit, m(slit)], fur ? mix(ART.ink, HOT, 0.3) : ART.ink, { w: 0.6, glow: fur ? 1.6 : 1.1 }),
      // Marcas da máscara nas bochechas.
      neon(['M86 120 L 92 134', m('M86 120 L 92 134'), 'M120 108 L 120 122'], accent, 2.2, { hot: 0.3, opacity: 0.8 }),
      ...(fur
        ? [
            neon('M86 132 L 154 132 L 146 152 L 94 152 Z', body, 2.8, { fill: ART.dark.villain }),
            neon(['M96 133 L 101 144 L 106 133', 'M114 133 L 120 146 L 126 133', 'M134 133 L 139 144 L 144 133'], ART.ink, 2.2, { hot: 0.4 }),
          ]
        : [neon('M88 136 L 98 131 L 106 138 L 114 131 L 120 138 L 126 131 L 134 138 L 142 131 L 152 136', ART.ink, 2.2, { hot: 0.4 })]),
    ];
  }
  const cuts = [148, 157, 165].map((y, i) => {
    const hc = Math.sqrt(R0 * R0 - (y - cy) * (y - cy)) - 4;
    return plain(`M${(cx - hc).toFixed(1)} ${y} L ${(cx + hc).toFixed(1)} ${y}`, ART.bg, 2.4 + i * 1.4);
  });
  const crackC = fur ? HOT : ART.ink;
  const corpo: ArtNode[] = [
    neon({ tag: 'circle', cx, cy, r: R0 }, accent, 4.2, { fill: true, tint: fur ? 0.22 : 0.15, glow: fur ? 1.4 : 1 }),
    neon({ tag: 'circle', cx, cy, r: R0 - 9 }, body, 1.8, { hot: 0, opacity: 0.45, dash: '3 7' }),
    ...cuts,
    ...(down ? [] : damage(k.dano, crack(['M150 66 L 140 82 L 154 92 L 146 104', 'M140 82 L 128 80'], crackC), [...crack(['M70 104 L 84 112 L 76 126 L 86 136', 'M84 112 L 92 108'], crackC), chip(178, 52, 6, 25, accent)])),
    ...face,
    ...(down ? [plain('M150 66 L 140 84 L 152 92 L 142 110', ART.bg, 4), neon('M150 66 L 140 84 L 152 92 L 142 110', body, 1.6, { glow: 0.6, hot: 0 })] : []),
  ];
  const raios = [neon(blades, accent, 3.2, { fill: true, tint: 0.16, glow: fur ? 1.4 : 1 })];
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
    const waves = ['M40 74 Q 32 64 40 54 Q 48 44 40 34', 'M200 74 Q 192 64 200 54 Q 208 44 200 34'];
    return { back: [ground(V), shake(), neon(waves, HOT, 2.4, { hot: 0, opacity: 0.7 })], raios, corpo, pose: { x: cx, y: 120, scale: 0.9 } };
  }
  return { back: [ground(V), neon(['M44 212 Q 60 206 76 212 Q 92 218 108 212', 'M132 212 Q 148 206 164 212 Q 180 218 196 212'], V, 1.8, { hot: 0, glow: 0.5, opacity: 0.5 })], raios, corpo };
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
// Onda 2: a Soneca deixou de ser um "relógio fofo". Agora é um despertador encapuzado num cobertor que
// arrasta no chão (a barra rasgada esconde as perninhas), com os sinos furando o capuz como chifres, os
// ponteiros parados em 11:55 ("só mais cinco minutinhos") fazendo a ruga da testa, pálpebras pesadas de
// tédio e um sorriso torto de canto. Os braços continuam ponteiros com garra.
const SONECA_CLOAK =
  'M120 46 C 154 46 178 70 184 102 C 190 134 198 174 208 214 L 194 208 L 184 222 L 170 210 L 156 224 L 140 212 L 120 226 L 100 212 L 84 224 L 70 210 L 56 222 L 46 208 L 32 214 C 42 174 50 134 56 102 C 62 70 86 46 120 46 Z';
const SONECA_BELL = 'M58 74 A 23 23 0 0 1 98 48 Z';
const SONECA_BELL_R = 'M182 74 A 23 23 0 0 0 142 48 Z';

function soneca(k: Ctx): BossParts {
  const { fur, hit, down, body, V } = k;
  const cx = 120;
  const cy = 122;
  const bellC = fur ? HOT : hit ? mix(ART.ink, ART.white, 0.5) : ART.ink;
  const crackC = fur ? HOT : ART.ink;
  const ticks = (x: number, y: number, r: number): string[] => {
    const out: string[] = [];
    for (let i = 0; i < 12; i++) out.push(`M${pt(x, y, r, i * 30)} L ${pt(x, y, i % 3 ? r - 4 : r - 8, i * 30)}`);
    return out;
  };

  if (down) {
    // Desmontada: o cobertor vira um monte no chão e o mostrador fica deitado por cima, de olhos em X.
    const fx = 124;
    const fy = 172;
    const corpo: ArtNode[] = [
      neon('M28 226 Q 40 200 70 196 Q 96 184 124 190 Q 160 182 184 198 Q 206 204 212 226 Z', body, 3.6, { fill: true, tint: 0.1, glow: 0.7 }),
      neon(['M60 214 Q 80 204 100 212', 'M140 210 Q 164 202 186 214'], ART.ink2, 1.8, { glow: 0, hot: 0, opacity: 0.5 }),
      neon({ tag: 'ellipse', cx: fx, cy: fy, rx: 42, ry: 34 }, body, 4, { fill: true, tint: 0.12, glow: 0.8 }),
      neon(ticks(fx, fy, 30).slice(0, 12), ART.ink, 1.8, { glow: 0.3, hot: 0, opacity: 0.5 }),
      xEyes(108, 140, 168, 6),
      neon('M112 188 Q 124 183 136 188', body, 2.6),
      neon([`M${fx} ${fy} L ${pt(fx, fy, 18, -150)}`], ART.ink, 2.2, { glow: 0.4, hot: 0, opacity: 0.8 }),
    ];
    return {
      back: [
        ground(V),
        pivot([neon(SONECA_BELL, bellC, 3.2, { fill: true, tint: 0.12 })], { x: 78, y: 62, rotate: -70, tx: -38, ty: 132, opacity: 0.7 }),
        pivot([neon(SONECA_BELL_R, bellC, 3.2, { fill: true, tint: 0.12 })], { x: 162, y: 62, rotate: 30, tx: 24, ty: 120, opacity: 0.6 }),
        neon('M150 150 L 160 140 L 168 150 L 176 140 L 184 150 L 192 140', ART.ink2, 2.4, { hot: 0, opacity: 0.7 }),
        puff(60, 40, 8, 0.45),
        puff(176, 30, 7, 0.4),
      ],
      raios: [],
      corpo: [pivot(corpo, { opacity: 0.62 })],
    };
  }

  // Braços-ponteiro saindo das dobras do cobertor, com garra de 3 pontas.
  const armL = fur ? 'M58 128 L 34 104 L 28 74' : 'M56 150 L 30 140 L 18 118';
  const clawL = fur ? ['M28 74 L 18 76', 'M28 74 L 22 64', 'M28 74 L 34 66'] : ['M18 118 L 8 120', 'M18 118 L 12 108', 'M18 118 L 22 106'];

  let face: ArtNode[];
  if (hit) {
    face = [squint(102, 138, 122), neon('M100 150 L 108 144 L 116 152 L 124 144 L 132 152 L 140 146', ART.ink, 2.6)];
  } else if (fur) {
    const eye = 'M84 112 L 112 122 L 108 134 L 90 130 Z';
    face = [
      neon(['M78 100 L 116 118', m('M78 100 L 116 118')], body, 5),
      neon([eye, m(eye)], body, 2.6, { fill: true, tint: 0 }),
      glowFill([eye, m(eye)], mix(ART.ink, HOT, 0.3), { w: 0.6, glow: 1.2 }),
      glowFill(
        [
          { tag: 'circle', cx: 104, cy: 125, r: 3 },
          { tag: 'circle', cx: 136, cy: 125, r: 3 },
        ],
        V,
        { w: 0.8, glow: 0 },
      ),
      neon('M94 144 Q 120 178 146 144 Q 120 154 94 144 Z', body, 3, { fill: ART.dark.villain }),
      neon(['M101 147 L 105 159 L 109 149', 'M131 149 L 135 159 L 139 147'], ART.ink, 2.2, { hot: 0.4 }),
    ];
  } else {
    // Pálpebra pesada (reta, baixa) sobre um olho em fenda que olha de lado; a direita um pouco erguida.
    const eyeL = 'M84 120 L 110 124 Q 100 133 88 129 Z';
    const eyeR = 'M156 118 L 130 123 Q 140 132 152 128 Z';
    face = [
      neon([eyeL, eyeR], ART.ink, 2.2, { fill: true, tint: 0 }),
      glowFill(
        [
          { tag: 'circle', cx: 104, cy: 127.5, r: 3 },
          { tag: 'circle', cx: 146, cy: 126, r: 3 },
        ],
        V,
        { w: 0.8, glow: 0 },
      ),
      neon(['M80 116 L 112 122', 'M160 112 L 128 120'], body, 4.8),
      // Sorriso torto, de canto, com um canino.
      neon('M98 146 Q 120 156 148 138 Q 142 154 122 157 Q 104 157 98 146 Z', body, 2.8, { fill: ART.dark.villain }),
      neon('M134 147 L 137 154 L 140 145', ART.ink, 2, { hot: 0.4 }),
    ];
  }

  // Ponteiros parados em 11:55: o "V" sobe do centro e vira a ruga da testa.
  const hands = hit ? [] : [neon([`M${cx} ${cy - 6} L ${pt(cx, cy, 30, -98)}`, `M${cx} ${cy - 6} L ${pt(cx, cy, 38, -124)}`], ART.ink, 2.4, { glow: 0.6, hot: 0.5, opacity: 0.85 })];
  const corpo: ArtNode[] = [
    neon(SONECA_CLOAK, body, 3.8, { fill: true, tint: fur ? 0.16 : 0.09, glow: fur ? 1.3 : 0.9 }),
    // Dobras e listras do cobertor.
    neon(['M70 150 Q 62 182 58 208', 'M170 150 Q 178 182 182 208', 'M94 182 L 100 212', 'M146 182 L 140 212'], body, 1.8, { glow: 0, hot: 0, opacity: 0.45 }),
    neon(['M44 196 L 62 190', 'M196 196 L 178 190'], ART.ink2, 2, { glow: 0, hot: 0, opacity: 0.5, dash: '3 5' }),
    neon([armL, m(armL)], body, 3.4, { glow: 0.9 }),
    neon([...clawL, ...clawL.map(m)], bellC, 2.4, { hot: 0.4 }),
    // Sinos furando o capuz (chifres) e o martelo entre eles.
    neon([SONECA_BELL, SONECA_BELL_R], bellC, 3.2, { fill: true, tint: 0.12, glow: fur ? 1.4 : 1 }),
    neon('M120 48 L 120 30 M106 30 L 134 30', bellC, 3, { hot: 0.4 }),
    // Borda interna do capuz e o mostrador com aro grosso.
    neon('M62 132 C 60 88 86 64 120 64 C 154 64 180 88 178 132', body, 2.2, { glow: 0.5, hot: 0, opacity: 0.7 }),
    neon({ tag: 'circle', cx, cy, r: 52 }, body, 4.4, { fill: true, tint: fur ? 0.2 : 0.12, glow: fur ? 1.4 : 1 }),
    neon(ticks(cx, cy, 46), ART.ink, 2, { glow: 0.4, hot: 0, opacity: 0.6 }),
    ...hands,
    ...damage(k.dano, crack(['M150 82 L 138 98 L 150 106 L 140 122', 'M138 98 L 126 96'], crackC), [...crack(['M74 124 L 90 134 L 82 148 L 92 158', 'M90 134 L 100 128'], crackC), chip(190, 168, 6, 20, body)]),
    ...face,
  ];

  if (hit) {
    return { back: [ground(V), ...impact(38, 100), neon([zz(204, 66, 10)], ART.ink, 2.2, { hot: 0, opacity: 0.5 })], raios: [], corpo, pose: HIT_POSE };
  }
  if (fur) {
    const ring = ['M40 40 Q 32 52 40 64', 'M30 32 Q 20 52 30 72', m('M40 40 Q 32 52 40 64'), m('M30 32 Q 20 52 30 72')];
    return { back: [ground(V), shake(), neon(ring, HOT, 2.4, { hot: 0.3, opacity: 0.85 }), puff(30, 204, 8, 0.5), puff(212, 200, 8, 0.5)], raios: [], corpo, pose: { x: 120, y: 228, scale: 0.94 } };
  }
  return { back: [ground(V), neon([zz(196, 62, 12), zz(212, 42, 8), zz(224, 26, 6)], ART.ink, 2.6, { hot: 0.4 })], raios: [], corpo };
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
