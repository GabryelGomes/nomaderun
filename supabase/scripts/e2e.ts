/**
 * Teste de integração contra a stack local (T1.3):
 * conta → facção → aparelho → 2 lotes assinados (com reenvio duplicado, lote fora de ordem, reenvio adulterado
 * e assinatura errada) → finish-activity → zona conquistada aparece em /zones e /zone → export → exclusão.
 *
 * Uso: `bash supabase/scripts/e2e.sh` (lê URL e chaves de `supabase status`).
 */
import { canonicalBatch, hmacSha256Hex, type SignedPoint } from '../functions/_shared/hmac.ts';
import { cellCenter, offset, zoneOf } from '../functions/_shared/domain.ts';

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
    console.log(`  NÃO OK ${step} - ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : '');
  }
}

async function call(method: string, url: string, token: string | null, body?: unknown, apikey = ANON) {
  const res = await fetch(url, {
    method,
    headers: {
      apikey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const rand = crypto.randomUUID().slice(0, 8);
const email = `e2e_${rand}@nomaderun.test`;
const password = `Senha-${rand}-ok`;
const username = `e2e_${rand}`;

console.log('NOMADE RUN — e2e contra', API);

// 1) Cadastro: menor de 16 é recusado; maior é aceito e ganha perfil
const young = await call('POST', `${API}/auth/v1/admin/users`, SERVICE, {
  email: `young_${rand}@nomaderun.test`, password, email_confirm: true,
  user_metadata: { username: `y_${rand}`, birthdate: '2015-01-01', terms_accepted: true, privacy_accepted: true },
}, SERVICE);
check(young.status >= 400, 'cadastro com menos de 16 anos é recusado pelo banco', young);

const created = await call('POST', `${API}/auth/v1/admin/users`, SERVICE, {
  email, password, email_confirm: true,
  user_metadata: { username, birthdate: '1998-04-12', terms_accepted: true, privacy_accepted: true, city: 'Goiânia' },
}, SERVICE);
check(created.status === 200 && created.data?.id, 'cadastro válido cria o usuário', created);

const login = await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email, password });
check(login.status === 200 && login.data?.access_token, 'login por e-mail e senha devolve JWT', login);
const token: string = login.data?.access_token;
const userId: string = login.data?.user?.id;
check(login.data?.expires_in === 3600, 'JWT expira em 1 hora (RF-001)', login.data?.expires_in);

const profile = await call('GET', `${API}/rest/v1/profiles?select=username,faction,trust,role&id=eq.${userId}`, token);
check(profile.data?.[0]?.username === username && profile.data[0].trust === 100, 'perfil criado pelo trigger com trust 100', profile);

// 2) Facção (RPC)
const factions = ['striders', 'coyotes', 'owls', 'volt'];
const faction = factions[Math.floor(Math.random() * 4)];
const chosen = await call('POST', `${API}/rest/v1/rpc/choose_faction`, token, { p_faction: faction });
check(chosen.status === 200 && chosen.data?.faction === faction, `choose_faction(${faction})`, chosen);

// 3) Aparelho
const deviceId = crypto.randomUUID();
const secret = crypto.getRandomValues(new Uint8Array(32));
const secretB64 = btoa(String.fromCharCode(...secret));
const reg = await call('POST', `${FN}/register-device`, token, { deviceId, secret: secretB64, platform: 'android', model: 'e2e' });
check(reg.status === 200 && reg.data?.deviceId === deviceId, 'register-device', reg);
const reg2 = await call('POST', `${FN}/register-device`, token, { deviceId, secret: secretB64, platform: 'android', model: 'e2e' });
check(reg2.status === 200, 'register-device é idempotente', reg2);

// 4) Percurso: 2 voltas de raio 60 m em torno do centro de uma zona sorteada (região rural de Goiás),
//    3 m/s com passos — deve conquistar a zona neutra (≥ 30 RP).
const base = offset({ lat: -16.2, lng: -49.6 }, Math.random() * 40_000, Math.random() * 360);
const zoneId = zoneOf(base);
const center = cellCenter(zoneId);
const t0 = Date.now() - 10 * 60_000;
const points: SignedPoint[] = [];
const loopMeters = 2 * Math.PI * 60;
const total = Math.floor((2 * loopMeters) / 3);
for (let i = 0; i <= total; i++) {
  const angle = ((i * 3) / loopMeters) * 360;
  const p = offset(center, 60, angle);
  points.push({ seq: i, lat: p.lat, lng: p.lng, t: t0 + i * 1000, accuracy: 5, speed: 3, altitude: 750, mocked: false, steps: i === 0 ? 0 : 3 });
}
const activityId = crypto.randomUUID();

async function batch(from: number, to: number, mutate?: (b: any) => void, sign = true) {
  const body: any = { activityId, deviceId, fromSeq: from, toSeq: to, points: points.slice(from, to + 1) };
  if (from === 0) Object.assign(body, { startedAt: t0, mission: 'livre' });
  if (mutate) mutate(body);
  body.signature = sign ? await hmacSha256Hex(secret, canonicalBatch(body)) : 'ab'.repeat(32);
  return call('POST', `${FN}/ingest-points`, token, body);
}

const half = Math.floor(points.length / 2);
const last = points.length - 1;
const b1 = await batch(0, half);
check(b1.status === 202 && b1.data?.accepted === half + 1 && b1.data?.lastSeq === half, `lote 1 (0..${half}) aceito`, b1);

const dup = await batch(0, half);
check(dup.status === 202 && dup.data?.accepted === 0 && dup.data?.duplicates === half + 1, 'reenvio idêntico do lote 1 = duplicado aceito', dup);

const ooo = await batch(half + 5, last);
check(ooo.status === 409 && ooo.data?.error?.code === 'OUT_OF_ORDER' && ooo.data?.error?.details?.lastSeq === half, 'lote fora de ordem → OUT_OF_ORDER', ooo);

const tampered = await batch(0, half, (b) => { b.points = b.points.map((p: SignedPoint, i: number) => (i === 3 ? { ...p, lat: p.lat + 0.001 } : p)); });
check(tampered.status === 409 && tampered.data?.error?.code === 'REPLAY_MISMATCH', 'reenvio com conteúdo diferente → REPLAY_MISMATCH', tampered);

const badSig = await batch(half + 1, last, undefined, false);
check(badSig.status === 401 && badSig.data?.error?.code === 'INVALID_SIGNATURE', 'assinatura errada → INVALID_SIGNATURE', badSig);

const early = await call('POST', `${FN}/finish-activity`, token, { activityId, endedAt: points[last].t, lastSeq: last });
check(early.status === 409 && early.data?.error?.code === 'MISSING_POINTS', 'finalizar antes do lote 2 → MISSING_POINTS', early);

const b2 = await batch(half + 1, last);
check(b2.status === 202 && b2.data?.lastSeq === last, `lote 2 (${half + 1}..${last}) aceito`, b2);

// 5) Finalização oficial
const fin = await call('POST', `${FN}/finish-activity`, token, { activityId, endedAt: points[last].t, lastSeq: last });
const conquered = fin.data?.zones?.find((z: any) => z.zoneId === zoneId);
check(fin.status === 200 && fin.data?.status === 'valid', 'finish-activity → status valid', fin);
check(conquered?.outcome === 'conquered' && conquered?.ownerAfter === faction, `zona ${zoneId} conquistada para ${faction}`, fin.data?.zones);
check(fin.data?.rpTotal > 0 && fin.data?.xp > 0 && fin.data?.trust === 100, 'RP, XP e trust no resumo oficial', fin.data);
check(Array.isArray(fin.data?.invalidSegments) && fin.data.invalidSegments.length === 0, 'sem trechos inválidos', fin.data?.invalidSegments);

const fin2 = await call('POST', `${FN}/finish-activity`, token, { activityId, endedAt: points[last].t, lastSeq: last });
check(fin2.status === 200 && fin2.data?.rpTotal === fin.data?.rpTotal, 'finalizar de novo devolve o mesmo resultado (idempotente)', fin2);

const after = await batch(0, half);
check(after.status === 409 && after.data?.error?.code === 'ACTIVITY_CLOSED', 'lote após finalizar → ACTIVITY_CLOSED', after);

// 6) Mapa
const d = 0.01;
const zones = await call('GET', `${FN}/zones?bbox=${center.lng - d},${center.lat - d},${center.lng + d},${center.lat + d}`, token);
const z = zones.data?.zones?.find((x: any) => x.id === zoneId);
check(zones.status === 200 && z?.owner === faction, '/zones mostra a zona com o novo dono', zones);
const zone = await call('GET', `${FN}/zone?id=${zoneId}`, token);
check(zone.status === 200 && zone.data?.topRunners?.[0]?.username === username && zone.data?.events?.[0]?.type === 'captured',
  '/zone traz o corredor no topo e o evento de conquista', zone);

const notes = await call('GET', `${API}/rest/v1/notifications?select=type,title`, token);
check(notes.data?.some((n: any) => n.type === 'conquest'), 'notificação "Zona conquistada" criada', notes);

// 7) RLS: o cliente não grava zona direto
const hack = await call('PATCH', `${API}/rest/v1/zones?id=eq.${zoneId}`, token, { owner: 'volt' });
check(hack.status === 401 || hack.status === 403, 'cliente não altera zones (RLS/grants)', hack);

// 8) Foto de perfil no Storage (P-03): grava só na própria pasta
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
async function upload(path: string) {
  const res = await fetch(`${API}/storage/v1/object/avatars/${path}`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: png,
  });
  await res.body?.cancel();
  return res.status;
}
check(await upload(`${userId}/avatar.png`) === 200, 'upload da foto na própria pasta do bucket avatars');
check([400, 403].includes(await upload(`00000000-0000-4000-a000-000000000001/avatar.png`)), 'upload na pasta de outro usuário é recusado');
const avatarUrl = `${API}/storage/v1/object/public/avatars/${userId}/avatar.png`;
const pub = await fetch(avatarUrl);
await pub.body?.cancel();
check(pub.status === 200, 'foto acessível pela URL pública');

// 9) LGPD
const exp = await call('GET', `${FN}/account-export`, token);
check(exp.status === 200 && exp.data?.activities?.[0]?.points?.length === points.length, 'account-export traz corrida e pontos', { status: exp.status });
const delBad = await call('POST', `${FN}/account-delete`, token, { confirm: 'sim' });
check(delBad.status === 400, 'account-delete exige confirm=EXCLUIR', delBad);
const del = await call('POST', `${FN}/account-delete`, token, { confirm: 'EXCLUIR' });
check(del.status === 200 && del.data?.deleted === true, 'account-delete exclui a conta', del);
const gone = await call('GET', `${FN}/zones?bbox=0,0,0.1,0.1`, token);
check(gone.status === 401, 'token da conta excluída deixa de funcionar nas functions', gone);
const pubAfter = await fetch(avatarUrl);
await pubAfter.body?.cancel();
check(pubAfter.status >= 400, 'foto de perfil apagada junto com a conta', pubAfter.status);

console.log(failures === 0 ? `\n# e2e: ${step}/${step} verificações ok` : `\n# e2e: ${failures} de ${step} verificações falharam`);
Deno.exit(failures === 0 ? 0 : 1);
