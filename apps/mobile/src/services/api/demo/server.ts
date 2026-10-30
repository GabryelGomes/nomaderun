/**
 * Regras do "servidor" de demonstração: o que as Edge Functions e as RPCs `svc_*` fazem no backend real,
 * sobre o banco em memória (`db.ts`). O cálculo oficial é o do próprio domain (`scoring.ts`).
 * Erros no formato do contrato (`docs/API_CONTRATO.md`): `DemoHttpError(status, code, message, details)`.
 */
import { cellCenter } from '@/domain/grid';
import type { FactionId } from '@/domain/types';
import { zoneName } from '@/demo/demo-data';
import { DEMO_MARK } from '@/demo/world';
import { signBatch, type SignedBatch } from '@/services/signing/canonical';

import { iso, msOf, type DemoDb, type Row } from './db';
import { CannotApproveError, computeDemoOfficial, zoneLabel, type DemoOfficial, type StoredPoint } from './scoring';

export class DemoHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { lastSeq?: number },
  ) {
    super(message);
    this.name = 'DemoHttpError';
  }
}

const FACTION_NAME: Record<FactionId, string> = { striders: 'Neon Striders', coyotes: 'Urban Coyotes', owls: 'Night Owls', volt: 'Volt Runners' };
const MAX_BATCH_POINTS = 500;
const HEX64 = /^[0-9a-f]{64}$/i;

function requireProfile(db: DemoDb, userId: string): Row {
  const p = db.profile(userId);
  if (!p) throw new DemoHttpError(401, 'UNAUTHORIZED', 'Sessão inválida. Entre de novo.');
  if (p.status === 'inactive') throw new DemoHttpError(401, 'ACCOUNT_INACTIVE', 'Conta inativa.');
  return p;
}

// -----------------------------------------------------------------------------------------------
// register-device / ingest-points (D-03, D-04)
// -----------------------------------------------------------------------------------------------
export function registerDevice(db: DemoDb, userId: string, body: Row): { deviceId: string } {
  requireProfile(db, userId);
  const deviceId = String(body.deviceId ?? '');
  const secret = String(body.secret ?? '');
  if (!deviceId || !secret) throw new DemoHttpError(400, 'VALIDATION', 'Envie deviceId e secret.');
  const owner = db.devices.get(deviceId);
  if (owner && owner.user_id !== userId) throw new DemoHttpError(409, 'DEVICE_TAKEN', 'Este aparelho já está registrado em outra conta. Gere um novo deviceId.');
  db.devices.set(deviceId, { device_id: deviceId, user_id: userId, secret, platform: String(body.platform ?? 'web'), model: typeof body.model === 'string' ? body.model : null });
  return { deviceId };
}

export function ingestPoints(db: DemoDb, userId: string, body: Row): { accepted: number; duplicates: number; lastSeq: number } {
  requireProfile(db, userId);
  const points = Array.isArray(body.points) ? (body.points as Row[]) : [];
  const fromSeq = Number(body.fromSeq);
  const toSeq = Number(body.toSeq);
  if (points.length === 0) throw new DemoHttpError(400, 'VALIDATION', 'Envie ao menos um ponto.');
  if (points.length > MAX_BATCH_POINTS) throw new DemoHttpError(400, 'VALIDATION', `No máximo ${MAX_BATCH_POINTS} pontos por lote.`);
  if (toSeq - fromSeq + 1 !== points.length) throw new DemoHttpError(400, 'VALIDATION', 'fromSeq/toSeq não batem com a quantidade de pontos.');
  if (typeof body.signature !== 'string' || !HEX64.test(body.signature)) throw new DemoHttpError(400, 'VALIDATION', 'Assinatura ausente ou mal formatada.');
  const device = db.devices.get(String(body.deviceId));
  if (!device || device.user_id !== userId) throw new DemoHttpError(401, 'UNKNOWN_DEVICE', 'Aparelho não registrado nesta conta. Registre o aparelho de novo.');
  const batch: SignedBatch = {
    activityId: String(body.activityId),
    deviceId: String(body.deviceId),
    fromSeq,
    toSeq,
    points: points.map((p) => ({ seq: Number(p.seq), lat: Number(p.lat), lng: Number(p.lng), t: Number(p.t), accuracy: p.accuracy as number | null, speed: p.speed as number | null, altitude: p.altitude as number | null, mocked: p.mocked as boolean | null, steps: p.steps as number | null })),
  };
  // A demonstração confere a assinatura HMAC de verdade: o sync assinado do app roda inteiro.
  if (signBatch(device.secret, batch) !== body.signature) throw new DemoHttpError(401, 'INVALID_SIGNATURE', 'Assinatura do lote inválida.');

  let act = db.tables.activities.find((a) => a.id === batch.activityId);
  if (act && act.user_id !== userId) throw new DemoHttpError(403, 'NOT_OWNER', 'Esta corrida pertence a outra conta.');
  if (!act) {
    const mission = body.mission === 'fuga' || body.mission === 'caca' ? body.mission : 'livre';
    const startedAt = typeof body.startedAt === 'number' ? body.startedAt : batch.points[0].t;
    act = db.activityRow(batch.activityId, userId, startedAt, mission, { device_id: batch.deviceId, ghost_pace: mission === 'fuga' && typeof body.ghostPace === 'number' ? body.ghostPace : null });
    db.tables.activities.push(act);
  }
  const lastSeq = Number(act.last_seq);
  if (act.status !== 'recording') throw new DemoHttpError(409, 'ACTIVITY_CLOSED', 'Esta corrida já foi finalizada.', { lastSeq });
  if (act.device_id && act.device_id !== batch.deviceId) throw new DemoHttpError(409, 'DEVICE_MISMATCH', 'Esta corrida foi iniciada em outro aparelho.');
  if (fromSeq > lastSeq + 1) throw new DemoHttpError(409, 'OUT_OF_ORDER', 'Lote fora de ordem: reenvie a partir do ponto seguinte ao último recebido.', { lastSeq });

  const stored = new Map(db.pointsOf(batch.activityId).map((p) => [Number(p.seq), p]));
  let accepted = 0;
  let duplicates = 0;
  for (const p of batch.points) {
    const prev = stored.get(p.seq);
    const row = { activity_id: batch.activityId, seq: p.seq, lat: p.lat, lng: p.lng, t: p.t, accuracy: p.accuracy ?? null, speed: p.speed ?? null, altitude: p.altitude ?? null, mocked: p.mocked ?? null, steps: p.steps ?? null };
    if (prev) {
      if (JSON.stringify(prev) !== JSON.stringify(row)) throw new DemoHttpError(409, 'REPLAY_MISMATCH', 'Reenvio com conteúdo diferente do lote já recebido.');
      duplicates++;
      continue;
    }
    db.tables.activity_points.push(row);
    accepted++;
  }
  act.last_seq = Math.max(lastSeq, toSeq);
  return { accepted, duplicates, lastSeq: Number(act.last_seq) };
}

// -----------------------------------------------------------------------------------------------
// finish-activity / moderate-activity (cálculo oficial + gravação, como svc_apply_activity_result)
// -----------------------------------------------------------------------------------------------
function storedPoints(db: DemoDb, activityId: string): StoredPoint[] {
  return db.pointsOf(activityId).map((p) => ({
    seq: Number(p.seq),
    lat: Number(p.lat),
    lng: Number(p.lng),
    t: Number(p.t),
    accuracy: (p.accuracy as number | null) ?? null,
    speed: (p.speed as number | null) ?? null,
    altitude: (p.altitude as number | null) ?? null,
    mocked: (p.mocked as boolean | null) ?? null,
    steps: (p.steps as number | null) ?? null,
  }));
}

function score(db: DemoDb, act: Row, mode: 'finish' | 'approve'): DemoOfficial {
  const userId = String(act.user_id);
  const profile = requireProfile(db, userId);
  const faction = profile.faction as FactionId | null;
  if (!faction) throw new DemoHttpError(409, 'FACTION_REQUIRED', 'Escolha uma facção antes de finalizar a corrida.');
  const points = storedPoints(db, String(act.id));
  const recentPaces = db.tables.activities
    .filter((a) => a.user_id === userId && a.scored === true && Number(a.avg_pace) > 0)
    .sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)))
    .slice(0, 10)
    .map((a) => Number(a.avg_pace))
    .reverse();
  const today = db.brToday();
  const earnedToday: Record<string, number> = {};
  for (const z of db.tables.activity_zones) {
    if (z.user_id === userId && String(z.created_at ?? '').slice(0, 10) === today) earnedToday[String(z.zone_id)] = (earnedToday[String(z.zone_id)] ?? 0) + Number(z.rp);
  }
  const chests = act.mission === 'caca' ? db.chests.filter((c) => c.user_id === userId && c.opened_at === null).map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, rarity: c.rarity })) : [];
  return computeDemoOfficial({
    mode,
    activityId: String(act.id),
    points,
    startedAt: msOf(act.started_at) ?? points[0]?.t ?? db.now(),
    faction,
    trust: Number(profile.trust ?? 100),
    profileStatus: (profile.status as 'active' | 'inactive' | 'suspended') ?? 'active',
    suspendedUntil: msOf(profile.suspended_until),
    streakWeeks: Number(profile.streak_weeks ?? 0),
    recentPaces,
    zones: db.zoneRowsAsDomain(),
    zoneNames: Object.fromEntries([...db.zones.values()].map((z) => [z.id, z.name])),
    earnedToday,
    revealedFog: db.tables.fog_cells.filter((f) => f.user_id === userId).map((f) => String(f.cell)),
    ghostPace: typeof act.ghost_pace === 'number' ? act.ghost_pace : null,
    mission: act.mission as 'livre' | 'fuga' | 'caca',
    now: db.now(),
    chests,
  });
}

/**
 * Grava o resultado. `effects: false` (histórico semeado) só fecha a corrida e guarda o resultado,
 * sem mexer nas zonas do mapa nem notificar: o mapa da demonstração fica com a história do seed.
 */
function apply(db: DemoDb, act: Row, official: DemoOfficial, opts: { mode: 'finish' | 'approve'; endedAt: number | null; effects: boolean }) {
  const userId = String(act.user_id);
  const r = official.response;
  const now = db.now();
  const profile = db.profile(userId)!;
  const points = db.pointsOf(String(act.id));
  // Os nomes das zonas novas entram no resultado, como o banco faz (P-12).
  for (const z of r.zones) {
    if (!db.zones.has(z.zoneId) && opts.effects) z.name = zoneName(z.zoneId);
  }
  Object.assign(act, {
    status: official.status,
    scored: official.scored,
    ended_at: iso(opts.endedAt ?? (points.length ? Number(points[points.length - 1].t) : now)),
    finished_at: iso(opts.effects ? now : (opts.endedAt ?? now) + 5000),
    meters: r.meters,
    moving_seconds: r.movingSeconds,
    avg_pace: r.avgPace,
    rp_total: r.rpTotal,
    xp: r.xp,
    beat_ghost: r.beatGhost,
    flags: r.flags,
    invalid_segments: r.invalidSegments,
    review_reason: official.reviewReason,
    result: r,
  });
  if (opts.mode === 'finish') {
    profile.trust = official.trustAfter;
    if (official.suspend) {
      profile.status = 'suspended';
      profile.suspended_until = iso(now + 30 * 86_400_000);
    }
  }
  if (!official.scored) return;
  if (opts.effects) profile.xp = Number(profile.xp ?? 0) + r.xp;
  const createdAt = act.ended_at ?? iso(now);
  const faction = profile.faction as FactionId;
  for (const z of r.zones) {
    db.tables.activity_zones.push({ activity_id: act.id, user_id: userId, zone_id: z.zoneId, faction, meters: z.meters, rp: z.rp, outcome: z.outcome, owner_before: z.ownerBefore, owner_after: z.ownerAfter, created_at: createdAt });
  }
  for (const cell of official.fogCells) db.tables.fog_cells.push({ user_id: userId, cell, created_at: createdAt });
  for (const c of official.chests) {
    db.tables.chest_opens.push({ user_id: userId, chest_id: c.chestId, activity_id: act.id, rarity: c.rarity, xp: c.xp, created_at: createdAt });
    const chest = db.chests.find((x) => x.id === c.chestId);
    if (chest) chest.opened_at = iso(now);
  }
  if (!opts.effects) return;
  for (const z of Object.values(official.updatedZones)) db.writeZone(z, zoneName(z.id));
  for (const ev of official.events) {
    const evFaction = 'faction' in ev ? ev.faction : 'attacker' in ev ? ev.attacker : null;
    const evFrom = 'from' in ev ? ev.from : 'owner' in ev ? ev.owner : null;
    db.zoneEvents.push({ zone_id: ev.zoneId, type: ev.type, faction: evFaction ?? null, from_faction: evFrom ?? null, created_at: iso(now)! });
    if (ev.type === 'captured' && ev.faction === faction) {
      const center = cellCenter(ev.zoneId);
      const name = zoneLabel(ev.zoneId, db.zones.get(ev.zoneId)?.name);
      db.insertNotification(userId, {
        type: 'conquest',
        title: 'Zona conquistada',
        body: `Você conquistou ${name} para os ${FACTION_NAME[faction]}.`,
        data: { zoneId: ev.zoneId, activityId: act.id, lat: center.lat, lng: center.lng },
      });
    }
  }
}

export function finishActivity(db: DemoDb, userId: string, body: Row, opts: { effects?: boolean } = {}) {
  const activityId = String(body.activityId ?? '');
  const lastSeq = Number(body.lastSeq ?? -1);
  const act = db.tables.activities.find((a) => a.id === activityId);
  if (!act) throw new DemoHttpError(409, 'MISSING_POINTS', 'O servidor ainda não recebeu os pontos desta corrida. Reenvie a fila.', { lastSeq: -1 });
  if (act.user_id !== userId) throw new DemoHttpError(403, 'NOT_OWNER', 'Esta corrida pertence a outra conta.');
  if (act.status !== 'recording') {
    if (act.result) return act.result as DemoOfficial['response'];
    throw new DemoHttpError(409, 'ACTIVITY_CLOSED', 'Esta corrida já foi finalizada.');
  }
  if (Number(act.last_seq) < lastSeq) throw new DemoHttpError(409, 'MISSING_POINTS', 'Faltam pontos desta corrida no servidor. Reenvie a fila.', { lastSeq: Number(act.last_seq) });
  const official = score(db, act, 'finish');
  const endedAt = typeof body.endedAt === 'number' ? Math.min(body.endedAt, db.now() + 5 * 60_000) : null;
  apply(db, act, official, { mode: 'finish', endedAt, effects: opts.effects ?? true });
  return official.response;
}

/** Fecha as corridas semeadas (histórico) com o cálculo oficial, sem mudar o mapa. */
export function settleSeededRuns(db: DemoDb) {
  for (const run of db.world.myRuns) {
    const act = db.tables.activities.find((a) => a.id === run.id);
    if (!act || act.status !== 'recording') continue;
    const last = run.points[run.points.length - 1];
    finishActivity(db, run.userId, { activityId: run.id, lastSeq: run.points.length - 1, endedAt: last.t }, { effects: false });
  }
}

export function moderateActivity(db: DemoDb, moderatorId: string, body: Row) {
  const me = requireProfile(db, moderatorId);
  if (!['moderator', 'admin'].includes(String(me.role)) || me.status !== 'active') throw new DemoHttpError(403, 'FORBIDDEN', 'Apenas moderadores podem decidir sobre corridas.');
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'reject' ? 'reject' : null;
  const justification = String(body.justification ?? '').trim();
  if (!decision) throw new DemoHttpError(400, 'VALIDATION', 'Decisão inválida (approve ou reject).');
  if (justification.length < 10 || justification.length > 1000) throw new DemoHttpError(400, 'VALIDATION', 'A justificativa precisa ter de 10 a 1000 caracteres.');
  const act = db.tables.activities.find((a) => a.id === body.activityId);
  if (!act) throw new DemoHttpError(404, 'NOT_FOUND', 'Corrida não encontrada.');
  if (act.user_id === moderatorId) throw new DemoHttpError(403, 'FORBIDDEN', 'Você não pode moderar a própria corrida.');
  if (act.status !== 'review') throw new DemoHttpError(409, 'NOT_IN_REVIEW', 'A corrida não está em revisão.');
  db.tables.moderation_reviews.push({ id: db.nextId('revisao'), activity_id: act.id, moderator_id: moderatorId, decision, justification, created_at: iso(db.now()) });
  if (decision === 'reject') {
    act.status = 'rejected';
    act.scored = false;
    db.insertNotification(String(act.user_id), {
      type: 'moderation',
      title: 'Corrida rejeitada',
      body: `Sua corrida foi rejeitada pela moderação e não gera pontos. Justificativa: ${justification}`,
      data: { activityId: act.id, decision: 'reject' },
    });
    return { activityId: act.id, decision, status: 'rejected' };
  }
  let official: DemoOfficial;
  try {
    official = score(db, act, 'approve');
  } catch (e) {
    if (e instanceof CannotApproveError) throw new DemoHttpError(409, 'CANNOT_APPROVE', e.message);
    throw e;
  }
  apply(db, act, official, { mode: 'approve', endedAt: msOf(act.ended_at), effects: true });
  db.insertNotification(String(act.user_id), {
    type: 'moderation',
    title: 'Corrida aprovada',
    body: 'Sua corrida foi aprovada pela moderação e já conta pontos.',
    data: { activityId: act.id, decision: 'approve' },
  });
  return { activityId: act.id, decision, status: official.status, result: official.response };
}

// -----------------------------------------------------------------------------------------------
// zones / zone
// -----------------------------------------------------------------------------------------------
export function zonesInBbox(db: DemoDb, bboxParam: string | null) {
  const parts = (bboxParam ?? '').split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) throw new DemoHttpError(400, 'VALIDATION', 'Parâmetro bbox deve ser minLng,minLat,maxLng,maxLat.');
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (maxLng - minLng > 1 + 1e-9 || maxLat - minLat > 1 + 1e-9) throw new DemoHttpError(400, 'VALIDATION', 'A caixa pode ter no máximo 1 grau por lado.');
  const zones = [...db.zones.values()]
    .filter((z) => {
      const c = cellCenter(z.id);
      return c.lng >= minLng && c.lng <= maxLng && c.lat >= minLat && c.lat <= maxLat;
    })
    .slice(0, 2000)
    .map((z) => ({ id: z.id, name: zoneLabel(z.id, z.name), city: z.city, owner: z.owner, influence: z.influence, shield: z.shield, attacker: z.attacker, attackStartedAt: msOf(z.attack_started_at), blocked: z.blocked }));
  return { zones };
}

export function zoneDetail(db: DemoDb, id: string | null) {
  if (!id || !/^[0-9a-f]{15}$/.test(id)) throw new DemoHttpError(400, 'VALIDATION', 'Parâmetro id deve ser o índice H3 da zona (15 caracteres hexadecimais).');
  const z = db.zones.get(id);
  if (!z) throw new DemoHttpError(404, 'NOT_FOUND', 'Zona ainda não existe: ninguém correu aqui.');
  const byUser = new Map<string, { username: string; faction: FactionId | null; rp: number }>();
  for (const az of db.tables.activity_zones) {
    if (az.zone_id !== id) continue;
    const p = db.profile(String(az.user_id));
    const cur = byUser.get(String(az.user_id)) ?? { username: String(p?.username ?? 'corredor.demo'), faction: (az.faction as FactionId) ?? null, rp: 0 };
    cur.rp += Number(az.rp);
    byUser.set(String(az.user_id), cur);
  }
  // O "passado" fictício da zona: os corredores do time dono, com a influência repartida.
  if (z.owner) {
    const owners = [...db.runners.values()].filter((r) => r.faction === z.owner).slice(0, 3);
    owners.forEach((r, i) => {
      if (!byUser.has(r.id)) byUser.set(r.id, { username: r.username, faction: r.faction, rp: Math.max(1, Math.round((z.influence[z.owner!] ?? 0) / (2 + i))) });
    });
  }
  const topRunners = [...byUser.values()].sort((a, b) => b.rp - a.rp).slice(0, 3);
  const events = db.zoneEvents
    .filter((e) => e.zone_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((e) => ({ type: e.type, faction: e.faction, from: e.from_faction, at: msOf(e.created_at) }));
  return { id: z.id, name: zoneLabel(z.id, z.name), city: z.city, owner: z.owner, influence: z.influence, shield: z.shield, attacker: z.attacker, attackStartedAt: msOf(z.attack_started_at), blocked: z.blocked, updatedAt: msOf(z.updated_at), topRunners, events };
}

// -----------------------------------------------------------------------------------------------
// account-export / account-delete (LGPD)
// -----------------------------------------------------------------------------------------------
export function accountExport(db: DemoDb, userId: string) {
  const profile = requireProfile(db, userId);
  const own = (rows: Row[]) => rows.filter((r) => r.user_id === userId).map(({ user_id: _u, ...rest }) => rest);
  const activities = db.tables.activities
    .filter((a) => a.user_id === userId)
    .map(({ result: _r, ...a }) => ({ ...a, points: db.pointsOf(String(a.id)).map(({ activity_id: _a, ...p }) => p) }));
  const crewId = db.crewOf(userId);
  const crew = crewId ? db.tables.crews.find((c) => c.id === crewId) : null;
  return {
    demonstracao: true,
    aviso: `${DEMO_MARK}: dados fictícios, gerados neste aparelho. Nada foi enviado a um servidor.`,
    exportedAt: iso(db.now()),
    profile,
    devices: [...db.devices.values()].filter((d) => d.user_id === userId).map((d) => ({ id: d.device_id, platform: d.platform, model: d.model })),
    activities,
    safetyContacts: own(db.tables.safety_contacts),
    notifications: own(db.tables.notifications),
    fogCells: db.tables.fog_cells.filter((f) => f.user_id === userId).map((f) => f.cell),
    chestOpens: own(db.tables.chest_opens),
    privacyZones: own(db.tables.privacy_zones),
    crew: crew ? { crewId: crew.id, name: crew.name, tag: crew.tag } : null,
  };
}

export function accountDelete(db: DemoDb, userId: string, body: Row) {
  requireProfile(db, userId);
  if (body.confirm !== 'EXCLUIR') throw new DemoHttpError(400, 'VALIDATION', 'Confirme com a palavra EXCLUIR.');
  if (typeof body.password !== 'string' || !body.password) throw new DemoHttpError(400, 'PASSWORD_REQUIRED', 'Digite sua senha atual para confirmar.');
  return { deleted: true, demonstracao: true };
}
