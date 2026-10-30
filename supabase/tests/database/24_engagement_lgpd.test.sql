-- T7.2.2 (contrato E7 §3; LGPD/RNF-013) — my_engagement() com a curva, títulos e faixas do domain; exportação v2
-- com TODAS as tabelas que têm dado da pessoa (teste estrutural: tabela nova com usuário fora da lista = vermelho);
-- exclusão de conta apaga tudo (toda FK para a pessoa é cascade ou set null).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- ---------------------------------------------------------------------------
-- Progressão em SQL = progression.ts (valores tirados do domain com deno: xpToNextLevel(49) = 7920, levelProgress(880)...)
-- ---------------------------------------------------------------------------
select is(array[private.xp_to_next_level(1), private.xp_to_next_level(2), private.xp_to_next_level(3), private.xp_to_next_level(4),
                private.xp_to_next_level(49)],
  array[100, 170, 260, 350, 7920], 'xpToNextLevel: arred10(50·n^1,3) + 50');
select is(array[(private.level_progress(0) ->> 'level')::int, (private.level_progress(529) ->> 'level')::int,
                (private.level_progress(530) ->> 'level')::int, (private.level_progress(880) ->> 'level')::int,
                (private.level_progress(174159) ->> 'level')::int, (private.level_progress(174160) ->> 'level')::int,
                (private.level_progress(9999999) ->> 'level')::int],
  array[1, 3, 4, 5, 49, 50, 50], 'levelProgress: nível 5 com 880 XP, nível 50 com 174.160 XP');
select is(private.level_progress(880) - 'level' - 'isMax',
  '{"intoLevel": 0, "needed": 460, "title": {"id": "pe-na-rua", "name": "Pé na Rua"}}'::jsonb, 'título do nível 5: Pé na Rua');
select is((private.level_progress(174160) ->> 'isMax')::boolean, true, 'nível máximo');
select is(array[private.runner_band(0) ->> 'id', private.runner_band(9999) ->> 'id', private.runner_band(10000) ->> 'id',
                private.runner_band(5000000) ->> 'id'], array['asfalto', 'asfalto', 'bronze', 'nomade'], 'faixas por distância total');
select is(private.runner_band(9000), '{"id": "asfalto", "name": "Asfalto", "next": "bronze", "metersToNext": 1000}'::jsonb,
  'runnerBand: quanto falta para a próxima');
select is(array[private.season_track_step(1000), private.season_track_step(2880), private.season_track_step(3360)],
  array['{"step": 8, "intoStep": 40, "medal": "bronze", "prestigeStars": 0}'::jsonb,
        '{"step": 24, "intoStep": 0, "medal": "ouro", "prestigeStars": 0}'::jsonb,
        '{"step": 24, "intoStep": 0, "medal": "ouro", "prestigeStars": 2}'::jsonb], 'seasonTrackStep');

-- ---------------------------------------------------------------------------
-- my_engagement()
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0024-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'l24' || c || '@t.com', json_build_object('username', 'l24_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b']) c;
update public.profiles set faction = 'volt', lifetime_meters = 12000 where id::text like 'e9e9e9e9-0024-%';
select private.grant_xp('e9e9e9e9-0024-4000-8000-00000000000a', 'mission', 'teste-24', 900);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select ok(has_function_privilege('authenticated', 'public.my_engagement()', 'execute')
          and not has_function_privilege('anon', 'public.my_engagement()', 'execute'), 'my_engagement só para quem está logado');
select pg_temp.login('e9e9e9e9-0024-4000-8000-00000000000a');
create temp table e1 as select public.my_engagement() as e;
select results_eq($$ select (e ->> 'level')::int, (e ->> 'xp')::int, e #>> '{title,id}', e #>> '{band,id}', (e ->> 'lifetimeMeters')::int from e1 $$,
  $$ values (5, 900, 'pe-na-rua'::text, 'bronze'::text, 12000) $$, 'nível, XP, título e faixa');
select ok((select e ?& array['streak', 'dailyChest', 'missions', 'season', 'intoLevel', 'needed'] from e1), 'todas as partes do contrato E7 §3');
select ok((select e -> 'missions' = 'null'::jsonb and e -> 'dailyChest' = 'null'::jsonb and e -> 'season' = 'null'::jsonb from e1),
  'features desligadas: partes vêm null (o app mostra o estado vazio)');
reset role;
update public.game_config set value = value || '{"missions": true, "dailyChest": true, "track": true}' where key = 'features';
select pg_temp.login('e9e9e9e9-0024-4000-8000-00000000000a');
create temp table e2 as select public.my_engagement() as e;
select is((select jsonb_array_length(e #> '{missions,daily}') from e2), 3, 'missões ligadas: 3 diárias');
select is((select e #>> '{dailyChest,stored}' from e2), '1', 'baú do dia guardado');
select is((select (e -> 'season') - 'id'::text from e2), '{"xp": 900, "step": 7, "intoStep": 60, "medal": null, "prestigeStars": 0}'::jsonb,
  'trilha da temporada');
reset role;

-- ---------------------------------------------------------------------------
-- LGPD v2: exportação com todas as tabelas que têm dado da pessoa (teste estrutural)
-- ---------------------------------------------------------------------------
select is((select array_agg(distinct cl.relname::text order by cl.relname::text)
             from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
            where c.contype = 'f' and n.nspname = 'public'
              and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
              and cl.relname <> all (private.export_v2_tables())), null,
  'toda tabela com FK para a pessoa está na exportação v2 (tabela nova sem export = este teste falha)');
select is((select array_agg(distinct t.table_name::text order by t.table_name::text)
             from information_schema.columns t
            where t.table_schema = 'public' and t.column_name in ('user_id', 'actor_id', 'author_id', 'owner_id')
              and t.table_name in (select tablename from pg_tables where schemaname = 'public')
              and t.table_name <> all (private.export_v2_tables())), null,
  'toda tabela com coluna de usuário está na exportação v2');
select is((select array_agg(x order by x) from unnest(private.export_v2_tables()) x
            where not exists (select 1 from pg_tables where schemaname = 'public' and tablename = x)), null,
  'a lista da exportação não tem tabela que não existe');
select is((select array_agg(cl.relname::text || '.' || c.conname order by cl.relname::text)
             from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
            where c.contype = 'f' and n.nspname = 'public'
              and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
              and c.confdeltype not in ('c', 'n')), null,
  'exclusão de conta: toda FK para a pessoa é cascade ou set null');
select ok(not has_function_privilege('authenticated', 'public.svc_account_export_v2(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.svc_account_export_v2(uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.account_export_v2()', 'execute')
          and not has_function_privilege('anon', 'public.account_export_v2()', 'execute'),
  'exportação: a function (service role) e a própria pessoa');

-- dados de A em tabelas novas
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, scored)
values ('e9e9e9e9-1024-4000-8000-000000000001', 'e9e9e9e9-0024-4000-8000-00000000000a', 'valid', now() - interval '2 hours',
        now() - interval '1 hour', now() - interval '1 hour', 3000, true);
insert into public.paint_marks (user_id, day, cell, activity_id)
values ('e9e9e9e9-0024-4000-8000-00000000000a', public.br_today(), '8ba90128e380fff', 'e9e9e9e9-1024-4000-8000-000000000001');
insert into public.personal_records (user_id, kind, value, activity_id, day)
values ('e9e9e9e9-0024-4000-8000-00000000000a', 'longest', 3000, 'e9e9e9e9-1024-4000-8000-000000000001', public.br_today());
insert into public.user_settings (user_id, share_runs_to_feed) values ('e9e9e9e9-0024-4000-8000-00000000000a', false);
insert into public.engagement_marks (user_id, kind, day) values ('e9e9e9e9-0024-4000-8000-00000000000a', 'share', public.br_today());

select pg_temp.login('e9e9e9e9-0024-4000-8000-00000000000a');
create temp table ex as select public.account_export_v2() as x;
reset role;
select ok((select x ?& array['profile', 'activities', 'xpLedger', 'missions', 'dailyRewards', 'raidHits', 'leagueMembers', 'paintMarks',
                              'activityStats', 'personalRecords', 'settings', 'feedItems', 'kudosGiven', 'kudosReceived', 'zoneEvents',
                              'engagementMarks', 'trackClaims', 'cosmetics', 'medals', 'exportVersion'] from ex),
  'exportação v2 com as partes novas');
select results_eq($$ select jsonb_array_length(x -> 'xpLedger'), jsonb_array_length(x -> 'paintMarks'), x #>> '{personalRecords,0,kind}',
                            x #>> '{settings,share_runs_to_feed}', jsonb_array_length(x -> 'missions') > 0 from ex $$,
  $$ values (1, 1, 'longest'::text, 'false'::text, true) $$, 'os dados de A aparecem na exportação');
select ok((select x::text !~ 'e9e9e9e9-0024-4000-8000-00000000000b' from ex), 'nada de B na exportação de A');
select is((select x from ex) - 'exportedAt', private.account_export_v2('e9e9e9e9-0024-4000-8000-00000000000a') - 'exportedAt',
  'a RPC da pessoa e a da function devolvem o mesmo');

-- exclusão: nenhuma linha com o id de A sobra em tabela nenhuma com coluna de usuário
create function pg_temp.rows_of(uid uuid) returns integer language plpgsql as $$
declare
  t record;
  n integer := 0;
  k integer;
begin
  for t in select table_name, column_name from information_schema.columns
            where table_schema = 'public' and column_name in ('user_id', 'id')
              and table_name in (select tablename from pg_tables where schemaname = 'public')
              and data_type = 'uuid' loop
    execute format('select count(*) from public.%I where %I = $1', t.table_name, t.column_name) into k using uid;
    n := n + k;
  end loop;
  return n;
end $$;
select ok(pg_temp.rows_of('e9e9e9e9-0024-4000-8000-00000000000a') > 5, 'antes: A tem dados espalhados');
delete from auth.users where id = 'e9e9e9e9-0024-4000-8000-00000000000a';
select is(pg_temp.rows_of('e9e9e9e9-0024-4000-8000-00000000000a'), 0, 'depois da exclusão: nenhuma linha de A em tabela nenhuma');
select is((select count(*)::int from public.xp_ledger where ref = 'teste-24'), 0, 'livro de XP apagado junto');
select ok(pg_temp.rows_of('e9e9e9e9-0024-4000-8000-00000000000b') > 0, 'os dados de B continuam');

select * from finish();
rollback;
