-- Ajustes finais (revisor-onda4-logica.md B1 e B2; D-88 meta da crew): cada caso reproduz a falha e confere a correção.
-- B1 duas gravações v2 da mesma pessoa ao mesmo tempo (2 sessões, dblink) · B2 paintedToday perto de casa ·
-- D-88 crew_week_goal().
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(14);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ---------------------------------------------------------------------------
-- B1 (primeiro: as sessões extras não podem esperar travas desta transação). Duas corridas da mesma pessoa terminam
-- juntas: as duas functions montam o plano com o mesmo contexto (sem a outra corrida) e gravam ao mesmo tempo.
-- Antes: as duas pagavam o +30 de corrida completa do dia. Agora: a 2ª espera a 1ª (perfil travado), vê o carimbo
-- velho e recebe ZONE_CONFLICT; a function repete com um contexto novo, que já conta a 1ª corrida.
-- ---------------------------------------------------------------------------
create temp table f0 as select value from public.game_config where key = 'features';
create temp table cs as select format('dbname=%s port=%s host=%s user=%s', current_database(), current_setting('port'),
                                      split_part(current_setting('unix_socket_directories'), ',', 1), current_user) as s;
select dblink_connect('f1a', (select s from cs));
select dblink_connect('f1b', (select s from cs));
select dblink_exec('f1a', $q$insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0030-4000-8000-0000000000b1', 'authenticated', 'authenticated',
          'v30b1@t.com', '{"username": "v30_b1", "birthdate": "1995-01-01", "terms_accepted": true}')$q$);
select dblink_exec('f1a', $q$update public.profiles set faction = 'striders' where id = 'e9e9e9e9-0030-4000-8000-0000000000b1'$q$);
select dblink_exec('f1a', $q$update public.game_config set value = value || '{"missions": true}' where key = 'features'$q$);
select dblink_exec('f1a', $q$insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters,
                                                             moving_seconds, avg_pace, scored, result)
  select ('e9e9e9e9-1030-4000-8000-00000000000' || n)::uuid, 'e9e9e9e9-0030-4000-8000-0000000000b1', 'valid',
         now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', 5000, 1500, 300, true,
         '{"xp": 0, "zones": []}'
    from generate_series(1, 3) n$q$);
create temp table ctx as
  select (select c::jsonb from dblink('f1a', $q$select public.svc_v2_context('e9e9e9e9-0030-4000-8000-0000000000b1',
                                                 'e9e9e9e9-1030-4000-8000-000000000001')::text$q$) as t(c text)) as c1,
         (select c::jsonb from dblink('f1a', $q$select public.svc_v2_context('e9e9e9e9-0030-4000-8000-0000000000b1',
                                                 'e9e9e9e9-1030-4000-8000-000000000002')::text$q$) as t(c text)) as c2;
select ok((select jsonb_typeof(c1 -> 'stamp') = 'number' and c1 -> 'stamp' = c2 -> 'stamp'
                  and not (c1 #>> '{engagement,xpDay,completed}')::boolean and not (c2 #>> '{engagement,xpDay,completed}')::boolean
             from ctx),
  'B1: os dois contextos saem com o mesmo carimbo e nenhum vê a outra corrida completa');
create function pg_temp.plan(n integer, stamp jsonb, complete boolean) returns text language sql as $$
  select (jsonb_build_object(
    'activityId', 'e9e9e9e9-1030-4000-8000-00000000000' || n, 'userId', 'e9e9e9e9-0030-4000-8000-0000000000b1',
    'faction', 'striders', 'nowMs', (extract(epoch from now()) * 1000)::bigint,
    'paint', null, 'points', null, 'raid', null, 'weekKept', null, 'missionProgress', '{}'::jsonb, 'records', null, 'feed', null,
    'xpLines', case when complete then '[{"source": "run_distance", "amount": 50}, {"source": "run_complete", "amount": 30}]'::jsonb
                    else '[{"source": "run_distance", "amount": 50}]'::jsonb end)
    || case when stamp is null then '{}'::jsonb else jsonb_build_object('stamp', stamp) end
  )::text
$$;
-- sessão A: grava a corrida 1 (sem commit, perfil travado)
select dblink_exec('f1a', 'begin');
select x from dblink('f1a', format('select public.svc_apply_v2(%L::jsonb)::text',
                                    pg_temp.plan(1, (select c1 -> 'stamp' from ctx), true))) as t(x text);
-- sessão B: grava a corrida 2 com o plano do mesmo instante (também paga o +30)
select dblink_send_query('f1b', format('select public.svc_apply_v2(%L::jsonb)::text',
                                        pg_temp.plan(2, (select c2 -> 'stamp' from ctx), true)));
select pg_sleep(0.5);
select is(dblink_is_busy('f1b'), 1, 'B1: a 2ª gravação da mesma pessoa espera a 1ª terminar (perfil travado)');
select dblink_exec('f1a', 'commit');
select * from dblink_get_result('f1b', false) as t(r text);
select * from dblink_get_result('f1b', false) as t(r text);
select ok(dblink_error_message('f1b') like '%ZONE_CONFLICT%',
  'B1: o plano com o carimbo velho é recusado com ZONE_CONFLICT (antes: gravava e pagava o +30 de novo)');
-- a function repete: contexto novo (carimbo + 1, a corrida completa do dia já foi paga) e plano sem o +30
create temp table ctx2 as
  select (select c::jsonb from dblink('f1a', $q$select public.svc_v2_context('e9e9e9e9-0030-4000-8000-0000000000b1',
                                                 'e9e9e9e9-1030-4000-8000-000000000002')::text$q$) as t(c text)) as c;
select ok((select (c ->> 'stamp')::int = (select (c1 ->> 'stamp')::int + 1 from ctx) and (c #>> '{engagement,xpDay,completed}')::boolean
             from ctx2),
  'B1: o contexto da repetição tem o carimbo novo e já vê a corrida completa do dia');
select is((select (x::jsonb ->> 'repeated') from dblink('f1a', format('select public.svc_apply_v2(%L::jsonb)::text',
                                                  pg_temp.plan(2, (select c -> 'stamp' from ctx2), false))) as t(x text)),
  'false', 'B1: a repetição com o carimbo novo grava');
select is((select array_agg(source || ':' || amount order by source, amount)
             from dblink('f1a', $q$select source, amount from public.xp_ledger
                                  where user_id = 'e9e9e9e9-0030-4000-8000-0000000000b1'
                                    and source in ('run_distance', 'run_complete')$q$) as t(source text, amount int)),
  array['run_complete:30', 'run_distance:50', 'run_distance:50'],
  'B1: o +30 de corrida completa foi pago 1 vez no dia (antes: 2)');
-- compatibilidade: plano sem carimbo (function antiga) continua aceito
select is((select (x::jsonb ->> 'repeated') from dblink('f1a', format('select public.svc_apply_v2(%L::jsonb)::text',
                                                  pg_temp.plan(3, null, false))) as t(x text)),
  'false', 'B1: plano sem stamp (function antiga) segue gravando como antes');
-- limpeza das linhas confirmadas pelas sessões
select dblink_exec('f1a', $q$delete from auth.users where id = 'e9e9e9e9-0030-4000-8000-0000000000b1'$q$);
select dblink_exec('f1a', format('update public.game_config set value = %L::jsonb where key = %L', (select value from f0), 'features'));
select dblink_disconnect('f1a');
select dblink_disconnect('f1b');

-- ---------------------------------------------------------------------------
-- Fixtures: A e B (striders, crew de A), C (sem crew)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0030-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'v30' || c || '@t.com', json_build_object('username', 'v30_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c']) c;
update public.profiles set faction = 'striders' where id::text like 'e9e9e9e9-0030-%';

-- ---------------------------------------------------------------------------
-- B2: o trecho que A pintou dentro da própria zona de privacidade entra no paintedToday de A
-- ---------------------------------------------------------------------------
insert into public.zones (id, name, city, geom, owner, influence) values
  ('89a90128e3bffff', 'Zona POA 1', 'Porto Alegre', extensions.st_setsrid(extensions.st_geomfromgeojson(
    '{"type":"Polygon","coordinates":[[[-51.2173721778165,-30.036324475878015],[-51.21630560724396,-30.0350282146007],[-51.217260040920266,-30.033559365310325],[-51.21928102307092,-30.03338679177478],[-51.22034758026746,-30.034683058704122],[-51.219393168690495,-30.036151893517015],[-51.2173721778165,-30.036324475878015]]]}'), 4326),
   null, '{"striders": 0, "coyotes": 0, "owls": 0, "volt": 0}')
on conflict (id) do nothing;
insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng) values
  ('8ba90128e382fff', '89a90128e3bffff', 'coyotes', 1, now(), -30.034695123668254, -51.21788552638041),
  ('8ba90128e383fff', '89a90128e3bffff', 'striders', 1, now(), -30.034460634923736, -51.21831058523841)
on conflict (cell) do nothing;
-- zona de privacidade de A cobrindo o trecho …383 (a máscara sorteada cobre a zona inteira)
insert into public.privacy_zones (user_id, lat, lng, radius_m)
values ('e9e9e9e9-0030-4000-8000-00000000000a', -30.0341006, -51.21831058523841, 50);
insert into public.paint_marks (user_id, day, cell) values
  ('e9e9e9e9-0030-4000-8000-00000000000a', public.br_today(), '8ba90128e383fff'),
  ('e9e9e9e9-0030-4000-8000-00000000000b', public.br_today(), '8ba90128e382fff');

select pg_temp.login('e9e9e9e9-0030-4000-8000-00000000000a');
create temp table pa as select public.zone_paint_near(-30.0346, -51.2177, 1500) as s;
select ok((select s -> 'paintedToday' ? '8ba90128e383fff' from pa),
  'B2: A recebe o próprio trecho pintado perto de casa (antes: sumia e o HUD previa uma 2ª camada)');
select ok((select not (s -> 'cells' ? '8ba90128e383fff') from pa),
  'B2: o retrato (cells) continua cortado pela máscara da zona de privacidade');
reset role;
select pg_temp.login('e9e9e9e9-0030-4000-8000-00000000000b');
select ok((select s -> 'paintedToday' = '["8ba90128e382fff"]'::jsonb and not (s -> 'cells' ? '8ba90128e383fff')
             from (select public.zone_paint_near(-30.0346, -51.2177, 1500) as s) x),
  'B2: B não recebe o trecho de A (só os próprios) nem o vê no retrato');
reset role;

-- ---------------------------------------------------------------------------
-- D-88: meta semanal de km da crew
-- ---------------------------------------------------------------------------
select results_eq($$ select private.crew_week_goal_m(n) from unnest(array[-5, 0, 1, 2, 3, 12, 30, 31]) n $$,
  $$ values (20000), (20000), (20000), (20000), (30000), (120000), (300000), (300000) $$,
  'D-88: 10 km por membro, piso 20 km, teto 300 km (mesma conta de crewWeekGoalMeters)');
-- o trigger da crew usa auth.uid() como líder: as claims da transação passam a ser as de A
select pg_temp.login('e9e9e9e9-0030-4000-8000-00000000000a');
reset role;
insert into public.crews (name, tag, leader_id) values ('Crew Meta', 'METAX', 'e9e9e9e9-0030-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0030-4000-8000-00000000000b' from public.crews where tag = 'METAX';
create temp table wk as select (private.week_start_br(now()) + time '00:00') at time zone 'America/Sao_Paulo' as t0;
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
select x.id::uuid, x.uid::uuid, x.st, wk.t0 + x.dt, wk.t0 + x.dt + interval '1 minute', wk.t0 + x.dt + interval '1 minute',
       x.m, x.m * 0.3, 300, x.st in ('valid', 'partial')
  from wk, (values
    ('e9e9e9e9-2030-4000-8000-000000000001', 'e9e9e9e9-0030-4000-8000-00000000000a', 'valid', interval '0', 5000),
    ('e9e9e9e9-2030-4000-8000-000000000002', 'e9e9e9e9-0030-4000-8000-00000000000b', 'partial', interval '0', 3000),
    ('e9e9e9e9-2030-4000-8000-000000000003', 'e9e9e9e9-0030-4000-8000-00000000000b', 'review', interval '0', 4000),
    ('e9e9e9e9-2030-4000-8000-000000000004', 'e9e9e9e9-0030-4000-8000-00000000000c', 'valid', interval '0', 9000),
    ('e9e9e9e9-2030-4000-8000-000000000005', 'e9e9e9e9-0030-4000-8000-00000000000a', 'valid', interval '-2 hours', 2000)
  ) as x(id, uid, st, dt, m);
select pg_temp.login('e9e9e9e9-0030-4000-8000-00000000000b');
select results_eq($$ select (g ->> 'members')::int, (g ->> 'ran')::int, (g ->> 'meters')::int, (g ->> 'goalMeters')::int,
                            (g ->> 'progress')::numeric, (g ->> 'reached')::boolean, g ->> 'crewId' is not null
                       from (select public.crew_week_goal() as g) x $$,
  $$ values (2, 2, 8000, 20000, 0.4::numeric, false, true) $$,
  'D-88: km das corridas aceitas dos membros na semana (sem a em revisão, sem a da semana passada, sem quem não é da crew)');
reset role;
select pg_temp.login('e9e9e9e9-0030-4000-8000-00000000000c');
select is(public.crew_week_goal(), null, 'D-88: sem crew, null');
reset role;
select ok(not has_function_privilege('anon', 'public.crew_week_goal()', 'execute')
          and has_function_privilege('authenticated', 'public.crew_week_goal()', 'execute')
          and not has_function_privilege('authenticated', 'private.crew_week_goal_m(integer)', 'execute')
          and not has_function_privilege('authenticated', 'private.v2_apply_stamp(uuid)', 'execute'),
  'D-88/B1: só quem entrou chama crew_week_goal; as funções privadas não saem do banco');

select * from finish();
rollback;
