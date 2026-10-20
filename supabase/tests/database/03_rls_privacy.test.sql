-- T1.3 — RNF-007: cada usuário só acessa os próprios dados privados; staff lê corridas para moderar
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Fixtures (como postgres)
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'a@t.com',
   '{"username": "user_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'b@t.com',
   '{"username": "user_b", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'm@t.com',
   '{"username": "mod_m", "birthdate": "1990-01-01", "terms_accepted": true}');
update public.profiles set faction = 'striders' where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
update public.profiles set role = 'moderator' where id = '33333333-3333-4333-8333-333333333333';

insert into public.devices (id, user_id, secret, platform) values
  ('d0000000-0000-4000-8000-00000000000b', '22222222-2222-4222-8222-222222222222', extensions.gen_random_bytes(32), 'ios');
insert into public.activities (id, user_id, device_id, started_at, status) values
  ('a0000000-0000-4000-8000-00000000000b', '22222222-2222-4222-8222-222222222222', 'd0000000-0000-4000-8000-00000000000b', now(), 'valid');
insert into public.activity_points (activity_id, seq, lat, lng, t) values
  ('a0000000-0000-4000-8000-00000000000b', 0, -16.7, -49.2, 1760000000000);
insert into public.zones (id, geom) values ('891f1d48177ffff', extensions.st_geomfromtext('POLYGON((-49.24 -16.71, -49.23 -16.71, -49.23 -16.70, -49.24 -16.71))', 4326));
insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome) values
  ('a0000000-0000-4000-8000-00000000000b', '891f1d48177ffff', '22222222-2222-4222-8222-222222222222', 'striders', 500, 50, 'influence');
insert into public.zone_events (zone_id, type, faction, user_id, activity_id) values
  ('891f1d48177ffff', 'captured', 'striders', '22222222-2222-4222-8222-222222222222', 'a0000000-0000-4000-8000-00000000000b');
insert into public.safety_contacts (user_id, name, phone) values ('22222222-2222-4222-8222-222222222222', 'Mãe', '+55 62 99999-0000');
insert into public.notifications (user_id, type, title, body) values ('22222222-2222-4222-8222-222222222222', 'system', 'Oi', 'B');
insert into public.fog_cells (user_id, cell) values ('22222222-2222-4222-8222-222222222222', '8aa8c0ce2c37fff');
insert into public.chest_opens (user_id, chest_id, rarity, xp) values ('22222222-2222-4222-8222-222222222222', 'chest-1', 'comum', 20);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Usuário A olhando os dados de B
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is((select count(*)::int from public.activities), 0, 'A não vê corridas de B');
select is((select count(*)::int from public.activity_points), 0, 'A não vê pontos GPS de B');
select is((select count(*)::int from public.activity_zones), 0, 'A não vê a pontuação por zona de B');
select is((select count(*)::int from public.safety_contacts), 0, 'A não vê contatos de segurança de B');
select is((select count(*)::int from public.notifications), 0, 'A não vê notificações de B');
select is((select count(*)::int from public.fog_cells), 0, 'A não vê a neblina de B');
select is((select count(*)::int from public.chest_opens), 0, 'A não vê os baús de B');
select is((select count(*)::int from public.devices), 0, 'A não vê aparelhos de B');
select is((select array_agg(username order by username) from public.profiles), array['user_a'], 'A lê só o próprio perfil');
select is((select count(*)::int from public.public_profiles where username = 'user_b'), 1, 'A vê B pelo perfil público');
select is((select count(*)::int from public.zones where id = '891f1d48177ffff'), 1, 'zonas são públicas para usuários logados');
select is((select count(*)::int from public.zone_events where zone_id = '891f1d48177ffff'), 1, 'eventos de zona são públicos');
select throws_ok($$ select user_id from public.zone_events $$, '42501', null, 'zone_events.user_id não é exposto (privacidade de percurso)');
select is(public.mark_notifications_read(null), 0, 'A não marca notificações de B como lidas');

-- B vê os próprios dados
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from public.activity_points), 1, 'B vê os próprios pontos');
select throws_ok($$ select secret from public.devices $$, '42501', null, 'nem o dono lê devices.secret');

-- Moderador lê corridas e pontos para revisar (RF-018)
select pg_temp.login('33333333-3333-4333-8333-333333333333');
select is((select count(*)::int from public.activities where id = 'a0000000-0000-4000-8000-00000000000b'), 1, 'moderador vê corridas de outros');
select is((select count(*)::int from public.safety_contacts), 0, 'moderador não vê contatos de segurança');

-- anon não lê nada
reset role;
select set_config('role', 'anon', true);
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'anon não lê perfis');

select * from finish();
rollback;
