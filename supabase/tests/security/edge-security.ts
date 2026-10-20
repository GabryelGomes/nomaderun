/**
 * T4.2 (A5) — teste adversarial contra a stack local (Edge Functions, PostgREST, Auth, Storage).
 * Cada verificação descreve o comportamento SEGURO esperado. Os achados conhecidos (docs/QA.md) aparecem como
 * "ACHADO QA-xx" e não derrubam a execução, a menos que STRICT=1 (útil para conferir a correção).
 *
 * Uso (na raiz): `bash supabase/tests/security/run.sh` — precisa de `npm run db:start`, `npm run functions:serve`
 * e do seed (contas de demonstração). Cria contas `sec_*` e corridas em Brasília (longe do seed de Goiânia).
 */
import { canonicalBatch, hmacSha256Hex, type SignedPoint } from '../../functions/_shared/hmac.ts';
import { cellBoundary, cellsAround, offset, zoneOf } from '../../functions/_shared/domain.ts';

const API = Deno.env.get('API_URL') ?? 'http://127.0.0.1:54321';
const ANON = Deno.env.get('ANON_KEY')!;
const SERVICE = Deno.env.get('SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? 'super-secret-jwt-token-with-at-least-32-characters-long';
const STRICT = Deno.env.get('STRICT') === '1';
const FN = `${API}/functions/v1`;
const FUNCTIONS = [
  ['POST', 'register-device'], ['POST', 'ingest-points'], ['POST', 'finish-activity'], ['GET', 'zones?bbox=-47.9,-15.8,-47.8,-15.7'],
  ['GET', 'zone?id=8981a4c8a4bffff'], ['POST', 'moderate-activity'], ['GET', 'account-export'], ['POST', 'account-delete'],
] as const;

let step = 0;
let failures = 0;
const findings: string[] = [];
const bodies: { label: string; text: string }[] = [];

function check(cond: unknown, label: string, extra?: unknown) {
  step++;
  if (cond) console.log(`  ok ${step} - ${label}`);
  else {
    failures++;
    console.log(`  NÃO OK ${step} - ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : '');
  }
}
/** Comportamento seguro esperado que hoje falha por um achado registrado em docs/QA.md. */
function known(id: string, secure: unknown, label: string, extra?: unknown) {
  step++;
  if (secure) console.log(`  ok ${step} - ${label} (${id} corrigido?)`);
  else {
    findings.push(`${id}: ${label}`);
    if (STRICT) failures++;
    console.log(`  ACHADO ${id} ${step} - ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 200) : '');
  }
}

async function call(method: string, url: string, token: string | null, body?: unknown, apikey = ANON, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(url, {
    method,
    headers: { apikey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  bodies.push({ label: `${method} ${url.replace(API, '')}`, text });
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

const b64url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function forgeJwt(payload: Record<string, unknown>, secret = JWT_SECRET) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

const rand = crypto.randomUUID().slice(0, 6);
const password = `Sec-${rand}-Senha!`;
async function newUser(tag: string, faction: string) {
  const email = `sec_${tag}_${rand}@nomaderun.test`;
  const c = await call('POST', `${API}/auth/v1/admin/users`, SERVICE, {
    email, password, email_confirm: true,
    user_metadata: { username: `sec_${tag}_${rand}`, birthdate: '1996-03-04', terms_accepted: true, privacy_accepted: true },
  }, SERVICE);
  const l = await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email, password });
  await call('POST', `${API}/rest/v1/rpc/choose_faction`, l.data?.access_token, { p_faction: faction });
  return { id: c.data?.id as string, token: l.data?.access_token as string, email };
}
async function login(email: string, pass: string) {
  const l = await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email, password: pass });
  return { id: l.data?.user?.id as string, token: l.data?.access_token as string };
}
async function asService(method: string, path: string, body?: unknown) {
  return call(method, `${API}/rest/v1/${path}`, SERVICE, body, SERVICE, { Prefer: 'return=representation' });
}

/** Aparelho + corrida curta válida (400 m a 10 km/h com passos) em Brasília. */
async function newDevice(token: string) {
  const deviceId = crypto.randomUUID();
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const r = await call('POST', `${FN}/register-device`, token, { deviceId, secret: btoa(String.fromCharCode(...secret)), platform: 'android' });
  return { deviceId, secret, status: r.status };
}
function track(n = 150) {
  const start = offset({ lat: -15.79, lng: -47.88 }, Math.random() * 20_000, Math.random() * 360);
  const t0 = Date.now() - (n + 60) * 1000;
  const pts: SignedPoint[] = [];
  let pos = start;
  for (let i = 0; i < n; i++) {
    pts.push({ seq: i, lat: pos.lat, lng: pos.lng, t: t0 + i * 1000, accuracy: 5, speed: 2.8, altitude: 1100, mocked: false, steps: i ? 3 : 0 });
    pos = offset(pos, 2.78, 90);
  }
  return pts;
}
async function send(token: string, dev: { deviceId: string; secret: Uint8Array }, activityId: string, pts: SignedPoint[], extra: Record<string, unknown> = {}) {
  const body: any = { activityId, deviceId: dev.deviceId, fromSeq: pts[0].seq, toSeq: pts[pts.length - 1].seq, points: pts, startedAt: pts[0].t, mission: 'livre', ...extra };
  body.signature = await hmacSha256Hex(dev.secret, canonicalBatch(body));
  return call('POST', `${FN}/ingest-points`, token, body);
}

console.log('NOMADE RUN — teste adversarial de segurança contra', API);
const A = await newUser('a', 'striders');
const B = await newUser('b', 'coyotes');
check(A.token && B.token, 'duas contas de teste (facções diferentes)');

// ---------- 1. Autenticação em todas as functions (gateway com verify_jwt = false) ----------
const wrongSecret = await forgeJwt({ sub: A.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, 'outro-segredo-qualquer-com-mais-de-32-chars');
const ghost = await forgeJwt({ sub: crypto.randomUUID(), role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 });
const expired = await forgeJwt({ sub: A.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) - 60, session_id: crypto.randomUUID() });
const noneAlg = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({ sub: A.id, role: 'authenticated' }))}.`;
for (const [method, path] of FUNCTIONS) {
  const name = path.split('?')[0];
  const results = await Promise.all([null, 'lixo', ANON, SERVICE, wrongSecret, ghost, expired, noneAlg].map((t) => call(method, `${FN}/${path}`, t, method === 'POST' ? {} : undefined)));
  check(results.every((r) => r.status === 401), `${name}: sem token, token inválido, chave anon/service como token, JWT forjado, de usuário inexistente, expirado ou alg=none → 401`, results.map((r) => r.status));
}
for (const name of ['register-device', 'zones', 'account-delete']) {
  const r = await call('PUT', `${FN}/${name}`, A.token, {});
  check(r.status === 405, `${name}: método não permitido → 405`, r.status);
}
const pre = await fetch(`${FN}/ingest-points`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
await pre.body?.cancel();
check(pre.headers.get('access-control-allow-origin') === '*' && !pre.headers.get('access-control-allow-credentials'),
  'CORS: origem * sem credenciais (autenticação por header Bearer, não por cookie)', Object.fromEntries(pre.headers));

// ---------- 2. Aparelhos e HMAC ----------
const devA = await newDevice(A.token);
const devB = await newDevice(B.token);
check(devA.status === 200 && devB.status === 200, 'cada conta registra o próprio aparelho');
const steal = await call('POST', `${FN}/register-device`, A.token, { deviceId: devB.deviceId, secret: btoa(String.fromCharCode(...new Uint8Array(32).fill(1))), platform: 'ios' });
check(steal.status === 409 && steal.data?.error?.code === 'DEVICE_TAKEN', 'A não sequestra o deviceId de B (DEVICE_TAKEN, chave de B intacta)', steal);
const ptsB = track();
const actB = crypto.randomUUID();
const okB = await send(B.token, devB, actB, ptsB);
check(okB.status === 202, 'B envia a própria corrida', okB);
const useB = await send(A.token, devB, crypto.randomUUID(), track(5));
check(useB.status === 401 && useB.data?.error?.code === 'UNKNOWN_DEVICE', 'A assinando com o deviceId de B → UNKNOWN_DEVICE', useB);
const intoB = await send(A.token, devA, actB, ptsB.slice(0, 5));
check(intoB.status === 403 && intoB.data?.error?.code === 'NOT_OWNER', 'A não injeta pontos na corrida de B (NOT_OWNER)', intoB);
const sigOther = { activityId: crypto.randomUUID(), deviceId: devA.deviceId, fromSeq: 0, toSeq: 0, points: track(1) } as any;
sigOther.signature = await hmacSha256Hex(devB.secret, canonicalBatch(sigOther));
const badSig = await call('POST', `${FN}/ingest-points`, A.token, sigOther);
check(badSig.status === 401 && badSig.data?.error?.code === 'INVALID_SIGNATURE', 'lote do aparelho A assinado com a chave de B → INVALID_SIGNATURE', badSig);
const replay = await send(B.token, devB, actB, ptsB);
check(replay.status === 202 && replay.data?.accepted === 0 && replay.data?.duplicates === ptsB.length, 'replay idêntico não grava nada (duplicado)', replay);

// ---------- 3. Validação de entrada nas functions ----------
const v = async (label: string, body: unknown, expect = 400) => {
  const r = await call('POST', `${FN}/ingest-points`, A.token, body);
  check(r.status === expect && r.data?.error?.code === 'VALIDATION', `ingest-points recusa ${label} (${expect})`, r);
};
const baseBody = { activityId: crypto.randomUUID(), deviceId: devA.deviceId, fromSeq: 0, toSeq: 0, points: track(1), signature: 'ab'.repeat(32) };
await v('lote com 501 pontos', { ...baseBody, toSeq: 500, points: Array.from({ length: 501 }, (_, i) => ({ ...track(1)[0], seq: i, t: Date.now() - 600_000 + i * 1000 })) });
await v('latitude como texto', { ...baseBody, points: [{ ...baseBody.points[0], lat: '-15.7' }] });
await v('latitude 1e400 (Infinity)', JSON.stringify(baseBody).replace(/"lat":-?[0-9.]+/, '"lat":1e400'));
await v('NaN literal (JSON inválido)', JSON.stringify(baseBody).replace(/"lat":-?[0-9.]+/, '"lat":NaN'));
await v('longitude 200', { ...baseBody, points: [{ ...baseBody.points[0], lng: 200 }] });
await v('seq negativo', { ...baseBody, fromSeq: -1, toSeq: -1, points: [{ ...baseBody.points[0], seq: -1 }] });
await v('horário 3 dias no futuro', { ...baseBody, points: [{ ...baseBody.points[0], t: Date.now() + 3 * 86_400_000 }] });
await v('corpo que não é objeto', [1, 2, 3]);
await v('corpo acima de 1 MB', JSON.stringify({ ...baseBody, pad: 'x'.repeat(1_100_000) }), 413);
const fin400 = await call('POST', `${FN}/finish-activity`, A.token, { activityId: 'não-é-uuid', lastSeq: 'x' });
check(fin400.status === 400, 'finish-activity recusa activityId/lastSeq inválidos', fin400);
const zone400 = await call('GET', `${FN}/zone?id=${encodeURIComponent("'; drop table zones;--")}`, A.token);
check(zone400.status === 400, '/zone recusa id que não é H3 (sem injeção)', zone400);
const bbox400 = await call('GET', `${FN}/zones?bbox=-180,-90,180,90`, A.token);
check(bbox400.status === 400, '/zones recusa bbox gigante (protege o banco)', bbox400);

// ---------- 4. Autorização: corrida alheia, moderação, conta ----------
const finB = await call('POST', `${FN}/finish-activity`, A.token, { activityId: actB, lastSeq: ptsB.length - 1 });
check(finB.status === 403 && finB.data?.error?.code === 'NOT_OWNER', 'A não finaliza a corrida de B (NOT_OWNER)', finB);
const modRunner = await call('POST', `${FN}/moderate-activity`, A.token, { activityId: actB, decision: 'approve', justification: 'aprovando sem ser moderador' });
check(modRunner.status === 403 && modRunner.data?.error?.code === 'FORBIDDEN', 'corredor comum não modera (FORBIDDEN)', modRunner);

// moderador de teste com trust < 40: a própria corrida cai em revisão; ele não pode aprová-la, outro moderador pode
const M = await newUser('m', 'owls');
await asService('PATCH', `profiles?id=eq.${M.id}`, { role: 'moderator', trust: 30 });
const devM = await newDevice(M.token);
const ptsM = track();
const actM = crypto.randomUUID();
await send(M.token, devM, actM, ptsM);
const finM = await call('POST', `${FN}/finish-activity`, M.token, { activityId: actM, lastSeq: ptsM.length - 1 });
check(finM.status === 200 && finM.data?.status === 'review', 'corrida de quem tem trust < 40 fica em revisão (RN-009)', finM.data?.status);
const selfMod = await call('POST', `${FN}/moderate-activity`, M.token, { activityId: actM, decision: 'approve', justification: 'aprovando a minha própria corrida' });
check(selfMod.status === 403 && selfMod.data?.error?.code === 'FORBIDDEN', 'moderador não aprova a própria corrida', selfMod);
const MOD = await login('moderador.demo@nomaderun.app', 'Moderacao@2026');
const modOk = await call('POST', `${FN}/moderate-activity`, MOD.token, { activityId: actM, decision: 'approve', justification: 'Percurso coerente, aprovado pelo teste de segurança.' });
check(modOk.status === 200 && ['valid', 'partial'].includes(modOk.data?.status), 'outro moderador aprova a corrida em revisão', modOk.data);
const modTwice = await call('POST', `${FN}/moderate-activity`, MOD.token, { activityId: actM, decision: 'reject', justification: 'segunda decisão não pode valer' });
check(modTwice.status === 409 && modTwice.data?.error?.code === 'NOT_IN_REVIEW', 'segunda decisão sobre a mesma corrida → NOT_IN_REVIEW', modTwice);

const exportA = await call('GET', `${FN}/account-export`, A.token);
const exportText = JSON.stringify(exportA.data);
check(exportA.status === 200 && exportText.includes(A.email) && !exportText.includes(B.email) && !exportText.includes(B.id) && !/secret/i.test(exportText),
  'exportação traz só os dados de A (sem e-mail/ID de B e sem a chave do aparelho)');
const delNoConfirm = await call('POST', `${FN}/account-delete`, A.token, { confirm: 'sim' });
check(delNoConfirm.status === 400, 'exclusão sem { confirm: "EXCLUIR" } é recusada', delNoConfirm);

// ---------- 5. Regras de jogo manipuláveis pelo cliente ----------
const ptsG = track();
const actG = crypto.randomUUID();
await send(A.token, devA, actG, ptsG, { mission: 'livre', ghostPace: 3600 });
const finG = await call('POST', `${FN}/finish-activity`, A.token, { activityId: actG, lastSeq: ptsG.length - 1 });
check(finG.status === 200 && finG.data?.status === 'valid', 'corrida curta válida de A', finG.data?.status);
known('QA-02', finG.data?.beatGhost !== true, 'missão "livre" com ghostPace 3600 s/km não deveria ganhar M_fantasma 1,5 e +50 XP', { beatGhost: finG.data?.beatGhost, rp: finG.data?.rpTotal });

// ---------- 6. PostgREST com o token do usuário (RLS / grants) ----------
const rest = (method: string, path: string, body?: unknown, token = A.token) => call(method, `${API}/rest/v1/${path}`, token, body, ANON, { Prefer: 'return=representation' });
const crewB = await rest('POST', 'crews', { name: 'Coiotes Sec', tag: `S${rand.replace(/[^a-z]/gi, '').toUpperCase().padEnd(3, 'X').slice(0, 3)}` }, B.token);
check(crewB.status === 201, 'B cria uma crew', crewB);
const leak = await rest('GET', `crews?select=name,invite_code&id=eq.${crewB.data?.[0]?.id}`);
known('QA-01', !(leak.status === 200 && leak.data?.[0]?.invite_code), 'código de convite de crew alheia não deveria ser legível por qualquer usuário', leak.data);
const otherFaction = await rest('POST', 'rpc/join_crew', { p_code: crewB.data?.[0]?.invite_code ?? 'X' });
check(otherFaction.status >= 400 && /CREW_FACTION_MISMATCH/.test(JSON.stringify(otherFaction.data)), 'A (outra facção) não entra na crew de B mesmo com o código (RN-011)', otherFaction.data);
const avatar = await rest('PATCH', `profiles?id=eq.${A.id}`, { avatar_url: 'javascript:alert(document.cookie)' });
known('QA-05', !(avatar.status === 200 && avatar.data?.[0]?.avatar_url?.startsWith('javascript:')), 'avatar_url aceita qualquer esquema (deveria aceitar só a URL pública do bucket avatars)', avatar.data);
for (const [col, val] of [['role', 'admin'], ['trust', 100], ['xp', 999999], ['status', 'active'], ['is_demo', true], ['birthdate', '2015-01-01']] as const) {
  const r = await rest('PATCH', `profiles?id=eq.${A.id}`, { [col]: val });
  check(r.status === 401 || r.status === 403, `A não altera profiles.${col}`, r.status);
}
const otherProfile = await rest('PATCH', `profiles?id=eq.${B.id}`, { city: 'Hackerlândia' });
check(otherProfile.status === 200 && Array.isArray(otherProfile.data) && otherProfile.data.length === 0, 'A não altera o perfil de B (0 linhas)', otherProfile);
const priv = await rest('GET', `profiles?select=id,birthdate,role,trust&id=eq.${B.id}`);
check(priv.status === 200 && priv.data.length === 0, 'A não lê birthdate/role/trust de B', priv.data);
const pubCols = await rest('GET', `public_profiles?select=birthdate&limit=1`);
check(pubCols.status === 400, 'perfil público não tem birthdate', pubCols.status);
const secretCol = await rest('GET', 'devices?select=secret');
check(secretCol.status === 401 || secretCol.status === 403, 'devices.secret não é legível nem pelo dono', secretCol.status);
const svc = await rest('POST', 'rpc/svc_ingest_points', { p: {} });
check(svc.status === 401 || svc.status === 403 || svc.status === 404, 'funções svc_* não são executáveis pelo cliente', svc.status);
const job = await rest('POST', 'rpc/job_decay_zones', {});
check(job.status === 401 || job.status === 403 || job.status === 404, 'jobs não são executáveis pelo cliente', job.status);
const notif = await rest('POST', 'notifications', { user_id: B.id, type: 'system', title: 'phishing', body: 'x' });
check(notif.status === 401 || notif.status === 403, 'A não cria notificação para B', notif.status);
const actIns = await rest('POST', 'activities', { id: crypto.randomUUID(), user_id: A.id, started_at: new Date().toISOString(), status: 'valid' });
check(actIns.status === 401 || actIns.status === 403, 'cliente não cria corrida direto (nem se aprova)', actIns.status);
const actUpd = await rest('PATCH', `activities?id=eq.${actM}`, { status: 'valid' }, M.token);
check(actUpd.status === 401 || actUpd.status === 403, 'dono não muda o status da própria corrida', actUpd.status);
const zoneUpd = await rest('PATCH', 'zones?id=neq.x', { owner: 'striders' });
check(zoneUpd.status === 401 || zoneUpd.status === 403, 'cliente não altera zonas', zoneUpd.status);
const contactB = await rest('POST', 'safety_contacts', { user_id: B.id, name: 'Intruso', phone: '+55 61 90000-0000' });
check(contactB.status === 403 || contactB.status === 401, 'A não grava contato de segurança na conta de B', contactB.status);
const privB = await rest('POST', 'privacy_zones', { user_id: B.id, lat: 0, lng: 0 });
check(privB.status === 401 || privB.status === 403, 'A não grava zona de privacidade na conta de B', privB.status);
const adminRpc = await rest('POST', 'rpc/admin_set_user_status', { p_user_id: B.id, p_status: 'inactive' });
check(adminRpc.status >= 400 && /FORBIDDEN/.test(JSON.stringify(adminRpc.data)), 'corredor não inativa outra conta', adminRpc.data);

// ---------- 7. Anônimo (só a chave publicável) ----------
const anonZones = await call('GET', `${API}/rest/v1/zones?select=id&limit=1`, null);
check(anonZones.status === 401 || (Array.isArray(anonZones.data) && anonZones.data.length === 0), 'anon não lê zonas', anonZones);
const anonProfiles = await call('GET', `${API}/rest/v1/public_profiles?select=username&limit=1`, null);
check(anonProfiles.status === 401 || (Array.isArray(anonProfiles.data) && anonProfiles.data.length === 0), 'anon não lê perfis públicos', anonProfiles);
const anonGql = await call('POST', `${API}/graphql/v1`, null, { query: '{ __schema { queryType { fields { name } } } }' });
const gqlFields = (anonGql.data?.data?.__schema?.queryType?.fields ?? []).map((f: any) => f.name);
check(!gqlFields.some((f: string) => /profiles|activities|devices|safety/i.test(f)), 'GraphQL anônimo não expõe tabelas', gqlFields);
const anonUser = await call('POST', `${API}/rest/v1/rpc/username_available`, null, { p_username: 'corredor_demo' });
check(anonUser.status === 200, 'username_available é público (usado no cadastro; enumeração de nomes aceita, ver QA.md)', anonUser.status);

// ---------- 8. Storage (avatares) ----------
const upload = async (path: string, type: string, body: string) => {
  const res = await fetch(`${API}/storage/v1/object/avatars/${path}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${A.token}`, 'Content-Type': type, 'x-upsert': 'true' }, body });
  await res.body?.cancel();
  return res.status;
};
check((await upload(`${A.id}/x.html`, 'text/html', '<script>alert(1)</script>')) >= 400, 'avatars recusa HTML (só jpeg/png/webp)');
check((await upload(`${A.id}/x.svg`, 'image/svg+xml', '<svg onload="alert(1)"/>')) >= 400, 'avatars recusa SVG');
check((await upload(`${B.id}/a.png`, 'image/png', 'png')) >= 400, 'A não grava na pasta de B');

// ---------- 9. Conta inativada pelo admin ----------
const ADMIN = await login('admin.demo@nomaderun.app', 'Admin@2026demo');
const inact = await call('POST', `${API}/rest/v1/rpc/admin_set_user_status`, ADMIN.token, { p_user_id: B.id, p_status: 'inactive' });
check(inact.status === 200, 'admin inativa B', inact.data);
const bFn = await call('GET', `${FN}/zones?bbox=-47.9,-15.8,-47.8,-15.7`, B.token);
check(bFn.status === 401, 'token já emitido de B deixa de valer nas functions (Auth recusa usuário banido)', bFn.status);
const bIngest = await send(B.token, devB, crypto.randomUUID(), track(3));
check(bIngest.status === 401 || bIngest.status === 403, 'B inativo não envia pontos', bIngest.status);
const bRest = await call('GET', `${API}/rest/v1/notifications?select=id`, B.token);
known('QA-07', bRest.status === 401, 'token já emitido de B continua valendo no PostgREST até expirar (≤ 1 h)', bRest.status);
const bLogin = await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email: B.email, password });
check(bLogin.status >= 400, 'B inativo não faz login', bLogin.status);
await call('POST', `${API}/rest/v1/rpc/admin_set_user_status`, ADMIN.token, { p_user_id: B.id, p_status: 'active' });

// ---------- 10. Senhas e limite de login (Auth) ----------
const weak = await call('POST', `${API}/auth/v1/signup`, null, { email: `sec_w_${rand}@nomaderun.test`, password: '1234567', data: { username: `sec_w_${rand}`, birthdate: '1990-01-01', terms_accepted: true, privacy_accepted: true } });
check(weak.status === 422 || weak.status === 400, 'senha com menos de 8 caracteres é recusada', weak.data);
const statuses: number[] = [];
for (let i = 0; i < 12; i++) statuses.push((await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email: A.email, password: `errada-${i}` })).status);
const limited = statuses.some((s) => s === 429);
console.log(`  info - 12 logins errados seguidos: ${statuses.join(',')} (${limited ? 'limite aplicado' : 'sem 429 localmente: o rate limit por IP só vale no Cloud, P-09'})`);

// ---------- 11. Mensagens de erro sem detalhes internos ----------
const leaky = bodies.filter((b) => /stack|\bat \w+ \(|postgres|PGRST\d|relation "|syntax error|sb_secret|service_role|SUPABASE_|Deno\./i.test(b.text) && b.label.includes('/functions/'));
check(leaky.length === 0, 'nenhuma resposta das functions vaza stack, SQL, nomes de tabela ou chaves', leaky.map((b) => `${b.label}: ${b.text.slice(0, 120)}`));

// ---------- 12. Limite de linhas do PostgREST no /zones (RNF-009: até 2.000 zonas) ----------
const loadCenter = zoneOf({ lat: -15.6, lng: -47.7 });
const loadCells = cellsAround(loadCenter, 20).slice(0, 1200);
const loadRows = loadCells.map((c) => {
  const ring = cellBoundary(c);
  return { id: c, name: `Carga ${c.slice(-4)}`, city: 'Carga QA', is_demo: true, geom: `SRID=4326;POLYGON((${[...ring, ring[0]].map((p) => `${p.lng} ${p.lat}`).join(', ')}))` };
});
const ins = await call('POST', `${API}/rest/v1/zones`, SERVICE, loadRows, SERVICE, { Prefer: 'return=minimal,resolution=ignore-duplicates' });
check(ins.status === 201, '1.200 zonas de carga inseridas (service role)', ins.status);
const many = await call('GET', `${FN}/zones?bbox=-47.85,-15.75,-47.55,-15.45`, A.token);
known('QA-04', many.data?.zones?.length >= 1200, `/zones devolve todas as zonas da área (até 2.000); veio ${many.data?.zones?.length}`);
await call('DELETE', `${API}/rest/v1/zones?city=eq.Carga%20QA`, SERVICE, undefined, SERVICE);

// limpeza
for (const u of [A, B, M]) await call('DELETE', `${API}/auth/v1/admin/users/${u.id}`, SERVICE, undefined, SERVICE);

console.log(`\n${step - failures}/${step} verificações ok · ${findings.length} achado(s) conhecido(s)${STRICT ? ' (STRICT)' : ''}`);
for (const f of findings) console.log(`  - ${f}`);
if (failures > 0) Deno.exit(1);
