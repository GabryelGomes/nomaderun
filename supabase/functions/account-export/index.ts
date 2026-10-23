// GET /account-export — exportação dos dados pessoais em JSON (RF-002, RNF-013 / LGPD).
// LGPD v2 (T7.2.2): svc_account_export_v2 inclui todas as tabelas novas com dado da pessoa (XP, missões, raid, liga,
// pintura, recordes, feed e aplausos). Servidor ainda sem a migration (PGRST202) → exportação v1, como antes.
import { corsHeaders, handler } from '../_shared/http.ts';
import { DbError, requireUser, rpc } from '../_shared/supabase.ts';

async function exportData(userId: string): Promise<Record<string, unknown>> {
  try {
    return await rpc<Record<string, unknown>>('svc_account_export_v2', { p_user: userId });
  } catch (e) {
    if (e instanceof DbError && (e.code === 'PGRST202' || e.status === 404)) {
      return await rpc<Record<string, unknown>>('svc_account_export', { p_user: userId });
    }
    throw e;
  }
}

Deno.serve(handler(['GET'], async (req) => {
  const user = await requireUser(req);
  const data = await exportData(user.id);
  return new Response(JSON.stringify({ email: user.email ?? null, ...data }, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="nomaderun-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}));
