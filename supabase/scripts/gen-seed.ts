/**
 * Gera supabase/seed.sql (T1.3) a partir dos MESMOS dados de demonstração do app
 * (apps/mobile/src/demo/demo-data.ts: seedZones, zoneName, demoRoute) e do domain (cellBoundary).
 *
 * Uso (na raiz do repo): npm run seed:gen
 *   = deno run --allow-read --allow-write --config supabase/scripts/deno.json supabase/scripts/gen-seed.ts
 *
 * Tudo o que este seed cria é DEMONSTRAÇÃO (is_demo = true) e só deve ser usado localmente ou na apresentação.
 */
import { DEMO_CENTER, DEMO_CITY, demoRoute, seedZones, zoneName } from '../../apps/mobile/src/demo/demo-data.ts';
import { cellBoundary, distanceMeters, type LatLng } from '../functions/_shared/domain.ts';
import { computeOfficialResult, type DbZone, type StoredPoint } from '../functions/_shared/scoring.ts';

const OUT = new URL('../seed.sql', import.meta.url);

const q = (s: string | null | undefined) => (s === null || s === undefined ? 'null' : `'${s.replace(/'/g, "''")}'`);
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

function polygonWkt(cell: string): string {
  const ring = cellBoundary(cell).map((p) => `${p.lng.toFixed(9)} ${p.lat.toFixed(9)}`);
  ring.push(ring[0]);
  return `POLYGON((${ring.join(', ')}))`;
}

// ---------------------------------------------------------------------------
// Zonas de demonstração em Goiânia (centro: Parque Flamboyant)
// ---------------------------------------------------------------------------
const zones = seedZones();
const ids = Object.keys(zones).sort();
const zoneRows = ids.map((id) => {
  const z = zones[id];
  const attack = z.attackStartedAt !== null ? `now() - interval '6 hours 30 minutes'` : 'null';
  const influence = JSON.stringify(Object.fromEntries(Object.entries(z.influence).map(([k, v]) => [k, Number(num(v))])));
  return `  (${q(id)}, ${q(zoneName(id))}, ${q(DEMO_CITY)}, extensions.st_geomfromtext(${q(polygonWkt(id))}, 4326), ${q(influence)}::jsonb, ${q(z.owner)}, ${z.shield}, ${q(z.attacker)}, ${attack}, ${z.blocked}, true)`;
});
const underAttack = ids.filter((id) => zones[id].attackStartedAt !== null);

// ---------------------------------------------------------------------------
// Contas de demonstração (senhas documentadas em docs/PROGRESSO.md, só para uso local/apresentação)
// ---------------------------------------------------------------------------
type DemoUser = {
  id: string;
  email: string;
  password: string;
  username: string;
  faction: string;
  role: 'runner' | 'moderator' | 'admin';
  trust: number;
};
const USERS: DemoUser[] = [
  { id: '00000000-0000-4000-a000-000000000001', email: 'corredor.demo@nomaderun.app', password: 'Corrida@2026', username: 'corredor_demo', faction: 'striders', role: 'runner', trust: 100 },
  { id: '00000000-0000-4000-a000-000000000002', email: 'moderador.demo@nomaderun.app', password: 'Moderacao@2026', username: 'moderador_demo', faction: 'owls', role: 'moderator', trust: 100 },
  { id: '00000000-0000-4000-a000-000000000003', email: 'admin.demo@nomaderun.app', password: 'Admin@2026demo', username: 'admin_demo', faction: 'volt', role: 'admin', trust: 100 },
  { id: '00000000-0000-4000-a000-000000000004', email: 'suspeito.demo@nomaderun.app', password: 'Suspeito@2026', username: 'suspeito_demo', faction: 'coyotes', role: 'runner', trust: 40 },
];

const userSql = USERS.map((u) => {
  const meta = JSON.stringify({ username: u.username, birthdate: '1999-03-15', terms_accepted: true, privacy_accepted: true, city: DEMO_CITY });
  return `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', ${q(u.id)}, 'authenticated', 'authenticated', ${q(u.email)},
  extensions.crypt(${q(u.password)}, extensions.gen_salt('bf', 10)), now(),
  '{"provider": "email", "providers": ["email"], "is_demo": true}'::jsonb, ${q(meta)}::jsonb, now(), now(), '', '', '', '');
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (${q(u.id)}, ${q(u.id)}, ${q(JSON.stringify({ sub: u.id, email: u.email, email_verified: true }))}::jsonb, 'email', now(), now(), now());
update public.profiles set faction = ${q(u.faction)}, role = ${q(u.role)}, trust = ${u.trust} where id = ${q(u.id)};`;
}).join('\n\n');

// ---------------------------------------------------------------------------
// Uma corrida em revisão (para o painel de moderação, RF-018): volta do lago + trecho de "carro" na perna leste.
// O resultado é calculado pelo mesmo pipeline do servidor (computeOfficialResult) com trust 40.
// ---------------------------------------------------------------------------
const route = demoRoute();
const suspect = USERS[3];
const activityId = '00000000-0000-4000-b000-000000000001';
const deviceId = '00000000-0000-4000-c000-000000000001';
const t0 = Date.UTC(2026, 9, 19, 9, 30, 0); // 19/10/2026 06:30 em Brasília
const points: StoredPoint[] = [];
{
  // percorre a rota a 3,2 m/s, com 45 s a 9 m/s (32 km/h) na perna leste: suspeita de veículo (RN-007 c)
  const legs: { a: LatLng; b: LatLng; d: number }[] = [];
  for (let i = 1; i < route.length; i++) legs.push({ a: route[i - 1], b: route[i], d: distanceMeters(route[i - 1], route[i]) });
  const totalD = legs.reduce((s, l) => s + l.d, 0);
  const lakeD = legs.slice(0, 30).reduce((s, l) => s + l.d, 0);
  let traveled = 0;
  let t = t0;
  let seq = 0;
  const at = (dist: number): LatLng => {
    let acc = 0;
    for (const l of legs) {
      if (acc + l.d >= dist) {
        const f = l.d > 0 ? (dist - acc) / l.d : 0;
        return { lat: l.a.lat + (l.b.lat - l.a.lat) * f, lng: l.a.lng + (l.b.lng - l.a.lng) * f };
      }
      acc += l.d;
    }
    return legs[legs.length - 1].b;
  };
  let carSeconds = 0;
  while (traveled <= totalD) {
    const p = at(traveled);
    const inCar = traveled > lakeD + 120 && carSeconds < 45;
    const speed = inCar ? 9 : 3.2;
    points.push({ seq, lat: p.lat, lng: p.lng, t, accuracy: 6, speed, altitude: 748, mocked: false, steps: seq === 0 ? 0 : inCar ? 0 : 3 });
    if (inCar) carSeconds++;
    traveled += speed;
    t += 1000;
    seq++;
  }
}
const dbZones: DbZone[] = ids.map((id) => ({
  id,
  name: zoneName(id),
  influence: zones[id].influence,
  owner: zones[id].owner,
  shield: zones[id].shield,
  attacker: zones[id].attacker,
  attackStartedAt: zones[id].attackStartedAt,
  blocked: zones[id].blocked,
  version: 0,
}));
const official = computeOfficialResult({
  mode: 'finish',
  activityId,
  points,
  startedAt: t0,
  faction: 'coyotes',
  trust: suspect.trust,
  profileStatus: 'active',
  suspendedUntil: null,
  streakWeeks: 0,
  recentPaces: [],
  zones: dbZones,
  earnedToday: {},
  revealedFog: [],
  ghostPace: null,
  now: t0 + points.length * 1000,
});
if (official.status !== 'review') throw new Error(`corrida de demonstração deveria ir para revisão, veio ${official.status}`);
const r = official.response;
const pointRows = points.map((p) =>
  `  (${q(activityId)}, ${p.seq}, ${p.lat.toFixed(7)}, ${p.lng.toFixed(7)}, ${p.t}, ${p.accuracy}, ${p.speed}, ${p.altitude}, ${p.mocked}, ${p.steps})`
);

const sql = `-- ARQUIVO GERADO por supabase/scripts/gen-seed.ts — não edite à mão (rode: npm run seed:gen).
-- DADOS DE DEMONSTRAÇÃO (is_demo = true): ${ids.length} zonas em ${DEMO_CITY} ao redor do Parque Flamboyant
-- (${DEMO_CENTER.lat}, ${DEMO_CENTER.lng}), equivalentes a seedZones() de apps/mobile/src/demo/demo-data.ts,
-- e ${USERS.length} contas de demonstração (senhas em docs/PROGRESSO.md, só para uso local/apresentação).

-- Zonas de demonstração
insert into public.zones (id, name, city, geom, influence, owner, shield, attacker, attack_started_at, blocked, is_demo) values
${zoneRows.join(',\n')};

-- O parque está sob ataque dos Urban Coyotes (história de defesa do UC-02)
insert into public.zone_events (zone_id, type, faction, from_faction, created_at)
select id, 'under_attack', attacker, owner, attack_started_at from public.zones where id in (${underAttack.map(q).join(', ')});

-- Contas de demonstração
${userSql}

-- Alerta de invasão de demonstração para o corredor_demo (UC-02, RF-009; usado pelo fluxo Maestro 04)
insert into public.notifications (user_id, type, title, body, data, created_at)
select '00000000-0000-4000-a000-000000000001', 'invasion', 'Alerta de Invasão!',
       format('Seu território em %s está sendo conquistado pelos Urban Coyotes. Corra lá nas próximas 24h para defender.', z.name),
       jsonb_build_object('zoneId', z.id, 'attacker', z.attacker, 'demo', true,
                          'lat', extensions.st_y(extensions.st_centroid(z.geom)), 'lng', extensions.st_x(extensions.st_centroid(z.geom))),
       z.attack_started_at
  from public.zones z
 where z.attack_started_at is not null and z.owner = 'striders'
 order by z.id
 limit 1;

-- Corrida em revisão para o painel de moderação (trust 40 → ${r.trust} após as penalidades; RN-009)
insert into public.devices (id, user_id, secret, platform, model)
values (${q(deviceId)}, ${q(suspect.id)}, extensions.gen_random_bytes(32), 'android', 'Aparelho de demonstração');

insert into public.activities (id, user_id, device_id, status, mission, started_at, ended_at, finished_at, meters, moving_seconds,
  avg_pace, rp_total, xp, flags, invalid_segments, last_seq, scored, trust_after, review_reason, result)
values (${q(activityId)}, ${q(suspect.id)}, ${q(deviceId)}, 'review', 'livre', to_timestamp(${t0 / 1000}),
  to_timestamp(${points[points.length - 1].t / 1000}), to_timestamp(${points[points.length - 1].t / 1000}),
  ${r.meters}, ${r.movingSeconds}, ${r.avgPace ?? 'null'}, 0, 0, ${q(`{${r.flags.join(',')}}`)}, ${q(JSON.stringify(r.invalidSegments))}::jsonb,
  ${points.length - 1}, false, ${r.trust}, ${q(official.reviewReason)}, ${q(JSON.stringify(r))}::jsonb);

insert into public.activity_points (activity_id, seq, lat, lng, t, accuracy, speed, altitude, mocked, steps) values
${pointRows.join(',\n')};

update public.profiles set trust = ${r.trust} where id = ${q(suspect.id)};
`;

await Deno.writeTextFile(OUT, sql);
console.log(`seed.sql: ${ids.length} zonas, ${USERS.length} contas, corrida em revisão com ${points.length} pontos (${r.flags.join(', ')}).`);
