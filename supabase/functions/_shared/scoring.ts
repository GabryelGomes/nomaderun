/**
 * Cálculo oficial de uma corrida no servidor (RNF-006): roda `validateActivity` + `finishRun` do domain
 * com o contexto do usuário e monta o que será gravado e a resposta do contrato. Puro (sem I/O).
 */
import {
  applyTrust,
  basePace,
  CHEST_XP,
  type ChestRarity,
  chestsInReach,
  type CheatFlag,
  cellBoundary,
  emptyInfluence,
  FLAG_EXPLANATION,
  finishRun,
  type GeoPoint,
  type Influence,
  type LiveRun,
  revealFog,
  startRun,
  trustLevel,
  validateActivity,
  type Zone,
  type ZoneEvent,
  zoneOf,
  type FactionId,
} from './domain.ts';
import { type CrewTrack, detectPack } from './group.ts';
import { HttpError } from './http.ts';

export type StoredPoint = {
  seq: number;
  lat: number;
  lng: number;
  t: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
  mocked: boolean | null;
  steps: number | null;
};

export type DbZone = {
  id: string;
  name: string | null;
  influence: Influence;
  owner: FactionId | null;
  shield: number;
  attacker: FactionId | null;
  attackStartedAt: number | null;
  blocked: boolean;
  version: number;
};

export type ActivityStatus = 'valid' | 'partial' | 'rejected' | 'review';

export type ReviewReason = 'LOW_TRUST' | 'TRUST_SUSPENDED' | 'SUSPENDED' | 'NO_PEDOMETER_LONG_RUN';

export const REVIEW_MESSAGE: Record<ReviewReason, string> = {
  LOW_TRUST: 'Seu Índice de Confiança está abaixo de 40: a corrida passa por revisão manual e só pontua depois da aprovação.',
  TRUST_SUSPENDED: 'Seu Índice de Confiança ficou abaixo de 10: você está suspenso da competição por 30 dias e a corrida vai para revisão.',
  SUSPENDED: 'Sua conta está suspensa da competição: a corrida fica registrada, mas só pontua se a moderação aprovar.',
  NO_PEDOMETER_LONG_RUN: 'Este aparelho não informa passos e a corrida passou de 10 km: ela vai para revisão manual antes de pontuar.',
};

/** Nome exibido de uma zona sem nome (igual a private.zone_label no SQL). */
export const zoneLabel = (id: string, name: string | null | undefined) =>
  name && name.trim() ? name : `Zona ${id.slice(7, 11).toUpperCase()}`;

/** O banco guarda null; o domain espera undefined (ex.: `steps === undefined` = sem pedômetro). */
export function toGeoPoints(points: StoredPoint[]): GeoPoint[] {
  return points.map((p) => {
    const g: GeoPoint = { lat: p.lat, lng: p.lng, t: p.t };
    if (p.accuracy !== null && p.accuracy !== undefined) g.accuracy = p.accuracy;
    if (p.mocked !== null && p.mocked !== undefined) g.mocked = p.mocked;
    if (p.steps !== null && p.steps !== undefined) g.steps = p.steps;
    return g;
  });
}

/** Zonas e células de neblina que a corrida pode tocar — para carregar só o necessário do banco. */
export function candidateCells(points: GeoPoint[]): { zoneIds: string[]; fogCells: string[] } {
  const validation = validateActivity(points);
  const zones = new Set<string>();
  const path: GeoPoint[] = [];
  for (const s of validation.steps) {
    if (!s.valid) continue;
    const a = points[s.from];
    const b = points[s.to];
    zones.add(zoneOf({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }));
    path.push(a, b);
  }
  return { zoneIds: [...zones], fogCells: revealFog(path, new Set()) };
}

export type InvalidSegment = { fromSeq: number; toSeq: number; code: CheatFlag; reason: string };

/** Agrupa os trechos invalidados em sequência (mesmo motivo) com explicação em pt-BR (RF-006). */
export function invalidSegments(points: StoredPoint[], run: ReturnType<typeof finishRun>): InvalidSegment[] {
  const v = run.validation;
  if (v.status === 'rejected' && v.flags.includes('MOCK_LOCATION') && points.length > 0) {
    return [{ fromSeq: points[0].seq, toSeq: points[points.length - 1].seq, code: 'MOCK_LOCATION', reason: FLAG_EXPLANATION.MOCK_LOCATION }];
  }
  const out: InvalidSegment[] = [];
  for (const s of v.steps) {
    if (s.valid || !s.reason) continue;
    const fromSeq = points[s.from].seq;
    const toSeq = points[s.to].seq;
    const last = out[out.length - 1];
    if (last && last.code === s.reason && last.toSeq === fromSeq) last.toSeq = toSeq;
    else out.push({ fromSeq, toSeq, code: s.reason, reason: FLAG_EXPLANATION[s.reason] });
  }
  return out;
}

export type ScoringInput = {
  mode: 'finish' | 'approve';
  activityId: string;
  points: StoredPoint[];
  startedAt: number;
  faction: FactionId;
  trust: number;
  profileStatus: 'active' | 'inactive' | 'suspended';
  suspendedUntil: number | null;
  streakWeeks: number;
  recentPaces: number[];
  zones: DbZone[];
  earnedToday: Record<string, number>;
  revealedFog: string[];
  ghostPace: number | null;
  now: number;
  /** RN-017: baús ainda fechados do corredor (só na missão Caça; vazio nas outras). */
  chests?: ChestCandidate[];
  /** RN-001: percursos dos colegas de Crew no mesmo intervalo (M_grupo). */
  crewTracks?: CrewTrack[];
};

export type ChestCandidate = { id: string; lat: number; lng: number; rarity: ChestRarity };
export type OpenedChest = { chestId: string; rarity: ChestRarity; xp: number };

type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };

export type ZoneWrite = {
  id: string;
  expectedVersion: number | null;
  name: string | null;
  geom?: string;
  influence: Influence;
  owner: FactionId | null;
  shield: number;
  attacker: FactionId | null;
  attackStartedAt: number | null;
  blocked: boolean;
};

export type OfficialResult = {
  status: ActivityStatus;
  scored: boolean;
  trustAfter: number;
  suspend: boolean;
  reviewReason: ReviewReason | null;
  zones: ZoneWrite[];
  activityZones: { zoneId: string; meters: number; rp: number; outcome: string; ownerBefore: FactionId | null; ownerAfter: FactionId | null }[];
  events: ZoneEvent[];
  fogCells: string[];
  chests: OpenedChest[];
  response: FinishResponse;
};

export type FinishResponse = {
  activityId: string;
  status: ActivityStatus;
  meters: number;
  movingSeconds: number;
  avgPace: number | null;
  rpTotal: number;
  xp: number;
  flags: CheatFlag[];
  invalidSegments: InvalidSegment[];
  zones: { zoneId: string; name: string; meters: number; rp: number; outcome: string; ownerBefore: FactionId | null; ownerAfter: FactionId | null }[];
  newFogCells: number;
  beatGhost: boolean | null;
  trust: number;
  review: { reason: ReviewReason; message: string } | null;
  /** RN-017: baús abertos nesta corrida (o XP já está em `xp`). */
  chests: OpenedChest[];
  /** RN-001: zonas que receberam M_grupo (1,25) e colegas de Crew que correram junto; null sem grupo. */
  group: { zones: string[]; members: number } | null;
};

export function cellPolygon(cell: string): GeoJsonPolygon {
  const ring = cellBoundary(cell).map((p) => [p.lng, p.lat]);
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

const toDomainZone = (z: DbZone): Zone => ({
  id: z.id,
  influence: { ...emptyInfluence(), ...(z.influence as Partial<Influence>) },
  owner: z.owner,
  shield: z.shield,
  attackStartedAt: z.attackStartedAt,
  attacker: z.attacker,
  blocked: z.blocked,
});

export function computeOfficialResult(input: ScoringInput): OfficialResult {
  const geo = toGeoPoints(input.points);
  const run: LiveRun = { ...startRun(input.startedAt), points: geo };
  const dbZones = new Map(input.zones.map((z) => [z.id, z]));
  const zones: Record<string, Zone> = {};
  for (const z of input.zones) zones[z.id] = toDomainZone(z);

  // RN-001: M_grupo — detectado antes da pontuação e repassado ao domain (ver group.ts)
  const pack = input.crewTracks?.length ? detectPack(geo, input.crewTracks) : null;
  const ctx = {
    faction: input.faction,
    basePace: basePace(input.recentPaces),
    streakDays: input.streakWeeks,
    zones,
    revealedFog: new Set(input.revealedFog),
    now: input.now,
    ghostPace: input.ghostPace ?? undefined,
    earnedTodayByZone: input.earnedToday,
    packZones: pack && pack.zones.length ? new Set(pack.zones) : undefined,
  };
  const result = finishRun(run, ctx);
  const v = result.validation;
  // RN-017: baús a até 25 m de um ponto de trecho válido (cada um abre uma vez)
  const opened = openChests(geo, v, input.chests ?? []);
  const chestXp = opened.reduce((sum, c) => sum + c.xp, 0);

  let status: ActivityStatus =
    v.status === 'valid' ? 'valid' : v.status === 'partially_valid' ? 'partial' : v.status === 'rejected' ? 'rejected' : 'review';
  let reviewReason: ReviewReason | null = v.status === 'under_review' ? 'NO_PEDOMETER_LONG_RUN' : null;
  let trustAfter = input.trust;
  let suspend = false;

  if (input.mode === 'finish') {
    trustAfter = applyTrust(input.trust, v.flags, v.status === 'valid');
    // RN-009: com índice abaixo de 40 (antes ou depois desta corrida) a corrida vai para revisão;
    // abaixo de 10 depois desta corrida, o corredor é suspenso.
    const level = trustLevel(Math.min(input.trust, trustAfter));
    if (trustLevel(trustAfter) === 'suspended') suspend = true;
    if (status !== 'rejected') {
      if (level === 'suspended') {
        status = 'review';
        reviewReason = 'TRUST_SUSPENDED';
      } else if (level === 'review') {
        status = 'review';
        reviewReason = 'LOW_TRUST';
      }
      if (input.profileStatus === 'suspended' && (input.suspendedUntil ?? Infinity) > input.now) {
        status = 'review';
        reviewReason = 'SUSPENDED';
      }
    }
  } else {
    if (v.status === 'rejected') {
      throw new HttpError(409, 'CANNOT_APPROVE', 'Corrida com localização simulada não pode ser aprovada.');
    }
    status = v.status === 'partially_valid' ? 'partial' : 'valid';
    reviewReason = null;
  }

  const scored = status === 'valid' || status === 'partial';
  const segments = invalidSegments(input.points, result);

  const zoneWrites: ZoneWrite[] = scored
    ? Object.values(result.updatedZones).map((z) => {
      const before = dbZones.get(z.id);
      return {
        id: z.id,
        expectedVersion: before ? before.version : null,
        name: before?.name ?? null,
        geom: before ? undefined : JSON.stringify(cellPolygon(z.id)),
        influence: z.influence,
        owner: z.owner,
        shield: z.shield,
        attacker: z.attacker,
        attackStartedAt: z.attackStartedAt,
        blocked: z.blocked,
      };
    })
    : [];

  const zoneOutcomes = scored ? result.zones : [];
  const avgPace = Number.isFinite(result.avgPace) ? Math.round(result.avgPace) : null;

  const response: FinishResponse = {
    activityId: input.activityId,
    status,
    meters: Math.round(result.meters),
    movingSeconds: Math.round(result.movingSeconds),
    avgPace,
    rpTotal: scored ? result.rpTotal : 0,
    xp: scored ? result.xp + chestXp : 0,
    flags: v.flags,
    invalidSegments: segments,
    zones: zoneOutcomes.map((o) => ({
      zoneId: o.zoneId,
      name: zoneLabel(o.zoneId, dbZones.get(o.zoneId)?.name),
      meters: Math.round(o.meters),
      rp: o.rp,
      outcome: o.outcome,
      ownerBefore: o.ownerBefore,
      ownerAfter: o.ownerAfter,
    })),
    newFogCells: scored ? result.newFogCells.length : 0,
    beatGhost: result.beatGhost,
    trust: trustAfter,
    review: status === 'review' && reviewReason ? { reason: reviewReason, message: REVIEW_MESSAGE[reviewReason] } : null,
    chests: scored ? opened : [],
    group: scored && pack && pack.zones.length ? { zones: pack.zones, members: pack.members.length } : null,
  };

  return {
    status,
    scored,
    trustAfter,
    suspend,
    reviewReason,
    zones: zoneWrites,
    activityZones: zoneOutcomes.map((o) => ({
      zoneId: o.zoneId,
      meters: o.meters,
      rp: o.rp,
      outcome: o.outcome,
      ownerBefore: o.ownerBefore,
      ownerAfter: o.ownerAfter,
    })),
    events: scored ? result.events : [],
    fogCells: scored ? result.newFogCells : [],
    chests: scored ? opened : [],
    response,
  };
}

/** Baús ao alcance (domain `chestsInReach`, 25 m) de algum ponto de trecho válido da corrida. */
export function openChests(points: GeoPoint[], validation: ReturnType<typeof validateActivity>, candidates: ChestCandidate[]): OpenedChest[] {
  if (candidates.length === 0 || validation.status === 'rejected') return [];
  const chests = candidates.map((c) => ({ id: c.id, position: { lat: c.lat, lng: c.lng }, rarity: c.rarity }));
  const opened = new Set<string>();
  const onValid = new Set<number>();
  for (const s of validation.steps) {
    if (!s.valid) continue;
    onValid.add(s.from);
    onValid.add(s.to);
  }
  for (const i of [...onValid].sort((a, b) => a - b)) {
    for (const c of chestsInReach(points[i], chests, opened)) opened.add(c.id);
  }
  return chests.filter((c) => opened.has(c.id)).map((c) => ({ chestId: c.id, rarity: c.rarity, xp: CHEST_XP[c.rarity] }));
}
