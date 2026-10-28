-- T7.3.8 (onda 3; pedido da E8) — weekly_recap(): números da semana (segunda a domingo, Brasília), days[7], sem
-- horário; svc_weekly_recap() só para a function weekly-recap (rotas candidatas e zonas de privacidade).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select ok(has_function_privilege('authenticated', 'public.weekly_recap(date)', 'execute')
          and not has_function_privilege('anon', 'public.weekly_recap(date)', 'execute'), 'weekly_recap: só quem está logado');
select ok(has_function_privilege('service_role', 'public.svc_weekly_recap(uuid, date)', 'execute')
          and not has_function_privilege('authenticated', 'public.svc_weekly_recap(uuid, date)', 'execute')
          and not has_function_privilege('anon', 'public.svc_weekly_recap(uuid, date)', 'execute'),
  'svc_weekly_recap: só o service role (a Edge Function)');

-- ---------------------------------------------------------------------------
-- Fixtures: A com 4 corridas que contam nesta semana + 1 rejeitada + 1 sem pontuação + 1 no domingo anterior; B com 1
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0026-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'r26' || c || '@t.com', json_build_object('username', 'r26_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c']) c;
update public.profiles set faction = 'owls', streak_weeks = 4 where id::text like 'e9e9e9e9-0026-%';

create temp table wk as select date_trunc('week', public.br_today())::date as d0;
grant select on wk to authenticated;
create function pg_temp.at_br(d date, t time) returns timestamptz language sql as $$ select (d + t) at time zone 'America/Sao_Paulo' $$;
create function pg_temp.run(n int, u text, st text, scored boolean, start timestamptz, m real, s real, seq int) returns void
language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, scored, last_seq)
  values (('e9e9e9e9-1026-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, ('e9e9e9e9-0026-4000-8000-00000000000' || u)::uuid,
          st, start, start + interval '40 minutes', start + interval '40 minutes', m, s, scored, seq)
$$;
select pg_temp.run(1, 'a', 'valid',    true,  pg_temp.at_br((select d0 from wk), '06:30'), 5000, 1800, 300);  -- segunda
select pg_temp.run(2, 'a', 'valid',    true,  pg_temp.at_br((select d0 from wk) + 1, '00:10'), 1000, 400, 80); -- terça (madrugada)
select pg_temp.run(3, 'a', 'partial',  true,  pg_temp.at_br((select d0 from wk) + 2, '19:00'), 3200, 1000, 200); -- quarta
select pg_temp.run(4, 'a', 'valid',    true,  pg_temp.at_br((select d0 from wk) + 4, '07:00'), 600, 300, 0);  -- sexta, 1 ponto só
select pg_temp.run(5, 'a', 'rejected', true,  pg_temp.at_br((select d0 from wk) + 2, '08:00'), 9000, 2000, 300);
select pg_temp.run(6, 'a', 'valid',    false, pg_temp.at_br((select d0 from wk) + 3, '08:00'), 7000, 2000, 300);
select pg_temp.run(7, 'a', 'valid',    true,  pg_temp.at_br((select d0 from wk) - 1, '23:30'), 4000, 1500, 300); -- domingo anterior
select pg_temp.run(8, 'b', 'valid',    true,  pg_temp.at_br((select d0 from wk) + 1, '07:00'), 2500, 900, 150);

insert into public.zones (id, geom) values
  ('89a90128e0fffff', extensions.st_makeenvelope(0, 0, 1, 1, 4326)),
  ('89a90128e3bffff', extensions.st_makeenvelope(1, 1, 2, 2, 4326))
on conflict (id) do nothing;
insert into public.zone_events (zone_id, type, faction, user_id, created_at) values
  ('89a90128e0fffff', 'captured', 'owls', 'e9e9e9e9-0026-4000-8000-00000000000a', pg_temp.at_br((select d0 from wk), '07:00')),
  ('89a90128e0fffff', 'captured', 'owls', 'e9e9e9e9-0026-4000-8000-00000000000a', pg_temp.at_br((select d0 from wk) + 2, '19:30')),
  ('89a90128e3bffff', 'captured', 'owls', 'e9e9e9e9-0026-4000-8000-00000000000a', pg_temp.at_br((select d0 from wk) + 2, '19:40')),
  ('89a90128e3bffff', 'defended', 'owls', 'e9e9e9e9-0026-4000-8000-00000000000a', pg_temp.at_br((select d0 from wk) + 2, '19:50')),
  ('89a90128e3bffff', 'captured', 'owls', 'e9e9e9e9-0026-4000-8000-00000000000a', pg_temp.at_br((select d0 from wk) - 1, '23:50'));
insert into public.privacy_zones (user_id, lat, lng, radius_m) values ('e9e9e9e9-0026-4000-8000-00000000000a', -16.68, -49.25, 200);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ---------------------------------------------------------------------------
-- weekly_recap() da própria pessoa
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0026-4000-8000-00000000000a');
create temp table ra as select public.weekly_recap() as r;
grant select on ra to authenticated;
select is((select r -> 'days' from ra), '[5000, 1000, 3200, 0, 600, 0, 0]'::jsonb,
  'days[7]: metros por dia, segunda primeiro (madrugada de terça conta na terça; rejeitada e sem pontuação não contam)');
select results_eq($$ select (r ->> 'runs')::int, (r ->> 'meters')::int, (r ->> 'movingSeconds')::int, (r ->> 'zones')::int,
                            (r ->> 'streakWeeks')::int from ra $$,
  $$ values (4, 9800, 3500, 2, 4) $$, 'corridas, metros, tempo em movimento, zonas conquistadas (distintas) e sequência');
select results_eq($$ select r ->> 'weekStart', r ->> 'weekEnd', (r ->> 'final')::boolean, (r ->> 'isDemo')::boolean, r -> 'routes' from ra $$,
  $$ select (select d0 from wk)::text, ((select d0 from wk) + 6)::text, false, false, '[]'::jsonb $$,
  'semana atual: segunda e domingo, ainda aberta, sem rotas pela RPC (as rotas vêm da function)');
select is((select array_agg(k order by k) from ra, jsonb_object_keys(r) k),
  array['days', 'final', 'isDemo', 'meters', 'movingSeconds', 'routes', 'runs', 'streakWeeks', 'weekEnd', 'weekStart', 'zones'],
  'só as chaves do contrato (nada de ids de corrida nem de zonas de privacidade)');
select ok((select r::text !~ '(T\d\d:|\d\d:\d\d|_at|started|ended|lat|lng|e9e9e9e9)' from ra), 'sem horário, coordenada ou id no resumo');
select is((select public.weekly_recap((select d0 from wk) - 7) -> 'days'), '[0, 0, 0, 0, 0, 0, 4000]'::jsonb,
  'semana anterior: a corrida de domingo 23:30 fica no domingo dela');
select results_eq($$ select (r ->> 'runs')::int, (r ->> 'zones')::int, (r ->> 'final')::boolean
                       from (select public.weekly_recap((select d0 from wk) - 7) as r) x $$,
  $$ values (1, 1, true) $$, 'semana anterior: 1 corrida, 1 zona, fechada');
select throws_like($$ select public.weekly_recap((select d0 from wk) + 1) $$, '%VALIDATION%', 'weekStart que não é segunda: VALIDATION');
select throws_like($$ select public.weekly_recap((select d0 from wk) + 7) $$, '%VALIDATION%', 'semana futura: VALIDATION');
select throws_like($$ select public.weekly_recap((select d0 from wk) - 7 * 53) $$, '%VALIDATION%', 'mais de 52 semanas atrás: VALIDATION');
reset role;

select pg_temp.login('e9e9e9e9-0026-4000-8000-00000000000b');
select results_eq($$ select (r ->> 'runs')::int, (r ->> 'meters')::int, (r ->> 'zones')::int, r -> 'days'
                       from (select public.weekly_recap() as r) x $$,
  $$ values (1, 2500, 0, '[0, 2500, 0, 0, 0, 0, 0]'::jsonb) $$, 'B vê só as próprias corridas');
reset role;
select pg_temp.login('e9e9e9e9-0026-4000-8000-00000000000c');
select results_eq($$ select (r ->> 'runs')::int, (r ->> 'meters')::int, r -> 'days' from (select public.weekly_recap() as r) x $$,
  $$ values (0, 0, '[0, 0, 0, 0, 0, 0, 0]'::jsonb) $$, 'semana vazia: zeros (days sempre com 7)');
reset role;
select set_config('request.jwt.claims', '', true);
select throws_like($$ select public.weekly_recap() $$, '%UNAUTHORIZED%', 'sem login: UNAUTHORIZED');

-- ---------------------------------------------------------------------------
-- svc_weekly_recap (Edge Function)
-- ---------------------------------------------------------------------------
create temp table sv as select public.svc_weekly_recap('e9e9e9e9-0026-4000-8000-00000000000a', null) as r;
select is((select r -> 'routeIds' from sv),
  '["e9e9e9e9-1026-4000-8000-000000000001", "e9e9e9e9-1026-4000-8000-000000000003", "e9e9e9e9-1026-4000-8000-000000000002"]'::jsonb,
  'rotas candidatas: até 3, as mais longas que contam e têm ao menos 2 pontos');
select is((select r -> 'privacyZones' from sv), '[{"lat": -16.68, "lng": -49.25, "radiusM": 200}]'::jsonb,
  'zonas de privacidade da pessoa, para o corte na function');
select is((select (r - 'routeIds' - 'privacyZones' - 'routes') from sv),
  (select r - 'routes' from ra), 'mesmos números da RPC da pessoa');
update public.profiles set status = 'inactive' where id = 'e9e9e9e9-0026-4000-8000-00000000000c';
select throws_like($$ select public.svc_weekly_recap('e9e9e9e9-0026-4000-8000-00000000000c', null) $$, '%ACCOUNT_INACTIVE%',
  'conta inativa: a function recusa');

select * from finish();
rollback;
