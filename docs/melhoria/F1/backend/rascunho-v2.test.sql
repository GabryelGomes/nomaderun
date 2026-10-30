-- F1/E9 — pgTAP do RASCUNHO v2 (docs/melhoria/F1/backend/rascunho-v2.sql). Roda no banco local depois das
-- migrations: NR_EXTRA_SQL=rascunho-v2.sql NR_EXTRA_TESTS=rascunho-v2.test.sql bash banco-local.sh
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Fixtures: A e B (volt, mesma crew), C (volt, sem crew)
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'f1f1f1f1-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'v2a@t.com',
   '{"username": "v2_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'f1f1f1f1-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'v2b@t.com',
   '{"username": "v2_b", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'f1f1f1f1-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'v2c@t.com',
   '{"username": "v2_c", "birthdate": "1995-01-01", "terms_accepted": true}');
update public.profiles set faction = 'volt' where id::text like 'f1f1f1f1-%';
insert into public.crews (name, tag, leader_id) values ('Crew V2', 'VDOIS', 'f1f1f1f1-0000-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'f1f1f1f1-0000-4000-8000-00000000000b' from public.crews where tag = 'VDOIS';
update public.game_config set value = '{"raid": true, "league": true, "missions": true, "feed": true, "records": true, "dailyChest": true}'
 where key = 'features';

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.run(uid uuid, act uuid, meters real) returns void language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
  values (act, uid, 'valid', now() - interval '40 minutes', now() - interval '5 minutes', now(), meters, meters * 0.33, 330, true)
$$;

-- ------------------------------------------------------------------ estrutura (o mesmo padrão do 12_security_audit)
select is((select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity), null,
  'v2: toda tabela nova tem RLS');
select is((select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'v')
              and (has_table_privilege('anon', c.oid, 'select') or has_any_column_privilege('anon', c.oid, 'insert'))), null,
  'v2: anon sem privilégio nas tabelas novas');
select is((select array_agg(t order by t) from unnest(array['xp_ledger', 'raids', 'raid_hits', 'raid_rewards', 'user_missions',
            'league_members', 'league_groups', 'league_standings', 'feed_items', 'activity_stats', 'personal_records', 'daily_rewards',
            'game_config', 'mission_defs', 'raid_bosses']) t
            where has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')), null,
  'v2: cliente não escreve em placar, XP, missões, liga, recordes, baú do dia');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'private') and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  array['username_available'], 'v2: anon continua executando só username_available');
select is((select array_agg(tablename::text order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'),
  array['kudos', 'notifications', 'raids', 'zones'], 'v2: Realtime em kudos e raids (o 12_security_audit precisa ser atualizado)');
select is((select count(*)::int from cron.job where jobname like 'nomaderun-%'), 6,
  'v2: 6 jobs (o 01_schema precisa ser atualizado de 4 para 6)');

-- ------------------------------------------------------------------ contrato
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000a');
select is((public.server_info() ->> 'contract')::int, 2, 'server_info: contrato 2');
select is(public.server_info() ->> 'territoryRule', 'v1', 'server_info: regra de território começa em v1 (liga depois do EAS Update)');
reset role;
select set_config('role', 'anon', true);
select throws_ok($$ select public.server_info() $$, '42501', null, 'anon não chama server_info');
reset role;

-- ------------------------------------------------------------------ raid
insert into public.raid_bosses (id, name, art_key) values ('mormaco', 'Mormaço', 'boss-mormaco');
insert into public.raids (boss_id, starts_at, ends_at, hp_m) values ('mormaco', now() - interval '1 hour', now() + interval '47 hours', 50000);
select pg_temp.run('f1f1f1f1-0000-4000-8000-00000000000a', 'f1f1f1f1-1111-4000-8000-000000000001', 25000);
select is((private.apply_raid_damage('f1f1f1f1-1111-4000-8000-000000000001', 25000) ->> 'damage')::int, 21000,
  'raid: corrida de 25 km dá no máximo 21 km de dano');
select is((private.apply_raid_damage('f1f1f1f1-1111-4000-8000-000000000001', 25000) ->> 'repeated')::boolean, true,
  'raid: a mesma corrida não golpeia duas vezes');
select pg_temp.run('f1f1f1f1-0000-4000-8000-00000000000a', 'f1f1f1f1-1111-4000-8000-000000000002', 15000);
select is((private.apply_raid_damage('f1f1f1f1-1111-4000-8000-000000000002', 15000) ->> 'damage')::int, 9000,
  'raid: teto de 30 km por pessoa por dia');
select is((select damage_m from public.raids where boss_id = 'mormaco'), 30000::bigint, 'raid: vida global soma o dano');
select is((select private.raid_phase(damage_m, hp_m) from public.raids where boss_id = 'mormaco'), 2::smallint, 'raid: 60% de dano = fase 2');
select pg_temp.run('f1f1f1f1-0000-4000-8000-00000000000b', 'f1f1f1f1-1111-4000-8000-000000000003', 20000);
select is((private.apply_raid_damage('f1f1f1f1-1111-4000-8000-000000000003', 20000) ->> 'defeated')::boolean, true,
  'raid: o golpe que zera a vida derrota o chefão');
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000a');
select is((public.raid_current() -> 'me' ->> 'damageM')::int, 30000, 'raid_current: meu dano');
select is(jsonb_array_length(public.raid_current() -> 'topCrews'), 1, 'raid_current: ranking de crews');
select is((select count(*)::int from public.raid_hits), 2, 'raid_hits: cada um vê só os próprios golpes');
select throws_ok($$ insert into public.raid_hits (raid_id, activity_id, user_id, faction, damage_m)
                    select id, 'f1f1f1f1-1111-4000-8000-000000000001', 'f1f1f1f1-0000-4000-8000-00000000000a', 'volt', 99999 from public.raids $$,
  '42501', null, 'cliente não grava dano');
reset role;
select is(public.job_tick_raids() >= 1, true, 'job_tick_raids premia o raid derrotado');
select is((select tier from public.raid_rewards where user_id = 'f1f1f1f1-0000-4000-8000-00000000000a'), 'mvp', 'raid: MVP é quem mais causou dano');
select is((select count(*)::int from public.xp_ledger where source = 'raid'), 2, 'raid: XP uma vez por pessoa');
select public.job_tick_raids();
select is((select count(*)::int from public.xp_ledger where source = 'raid'), 2, 'raid: rodar o job de novo não paga de novo');

-- ------------------------------------------------------------------ missões
insert into public.mission_defs (id, kind, metric, target, reward_xp, title, icon) values
  ('d_km2', 'daily', 'meters', 2000, 30, 'Corra 2 km', 'run'), ('d_zone', 'daily', 'zones_conquered', 1, 40, 'Conquiste 1 zona', 'flag'),
  ('d_run', 'daily', 'runs', 1, 20, 'Faça 1 corrida', 'run'), ('d_fog', 'daily', 'new_fog_cells', 10, 20, 'Revele 10 ruas', 'fog'),
  ('w_km', 'weekly', 'meters', 10000, 100, 'Corra 10 km', 'run'), ('w_runs', 'weekly', 'runs', 3, 80, 'Faça 3 corridas', 'run'),
  ('w_chest', 'weekly', 'chests_opened', 2, 60, 'Abra 2 baús', 'chest'), ('w_raid', 'weekly', 'raid_damage_m', 5000, 90, 'Cause 5 km de dano', 'raid');
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000c');
select is(jsonb_array_length(public.my_missions()), 6, 'my_missions: 3 diárias + 3 semanais');
select is(jsonb_array_length(public.my_missions()), 6, 'my_missions: chamar de novo não sorteia mais');
reset role;
select is(jsonb_array_length(private.advance_missions('f1f1f1f1-0000-4000-8000-00000000000c',
  '{"meters": 999999, "runs": 3, "zones_conquered": 3, "new_fog_cells": 50, "chests_opened": 5, "raid_damage_m": 9000}', now())), 6,
  'advance_missions: corrida grande completa todas');
select is((select max(progress) <= max(target) from public.user_missions where user_id = 'f1f1f1f1-0000-4000-8000-00000000000c'), true,
  'progresso nunca passa da meta');
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000c');
select is((public.claim_mission((select id from public.user_missions order by created_at, id limit 1)) ->> 'claimed')::boolean, true,
  'claim_mission resgata');
select is((public.claim_mission((select id from public.user_missions order by created_at, id limit 1)) ->> 'alreadyClaimed')::boolean, true,
  'claim_mission de novo é idempotente');
reset role;
select is((select count(*)::int from public.xp_ledger where user_id = 'f1f1f1f1-0000-4000-8000-00000000000c' and source = 'mission'), 1,
  'missão paga XP uma vez');

-- ------------------------------------------------------------------ liga
select private.add_league_points('f1f1f1f1-0000-4000-8000-00000000000a', 120, now());
select private.add_league_points('f1f1f1f1-0000-4000-8000-00000000000b', 80, now());
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000b');
select is(jsonb_array_length(public.league_current() -> 'members'), 2, 'league_current: grupo com os 2 corredores da semana');
select is((public.league_current() -> 'members' -> 0 ->> 'username'), 'v2_a', 'league_current: líder do grupo primeiro');
reset role;
select is(public.job_close_league(private.week_start(now())), 1, 'job_close_league fecha o grupo');
select is((select division from public.league_standings where user_id = 'f1f1f1f1-0000-4000-8000-00000000000a'), 1::smallint,
  'liga: top 5 sobe de divisão');
select is(private.add_league_points('f1f1f1f1-0000-4000-8000-00000000000a', 50, now()), null, 'liga: semana fechada não recebe pontos');

-- ------------------------------------------------------------------ feed e aplausos
insert into public.feed_items (actor_id, kind, activity_id, crew_id)
select 'f1f1f1f1-0000-4000-8000-00000000000a', 'run', 'f1f1f1f1-1111-4000-8000-000000000001', id from public.crews where tag = 'VDOIS';
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000b');
select lives_ok($$ insert into public.kudos (feed_item_id) select id from public.feed_items $$, 'colega de crew aplaude');
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000a');
select throws_like($$ insert into public.kudos (feed_item_id) select id from public.feed_items $$, '%KUDOS_SELF%', 'ninguém aplaude a si mesmo');
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000c');
select is((select count(*)::int from public.feed_items), 0, 'fora da crew não vê o feed');

-- ------------------------------------------------------------------ baú do dia e card
reset role;
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000c');
select throws_like($$ select public.open_daily_chest() $$, '%DAILY_CHEST_LOCKED%', 'baú do dia trancado sem corrida hoje');
reset role;
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000a');
select is((public.open_daily_chest() ->> 'alreadyOpened')::boolean, false, 'baú do dia abre depois de 1 km');
select is((public.open_daily_chest() ->> 'alreadyOpened')::boolean, true, 'baú do dia abre uma vez por dia');
select pg_temp.login('f1f1f1f1-0000-4000-8000-00000000000b');
select throws_like($$ select public.share_card('f1f1f1f1-1111-4000-8000-000000000001') $$, '%NOT_FOUND%', 'card de corrida alheia: NOT_FOUND');

-- ------------------------------------------------------------------ gravação v2 (chama a v1 e aplica os extras na mesma transação)
reset role;
insert into public.activities (id, user_id, started_at) values ('f1f1f1f1-1111-4000-8000-000000000009', 'f1f1f1f1-0000-4000-8000-00000000000b', now() - interval '30 minutes');
create function pg_temp.payload() returns jsonb language sql as $$
  select jsonb_build_object('mode', 'finish', 'activityId', 'f1f1f1f1-1111-4000-8000-000000000009', 'userId', 'f1f1f1f1-0000-4000-8000-00000000000b',
    'faction', 'volt', 'status', 'valid', 'scored', true, 'endedAt', (extract(epoch from now()) * 1000)::bigint, 'meters', 5000, 'movingSeconds', 1650,
    'avgPace', 330, 'rpTotal', 0, 'xp', 50, 'flags', '[]'::jsonb, 'invalidSegments', '[]'::jsonb, 'trustAfter', 100, 'suspend', false,
    'zones', '[]'::jsonb, 'activityZones', '[]'::jsonb, 'events', '[]'::jsonb, 'fogCells', '[]'::jsonb, 'chests', '[]'::jsonb,
    'result', jsonb_build_object('activityId', 'f1f1f1f1-1111-4000-8000-000000000009', 'status', 'valid', 'meters', 5000, 'zones', '[]'::jsonb),
    'extras', '{"raidDamageM": 5000, "missionMetrics": {"meters": 5000, "runs": 1}, "leaguePoints": 50,
                "stats": {"splits": [300, 310, 305, 299, 320], "best1kS": 299, "best5kS": 1534}}'::jsonb)
$$;
select is(public.svc_apply_activity_result_v2(pg_temp.payload()) -> 'result' ->> 'v', '2', 'v2: resultado ganha v = 2 e o bloco extras');
select is((select (result -> 'extras' -> 'raid' ->> 'damage')::int from public.activities where id = 'f1f1f1f1-1111-4000-8000-000000000009'), 5000,
  'v2: dano no chefão gravado junto com a corrida');
select is((select jsonb_array_length(result -> 'extras' -> 'records') from public.activities where id = 'f1f1f1f1-1111-4000-8000-000000000009'), 3,
  'v2: recordes novos (1 km, 5 km, maior distância)');
select is(public.svc_apply_activity_result_v2(pg_temp.payload()) -> 'result' ->> 'v', '2', 'v2: finalizar de novo devolve o mesmo resultado (ALREADY_FINISHED)');
select is((select count(*)::int from public.feed_items where activity_id = 'f1f1f1f1-1111-4000-8000-000000000009'), 1, 'v2: corrida entra no feed da crew');

select * from finish();
rollback;
