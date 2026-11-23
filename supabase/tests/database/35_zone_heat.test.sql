-- RF-013 — mapa de calor: contagem por zona, sem dado pessoal; corrida só com 2+ corredores; troca de dono sempre;
-- período (24 h, 7 dias, temporada); só logado; área limitada.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0035-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       's35' || c || '@t.com', json_build_object('username', 's35_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b']) c;
update public.profiles set faction = 'owls' where id::text like 'e9e9e9e9-0035-%';

-- zona Z1: A e B correram (2 corredores); Z2: só A correu, mas trocou de dono; Z3: só A, sem troca (não aparece)
insert into public.zones (id, geom) values
  ('8935a0a0a0a0fff', extensions.st_geomfromtext('POLYGON((-49.24 -16.71, -49.23 -16.71, -49.23 -16.70, -49.24 -16.71))', 4326)),
  ('8935a0a0a0a1fff', extensions.st_geomfromtext('POLYGON((-49.22 -16.71, -49.21 -16.71, -49.21 -16.70, -49.22 -16.71))', 4326)),
  ('8935a0a0a0a2fff', extensions.st_geomfromtext('POLYGON((-49.20 -16.71, -49.19 -16.71, -49.19 -16.70, -49.20 -16.71))', 4326));
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
select ('e9e9e9e9-1035-4000-8000-00000000000' || n)::uuid,
       case when n in (1, 3, 4) then 'e9e9e9e9-0035-4000-8000-00000000000a' else 'e9e9e9e9-0035-4000-8000-00000000000b' end::uuid,
       'valid', now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours', 3000, 900, 300, true
  from generate_series(1, 4) n;
insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome, owner_before, owner_after, created_at) values
  ('e9e9e9e9-1035-4000-8000-000000000001', '8935a0a0a0a0fff', 'e9e9e9e9-0035-4000-8000-00000000000a', 'owls', 500, 50, 'influence', 'volt', 'volt', now() - interval '2 hours'),
  ('e9e9e9e9-1035-4000-8000-000000000002', '8935a0a0a0a0fff', 'e9e9e9e9-0035-4000-8000-00000000000b', 'owls', 500, 50, 'influence', 'volt', 'volt', now() - interval '2 days'),
  ('e9e9e9e9-1035-4000-8000-000000000003', '8935a0a0a0a1fff', 'e9e9e9e9-0035-4000-8000-00000000000a', 'owls', 500, 50, 'conquered', 'volt', 'owls', now() - interval '2 hours'),
  ('e9e9e9e9-1035-4000-8000-000000000004', '8935a0a0a0a2fff', 'e9e9e9e9-0035-4000-8000-00000000000a', 'owls', 500, 50, 'influence', null, null, now() - interval '2 hours');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select ok(not has_function_privilege('anon', 'public.zone_heat_json(double precision, double precision, double precision, double precision, text)', 'execute'),
  'anon não chama o mapa de calor');

select pg_temp.login('e9e9e9e9-0035-4000-8000-00000000000a');

select is(public.zone_heat_json(-49.25, -16.72, -49.18, -16.69, '7d'),
  '[{"id": "8935a0a0a0a0fff", "runs": 2, "flips": 0}, {"id": "8935a0a0a0a1fff", "runs": 0, "flips": 1}]'::jsonb,
  '7 dias: Z1 com 2 corridas (2 corredores), Z2 só com a troca de dono; Z3 (1 corredor, sem troca) fica de fora');
select is(public.zone_heat_json(-49.25, -16.72, -49.18, -16.69, '24h'),
  '[{"id": "8935a0a0a0a1fff", "runs": 0, "flips": 1}]'::jsonb,
  '24 horas: em Z1 só A correu no período (1 corredor), então a corrida não aparece');
select is(jsonb_array_length(public.zone_heat_json(-49.25, -16.72, -49.18, -16.69, 'season')) >= 1, true, 'temporada aceita');
select is(public.zone_heat_json(-49.205, -16.72, -49.18, -16.69, '7d'), '[]'::jsonb, 'só as zonas da área pedida (aqui só Z3, que não tem calor)');
select ok(public.zone_heat_json(-49.25, -16.72, -49.18, -16.69, '7d')::text !~ 'e9e9e9e9', 'a resposta não tem id de pessoa nem de corrida');
select throws_like($$ select public.zone_heat_json(-49.25, -16.72, -49.18, -16.69, '1y') $$, 'INVALID_PERIOD%', 'período desconhecido é recusado');
select throws_like($$ select public.zone_heat_json(-60, -20, -40, -10, '7d') $$, 'INVALID_BBOX%', 'área grande demais é recusada');

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_like($$ select public.zone_heat_json(-49.25, -16.72, -49.18, -16.69, '7d') $$, 'UNAUTHORIZED%', 'sem login não lê');

select * from finish();
rollback;
