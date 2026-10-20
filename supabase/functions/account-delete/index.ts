// POST /account-delete — exclui a conta e os dados pessoais (RF-002, RNF-013 / LGPD). Exige { "confirm": "EXCLUIR" }.
// Remove o usuário do Auth; perfil, corridas, pontos, contatos, notificações, neblina e aparelhos caem em
// cascata; a foto de perfil é apagada do Storage. A influência já somada nas zonas fica (dado agregado, sem ligação com a pessoa).
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { deleteAuthUser, deleteUserAvatars, requireUser } from '../_shared/supabase.ts';
import { isObject } from '../_shared/validate.ts';

Deno.serve(handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  if (!isObject(body) || body.confirm !== 'EXCLUIR') {
    throw new HttpError(400, 'VALIDATION', 'Para excluir a conta, envie { "confirm": "EXCLUIR" }.');
  }
  await deleteUserAvatars(user.id);
  await deleteAuthUser(user.id);
  return json({ deleted: true });
}));
