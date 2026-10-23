/** Orquestra o cálculo oficial + gravação transacional, com novas tentativas em caso de conflito (D-23). */
import type { FactionId } from './domain.ts';
import { HttpError } from './http.ts';
import type { CrewTrack } from './group.ts';
import {
  candidateCells,
  type ChestCandidate,
  computeOfficialResult,
  type DbZone,
  type FinishResponse,
  type StoredPoint,
  toGeoPoints,
} from './scoring.ts';
import { DbError, rpc } from './supabase.ts';
import { type V2Extras, v2Territory, v2Xp } from './v2.ts';
import { loadFlags, safeRunV2, withExtras } from './v2-run.ts';

export type ActivityRow = {
  id: string;
  user_id: string;
  status: string;
  started_at: string;
  ghost_pace: number | null;
  last_seq: number;
  mission?: 'livre' | 'fuga' | 'caca';
};

export type LoadedActivity = { activity: ActivityRow | null; points: StoredPoint[]; result: FinishResponse | null };

type FinishContext = {
  profile: {
    faction: FactionId | null;
    trust: number;
    status: 'active' | 'inactive' | 'suspended';
    suspendedUntil: number | null;
    streakWeeks: number;
  } | null;
  recentPaces: number[];
  zones: DbZone[];
  earnedToday: Record<string, number>;
  revealedFog: string[];
  chests?: ChestCandidate[];
};

export const MAX_ATTEMPTS = 3;

export async function loadActivity(activityId: string): Promise<LoadedActivity> {
  const data = await rpc<LoadedActivity | null>('svc_load_activity', { p_activity: activityId });
  return data ?? { activity: null, points: [], result: null };
}

export async function scoreAndApply(opts: {
  mode: 'finish' | 'approve';
  activity: ActivityRow;
  points: StoredPoint[];
  endedAt: number | null;
  moderation?: { moderatorId: string; justification: string };
}): Promise<FinishResponse & { extras?: V2Extras }> {
  const { activity, points, mode } = opts;
  // D-80: flags da v2 (null no servidor antigo ou com erro = tudo desligado, igual à v1)
  const flags = await loadFlags();
  const v2 = (result: FinishResponse) =>
    safeRunV2({ activityId: activity.id, userId: activity.user_id, points, response: result, flags })
      .then((extras) => withExtras(result, extras));
  const { zoneIds, fogCells } = candidateCells(toGeoPoints(points));
  // RN-001 (M_grupo): percursos dos colegas de Crew no mesmo intervalo de tempo
  const crew = points.length
    ? await rpc<{ crewId: string | null; tracks: CrewTrack[] }>('svc_crew_tracks', {
      p_user: activity.user_id,
      p_from_ms: points[0].t,
      p_to_ms: points[points.length - 1].t,
    })
    : null;

  for (let attempt = 1; ; attempt++) {
    const ctx = await rpc<FinishContext>('svc_finish_context', {
      p_user: activity.user_id,
      p_activity: activity.id,
      p_zone_ids: zoneIds,
      p_fog_cells: fogCells,
    });
    if (!ctx.profile) throw new HttpError(404, 'NOT_FOUND', 'Perfil não encontrado.');
    if (ctx.profile.status === 'inactive') throw new HttpError(403, 'ACCOUNT_INACTIVE', 'Conta inativa.');
    if (!ctx.profile.faction) {
      throw new HttpError(409, 'FACTION_REQUIRED', 'Escolha uma facção antes de finalizar a corrida.');
    }
    const now = Date.now();
    const official = computeOfficialResult({
      mode,
      activityId: activity.id,
      points,
      startedAt: Date.parse(activity.started_at),
      faction: ctx.profile.faction,
      trust: ctx.profile.trust,
      profileStatus: ctx.profile.status,
      suspendedUntil: ctx.profile.suspendedUntil,
      streakWeeks: ctx.profile.streakWeeks,
      recentPaces: ctx.recentPaces,
      zones: ctx.zones,
      earnedToday: ctx.earnedToday,
      revealedFog: ctx.revealedFog,
      ghostPace: activity.ghost_pace,
      mission: activity.mission,
      now,
      chests: ctx.chests ?? [],
      crewTracks: crew?.tracks ?? [],
    });
    const r = official.response;
    const payload = {
      mode,
      activityId: activity.id,
      userId: activity.user_id,
      faction: ctx.profile.faction,
      status: official.status,
      scored: official.scored,
      endedAt: opts.endedAt ?? (points.length ? points[points.length - 1].t : now),
      meters: r.meters,
      movingSeconds: r.movingSeconds,
      avgPace: r.avgPace,
      rpTotal: r.rpTotal,
      // engajamento v2 ligado: o XP vem do livro (svc_apply_v2); a v1 não credita, para não pagar em dobro
      xp: v2Xp(flags) ? 0 : r.xp,
      beatGhost: r.beatGhost,
      flags: r.flags,
      invalidSegments: r.invalidSegments,
      trustAfter: mode === 'finish' ? official.trustAfter : null,
      suspend: official.suspend,
      reviewReason: official.reviewReason,
      // território v2 (pintura): a v1 só cria as zonas novas, neutras; dono, placar e eventos vêm do applyPaint
      zones: v2Territory(flags)
        ? official.zones.filter((z) => z.expectedVersion === null).map((z) => ({
          ...z, influence: { striders: 0, coyotes: 0, owls: 0, volt: 0 }, owner: null, shield: 0, attacker: null, attackStartedAt: null,
        }))
        : official.zones,
      activityZones: official.activityZones,
      events: v2Territory(flags) ? [] : official.events,
      fogCells: official.fogCells,
      chests: official.chests,
      result: r,
      moderation: opts.moderation ?? null,
    };
    try {
      const res = await rpc<{ ok?: boolean; error?: string; result?: FinishResponse }>('svc_apply_activity_result', { p: payload });
      if (res?.error === 'ALREADY_FINISHED' && res.result) return await v2(res.result);
      if (res?.error === 'NOT_IN_REVIEW') throw new HttpError(409, 'NOT_IN_REVIEW', 'A corrida não está em revisão.');
      if (res?.error) throw new HttpError(409, res.error, 'Não foi possível gravar o resultado da corrida.');
      // o banco devolve o resultado com os nomes das zonas criadas agora (P-12); depois, os extras da v2
      return await v2(res?.result ?? r);
    } catch (e) {
      if (e instanceof DbError && e.message.startsWith('ZONE_CONFLICT') && attempt < MAX_ATTEMPTS) continue;
      if (e instanceof DbError && e.message.startsWith('ZONE_CONFLICT')) {
        throw new HttpError(503, 'BUSY', 'Muitas corridas nesta área agora. Tente finalizar de novo em instantes.');
      }
      throw e;
    }
  }
}
