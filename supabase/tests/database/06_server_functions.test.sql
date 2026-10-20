-- T1.3 — funções do servidor: ingestão idempotente (D-03), gravação transacional com conflito (D-23),
-- alertas de invasão com limites (RF-009 / RN-003), moderação, admin e consulta por área.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '66666666-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'runner@t.com',
   '{"username": "coyote_c", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '66666666-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'def@t.com',
   '{"username": "strider_s", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '66666666-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'adm@t.com',
   '{"username": "admin_x", "birthdate": "1990-01-01", "terms_accepted": true}');
update public.profiles set faction = 'coyotes' where id = '66666666-0000-4000-8000-000000000001';
update public.profiles set faction = 'striders' where id = '66666666-0000-4000-8000-000000000002';
update public.profiles set role = 'admin' where id = '66666666-0000-4000-8000-000000000003';
insert into public.devices (id, user_id, secret, platform) values
  ('d6666666-0000-4000-8000-000000000001', '66666666-0000-4000-8000-000000000001', extensions.gen_random_bytes(32), 'android');

-- ---------------------------------------------------------------- ingestão (D-03)
create function pg_temp.batch(p_from int, p_to int, p_lat_shift float8 default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'userId', '66666666-0000-4000-8000-000000000001', 'activityId', 'a6666666-0000-4000-8000-000000000001',
    'deviceId', 'd6666666-0000-4000-8000-000000000001', 'startedAt', 1760000000000, 'mission', 'livre',
    'fromSeq', p_from, 'toSeq', p_to,
    'points', (select jsonb_agg(jsonb_build_object('seq', s, 'lat', -16.7 + s * 0.00001 + case when s = p_from then p_lat_shift else 0 end,
                                                   'lng', -49.2, 't', 1760000000000 + s * 1000, 'accuracy', 5, 'speed', 3.1,
                                                   'altitude', null, 'mocked', false, 'steps', 3) order by s)
                 from generate_series(p_from, p_to) s))
$$;

select is(public.svc_ingest_points(pg_temp.batch(0, 9)), '{"accepted": 10, "duplicates": 0, "lastSeq": 9}'::jsonb, 'lote novo aceito e cria a corrida');
select is(public.svc_ingest_points(pg_temp.batch(0, 9)), '{"accepted": 0, "duplicates": 10, "lastSeq": 9}'::jsonb, 'reenvio idêntico = duplicado aceito');
select is(public.svc_ingest_points(pg_temp.batch(5, 14)), '{"accepted": 5, "duplicates": 5, "lastSeq": 14}'::jsonb, 'lote sobreposto grava só o que falta');
select is(public.svc_ingest_points(pg_temp.batch(5, 9, 0.5)) ->> 'error', 'REPLAY_MISMATCH', 'mesmo seq com conteúdo diferente = REPLAY_MISMATCH');
select is(public.svc_ingest_points(pg_temp.batch(20, 25)), '{"error": "OUT_OF_ORDER", "lastSeq": 14}'::jsonb, 'fromSeq > último+1 = OUT_OF_ORDER');
select is((select count(*)::int from public.activity_points where activity_id = 'a6666666-0000-4000-8000-000000000001'), 15, '15 pontos, sem duplicação');
select is(public.svc_ingest_points(pg_temp.batch(15, 16) || '{"userId": "66666666-0000-4000-8000-000000000002"}') ->> 'error', 'NOT_OWNER',
  'outro usuário não envia pontos para esta corrida');

-- ---------------------------------------------------------------- gravação do resultado (D-23) + RF-009/RN-003
insert into public.zones (id, geom, influence, owner, version) values
  ('891f1d48177ffff', extensions.st_geomfromtext('POLYGON((-49.21 -16.71, -49.20 -16.71, -49.20 -16.70, -49.21 -16.71))', 4326),
   '{"striders": 100, "coyotes": 0, "owls": 0, "volt": 0}', 'striders', 3),
  ('891f1d48173ffff', extensions.st_geomfromtext('POLYGON((-49.22 -16.71, -49.21 -16.71, -49.21 -16.70, -49.22 -16.71))', 4326),
   '{"striders": 100, "coyotes": 0, "owls": 0, "volt": 0}', 'striders', 0);
-- o defensor correu nas duas zonas há 2 dias
insert into public.activities (id, user_id, started_at, status, scored, finished_at) values
  ('a6666666-0000-4000-8000-0000000000d1', '66666666-0000-4000-8000-000000000002', now() - interval '2 days', 'valid', true, now() - interval '2 days');
insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome, created_at) values
  ('a6666666-0000-4000-8000-0000000000d1', '891f1d48177ffff', '66666666-0000-4000-8000-000000000002', 'striders', 1000, 100, 'conquered', now() - interval '2 days'),
  ('a6666666-0000-4000-8000-0000000000d1', '891f1d48173ffff', '66666666-0000-4000-8000-000000000002', 'striders', 1000, 100, 'conquered', now() - interval '2 days');

create function pg_temp.result(p_act uuid, p_zone text, p_version int, p_event jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'mode', 'finish', 'activityId', p_act, 'userId', '66666666-0000-4000-8000-000000000001', 'faction', 'coyotes',
    'status', 'valid', 'scored', true, 'endedAt', 1760000600000, 'meters', 600, 'movingSeconds', 180, 'avgPace', 300,
    'rpTotal', 60, 'xp', 6, 'beatGhost', null, 'flags', '[]'::jsonb, 'invalidSegments', '[]'::jsonb, 'trustAfter', 100,
    'suspend', false, 'reviewReason', null,
    'zones', jsonb_build_array(jsonb_build_object('id', p_zone, 'expectedVersion', p_version, 'name', null,
              'influence', '{"striders": 100, "coyotes": 60, "owls": 0, "volt": 0}'::jsonb, 'owner', 'striders', 'shield', 0,
              'attacker', 'coyotes', 'attackStartedAt', 1760000600000, 'blocked', false)),
    'activityZones', jsonb_build_array(jsonb_build_object('zoneId', p_zone, 'meters', 600, 'rp', 60, 'outcome', 'influence',
              'ownerBefore', 'striders', 'ownerAfter', 'striders')),
    'events', jsonb_build_array(p_event), 'fogCells', '["8aa8c0ce2c37fff"]'::jsonb, 'result', '{"status": "valid"}'::jsonb)
$$;

-- versão desatualizada → conflito, nada gravado
select throws_like(
  $$ select public.svc_apply_activity_result(pg_temp.result('a6666666-0000-4000-8000-000000000001', '891f1d48177ffff', 2,
       '{"type": "under_attack", "zoneId": "891f1d48177ffff", "owner": "striders", "attacker": "coyotes"}')) $$,
  '%ZONE_CONFLICT%', 'versão da zona mudou → ZONE_CONFLICT (a function recalcula)');
select is((select status from public.activities where id = 'a6666666-0000-4000-8000-000000000001'), 'recording', 'conflito não grava nada');

select is(public.svc_apply_activity_result(pg_temp.result('a6666666-0000-4000-8000-000000000001', '891f1d48177ffff', 3,
       '{"type": "under_attack", "zoneId": "891f1d48177ffff", "owner": "striders", "attacker": "coyotes"}')) ->> 'notified', '1',
  'zona sob ataque notifica o defensor que correu nela nos últimos 30 dias');
select results_eq($$ select owner, attacker, version from public.zones where id = '891f1d48177ffff' $$,
  $$ values ('striders'::text, 'coyotes'::text, 4) $$, 'zona atualizada e versão incrementada');
select is((select status from public.activities where id = 'a6666666-0000-4000-8000-000000000001'), 'valid', 'corrida finalizada');
select is((select xp from public.profiles where id = '66666666-0000-4000-8000-000000000001'), 6, 'XP somado ao perfil');
select is((select count(*)::int from public.fog_cells where user_id = '66666666-0000-4000-8000-000000000001'), 1, 'neblina gravada');
select is((select body from public.notifications where user_id = '66666666-0000-4000-8000-000000000002' and type = 'invasion'),
  'Seu território em Zona 8177 está sendo conquistado pelos Urban Coyotes. Corra lá nas próximas 24h para defender.',
  'texto do alerta de invasão (RF-009)');
select is((public.svc_apply_activity_result(pg_temp.result('a6666666-0000-4000-8000-000000000001', '891f1d48177ffff', 4, '{}'::jsonb)) ->> 'error'),
  'ALREADY_FINISHED', 'finalizar de novo não aplica pontos duas vezes');

-- RN-003: no máximo 1 alerta por zona a cada 6 h
insert into public.activities (id, user_id, started_at) values ('a6666666-0000-4000-8000-000000000002', '66666666-0000-4000-8000-000000000001', now());
select is(public.svc_apply_activity_result(pg_temp.result('a6666666-0000-4000-8000-000000000002', '891f1d48177ffff', 4,
       '{"type": "under_attack", "zoneId": "891f1d48177ffff", "owner": "striders", "attacker": "coyotes"}')) ->> 'notified', '0',
  'segundo alerta da mesma zona em menos de 6 h não é enviado (RN-003)');

-- RN-003: no máximo 5 alertas de invasão por dia
insert into public.notifications (user_id, type, title, body, data)
select '66666666-0000-4000-8000-000000000002', 'invasion', 'Alerta de Invasão!', 'x', jsonb_build_object('zoneId', 'outra' || i) from generate_series(1, 4) i;
insert into public.activities (id, user_id, started_at) values ('a6666666-0000-4000-8000-000000000003', '66666666-0000-4000-8000-000000000001', now());
select is(public.svc_apply_activity_result(pg_temp.result('a6666666-0000-4000-8000-000000000003', '891f1d48173ffff', 0,
       '{"type": "under_attack", "zoneId": "891f1d48173ffff", "owner": "striders", "attacker": "coyotes"}')) ->> 'notified', '0',
  'sexto alerta de invasão no mesmo dia não é enviado (RN-003)');

-- Território perdido para quem defendia
insert into public.activities (id, user_id, started_at) values ('a6666666-0000-4000-8000-000000000004', '66666666-0000-4000-8000-000000000001', now());
select is(public.svc_apply_activity_result(pg_temp.result('a6666666-0000-4000-8000-000000000004', '891f1d48173ffff', 1,
       '{"type": "captured", "zoneId": "891f1d48173ffff", "faction": "coyotes", "from": "striders"}')) ->> 'notified', '1',
  'conquista avisa os antigos donos ("Território perdido")');
select is((select count(*)::int from public.notifications where user_id = '66666666-0000-4000-8000-000000000001' and type = 'conquest'), 1,
  'corredor recebe "Zona conquistada"');

-- ---------------------------------------------------------------- moderação, admin, consulta por área
update public.activities set status = 'review' where id = 'a6666666-0000-4000-8000-0000000000d1';
select is(public.svc_moderate_reject('a6666666-0000-4000-8000-0000000000d1', '66666666-0000-4000-8000-000000000003', 'Percurso de carro claramente.') ->> 'ok',
  'true', 'moderação rejeita corrida em revisão');
select is((select count(*)::int from public.notifications where user_id = '66666666-0000-4000-8000-000000000002' and type = 'moderation'), 1,
  'corredor é notificado da decisão (RF-018)');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
select pg_temp.login('66666666-0000-4000-8000-000000000001');
select throws_like($$ select public.admin_set_user_status('66666666-0000-4000-8000-000000000002', 'inactive') $$, '%FORBIDDEN%',
  'corredor comum não inativa contas');
select is((select count(*)::int from public.zones_in_bbox(-49.215, -16.715, -49.195, -16.695) z where z.id in ('891f1d48177ffff', '891f1d48173ffff')), 2,
  'zones_in_bbox encontra as zonas da área');
select pg_temp.login('66666666-0000-4000-8000-000000000003');
select is(public.admin_set_user_status('66666666-0000-4000-8000-000000000002', 'inactive') ->> 'status', 'inactive', 'admin inativa conta (RF-002)');
reset role;
select ok((select banned_until > now() + interval '100 years' from auth.users where id = '66666666-0000-4000-8000-000000000002'),
  'conta inativa fica bloqueada no Auth');

select * from finish();
rollback;
