/**
 * Registro de compartilhamento (E8, T7.2.5; contrato v2 da E9): `record_share(p_activity)` avança a
 * missão "compartilhar" (1 por dia, XP baixo e cosmético). Não bloqueia nada: se o servidor for o antigo
 * (`PGRST202`) ou a flag estiver desligada (`FEATURE_DISABLED`), devolve `{ recorded: false }` sem erro.
 */
import { parseCompleted, type StateMissionsCompleted } from './engagement-repo';
import { attempt, type Result } from './errors';
import { isFeedUnavailable } from './feed-repo';
import { requireSupabase } from './supabase';

export type ShareRecord = {
  /** O servidor registrou (falso quando o recurso não existe no servidor). */
  recorded: boolean;
  /** Missões concluídas agora por este compartilhamento. */
  completedMissions: number;
  /** C2: quais (para a telemetria `mission_complete`, como o ranking já fazia). Vazio no servidor antigo. */
  completed: StateMissionsCompleted['completed'];
};

export async function recordShare(activityId: string): Promise<Result<ShareRecord>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('record_share', { p_activity: activityId });
    if (error) throw error;
    const completed = (data as { completed?: unknown } | null)?.completed;
    return { recorded: true, completedMissions: Array.isArray(completed) ? completed.length : 0, completed: parseCompleted(data).completed };
  });
  if (!res.ok && isFeedUnavailable(res.error)) return { ok: true, data: { recorded: false, completedMissions: 0, completed: [] } };
  return res;
}
