// POST /moderate-activity — aprovar/rejeitar corrida em revisão (RF-018). Só moderator/admin.
import { loadActivity, scoreAndApply } from '../_shared/finish.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { requireUser, rpc, select } from '../_shared/supabase.ts';
import { parseModerate } from '../_shared/validate.ts';

Deno.serve(handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const [me] = await select<{ role: string; status: string }>('profiles', `select=role,status&id=eq.${user.id}`);
  if (!me || !['moderator', 'admin'].includes(me.role) || me.status !== 'active') {
    throw new HttpError(403, 'FORBIDDEN', 'Apenas moderadores podem decidir sobre corridas.');
  }
  const body = parseModerate(await readJson(req));
  const { activity, points } = await loadActivity(body.activityId);
  if (!activity) throw new HttpError(404, 'NOT_FOUND', 'Corrida não encontrada.');
  if (activity.user_id === user.id) throw new HttpError(403, 'FORBIDDEN', 'Você não pode moderar a própria corrida.');
  if (activity.status !== 'review') throw new HttpError(409, 'NOT_IN_REVIEW', 'A corrida não está em revisão.');

  if (body.decision === 'reject') {
    const res = await rpc<{ ok?: boolean; error?: string }>('svc_moderate_reject', {
      p_activity: activity.id,
      p_moderator: user.id,
      p_justification: body.justification,
    });
    if (res.error === 'NOT_IN_REVIEW') throw new HttpError(409, 'NOT_IN_REVIEW', 'A corrida não está em revisão.');
    return json({ activityId: activity.id, decision: 'reject', status: 'rejected' });
  }

  const result = await scoreAndApply({
    mode: 'approve',
    activity,
    points,
    endedAt: null,
    moderation: { moderatorId: user.id, justification: body.justification },
  });
  return json({ activityId: activity.id, decision: 'approve', status: result.status, result });
}));
