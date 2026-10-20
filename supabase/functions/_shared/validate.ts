/** Validação das entradas das functions. Mensagens em português; erro sempre VALIDATION (400). */
import { HttpError } from './http.ts';
import type { SignedPoint } from './hmac.ts';

export const MAX_BATCH_POINTS = 500;
export const MISSIONS = ['livre', 'fuga', 'caca'] as const;
export const PLATFORMS = ['ios', 'android', 'web'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const H3_RE = /^[0-9a-f]{15}$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;
/** 2020-01-01 em epoch ms: nenhum ponto válido é anterior a isso. */
const MIN_EPOCH_MS = 1_577_836_800_000;
/**
 * QA-02 (D-50): ritmo do fantasma da Fuga em s/km. O app oferece 5:00–7:00; a faixa aceita vai de 2:30 (elite) a
 * 15:00 (caminhada). Fora da missão `fuga` o valor é ignorado (nunca dá M_fantasma nem +50 XP).
 */
export const GHOST_PACE_MIN = 150;
export const GHOST_PACE_MAX = 900;
/** QA-09 (D-50): `endedAt` do finish pode passar de agora em no máximo 5 min (relógio do aparelho adiantado). */
export const ENDED_AT_TOLERANCE_MS = 5 * 60_000;

const fail = (message: string): never => {
  throw new HttpError(400, 'VALIDATION', message);
};

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
export const isH3 = (v: unknown): v is string => typeof v === 'string' && H3_RE.test(v);

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function optionalNumber(v: unknown, field: string, min = -Infinity, max = Infinity): number | null {
  if (v === undefined || v === null) return null;
  if (!isNum(v) || v < min || v > max) fail(`Campo ${field} inválido.`);
  return v as number;
}

export function requireUuid(v: unknown, field: string): string {
  if (!isUuid(v)) fail(`Campo ${field} deve ser um UUID.`);
  return (v as string).toLowerCase();
}

export type IngestBody = {
  activityId: string;
  deviceId: string;
  startedAt: number | null;
  mission: (typeof MISSIONS)[number] | null;
  ghostPace: number | null;
  fromSeq: number;
  toSeq: number;
  points: SignedPoint[];
  signature: string;
};

/** POST /ingest-points (D-03, D-04). `now` é injetável para os testes. */
export function parseIngestBody(body: unknown, now = Date.now()): IngestBody {
  if (!isObject(body)) fail('Corpo deve ser um objeto JSON.');
  const b = body as Record<string, unknown>;
  // Mantém os UUIDs como vieram: a assinatura é conferida sobre o texto original.
  if (!isUuid(b.activityId)) fail('Campo activityId deve ser um UUID.');
  if (!isUuid(b.deviceId)) fail('Campo deviceId deve ser um UUID.');
  if (!isInt(b.fromSeq) || (b.fromSeq as number) < 0) fail('Campo fromSeq deve ser um inteiro ≥ 0.');
  if (!isInt(b.toSeq)) fail('Campo toSeq deve ser um inteiro.');
  if (!Array.isArray(b.points) || b.points.length === 0) fail('Envie ao menos um ponto.');
  const raw = b.points as unknown[];
  if (raw.length > MAX_BATCH_POINTS) fail(`No máximo ${MAX_BATCH_POINTS} pontos por lote.`);
  const fromSeq = b.fromSeq as number;
  const toSeq = b.toSeq as number;
  if (toSeq - fromSeq + 1 !== raw.length) fail('fromSeq/toSeq não batem com a quantidade de pontos.');
  if (typeof b.signature !== 'string' || !HEX64_RE.test(b.signature)) fail('Assinatura ausente ou mal formatada.');

  const maxT = now + 24 * 3600 * 1000;
  const points: SignedPoint[] = raw.map((p, i) => {
    if (!isObject(p)) fail(`Ponto ${i} inválido.`);
    const q = p as Record<string, unknown>;
    if (q.seq !== fromSeq + i) fail(`Pontos devem vir em sequência: esperado seq ${fromSeq + i}.`);
    if (!isNum(q.lat) || (q.lat as number) < -90 || (q.lat as number) > 90) fail(`Latitude inválida no ponto ${q.seq}.`);
    if (!isNum(q.lng) || (q.lng as number) < -180 || (q.lng as number) > 180) fail(`Longitude inválida no ponto ${q.seq}.`);
    if (!isInt(q.t) || (q.t as number) < MIN_EPOCH_MS || (q.t as number) > maxT) fail(`Horário (t) inválido no ponto ${q.seq}.`);
    if (q.mocked !== undefined && q.mocked !== null && typeof q.mocked !== 'boolean') fail(`Campo mocked inválido no ponto ${q.seq}.`);
    if (q.steps !== undefined && q.steps !== null && (!isInt(q.steps) || (q.steps as number) < 0)) {
      fail(`Campo steps inválido no ponto ${q.seq}.`);
    }
    return {
      seq: q.seq as number,
      lat: q.lat as number,
      lng: q.lng as number,
      t: q.t as number,
      accuracy: optionalNumber(q.accuracy, 'accuracy', 0, 100_000),
      speed: optionalNumber(q.speed, 'speed', -1, 1000),
      altitude: optionalNumber(q.altitude, 'altitude', -1000, 20_000),
      mocked: (q.mocked as boolean | null | undefined) ?? null,
      steps: (q.steps as number | null | undefined) ?? null,
    };
  });
  for (let i = 1; i < points.length; i++) {
    if (points[i].t < points[i - 1].t) fail(`Horário fora de ordem no ponto ${points[i].seq}.`);
  }

  let mission: IngestBody['mission'] = null;
  if (b.mission !== undefined && b.mission !== null) {
    if (!MISSIONS.includes(b.mission as never)) fail('Missão inválida (livre, fuga ou caca).');
    mission = b.mission as IngestBody['mission'];
  }
  const pace = optionalNumber(b.ghostPace, 'ghostPace (150 a 900 s/km)', GHOST_PACE_MIN, GHOST_PACE_MAX);
  const ghostPace = mission === 'fuga' ? pace : null;
  const startedAt = b.startedAt === undefined || b.startedAt === null ? null : (b.startedAt as number);
  if (startedAt !== null && (!isInt(startedAt) || startedAt < MIN_EPOCH_MS || startedAt > maxT)) fail('Campo startedAt inválido.');

  return {
    activityId: b.activityId as string,
    deviceId: b.deviceId as string,
    startedAt,
    mission,
    ghostPace,
    fromSeq,
    toSeq,
    points,
    signature: (b.signature as string).toLowerCase(),
  };
}

export type RegisterDeviceBody = { deviceId: string; secret: string; platform: (typeof PLATFORMS)[number]; model: string | null };

export function parseRegisterDevice(body: unknown): RegisterDeviceBody {
  if (!isObject(body)) fail('Corpo deve ser um objeto JSON.');
  const b = body as Record<string, unknown>;
  const deviceId = requireUuid(b.deviceId, 'deviceId');
  if (typeof b.secret !== 'string') fail('Campo secret (base64 de 32 bytes) é obrigatório.');
  let bytes = 0;
  try {
    bytes = atob(b.secret as string).length;
  } catch {
    fail('Campo secret não é base64 válido.');
  }
  if (bytes !== 32) fail('A chave do aparelho deve ter exatamente 32 bytes.');
  if (!PLATFORMS.includes(b.platform as never)) fail('Plataforma inválida (ios, android ou web).');
  let model: string | null = null;
  if (b.model !== undefined && b.model !== null) {
    if (typeof b.model !== 'string' || b.model.length > 100) fail('Campo model inválido (até 100 caracteres).');
    model = b.model as string;
  }
  return { deviceId, secret: b.secret as string, platform: b.platform as RegisterDeviceBody['platform'], model };
}

export type FinishBody = { activityId: string; endedAt: number | null; lastSeq: number };

export function parseFinish(body: unknown): FinishBody {
  if (!isObject(body)) fail('Corpo deve ser um objeto JSON.');
  const b = body as Record<string, unknown>;
  const activityId = requireUuid(b.activityId, 'activityId');
  if (!isInt(b.lastSeq) || (b.lastSeq as number) < -1) fail('Campo lastSeq deve ser um inteiro.');
  let endedAt: number | null = null;
  if (b.endedAt !== undefined && b.endedAt !== null) {
    if (!isInt(b.endedAt) || (b.endedAt as number) < MIN_EPOCH_MS) fail('Campo endedAt inválido.');
    endedAt = b.endedAt as number;
  }
  return { activityId, endedAt, lastSeq: b.lastSeq as number };
}

/** QA-09: `endedAt` entre o início da corrida e agora + 5 min (null = usar o horário do último ponto). */
export function checkEndedAt(endedAt: number | null, startedAt: number, now = Date.now()): number | null {
  if (endedAt === null) return null;
  if (endedAt < startedAt) fail('Campo endedAt anterior ao início da corrida.');
  if (endedAt > now + ENDED_AT_TOLERANCE_MS) fail('Campo endedAt no futuro.');
  return endedAt;
}

export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

/** `bbox=minLng,minLat,maxLng,maxLat`. Recusa caixas maiores que ~1 grau (≈ 110 km) para proteger o banco. */
export function parseBbox(value: string | null): Bbox {
  if (!value) fail('Parâmetro bbox é obrigatório (minLng,minLat,maxLng,maxLat).');
  const parts = (value as string).split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) fail('bbox deve ter 4 números: minLng,minLat,maxLng,maxLat.');
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) fail('bbox fora dos limites de latitude/longitude.');
  if (minLng >= maxLng || minLat >= maxLat) fail('bbox inválido: mínimo deve ser menor que máximo.');
  if (maxLng - minLng > 1 || maxLat - minLat > 1) fail('Área muito grande: aproxime o mapa (máx. 1 grau por lado).');
  return { minLng, minLat, maxLng, maxLat };
}

export type ModerateBody = { activityId: string; decision: 'approve' | 'reject'; justification: string };

export function parseModerate(body: unknown): ModerateBody {
  if (!isObject(body)) fail('Corpo deve ser um objeto JSON.');
  const b = body as Record<string, unknown>;
  const activityId = requireUuid(b.activityId, 'activityId');
  if (b.decision !== 'approve' && b.decision !== 'reject') fail('Decisão deve ser approve ou reject.');
  const justification = typeof b.justification === 'string' ? b.justification.trim() : '';
  if (justification.length < 10) fail('A justificativa é obrigatória (mínimo de 10 caracteres).');
  if (justification.length > 1000) fail('Justificativa muito longa (máximo de 1000 caracteres).');
  return { activityId, decision: b.decision as ModerateBody['decision'], justification };
}
