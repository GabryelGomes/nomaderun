-- Fase 3 (A2) — P-16 / RF-015: rankings por semana/temporada e por geral/facção/cidade/distrito;
-- P-12: nome legível e cidade para zonas criadas fora do seed.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- distrito = pai H3 res 7 (valores gerados por districtOf do domain)
select is(private.h3_parent('891f1d48177ffff', 7), '871f1d481ffffff', 'h3_parent = districtOf (1)');
select is(private.h3_parent('89a8c0ce2c3ffff', 7), '87a8c0ce2ffffff', 'h3_parent = districtOf (2, Goiânia)');
select is(private.h3_parent('89a8100c067ffff', 7), '87a8100c0ffffff', 'h3_parent = districtOf (3, São Paulo)');
select is(private.h3_parent('892a1072d6bffff', 7), '872a1072dffffff', 'h3_parent = districtOf (4, Nova York)');
select is(private.h3_parent('xyz', 7), null, 'índice inválido → null');
select ok(extract(isodow from private.period_start('week') at time zone 'America/Sao_Paulo') = 1
          and (private.period_start('week') at time zone 'America/Sao_Paulo')::time = '00:00', 'semana começa segunda 00:00 de Brasília');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'r1@t.com',
   '{"username": "rk_one", "birthdate": "1995-01-01", "terms_accepted": true, "city": "Cidade Teste"}'),
  ('00000000-0000-0000-0000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'r2@t.com',
   '{"username": "rk_two", "birthdate": "1995-01-01", "terms_accepted": true, "city": "Outra Teste"}'),
  ('00000000-0000-0000-0000-000000000000', 'a1111111-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'r3@t.com',
   '{"username": "rk_three", "birthdate": "1995-01-01", "terms_accepted": true}');
update public.profiles set faction = 'striders' where id = 'a1111111-0000-4000-8000-000000000001';
update public.profiles set faction = 'coyotes' where id in ('a1111111-0000-4000-8000-000000000002', 'a1111111-0000-4000-8000-000000000003');
insert into public.crews (id, name, tag, faction, leader_id) values
  ('c1111111-0000-4000-8000-000000000001', 'Rank Crew', 'RNKC', 'coyotes', 'a1111111-0000-4000-8000-000000000002');

insert into public.zones (id, name, city, geom, owner) values
  ('891f1d48177ffff', 'Rank Norte 1', 'Cidade Teste', extensions.st_geomfromtext('POLYGON((40 40, 40.001 40, 40.001 40.001, 40 40))', 4326), 'striders'),
  ('892a1072d6bffff', 'Rank Sul 1', 'Outra Teste', extensions.st_geomfromtext('POLYGON((41 41, 41.001 41, 41.001 41.001, 41 41))', 4326), 'coyotes')
on conflict (id) do update set name = excluded.name, city = excluded.city, owner = excluded.owner;
insert into public.activities (id, user_id, started_at, status, scored) values
  ('aa111111-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000001', now(), 'valid', true),
  ('aa111111-0000-4000-8000-000000000002', 'a1111111-0000-4000-8000-000000000002', now(), 'valid', true),
  ('aa111111-0000-4000-8000-000000000003', 'a1111111-0000-4000-8000-000000000003', now(), 'valid', true);
-- rk_one: 100 RP agora no distrito 871f…; rk_two: 300 RP no início da temporada no distrito 872a…; rk_three: 50 RP agora em 872a…
insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome, created_at) values
  ('aa111111-0000-4000-8000-000000000001', '891f1d48177ffff', 'a1111111-0000-4000-8000-000000000001', 'striders', 1000, 100, 'influence', now()),
  ('aa111111-0000-4000-8000-000000000002', '892a1072d6bffff', 'a1111111-0000-4000-8000-000000000002', 'coyotes', 3000, 300, 'influence',
   private.period_start('season') + interval '1 minute'),
  ('aa111111-0000-4000-8000-000000000003', '892a1072d6bffff', 'a1111111-0000-4000-8000-000000000003', 'coyotes', 500, 50, 'influence', now());

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
select pg_temp.login('a1111111-0000-4000-8000-000000000001');

select is((select rp from public.ranking_runners('season') where username = 'rk_two'), 300, 'temporada soma o RP desde o dia 1');
reset role;
select is((select count(*)::int from public.ranking_runners('week') where username in ('rk_one', 'rk_two', 'rk_three')),
          case when private.period_start('week') <= private.period_start('season') + interval '1 minute' then 3 else 2 end,
  'semana só conta o RP desde segunda (o de antes fica fora)');
select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is((select array_agg(username order by "position") from public.ranking_runners('season', 'faction', 'coyotes')),
  array['rk_two', 'rk_three'], 'escopo facção');
select is((select array_agg(username) from public.ranking_runners('season', 'city', 'Cidade Teste')), array['rk_one'], 'escopo cidade (cidade natal)');
select is((select array_agg(username order by "position") from public.ranking_runners('season', 'district', '872a1072dffffff')),
  array['rk_two', 'rk_three'], 'escopo distrito (zonas do H3 pai)');
select is((select array_agg(username) from public.ranking_runners('season', 'district', '871f1d481ffffff')), array['rk_one'], 'outro distrito');
select is((select crew_tag from public.ranking_runners('season') where username = 'rk_two'), 'RNKC', 'sigla da crew no ranking');
select is((select rp from public.ranking_crews('season', 'district', '872a1072dffffff') where tag = 'RNKC'), 300, 'crews por distrito');
select is((select count(*)::int from public.ranking_crews('season', 'district', '871f1d481ffffff') where tag = 'RNKC'), 0,
  'crew sem pontos no distrito não aparece');
select is((select rp from public.ranking_crews('season', 'faction', 'coyotes') where tag = 'RNKC'), 300, 'crews por facção');
select results_eq($$ select faction, rp, zones from public.ranking_factions('season', 'district', '872a1072dffffff') where faction in ('coyotes', 'striders') order by faction $$,
  $$ values ('coyotes'::text, 350, 1), ('striders'::text, 0, 0) $$, 'facções no distrito: RP e zonas dominadas');
select is((select zones from public.ranking_factions('season', 'city', 'Cidade Teste') where faction = 'striders'), 1, 'facções por cidade contam as zonas da cidade');
select throws_like($$ select * from public.ranking_runners('mes') $$, '%VALIDATION%', 'período inválido');
select throws_like($$ select * from public.ranking_runners('week', 'city') $$, '%VALIDATION%', 'escopo sem valor');
select throws_like($$ select * from public.ranking_factions('week', 'faction', 'volt') $$, '%VALIDATION%', 'facções não têm escopo facção');
select is(public.district_label('872a1072dffffff'), 'Rank Sul', 'nome do distrito = nome-base mais comum das zonas');
reset role;

-- P-12: zonas novas recebem nome e cidade
insert into public.zones (id, name, city, geom) values
  ('8b3333333331fff', 'Vila Teste 7', 'Cidade Teste', extensions.st_geomfromtext('POLYGON((50 50, 50.002 50, 50.002 50.002, 50 50))', 4326)),
  ('8b3333333332fff', 'Vila Teste 3', 'Cidade Teste', extensions.st_geomfromtext('POLYGON((50.01 50, 50.012 50, 50.012 50.002, 50.01 50))', 4326));
insert into public.activities (id, user_id, started_at) values
  ('aa111111-0000-4000-8000-000000000011', 'a1111111-0000-4000-8000-000000000001', now()),
  ('aa111111-0000-4000-8000-000000000012', 'a1111111-0000-4000-8000-000000000003', now());
create function pg_temp.create_zone(p_act uuid, p_user uuid, p_zone text, p_lng float8) returns jsonb language sql as $$
  select public.svc_apply_activity_result(jsonb_build_object(
    'mode', 'finish', 'activityId', p_act, 'userId', p_user, 'faction', 'striders',
    'status', 'valid', 'scored', true, 'meters', 400, 'movingSeconds', 120, 'avgPace', 300, 'rpTotal', 40, 'xp', 4,
    'flags', '[]'::jsonb, 'invalidSegments', '[]'::jsonb, 'trustAfter', 100, 'suspend', false,
    'zones', jsonb_build_array(jsonb_build_object('id', p_zone, 'expectedVersion', null, 'name', null,
              'geom', format('{"type":"Polygon","coordinates":[[[%s,50],[%s,50],[%s,50.002],[%s,50]]]}', p_lng, p_lng + 0.002, p_lng + 0.002, p_lng),
              'influence', '{"striders": 40, "coyotes": 0, "owls": 0, "volt": 0}'::jsonb, 'owner', 'striders', 'shield', 0,
              'attacker', null, 'attackStartedAt', null, 'blocked', false)),
    'activityZones', jsonb_build_array(jsonb_build_object('zoneId', p_zone, 'meters', 400, 'rp', 40, 'outcome', 'conquered',
              'ownerBefore', null, 'ownerAfter', 'striders')),
    'events', '[]'::jsonb, 'fogCells', '[]'::jsonb,
    'result', jsonb_build_object('status', 'valid', 'zones', jsonb_build_array(jsonb_build_object('zoneId', p_zone, 'name', 'Zona X', 'rp', 40)))))
$$;
select is(pg_temp.create_zone('aa111111-0000-4000-8000-000000000011', 'a1111111-0000-4000-8000-000000000001', '8b3333333333fff', 50.004)
            -> 'result' -> 'zones' -> 0 ->> 'name', 'Vila Teste 8', 'zona nova perto de "Vila Teste 7/3" vira "Vila Teste 8" na resposta');
select results_eq($$ select name, city from public.zones where id = '8b3333333333fff' $$, $$ values ('Vila Teste 8'::text, 'Cidade Teste'::text) $$,
  'nome e cidade gravados na zona');
select is((select result -> 'zones' -> 0 ->> 'name' from public.activities where id = 'aa111111-0000-4000-8000-000000000011'), 'Vila Teste 8',
  'resultado guardado (finalizar de novo) também traz o nome');
-- longe de tudo: base = cidade natal do corredor; sem cidade = "Zona"
select is(pg_temp.create_zone('aa111111-0000-4000-8000-000000000012', 'a1111111-0000-4000-8000-000000000003', '8b3333333334fff', 120.0)
            -> 'result' -> 'zones' -> 0 ->> 'name', 'Zona 1', 'sem vizinha e sem cidade natal → "Zona 1"');

select * from finish();
rollback;
