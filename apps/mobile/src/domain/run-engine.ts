import { validateActivity, type ActivityValidation, MAX_POINT_KMH, TELEPORT_METERS, TELEPORT_SECONDS } from './anti-cheat';
import { revealFog, FOG_XP_PER_CELL, ghostGap, GHOST_WIN_XP, XP_PER_100M } from './games';
import { distanceMeters, mpsToKmh, paceSecPerKm } from './geo';
import { zoneOf } from './grid';
import { paintCellsOfRun } from './paint';
import { scoreZone, scoreZoneV2 } from './scoring';
import { applyRunPoints, applyRunPointsV2, defenseWindowOpen, newZone, type Zone, type ZoneEvent } from './territory';
import type { FactionId, GeoPoint, LatLng } from './types';

export const AUTO_PAUSE_KMH = 1;
export const AUTO_PAUSE_SECONDS = 10;
const LIVE_PACE_WINDOW_S = 30;

export type LiveRun = {
  startedAt: number;
  points: GeoPoint[];
  meters: number;
  movingSeconds: number;
  /** Seconds spent below the auto-pause speed, reset when moving again. */
  slowSeconds: number;
  autoPaused: boolean;
  zoneMeters: Record<string, number>;
  currentZone: string | null;
  /** Recent steps for the live pace: [meters, seconds]. */
  recent: [number, number][];
};

export function startRun(now: number): LiveRun {
  return { startedAt: now, points: [], meters: 0, movingSeconds: 0, slowSeconds: 0, autoPaused: false, zoneMeters: {}, currentZone: null, recent: [] };
}

/**
 * Feeds one GPS fix into the live run (RF-004). Implausible steps are skipped for the live numbers only.
 * Imutável: copia o vetor de pontos (O(n) por ponto). Na corrida longa, prefira `appendPoint` (E-12).
 */
export function addPoint(run: LiveRun, p: GeoPoint): LiveRun {
  return advance(run, [...run.points, p], p, run.points[run.points.length - 1]);
}

/**
 * E-12: igual a `addPoint`, mas sem copiar o vetor: acrescenta o ponto no próprio `run.points` (compartilhado com o
 * LiveRun devolvido). Não reutilize o LiveRun anterior depois de chamar. Os números são idênticos aos de
 * `addPoint` (teste de regressão).
 */
export function appendPoint(run: LiveRun, p: GeoPoint): LiveRun {
  const last = run.points[run.points.length - 1];
  run.points.push(p);
  return advance(run, run.points, p, last);
}

function advance(run: LiveRun, points: GeoPoint[], p: GeoPoint, last: GeoPoint | undefined): LiveRun {
  const zone = zoneOf(p);
  if (!last) return { ...run, points, currentZone: zone };

  const meters = distanceMeters(last, p);
  const seconds = Math.max(0, (p.t - last.t) / 1000);
  const kmh = seconds > 0 ? mpsToKmh(meters / seconds) : 0;
  const implausible = kmh > MAX_POINT_KMH || (meters > TELEPORT_METERS && seconds <= TELEPORT_SECONDS);

  const slowSeconds = kmh < AUTO_PAUSE_KMH ? run.slowSeconds + seconds : 0;
  const autoPaused = slowSeconds >= AUTO_PAUSE_SECONDS;
  if (implausible || autoPaused) {
    return { ...run, points, slowSeconds, autoPaused, currentZone: zone };
  }

  const mid = zoneOf({ lat: (last.lat + p.lat) / 2, lng: (last.lng + p.lng) / 2 });
  const recent = [...run.recent, [meters, seconds] as [number, number]];
  let windowSeconds = recent.reduce((s, [, sec]) => s + sec, 0);
  while (recent.length > 1 && windowSeconds - recent[0][1] >= LIVE_PACE_WINDOW_S) {
    windowSeconds -= recent[0][1];
    recent.shift();
  }
  return {
    ...run,
    points,
    meters: run.meters + meters,
    movingSeconds: run.movingSeconds + seconds,
    slowSeconds,
    autoPaused: false,
    zoneMeters: { ...run.zoneMeters, [mid]: (run.zoneMeters[mid] ?? 0) + meters },
    currentZone: zone,
    recent,
  };
}

export function livePace(run: LiveRun): number {
  const meters = run.recent.reduce((s, [m]) => s + m, 0);
  const seconds = run.recent.reduce((s, [, sec]) => s + sec, 0);
  return paceSecPerKm(meters, seconds);
}

export const averagePace = (run: LiveRun) => paceSecPerKm(run.meters, run.movingSeconds);

export type ZoneOutcome = {
  zoneId: string;
  meters: number;
  rp: number;
  outcome: 'conquered' | 'defended' | 'influence' | 'none';
  ownerBefore: FactionId | null;
  ownerAfter: FactionId | null;
};

export type RunContext = {
  faction: FactionId;
  basePace: number;
  streakDays: number;
  zones: Record<string, Zone>;
  revealedFog: ReadonlySet<string>;
  now: number;
  /** Ghost pace for the Fuga mission, if one was chosen. */
  ghostPace?: number;
  earnedTodayByZone?: Record<string, number>;
  /** Zones where 3+ crew members ran together (RN-001 M_grupo); detected by the server. */
  packZones?: ReadonlySet<string>;
};

export type RunResult = {
  validation: ActivityValidation;
  meters: number;
  movingSeconds: number;
  avgPace: number;
  zones: ZoneOutcome[];
  events: ZoneEvent[];
  updatedZones: Record<string, Zone>;
  newFogCells: string[];
  beatGhost: boolean | null;
  rpTotal: number;
  xp: number;
};

type ScoreRules = {
  score(input: { meters: number; avgPace: number; ctx: RunContext; beatGhost: boolean; defending: boolean; zoneId: string }): number;
  apply(zone: Zone, faction: FactionId, rp: number, now: number): { zone: Zone; events: ZoneEvent[] };
};

const RULES_V1: ScoreRules = {
  score: ({ meters, avgPace, ctx, beatGhost, defending, zoneId }) =>
    scoreZone({
      meters,
      paceSecPerKm: avgPace,
      basePaceSecPerKm: ctx.basePace,
      streakDays: ctx.streakDays,
      beatGhost,
      defending,
      inPack: ctx.packZones?.has(zoneId) ?? false,
      earnedTodayInZone: ctx.earnedTodayByZone?.[zoneId] ?? 0,
    }).rp,
  apply: applyRunPoints,
};

const RULES_V2: ScoreRules = {
  score: ({ meters, avgPace, ctx, defending, zoneId }) =>
    scoreZoneV2({
      meters,
      paceSecPerKm: avgPace,
      basePaceSecPerKm: ctx.basePace,
      defending,
      inPack: ctx.packZones?.has(zoneId) ?? false,
      earnedTodayInZone: ctx.earnedTodayByZone?.[zoneId] ?? 0,
    }).rp,
  apply: applyRunPointsV2,
};

/**
 * Final, authoritative computation of a run (the server does the same in production).
 * @deprecated v1, usada pela gravação atual do servidor: sequência e fantasma multiplicam os pontos e as regras
 * de território têm os bugs E-03, E-06 e E-07. Use `finishRunV2` (e `applyPaint` para o território v2).
 */
export function finishRun(run: LiveRun, ctx: RunContext): RunResult {
  return computeRun(run, ctx, RULES_V1);
}

export type RunResultV2 = RunResult & {
  /** Trechos (H3 res 11) de passos válidos, em ordem, para `applyPaint` (D-62). Vazio se rejeitada. */
  paintCells: string[];
};

/**
 * Versão v2 do cálculo oficial: pontos com `scoreZoneV2` (sem sequência e sem fantasma, D-63/E-15), território
 * por influência com as correções (`applyRunPointsV2`: E-03, E-06, E-07), XP do fantasma (50) e os trechos
 * para a pintura. `streakDays` do contexto é ignorado.
 */
export function finishRunV2(run: LiveRun, ctx: Omit<RunContext, 'streakDays'> & { streakDays?: number }): RunResultV2 {
  const result = computeRun(run, { ...ctx, streakDays: 0 }, RULES_V2);
  return { ...result, paintCells: paintCellsOfRun(run.points, result.validation) };
}

function computeRun(run: LiveRun, ctx: RunContext, rules: ScoreRules): RunResult {
  const validation = validateActivity(run.points);
  const validZoneMeters: Record<string, number> = {};
  let validSeconds = 0;
  for (const s of validation.steps) {
    if (!s.valid) continue;
    const a = run.points[s.from];
    const b = run.points[s.to];
    const zone = zoneOf({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });
    validZoneMeters[zone] = (validZoneMeters[zone] ?? 0) + s.meters;
    validSeconds += s.seconds;
  }
  const rejected = validation.status === 'rejected';
  const avgPace = paceSecPerKm(validation.validMeters, validSeconds);
  const beatGhost =
    ctx.ghostPace !== undefined ? ghostGap(validation.validMeters, validSeconds, ctx.ghostPace) > 0 : null;

  const updatedZones: Record<string, Zone> = {};
  const outcomes: ZoneOutcome[] = [];
  const events: ZoneEvent[] = [];
  let rpTotal = 0;

  if (!rejected) {
    for (const [zoneId, meters] of Object.entries(validZoneMeters)) {
      const before = ctx.zones[zoneId] ?? newZone(zoneId);
      if (before.blocked) continue;
      const defending = before.owner === ctx.faction && defenseWindowOpen(before, ctx.now);
      const rp = rules.score({ meters, avgPace, ctx, beatGhost: beatGhost === true, defending, zoneId });
      const { zone: after, events: zoneEvents } = rules.apply(before, ctx.faction, rp, ctx.now);
      updatedZones[zoneId] = after;
      events.push(...zoneEvents);
      rpTotal += rp;
      const conquered = zoneEvents.some((e) => e.type === 'captured' && e.faction === ctx.faction);
      const defended = zoneEvents.some((e) => e.type === 'defended');
      outcomes.push({
        zoneId,
        meters,
        rp,
        outcome: conquered ? 'conquered' : defended ? 'defended' : rp > 0 ? 'influence' : 'none',
        ownerBefore: before.owner,
        ownerAfter: after.owner,
      });
    }
  }
  outcomes.sort((a, b) => b.rp - a.rp);

  // E-11: marca os pontos dos passos válidos em O(n) (antes, `some` dentro de `filter` era O(n²)).
  const inValidStep = new Uint8Array(run.points.length);
  for (const s of validation.steps) {
    if (!s.valid) continue;
    inValidStep[s.from] = 1;
    inValidStep[s.to] = 1;
  }
  const validPath: LatLng[] = rejected ? [] : run.points.filter((_, i) => inValidStep[i] === 1);
  const newFogCells = revealFog(validPath, ctx.revealedFog);
  const xp =
    Math.floor(validation.validMeters / 100) * XP_PER_100M +
    newFogCells.length * FOG_XP_PER_CELL +
    (beatGhost ? GHOST_WIN_XP : 0);

  return {
    validation,
    meters: validation.validMeters,
    movingSeconds: validSeconds,
    avgPace,
    zones: outcomes,
    events,
    updatedZones,
    newFogCells,
    beatGhost,
    rpTotal,
    xp: rejected ? 0 : xp,
  };
}
