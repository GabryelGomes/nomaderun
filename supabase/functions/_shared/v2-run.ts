/**
 * Gravação v2 com I/O (T7.2.1): flags → contexto → plano (v2.ts, puro) → svc_apply_v2 → bloco `extras`.
 * Roda DEPOIS da gravação v1 já confirmada. Nunca derruba o finish: se a v2 falhar, a resposta sai sem `extras`
 * (como hoje) e a próxima chamada do finish para a mesma corrida tenta de novo (tudo é idempotente).
 */
import { type PaintMilestones, validateActivity } from './domain.ts';
import { randomSeed } from './feed.ts';
import { type FinishResponse, type StoredPoint, toGeoPoints } from './scoring.ts';
import { DbError, rpc } from './supabase.ts';
import {
  buildExtras,
  paintCellsOf,
  planV2,
  unscoredExtras,
  type V2Context,
  type V2Extras,
  type V2Flags,
  v2On,
  type V2Raw,
  v2Territory,
} from './v2.ts';

export const V2_MAX_ATTEMPTS = 3;

/** Flags do servidor (server_info). Servidor sem a RPC ou erro → null (= tudo desligado, comportamento v1). */
export async function loadFlags(): Promise<V2Flags | null> {
  try {
    const info = await rpc<{ territoryRule?: string; features?: Record<string, boolean> } | null>('server_info', {});
    if (!info) return null;
    return { territoryRule: info.territoryRule === 'v2' ? 'v2' : 'v1', features: info.features ?? {} };
  } catch {
    return null;
  }
}

type Deps = { rpc: typeof rpc; now: () => number; seed: () => number };
const defaultDeps: Deps = { rpc, now: () => Date.now(), seed: randomSeed };

export async function runV2(
  opts: { activityId: string; userId: string; points: StoredPoint[]; response: FinishResponse; flags: V2Flags | null },
  deps: Deps = defaultDeps,
): Promise<V2Extras | null> {
  if (!v2On(opts.flags)) return null;
  const geo = toGeoPoints(opts.points);
  const validation = validateActivity(geo);
  const scored = opts.response.status === 'valid' || opts.response.status === 'partial';
  let paintReady = scored && v2Territory(opts.flags);
  let paint = paintReady ? paintCellsOf(geo, validation) : { cells: [] as string[], zoneIds: [] as string[] };

  for (let attempt = 1; ; attempt++) {
    const ctx = await deps.rpc<V2Context | null>('svc_v2_context', {
      p_user: opts.userId,
      p_activity: opts.activityId,
      p_zone_ids: paint.zoneIds,
    });
    if (!ctx) return null;
    if (ctx.done) return buildExtras(await withMilestones(ctx.done, opts, deps), deps.now());
    if (!v2On(ctx.flags)) return null;
    if (!scored || !ctx.activity.scored || !ctx.profile?.faction) return unscoredExtras(ctx, opts.response);
    // a regra virou para a v2 entre a leitura das flags e o contexto: recarrega com as zonas que a pintura toca
    if (ctx.flags.territoryRule === 'v2' && !paintReady) {
      paintReady = true;
      paint = paintCellsOf(geo, validation);
      if (attempt <= V2_MAX_ATTEMPTS) continue;
    }
    const plan = planV2({
      activityId: opts.activityId,
      userId: opts.userId,
      faction: ctx.profile.faction,
      now: deps.now(),
      geo,
      validation,
      paintCells: paint.cells,
      v1: opts.response,
      ctx,
      seed: deps.seed(),
    });
    try {
      const raw = await deps.rpc<V2Raw>('svc_apply_v2', { p: plan });
      return buildExtras(await withMilestones(raw, opts, deps), deps.now());
    } catch (e) {
      if (e instanceof DbError && e.message.startsWith('ZONE_CONFLICT') && attempt < V2_MAX_ATTEMPTS) continue;
      throw e;
    }
  }
}

/**
 * F8 A2: marcos da pintura ("primeiro trecho" e "recorde de trechos"), decididos e gravados pelo banco
 * (`svc_paint_milestones`, idempotente, em `activities.v2_extras.milestones`). Só quando a corrida pintou pela regra v2
 * e o marco ainda não está na gravação. Banco antigo (sem a RPC) ou erro: segue sem o marco — nunca derruba o finish.
 */
export async function withMilestones(
  raw: V2Raw,
  opts: { activityId: string; userId: string },
  deps: Pick<Deps, 'rpc'>,
): Promise<V2Raw> {
  if (raw.milestones !== undefined || !raw.paint || typeof raw.paint !== 'object' || raw.scored === false) return raw;
  try {
    const m = await deps.rpc<PaintMilestones | null>('svc_paint_milestones', { p_user: opts.userId, p_activity: opts.activityId });
    return m ? { ...raw, milestones: m } : raw;
  } catch (e) {
    console.error('marcos da pintura indisponíveis', opts.activityId, e instanceof Error ? e.message : e);
    return raw;
  }
}

/** Mesma coisa, sem nunca lançar: erro vira log e a resposta segue sem `extras`. */
export async function safeRunV2(
  opts: Parameters<typeof runV2>[0],
  deps?: Deps,
): Promise<V2Extras | null> {
  try {
    return await runV2(opts, deps);
  } catch (e) {
    console.error('gravação v2 falhou; resposta sem extras', opts.activityId, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Resposta do finish: o resultado v1 de sempre + `extras` só quando a v2 rodou. */
export const withExtras = (result: FinishResponse, extras: V2Extras | null): FinishResponse & { extras?: V2Extras } =>
  extras ? { ...result, extras } : result;
