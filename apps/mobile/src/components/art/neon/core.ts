/**
 * Núcleo do traço "neon line-art geométrico" (porte de `docs/melhoria/F1/arte/fonte/neon.cjs`).
 *
 * A arte é descrita como dados (`ArtNode`): cada traço neon guarda a geometria uma vez, e `expand()`
 * gera as camadas conforme a qualidade. O brilho vem de camadas de stroke da mesma cor, **sem filtro de
 * desfoque**, então roda igual no Android, no iOS e na web. O resultado (`Prim`) é uma árvore plana de
 * elementos SVG que o componente React desenha 1:1 (`render.tsx`) e que o script de evidência serializa
 * para PNG com os mesmos números (`markup.ts`).
 *
 * Este arquivo é puro (sem React): nada de lógica de jogo, só geometria.
 */
import { ART, mix, PRISM } from './palette';

/** Níveis de qualidade: `completo` (4 camadas), `leve` (2) e `plano` (só o núcleo). */
export type Quality = 'completo' | 'leve' | 'plano';
/** `auto` escolhe pelo tamanho: ≥ 96 → completo, ≥ 40 → leve, menor → plano. */
export type QualityProp = Quality | 'auto';

export function resolveQuality(q: QualityProp | undefined, size: number): Quality {
  if (q && q !== 'auto') return q;
  if (size >= 96) return 'completo';
  if (size >= 40) return 'leve';
  return 'plano';
}

export type Shape =
  | string
  | { tag: 'circle'; cx: number; cy: number; r: number }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { tag: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

export type NeonOpts = {
  /** `true` → escuro opaco + tinta da cor; string → cor do preenchimento. */
  fill?: boolean | string;
  /** Opacidade da tinta da cor sobre o escuro (padrão 0,1). */
  tint?: number;
  /** Multiplicador do halo (0 desliga). */
  glow?: number;
  /** Opacidade do filete quente (0 desliga). */
  hot?: number;
  dash?: string;
  opacity?: number;
};

export type ArtNode =
  | { kind: 'neon'; shapes: Shape[]; color: string; w: number; opts: NeonOpts }
  | { kind: 'glow'; shapes: Shape[]; color: string; w: number; glow: number; opacity: number }
  | { kind: 'plain'; shapes: Shape[]; stroke: string; w: number; opacity?: number }
  | { kind: 'group'; children: ArtNode[]; matrix?: Matrix; opacity?: number };

/** Matriz SVG `matrix(a b c d e f)`. */
export type Matrix = readonly [number, number, number, number, number, number];

export type PrimTag = 'g' | 'path' | 'circle' | 'rect' | 'ellipse';
/** Elemento SVG pronto: props com os nomes do react-native-svg (camelCase). */
export type Prim = { tag: PrimTag; a: Record<string, string | number>; c?: Prim[] };

const list = <T>(x: T | T[]): T[] => (Array.isArray(x) ? x : [x]);
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- construtores

/** Traço neon: (preenchimento opcional que tapa o que está atrás) + 2 halos + núcleo + filete quente. */
export function neon(shapes: Shape | Shape[], color: string, w: number, opts: NeonOpts = {}): ArtNode {
  return { kind: 'neon', shapes: list(shapes), color, w, opts };
}

/** Forma cheia que brilha (pupila, nariz, gema). */
export function glowFill(shapes: Shape | Shape[], color: string, opt: { glow?: number; w?: number; opacity?: number } = {}): ArtNode {
  return { kind: 'glow', shapes: list(shapes), color, w: opt.w ?? 2, glow: opt.glow ?? 1, opacity: opt.opacity ?? 1 };
}

/** Traço simples, sem brilho (ex.: cortes "synthwave" na cor do fundo). */
export function plain(shapes: Shape | Shape[], stroke: string, w: number, opacity?: number): ArtNode {
  return { kind: 'plain', shapes: list(shapes), stroke, w, opacity };
}

export function group(children: ArtNode[], opt: { matrix?: Matrix; opacity?: number } = {}): ArtNode {
  return { kind: 'group', children, ...opt };
}

export type PivotOpts = { x?: number; y?: number; rotate?: number; scale?: number; tx?: number; ty?: number };

/** Matriz de `translate(tx ty) translate(x y) rotate(r) scale(s) translate(-x -y)` (o "pivô" do F1). */
export function pivotMatrix({ x = 0, y = 0, rotate = 0, scale = 1, tx = 0, ty = 0 }: PivotOpts): Matrix {
  const t = (rotate * Math.PI) / 180;
  const a = scale * Math.cos(t);
  const b = scale * Math.sin(t);
  const c = -b;
  const d = a;
  return [a, b, c, d, tx + x - (a * x + c * y), ty + y - (b * x + d * y)];
}

/** Grupo transformado em torno de um ponto. */
export function pivot(children: ArtNode[], opts: PivotOpts & { opacity?: number }): ArtNode {
  return group(children, { matrix: pivotMatrix(opts), opacity: opts.opacity });
}

export type GlyphKind = 'circulo' | 'triangulo' | 'losango' | 'quadrado';

/** Forma do time centrada em (cx, cy) com "raio" r. */
export function glyph(kind: GlyphKind, cx: number, cy: number, r: number): Shape {
  switch (kind) {
    case 'circulo':
      return { tag: 'circle', cx, cy, r };
    case 'triangulo':
      return `M${r2(cx)} ${r2(cy - r * 1.1)} L${r2(cx + r * 1.05)} ${r2(cy + r * 0.75)} L${r2(cx - r * 1.05)} ${r2(cy + r * 0.75)} Z`;
    case 'losango':
      return `M${r2(cx)} ${r2(cy - r * 1.2)} L${r2(cx + r)} ${r2(cy)} L${r2(cx)} ${r2(cy + r * 1.2)} L${r2(cx - r)} ${r2(cy)} Z`;
    case 'quadrado':
      return { tag: 'rect', x: r2(cx - r * 0.85), y: r2(cy - r * 0.85), width: r2(r * 1.7), height: r2(r * 1.7), rx: r2(r * 0.22) };
  }
}

/** Espelha um path simples (comandos absolutos M L C Q Z com pares x,y) no eixo x = cx. */
export function mirror(d: string, cx = 100): string {
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${r2(2 * cx - Number(x))} ${y}`);
}

/** Ponto em coordenadas polares (graus), formatado "x y". */
export function pt(cx: number, cy: number, r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
}

/** Estrela de n pontas (r1 externo, r2 interno). */
export function star(cx: number, cy: number, r1: number, r2_: number, n = 8, rot = 0): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) d += (i ? ' L' : 'M') + pt(cx, cy, i % 2 ? r2_ : r1, rot + (i * 180) / n);
  return d + ' Z';
}

/** Linhas de velocidade (identidade "corrida"). */
export function speedLines(color: string, lines: readonly (readonly [number, number, number])[], w = 2.2, op = 0.6): ArtNode {
  return neon(lines.map(([x1, y, x2]) => `M${x1} ${y} L${x2} ${y}`), color, w, { hot: 0, opacity: op });
}

/** Faísca em cruz. */
export function spark(cx: number, cy: number, r: number, color: string, w = 2): ArtNode {
  return neon([`M${cx} ${cy - r} L${cx} ${cy + r}`, `M${cx - r} ${cy} L${cx + r} ${cy}`], color, w, { hot: 0.6 });
}

// ---------------------------------------------------------------- expansão em camadas

function shapePrim(s: Shape): Prim {
  if (typeof s === 'string') return { tag: 'path', a: { d: s } };
  const { tag, ...rest } = s;
  return { tag, a: rest as Record<string, number> };
}

function layerGroup(shapes: Shape[], a: Record<string, string | number>): Prim {
  return { tag: 'g', a, c: shapes.map(shapePrim) };
}

type Ctx = { quality: Quality; gradId: string };

function paint(color: string, ctx: Ctx): string {
  return color === PRISM ? `url(#${ctx.gradId})` : color;
}

function expandNeon(n: Extract<ArtNode, { kind: 'neon' }>, ctx: Ctx): Prim {
  const { fill, tint = 0.1, glow = 1, hot = 0.5, dash, opacity = 1 } = n.opts;
  const color = paint(n.color, ctx);
  const out: Prim[] = [];
  if (fill) {
    out.push(layerGroup(n.shapes, { fill: fill === true ? ART.panel : paint(fill, ctx), stroke: 'none' }));
    if (fill === true && tint) out.push(layerGroup(n.shapes, { fill: color, fillOpacity: tint, stroke: 'none' }));
  }
  const layer = (sw: number, op: number, col = color) => {
    const a: Record<string, string | number> = {
      fill: 'none',
      stroke: col,
      strokeWidth: r2(sw),
      strokeOpacity: Math.round(op * 1000) / 1000,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    };
    if (dash) a.strokeDasharray = dash;
    return layerGroup(n.shapes, a);
  };
  if (glow) {
    if (ctx.quality === 'completo') out.push(layer(n.w * 4.6, 0.07 * glow), layer(n.w * 2.4, 0.2 * glow));
    else if (ctx.quality === 'leve') out.push(layer(n.w * 2.4, 0.26 * glow));
  }
  out.push(layer(n.w, 1));
  if (hot && ctx.quality === 'completo') {
    out.push(layer(Math.max(0.7, n.w * 0.36), hot, n.color === PRISM ? ART.white : mix(n.color, ART.white, 0.72)));
  }
  return { tag: 'g', a: opacity === 1 ? {} : { opacity }, c: out };
}

function expandGlow(n: Extract<ArtNode, { kind: 'glow' }>, ctx: Ctx): Prim {
  const color = paint(n.color, ctx);
  const out: Prim[] = [];
  const halo = (sw: number, op: number) =>
    layerGroup(n.shapes, { fill: 'none', stroke: color, strokeLinejoin: 'round', strokeWidth: r2(sw), strokeOpacity: Math.round(op * 1000) / 1000 });
  if (n.glow) {
    if (ctx.quality === 'completo') out.push(halo(n.w * 4, 0.08 * n.glow), halo(n.w * 2, 0.22 * n.glow));
    else if (ctx.quality === 'leve') out.push(halo(n.w * 2, 0.28 * n.glow));
  }
  out.push(layerGroup(n.shapes, { fill: color, stroke: color, strokeWidth: r2(n.w * 0.5), strokeLinejoin: 'round' }));
  return { tag: 'g', a: n.opacity === 1 ? {} : { opacity: n.opacity }, c: out };
}

function expandNode(n: ArtNode, ctx: Ctx): Prim {
  switch (n.kind) {
    case 'neon':
      return expandNeon(n, ctx);
    case 'glow':
      return expandGlow(n, ctx);
    case 'plain': {
      const a: Record<string, string | number> = { fill: 'none', stroke: paint(n.stroke, ctx), strokeWidth: r2(n.w), strokeLinecap: 'round' };
      if (n.opacity !== undefined) a.opacity = n.opacity;
      return layerGroup(n.shapes, a);
    }
    case 'group': {
      const a: Record<string, string | number> = {};
      if (n.matrix) a.transform = `matrix(${n.matrix.map((v) => Math.round(v * 10000) / 10000).join(' ')})`;
      if (n.opacity !== undefined && n.opacity !== 1) a.opacity = n.opacity;
      return { tag: 'g', a, c: n.children.map((ch) => expandNode(ch, ctx)) };
    }
  }
}

/** Gera os elementos SVG de uma arte na qualidade pedida. `gradId` é o id do gradiente "prisma". */
export function expand(nodes: ArtNode[], quality: Quality, gradId = 'prisma'): Prim[] {
  const ctx = { quality, gradId };
  return nodes.map((n) => expandNode(n, ctx));
}

/**
 * Silhueta: troca toda cor de traço e de preenchimento por `color` (o "flash" branco do golpe, E5). As
 * opacidades ficam, então o brilho continua em camadas; o escuro de preenchimento vira cor cheia.
 */
export function recolorPrims(prims: Prim[], color: string): Prim[] {
  return prims.map((p) => {
    const a: Record<string, string | number> = { ...p.a };
    if (a.stroke !== undefined && a.stroke !== 'none') a.stroke = color;
    if (a.fill !== undefined && a.fill !== 'none') a.fill = color;
    return p.c ? { tag: p.tag, a, c: recolorPrims(p.c, color) } : { tag: p.tag, a };
  });
}

/** Caixa do card (E8): centro e lado do quadrado, nas unidades do SVG de fora. */
export type SvgArtBox = { cx: number; cy: number; size: number };

/** Transformação que leva o viewBox `vbW × vbH` para dentro do quadrado `box` (centrado, proporção mantida). */
export function fitTransform(vb: { vbW: number; vbH: number }, box: SvgArtBox): { scale: number; x: number; y: number } {
  const scale = box.size / Math.max(vb.vbW, vb.vbH);
  return { scale, x: box.cx - (vb.vbW * scale) / 2, y: box.cy - (vb.vbH * scale) / 2 };
}

/** Quantidade de elementos SVG (para medir o custo de cada nível de qualidade). */
export function countPrims(prims: Prim[]): number {
  return prims.reduce((s, p) => s + 1 + (p.c ? countPrims(p.c) : 0), 0);
}

/** Diz se a arte usa o gradiente "prisma" (para declarar o `<Defs>` só quando precisa). */
export function usesPrism(nodes: ArtNode[]): boolean {
  return nodes.some((n) =>
    n.kind === 'group' ? usesPrism(n.children) : n.kind === 'plain' ? n.stroke === PRISM : n.color === PRISM || (n.kind === 'neon' && n.opts.fill === PRISM),
  );
}

/** Cache pequeno de módulo para as artes (as mesmas props geram a mesma geometria). */
export function memoArt<T>(cache: Map<string, T>, key: string, build: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit;
  const v = build();
  if (cache.size > 400) cache.clear();
  cache.set(key, v);
  return v;
}
