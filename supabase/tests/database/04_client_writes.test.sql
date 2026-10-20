-- T1.3 — cliente não escreve em zonas/atividades; colunas sensíveis do perfil são protegidas (D-07, RNF-006)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'w@t.com',
   '{"username": "writer", "birthdate": "1995-01-01", "terms_accepted": true, "city": "Goiânia"}');
insert into public.zones (id, geom) values ('891f1d48177ffff', extensions.st_geomfromtext('POLYGON((-49.24 -16.71, -49.23 -16.71, -49.23 -16.70, -49.24 -16.71))', 4326));
insert into public.notifications (user_id, type, title, body) values ('44444444-4444-4444-8444-444444444444', 'system', 'Olá', 'teste');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
select pg_temp.login('44444444-4444-4444-8444-444444444444');

-- zonas e atividades: só o servidor escreve
select throws_ok($$ update public.zones set owner = 'volt' where id = '891f1d48177ffff' $$, '42501', null, 'cliente não altera zones');
select throws_ok($$ insert into public.zones (id, geom) values ('891f1d48173ffff', extensions.st_geomfromtext('POLYGON((0 0, 1 0, 1 1, 0 0))', 4326)) $$, '42501', null, 'cliente não cria zones');
select throws_ok($$ insert into public.activities (id, user_id, started_at) values (gen_random_uuid(), '44444444-4444-4444-8444-444444444444', now()) $$,
  '42501', null, 'cliente não cria activities');
select throws_ok($$ insert into public.activity_points (activity_id, seq, lat, lng, t) values (gen_random_uuid(), 0, 0, 0, 0) $$,
  '42501', null, 'cliente não grava pontos direto (só via ingest-points)');
select throws_ok($$ insert into public.zone_events (zone_id, type) values ('891f1d48177ffff', 'captured') $$, '42501', null, 'cliente não cria zone_events');
select throws_ok($$ insert into public.notifications (user_id, type, title, body) values ('44444444-4444-4444-8444-444444444444', 'system', 'x', 'y') $$,
  '42501', null, 'cliente não cria notificações');
select throws_ok($$ insert into public.fog_cells (user_id, cell) values ('44444444-4444-4444-8444-444444444444', '8aa8c0ce2c37fff') $$,
  '42501', null, 'cliente não grava neblina direto');

-- perfil: campos sensíveis protegidos
select throws_ok($$ update public.profiles set role = 'admin' $$, '42501', null, 'cliente não muda o próprio role');
select throws_ok($$ update public.profiles set trust = 100 $$, '42501', null, 'cliente não muda o próprio trust');
select throws_ok($$ update public.profiles set status = 'active' $$, '42501', null, 'cliente não muda o próprio status');
select throws_ok($$ update public.profiles set xp = 99999 $$, '42501', null, 'cliente não muda o próprio xp');
select throws_ok($$ update public.profiles set faction = 'volt' $$, '42501', null, 'facção só pela RPC choose_faction');

select lives_ok($$ update public.profiles set username = 'writer_2', units = 'mi', notification_prefs = '{"invasion": false}' $$,
  'cliente edita username, unidade e preferências de notificação (RF-002)');
select lives_ok($$ update public.profiles set city = 'Anápolis' $$, 'primeira troca de cidade na temporada é aceita');
select throws_like($$ update public.profiles set city = 'Brasília' $$, '%CITY_CHANGE_LIMIT%', 'segunda troca de cidade na mesma temporada é recusada (RN-013)');

select lives_ok($$ update public.notifications set read_at = now() $$, 'cliente marca as próprias notificações como lidas');

select * from finish();
rollback;
