-- T7.2.1 (D-80; contratos E3 §1/§5 e E7 §8) — gravação v2 no banco: svc_v2_context (flags, contexto, missões
-- garantidas antes de contar a corrida) e svc_apply_v2 (pontos e liga, raid, XP em linhas, semana garantida, baú do
-- dia, missões, recordes, feed e pintura), tudo numa transação e idempotente por activities.v2_extras.
-- Com as flags desligadas, o contexto não carrega nada (a function nem chama a gravação v2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

select ok(not has_function_privilege('authenticated', 'public.svc_v2_context(uuid, uuid, text[])', 'execute')
          and not has_function_privilege('authenticated', 'public.svc_apply_v2(jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.svc_v2_context(uuid, uuid, text[])', 'execute')
          and has_function_privilege('service_role', 'public.svc_apply_v2(jsonb)', 'execute'),
  'contexto e gravação v2 só pelo servidor (service role)');
select has_column('public', 'activities', 'v2_extras', 'activities.v2_extras marca o que a v2 já aplicou');

-- ---------------------------------------------------------------------------
-- Fixtures: A (striders, crew com B), B (striders), corridas de A
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0022-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'g22' || c || '@t.com', json_build_object('username', 'g22_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b']) c;
update public.profiles set faction = 'striders', city = 'Cidade22' where id::text like 'e9e9e9e9-0022-%';
insert into public.crews (name, tag, leader_id) values ('Crew Feed', 'FEEDX', 'e9e9e9e9-0022-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0022-4000-8000-00000000000b' from public.crews where tag = 'FEEDX';

create function pg_temp.act(n integer, status text default 'valid', meters real default 5000) returns uuid language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored, result)
  values (('e9e9e9e9-1022-4000-8000-00000000000' || n)::uuid, 'e9e9e9e9-0022-4000-8000-00000000000a', status,
          now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', meters, meters * 0.3, 300,
          status in ('valid', 'partial'), '{"xp": 77, "zones": []}')
  returning id
$$;
select pg_temp.act(1);
select pg_temp.act(2, 'review');

-- ---------------------------------------------------------------------------
-- Flags desligadas: o contexto só diz isso (nada é carregado nem garantido)
-- ---------------------------------------------------------------------------
select is((public.svc_v2_context('e9e9e9e9-0022-4000-8000-00000000000a', 'e9e9e9e9-1022-4000-8000-000000000001') ->> 'done'), null,
  'contexto: nada aplicado ainda');
select ok(not (public.svc_v2_context('e9e9e9e9-0022-4000-8000-00000000000a', 'e9e9e9e9-1022-4000-8000-000000000001') ? 'profile'),
  'flags desligadas: o contexto não carrega perfil, missões nem pintura');
select is(public.svc_v2_context('e9e9e9e9-0022-4000-8000-00000000000b', 'e9e9e9e9-1022-4000-8000-000000000001'), null,
  'contexto de corrida de outra pessoa: null');
select is((select count(*)::int from public.user_missions where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a'), 0,
  'flags desligadas: nenhuma missão sorteada');

-- ---------------------------------------------------------------------------
-- Flags ligadas
-- ---------------------------------------------------------------------------
update public.game_config set value = value || '{"raid": true, "league": true, "missions": true, "dailyChest": true,
                                                  "records": true, "feed": true}' where key = 'features';
insert into public.raids (boss_id, city, week_start, starts_at, ends_at, hp_max, hp)
values ('soneca', 'Cidade22', date_trunc('week', now() at time zone 'America/Sao_Paulo')::date,
        now() - interval '1 day', now() + interval '1 day', 1000, 1000);

create temp table ctx as
  select public.svc_v2_context('e9e9e9e9-0022-4000-8000-00000000000a', 'e9e9e9e9-1022-4000-8000-000000000001') as c;
select is((select c #>> '{flags,territoryRule}' from ctx), 'v1', 'contexto traz a regra de território');
select is((select c #>> '{profile,faction}' from ctx), 'striders', 'contexto traz o perfil');
select is((select c #>> '{raid,bossId}' from ctx), 'soneca', 'contexto traz o chefão ativo da cidade');
select ok((select jsonb_array_length(c #> '{engagement,missions}') >= 6 from ctx),
  'missões garantidas antes de contar a corrida (3 diárias + 3 semanais + primeira semana)');
select is((select c #>> '{engagement,weekBefore}' from ctx), '0', 'atividades da semana antes desta');
select is((select c #>> '{engagement,dailyChest,stored}' from ctx), '1', 'baú do dia guardado (conta nova: 1)');
select ok((select c #> '{feed,crewId}' <> 'null'::jsonb and (c #>> '{feed,shareRunsToFeed}')::boolean from ctx),
  'contexto do feed: crew e "mostrar minhas corridas" ligado');
select is((select c -> 'paint' from ctx), null, 'regra v1: o contexto não carrega a pintura');

-- missões que esta corrida completa (progresso absoluto calculado pelo domain na function)
create temp table prog as
  select coalesce(jsonb_object_agg(m ->> 'id', (m ->> 'target')::int), '{}'::jsonb) as p
    from ctx, jsonb_array_elements(c #> '{engagement,missions}') m where m ->> 'metric' in ('meters', 'moving_seconds');
create temp table before as select xp from public.profiles where id = 'e9e9e9e9-0022-4000-8000-00000000000a';

create temp table raw as select public.svc_apply_v2(jsonb_build_object(
  'activityId', 'e9e9e9e9-1022-4000-8000-000000000001', 'userId', 'e9e9e9e9-0022-4000-8000-00000000000a', 'faction', 'striders',
  'nowMs', (extract(epoch from now()) * 1000)::bigint,
  'paint', null,
  'points', '{"total": 90, "zones": []}'::jsonb,
  'raid', '{"meters": 5000, "damage": 50, "weakMeters": 0, "pack": false}'::jsonb,
  'xpLines', '[{"source": "run_distance", "amount": 50}, {"source": "run_complete", "amount": 30}, {"source": "medal", "amount": 999}]'::jsonb,
  'weekKept', null,
  'missionProgress', (select p from prog),
  'records', '{"meters": 5000, "movingSeconds": 1500, "splits": [300, 300, 300, 300, 300], "paceSeries": [300],
               "best1k": 300, "best5k": 1500, "best10k": null, "best21k": null}'::jsonb,
  'feed', '{"route": ["_p~iF~ps|U"], "routeHidden": true, "highlights": [{"kind": "raid_damage", "damage": 50, "km": 5}]}'::jsonb)) as r;

select ok((select r ?& array['points', 'league', 'raid', 'engagement', 'records', 'feed'] from raw), 'gravação devolve todas as partes ligadas');
select is((select array_agg(source || ':' || amount order by source) from public.xp_ledger
            where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a' and ref = 'e9e9e9e9-1022-4000-8000-000000000001'),
  array['run_complete:30', 'run_distance:50'], 'XP da atividade em linhas no livro (fonte fora da lista é ignorada)');
select is((select pr.xp - b.xp from public.profiles pr, before b where pr.id = 'e9e9e9e9-0022-4000-8000-00000000000a'),
          (select sum((l ->> 'amount')::int)::int from raw, jsonb_array_elements(r #> '{engagement,lines}') l),
  'XP do perfil subiu exatamente o que as linhas dizem (atividade + baú do dia + missões)');
select results_eq($$ select xp, (result ->> 'xp')::int, result -> 'zones' from public.activities where id = 'e9e9e9e9-1022-4000-8000-000000000001' $$,
  $$ values (80, 80, '[]'::jsonb) $$, 'activities.xp e response.xp = XP da atividade na v2 (clientes antigos)');
select is((select r #>> '{engagement,dailyChests,opened}' from raw), 'true', 'baú do dia aberto pela corrida de ≥ 1 km');
select ok((select count(*) = (select count(*) from prog, jsonb_object_keys(p)) from public.user_missions
            where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a' and claimed_at is not null and id::text in (select jsonb_object_keys(p) from prog)),
  'missões completadas pela corrida foram pagas na hora');
select results_eq($$ select points, week_start = private.week_start_br(now()) from public.league_entries
                     where activity_id = 'e9e9e9e9-1022-4000-8000-000000000001' $$,
  $$ values (90, true) $$, 'liga: pontos v2 da corrida na semana');
select ok((select damage between 1 and 100 and meters = 5000 from public.raid_hits where activity_id = 'e9e9e9e9-1022-4000-8000-000000000001'),
  'raid: golpe gravado (o servidor confere crítico e tetos)');
select results_eq($$ select kind, value from public.personal_records where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a' order by kind $$,
  $$ values ('1k'::text, 300), ('5k', 1500), ('longest', 5000) $$, 'recordes: 1 km, 5 km e a mais longa');
select is((select splits from public.activity_stats where activity_id = 'e9e9e9e9-1022-4000-8000-000000000001'),
  array[300, 300, 300, 300, 300], 'parciais gravadas');
select results_eq($$ select crew_id = (select id from public.crews where tag = 'FEEDX'), route, route_hidden, day = public.br_today(),
                            highlights -> 0 ->> 'kind', jsonb_array_length(highlights)
                       from public.feed_items where activity_id = 'e9e9e9e9-1022-4000-8000-000000000001' $$,
  $$ values (true, array['_p~iF~ps|U'], true, true, 'raid_damage'::text, 4) $$,
  'feed: item da crew com a rota cortada, o dia (sem hora) e as fichas (dano + 3 recordes)');
select ok((select v2_extras is not null from public.activities where id = 'e9e9e9e9-1022-4000-8000-000000000001'), 'v2_extras gravado');

-- idempotência
create temp table ledger1 as select count(*) as n from public.xp_ledger where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a';
select is((public.svc_apply_v2(jsonb_build_object('activityId', 'e9e9e9e9-1022-4000-8000-000000000001',
                                                  'userId', 'e9e9e9e9-0022-4000-8000-00000000000a', 'faction', 'striders',
                                                  'xpLines', '[{"source": "run_distance", "amount": 500}]'::jsonb)) ->> 'repeated')::boolean,
  true, 'repetir devolve o que já foi aplicado');
select is((select count(*) from public.xp_ledger where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a'), (select n from ledger1),
  'repetir não credita XP de novo');
select is((public.svc_v2_context('e9e9e9e9-0022-4000-8000-00000000000a', 'e9e9e9e9-1022-4000-8000-000000000001') -> 'done' ->> 'version'), '1',
  'o contexto devolve o que já foi aplicado (a function só monta os extras)');
select throws_like($$ select public.svc_apply_v2(jsonb_build_object('activityId', 'e9e9e9e9-1022-4000-8000-000000000002',
                                                                    'userId', 'e9e9e9e9-0022-4000-8000-00000000000a')) $$,
  '%NOT_SCORED%', 'corrida em revisão: a v2 espera a aprovação');

-- ---------------------------------------------------------------------------
-- Pintura (territory_rule = 'v2')
-- ---------------------------------------------------------------------------
insert into public.zones (id, name, city, geom) values
  ('89a90128e3bffff', 'Zona POA 1', 'Cidade22', extensions.st_setsrid(extensions.st_geomfromgeojson(
    '{"type":"Polygon","coordinates":[[[-51.2173721778165,-30.036324475878015],[-51.21630560724396,-30.0350282146007],[-51.217260040920266,-30.033559365310325],[-51.21928102307092,-30.03338679177478],[-51.22034758026746,-30.034683058704122],[-51.219393168690495,-30.036151893517015],[-51.2173721778165,-30.036324475878015]]]}'), 4326));
update public.game_config set value = '"v2"' where key = 'territory_rule';
select pg_temp.act(3);
insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome)
values ('e9e9e9e9-1022-4000-8000-000000000003', '89a90128e3bffff', 'e9e9e9e9-0022-4000-8000-00000000000a', 'striders', 300, 40, 'influence');
create temp table zv as select version from public.zones where id = '89a90128e3bffff';

select throws_like(format($$ select public.svc_apply_v2(jsonb_build_object(
    'activityId', 'e9e9e9e9-1022-4000-8000-000000000003', 'userId', 'e9e9e9e9-0022-4000-8000-00000000000a', 'faction', 'striders',
    'paint', jsonb_build_object('zones', jsonb_build_array(jsonb_build_object('zoneId', '89a90128e3bffff', 'expectedVersion', %s,
                                 'owner', 'striders', 'counts', '{}'::jsonb)), 'cells', '[]'::jsonb))) $$, (select version + 5 from zv)),
  '%ZONE_CONFLICT%', 'zona mudou desde o contexto: ZONE_CONFLICT (a function recarrega e tenta de novo)');

select ok((public.svc_apply_v2(jsonb_build_object(
    'activityId', 'e9e9e9e9-1022-4000-8000-000000000003', 'userId', 'e9e9e9e9-0022-4000-8000-00000000000a', 'faction', 'striders',
    'nowMs', (extract(epoch from now()) * 1000)::bigint,
    'paint', jsonb_build_object(
      'zones', jsonb_build_array(
        jsonb_build_object('zoneId', '89a90128e3bffff', 'expectedVersion', (select version from zv), 'owner', 'striders',
                           'counts', '{"striders": 3, "coyotes": 0, "owls": 0, "volt": 0}'::jsonb, 'attackFlips', 0),
        jsonb_build_object('zoneId', '89a90128e0fffff', 'expectedVersion', null, 'owner', null, 'counts', '{}'::jsonb,
                           'geom', '{"type":"Polygon","coordinates":[[[-51.21439671011163,-30.03796580771684],[-51.21333012616855,-30.036669552092093],[-51.21428458578148,-30.035200748296834],[-51.21630560724396,-30.0350282146007],[-51.2173721778165,-30.036324475878015],[-51.21641774029824,-30.03779326519891],[-51.21439671011163,-30.03796580771684]]]}')),
      'cells', jsonb_build_array(
        jsonb_build_object('cell', '8ba90128e380fff', 'zoneId', '89a90128e3bffff', 'faction', 'striders', 'layers', 1,
                           'paintedAt', (extract(epoch from now()) * 1000)::bigint, 'lat', -30.0348556, 'lng', -51.2183266),
        jsonb_build_object('cell', '8ba90128e381fff', 'zoneId', '89a90128e3bffff', 'faction', 'striders', 'layers', 1,
                           'paintedAt', (extract(epoch from now()) * 1000)::bigint, 'lat', -30.0346211, 'lng', -51.2187516),
        jsonb_build_object('cell', '8ba90128e382fff', 'zoneId', '89a90128e3bffff', 'faction', 'striders', 'layers', 1,
                           'paintedAt', (extract(epoch from now()) * 1000)::bigint, 'lat', -30.0346951, 'lng', -51.2178855)),
      'marks', '["8ba90128e380fff", "8ba90128e381fff", "8ba90128e382fff"]'::jsonb,
      'events', '[{"type": "captured", "zoneId": "89a90128e3bffff", "faction": "striders", "from": null}]'::jsonb,
      'summary', jsonb_build_object('rule', 'v2', 'cells', 3, 'zones', jsonb_build_array(jsonb_build_object(
                   'zoneId', '89a90128e3bffff', 'ownerBefore', null, 'ownerAfter', 'striders', 'outcome', 'conquistada')))))) ? 'paint'),
  'pintura gravada');
select results_eq($$ select owner, influence ->> 'striders', version = (select version + 1 from zv), rule_version::int
                       from public.zones where id = '89a90128e3bffff' $$,
  $$ values ('striders'::text, '30'::text, true, 2) $$, 'zona: dono pela pintura, espelho da influência, versão + 1');
select is((select count(*)::int from public.zone_cells where zone_id = '89a90128e3bffff'), 3, 'trechos gravados sem autor');
select ok((select name is not null and rule_version = 2 from public.zones where id = '89a90128e0fffff'), 'zona nova criada pela pintura, com nome');
select is((select count(*)::int from public.paint_marks where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a' and day = public.br_today()), 3,
  '"já pintou hoje" registrado');
select results_eq($$ select outcome, owner_after from public.activity_zones where activity_id = 'e9e9e9e9-1022-4000-8000-000000000003' $$,
  $$ values ('conquered'::text, 'striders'::text) $$, 'contribuição da corrida passa a contar a conquista pela pintura');
select ok(exists (select 1 from public.zone_events where zone_id = '89a90128e3bffff' and type = 'captured'
                                                   and activity_id = 'e9e9e9e9-1022-4000-8000-000000000003')
          and exists (select 1 from public.notifications where user_id = 'e9e9e9e9-0022-4000-8000-00000000000a' and type = 'conquest'
                                                         and data ->> 'zoneId' = '89a90128e3bffff'),
  'evento e notificação de conquista, como na v1');
select is((select jsonb_array_length(c #> '{paint,cells}') from (select public.svc_v2_context('e9e9e9e9-0022-4000-8000-00000000000a',
             pg_temp.act(4), array['89a90128e3bffff']) as c) x), 3, 'contexto da próxima corrida traz todos os trechos da zona');

select * from finish();
rollback;
