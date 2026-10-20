/**
 * Teste de integração contra a stack local (T1.3 + Fase 3 do A2):
 * conta → facção → aparelho → 2 lotes assinados (com reenvio duplicado, lote fora de ordem, reenvio adulterado
 * e assinatura errada) → finish-activity → zona conquistada aparece em /zones e /zone → export → exclusão.
 * Fase 3: notificação pelo Realtime só para o dono (P-13), baús da missão Caça (RN-017), nome da zona nova (P-12),
 * rankings por semana/distrito (P-16), zona de privacidade no painel (RN-010) e M_grupo com 3 membros da Crew (RN-001).
 *
 * Uso: `bash supabase/scripts/e2e.sh` (lê URL e chaves de `supabase status`).
 */
import { canonicalBatch, hmacSha256Hex, type SignedPoint } from '../functions/_shared/hmac.ts';
import { cellCenter, districtOf, offset, zoneOf } from '../functions/_shared/domain.ts';

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

// Colegas de Crew para o M_grupo (RN-001) e para conferir que o Realtime não entrega notificação alheia (P-13)
async function newRunner(tag: string) {
  const em = `e2e_${tag}_${rand}@nomaderun.test`;
  const c = await call('POST', `${API}/auth/v1/admin/users`, SERVICE, {
    email: em, password, email_confirm: true,
    user_metadata: { username: `e2e_${tag}_${rand}`, birthdate: '1997-02-03', terms_accepted: true, privacy_accepted: true },
  }, SERVICE);
  const l = await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email: em, password });
  await call('POST', `${API}/rest/v1/rpc/choose_faction`, l.data?.access_token, { p_faction: faction });
  return { id: c.data?.id as string, token: l.data?.access_token as string };
}
const mateB = await newRunner('b');
const mateC = await newRunner('c');
check(mateB.token && mateC.token, 'dois colegas da mesma facção criados');

/** Escuta INSERTs em notifications pelo Realtime (protocolo Phoenix, sem supabase-js). */
function listenNotifications(jwt: string, filter?: string) {
  const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`);
  const records: any[] = [];
  let resolveReady: (ok: boolean) => void;
  const ready = new Promise<boolean>((r) => (resolveReady = r));
  const timer = setTimeout(() => resolveReady(false), 15_000);
  ws.onopen = () => ws.send(JSON.stringify({
    topic: `realtime:e2e-${crypto.randomUUID().slice(0, 6)}`, event: 'phx_join', ref: '1', join_ref: '1',
    payload: {
      config: { broadcast: { self: false }, presence: { key: '' }, private: false,
        postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'notifications', ...(filter ? { filter } : {}) }] },
      access_token: jwt,
    },
  }));
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data));
    if (msg.event === 'system' && msg.payload?.extension === 'postgres_changes' && msg.payload?.status === 'ok') {
      clearTimeout(timer);
      resolveReady(true);
    }
    if (msg.event === 'postgres_changes') records.push(msg.payload?.data?.record);
  };
  return { ready, records, close: () => { clearTimeout(timer); ws.close(); } };
}
const rtOwner = listenNotifications(token, `user_id=eq.${userId}`);
const rtOther = listenNotifications(mateB.token);
check((await rtOwner.ready) && (await rtOther.ready), 'assinaturas Realtime em notifications aceitas (P-13)');
await new Promise((r) => setTimeout(r, 1500)); // P-22: dá tempo de o Realtime ligar a replicação

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

check(conquered?.name && !conquered.name.startsWith('Zona ') && /\d+$/.test(conquered.name), `zona nova ganhou nome legível (${conquered?.name})`, conquered);

// P-13: "Zona conquistada" chega pelo Realtime ao dono e não ao colega (RLS)
for (let i = 0; i < 50 && !rtOwner.records.some((r) => r?.type === 'conquest'); i++) await new Promise((r) => setTimeout(r, 100));
check(rtOwner.records.some((r) => r?.type === 'conquest' && r?.user_id === userId), 'notificação chegou pelo Realtime ao dono', rtOwner.records);
check(!rtOther.records.some((r) => r?.user_id === userId), 'outro usuário assinando a tabela inteira não recebe a notificação alheia', rtOther.records);
rtOwner.close();
rtOther.close();

const fin2 = await call('POST', `${FN}/finish-activity`, token, { activityId, endedAt: points[last].t, lastSeq: last });
check(fin2.status === 200 && fin2.data?.rpTotal === fin.data?.rpTotal && fin2.data?.zones?.[0]?.name === fin.data?.zones?.[0]?.name,
  'finalizar de novo devolve o mesmo resultado (idempotente, com o nome)', fin2);

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
check(zone.data?.name === conquered?.name && zone.data?.city === 'Goiânia', '/zone mostra o nome e a cidade da zona nova', zone.data);

// P-16: rankings da semana por distrito (H3 pai da zona)
const district = districtOf(zoneId);
const rkWeek = await call('POST', `${API}/rest/v1/rpc/ranking_runners`, token, { p_period: 'week', p_scope: 'district', p_value: district });
check(rkWeek.status === 200 && rkWeek.data?.[0]?.username === username && rkWeek.data[0].rp === fin.data.rpTotal, 'ranking da semana no distrito', rkWeek);
const rkFac = await call('POST', `${API}/rest/v1/rpc/ranking_factions`, token, { p_period: 'season', p_scope: 'district', p_value: district });
check(rkFac.data?.find((f: any) => f.faction === faction)?.zones >= 1, 'facções no distrito contam a zona conquistada', rkFac);
const rkBad = await call('POST', `${API}/rest/v1/rpc/ranking_runners`, token, { p_period: 'mes' });
check(rkBad.status >= 400 && String(rkBad.data?.message).startsWith('VALIDATION'), 'período inválido → VALIDATION', rkBad);

// RN-010: zona de privacidade em volta do percurso → painel de moderação não recebe os pontos; o dono vê tudo
const pz = await call('POST', `${API}/rest/v1/privacy_zones`, token, { label: 'Casa', lat: center.lat, lng: center.lng });
check(pz.status === 201, 'endereço de privacidade cadastrado (raio padrão 200 m)', pz);
const modLogin = await call('POST', `${API}/auth/v1/token?grant_type=password`, null, { email: 'moderador.demo@nomaderun.app', password: 'Moderacao@2026' });
const modPts = await call('GET', `${API}/rest/v1/activity_points?select=seq&activity_id=eq.${activityId}`, modLogin.data?.access_token);
const ownPts = await call('GET', `${API}/rest/v1/activity_points?select=seq&activity_id=eq.${activityId}`, token);
check(modLogin.status === 200 && Array.isArray(modPts.data) && modPts.data.length === 0 && ownPts.data?.length === points.length,
  'percurso dentro da zona de privacidade some para o moderador e continua para o dono', { mod: modPts.data?.length, own: ownPts.data?.length });

// RN-017: baús do dia (missão Caça) — o primeiro é posto pelo service role ao lado do percurso para abrir de propósito
const hunt = await call('POST', `${API}/rest/v1/rpc/daily_chests`, token, { p_lat: center.lat, p_lng: center.lng });
const chests = hunt.data?.chests ?? [];
check(hunt.status === 200 && chests.length >= 5 && chests.length <= 8, `baús do dia sorteados (${chests.length})`, hunt);
const nearRoute = offset(center, 70, 0); // 10 m fora da volta de raio 60 m
await call('PATCH', `${API}/rest/v1/chests?id=eq.${chests[0]?.id}`, SERVICE, { lat: nearRoute.lat, lng: nearRoute.lng }, SERVICE);
const huntId = crypto.randomUUID();
const huntPts: SignedPoint[] = points.map((p) => ({ ...p, t: p.t - 3 * 3_600_000 }));
{
  const body: any = { activityId: huntId, deviceId, fromSeq: 0, toSeq: huntPts.length - 1, points: huntPts, startedAt: huntPts[0].t, mission: 'caca' };
  body.signature = await hmacSha256Hex(secret, canonicalBatch(body));
  const ing = await call('POST', `${FN}/ingest-points`, token, body);
  check(ing.status === 202, 'corrida da missão Caça enviada', ing);
}
const huntFin = await call('POST', `${FN}/finish-activity`, token, { activityId: huntId, lastSeq: huntPts.length - 1 });
const openedChest = huntFin.data?.chests?.find((c: any) => c.chestId === chests[0]?.id);
check(huntFin.status === 200 && openedChest && huntFin.data.chests.length >= 1, 'baú ao lado do percurso abriu no finish-activity', huntFin.data?.chests);
const xpChests = (huntFin.data?.chests ?? []).reduce((s: number, c: any) => s + c.xp, 0);
check(xpChests > 0 && huntFin.data.xp >= xpChests, `XP dos baús somado ao da corrida (+${xpChests})`, huntFin.data);
const opens = await call('GET', `${API}/rest/v1/chest_opens?select=chest_id`, token);
const huntAgain = await call('POST', `${API}/rest/v1/rpc/daily_chests`, token, {});
check(opens.data?.some((o: any) => o.chest_id === chests[0]?.id) && huntAgain.data?.chests?.find((c: any) => c.id === chests[0]?.id)?.openedAt,
  'chest_opens e daily_chests mostram o baú aberto', { opens: opens.data, again: huntAgain.data });

// RN-001: 3 membros da mesma Crew correndo juntos (a 10 m) na mesma zona → M_grupo 1,25
const crew = await call('POST', `${API}/rest/v1/crews`, token, { name: `E2E ${rand}`, tag: Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('') }, ANON);
const crewRow = await call('GET', `${API}/rest/v1/crews?select=id,invite_code&leader_id=eq.${userId}`, token);
const code = crewRow.data?.[0]?.invite_code;
const jb = await call('POST', `${API}/rest/v1/rpc/join_crew`, mateB.token, { p_code: code });
const jc = await call('POST', `${API}/rest/v1/rpc/join_crew`, mateC.token, { p_code: code });
check(crew.status === 201 && jb.status === 200 && jc.status === 200, 'crew com 3 membros', { crew, jb, jc });
const packBase = offset({ lat: -16.2, lng: -49.6 }, 45_000 + Math.random() * 20_000, Math.random() * 360);
const packZone = zoneOf(packBase);
const packCenter = cellCenter(packZone);
const tPack = Date.now() - 5 * 60_000;
const packLoop = (shift: number): SignedPoint[] => {
  const c = shift ? offset(packCenter, shift, 0) : packCenter;
  return Array.from({ length: total + 1 }, (_, i) => {
    const p = offset(c, 60, ((i * 3) / loopMeters) * 360);
    return { seq: i, lat: p.lat, lng: p.lng, t: tPack + i * 1000, accuracy: 5, speed: 3, altitude: 750, mocked: false, steps: i === 0 ? 0 : 3 };
  });
};
async function runAs(who: { token: string }, pts: SignedPoint[]) {
  const dev = crypto.randomUUID();
  const sec = crypto.getRandomValues(new Uint8Array(32));
  await call('POST', `${FN}/register-device`, who.token, { deviceId: dev, secret: btoa(String.fromCharCode(...sec)), platform: 'android' });
  const act = crypto.randomUUID();
  const body: any = { activityId: act, deviceId: dev, fromSeq: 0, toSeq: pts.length - 1, points: pts, startedAt: pts[0].t, mission: 'livre' };
  body.signature = await hmacSha256Hex(sec, canonicalBatch(body));
  const r = await call('POST', `${FN}/ingest-points`, who.token, body);
  return { act, status: r.status };
}
const runB = await runAs(mateB, packLoop(10));
const runC = await runAs(mateC, packLoop(-10));
const runA = await runAs({ token }, packLoop(0));
check(runA.status === 202 && runB.status === 202 && runC.status === 202, 'três corridas simultâneas enviadas');
const packFin = await call('POST', `${FN}/finish-activity`, token, { activityId: runA.act, lastSeq: total });
const packZ = packFin.data?.zones?.find((z: any) => z.zoneId === packZone);
check(packFin.status === 200 && packFin.data?.group?.zones?.includes(packZone) && packFin.data.group.members === 2,
  'finish-activity aplica M_grupo na zona corrida em grupo', packFin.data?.group);
const soloFin = await call('POST', `${FN}/finish-activity`, mateC.token, { activityId: runC.act, lastSeq: total });
check(soloFin.data?.group?.zones?.includes(packZone), 'o colega que finaliza depois também recebe M_grupo', soloFin.data?.group);
check(packZ?.rp > 0 && packZ.rp >= Math.round(packZ.meters * 0.1 * 0.8 * 1.25) - 1, `RP com M_grupo (${packZ?.rp} RP em ${packZ?.meters} m)`, packZ);

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

for (const m of [mateB, mateC]) await call('DELETE', `${API}/auth/v1/admin/users/${m.id}`, SERVICE, undefined, SERVICE);

console.log(failures === 0 ? `\n# e2e: ${step}/${step} verificações ok` : `\n# e2e: ${failures} de ${step} verificações falharam`);
Deno.exit(failures === 0 ? 0 : 1);
