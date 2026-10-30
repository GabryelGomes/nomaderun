/**
 * Registro de compartilhamento (E8, T7.2.5; contrato v2 da E9): `record_share(p_activity)` avança a
 * missão "compartilhar" (1 por dia, XP baixo e cosmético). Não bloqueia nada: se o servidor for o antigo
 * (`PGRST202`) ou a flag estiver desligada (`FEATURE_DISABLED`), devolve `{ recorded: false }` sem erro.
 */
import { attempt, type Result } from './errors';
import { isFeedUnavailable } from './feed-repo';
import { requireSupabase } from './supabase';

export type ShareRecord = {
  /** O servidor registrou (falso quando o recurso não existe no servidor). */
  recorded: boolean;
  /** Missões concluídas agora por este compartilhamento. */
  completedMissions: number;
};

export async function recordShare(activityId: string): Promise<Result<ShareRecord>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('record_share', { p_activity: activityId });
    if (error) throw error;
    const completed = (data as { completed?: unknown } | null)?.completed;
    return { recorded: true, completedMissions: Array.isArray(completed) ? completed.length : 0 };
  });
  if (!res.ok && isFeedUnavailable(res.error)) return { ok: true, data: { recorded: false, completedMissions: 0 } };
  return res;
}
