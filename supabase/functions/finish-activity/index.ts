// POST /finish-activity — fecha a corrida e calcula o resultado oficial com o domain (RF-006, RF-008, RF-010,
// RN-001..004, RN-007..009). Chamar de novo devolve o mesmo resultado (idempotente).
// Gravação v2 (D-80, T7.2.1): depois da v1, sem mudá-la, os extras atrás das flags de game_config (`extras` opcional).
import { loadActivity, scoreAndApply } from '../_shared/finish.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { requireUser } from '../_shared/supabase.ts';
import { checkEndedAt, parseFinish } from '../_shared/validate.ts';
import { loadFlags, safeRunV2, withExtras } from '../_shared/v2-run.ts';

Deno.serve(handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const body = parseFinish(await readJson(req));
  const { activity, points, result } = await loadActivity(body.activityId);
  if (!activity) {
    if (body.lastSeq < 0) throw new HttpError(409, 'MISSING_POINTS', 'Nenhum ponto foi recebido para esta corrida.', { lastSeq: -1 });
    throw new HttpError(409, 'MISSING_POINTS', 'O servidor ainda não recebeu os pontos desta corrida. Reenvie a fila.', { lastSeq: -1 });
  }
  if (activity.user_id !== user.id) throw new HttpError(403, 'NOT_OWNER', 'Esta corrida pertence a outra conta.');
  if (activity.status !== 'recording') {
    // repetição: mesmo resultado; com a v2 ligada, os extras já gravados (ou a v2 que faltou, idempotente)
    if (result) {
      const extras = await safeRunV2({ activityId: activity.id, userId: activity.user_id, points, response: result, flags: await loadFlags() });
      return json(withExtras(result, extras));
    }
    throw new HttpError(409, 'ACTIVITY_CLOSED', 'Esta corrida já foi finalizada.');
  }
  if (activity.last_seq < body.lastSeq) {
    throw new HttpError(409, 'MISSING_POINTS', 'Faltam pontos desta corrida no servidor. Reenvie a fila.', { lastSeq: activity.last_seq });
  }
  // QA-09: endedAt entre o início da corrida e agora + 5 min
  const endedAt = checkEndedAt(body.endedAt, Date.parse(activity.started_at));
  return json(await scoreAndApply({ mode: 'finish', activity, points, endedAt }));
}));
