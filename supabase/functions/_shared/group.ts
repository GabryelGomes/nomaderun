/**
 * RN-001 — M_grupo no servidor (P-12). Puro (sem I/O).
 *
 * `detectPack`: etapa antes da pontuação. Para cada trecho válido da corrida (mesmos passos de `validateActivity`
 * que o `finishRun` usa), procura, no mesmo instante, a posição dos outros membros da Crew (percursos das
 * corridas deles no mesmo intervalo, interpoladas). O trecho conta "em grupo" quando o corredor e pelo menos
 * mais 2 membros estão a até 50 m entre si (os 3 dois a dois). Uma zona ganha o multiplicador quando os trechos
 * em grupo somam ≥ 60% dos metros válidos dela.
 *
 * `applyPack`: aplica o M_grupo às zonas detectadas usando as funções do domain (`scoreZone` com `inPack`,
 * `applyRunPoints`). É uma ponte temporária: o `scoreZone` do domain já aceita `inPack`, mas o `finishRun` ainda
 * não repassa esse dado (pedido ao A1 no PROGRESSO: `RunContext.packZones`). Quando o domain repassar, troque
 * `applyPack` por `packZones` no contexto do `finishRun` — o teste `group.test.ts` avisa.
 */
import {
  applyRunPoints,
  defenseWindowOpen,
  distanceMeters,
  type FactionId,
  finishRun,
  type GeoPoint,
  type LatLng,
  newZone,
  scoreZone,
  validateActivity,
  type Zone,
  type ZoneEvent,
  zoneOf,
} from './domain.ts';

/** Distância máxima entre os membros (RN-001). */
export const PACK_DISTANCE_M = 50;
/** Parte mínima do trecho da zona correndo em grupo (RN-001). */
export const PACK_MIN_SHARE = 0.6;
/** Membros da mesma Crew, contando o próprio corredor (RN-001). */
export const PACK_MIN_MEMBERS = 3;
/** Maior intervalo entre dois pontos de um colega para interpolar a posição dele. */
export const PACK_MAX_GAP_MS = 15_000;

/** Percurso de um colega de Crew: pontos [t (ms), lat, lng] em ordem de tempo. */
export type CrewTrack = { userId: string; points: [number, number, number][] };

export type PackDetection = {
  /** Zonas com M_grupo (≥ 60% dos metros válidos em grupo). */
  zones: string[];
  /** Colegas que correram junto em algum trecho (sem contar o corredor). */
  members: string[];
  /** Metros válidos em grupo por zona (para depuração e testes). */
  packMetersByZone: Record<string, number>;
};

/** Posição do colega no instante `t`, interpolada entre os pontos vizinhos (null se não estava correndo). */
export function positionAt(track: CrewTrack, t: number): LatLng | null {
  const pts = track.points;
  if (pts.length === 0 || t < pts[0][0] - PACK_MAX_GAP_MS / 3 || t > pts[pts.length - 1][0] + PACK_MAX_GAP_MS / 3) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  if (t <= a[0]) return { lat: a[1], lng: a[2] };
  if (t >= b[0]) return { lat: b[1], lng: b[2] };
  if (b[0] - a[0] > PACK_MAX_GAP_MS) return null;
  const f = (t - a[0]) / (b[0] - a[0]);
  return { lat: a[1] + (b[1] - a[1]) * f, lng: a[2] + (b[2] - a[2]) * f };
}

/** Colegas que formam, com o corredor em `p`, um grupo de PACK_MIN_MEMBERS a até PACK_DISTANCE_M dois a dois. */
function groupAt(p: LatLng, t: number, tracks: CrewTrack[]): string[] | null {
  const near: { userId: string; pos: LatLng }[] = [];
  for (const tr of tracks) {
    const pos = positionAt(tr, t);
    if (pos && distanceMeters(p, pos) <= PACK_DISTANCE_M) near.push({ userId: tr.userId, pos });
  }
  if (near.length < PACK_MIN_MEMBERS - 1) return null;
  // PACK_MIN_MEMBERS = 3: basta um par de colegas também a até 50 m entre si
  const members = new Set<string>();
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      if (distanceMeters(near[i].pos, near[j].pos) <= PACK_DISTANCE_M) {
        members.add(near[i].userId);
        members.add(near[j].userId);
      }
    }
  }
  return members.size >= PACK_MIN_MEMBERS - 1 ? [...members] : null;
}

export function detectPack(points: GeoPoint[], tracks: CrewTrack[]): PackDetection {
  const byUser = new Map<string, CrewTrack>();
  for (const tr of tracks) {
    const cur = byUser.get(tr.userId);
    if (cur) cur.points.push(...tr.points);
    else byUser.set(tr.userId, { userId: tr.userId, points: [...tr.points] });
  }
  const merged = [...byUser.values()].filter((tr) => tr.points.length > 0);
  for (const tr of merged) tr.points.sort((a, b) => a[0] - b[0]);
  if (merged.length < PACK_MIN_MEMBERS - 1) return { zones: [], members: [], packMetersByZone: {} };

  const validation = validateActivity(points);
  const total: Record<string, number> = {};
  const pack: Record<string, number> = {};
  const members = new Set<string>();
  for (const s of validation.steps) {
    if (!s.valid) continue;
    const a = points[s.from];
    const b = points[s.to];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const zone = zoneOf(mid);
    total[zone] = (total[zone] ?? 0) + s.meters;
    const group = groupAt(mid, (a.t + b.t) / 2, merged);
    if (group) {
      pack[zone] = (pack[zone] ?? 0) + s.meters;
      for (const m of group) members.add(m);
    }
  }
  const zones = Object.keys(pack).filter((z) => total[z] > 0 && pack[z] / total[z] >= PACK_MIN_SHARE).sort();
  return { zones, members: zones.length ? [...members].sort() : [], packMetersByZone: pack };
}

export type PackContext = {
  faction: FactionId;
  basePace: number;
  streakDays: number;
  zones: Record<string, Zone>;
  now: number;
  earnedTodayByZone?: Record<string, number>;
};

type RunResult = ReturnType<typeof finishRun>;

/** Recalcula, com M_grupo, as zonas de `packZones` no resultado do `finishRun` (mesmas funções do domain). */
export function applyPack(result: RunResult, ctx: PackContext, packZones: readonly string[]): RunResult {
  const targets = new Set(packZones.filter((z) => result.zones.some((o) => o.zoneId === z)));
  if (targets.size === 0 || result.validation.status === 'rejected') return result;

  const updatedZones = { ...result.updatedZones };
  const newEvents = new Map<string, ZoneEvent[]>();
  let rpTotal = result.rpTotal;
  const zones = result.zones.map((o) => {
    if (!targets.has(o.zoneId)) return o;
    const before = ctx.zones[o.zoneId] ?? newZone(o.zoneId);
    if (before.blocked) return o;
    const defending = before.owner === ctx.faction && defenseWindowOpen(before, ctx.now);
    const { rp } = scoreZone({
      meters: o.meters,
      paceSecPerKm: result.avgPace,
      basePaceSecPerKm: ctx.basePace,
      streakDays: ctx.streakDays,
      beatGhost: result.beatGhost === true,
      inPack: true,
      defending,
      earnedTodayInZone: ctx.earnedTodayByZone?.[o.zoneId] ?? 0,
    });
    const { zone: after, events } = applyRunPoints(before, ctx.faction, rp, ctx.now);
    updatedZones[o.zoneId] = after;
    newEvents.set(o.zoneId, events);
    rpTotal += rp - o.rp;
    const conquered = events.some((e) => e.type === 'captured' && e.faction === ctx.faction);
    const defended = events.some((e) => e.type === 'defended');
    return {
      ...o,
      rp,
      outcome: (conquered ? 'conquered' : defended ? 'defended' : rp > 0 ? 'influence' : 'none') as typeof o.outcome,
      ownerAfter: after.owner,
    };
  });
  zones.sort((a, b) => b.rp - a.rp);

  // eventos: troca os das zonas recalculadas, mantendo a posição em que apareciam
  const events: ZoneEvent[] = [];
  const done = new Set<string>();
  for (const e of result.events) {
    if (!newEvents.has(e.zoneId)) events.push(e);
    else if (!done.has(e.zoneId)) {
      events.push(...newEvents.get(e.zoneId)!);
      done.add(e.zoneId);
    }
  }
  newEvents.forEach((evs, zoneId) => {
    if (!done.has(zoneId)) events.push(...evs);
  });

  return { ...result, zones, events, updatedZones, rpTotal };
}
