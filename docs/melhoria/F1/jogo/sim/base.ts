/**
 * Simulação de território do NOMADE RUN (F1, Equipe E3) — base comum.
 * RNG com semente, H3, mapa de ruas (real do Flamboyant ou bairro sintético de 271 zonas)
 * e geometria das rotas. Tudo determinístico: mesma semente, mesmos números.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zoneOf, fogCellOf, cellsAround, cellCenter } from '../../../../../apps/mobile/src/domain/grid';
import { distanceMeters } from '../../../../../apps/mobile/src/domain/geo';
import type { LatLng } from '../../../../../apps/mobile/src/domain/types';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const h3 = require('../../../../../apps/mobile/node_modules/h3-js') as typeof import('h3-js');

export const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '../../../../..');

/* ------------------------------------------------------------------ RNG */
/** mulberry32: pequeno, rápido e reprodutível. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
    normal: (mu = 0, sd = 1) => {
      const u = Math.max(1e-12, next());
      const v = next();
      return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted: <T>(xs: readonly T[], ws: readonly number[]) => {
      const total = ws.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < xs.length; i++) {
        r -= ws[i];
        if (r <= 0) return xs[i];
      }
      return xs[xs.length - 1];
    },
  };
}
export type Rng = ReturnType<typeof rng>;

/* ------------------------------------------------------------------ Mapa */
export const CELL_RES = 11; // "trecho" da pintura: ~29 m de aresta, 49 por zona
export const cellOf = (p: LatLng) => h3.latLngToCell(p.lat, p.lng, CELL_RES);

export type Grafo = {
  nome: string;
  nos: LatLng[];
  adj: { to: number; len: number }[][];
  zonas: string[];
  centro: LatLng;
};

function addEdge(adj: { to: number; len: number }[][], a: number, b: number, len: number) {
  if (a === b || len <= 0.5) return;
  if (adj[a].some((e) => e.to === b)) return;
  adj[a].push({ to: b, len });
  adj[b].push({ to: a, len });
}

function maiorComponente(nos: LatLng[], adj: { to: number; len: number }[][]) {
  const comp = new Int32Array(nos.length).fill(-1);
  let best = -1;
  let bestSize = 0;
  let c = 0;
  for (let i = 0; i < nos.length; i++) {
    if (comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = c;
    let size = 0;
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const e of adj[u]) if (comp[e.to] < 0) (comp[e.to] = c), stack.push(e.to);
    }
    if (size > bestSize) (bestSize = size), (best = c);
    c++;
  }
  const map = new Int32Array(nos.length).fill(-1);
  const nn: LatLng[] = [];
  for (let i = 0; i < nos.length; i++) if (comp[i] === best) (map[i] = nn.length), nn.push(nos[i]);
  const na: { to: number; len: number }[][] = nn.map(() => []);
  for (let i = 0; i < nos.length; i++) {
    if (map[i] < 0) continue;
    for (const e of adj[i]) if (map[e.to] >= 0) na[map[i]].push({ to: map[e.to], len: e.len });
  }
  return { nos: nn, adj: na };
}

function zonasDoGrafo(nos: LatLng[], adj: { to: number; len: number }[][]) {
  const zs = new Set<string>();
  for (let i = 0; i < nos.length; i++) {
    for (const e of adj[i]) {
      if (e.to < i) continue;
      const n = Math.max(1, Math.ceil(e.len / 10));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        zs.add(zoneOf({ lat: nos[i].lat + (nos[e.to].lat - nos[i].lat) * t, lng: nos[i].lng + (nos[e.to].lng - nos[i].lng) * t }));
      }
    }
  }
  return [...zs].sort();
}

/** Ruas reais (Overture/OSM) do entorno do Parque Flamboyant, raio ~2,1 km (docs/apresentacao/mockup). */
export function mapaFlamboyant(): Grafo {
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'docs/apresentacao/mockup/build/mapa.json'), 'utf8'));
  const [LAT0, LNG0] = d.origin as [number, number];
  const KX = Math.cos((LAT0 * Math.PI) / 180) * 111320;
  const KY = 110574;
  const toLL = (x: number, y: number): LatLng => ({ lat: LAT0 - y / KY, lng: LNG0 + x / KX });
  const idx = new Map<string, number>();
  const nos: LatLng[] = [];
  const xy: [number, number][] = [];
  const adj: { to: number; len: number }[][] = [];
  const node = (x: number, y: number) => {
    const k = `${Math.round(x)}:${Math.round(y)}`;
    let i = idx.get(k);
    if (i === undefined) {
      i = nos.length;
      idx.set(k, i);
      nos.push(toLL(x, y));
      xy.push([x, y]);
      adj.push([]);
    }
    return i;
  };
  for (const layer of ['res', 'ter', 'sec', 'pri', 'path']) {
    const s: string = d.layers[layer];
    for (const sub of s.split('M')) {
      if (!sub.trim()) continue;
      const pts = sub.replace(/Z/g, '').split('L').map((q) => q.trim().split(/\s+/).map(Number) as [number, number]);
      for (let i = 1; i < pts.length; i++) {
        const a = node(pts[i - 1][0], pts[i - 1][1]);
        const b = node(pts[i][0], pts[i][1]);
        addEdge(adj, a, b, Math.hypot(xy[a][0] - xy[b][0], xy[a][1] - xy[b][1]));
      }
    }
  }
  const g = maiorComponente(nos, adj);
  return { nome: 'Flamboyant (ruas reais)', ...g, zonas: zonasDoGrafo(g.nos, g.adj), centro: { lat: LAT0, lng: LNG0 } };
}

/** Bairro sintético: as mesmas 271 zonas do seed (disco H3 k=9 no Flamboyant), quadras de 100 m. */
export function mapaBairro271(seed = 99): Grafo {
  const r = rng(seed);
  const centro = { lat: -16.7097, lng: -49.2388 };
  const disco = new Set(cellsAround(zoneOf(centro), 9));
  const KX = Math.cos((centro.lat * Math.PI) / 180) * 111320;
  const KY = 110574;
  const N = 32; // ±3,2 km
  const id = new Map<string, number>();
  const nos: LatLng[] = [];
  const adj: { to: number; len: number }[][] = [];
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      // ruas levemente tortas, como num bairro real
      const x = i * 100 + r.normal(0, 8);
      const y = j * 100 + r.normal(0, 8);
      const p = { lat: centro.lat - y / KY, lng: centro.lng + x / KX };
      if (!disco.has(zoneOf(p))) continue;
      id.set(`${i}:${j}`, nos.length);
      nos.push(p);
      adj.push([]);
    }
  }
  for (const [k, a] of id) {
    const [i, j] = k.split(':').map(Number);
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const b = id.get(`${i + di}:${j + dj}`);
      if (b === undefined) continue;
      if (r.next() < 0.08) continue; // 8% de quadras maiores (rua que não atravessa)
      addEdge(adj, a, b, distanceMeters(nos[a], nos[b]));
    }
  }
  const g = maiorComponente(nos, adj);
  return { nome: 'Bairro sintético (271 zonas do seed)', ...g, zonas: [...disco].sort(), centro };
}

/* ------------------------------------------------------------------ Rotas */
export type Rota = {
  id: number;
  metros: number;
  /** Um passo a cada ~10 m: zona (res 9), trecho (res 11) e célula de neblina (res 10) do ponto médio. */
  passoZona: string[];
  passoCelula: string[];
  passoNeblina: string[];
  passoMetros: number[];
  /** Metros válidos por zona, na ordem em que a rota entra em cada zona (igual ao finishRun). */
  zonaMetros: [string, number][];
  /** Trechos únicos, na ordem do percurso, com a distância da corrida em que foram pintados. */
  celulas: { cell: string; zona: string; marca: number }[];
  /** M2: trechos de dentro do circuito (só para a variante com "fechar o circuito"). */
  miolo: string[];
  pontos: LatLng[];
};

export type Dijkstra = (from: number, to: number) => number[];

export function criarDijkstra(g: Grafo): Dijkstra {
  const n = g.nos.length;
  const dist = new Float64Array(n);
  const prev = new Int32Array(n);
  return (from, to) => {
    dist.fill(Infinity);
    prev.fill(-1);
    dist[from] = 0;
    // heap binário simples
    const heap: [number, number][] = [[0, from]];
    const push = (x: [number, number]) => {
      heap.push(x);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      if (u === to) break;
      for (const e of g.adj[u]) {
        const nd = d + e.len;
        if (nd < dist[e.to]) {
          dist[e.to] = nd;
          prev[e.to] = u;
          push([nd, e.to]);
        }
      }
    }
    const path: number[] = [];
    for (let v = to; v !== -1; v = prev[v]) path.push(v);
    return path.reverse();
  };
}

const bearing = (a: LatLng, b: LatLng) => Math.atan2(b.lat - a.lat, (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180));

/**
 * Volta de corrida a partir de casa: anda com direção persistente que gira aos poucos (vira um circuito),
 * evita repetir ruas e volta pelo caminho mais curto quando a distância-alvo fecha.
 */
export function gerarRota(g: Grafo, dij: Dijkstra, casa: number, alvoM: number, r: Rng, id: number, comMiolo: boolean): Rota {
  const caminho = [casa];
  let andado = 0;
  let rumo = r.next() * 2 * Math.PI - Math.PI;
  const giro = (r.next() < 0.5 ? 1 : -1) * (Math.PI / Math.max(400, alvoM / 2)); // rad por metro
  const usadas = new Set<string>();
  let atual = casa;
  let anterior = -1;
  for (let guard = 0; guard < 5000; guard++) {
    const viz = g.adj[atual].filter((e) => e.to !== anterior);
    const opcoes = viz.length ? viz : g.adj[atual];
    const pesos = opcoes.map((e) => {
      const b = bearing(g.nos[atual], g.nos[e.to]);
      const k = `${Math.min(atual, e.to)}-${Math.max(atual, e.to)}`;
      return Math.exp(2 * Math.cos(b - rumo)) * (usadas.has(k) ? 0.05 : 1);
    });
    const e = r.weighted(opcoes, pesos);
    usadas.add(`${Math.min(atual, e.to)}-${Math.max(atual, e.to)}`);
    anterior = atual;
    atual = e.to;
    caminho.push(atual);
    andado += e.len;
    rumo += giro * e.len + r.normal(0, 0.05);
    const volta = distanceMeters(g.nos[atual], g.nos[casa]) * 1.3;
    if (andado + volta >= alvoM) break;
  }
  const back = dij(atual, casa);
  caminho.push(...back.slice(1));
  return geometria(g, caminho, id, comMiolo);
}

function geometria(g: Grafo, caminho: number[], id: number, comMiolo: boolean): Rota {
  const pontos: LatLng[] = [];
  for (let i = 1; i < caminho.length; i++) {
    const a = g.nos[caminho[i - 1]];
    const b = g.nos[caminho[i]];
    const len = distanceMeters(a, b);
    const n = Math.max(1, Math.round(len / 10));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      pontos.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
    }
  }
  const passoZona: string[] = [];
  const passoCelula: string[] = [];
  const passoNeblina: string[] = [];
  const passoMetros: number[] = [];
  const zm = new Map<string, number>();
  const celulas: Rota['celulas'] = [];
  const vistas = new Set<string>();
  let total = 0;
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    const m = distanceMeters(a, b);
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const z = zoneOf(mid);
    const c = cellOf(mid);
    passoZona.push(z);
    passoCelula.push(c);
    passoNeblina.push(fogCellOf(mid));
    passoMetros.push(m);
    zm.set(z, (zm.get(z) ?? 0) + m);
    total += m;
    if (!vistas.has(c)) {
      vistas.add(c);
      celulas.push({ cell: c, zona: z, marca: total });
    }
  }
  let miolo: string[] = [];
  if (comMiolo && pontos.length > 10) {
    try {
      const anel = pontos.filter((_, i) => i % 3 === 0).map((p) => [p.lat, p.lng]);
      miolo = h3.polygonToCells([anel], CELL_RES).filter((c) => !vistas.has(c)).sort();
    } catch {
      miolo = [];
    }
  }
  return { id, metros: total, passoZona, passoCelula, passoNeblina, passoMetros, zonaMetros: [...zm], celulas, miolo, pontos };
}

export { zoneOf, cellCenter };
