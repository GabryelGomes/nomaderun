import { validateActivity, type ActivityValidation, MAX_POINT_KMH, TELEPORT_METERS, TELEPORT_SECONDS } from './anti-cheat';
import { revealFog, FOG_XP_PER_CELL, ghostGap, XP_PER_100M } from './games';
import { distanceMeters, mpsToKmh, paceSecPerKm } from './geo';
import { zoneOf } from './grid';
import { scoreZone } from './scoring';
import { applyRunPoints, defenseWindowOpen, newZone, type Zone, type ZoneEvent } from './territory';
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

/** Feeds one GPS fix into the live run (RF-004). Implausible steps are skipped for the live numbers only. */
export function addPoint(run: LiveRun, p: GeoPoint): LiveRun {
  const last = run.points[run.points.length - 1];
  const points = [...run.points, p];
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

/** Final, authoritative computation of a run (the server does the same in production). */
export function finishRun(run: LiveRun, ctx: RunContext): RunResult {
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
      const { rp } = scoreZone({
        meters,
        paceSecPerKm: avgPace,
        basePaceSecPerKm: ctx.basePace,
        streakDays: ctx.streakDays,
        beatGhost: beatGhost === true,
        defending,
        inPack: ctx.packZones?.has(zoneId) ?? false,
        earnedTodayInZone: ctx.earnedTodayByZone?.[zoneId] ?? 0,
      });
      const { zone: after, events: zoneEvents } = applyRunPoints(before, ctx.faction, rp, ctx.now);
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

  const validPath: LatLng[] = rejected ? [] : run.points.filter((_, i) => validation.steps.some((s) => s.valid && (s.from === i || s.to === i)));
  const newFogCells = revealFog(validPath, ctx.revealedFog);
  const xp =
    Math.floor(validation.validMeters / 100) * XP_PER_100M +
    newFogCells.length * FOG_XP_PER_CELL +
    (beatGhost ? 50 : 0);

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
