// GET /zone?id=<h3> — detalhe da zona para a folha (RF-007): zona + 3 maiores corredores + 10 últimos eventos.
import { handler, HttpError, json } from '../_shared/http.ts';
import { zoneLabel } from '../_shared/scoring.ts';
import { requireUser, rpc } from '../_shared/supabase.ts';
import { isH3 } from '../_shared/validate.ts';

type Detail = {
  zone: { id: string; name: string | null } & Record<string, unknown>;
  topRunners: { username: string; faction: string; rp: number }[];
  events: { type: string; faction: string | null; from: string | null; at: number }[];
};

Deno.serve(handler(['GET'], async (req) => {
  await requireUser(req);
  const id = new URL(req.url).searchParams.get('id');
  if (!isH3(id)) throw new HttpError(400, 'VALIDATION', 'Parâmetro id deve ser o índice H3 da zona (15 caracteres hexadecimais).');
  const detail = await rpc<Detail | null>('svc_zone_detail', { p_zone: id });
  if (!detail) throw new HttpError(404, 'NOT_FOUND', 'Zona ainda não existe: ninguém correu aqui.');
  return json({ ...detail.zone, name: zoneLabel(detail.zone.id, detail.zone.name), topRunners: detail.topRunners, events: detail.events });
}));
