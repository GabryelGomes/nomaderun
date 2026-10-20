// GET /account-export — exportação dos dados pessoais em JSON (RF-002, RNF-013 / LGPD).
import { corsHeaders, handler } from '../_shared/http.ts';
import { requireUser, rpc } from '../_shared/supabase.ts';

Deno.serve(handler(['GET'], async (req) => {
  const user = await requireUser(req);
  const data = await rpc<Record<string, unknown>>('svc_account_export', { p_user: user.id });
  return new Response(JSON.stringify({ email: user.email ?? null, ...data }, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="nomaderun-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}));
