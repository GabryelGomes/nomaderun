// POST /account-delete — exclui a conta e os dados pessoais (RF-002, RNF-013 / LGPD).
// Exige { "confirm": "EXCLUIR", "password": "<senha atual>" } e confere a senha no Auth antes de excluir (QA-06).
// Remove o usuário do Auth; perfil, corridas, pontos, contatos, notificações, neblina e aparelhos caem em
// cascata; a foto de perfil é apagada do Storage. A influência já somada nas zonas fica (dado agregado, sem ligação com a pessoa).
// v2 (T7.2.2): XP, missões, baús, raid, liga, pintura do dia (paint_marks), recordes, feed e aplausos também caem em
// cascata (o pgTAP 24 confere que toda FK para a pessoa é cascade ou set null). Os trechos pintados (zone_cells) não
// têm autor e ficam, como a influência. Onda 3 (T7.3.8): consentimento e eventos de telemetria também caem em cascata.
import { parseAccountDelete, verifyPassword } from '../_shared/account.ts';
import { handler, json, readJson } from '../_shared/http.ts';
import { anonKey, baseUrl, deleteAuthUser, deleteUserAvatars, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const { password } = parseAccountDelete(await readJson(req, 16 * 1024));
  await verifyPassword(user.email, password, { baseUrl: baseUrl(), apikey: anonKey() });
  await deleteUserAvatars(user.id);
  await deleteAuthUser(user.id);
  return json({ deleted: true });
}));
