/**
 * Resumo da corrida como a tela usa (RF-006). Duas origens com o mesmo formato:
 *  - oficial: resposta do `finish-activity` (servidor autoritativo, RNF-006);
 *  - provisória: o mesmo `finishRun` do domain rodando no aparelho sobre os MESMOS pontos da fila,
 *    com as mesmas regras de status do servidor (UC-01 A1). É substituída pela oficial ao sincronizar.
 */
import { FLAG_EXPLANATION, type CheatFlag } from '@/domain/anti-cheat';
import { finishRun, startRun, type RunContext, type RunResult } from '@/domain/run-engine';
import { applyTrust, trustLevel } from '@/domain/trust';
import type { FactionId, GeoPoint, LatLng } from '@/domain/types';
import type { QueuedPoint } from '@/services/offline/types';
import type { InvalidSegment, OfficialOutcome, OfficialResult, OfficialStatus, ReviewReason } from '@/services/sync/types';

export type SummaryZone = {
  zoneId: string;
  name: string;
  meters: number;
  rp: number;
  outcome: OfficialOutcome;
  ownerBefore: FactionId | null;
  ownerAfter: FactionId | null;
};

export type RunSummary = {
  source: 'provisional' | 'official';
  status: OfficialStatus;
  meters: number;
  movingSeconds: number;
  avgPace: number | null;
  rpTotal: number;
  xp: number;
  flags: CheatFlag[];
  invalidSegments: InvalidSegment[];
  zones: SummaryZone[];
  newFogCells: number;
  beatGhost: boolean | null;
  trust: number | null;
  review: { reason: ReviewReason; message: string } | null;
};

/** Mesmos textos do servidor (`supabase/functions/_shared/scoring.ts`). */
export const REVIEW_MESSAGE: Record<ReviewReason, string> = {
  LOW_TRUST: 'Seu Índice de Confiança está abaixo de 40: a corrida passa por revisão manual e só pontua depois da aprovação.',
  TRUST_SUSPENDED: 'Seu Índice de Confiança ficou abaixo de 10: você está suspenso da competição por 30 dias e a corrida vai para revisão.',
  SUSPENDED: 'Sua conta está suspensa da competição: a corrida fica registrada, mas só pontua se a moderação aprovar.',
  NO_PEDOMETER_LONG_RUN: 'Este aparelho não informa passos e a corrida passou de 10 km: ela vai para revisão manual antes de pontuar.',
};

/** Nome de zona sem nome no servidor (igual a `zoneLabel` das functions). */
export const zoneLabel = (id: string, name?: string | null) => (name && name.trim() ? name : `Zona ${id.slice(7, 11).toUpperCase()}`);

/** null do banco/fila → ausente no domain (como `toGeoPoints` do servidor). */
export function toGeoPoints(points: QueuedPoint[]): GeoPoint[] {
  return points.map((p) => {
    const g: GeoPoint = { lat: p.lat, lng: p.lng, t: p.t };
    if (p.accuracy !== null && p.accuracy !== undefined) g.accuracy = p.accuracy;
    if (p.mocked !== null && p.mocked !== undefined) g.mocked = p.mocked;
    if (p.steps !== null && p.steps !== undefined) g.steps = p.steps;
    return g;
  });
}

/** Trechos inválidos agrupados por motivo, com `seq` (igual ao servidor). */
export function invalidSegmentsOf(points: QueuedPoint[], result: RunResult): InvalidSegment[] {
  const v = result.validation;
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

export type ProvisionalInput = {
  points: QueuedPoint[];
  startedAt: number;
  context: RunContext;
  /** Índice de Confiança atual (RN-009: < 40 vai para revisão). */
  trust: number;
  zoneNames?: Record<string, string | null | undefined>;
};

export function provisionalSummary(input: ProvisionalInput): { summary: RunSummary; result: RunResult } {
  const run = { ...startRun(input.startedAt), points: toGeoPoints(input.points) };
  const result = finishRun(run, input.context);
  const v = result.validation;
  let status: OfficialStatus = v.status === 'valid' ? 'valid' : v.status === 'partially_valid' ? 'partial' : v.status === 'rejected' ? 'rejected' : 'review';
  let reviewReason: ReviewReason | null = v.status === 'under_review' ? 'NO_PEDOMETER_LONG_RUN' : null;
  const trustAfter = applyTrust(input.trust, v.flags, v.status === 'valid');
  if (status !== 'rejected') {
    const level = trustLevel(Math.min(input.trust, trustAfter));
    if (level === 'suspended') {
      status = 'review';
      reviewReason = 'TRUST_SUSPENDED';
    } else if (level === 'review') {
      status = 'review';
      reviewReason = 'LOW_TRUST';
    }
  }
  const scored = status === 'valid' || status === 'partial';
  const zones = scored ? result.zones : [];
  return {
    result,
    summary: {
      source: 'provisional',
      status,
      meters: Math.round(result.meters),
      movingSeconds: Math.round(result.movingSeconds),
      avgPace: Number.isFinite(result.avgPace) ? Math.round(result.avgPace) : null,
      rpTotal: scored ? result.rpTotal : 0,
      xp: scored ? result.xp : 0,
      flags: v.flags,
      invalidSegments: invalidSegmentsOf(input.points, result),
      zones: zones.map((z) => ({ ...z, meters: Math.round(z.meters), name: zoneLabel(z.zoneId, input.zoneNames?.[z.zoneId]) })),
      newFogCells: scored ? result.newFogCells.length : 0,
      beatGhost: result.beatGhost,
      trust: trustAfter,
      review: status === 'review' && reviewReason ? { reason: reviewReason, message: REVIEW_MESSAGE[reviewReason] } : null,
    },
  };
}

export function officialSummary(r: OfficialResult): RunSummary {
  return {
    source: 'official',
    status: r.status,
    meters: r.meters,
    movingSeconds: r.movingSeconds,
    avgPace: r.avgPace,
    rpTotal: r.rpTotal,
    xp: r.xp,
    flags: r.flags ?? [],
    invalidSegments: r.invalidSegments ?? [],
    zones: (r.zones ?? []).map((z) => ({ ...z, name: zoneLabel(z.zoneId, z.name) })),
    newFogCells: r.newFogCells,
    beatGhost: r.beatGhost,
    trust: r.trust,
    review: r.review,
  };
}

/** Explicação dos trechos que não contaram (E1/E2), sem repetir o mesmo motivo. */
export function invalidReasons(s: RunSummary): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of s.invalidSegments) {
    if (seen.has(seg.code)) continue;
    seen.add(seg.code);
    out.push(seg.reason || FLAG_EXPLANATION[seg.code]);
  }
  for (const f of s.flags) {
    if (f === 'NO_PEDOMETER' || seen.has(f)) continue;
    seen.add(f);
    out.push(FLAG_EXPLANATION[f]);
  }
  return out;
}

/** Percurso simplificado para guardar com a corrida: no máximo `max` pontos, sempre com o último. */
export function simplifyPath(points: LatLng[], max = 600): [number, number][] {
  if (points.length <= max) return points.map((p) => [p.lat, p.lng]);
  const step = (points.length - 1) / (max - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < max; i++) {
    const p = points[Math.round(i * step)];
    out.push([p.lat, p.lng]);
  }
  return out;
}

export const STATUS_LABEL: Record<OfficialStatus, string> = {
  valid: 'Válida',
  partial: 'Parcialmente válida',
  rejected: 'Rejeitada',
  review: 'Em revisão',
};
