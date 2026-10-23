/**
 * Bustos dos 4 líderes (T7.2.8, D-70): Íris Valente (Striders), Téo Faria (Volt), Nara Lis (Owls) e Bento
 * Rocha (Coyotes). Mesmo traço neon dos mascotes, na grade do busto (viewBox 200 × 220), com a forma do time
 * sempre presente (aura atrás da cabeça + um objeto no peito ou no rosto) e 2 poses: `parado` e `falando`
 * (boca aberta + gesto de mão). Puro: só geometria, sem lógica de jogo.
 *
 * Personalidade (bíblia da F1, §3):
 * - Íris: calma e exata, sorriso de canto; cronômetro redondo no peito; fala com o indicador erguido.
 * - Téo: piadista incansável, sorriso largo com dentes; faixa na testa com o triângulo; joinha.
 * - Nara: observadora e gentil; lanterna de cabeça em losango e faixas refletivas (Corrida Segura); acena.
 * - Bento: voz de comando e coração enorme; boné com o quadrado, bigode e apito; chama com a mão na boca.
 *
 * A cabeça vem em camadas (`base`, `olhos`, `topo`) e a boca em 2 versões (`fechada`, `aberta`), para a fala
 * animar só a opacidade da camada da boca (nenhum path é animado).
 */
import type { FactionId } from '@/domain/types';

import { glowFill, glyph, memoArt, mirror, neon, pivot, type ArtNode, type PivotOpts } from '../neon/core';
import { ART, teamShape } from '../neon/palette';

export type LeaderPose = 'parado' | 'falando';
export const LEADER_POSES: readonly LeaderPose[] = ['parado', 'falando'];
export const LEADER_NAMES: Record<FactionId, string> = { striders: 'Íris Valente', volt: 'Téo Faria', owls: 'Nara Lis', coyotes: 'Bento Rocha' };
export const LEADER_BOX = { vbW: 200, vbH: 220 } as const;

/**
 * Pivôs (viewBox 200 × 220) dos grupos animáveis:
 * - `corpo`: o busto inteiro respira a partir da base;
 * - `cabeca`: gira em torno do pescoço;
 * - `olhos`: piscam (scaleY);
 * - `boca`: a fala troca a opacidade entre a boca fechada e a aberta;
 * - `mao`: o gesto da fala balança em torno do punho.
 */
export const LEADER_PIVOTS = {
  corpo: { x: 100, y: 220 },
  cabeca: { x: 100, y: 160 },
  olhos: { x: 100, y: 104 },
  boca: { x: 100, y: 138 },
  mao: { x: 162, y: 176 },
} as const;

const W = 3.4; // traço principal

type Head = { base: ArtNode[]; eyes: ArtNode[]; top: ArtNode[]; closed: ArtNode[]; open: ArtNode[] };
type Leader = { head: (c: string) => Head; chest: (c: string) => ArtNode[]; hand: (c: string) => ArtNode[] };

const EAR = 'M65 100 Q 56 100 57 110 Q 58 120 66 119';
const NECK = 'M90 142 L 89 168';
const SHOULDER = 'M89 166 C 76 174 60 176 46 180 C 32 184 24 196 22 220';

/** Pescoço, ombros e a aura com a forma do time (igual aos mascotes). */
function torso(c: string, team: FactionId): ArtNode[] {
  return [
    neon(glyph(teamShape(team), 100, 100, 84), c, 2.2, { glow: 0.9, hot: 0, opacity: 0.35 }),
    neon(`M89 142 L 111 142 L 111 166 C 124 174 140 176 154 180 C 168 184 176 196 178 220 L 22 220 C 24 196 32 184 46 180 C 60 176 76 174 89 166 Z`, c, W, {
      fill: true,
      tint: 0.06,
      glow: 0.6,
      hot: 0,
    }),
    neon([NECK, mirror(NECK)], c, 2.6, { glow: 0.5, hot: 0 }),
    neon([SHOULDER, mirror(SHOULDER)], c, W, { glow: 0.8 }),
  ];
}

/** Olhos amendoados com a íris na cor do time; `lid` desenha uma pálpebra mais grossa por cima. */
function eyes(c: string, eyeL: string, pupil: [number, number], opt: { lid?: string; r?: number } = {}): ArtNode[] {
  const [px, py] = pupil;
  const r = opt.r ?? 3.2;
  return [
    neon([eyeL, mirror(eyeL)], ART.ink, 2.2, { fill: true, tint: 0, glow: 0.6 }),
    glowFill(
      [
        { tag: 'circle', cx: px, cy: py, r },
        { tag: 'circle', cx: 200 - px, cy: py, r },
      ],
      c,
      { w: 1, glow: 0.8 },
    ),
    ...(opt.lid ? [neon([opt.lid, mirror(opt.lid)], ART.ink, 2.8, { glow: 0.5, hot: 0 })] : []),
  ];
}

/** Boca fechada (traço) e aberta (forma com o interior escuro). */
function mouths(closed: ArtNode[], openD: string, extra: ArtNode[] = []): Pick<Head, 'closed' | 'open'> {
  return { closed, open: [neon(openD, ART.ink, 2.4, { fill: ART.dark.neutral, glow: 0.6 }), ...extra] };
}

/** Antebraço que sobe do pé da arte até o punho (manga na cor do time). */
function forearm(c: string, l: [number, number, number, number], r: [number, number, number, number]): ArtNode {
  return neon(`M${l[0]} ${l[1]} L ${l[2]} ${l[3]} L ${r[2]} ${r[3]} L ${r[0]} ${r[1]} Z`, c, W, { fill: true, tint: 0.08, glow: 0.7, hot: 0 });
}

const knuckles = (x1: number, x2: number, ys: number[]) =>
  neon(
    ys.map((y) => `M${x1} ${y} L ${x2} ${y}`),
    ART.ink,
    1.6,
    { glow: 0, hot: 0, opacity: 0.55 },
  );

// ---------------------------------------------------------------- Íris Valente (Striders)
const iris: Leader = {
  head: (c) => {
    const face = 'M100 62 C 121 62 135 76 136 97 C 137 117 131 133 118 145 L 108 151 Q 100 155 92 151 L 82 145 C 69 133 63 117 64 97 C 65 76 79 62 100 62 Z';
    const bob =
      'M100 48 C 130 48 148 70 145 102 C 144 116 141 126 137 136 L 127 128 C 132 112 132 96 126 82 C 110 88 90 88 74 79 C 69 92 67 108 72 128 L 63 136 C 58 126 56 116 55 102 C 53 70 70 48 100 48 Z';
    return {
      base: [
        neon([EAR, mirror(EAR)], c, 2.6, { fill: true, hot: 0 }),
        neon(face, c, W, { fill: true }),
        neon(bob, c, W, { fill: true, tint: 0.24 }),
        neon(['M74 79 C 92 70 112 64 128 54', 'M88 84 C 102 76 116 72 130 72'], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.55 }),
      ],
      eyes: eyes(c, 'M73 104 Q 81 97 91 103 Q 82 108 73 104 Z', [82, 103.4]),
      top: [
        neon(['M71 95 L 91 93', 'M109 92 L 130 87'], c, 3.2),
        neon('M101 106 L 97 123 L 103 124', ART.ink, 2, { glow: 0.4, hot: 0 }),
      ],
      ...mouths([neon(['M90 135 Q 101 138 113 131', 'M113 131 L 116 128'], ART.ink, 2.4)], 'M90 134 Q 101 137 113 131 Q 110 145 100 145 Q 92 143 90 134 Z'),
    };
  },
  chest: (c) => [
    neon('M84 160 L 82 178 L 100 188 L 118 178 L 116 160', c, 2.6, { glow: 0.6, hot: 0 }),
    neon('M100 188 L 100 220', ART.ink2, 1.8, { glow: 0, hot: 0, opacity: 0.6 }),
    neon(['M48 184 L 58 220', mirror('M48 184 L 58 220')], ART.orange, 2.2, { hot: 0, opacity: 0.85 }),
    neon('M90 170 L 100 192 L 110 170', ART.ink2, 1.8, { glow: 0, hot: 0, opacity: 0.8 }),
    // Cronômetro redondo (a forma do time).
    neon({ tag: 'circle', cx: 100, cy: 202, r: 11 }, c, 2.6, { fill: true, tint: 0.16 }),
    neon(['M100 191 L 100 187', 'M96 187 L 104 187'], c, 2.2, { hot: 0 }),
    neon('M100 202 L 105 195', ART.orange, 2, { glow: 0.8 }),
  ],
  // Indicador erguido ("um minuto, ritmo certo"), com o relógio no pulso.
  hand: (c) => [
    forearm(c, [146, 220, 150, 170], [178, 220, 174, 168]),
    neon('M148 160 L 147 144 Q 147 138 153 138 L 170 139 Q 175 140 175 146 L 174 156 Q 172 162 166 162 L 152 162 Q 148 162 148 160 Z', c, W, { fill: true, tint: 0.04 }),
    neon('M150 140 L 150 116 Q 150 111 155 111 Q 160 111 160 116 L 160 139', c, W, { fill: true, tint: 0.04 }),
    knuckles(161, 173, [147, 154]),
    neon({ tag: 'rect', x: 148, y: 162, width: 27, height: 9, rx: 2 }, ART.orange, 2.4, { fill: true, tint: 0.2 }),
  ],
};

// ---------------------------------------------------------------- Téo Faria (Volt)
const teo: Leader = {
  head: (c) => {
    const face = 'M100 64 C 124 64 138 78 138 99 C 138 120 132 136 118 147 L 108 153 Q 100 156 92 153 L 82 147 C 68 136 62 120 62 99 C 62 78 76 64 100 64 Z';
    const curls = 'M62 96 Q 50 86 57 74 Q 54 60 70 57 Q 76 45 92 49 Q 104 41 116 48 Q 132 44 140 58 Q 152 68 144 82 Q 150 92 138 96 L 136 90 Q 100 78 64 90 Z';
    return {
      base: [
        neon([EAR, mirror(EAR)], c, 2.6, { fill: true, hot: 0 }),
        neon(face, c, W, { fill: true }),
        neon(curls, c, W, { fill: true, tint: 0.22 }),
        // Faixa de testa com o triângulo do time.
        neon('M63 86 Q 100 72 137 86 L 138 96 Q 100 82 62 96 Z', ART.orange, 2.6, { fill: true, tint: 0.18 }),
        glowFill(glyph('triangulo', 100, 85, 4.4), c, { w: 1 }),
        // Barba por fazer.
        neon('M68 116 C 72 134 84 150 100 154 C 116 150 128 134 132 116', c, 2, { glow: 0, hot: 0, opacity: 0.6, dash: '1.5 4.5' }),
      ],
      eyes: [
        ...eyes(c, 'M72 106 Q 81 99 90 105 Q 81 110 72 106 Z', [81, 104.6]),
        neon(['M68 104 L 63 101', 'M68 108 L 63 110', mirror('M68 104 L 63 101'), mirror('M68 108 L 63 110')], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.7 }),
      ],
      top: [neon(['M70 99 Q 80 92 90 97', mirror('M70 99 Q 80 92 90 97')], c, 3.2), neon('M100 108 L 96 122 L 103 123', ART.ink, 2, { glow: 0.4, hot: 0 })],
      ...mouths(
        [
          neon('M83 129 Q 100 136 118 129 Q 113 143 100 143 Q 88 142 83 129 Z', ART.ink, 2.4, { fill: ART.dark.volt }),
          glowFill('M87 130.5 Q 100 135.5 114 130.5 L 113 134 Q 100 138.5 88 134 Z', ART.ink, { w: 0.6, glow: 0.4 }),
        ],
        'M82 127 Q 100 134 119 127 Q 115 151 100 151 Q 86 150 82 127 Z',
        [glowFill('M86 128.6 Q 100 134.6 115 128.6 L 114 133 Q 100 138 87 133 Z', ART.ink, { w: 0.6, glow: 0.4 })],
      ),
    };
  },
  chest: (c) => [
    neon(['M80 168 L 72 220', mirror('M80 168 L 72 220')], ART.ink2, 2.6, { glow: 0.3, hot: 0, opacity: 0.8 }),
    neon({ tag: 'rect', x: 82, y: 184, width: 36, height: 26, rx: 4 }, ART.ink, 2.2, { fill: true, tint: 0, glow: 0.5, hot: 0 }),
    glowFill(glyph('triangulo', 100, 198, 7), c, { w: 1.5 }),
  ],
  // Joinha, com a munhequeira laranja.
  hand: (c) => [
    forearm(c, [146, 220, 150, 170], [180, 220, 176, 168]),
    neon('M148 164 L 148 148 Q 148 142 154 142 L 172 142 Q 177 142 177 148 L 177 162 Q 175 168 169 168 L 154 168 Q 148 168 148 164 Z', c, W, { fill: true, tint: 0.04 }),
    neon('M150 143 L 152 122 Q 153 116 158 117 Q 163 118 162 124 L 161 142', c, W, { fill: true, tint: 0.04 }),
    knuckles(157, 176, [150, 156, 162]),
    neon({ tag: 'rect', x: 148, y: 168, width: 29, height: 9, rx: 2 }, ART.orange, 2.4, { fill: true, tint: 0.2 }),
  ],
};

// ---------------------------------------------------------------- Nara Lis (Owls)
const nara: Leader = {
  head: (c) => {
    const face = 'M100 64 C 119 64 133 77 134 97 C 135 117 129 133 117 144 L 107 151 Q 100 154 93 151 L 83 144 C 71 133 65 117 66 97 C 67 77 81 64 100 64 Z';
    const tail = 'M118 56 Q 154 38 168 62 Q 180 88 166 126 Q 168 98 152 82 Q 140 70 126 68 Z';
    const cap = 'M100 50 C 127 50 143 70 141 100 L 137 120 L 131 104 L 131 88 Q 100 80 69 88 L 69 104 L 63 120 L 59 100 C 57 70 73 50 100 50 Z';
    return {
      base: [
        neon(tail, c, W, { fill: true, tint: 0.24 }),
        neon(['M128 66 Q 150 66 160 92', 'M132 60 Q 158 56 166 80'], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.5 }),
        neon(face, c, W, { fill: true }),
        neon(cap, c, W, { fill: true, tint: 0.24 }),
        // Brincos em losango (a forma do time).
        glowFill([glyph('losango', 64, 128, 3.4), glyph('losango', 136, 128, 3.4)], c, { w: 1 }),
      ],
      eyes: eyes(c, 'M74 104 Q 82 99 91 103 Q 82 108 74 104 Z', [83, 103.6], { lid: 'M71 102 Q 81 95 92 101' }),
      top: [
        neon(['M72 94 Q 82 90 91 93', 'M109 92 Q 119 86 129 91'], c, 3),
        neon('M101 106 L 98 121 L 103 122', ART.ink, 2, { glow: 0.4, hot: 0 }),
        // Lanterna de cabeça: a luz da cidade (e a Corrida Segura).
        neon('M61 82 Q 100 66 139 82', ART.ink2, 2.6, { glow: 0.3, hot: 0 }),
        neon(glyph('losango', 100, 74, 7), c, 2.4, { fill: true, tint: 0.2 }),
        glowFill(glyph('losango', 100, 74, 3.2), ART.ink, { w: 0.8, glow: 1.4 }),
        neon(['M91 62 L 85 52', 'M100 60 L 100 48', 'M109 62 L 115 52'], ART.orange, 2.2, { hot: 0.5, opacity: 0.85 }),
      ],
      ...mouths([neon('M92 134 Q 101 139 110 133', ART.ink, 2.4)], 'M92 133 Q 101 136 110 132 Q 107 143 100 143 Q 94 142 92 133 Z'),
    };
  },
  chest: (c) => [
    neon('M74 164 Q 100 186 126 164', c, 2.6, { glow: 0.6, hot: 0 }),
    neon('M100 178 L 100 220', ART.ink2, 1.8, { glow: 0, hot: 0, opacity: 0.6 }),
    // Faixas refletivas.
    neon(['M30 200 L 76 190', mirror('M30 200 L 76 190')], ART.ink, 3, { glow: 1.2, hot: 0.6 }),
    neon(glyph('losango', 122, 206, 6), c, 2.2, { fill: true, tint: 0.2 }),
  ],
  // Aceno de mão aberta.
  hand: (c) => [
    forearm(c, [148, 220, 151, 170], [182, 220, 177, 168]),
    pivot(
      [
        neon(
          'M148 168 L 146 140 Q 146 135 150.5 135 Q 155 135 155 140 L 155 128 Q 155 123 159.5 123 Q 164 123 164 128 L 164 126 Q 164 121 168.5 121 Q 173 121 173 126 L 173 134 Q 173 130 177 130 Q 181 130 181 135 L 180 156 Q 178 168 167 170 L 153 170 Q 148 170 148 168 Z',
          c,
          W,
          { fill: true, tint: 0.04 },
        ),
        neon('M148 158 L 138 148 Q 135 144 139 141 Q 142 139 146 143 L 148 146', c, W, { fill: true, tint: 0.04 }),
      ],
      { x: 162, y: 170, rotate: 10 },
    ),
  ],
};

// ---------------------------------------------------------------- Bento Rocha (Coyotes)
const bento: Leader = {
  head: (c) => {
    const face = 'M68 78 Q 72 64 100 62 Q 128 64 132 78 L 136 118 L 126 142 L 110 152 L 90 152 L 74 142 L 64 118 Z';
    return {
      base: [
        neon([EAR, mirror(EAR)], c, 2.6, { fill: true, hot: 0 }),
        neon(face, c, W, { fill: true }),
        neon(['M65 94 L 67 114', mirror('M65 94 L 67 114')], ART.ink2, 3.4, { glow: 0.3, hot: 0 }),
        // Boné com o quadrado do time.
        neon('M63 92 Q 60 56 100 52 Q 140 56 137 92 Z', c, W, { fill: true, tint: 0.22 }),
        neon(['M100 54 L 100 90', 'M82 57 Q 76 72 78 90', mirror('M82 57 Q 76 72 78 90')], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.45 }),
        glowFill({ tag: 'circle', cx: 100, cy: 53, r: 2.6 }, c, { w: 0.8, glow: 0.5 }),
        neon(glyph('quadrado', 100, 74, 8), ART.orange, 2.4, { fill: true, tint: 0.2 }),
        // Aba do boné vista de frente: um crescente que desce sobre a testa.
        neon('M62 90 Q 100 82 138 90 Q 134 103 100 105 Q 66 103 62 90 Z', c, W, { fill: true, tint: 0.16 }),
      ],
      eyes: [
        ...eyes(c, 'M75 110 Q 82 105 90 109 Q 82 113 75 110 Z', [83, 109.2], { r: 2.8 }),
        neon(['M70 107 L 65 105', 'M70 112 L 65 114', mirror('M70 107 L 65 105'), mirror('M70 112 L 65 114')], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.7 }),
      ],
      top: [
        neon(['M72 102 L 91 99', mirror('M72 102 L 91 99')], ART.ink2, 4.4, { glow: 0.4, hot: 0 }),
        neon('M100 112 L 95 125 Q 100 129 106 125', ART.ink, 2, { glow: 0.4, hot: 0 }),
        // Bigode.
        glowFill('M83 134 Q 91 125 100 130 Q 109 125 117 134 Q 119 140 113 139 Q 106 136 100 137 Q 94 136 87 139 Q 81 140 83 134 Z', ART.ink, { w: 1, glow: 0.6 }),
      ],
      ...mouths([neon('M91 143 Q 100 147 109 143', ART.ink, 2.4)], 'M89 140 L 111 140 Q 110 154 100 154 Q 90 154 89 140 Z'),
    };
  },
  chest: (c) => [
    neon('M86 162 L 92 182 L 100 172 L 108 182 L 114 162', c, 2.6, { glow: 0.6, hot: 0 }),
    neon('M100 174 L 100 200', ART.ink2, 1.8, { glow: 0, hot: 0, opacity: 0.6 }),
    // Apito no cordão.
    neon(['M88 168 Q 96 192 110 202', 'M112 168 Q 116 186 114 198'], ART.ink2, 1.8, { glow: 0, hot: 0, opacity: 0.8 }),
    neon('M106 198 L 124 198 Q 128 198 128 203 Q 128 208 124 208 L 110 208 Q 106 208 106 203 Z', ART.orange, 2.4, { fill: true, tint: 0.2 }),
    neon(glyph('quadrado', 64, 202, 7), c, 2.4, { fill: true, tint: 0.2 }),
  ],
  // Mão espalmada, dedos juntos: "Toca aqui, chega mais!".
  hand: (c) => [
    forearm(c, [146, 220, 150, 168], [182, 220, 178, 166]),
    neon(
      'M148 166 L 147 128 Q 147 122 152 121 L 156 120 L 156 116 Q 157 110 163 110 L 168 111 Q 173 112 173 118 L 174 122 Q 180 123 180 130 L 179 156 Q 177 168 166 169 L 153 169 Q 148 169 148 166 Z',
      c,
      W,
      { fill: true, tint: 0.04 },
    ),
    neon(['M156 121 L 156 140', 'M165 112 L 165 140', 'M173 122 L 173 140'], ART.ink, 1.6, { glow: 0, hot: 0, opacity: 0.55 }),
    neon('M148 152 L 138 142 Q 134 138 138 135 Q 142 133 146 137 L 148 140', c, W, { fill: true, tint: 0.04 }),
  ],
};

const LEADERS: Record<FactionId, Leader> = { striders: iris, volt: teo, owls: nara, coyotes: bento };

export type LeaderParts = {
  /** Aura, ombros e roupa (fica parado). */
  back: ArtNode[];
  /** Cabeça em camadas, com a boca nas 2 versões; `tilt` é a inclinação estática em torno do pescoço. */
  head: Head;
  tilt: PivotOpts;
  /** Gesto de mão da fala (vazio no `parado`). */
  hand: ArtNode[];
};

const cache = new Map<string, LeaderParts>();

export function leaderParts(team: FactionId, pose: LeaderPose, color: string): LeaderParts {
  return memoArt(cache, `${team}|${pose}|${color}`, () => {
    const L = LEADERS[team];
    return {
      back: [...torso(color, team), ...L.chest(color)],
      head: L.head(color),
      tilt: { x: LEADER_PIVOTS.cabeca.x, y: LEADER_PIVOTS.cabeca.y, rotate: pose === 'falando' ? 3 : -2 },
      hand: pose === 'falando' ? L.hand(color) : [],
    };
  });
}

/** O líder inteiro numa árvore só (versão estática): a boca aberta só no `falando`. */
export function leaderNodes(team: FactionId, pose: LeaderPose, color: string): ArtNode[] {
  const p = leaderParts(team, pose, color);
  const mouth = pose === 'falando' ? p.head.open : p.head.closed;
  return [...p.back, pivot([...p.head.base, ...p.head.eyes, ...p.head.top, ...mouth], p.tilt), ...p.hand];
}
