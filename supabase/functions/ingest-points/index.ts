// POST /ingest-points — lote de pontos assinado (RF-004, RF-005, RNF-006, RNF-009; D-03, D-04).
import { verifyBatchSignature } from '../_shared/hmac.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { requireUser, rpc } from '../_shared/supabase.ts';
import { parseIngestBody } from '../_shared/validate.ts';

const ERRORS: Record<string, [number, string]> = {
  NOT_OWNER: [403, 'Esta corrida pertence a outra conta.'],
  DEVICE_MISMATCH: [409, 'Esta corrida foi iniciada em outro aparelho.'],
  ACTIVITY_CLOSED: [409, 'Esta corrida já foi finalizada.'],
  OUT_OF_ORDER: [409, 'Lote fora de ordem: reenvie a partir do ponto seguinte ao último recebido.'],
  REPLAY_MISMATCH: [409, 'Reenvio com conteúdo diferente do lote já recebido.'],
  ACCOUNT_INACTIVE: [403, 'Conta inativa.'],
  TOO_MANY_OPEN_RUNS: [409, 'Há corridas demais em aberto. Finalize as corridas anteriores antes de começar outra.'],
  POINTS_LIMIT: [409, 'A corrida chegou ao limite de 14.400 pontos (4 horas). Finalize a corrida.'],
};

Deno.serve(handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const body = parseIngestBody(await readJson(req, 1024 * 1024));

  const secret = await rpc<string | null>('svc_device_secret', { p_user: user.id, p_device: body.deviceId });
  if (!secret) throw new HttpError(401, 'UNKNOWN_DEVICE', 'Aparelho não registrado nesta conta. Registre o aparelho de novo.');
  if (!(await verifyBatchSignature(secret, body, body.signature))) {
    throw new HttpError(401, 'INVALID_SIGNATURE', 'Assinatura do lote inválida.');
  }

  const res = await rpc<{ accepted?: number; duplicates?: number; lastSeq: number; error?: string }>('svc_ingest_points', {
    p: {
      userId: user.id,
      activityId: body.activityId,
      deviceId: body.deviceId,
      startedAt: body.startedAt,
      mission: body.mission,
      ghostPace: body.ghostPace,
      fromSeq: body.fromSeq,
      toSeq: body.toSeq,
      points: body.points,
    },
  });
  if (res.error) {
    const [status, message] = ERRORS[res.error] ?? [409, 'Lote recusado.'];
    throw new HttpError(status, res.error, message, res.lastSeq !== undefined ? { lastSeq: res.lastSeq } : undefined);
  }
  return json({ accepted: res.accepted, duplicates: res.duplicates, lastSeq: res.lastSeq }, 202);
}));
