import { MAX_ACCURACY_M, MAX_POINT_KMH, TELEPORT_METERS, TELEPORT_SECONDS } from './anti-cheat';
import { distanceMeters, mpsToKmh } from './geo';
import {
  cellsOfSegment,
  conquestGap,
  emptyPaintCounts,
  gapMeters,
  PAINT_ATTACK_RATIO,
  PAINT_DEFENSE_RETAKES,
  paintCellOf,
  paintTransition,
  paintZoneOf,
  zoneOwnerByCells,
  type PaintCell,
  type PaintCounts,
} from './paint';
import type { FactionId, GeoPoint } from './types';

/**
 * T7.1.2 — eventos ao vivo da corrida (seção 8 do relatório da E3), para a E5 (celebrações) e a E6 (HUD).
 *
 * É uma PREVISÃO: o app aplica a regra de pintura (D-62) sobre um retrato dos arredores sem autor e sem
 * hora (`zone_paint_near`, E9). O resultado oficial vem do servidor no resumo (`provisional: true`).
 *
 * O acumulador é incremental (O(1) amortizado por ponto): 15 km a 1 Hz cabem em menos de 200 ms.
 * Puro e determinístico: o tempo vem de cada ponto (`p.t`), nunca do relógio.
 */

/** Escala de celebração (D-71, E5): micro < pequena < média < épica. */
export type CelebrationLevel = 'micro' | 'pequena' | 'media' | 'epica';

export type LiveEventType =
  | 'trecho_pintado'
  | 'trecho_virado'
  | 'trecho_enfraquecido'
  | 'zona_entrou'
  | 'zona_rival_entrou'
  | 'zona_progresso'
  | 'faltam_metros'
  | 'zona_conquistada'
  | 'zona_defendida';

/** Nível padrão de cada evento. A 1ª conquista da vida sobe para épica. */
export const LIVE_EVENT_LEVEL: Readonly<Record<LiveEventType, CelebrationLevel>> = Object.freeze({
  trecho_pintado: 'micro',
  trecho_virado: 'micro',
  trecho_enfraquecido: 'micro',
  zona_entrou: 'micro',
  zona_rival_entrou: 'pequena',
  zona_progresso: 'pequena',
  faltam_metros: 'micro',
  zona_conquistada: 'media',
  zona_defendida: 'media',
});

/** Marcos de progresso para conquistar a zona (gradiente de meta). */
export const LIVE_PROGRESS_MARKS = [25, 50, 75] as const;
export type LiveProgressMark = (typeof LIVE_PROGRESS_MARKS)[number];

type Base = {
  runId: string;
  /** Instante do ponto que gerou o evento (epoch ms). */
  t: number;
  /** Distância válida da corrida até aqui, em metros. */
  atMeters: number;
  level: CelebrationLevel;
};

type ZoneInfo = {
  zoneId: string;
  name: string | null;
  owner: FactionId | null;
  counts: PaintCounts;
  /** Trechos que faltam para o seu time ficar com a zona (0 = já é sua) e o equivalente em metros. */
  gapCells: number;
  gapMeters: number;
};

export type LiveEvent =
  | (Base & { type: 'trecho_pintado'; cell: string; zoneId: string; kind: 'novo' | 'reforco'; layers: number })
  | (Base & { type: 'trecho_virado'; cell: string; zoneId: string; from: FactionId; layers: 1 })
  | (Base & { type: 'trecho_enfraquecido'; cell: string; zoneId: string; owner: FactionId; layersLeft: number })
  | (Base & ZoneInfo & { type: 'zona_entrou'; mine: boolean })
  | (Base & ZoneInfo & { type: 'zona_rival_entrou'; owner: FactionId })
  | (Base & { type: 'zona_progresso'; zoneId: string; pct: LiveProgressMark; gapCells: number; gapMeters: number })
  | (Base & { type: 'faltam_metros'; zoneId: string; gapCells: number; gapMeters: number })
  | (Base & {
      type: 'zona_conquistada';
      zoneId: string;
      name: string | null;
      from: FactionId | null;
      counts: PaintCounts;
      provisional: true;
      /** Primeira conquista da vida do corredor (nível épico). */
      first: boolean;
    })
  | (Base & { type: 'zona_defendida'; zoneId: string; name: string | null; retaken: number; counts: PaintCounts; provisional: true });

/** Retrato dos arredores entregue pelo servidor: sem autor, sem hora, sem trechos em zonas de privacidade. */
export type LiveSnapshot = {
  cells: Readonly<Record<string, { faction: FactionId; layers: number }>>;
  zones: Readonly<
    Record<
      string,
      {
        owner: FactionId | null;
        name?: string | null;
        /** Trechos virtuais da herança que ainda valem (D-62). */
        inherited?: number;
        blocked?: boolean;
        underAttack?: boolean;
      }
    >
  >;
};

export type LiveTrackerOptions = {
  runId: string;
  faction: FactionId;
  snapshot: LiveSnapshot;
  /** Trechos que o corredor já pintou hoje (não pintam de novo). */
  paintedToday?: ReadonlySet<string>;
  /** O corredor nunca conquistou uma zona: a 1ª conquista vira épica. */
  firstConquestEver?: boolean;
};

export type LiveZoneState = ZoneInfo & { mine: boolean };

export type LiveSummary = {
  meters: number;
  cellsPainted: number;
  cellsFlipped: number;
  conquered: string[];
  defended: string[];
  current: LiveZoneState | null;
  /** O app parou de prever (ex.: localização simulada); o servidor decide no fim. */
  stopped: boolean;
};

export type LiveTracker = {
  /** Alimenta 1 ponto de GPS e devolve os eventos que ele gerou, em ordem. */
  push(p: GeoPoint): LiveEvent[];
  summary(): LiveSummary;
};

type ZoneRun = {
  owner: FactionId | null;
  counts: PaintCounts;
  /** Trechos que faltavam quando a corrida tocou a zona pela 1ª vez (base dos 25/50/75%). */
  need0: number | null;
  marks: number;
  gap: number;
  retaken: number;
  defended: boolean;
};

export function createLiveTracker(opts: LiveTrackerOptions): LiveTracker {
  const { runId, faction, snapshot } = opts;
  let firstEver = opts.firstConquestEver ?? false;
  const zoneCache = new Map<string, string>();
  const zoneOfCell = (cell: string) => {
    let z = zoneCache.get(cell);
    if (z === undefined) {
      z = paintZoneOf(cell);
      zoneCache.set(cell, z);
    }
    return z;
  };

  // Placar inicial por zona (1 passada no retrato).
  const baseCounts = new Map<string, PaintCounts>();
  for (const [cell, v] of Object.entries(snapshot.cells)) {
    if (v.layers <= 0) continue;
    const z = zoneOfCell(cell);
    let c = baseCounts.get(z);
    if (!c) {
      c = emptyPaintCounts();
      baseCounts.set(z, c);
    }
    c[v.faction]++;
  }

  const painted = new Set<string>();
  const zones = new Map<string, ZoneRun>();
  const conquered: string[] = [];
  const defended: string[] = [];
  let last: GeoPoint | null = null;
  let meters = 0;
  let cellsFlipped = 0;
  let currentZone: string | null = null;
  let stopped = false;

  const zoneRun = (zoneId: string): ZoneRun => {
    let z = zones.get(zoneId);
    if (!z) {
      const meta = snapshot.zones[zoneId];
      const counts = { ...(baseCounts.get(zoneId) ?? emptyPaintCounts()) };
      const owner = meta?.owner ?? null;
      if (owner && meta?.inherited) counts[owner] += meta.inherited;
      z = { owner, counts, need0: null, marks: 0, gap: conquestGap(counts, faction, owner), retaken: 0, defended: false };
      zones.set(zoneId, z);
    }
    return z;
  };

  const info = (zoneId: string, z: ZoneRun): LiveZoneState => ({
    zoneId,
    name: snapshot.zones[zoneId]?.name ?? null,
    owner: z.owner,
    counts: { ...z.counts },
    gapCells: z.gap,
    gapMeters: gapMeters(z.gap),
    mine: z.owner === faction,
  });

  /** Estado do trecho no retrato (cada trecho é pintado no máximo 1 vez por corrida). */
  const cellState = (cell: string, zoneId: string, t: number): PaintCell | null => {
    const s = snapshot.cells[cell];
    return s && s.layers > 0 ? { cell, zoneId, faction: s.faction, layers: s.layers, paintedAt: t } : null;
  };

  function paintCell(cell: string, t: number, out: LiveEvent[]) {
    if (painted.has(cell) || opts.paintedToday?.has(cell)) return;
    const zoneId = zoneOfCell(cell);
    if (snapshot.zones[zoneId]?.blocked) return;
    painted.add(cell);
    const z = zoneRun(zoneId);
    if (z.need0 === null) z.need0 = z.gap;
    const prev = cellState(cell, zoneId, t);
    const { next, kind } = paintTransition(prev, cell, faction, t);
    const base = { runId, t, atMeters: meters };
    if (kind === 'novo') {
      z.counts[faction]++;
      out.push({ ...base, level: LIVE_EVENT_LEVEL.trecho_pintado, type: 'trecho_pintado', cell, zoneId, kind, layers: next.layers });
    } else if (kind === 'reforco') {
      out.push({ ...base, level: LIVE_EVENT_LEVEL.trecho_pintado, type: 'trecho_pintado', cell, zoneId, kind, layers: next.layers });
    } else if (kind === 'enfraquecido') {
      out.push({ ...base, level: LIVE_EVENT_LEVEL.trecho_enfraquecido, type: 'trecho_enfraquecido', cell, zoneId, owner: next.faction, layersLeft: next.layers });
    } else {
      const from = prev!.faction;
      z.counts[from]--;
      z.counts[faction]++;
      cellsFlipped++;
      if (z.owner === faction) z.retaken++;
      out.push({ ...base, level: LIVE_EVENT_LEVEL.trecho_virado, type: 'trecho_virado', cell, zoneId, from, layers: 1 });
    }
    // Como no servidor (applyPaint), toda zona tocada tem o dono reavaliado, mesmo sem mudar o placar.
    afterTouch(zoneId, z, base, out);
  }

  function afterTouch(zoneId: string, z: ZoneRun, base: { runId: string; t: number; atMeters: number }, out: LiveEvent[]) {
    const ownerBefore = z.owner;
    z.owner = zoneOwnerByCells(z.counts, ownerBefore);
    const gapBefore = z.gap;
    z.gap = conquestGap(z.counts, faction, z.owner);
    const name = snapshot.zones[zoneId]?.name ?? null;

    if (z.owner === faction && ownerBefore !== faction) {
      conquered.push(zoneId);
      out.push({
        ...base,
        level: firstEver ? 'epica' : LIVE_EVENT_LEVEL.zona_conquistada,
        type: 'zona_conquistada',
        zoneId,
        name,
        from: ownerBefore,
        counts: { ...z.counts },
        provisional: true,
        first: firstEver,
      });
      firstEver = false;
      return;
    }

    if (z.owner === faction && !z.defended && snapshot.zones[zoneId]?.underAttack) {
      let topRival = 0;
      for (const [f, n] of Object.entries(z.counts) as [FactionId, number][]) if (f !== faction) topRival = Math.max(topRival, n);
      if (z.retaken >= PAINT_DEFENSE_RETAKES || topRival < z.counts[faction] * PAINT_ATTACK_RATIO) {
        z.defended = true;
        defended.push(zoneId);
        out.push({ ...base, level: LIVE_EVENT_LEVEL.zona_defendida, type: 'zona_defendida', zoneId, name, retaken: z.retaken, counts: { ...z.counts }, provisional: true });
      }
      return;
    }

    if (z.gap > 0 && z.gap < gapBefore) {
      // A lacuna nunca cresce com a própria pintura, então need0 ≥ gapBefore > 0.
      const need0 = z.need0!;
      const pct = ((need0 - z.gap) / need0) * 100;
      let mark = 0;
      for (const m of LIVE_PROGRESS_MARKS) if (pct >= m && m > z.marks) mark = m;
      if (mark) {
        z.marks = mark;
        out.push({ ...base, level: LIVE_EVENT_LEVEL.zona_progresso, type: 'zona_progresso', zoneId, pct: mark as LiveProgressMark, gapCells: z.gap, gapMeters: gapMeters(z.gap) });
      }
      out.push({ ...base, level: LIVE_EVENT_LEVEL.faltam_metros, type: 'faltam_metros', zoneId, gapCells: z.gap, gapMeters: gapMeters(z.gap) });
    }
  }

  function enterZone(zoneId: string, t: number, out: LiveEvent[]) {
    if (zoneId === currentZone) return;
    currentZone = zoneId;
    const z = zoneRun(zoneId);
    const base = { runId, t, atMeters: meters };
    const data = info(zoneId, z);
    if (z.owner && z.owner !== faction) {
      out.push({ ...base, ...data, owner: z.owner, level: LIVE_EVENT_LEVEL.zona_rival_entrou, type: 'zona_rival_entrou' });
    } else {
      out.push({ ...base, ...data, level: LIVE_EVENT_LEVEL.zona_entrou, type: 'zona_entrou' });
    }
  }

  function push(p: GeoPoint): LiveEvent[] {
    const out: LiveEvent[] = [];
    if (stopped) return out;
    if (p.mocked) {
      stopped = true;
      return out;
    }
    if (p.accuracy !== undefined && p.accuracy > MAX_ACCURACY_M) return out;
    const prev = last;
    last = p;
    // A zona atual é a do ponto (não a de cada amostra), para não piscar na divisa entre zonas.
    enterZone(zoneOfCell(paintCellOf(p)), p.t, out);
    if (!prev) return out;
    const m = distanceMeters(prev, p);
    const seconds = Math.max(0, (p.t - prev.t) / 1000);
    const kmh = seconds > 0 ? mpsToKmh(m / seconds) : m > 0 ? Infinity : 0;
    if ((m > TELEPORT_METERS && seconds <= TELEPORT_SECONDS) || kmh > MAX_POINT_KMH) return out;
    meters += m;
    for (const cell of cellsOfSegment(prev, p, m)) paintCell(cell, p.t, out);
    return out;
  }

  function summary(): LiveSummary {
    return {
      meters,
      cellsPainted: painted.size,
      cellsFlipped,
      conquered: [...conquered],
      defended: [...defended],
      current: currentZone ? info(currentZone, zoneRun(currentZone)) : null,
      stopped,
    };
  }

  return { push, summary };
}
