/**
 * T7.2.3 / T7.3.6 — simulação do território v2 como teste de regressão (versão enxuta da simulação da F1,
 * `docs/melhoria/F1/jogo/sim/`), com a regra REAL (`PaintSim` → `applyPaint`).
 *
 * - Bairro sintético: disco H3 de zonas (res 9) com quadras de 100 m levemente tortas.
 * - Corredores: veteranos (50% iniciante 3 km 2×/sem, 35% regular 5 km 4×/sem, 15% avançado 15 km 6×/sem)
 *   e novatos (iniciantes e regulares) que chegam num mapa já ocupado nas semanas 1 a 6.
 * - 4 semanas de aquecimento + 8 semanas medidas; desbotar às 03:00; virada de temporada no dia 1.
 * - Tudo com semente fixa: rodar de novo dá os mesmos números.
 *
 * Métricas usadas como alvo (D-62, PLANO-MESTRE §0): novato iniciante que conquista na 1ª corrida,
 * zonas eternas (mesmo dono nas 8 semanas) e custo mediano para um rival tomar uma zona.
 */
import { cellsAround, zoneOf } from '../../grid';
import { distanceMeters } from '../../geo';
import { paintCellOf } from '../../paint';
import { FACTION_IDS, type FactionId, type LatLng } from '../../types';
import { PaintSim, type SimCapture } from './paint-sim';

/* ------------------------------------------------------------------ RNG */
export function simRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
    normal: (mu = 0, sd = 1) => mu + sd * Math.sqrt(-2 * Math.log(Math.max(1e-12, next()))) * Math.cos(2 * Math.PI * next()),
    weighted: <T>(xs: readonly T[], ws: readonly number[]) => {
      let v = next() * ws.reduce((s, w) => s + w, 0);
      for (let i = 0; i < xs.length; i++) if ((v -= ws[i]) <= 0) return xs[i];
      return xs[xs.length - 1];
    },
  };
  return r;
}
type SimRng = ReturnType<typeof simRng>;

/* ------------------------------------------------------------------ Mapa */
export type SimMap = { nodes: LatLng[]; adj: { to: number; len: number }[][]; zones: string[] };

/** Bairro com as zonas de um disco H3 de raio `rings` no Flamboyant (Goiânia) e quadras de 100 m. */
export function syntheticNeighborhood(rings: number, seed = 99): SimMap {
  const r = simRng(seed);
  const center = { lat: -16.7097, lng: -49.2388 };
  const disk = new Set(cellsAround(zoneOf(center), rings));
  const KX = Math.cos((center.lat * Math.PI) / 180) * 111320;
  const KY = 110574;
  const N = Math.ceil(((rings + 1) * 360) / 100);
  const id = new Map<string, number>();
  const nodes: LatLng[] = [];
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      const p = { lat: center.lat - (j * 100 + r.normal(0, 8)) / KY, lng: center.lng + (i * 100 + r.normal(0, 8)) / KX };
      if (!disk.has(zoneOf(p))) continue;
      id.set(`${i}:${j}`, nodes.length);
      nodes.push(p);
    }
  }
  const adj: { to: number; len: number }[][] = nodes.map(() => []);
  for (const [k, a] of id) {
    const [i, j] = k.split(':').map(Number);
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const b = id.get(`${i + di}:${j + dj}`);
      if (b === undefined || r.next() < 0.08) continue; // 8% de quadras maiores
      const len = distanceMeters(nodes[a], nodes[b]);
      adj[a].push({ to: b, len });
      adj[b].push({ to: a, len });
    }
  }
  // maior componente conexa
  const comp = new Int32Array(nodes.length).fill(-1);
  let best = 0;
  let bestSize = 0;
  for (let s = 0, c = 0; s < nodes.length; s++) {
    if (comp[s] >= 0) continue;
    const stack = [s];
    comp[s] = c;
    let size = 0;
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const e of adj[u]) {
        if (comp[e.to] >= 0) continue;
        comp[e.to] = c;
        stack.push(e.to);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = c;
    }
    c++;
  }
  const map = new Int32Array(nodes.length).fill(-1);
  const keep: LatLng[] = [];
  nodes.forEach((p, i) => {
    if (comp[i] !== best) return;
    map[i] = keep.length;
    keep.push(p);
  });
  const keepAdj = keep.map(() => [] as { to: number; len: number }[]);
  nodes.forEach((_, i) => {
    if (map[i] >= 0) for (const e of adj[i]) if (map[e.to] >= 0) keepAdj[map[i]].push({ to: map[e.to], len: e.len });
  });
  return { nodes: keep, adj: keepAdj, zones: [...disk].sort() };
}

function shortestPath(g: SimMap, from: number, to: number): number[] {
  const dist = new Float64Array(g.nodes.length).fill(Infinity);
  const prev = new Int32Array(g.nodes.length).fill(-1);
  const heap: [number, number][] = [[0, from]];
  dist[from] = 0;
  const swap = (i: number, j: number) => ([heap[i], heap[j]] = [heap[j], heap[i]]);
  while (heap.length) {
    const [d, u] = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (l + 1 < heap.length && heap[l + 1][0] < heap[m][0]) m = l + 1;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    if (d > dist[u]) continue;
    if (u === to) break;
    for (const e of g.adj[u]) {
      if (d + e.len >= dist[e.to]) continue;
      dist[e.to] = d + e.len;
      prev[e.to] = u;
      heap.push([dist[e.to], e.to]);
      for (let i = heap.length - 1; i > 0; ) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        swap(p, i);
        i = p;
      }
    }
  }
  const path: number[] = [];
  for (let v = to; v !== -1; v = prev[v]) path.push(v);
  return path.reverse();
}

/** Uma volta: trechos (res 11) na ordem do percurso, sem repetição, e a distância em que cada um foi pintado. */
export type SimRoute = { meters: number; cells: string[]; cellAt: number[] };

/** Volta a partir de casa com rumo persistente que gira aos poucos; volta pelo caminho mais curto. */
export function simRoute(g: SimMap, home: number, targetM: number, r: SimRng): SimRoute {
  const path = [home];
  let walked = 0;
  let heading = r.next() * 2 * Math.PI - Math.PI;
  const turn = (r.next() < 0.5 ? 1 : -1) * (Math.PI / Math.max(400, targetM / 2));
  const used = new Set<string>();
  let at = home;
  let prev = -1;
  for (let guard = 0; guard < 5000; guard++) {
    const options = g.adj[at].filter((e) => e.to !== prev);
    const opts = options.length ? options : g.adj[at];
    const weights = opts.map((e) => {
      const a = g.nodes[at];
      const b = g.nodes[e.to];
      const bearing = Math.atan2(b.lat - a.lat, (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180));
      const key = `${Math.min(at, e.to)}-${Math.max(at, e.to)}`;
      return Math.exp(2 * Math.cos(bearing - heading)) * (used.has(key) ? 0.05 : 1);
    });
    const e = r.weighted(opts, weights);
    used.add(`${Math.min(at, e.to)}-${Math.max(at, e.to)}`);
    prev = at;
    at = e.to;
    path.push(at);
    walked += e.len;
    heading += turn * e.len + r.normal(0, 0.05);
    if (walked + distanceMeters(g.nodes[at], g.nodes[home]) * 1.3 >= targetM) break;
  }
  path.push(...shortestPath(g, at, home).slice(1));
  const cells: string[] = [];
  const cellAt: number[] = [];
  const seen = new Set<string>();
  let meters = 0;
  for (let i = 1; i < path.length; i++) {
    const a = g.nodes[path[i - 1]];
    const b = g.nodes[path[i]];
    const len = distanceMeters(a, b);
    const n = Math.max(1, Math.round(len / 10));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const p = { lat: a.lat + ((b.lat - a.lat) * k) / n, lng: a.lng + ((b.lng - a.lng) * k) / n };
      const c = paintCellOf(p);
      if (k > 0) meters += len / n;
      if (!seen.has(c)) {
        seen.add(c);
        cells.push(c);
        cellAt.push(meters);
      }
    }
  }
  return { meters, cells, cellAt };
}

/* ------------------------------------------------------------------ Corredores e agenda */
export type Profile = 'iniciante' | 'regular' | 'avancado';
export const PROFILES: Record<Profile, { km: number; perWeek: number }> = {
  iniciante: { km: 3, perWeek: 2 },
  regular: { km: 5, perWeek: 4 },
  avancado: { km: 15, perWeek: 6 },
};

export const WARMUP_DAYS = 28;
export const MEASURED_DAYS = 56;
export const TOTAL_DAYS = WARMUP_DAYS + MEASURED_DAYS;
export const DAY_MS = 86_400_000;
/** 05/10/2026 00:00 em Brasília (segunda-feira). Viradas de temporada: 01/11 (dia 27) e 01/12 (dia 57). */
export const SIM_T0 = Date.UTC(2026, 9, 5, 3);
export const SEASON_TURNS = [27, 57];

export type Runner = { id: number; profile: Profile; team: FactionId; home: number; joinDay: number; newcomer: boolean };
export type Run = { runner: number; day: number; now: number; route: SimRoute };

export type SimScenario = {
  seed: number;
  /** Raio do disco de zonas (5 = 91 zonas; 9 = 271, o bairro da F1). */
  rings: number;
  /** Veteranos por 271 zonas (a F1 usa 90). */
  density: number;
  /** Novatos iniciantes e regulares por 271 zonas (a F1 usa 20 e 5). */
  newcomers?: { iniciante: number; regular: number };
  teams?: 'equilibrados' | 'desequilibrados';
  /**
   * Sondas do novato: a cada `everyDays` dias medidos, `routes` primeiras corridas hipotéticas de um novato
   * iniciante (3 km, casa e time sorteados) aplicadas sem gravar. Dá centenas de amostras da métrica "conquista
   * na 1ª corrida" sem mexer no jogo.
   */
  probes?: { routes: number; everyDays: number };
};

const TEAM_ORDER: FactionId[] = ['volt', 'owls', 'coyotes', 'striders'];
const TEAM_WEIGHTS = { equilibrados: [0.25, 0.25, 0.25, 0.25], desequilibrados: [0.45, 0.3, 0.15, 0.1] };

export function buildSchedule(g: SimMap, s: SimScenario): { runners: Runner[]; runs: Run[] } {
  const r = simRng(s.seed * 7919 + s.density);
  const scale = g.zones.length / 271;
  const veterans = Math.round(s.density * scale);
  const nc = s.newcomers ?? { iniciante: 20, regular: 5 };
  const runners: Runner[] = [];
  const add = (profile: Profile, newcomer: boolean) =>
    runners.push({
      id: runners.length,
      profile,
      team: r.weighted(TEAM_ORDER, TEAM_WEIGHTS[s.teams ?? 'equilibrados']),
      home: r.int(g.nodes.length),
      joinDay: newcomer ? WARMUP_DAYS + r.int(42) : 0,
      newcomer,
    });
  for (let i = 0; i < veterans; i++) add(i < veterans * 0.5 ? 'iniciante' : i < veterans * 0.85 ? 'regular' : 'avancado', false);
  for (let i = 0; i < Math.round(nc.iniciante * scale); i++) add('iniciante', true);
  for (let i = 0; i < Math.round(nc.regular * scale); i++) add('regular', true);

  const favorites = runners.map((k) => [0, 1].map(() => simRoute(g, k.home, PROFILES[k.profile].km * 1000, r)));
  const runs: Run[] = [];
  for (let week = 0; week * 7 < TOTAL_DAYS; week++) {
    const planned: { k: Runner; day: number; hour: number }[] = [];
    for (const k of runners) {
      const days = [0, 1, 2, 3, 4, 5, 6].sort(() => r.next() - 0.5).slice(0, PROFILES[k.profile].perWeek);
      for (const d of days) {
        const day = week * 7 + d;
        if (day >= TOTAL_DAYS || day < k.joinDay || r.next() < 0.08) continue; // 8% não acontecem
        planned.push({ k, day, hour: 6 + r.next() * 14 });
      }
    }
    planned.sort((a, b) => a.day - b.day || a.hour - b.hour);
    for (const { k, day, hour } of planned) {
      const target = PROFILES[k.profile].km * 1000 * Math.max(0.6, 1 + r.normal(0, 0.1));
      const route = r.next() < 0.65 ? r.pick(favorites[k.id]) : simRoute(g, k.home, target, r);
      runs.push({ runner: k.id, day, now: SIM_T0 + day * DAY_MS + hour * 3_600_000, route });
    }
  }
  return { runners, runs };
}

/* ------------------------------------------------------------------ Simulação e métricas */
export type SimMetrics = {
  zones: number;
  runners: number;
  runs: number;
  /** Sondas: 1ª corrida hipotética de um novato iniciante que conquista uma zona (0 a 1), em quantas sondas. */
  probeFirstRun: number;
  probes: number;
  /** Sondas que conquistam nos primeiros 1 km. */
  probeFirstKm: number;
  /** Novatos iniciantes (agentes) que conquistaram uma zona na 1ª corrida (0 a 1) e quantos eram. */
  newcomerFirstRun: number;
  newcomers: number;
  /** Novatos iniciantes que conquistaram nos primeiros 1 km da 1ª corrida. */
  newcomerFirstKm: number;
  /** Novatos iniciantes que nunca conquistaram nas 8 semanas. */
  newcomerNever: number;
  /** Zonas com o mesmo dono (não neutra) em todos os fins de dia das 8 semanas medidas (0 a 1). */
  eternal: number;
  /** Zonas que mudam de dono por semana (média, 0 a 1). */
  weeklyTurnover: number;
  /** Mediana dos metros dentro da zona que 1 rival precisa para tomá-la, no fim. */
  costToTakeMedianM: number;
  /** Zonas com dono no fim (0 a 1). */
  owned: number;
};

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export function simulateTerritory(s: SimScenario, map: SimMap = syntheticNeighborhood(s.rings)): SimMetrics {
  const { runners, runs } = buildSchedule(map, s);
  const sim = new PaintSim();
  const zoneIndex = new Map(map.zones.map((z, i) => [z, i]));
  const byDay: Run[][] = Array.from({ length: TOTAL_DAYS }, () => []);
  for (const run of runs) byDay[run.day].push(run);
  const snaps: Int8Array[] = [];
  const firstRun = new Map<number, { captured: boolean; firstKm: boolean }>();
  const everCaptured = new Set<number>();
  const pr = simRng(s.seed * 104_729 + 17);
  const probeRoutes = s.probes
    ? Array.from({ length: s.probes.routes }, () => ({
        route: simRoute(map, pr.int(map.nodes.length), PROFILES.iniciante.km * 1000 * Math.max(0.6, 1 + pr.normal(0, 0.1)), pr),
        team: pr.weighted(TEAM_ORDER, TEAM_WEIGHTS[s.teams ?? 'equilibrados']),
      }))
    : [];
  let probes = 0;
  let probeHits = 0;
  let probeKm = 0;

  for (let day = 0; day < TOTAL_DAYS; day++) {
    for (const run of byDay[day]) {
      const k = runners[run.runner];
      const caps: SimCapture[] = sim.run(k.id, run.route.cells, k.team, run.now, day).captures.filter((c) => zoneIndex.has(c.zone));
      if (caps.length) everCaptured.add(k.id);
      if (k.newcomer && !firstRun.has(k.id)) {
        firstRun.set(k.id, { captured: caps.length > 0, firstKm: caps.some((c) => run.route.cellAt[c.atCell] <= 1000) });
      }
    }
    if (s.probes && day >= WARMUP_DAYS && (day - WARMUP_DAYS) % s.probes.everyDays === 0) {
      const at = SIM_T0 + day * DAY_MS + 20.5 * 3_600_000;
      for (const p of probeRoutes) {
        const caps = sim.probe(p.route.cells, p.team, at).filter((c) => zoneIndex.has(c.zone));
        probes++;
        if (caps.length) probeHits++;
        if (caps.some((c) => p.route.cellAt[c.atCell] <= 1000)) probeKm++;
      }
    }
    // Madrugada seguinte: virada de temporada (00:15 do dia 1) e desbotar (03:00).
    const nextDay = SIM_T0 + (day + 1) * DAY_MS;
    if (SEASON_TURNS.includes(day + 1)) sim.seasonReset(nextDay + 15 * 60_000);
    sim.fade(nextDay + 3 * 3_600_000);
    snaps.push(Int8Array.from(map.zones, (z) => FACTION_IDS.indexOf(sim.owner(z) as FactionId)));
  }

  const Z = map.zones.length;
  const start = WARMUP_DAYS - 1;
  let eternal = 0;
  for (let i = 0; i < Z; i++) {
    const o = snaps[start][i];
    let same = o >= 0;
    for (let d = start; d < TOTAL_DAYS && same; d++) same = snaps[d][i] === o;
    if (same) eternal++;
  }
  let turnover = 0;
  for (let w = 1; w <= 8; w++) {
    const a = snaps[start + 7 * (w - 1)];
    const b = snaps[start + 7 * w];
    let n = 0;
    for (let i = 0; i < Z; i++) if (a[i] !== b[i]) n++;
    turnover += n / Z / 8;
  }
  const end = SIM_T0 + TOTAL_DAYS * DAY_MS;
  const costs = map.zones.map((z) => sim.costToTake(z, end)).filter((x): x is number => x !== null);
  const novices = runners.filter((k) => k.newcomer && k.profile === 'iniciante' && firstRun.has(k.id));
  const share = (f: (k: Runner) => boolean) => (novices.length ? novices.filter(f).length / novices.length : NaN);
  return {
    zones: Z,
    runners: runners.length,
    runs: runs.length,
    probeFirstRun: probes ? probeHits / probes : NaN,
    probes,
    probeFirstKm: probes ? probeKm / probes : NaN,
    newcomerFirstRun: share((k) => firstRun.get(k.id)!.captured),
    newcomers: novices.length,
    newcomerFirstKm: share((k) => firstRun.get(k.id)!.firstKm),
    newcomerNever: share((k) => !everCaptured.has(k.id)),
    eternal: eternal / Z,
    weeklyTurnover: turnover,
    costToTakeMedianM: median(costs),
    owned: snaps[TOTAL_DAYS - 1].filter((v) => v >= 0).length / Z,
  };
}
