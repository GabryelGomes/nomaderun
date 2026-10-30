// GET|POST /weekly-recap — resumo da semana da própria pessoa para o card "Minha semana" (T7.3.8, pedido da E8).
// Números da semana (segunda a domingo, Brasília), days[7] e até 3 rotas já cortadas pelo clipRouteForSharing do domain,
// com semente nova a cada chamada (_shared/recap.ts). Sem horário. Corpo: { weekStart?: 'AAAA-MM-DD' } (segunda-feira;
// ausente = semana atual) ou ?weekStart= no GET. Servidor sem a migration (PGRST202) → 404 NOT_AVAILABLE.
import { randomSeed } from '../_shared/feed.ts';
import { loadActivity } from '../_shared/finish.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { parseRecapInput, type RecapRoute, recapResponse, recapRoute, type SvcWeeklyRecap } from '../_shared/recap.ts';
import { DbError, requireUser, rpc, sqlErrorToHttp } from '../_shared/supabase.ts';

Deno.serve(handler(['GET', 'POST'], async (req) => {
  const user = await requireUser(req);
  const input = req.method === 'GET'
    ? parseRecapInput({ weekStart: new URL(req.url).searchParams.get('weekStart') })
    : parseRecapInput(await readJson(req, 1024));

  let svc: SvcWeeklyRecap;
  try {
    svc = await rpc<SvcWeeklyRecap>('svc_weekly_recap', { p_user: user.id, p_week_start: input.weekStart });
  } catch (e) {
    if (e instanceof DbError && (e.code === 'PGRST202' || e.status === 404)) {
      throw new HttpError(404, 'NOT_AVAILABLE', 'O resumo da semana ainda não está disponível neste servidor.');
    }
    if (e instanceof DbError && e.message.startsWith('ACCOUNT_INACTIVE')) sqlErrorToHttp(e, 401);
    sqlErrorToHttp(e, 400);
  }

  const routes: (RecapRoute | null)[] = [];
  for (const id of (svc.routeIds ?? []).slice(0, 3)) {
    const { activity, points } = await loadActivity(id);
    // defesa extra: só corrida da própria pessoa (o SQL já filtra por p_user)
    if (!activity || activity.user_id !== user.id) continue;
    routes.push(recapRoute(points, svc.privacyZones ?? [], randomSeed()));
  }
  return json(recapResponse(svc, routes));
}));
