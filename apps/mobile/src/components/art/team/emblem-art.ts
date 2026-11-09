/**
 * Emblema do time v2 (F8 · D-90): a **cabeça do mascote dentro da forma do time**. A forma (círculo,
 * triângulo, losango, quadrado) é a moldura em qualquer tamanho — a pista para daltônicos. A cabeça muda de
 * silhueta para rosto desenhado conforme o tamanho:
 *   - `mini`   (18–39 pt): forma cheia na cor; cabeça recortada na cor do fundo (2 cores); pupilas a partir de 24.
 *   - `medio`  (40–95 pt): halo + contorno da forma; cabeça cheia na cor com feições escuras e 1 acento laranja.
 *   - `grande` (96+ pt):   moldura com brilho em camadas + rosto line-art do mascote (`faceNodes`).
 *   - `mono`: uma cor só (forma em `color`, cabeça em `on`) para botões e chips coloridos.
 *   - `neutro` (`team = null`): anel tracejado + miolo apagado, a mesma linguagem do mapa para zona sem dono.
 * Geometria portada 1:1 de `docs/melhoria/F8/arte/fonte/emblema.cjs` (rodada 3, aprovada em `F8/02` §2).
 * Regra de desenho: **nenhuma linha** no mini/médio — polígonos cheios e feições como polígonos na cor do
 * fundo (`on`), para funcionar a 18 pt e sobre qualquer fundo. Puro, sem lógica de jogo.
 */
import type { FactionId } from '@/domain/types';
import { palette, type TeamShape } from '@/theme/tokens';

import { group, memoArt, neon, plain, solid, type ArtNode, type Matrix, type Shape } from '../neon/core';
import { ART, teamName, teamShape } from '../neon/palette';
import { faceNodes } from './mascot-art';

export const EMBLEM_BOX = { vbW: 100, vbH: 100 } as const;
/** Piso de tamanho (D-90): abaixo disso nem a forma lê. O componente arredonda para cima. */
export const EMBLEM_MIN_SIZE = 18;
/** A partir deste tamanho a cabeça é o rosto line-art; abaixo, nunca (vira borrão). */
export const EMBLEM_LINE_ART_MIN = 96;
/** A partir deste tamanho o mini ganha pupilas na cor do time. */
export const EMBLEM_PUPILS_MIN = 24;

export type EmblemVariant = 'mini' | 'medio' | 'grande';
export type EmblemVariantProp = EmblemVariant | 'auto';
export const EMBLEM_VARIANTS: readonly EmblemVariant[] = ['mini', 'medio', 'grande'];

/** `auto`: < 40 → mini · < 96 → médio · ≥ 96 → grande. */
export function resolveEmblemVariant(v: EmblemVariantProp | undefined, size: number): EmblemVariant {
  if (v && v !== 'auto') return v;
  return size < 40 ? 'mini' : size < EMBLEM_LINE_ART_MIN ? 'medio' : 'grande';
}

/** Rótulo para quando o emblema é informativo (lista de times, cabeçalho). */
export function emblemLabel(team: FactionId | null): string {
  return team ? `Emblema dos ${teamName(team)}` : 'Zona neutra, sem time';
}

/** Caixa da cabeça dentro da forma: centro (cx, cy) e escala, no viewBox 100 × 100. */
type HeadFit = readonly [cx: number, cy: number, k: number];

/** Formas da moldura (viewBox 100 × 100) e onde a cabeça cabe em cada variante. */
export const EMBLEM_SHAPES: Record<TeamShape, { d: string; head: Record<EmblemVariant, HeadFit> }> = {
  circulo: { d: 'M50 4 A 46 46 0 1 1 49.99 4 Z', head: { mini: [50, 52, 0.72], medio: [50, 52, 0.7], grande: [50, 52, 0.74] } },
  // triângulo com cantos arredondados (ponta para cima)
  triangulo: {
    d: 'M44 10 Q 50 2 56 10 L 95 80 Q 99 90 89 90 L 11 90 Q 1 90 5 80 Z',
    head: { mini: [50, 60, 0.62], medio: [50, 60, 0.6], grande: [50, 64, 0.52] },
  },
  losango: {
    d: 'M50 3 Q 53 3 56 6 L 94 44 Q 98 50 94 56 L 56 94 Q 50 98 44 94 L 6 56 Q 2 50 6 44 L 44 6 Q 47 3 50 3 Z',
    head: { mini: [50, 50, 0.7], medio: [50, 50, 0.68], grande: [50, 50, 0.7] },
  },
  quadrado: {
    d: 'M22 6 L 78 6 Q 94 6 94 22 L 94 78 Q 94 94 78 94 L 22 94 Q 6 94 6 78 L 6 22 Q 6 6 22 6 Z',
    head: { mini: [50, 52, 0.84], medio: [50, 52, 0.82], grande: [50, 52, 0.84] },
  },
};

type Dot = readonly [x: number, y: number, r: number];
/**
 * Cabeça em silhueta fechada (viewBox 100 × 100): `sil` = silhueta (cor do time), `feat` = feições recortadas
 * (cor do fundo), `acc` = acento laranja (só médio), `dots`/`teeth`/`eyeGlow` = detalhes do médio;
 * `eyes`/`pupils` = os discos do Breu.
 */
type Head = { sil: Shape[]; feat: Shape[]; acc: Shape[]; dots?: Dot[]; eyeGlow?: Dot[]; teeth?: Shape[]; eyes?: Dot[]; pupils?: Dot[] };

export const EMBLEM_HEADS: Record<FactionId, Head> = {
  // Lume · onça: testa larga, orelhas altas arredondadas, tufos nas bochechas, queixo estreito, manchas.
  striders: {
    sil: [
      'M50 20 C 68 20 82 30 84 48 L 86 60 L 80 66 L 84 74 L 74 78 C 68 88 58 92 50 92 C 42 92 32 88 26 78 L 16 74 L 20 66 L 14 60 L 16 48 C 18 30 32 20 50 20 Z',
      'M26 36 C 14 30 12 10 24 6 C 34 4 42 14 42 26 Z',
      'M74 36 C 86 30 88 10 76 6 C 66 4 58 14 58 26 Z',
    ],
    feat: ['M27 50 L 46 55 L 44 62 L 30 58 Z', 'M73 50 L 54 55 L 56 62 L 70 58 Z', 'M44 70 L 56 70 L 50 77 Z', 'M38 80 Q 44 86 50 80 Q 56 86 62 80 Q 50 90 38 80 Z'],
    acc: ['M24 16 C 24 10 30 10 32 16 C 33 21 30 26 28 26 Z', 'M76 16 C 76 10 70 10 68 16 C 67 21 70 26 72 26 Z'],
    dots: [
      [50, 30, 2.6],
      [40, 36, 1.8],
      [60, 36, 1.8],
      [26, 66, 1.6],
      [74, 66, 1.6],
    ],
    eyeGlow: [
      [37, 55, 2.6],
      [63, 55, 2.6],
    ],
  },
  // Faísca · lebre: rosto afilado, duas orelhas altas que entram no vértice do triângulo, sorriso com dentes.
  volt: {
    sil: ['M22 50 Q 50 40 78 50 L 84 66 Q 78 86 50 96 Q 22 86 16 66 Z', 'M28 58 L 16 14 Q 17 2 30 4 L 50 50 Z', 'M72 58 L 84 14 Q 83 2 70 4 L 50 50 Z'],
    feat: ['M28 58 L 47 61 L 45 70 L 30 66 Z', 'M72 58 L 53 61 L 55 70 L 70 66 Z', 'M36 78 Q 50 87 64 78 L 62 84 Q 50 92 38 84 Z'],
    acc: ['M27 12 L 37 28 L 32 30 L 43 46 L 30 32 L 35 30 Z', 'M73 12 L 63 28 L 68 30 L 57 46 L 70 32 L 65 30 Z'],
    teeth: ['M46 81 L 54 81 L 54 85 Q 50 86 46 85 Z'],
    eyeGlow: [
      [39, 65, 2.4],
      [61, 65, 2.4],
    ],
  },
  // Breu · coruja: tufos como chifres, olhos enormes (discos), bico losango, sobrancelhas em V.
  owls: {
    sil: ['M50 22 L 64 16 L 78 4 L 76 28 L 84 46 Q 84 76 50 94 Q 16 76 16 46 L 24 28 L 22 4 L 36 16 Z'],
    feat: [
      { tag: 'circle', cx: 36, cy: 50, r: 11 },
      { tag: 'circle', cx: 64, cy: 50, r: 11 },
      'M50 59 L 56 67 L 50 77 L 44 67 Z',
      'M22 42 L 38 36 L 40 40 L 24 46 Z',
      'M78 42 L 62 36 L 60 40 L 76 46 Z',
    ],
    acc: [],
    eyes: [
      [36, 50, 7.5],
      [64, 50, 7.5],
    ],
    pupils: [
      [37.5, 50, 3],
      [65.5, 50, 3],
    ],
  },
  // Faro · coiote: orelhas pontudas largas, focinho longo, bandana sob o queixo.
  coyotes: {
    sil: ['M50 26 L 70 22 L 88 2 L 86 40 L 78 58 L 64 72 L 56 86 L 44 86 L 36 72 L 22 58 L 14 40 L 12 2 L 30 22 Z'],
    feat: ['M26 46 L 44 51 L 42 58 L 28 54 Z', 'M74 46 L 56 51 L 58 58 L 72 54 Z', { tag: 'rect', x: 43, y: 70, width: 14, height: 9, rx: 3.5 }, 'M20 12 L 30 26 L 20 30 Z', 'M80 12 L 70 26 L 80 30 Z'],
    acc: ['M30 88 L 70 88 L 50 100 Z'],
    eyeGlow: [
      [34, 53, 2.4],
      [66, 53, 2.4],
    ],
  },
};

const dot = ([cx, cy, r]: Dot): Shape => ({ tag: 'circle', cx, cy, r });
/** `translate(cx cy) scale(k) translate(-50 -50)` como matriz. */
const fitMatrix = ([cx, cy, k]: HeadFit): Matrix => [k, 0, 0, k, cx - 50 * k, cy - 50 * k];

type HeadMode = 'mini' | 'mini-pupilas' | 'medio' | 'mono';

/**
 * A cabeça já encaixada na forma. `fill` é a cor da silhueta e `cut` a cor das feições: no mini e no mono a
 * silhueta é o recorte (cor do fundo) e as feições voltam na cor da forma; no médio é o contrário.
 */
function headNodes(team: FactionId, mode: HeadMode, fill: string, cut: string, fit: HeadFit): ArtNode {
  const h = EMBLEM_HEADS[team];
  const kids: ArtNode[] = [solid(h.sil, fill)];
  if (mode === 'medio' && h.acc.length) kids.push(solid(h.acc, ART.orange));
  kids.push(solid(h.feat, cut));
  if (h.eyes && h.pupils) {
    kids.push(solid(h.eyes.map(dot), mode === 'medio' ? ART.orange : fill));
    kids.push(solid(h.pupils.map(dot), cut));
  }
  if (mode === 'medio') {
    if (h.dots) kids.push(solid(h.dots.map(dot), cut));
    if (h.teeth) kids.push(solid(h.teeth, ART.ink));
    if (h.eyeGlow) kids.push(solid(h.eyeGlow.map(dot), fill));
  }
  if (mode === 'mini-pupilas' && h.eyeGlow) kids.push(solid(h.eyeGlow.map(dot), fill));
  return group(kids, { matrix: fitMatrix(fit) });
}

/** mini · forma cheia na cor; cabeça recortada em `on` (pupilas na cor a partir de 24 pt). */
export function emblemMiniNodes(team: FactionId, color: string, on: string, pupils: boolean): ArtNode[] {
  const s = EMBLEM_SHAPES[teamShape(team)];
  return [solid(s.d, color), headNodes(team, pupils ? 'mini-pupilas' : 'mini', on, color, s.head.mini)];
}

/** médio · halo leve + contorno com tinta; cabeça cheia na cor com feições em `on` e 1 acento laranja. */
export function emblemMedioNodes(team: FactionId, color: string, on: string): ArtNode[] {
  const s = EMBLEM_SHAPES[teamShape(team)];
  return [plain(s.d, color, 12, 0.22), solid(s.d, color, 0.12), plain(s.d, color, 4.5), headNodes(team, 'medio', color, on, s.head.medio)];
}

/** grande · moldura com 3 camadas de brilho + rosto line-art do mascote (`faceNodes`, viewBox do busto). */
export function emblemGrandeNodes(team: FactionId, color: string): ArtNode[] {
  const s = EMBLEM_SHAPES[teamShape(team)];
  const [cx, cy, k] = s.head.grande;
  // o rosto do busto (200 × 220) tem a cabeça entre y ≈ 6 e 165, centro ≈ (100, 96), e cabe numa caixa de ~150
  const headK = (k * 100) / 150;
  return [
    plain(s.d, color, 14, 0.16),
    plain(s.d, color, 8, 0.35),
    solid(s.d, color, 0.08),
    plain(s.d, color, 3.2),
    plain(s.d, ART.ink, 1, 0.55),
    group(faceNodes(team, 'parado', color), { matrix: [headK, 0, 0, headK, cx - 100 * headK, cy - 96 * headK] }),
  ];
}

/** mono · uma cor só: forma cheia em `color`, cabeça vazada em `on` (a cor do fundo), feições de volta em `color`. */
export function emblemMonoNodes(team: FactionId, color: string, on: string): ArtNode[] {
  const s = EMBLEM_SHAPES[teamShape(team)];
  return [solid(s.d, color), headNodes(team, 'mono', on, color, s.head.mini)];
}

/** Miolo apagado da zona neutra (tom de fundo, não cor de marca). */
const NEUTRAL_CORE = '#1A1B20';

/** neutro (zona sem time) · anel tracejado + miolo apagado. */
export function emblemNeutroNodes(color: string = ART.ink2): ArtNode[] {
  return [neon({ tag: 'circle', cx: 50, cy: 50, r: 44 }, color, 5, { fill: NEUTRAL_CORE, glow: 0, hot: 0, dash: '10 8' }), solid({ tag: 'circle', cx: 50, cy: 50, r: 9 }, color, 0.5)];
}

/** Anel tracejado vermelho por fora (zona sob ataque), o mesmo sinal do mapa: o emblema encolhe para 78 %. */
export function withAttackRing(nodes: ArtNode[], ring: string = palette.danger): ArtNode[] {
  return [group(nodes, { matrix: [0.78, 0, 0, 0.78, 11, 11] }), neon({ tag: 'circle', cx: 50, cy: 50, r: 47 }, ring, 5, { glow: 0, hot: 0, dash: '9 7' })];
}

export type EmblemOpts = {
  variant: EmblemVariant;
  /** Tamanho em pt (decide as pupilas do mini). */
  size: number;
  /** Cor do time; padrão `neonTeam[team]` (D-90: neon, nunca a cor sólida dos tokens). */
  color?: string;
  /** Cor do fundo onde o emblema está (as feições são polígonos nesta cor); padrão `neon.bg`. */
  on?: string;
  mono?: boolean;
  attack?: boolean;
};

const cache = new Map<string, ArtNode[]>();

/** O emblema completo: `team = null` é a zona neutra. Só o `grande` muda com a qualidade (os outros são cheios). */
export function emblemNodes(team: FactionId | null, o: EmblemOpts): ArtNode[] {
  const on = o.on ?? ART.bg;
  const color = o.color ?? (team ? ART.team[team] : ART.ink2);
  return memoArt(cache, `${team ?? 'neutro'}|${o.variant}|${o.size >= EMBLEM_PUPILS_MIN ? 'p' : ''}|${color}|${on}|${o.mono ? 'm' : ''}|${o.attack ? 'a' : ''}`, () => {
    let nodes: ArtNode[];
    if (!team) nodes = emblemNeutroNodes(o.color);
    else if (o.mono) nodes = emblemMonoNodes(team, color, on);
    else if (o.variant === 'grande') nodes = emblemGrandeNodes(team, color);
    else if (o.variant === 'medio') nodes = emblemMedioNodes(team, color, on);
    else nodes = emblemMiniNodes(team, color, on, o.size >= EMBLEM_PUPILS_MIN);
    return o.attack ? withAttackRing(nodes) : nodes;
  });
}
