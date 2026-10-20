-- T3.6 — jobs: decaimento (RN-005), escudo (RN-004), sequência semanal (RN-014), virada de temporada (RN-006);
-- T1.1 — views de ranking (RF-015) e placar entre cidades (RN-013).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- isola dos dados de demonstração
delete from public.zones;

create function pg_temp.poly(dx float8) returns extensions.geometry language sql as $$
  select extensions.st_setsrid(extensions.st_makepolygon(extensions.st_makeline(array[
    extensions.st_makepoint(dx, 0), extensions.st_makepoint(dx + 0.001, 0), extensions.st_makepoint(dx + 0.001, 0.001), extensions.st_makepoint(dx, 0)])), 4326)
$$;

-- ---------------------------------------------------------------- RN-005
insert into public.zones (id, geom, influence, owner, shield, attacker, attack_started_at) values
  ('891f1d48100ffff', pg_temp.poly(0), '{"striders": 100, "coyotes": 5.4, "owls": 0, "volt": 0}', 'striders', 2, null, null),
  ('891f1d48101ffff', pg_temp.poly(1), '{"striders": 32, "coyotes": 20, "owls": 0, "volt": 0}', 'striders', 1, 'coyotes', now()),
  ('891f1d48102ffff', pg_temp.poly(2), '{"striders": 0, "coyotes": 0, "owls": 0, "volt": 0}', null, 0, null, null);

select is(public.job_decay_zones(), 2, 'decaimento atinge só zonas com influência');
select results_eq($$ select (influence ->> 'striders')::numeric, (influence ->> 'coyotes')::numeric, owner, shield::int from public.zones where id = '891f1d48100ffff' $$,
  $$ values (90::numeric, 0::numeric, 'striders'::text, 2) $$, 'influência × 0,90 e valores abaixo de 5 zerados');
select results_eq($$ select owner, shield::int, attacker, attack_started_at from public.zones where id = '891f1d48101ffff' $$,
  $$ values (null::text, 0, null::text, null::timestamptz) $$, 'dono abaixo de 30 perde a zona (volta a ser neutra)');
select is((select count(*)::int from public.zone_events where zone_id = '891f1d48101ffff' and type = 'neutralized' and from_faction = 'striders'), 1,
  'evento "neutralized" registrado');
select is((select version from public.zones where id = '891f1d48102ffff'), 0, 'zona sem influência não é tocada');

-- ---------------------------------------------------------------- RN-004
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'j1@t.com',
   '{"username": "jobs_1", "birthdate": "1995-01-01", "terms_accepted": true, "city": "Goiânia"}'),
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'j2@t.com',
   '{"username": "jobs_2", "birthdate": "1995-01-01", "terms_accepted": true, "city": "Goiânia"}'),
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'j3@t.com',
   '{"username": "jobs_3", "birthdate": "1995-01-01", "terms_accepted": true}');
update public.profiles set faction = 'striders' where id::text like '77777777-%';

insert into public.zones (id, geom, influence, owner, shield) values
  ('891f1d48110ffff', pg_temp.poly(10), '{"striders": 300, "coyotes": 0, "owls": 0, "volt": 0}', 'striders', 1),
  ('891f1d48111ffff', pg_temp.poly(11), '{"striders": 300, "coyotes": 0, "owls": 0, "volt": 0}', 'striders', 2),
  ('891f1d48112ffff', pg_temp.poly(12), '{"striders": 300, "coyotes": 0, "owls": 0, "volt": 0}', 'striders', 2),
  ('891f1d48113ffff', pg_temp.poly(13), '{"striders": 300, "coyotes": 0, "owls": 0, "volt": 0}', 'striders', 3);
insert into public.activities (id, user_id, started_at, status, scored, finished_at, avg_pace) values
  ('a7777777-0000-4000-8000-000000000001', '77777777-0000-4000-8000-000000000001', now() - interval '1 day', 'valid', true, public.br_day_start() - interval '12 hours', 330),
  ('a7777777-0000-4000-8000-000000000002', '77777777-0000-4000-8000-000000000001', now() - interval '1 day', 'valid', true, public.br_day_start() - interval '11 hours', 320);
insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome, created_at) values
  ('a7777777-0000-4000-8000-000000000001', '891f1d48110ffff', '77777777-0000-4000-8000-000000000001', 'striders', 600, 60, 'influence', public.br_day_start() - interval '12 hours'),
  ('a7777777-0000-4000-8000-000000000001', '891f1d48112ffff', '77777777-0000-4000-8000-000000000001', 'striders', 200, 20, 'influence', public.br_day_start() - interval '12 hours'),
  ('a7777777-0000-4000-8000-000000000002', '891f1d48113ffff', '77777777-0000-4000-8000-000000000001', 'striders', 700, 70, 'influence', public.br_day_start() - interval '11 hours');

select is(public.job_fortify_zones(), 3, 'escudo muda em 3 zonas (sobe numa, desce em duas sem corrida do dono)');
select is((select shield::int from public.zones where id = '891f1d48110ffff'), 2, '≥ 500 m do dono no dia: escudo +1');
select is((select shield::int from public.zones where id = '891f1d48111ffff'), 1, 'dia sem corrida do dono: escudo −1');
select is((select shield::int from public.zones where id = '891f1d48112ffff'), 2, 'menos de 500 m: escudo igual');
select is((select shield::int from public.zones where id = '891f1d48113ffff'), 3, 'escudo não passa de 3');

-- ---------------------------------------------------------------- RN-014
update public.profiles set streak_weeks = 3, freezes_left = 1 where id = '77777777-0000-4000-8000-000000000002';
update public.profiles set streak_weeks = 3, freezes_left = 0 where id = '77777777-0000-4000-8000-000000000003';
select lives_ok($$ select public.job_close_week((date_trunc('week', public.br_now() - interval '1 day'))::date) $$, 'fecha a semana');
select results_eq(
  $$ select streak_weeks::int, freezes_left::int from public.profiles where id::text like '77777777-%' order by id $$,
  $$ values (1, 1), (3, 0), (0, 0) $$,
  'semana com 2 corridas soma 1; sem corridas gasta congelamento; sem congelamento zera');

-- ---------------------------------------------------------------- rankings (RF-015, RN-013)
select is((select rp from public.leaderboard_individual where username = 'jobs_1'), 150, 'ranking individual soma os RP da temporada');
select is((select rp from public.leaderboard_factions where faction = 'striders'), 150, 'ranking de facções soma os RP da temporada');
select is((select zones from public.leaderboard_factions where faction = 'striders'), 5, 'ranking de facções conta zonas dominadas');
select results_eq($$ select active_runners, eligible, score from public.leaderboard_cities where city = 'Goiânia' $$,
  $$ values (1, false, null::numeric) $$, 'cidade com menos de 20 corredores ativos não pontua (RN-013)');

update public.profiles set contribution_reset_at = now() where id = '77777777-0000-4000-8000-000000000001';
select is((select count(*)::int from public.leaderboard_individual where username = 'jobs_1'), 0, 'troca de facção zera a contribuição na temporada (RF-003)');

-- ---------------------------------------------------------------- RN-006
select is(public.job_season_rollover(), public.current_season_id(), 'virada não repete na mesma temporada');
delete from public.seasons where id = public.current_season_id();
select is(public.job_season_rollover(), public.current_season_id(), 'virada abre a temporada atual');
select is((select (influence ->> 'striders')::numeric from public.zones where id = '891f1d48110ffff'), 90::numeric, 'virada multiplica a influência por 0,30');

select * from finish();
rollback;
