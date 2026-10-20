// POST /register-device — registra a chave HMAC do aparelho (D-04). Idempotente por deviceId.
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { requireUser, rpc } from '../_shared/supabase.ts';
import { parseRegisterDevice } from '../_shared/validate.ts';

Deno.serve(handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const body = parseRegisterDevice(await readJson(req));
  const res = await rpc<{ deviceId?: string; error?: string }>('svc_register_device', {
    p_user: user.id,
    p_device: body.deviceId,
    p_secret_b64: body.secret,
    p_platform: body.platform,
    p_model: body.model,
  });
  if (res.error === 'DEVICE_TAKEN') {
    throw new HttpError(409, 'DEVICE_TAKEN', 'Este aparelho já está registrado em outra conta. Gere um novo deviceId.');
  }
  return json({ deviceId: res.deviceId });
}));
