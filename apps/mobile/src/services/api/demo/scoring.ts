/**
 * Cálculo oficial de uma corrida no servidor de demonstração: o MESMO roteiro do
 * `supabase/functions/_shared/scoring.ts` (`computeOfficialResult`), sobre o próprio `src/domain`.
 * Só fica de fora o M_grupo (RN-001), que depende dos percursos de outras pessoas no mesmo horário.
 * O teste `scoring-parity.test.ts` compara este cálculo com o do servidor para as mesmas entradas.
 */
import { FLAG_EXPLANATION, validateActivity, type CheatFlag } from '@/domain/anti-cheat';
import { CHEST_XP, chestsInReach, type ChestRarity } from '@/domain/games';
import { finishRun, startRun, type LiveRun } from '@/domain/run-engine';
import { basePace } from '@/domain/scoring';
import { emptyInfluence, type Zone, type ZoneEvent } from '@/domain/territory';
import { applyTrust, trustLevel } from '@/domain/trust';
import type { FactionId, GeoPoint } from '@/domain/types';
import type { OfficialResult, OfficialStatus, ReviewReason } from '@/services/sync/types';

export type StoredPoint = { seq: number; lat: number; lng: number; t: number; accuracy: number | null; speed: number | null; altitude: number | null; mocked: boolean | null; steps: number | null };

export const REVIEW_MESSAGE: Record<ReviewReason, string> = {
  LOW_TRUST: 'Seu Índice de Confiança está abaixo de 40: a corrida passa por revisão manual e só pontua depois da aprovação.',
  TRUST_SUSPENDED: 'Seu Índice de Confiança ficou abaixo de 10: você está suspenso da competição por 30 dias e a corrida vai para revisão.',
  SUSPENDED: 'Sua conta está suspensa da competição: a corrida fica registrada, mas só pontua se a moderação aprovar.',
  NO_PEDOMETER_LONG_RUN: 'Este aparelho não informa passos e a corrida passou de 10 km: ela vai para revisão manual antes de pontuar.',
};

/** Mesmo rótulo de `zoneLabel` das functions (e de `private.zone_label` no SQL). */
export const zoneLabel = (id: string, name: string | null | undefined) => (name && name.trim() ? name : `Zona ${id.slice(7, 11).toUpperCase()}`);

/** QA-02: o fantasma só vale na Fuga e com ritmo de 150 a 900 s/km (igual a `officialGhostPace`). */
export function officialGhostPace(mission: 'livre' | 'fuga' | 'caca' | undefined, ghostPace: number | null): number | undefined {
  if (mission !== 'fuga' || ghostPace === null || !Number.isFinite(ghostPace)) return undefined;
  return ghostPace >= 150 && ghostPace <= 900 ? ghostPace : undefined;
}

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

export type ChestCandidate = { id: string; lat: number; lng: number; rarity: ChestRarity };
export type OpenedChest = { chestId: string; rarity: ChestRarity; xp: number };

export type DemoScoringInput = {
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
  zones: Record<string, Zone>;
  zoneNames: Record<string, string | null>;
  earnedToday: Record<string, number>;
  revealedFog: string[];
  ghostPace: number | null;
  mission?: 'livre' | 'fuga' | 'caca';
  now: number;
  chests?: ChestCandidate[];
};

export type DemoOfficial = {
  status: OfficialStatus;
  scored: boolean;
  trustAfter: number;
  suspend: boolean;
  reviewReason: ReviewReason | null;
  updatedZones: Record<string, Zone>;
  events: ZoneEvent[];
  fogCells: string[];
  chests: OpenedChest[];
  response: OfficialResult & { chests: OpenedChest[]; group: null };
};

/** Agrupa os trechos invalidados em sequência (mesmo motivo), como `invalidSegments` das functions. */
function invalidSegments(points: StoredPoint[], run: ReturnType<typeof finishRun>) {
  const v = run.validation;
  if (v.status === 'rejected' && v.flags.includes('MOCK_LOCATION') && points.length > 0) {
    return [{ fromSeq: points[0].seq, toSeq: points[points.length - 1].seq, code: 'MOCK_LOCATION' as CheatFlag, reason: FLAG_EXPLANATION.MOCK_LOCATION }];
  }
  const out: { fromSeq: number; toSeq: number; code: CheatFlag; reason: string }[] = [];
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

/** Baús a até 25 m de um ponto de trecho válido (cada um abre uma vez), como `openChests` das functions. */
function openChests(points: GeoPoint[], validation: ReturnType<typeof validateActivity>, candidates: ChestCandidate[]): OpenedChest[] {
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

export class CannotApproveError extends Error {
  readonly code = 'CANNOT_APPROVE';
}

export function computeDemoOfficial(input: DemoScoringInput): DemoOfficial {
  const geo = toGeoPoints(input.points);
  const run: LiveRun = { ...startRun(input.startedAt), points: geo };
  const zones: Record<string, Zone> = {};
  for (const [id, z] of Object.entries(input.zones)) zones[id] = { ...z, influence: { ...emptyInfluence(), ...z.influence } };
  const result = finishRun(run, {
    faction: input.faction,
    basePace: basePace(input.recentPaces),
    streakDays: input.streakWeeks,
    zones,
    revealedFog: new Set(input.revealedFog),
    now: input.now,
    ghostPace: officialGhostPace(input.mission, input.ghostPace),
    earnedTodayByZone: input.earnedToday,
  });
  const v = result.validation;
  const opened = openChests(geo, v, input.chests ?? []);
  const chestXp = opened.reduce((sum, c) => sum + c.xp, 0);

  let status: OfficialStatus = v.status === 'valid' ? 'valid' : v.status === 'partially_valid' ? 'partial' : v.status === 'rejected' ? 'rejected' : 'review';
  let reviewReason: ReviewReason | null = v.status === 'under_review' ? 'NO_PEDOMETER_LONG_RUN' : null;
  let trustAfter = input.trust;
  let suspend = false;

  if (input.mode === 'finish') {
    trustAfter = applyTrust(input.trust, v.flags, v.status === 'valid');
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
    if (v.status === 'rejected') throw new CannotApproveError('Corrida com localização simulada não pode ser aprovada.');
    status = v.status === 'partially_valid' ? 'partial' : 'valid';
    reviewReason = null;
  }

  const scored = status === 'valid' || status === 'partial';
  const outcomes = scored ? result.zones : [];
  const avgPace = Number.isFinite(result.avgPace) ? Math.round(result.avgPace) : null;

  return {
    status,
    scored,
    trustAfter,
    suspend,
    reviewReason,
    updatedZones: scored ? result.updatedZones : {},
    events: scored ? result.events : [],
    fogCells: scored ? result.newFogCells : [],
    chests: scored ? opened : [],
    response: {
      activityId: input.activityId,
      status,
      meters: Math.round(result.meters),
      movingSeconds: Math.round(result.movingSeconds),
      avgPace,
      rpTotal: scored ? result.rpTotal : 0,
      xp: scored ? result.xp + chestXp : 0,
      flags: v.flags,
      invalidSegments: invalidSegments(input.points, result),
      zones: outcomes.map((o) => ({
        zoneId: o.zoneId,
        name: zoneLabel(o.zoneId, input.zoneNames[o.zoneId]),
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
      group: null,
    },
  };
}
