/**
 * T7.3.8 — casos adversariais da v2 contra a stack local (PostgREST, Auth e Edge Functions), no padrão do
 * edge-security.ts. Cada verificação descreve o comportamento SEGURO. Os dados de apoio entram pelo service role;
 * os ataques saem com o JWT de contas comuns `sec2_*`. Liga as flags da v2 durante o teste e devolve como estavam.
 *
 * Uso (na raiz, máquina com Docker): `npm run db:start`, `npm run functions:serve` e
 * `bash supabase/tests/security/run-v2.sh`. A mesma lógica, sem HTTP, roda no banco local:
 * supabase/tests/database/28_v2_adversarial.test.sql.
 */
const API = Deno.env.get('API_URL') ?? 'http://127.0.0.1:54321';
const ANON = Deno.env.get('ANON_KEY')!;
const SERVICE = Deno.env.get('SERVICE_ROLE_KEY')!;
const FN = `${API}/functions/v1`;

let step = 0;
let failures = 0;
function check(cond: unknown, label: string, extra?: unknown) {
  step++;
  if (cond) console.log(`  ok ${step} - ${label}`);
  else {
    failures++;
    console.log(`  NÃO OK ${step} - ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : '');
  }
}

// deno-lint-ignore no-explicit-any
type Res = { status: number; data: any };
async function call(method: string, url: string, token: string | null, body?: unknown, apikey = ANON, extra: Record<string, string> = {}): Promise<Res> {
  const res = await fetch(url, {
    method,
    headers: { apikey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}
const rpcAs = (token: string | null, name: string, args: Record<string, unknown>) => call('POST', `${API}/rest/v1/rpc/${name}`, token, args);
const service = (method: string, path: string, body?: unknown) =>
  call(method, `${API}/rest/v1/${path}`, SERVICE, body, SERVICE, { Prefer: 'return=representation' });
const denied = (r: Res) => r.status >= 400 && (r.data?.code === '42501' || r.status === 401 || r.status === 403);
const errCode = (r: Res, code: string) => r.status >= 400 && String(r.data?.message ?? r.data?.error?.code ?? '').includes(code);

const rand = crypto.randomUUID().slice(0, 6);
const password = `Sec2-${rand}-Senha!`;
async function newUser(tag: string) {
  const email = `sec2_${tag}_${rand}@nomaderun.test`;
  const c = await call('POST', `${API}/auth/v1/admin/users`, SERVICE, {
    email, password, email_confirm: true,
    user_metadata: { username: `sec2_${tag}_${rand}`, birthdate: '1996-03-04', terms_accepted: true, privacy_accepted: true },
  }, SERVICE);
  const l = await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email, password });
  await rpcAs(l.data?.access_token, 'choose_faction', { p_faction: 'volt' });
  return { id: c.data?.id as string, token: l.data?.access_token as string };
}

console.log('NOMADE RUN — casos adversariais da v2 contra', API);
const flags = await service('GET', 'game_config?key=eq.features&select=value');
const before = flags.data?.[0]?.value ?? {};
await service('PATCH', 'game_config?key=eq.features', { value: { ...before, feed: true, missions: true, raid: true, telemetry: true } });

try {
  const A = await newUser('a');
  const B = await newUser('b');
  const crew = await service('POST', 'crews', { name: `Crew ${rand}`, tag: `S${rand.slice(0, 4).toUpperCase()}`, leader_id: A.id });
  const crewId = crew.data?.[0]?.id;
  await service('POST', 'crew_members', { crew_id: crewId, user_id: B.id });
  const ids = Array.from({ length: 201 }, () => [crypto.randomUUID(), crypto.randomUUID()]);
  const now = Date.now();
  await service('POST', 'activities', ids.map(([act]) => ({
    id: act, user_id: A.id, status: 'valid', scored: true, meters: 3000, moving_seconds: 1000,
    started_at: new Date(now - 3 * 3600e3).toISOString(), ended_at: new Date(now - 2 * 3600e3).toISOString(),
    finished_at: new Date(now - 2 * 3600e3).toISOString(),
  })));
  const today = (await rpcAs(A.token, 'server_info', {})).data?.brToday;
  await service('POST', 'feed_items', ids.map(([act, item]) => ({
    id: item, activity_id: act, user_id: A.id, crew_id: crewId, day: today, meters: 3000, moving_seconds: 1000,
  })));

  console.log('\n# Aplausos');
  check(errCode(await rpcAs(A.token, 'react_feed_item', { p_item: ids[0][1], p_reaction: 'bora' }), 'KUDOS_SELF'),
    'aplaudir a própria corrida: KUDOS_SELF');
  let accepted = 0;
  for (let i = 0; i < 200; i++) {
    if ((await rpcAs(B.token, 'react_feed_item', { p_item: ids[i][1], p_reaction: 'fogo' })).status === 200) accepted++;
  }
  check(accepted === 200, '200 aplausos no dia: aceitos', accepted);
  check(errCode(await rpcAs(B.token, 'react_feed_item', { p_item: ids[200][1], p_reaction: 'raio' }), 'KUDOS_LIMIT'),
    'o 201º aplauso: KUDOS_LIMIT');
  check(denied(await call('POST', `${API}/rest/v1/kudos`, B.token, { feed_item_id: ids[200][1], user_id: B.id, reaction: 'bora' })),
    'inserir em kudos direto: negado');

  console.log('\n# Leitura direta');
  check(denied(await call('GET', `${API}/rest/v1/feed_items?select=created_at`, B.token)), 'feed_items direto (com created_at): negado');
  for (const t of ['zone_cells', 'paint_marks', 'telemetry_events', 'telemetry_consent']) {
    check(denied(await call('GET', `${API}/rest/v1/${t}?select=*`, A.token)), `${t} direto (logado): negado`);
    check(denied(await call('GET', `${API}/rest/v1/${t}?select=*`, null)), `${t} direto (anon): negado`);
  }

  console.log('\n# Chefão');
  check(denied(await rpcAs(B.token, 'svc_raid_hit', { p_activity: ids[0][0], p_meters: 21000, p_damage: 9999 })),
    'svc_raid_hit com JWT de usuário: negado');
  check(denied(await call('POST', `${API}/rest/v1/raid_hits`, B.token, { user_id: B.id, damage: 9999 })), 'inserir em raid_hits: negado');
  check(denied(await call('PATCH', `${API}/rest/v1/raids?id=not.is.null`, B.token, { status: 'defeated' })), 'derrotar o chefão direto: negado');

  console.log('\n# Missões');
  const mission = crypto.randomUUID();
  await service('POST', 'user_missions', {
    id: mission, user_id: B.id, def_id: 'd-mover-15', kind: 'diaria', period_key: today, slot: 7, metric: 'moving_seconds',
    target: 900, xp: 20, title: 'Mova-se 15 min', available_from: new Date(now - 3600e3).toISOString(),
  });
  check(errCode(await rpcAs(B.token, 'claim_mission', { p_id: mission }), 'MISSION_NOT_COMPLETED'), 'resgatar sem concluir: recusado');
  check(denied(await call('PATCH', `${API}/rest/v1/user_missions?id=eq.${mission}`, B.token, { progress: 900, completed_at: new Date().toISOString() })),
    'concluir a missão direto: negado');
  const xpBefore = (await service('GET', `profiles?id=eq.${B.id}&select=xp`)).data?.[0]?.xp;
  await service('PATCH', `user_missions?id=eq.${mission}`, { progress: 900, completed_at: new Date().toISOString() });
  const c1 = await rpcAs(B.token, 'claim_mission', { p_id: mission });
  const c2 = await rpcAs(B.token, 'claim_mission', { p_id: mission });
  const xpAfter = (await service('GET', `profiles?id=eq.${B.id}&select=xp`)).data?.[0]?.xp;
  check(c1.status === 200 && c2.status === 200 && c2.data?.alreadyClaimed === true && xpAfter === xpBefore,
    'resgatar 2 vezes: resposta idempotente e nenhum XP pelo resgate', { c1: c1.data, c2: c2.data, xpBefore, xpAfter });
  check(errCode(await rpcAs(A.token, 'claim_mission', { p_id: mission }), 'NOT_FOUND'), 'resgatar a missão de outra pessoa: NOT_FOUND');

  console.log('\n# Telemetria');
  check(errCode(await rpcAs(A.token, 'track_events', { p_events: [{ event: 'app_open' }] }), 'TELEMETRY_CONSENT'),
    'enviar telemetria sem consentimento: TELEMETRY_CONSENT');
  check(denied(await call('POST', `${API}/rest/v1/telemetry_events`, A.token, { user_id: A.id, event: 'app_open', day: today })),
    'inserir telemetria direto: negado');
  await rpcAs(A.token, 'set_telemetry_consent', { p_opt_in: true });
  check(errCode(await rpcAs(A.token, 'track_events', { p_events: [{ event: 'run_finish', props: { source: '-16.68,-49.25' } }] }), 'VALIDATION'),
    'coordenada escondida em props: VALIDATION');
  check((await rpcAs(A.token, 'track_events', { p_events: [{ event: 'app_open' }] })).data?.accepted === 1, 'com consentimento: aceito');
  check((await rpcAs(A.token, 'set_telemetry_consent', { p_opt_in: false })).data?.deletedEvents === 1, 'retirar o consentimento apaga os eventos');

  console.log('\n# weekly-recap');
  check((await call('POST', `${FN}/weekly-recap`, null, {})).status === 401, 'sem login: 401');
  check((await call('POST', `${FN}/weekly-recap`, A.token, { weekStart: '2026-02-31' })).status === 400, 'data inválida: 400');
  check((await call('POST', `${FN}/weekly-recap`, A.token, { userId: B.id })).status === 400, 'campo desconhecido (outra pessoa): 400');
  const recap = await call('POST', `${FN}/weekly-recap`, B.token, {});
  check(recap.status === 200 && recap.data?.runs === 0 && Array.isArray(recap.data?.days) && recap.data.days.length === 7,
    'B vê só a própria semana (as 201 corridas são de A)', recap.data);
  check(!/routeIds|privacyZones|radiusM|T\d\d:/.test(JSON.stringify(recap.data)), 'resposta sem ids, zonas de privacidade ou horário');
} finally {
  await service('PATCH', 'game_config?key=eq.features', { value: before });
}

console.log(`\n${step - failures}/${step} ok`);
if (failures > 0) Deno.exit(1);
