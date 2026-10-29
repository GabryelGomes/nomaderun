/**
 * Gravação v2 (T7.2.1, D-80): o que vem DEPOIS do cálculo v1, sem mudá-lo. Puro (sem I/O): recebe o resultado
 * oficial v1 (`FinishResponse`) e o contexto do banco (`svc_v2_context`) e devolve o que `svc_apply_v2` grava.
 * Depois, `buildExtras` monta o bloco opcional `extras` da resposta a partir do que o banco aplicou.
 *
 * Regras (todas do domain, D-02):
 *  - pintura: `paintCellsOfRun` + `applyPaint` (só com territory_rule = 'v2'; contrato E3 §1–§3);
 *  - pontos v2 (liga): `scoreRunV2` (sem sequência e sem fantasma, D-63);
 *  - raid: `raidDamage` (o banco confere de novo crítico e tetos em apply_raid_hit);
 *  - engajamento: `runXp`, `weekKeptXp`, `settleMission`, `levelProgress`, `runnerBand`, `seasonTrackStep` (E7 §8);
 *  - recordes: `computeRunStats` (_shared/records.ts); feed: `buildFeedRoute` (_shared/feed.ts, corte do domain).
 */
import {
  type ActivityValidation,
  applyPaint,
  basePace,
  brtCalendar,
  cellCenter,
  type ChestRarity,
  districtOf,
  type FactionId,
  type GeoPoint,
  type LatLng,
  levelProgress,
  type MissionActivity,
  type MissionAssignment,
  type MissionCadence,
  type MissionEvidence,
  type PaintCell,
  paintCellsOfRun,
  type PaintRunResult,
  paintZoneOf,
  type PrivacyCircle,
  raidDamage,
  type RaidPhase,
  runnerBand,
  runXp,
  scoreRunV2,
  seasonTrackStep,
  settleMission,
  weekKeptXp,
  XP_SOURCE_LABELS,
  type XpDayTotals,
  type XpSource,
  type ZoneEvent,
  type ZonePaint,
} from './domain.ts';
import { buildFeedRoute, type FeedHighlight, feedHighlights } from './feed.ts';
import { computeRunStats, type RunStats } from './records.ts';
import { cellPolygon, type FinishResponse, zoneLabel } from './scoring.ts';

/* ---------- contexto (svc_v2_context) ---------- */

export type V2Flags = { territoryRule: 'v1' | 'v2'; features: Record<string, boolean | undefined> };

type DbPaintZone = {
  id: string;
  version: number;
  owner: FactionId | null;
  blocked: boolean;
  inheritFaction: FactionId | null;
  inheritCells: number | null;
  inheritUntil: number | null;
  attacker: FactionId | null;
  attackStartedAt: number | null;
  attackLastAt: number | null;
  attackFlips: number;
  name: string | null;
};
type DbPaintCell = { cell: string; zoneId: string; faction: FactionId; layers: number; paintedAt: number };
type DbMission = {
  id: string;
  defId: string;
  kind: MissionCadence;
  slot: number;
  variant: 'base' | 'fallback';
  title: string;
  progress: number;
  target: number;
  xp: number;
  periodKey: string;
  availableFrom: number;
  availableUntil: number | null;
  completedAt: number | null;
  rerolled: boolean;
};

export type V2Context = {
  flags: V2Flags;
  done: V2Raw | null;
  /** B1: carimbo das gravações v2 da pessoa (servidor de 29/10 em diante). Volta no plano; velho → ZONE_CONFLICT. */
  stamp?: number;
  activity: { status: string; scored: boolean; endedAt: number | null; mission: string };
  day?: string;
  recentPaces?: number[];
  profile?: {
    faction: FactionId | null;
    trust: number;
    xp: number;
    lifetimeMeters: number;
    city: string | null;
    crewId: string | null;
    streakWeeks: number;
    bestStreak: number;
    freezesLeft: number;
    paused: boolean;
  };
  paint?: { zones: DbPaintZone[]; cells: DbPaintCell[]; paintedToday: string[] };
  earnedTodayV2?: Record<string, number>;
  raid?: {
    id: string;
    bossId: string;
    phase: RaidPhase;
    hp: number;
    hpMax: number;
    weakZones: string[];
    damageToday: number;
    metersToday: number;
  } | null;
  engagement?: {
    xpDay: XpDayTotals;
    weekId: string;
    weekBefore: number;
    seasonId: string;
    seasonXp: number;
    missions: DbMission[];
    evidence: MissionActivity[];
    dailyChest: { on: boolean; stored: number; openedToday: boolean; pity: number };
  };
  records?: Record<string, number>;
  feed?: { crewId: string | null; shareRunsToFeed: boolean; showMap: boolean; privacyZones: PrivacyCircle[] };
};

/** Alguma parte da v2 está ligada? (com tudo desligado, a resposta é exatamente a de hoje) */
export function v2On(flags: V2Flags | null | undefined): boolean {
  if (!flags) return false;
  const f = flags.features ?? {};
  return flags.territoryRule === 'v2' || !!(f.raid || f.league || f.missions || f.dailyChest || f.records || f.feed);
}

/** Na v2 do território, a gravação v1 só cria as zonas novas (neutras) e não emite eventos: a pintura decide. */
export const v2Territory = (flags: V2Flags | null | undefined) => flags?.territoryRule === 'v2';
/** Com o engajamento v2 ligado, o XP vem do livro (runXp em linhas); a v1 não credita (evita XP em dobro). */
export const v2Xp = (flags: V2Flags | null | undefined) => !!flags?.features?.missions;

/* ---------- resultado v1 visto pela v2 ---------- */

export type V1Summary = FinishResponse;

const domainStatus = (s: FinishResponse['status']): ActivityValidation['status'] =>
  s === 'valid' ? 'valid' : s === 'partial' ? 'partially_valid' : s === 'rejected' ? 'rejected' : 'under_review';
const isScored = (s: FinishResponse['status']) => s === 'valid' || s === 'partial';

/** Trechos da pintura e as zonas que eles tocam (para carregar o mundo inteiro dessas zonas). */
export function paintCellsOf(geo: readonly GeoPoint[], validation: ActivityValidation): { cells: string[]; zoneIds: string[] } {
  const cells = paintCellsOfRun(geo, validation);
  return { cells, zoneIds: [...new Set(cells.map(paintZoneOf))].sort() };
}

/** Pontos dos trechos válidos, em ordem (rota do feed). */
export function validRoute(geo: readonly GeoPoint[], validation: ActivityValidation): LatLng[] {
  const out: LatLng[] = [];
  let last = -1;
  for (const s of validation.steps) {
    if (!s.valid) continue;
    if (s.from !== last) out.push({ lat: geo[s.from].lat, lng: geo[s.from].lng });
    out.push({ lat: geo[s.to].lat, lng: geo[s.to].lng });
    last = s.to;
  }
  return out;
}

/* ---------- plano (payload de svc_apply_v2) ---------- */

export type PaintZoneWrite = {
  zoneId: string;
  expectedVersion: number | null;
  geom?: string;
  owner: FactionId | null;
  inheritFaction: FactionId | null;
  inheritCells: number | null;
  inheritUntil: number | null;
  attacker: FactionId | null;
  attackSince: number | null;
  attackLastAt: number | null;
  attackFlips: number;
  counts: Record<FactionId, number>;
};

export type PaintSummary = {
  rule: 'v2';
  cells: number;
  new: number;
  reinforced: number;
  flipped: number;
  weakened: number;
  /** Trechos que esta corrida pintou: só para o próprio corredor (resumo e card). */
  track: string[];
  zones: {
    zoneId: string;
    name: string;
    ownerBefore: FactionId | null;
    ownerAfter: FactionId | null;
    countsBefore: Record<FactionId, number>;
    countsAfter: Record<FactionId, number>;
    outcome: string;
    touched: number;
    flipped: number;
  }[];
};

export type V2Plan = {
  activityId: string;
  userId: string;
  faction: FactionId;
  nowMs: number;
  paint: {
    cells: (PaintCell & LatLng)[];
    zones: PaintZoneWrite[];
    marks: string[];
    events: ZoneEvent[];
    summary: PaintSummary;
  } | null;
  points: { total: number; zones: { zoneId: string; rp: number; capped: boolean }[] } | null;
  raid: { meters: number; damage: number; weakMeters: number; pack: boolean } | null;
  xpLines: { source: XpSource; amount: number }[] | null;
  weekKept: { ref: string; amount: number } | null;
  missionProgress: Record<string, number> | null;
  records: RunStats | null;
  feed: { route: string[] | null; routeHidden: boolean; highlights: FeedHighlight[] } | null;
  /** B1: o carimbo do contexto (só quando o servidor mandou). */
  stamp?: number;
};

const toZonePaint = (z: DbPaintZone): ZonePaint => ({
  zoneId: z.id,
  owner: z.owner,
  blocked: z.blocked,
  inherited: z.inheritFaction && z.inheritUntil !== null
    ? { faction: z.inheritFaction, cells: z.inheritCells ?? 0, until: z.inheritUntil }
    : null,
  attack: z.attacker
    ? {
      attacker: z.attacker,
      since: z.attackStartedAt ?? z.attackLastAt ?? 0,
      lastAt: z.attackLastAt ?? z.attackStartedAt ?? 0,
      flips: z.attackFlips ?? 0,
    }
    : null,
});

/** Pintura oficial de uma corrida (applyPaint) e o que gravar. Pré-condição: `ctx.paint.cells` = todas as zonas tocadas. */
export function planPaint(input: {
  cells: readonly string[];
  faction: FactionId;
  now: number;
  ctx: NonNullable<V2Context['paint']>;
}): { plan: NonNullable<V2Plan['paint']>; result: PaintRunResult } {
  const world = {
    cells: Object.fromEntries(input.ctx.cells.map((c) => [c.cell, { ...c } as PaintCell])),
    zones: Object.fromEntries(input.ctx.zones.map((z) => [z.id, toZonePaint(z)])),
  };
  const dbZones = new Map(input.ctx.zones.map((z) => [z.id, z]));
  const result = applyPaint(world, {
    cells: input.cells,
    faction: input.faction,
    now: input.now,
    paintedToday: new Set(input.ctx.paintedToday),
  });
  const counts = new Map(result.zones.map((z) => [z.zoneId, z.countsAfter]));
  const zones: PaintZoneWrite[] = result.updatedZones.map((z) => {
    const db = dbZones.get(z.zoneId);
    return {
      zoneId: z.zoneId,
      expectedVersion: db ? db.version : null,
      ...(db ? {} : { geom: JSON.stringify(cellPolygon(z.zoneId)) }),
      owner: z.owner,
      inheritFaction: z.inherited?.faction ?? null,
      inheritCells: z.inherited ? z.inherited.cells : null,
      inheritUntil: z.inherited ? z.inherited.until : null,
      attacker: z.attack?.attacker ?? null,
      attackSince: z.attack?.since ?? null,
      attackLastAt: z.attack?.lastAt ?? null,
      attackFlips: z.attack?.flips ?? 0,
      counts: counts.get(z.zoneId) ?? { striders: 0, coyotes: 0, owls: 0, volt: 0 },
    };
  });
  const kinds = { novo: 0, reforco: 0, virado: 0, enfraquecido: 0 };
  for (const c of result.changes) kinds[c.kind]++;
  const summary: PaintSummary = {
    rule: 'v2',
    cells: result.changes.length,
    new: kinds.novo,
    reinforced: kinds.reforco,
    flipped: kinds.virado,
    weakened: kinds.enfraquecido,
    track: result.paintedCells,
    zones: result.zones.map((z) => ({
      zoneId: z.zoneId,
      name: zoneLabel(z.zoneId, dbZones.get(z.zoneId)?.name),
      ownerBefore: z.ownerBefore,
      ownerAfter: z.ownerAfter,
      countsBefore: z.countsBefore,
      countsAfter: z.countsAfter,
      outcome: z.outcome,
      touched: z.touched,
      flipped: z.flipped,
    })),
  };
  return {
    result,
    plan: {
      cells: result.updatedCells.map((c) => ({ ...c, ...cellCenter(c.cell) })),
      zones,
      marks: result.paintedCells,
      events: result.events,
      summary,
    },
  };
}

/** A atividade atual como evidência das missões (contrato E7 §4). */
export function missionActivityOf(input: {
  activityId: string;
  endedAt: number;
  v1: V1Summary;
  paint: PaintSummary | null;
  raidMeters: number;
}): MissionActivity {
  const painted = input.v1.zones.filter((z) => z.rp > 0).map((z) => z.zoneId);
  const outcomes = input.paint
    ? input.paint.zones.map((z) => (z.outcome === 'conquistada' ? 'conquered' : z.outcome === 'defendida' ? 'defended' : 'other'))
    : input.v1.zones.map((z) => z.outcome);
  return {
    id: input.activityId,
    endedAt: input.endedAt,
    status: domainStatus(input.v1.status),
    meters: input.v1.meters,
    movingSeconds: input.v1.movingSeconds,
    atlasCells: input.v1.newFogCells,
    zonesPainted: painted,
    districts: [...new Set(painted.map(districtOf))],
    conquered: outcomes.filter((o) => o === 'conquered').length,
    defended: outcomes.filter((o) => o === 'defended').length,
    huntChests: input.v1.chests.length,
    beatGhost: input.v1.beatGhost,
    group: input.v1.group !== null,
    raidMeters: input.raidMeters,
  };
}

const toAssignment = (m: DbMission): MissionAssignment => ({
  missionId: m.defId,
  cadence: m.kind,
  period: m.periodKey,
  slot: m.slot,
  target: m.target,
  variant: m.variant,
  availableFrom: m.availableFrom,
  availableUntil: m.availableUntil,
  progress: m.progress,
  completedAt: m.completedAt,
  rerolled: m.rerolled,
});

/** Progresso absoluto de cada missão aberta (settleMission); o banco grava com greatest() e paga a conclusão. */
export function missionProgressMap(missions: readonly DbMission[], evidence: MissionEvidence, now: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of missions) {
    const settled = settleMission(toAssignment(m), evidence, now);
    if (settled.assignment.progress > m.progress) out[m.id] = settled.assignment.progress;
  }
  return out;
}

export function planV2(input: {
  activityId: string;
  userId: string;
  faction: FactionId;
  now: number;
  geo: readonly GeoPoint[];
  validation: ActivityValidation;
  paintCells: readonly string[];
  v1: V1Summary;
  ctx: V2Context;
  seed: number;
}): V2Plan {
  const { ctx, v1 } = input;
  const f = ctx.flags.features ?? {};
  const scored = isScored(v1.status);
  const plan: V2Plan = {
    activityId: input.activityId,
    userId: input.userId,
    faction: input.faction,
    nowMs: input.now,
    paint: null,
    points: null,
    raid: null,
    xpLines: null,
    weekKept: null,
    missionProgress: null,
    records: null,
    feed: null,
    ...(typeof ctx.stamp === 'number' && Number.isFinite(ctx.stamp) ? { stamp: ctx.stamp } : {}),
  };
  if (!scored) return plan;

  if (ctx.flags.territoryRule === 'v2' && ctx.paint) {
    plan.paint = planPaint({ cells: input.paintCells, faction: input.faction, now: input.now, ctx: ctx.paint }).plan;
  }

  if (f.league || ctx.flags.territoryRule === 'v2') {
    const zoneMeters: Record<string, number> = {};
    for (const z of v1.zones) zoneMeters[z.zoneId] = (zoneMeters[z.zoneId] ?? 0) + z.meters;
    const pts = scoreRunV2({
      zoneMeters,
      paceSecPerKm: v1.avgPace ?? Number.NaN,
      basePaceSecPerKm: basePace(ctx.recentPaces ?? []),
      packZones: v1.group ? new Set(v1.group.zones) : undefined,
      earnedTodayByZone: ctx.earnedTodayV2 ?? {},
    });
    plan.points = { total: pts.total, zones: pts.zones };
  }

  let raidMeters = 0;
  if (f.raid && ctx.raid) {
    const weak = new Set(ctx.raid.weakZones);
    const weakPointMeters = v1.zones.filter((z) => weak.has(z.zoneId)).reduce((s, z) => s + z.meters, 0);
    const hit = raidDamage({
      validMeters: v1.meters,
      weakPointMeters,
      phase: ctx.raid.phase,
      inPack: v1.group !== null,
      seed: input.activityId,
      damageToday: ctx.raid.damageToday,
      kmToday: ctx.raid.metersToday / 1000,
    });
    raidMeters = Math.round(hit.countedKm * 1000);
    plan.raid = { meters: Math.round(v1.meters), damage: hit.damage, weakMeters: Math.round(weakPointMeters), pack: hit.pack };
  }

  if (f.missions && ctx.engagement) {
    const e = ctx.engagement;
    const xp = runXp({
      status: domainStatus(v1.status),
      meters: v1.meters,
      movingSeconds: v1.movingSeconds,
      newAtlasCells: v1.newFogCells,
      beatGhost: v1.beatGhost,
      huntChests: v1.chests.map((c) => c.rarity as ChestRarity),
      today: e.xpDay,
    });
    plan.xpLines = xp.lines.map((l) => ({ source: l.source, amount: l.amount }));
    const kept = weekKeptXp(e.weekBefore, e.weekBefore + 1);
    plan.weekKept = kept > 0 ? { ref: e.weekId, amount: kept } : null;
    const current = missionActivityOf({
      activityId: input.activityId,
      endedAt: ctx.activity.endedAt ?? input.now,
      v1,
      paint: plan.paint?.summary ?? null,
      raidMeters,
    });
    plan.missionProgress = missionProgressMap(e.missions, { activities: [...e.evidence, current] }, input.now);
  }

  if (f.records) plan.records = computeRunStats(input.geo, input.validation);

  if (f.feed && ctx.feed && ctx.feed.crewId && ctx.feed.shareRunsToFeed) {
    const route = buildFeedRoute(validRoute(input.geo, input.validation), ctx.feed.privacyZones, {
      seed: input.seed,
      showMap: ctx.feed.showMap,
    });
    const conquered = plan.paint
      ? plan.paint.summary.zones.filter((z) => z.outcome === 'conquistada').map((z) => ({ name: z.name }))
      : v1.zones.filter((z) => z.outcome === 'conquered').map((z) => ({ name: z.name }));
    const raid = plan.raid ? raidDamage({
      validMeters: v1.meters,
      weakPointMeters: plan.raid.weakMeters,
      phase: ctx.raid!.phase,
      inPack: v1.group !== null,
      seed: input.activityId,
      damageToday: ctx.raid!.damageToday,
      kmToday: ctx.raid!.metersToday / 1000,
    }) : null;
    plan.feed = { ...route, highlights: feedHighlights({ conquered, raid }) };
  }
  return plan;
}

/* ---------- o que o banco aplicou (activities.v2_extras) → bloco "extras" ---------- */

type RawMission = { id: string; defId: string; kind: MissionCadence; title: string; xp: number; slot: number };
type RawChests = {
  opened: boolean;
  reason?: string;
  stored?: number;
  prizes?: { n: number; rarity: ChestRarity; xp: number; cosmeticId: string | null; duplicate: boolean; guaranteed: boolean }[];
  bonus?: { id: string; source: string; rarity: ChestRarity; xp: number; cosmeticId: string | null }[];
  pityLeft?: number;
};

export type V2Raw = {
  version: number;
  scored: boolean;
  repeated?: boolean;
  paint?: PaintSummary;
  points?: V2Plan['points'];
  league?: Record<string, unknown> | null;
  raid?: Record<string, unknown> | null;
  engagement?: {
    xpBefore: number;
    xpAfter: number;
    runXp: number;
    lines: { source: string; amount: number }[];
    lifetimeBefore: number;
    lifetimeAfter: number;
    seasonId: string;
    seasonXpBefore: number;
    seasonXpAfter: number;
    dailyChests: RawChests | null;
    missions: RawMission[];
    streak: { weeks: number; best: number; freezesLeft: number; activitiesThisWeek: number; weekKept: boolean; paused: boolean };
    comeback: string | null;
  };
  records?: { new: { kind: string; value: number; previous: number | null }[] };
  feed?: { itemId: string | null };
};

export type EngagementBlock = {
  xp: { total: number; lines: { source: string; amount: number; label: string }[] };
  level: { before: number; after: number; titleAfter: { id: string; name: string } | null };
  band: { before: string; after: string };
  dailyChests:
    | { opened: { n: number; rarity: ChestRarity; xp: number; cosmeticDrop: boolean; cosmeticId: string | null; guaranteed: boolean }[]; pityLeft: number }
    | { opened: []; reason: string; stored: number }
    | null;
  missions: { id: string; userMissionId: string; cadence: MissionCadence; text: string; xp: number }[];
  streak: { activitiesThisWeek: number; weekKept: boolean; weeks: number; best: number; freezesLeft: number; paused: boolean };
  season: { stepBefore: number; stepAfter: number; medal: 'bronze' | 'prata' | 'ouro' | null };
  ftue?: { stepDone: number | null; nextUnlocksAt: number | null };
  comeback?: { missionId: string };
};

export type V2Extras = {
  contract: 2;
  paint?: PaintSummary | null;
  points?: V2Plan['points'];
  raid?: Record<string, unknown> | null;
  league?: Record<string, unknown> | null;
  engagement?: EngagementBlock;
  records?: { new: { kind: string; value: number; previous: number | null }[] } | null;
  feed?: { itemId: string | null } | null;
};

const XP_EXTRA_LABELS: Record<string, string> = { raid: 'Chefão', league: 'Liga', medal: 'Medalha', track: 'Trilha da temporada' };
const xpLabel = (s: string) => XP_SOURCE_LABELS[s as XpSource] ?? XP_EXTRA_LABELS[s] ?? 'XP';

export function engagementBlock(e: NonNullable<V2Raw['engagement']>, now: number): EngagementBlock {
  const before = levelProgress(e.xpBefore);
  const after = levelProgress(e.xpAfter);
  const sBefore = seasonTrackStep(e.seasonXpBefore);
  const sAfter = seasonTrackStep(e.seasonXpAfter);
  const lines = e.lines.map((l) => ({ source: l.source, amount: l.amount, label: xpLabel(l.source) }));
  const c = e.dailyChests;
  const dailyChests: EngagementBlock['dailyChests'] = !c || c.reason === 'disabled'
    ? null
    : c.opened
    ? {
      opened: [...(c.prizes ?? [])].map((p) => ({
        n: p.n,
        rarity: p.rarity,
        xp: p.xp,
        cosmeticDrop: p.cosmeticId !== null,
        cosmeticId: p.cosmeticId,
        guaranteed: p.guaranteed,
      })),
      pityLeft: c.pityLeft ?? 0,
    }
    : { opened: [], reason: c.reason ?? 'status', stored: c.stored ?? 0 };
  const ftueDone = e.missions.filter((m) => m.kind === 'ftue');
  const block: EngagementBlock = {
    xp: { total: lines.reduce((s, l) => s + l.amount, 0), lines },
    level: { before: before.level, after: after.level, titleAfter: after.title.id !== before.title.id ? { id: after.title.id, name: after.title.name } : null },
    band: { before: runnerBand(e.lifetimeBefore).band.id, after: runnerBand(e.lifetimeAfter).band.id },
    dailyChests,
    missions: e.missions.map((m) => ({ id: m.defId, userMissionId: m.id, cadence: m.kind, text: m.title, xp: m.xp })),
    streak: e.streak,
    season: { stepBefore: sBefore.step, stepAfter: sAfter.step, medal: sAfter.medal !== sBefore.medal ? sAfter.medal : null },
  };
  if (ftueDone.length > 0) {
    block.ftue = {
      stepDone: Math.max(...ftueDone.map((m) => m.slot)),
      nextUnlocksAt: brtCalendar.at(brtCalendar.addDays(brtCalendar.clock(now).dayId, 1)),
    };
  }
  if (e.comeback) block.comeback = { missionId: e.comeback };
  return block;
}

export function buildExtras(raw: V2Raw, now: number): V2Extras {
  const out: V2Extras = { contract: 2 };
  if (raw.paint !== undefined) out.paint = raw.paint;
  if (raw.points !== undefined) out.points = raw.points;
  if (raw.raid !== undefined) out.raid = raw.raid;
  if (raw.league !== undefined) out.league = raw.league;
  if (raw.engagement) out.engagement = engagementBlock(raw.engagement, now);
  if (raw.records !== undefined) out.records = raw.records;
  if (raw.feed !== undefined) out.feed = raw.feed;
  return out;
}

/**
 * Corrida em revisão ou rejeitada: nada é gravado agora (a aprovação reprocessa). Com o engajamento ligado, o bloco
 * diz por que não houve XP nem baú.
 */
export function unscoredExtras(ctx: V2Context, v1: V1Summary): V2Extras {
  const out: V2Extras = { contract: 2 };
  if (ctx.flags.territoryRule === 'v2') out.paint = null;
  if (ctx.flags.features?.raid) out.raid = null;
  if (ctx.flags.features?.league) out.league = null;
  const e = ctx.engagement;
  if (ctx.flags.features?.missions && e && ctx.profile) {
    const xp = ctx.profile.xp;
    out.engagement = engagementBlock({
      xpBefore: xp,
      xpAfter: xp,
      runXp: 0,
      lines: [],
      lifetimeBefore: ctx.profile.lifetimeMeters,
      lifetimeAfter: ctx.profile.lifetimeMeters,
      seasonId: e.seasonId,
      seasonXpBefore: e.seasonXp,
      seasonXpAfter: e.seasonXp,
      dailyChests: e.dailyChest.on
        ? { opened: false, reason: e.dailyChest.openedToday ? 'already' : v1.status === 'review' ? 'review' : 'status', stored: e.dailyChest.stored }
        : null,
      missions: [],
      streak: {
        weeks: ctx.profile.streakWeeks,
        best: ctx.profile.bestStreak,
        freezesLeft: ctx.profile.freezesLeft,
        activitiesThisWeek: e.weekBefore,
        weekKept: false,
        paused: ctx.profile.paused,
      },
      comeback: null,
    }, Date.now());
  }
  return out;
}
