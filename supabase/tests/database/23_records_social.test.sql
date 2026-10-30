-- T7.2.2 (D-79; E8 §9) — feed da crew e aplausos: só a crew vê, sem horário, reações prontas (Bora!/Fogo/Raio),
-- sem aplaudir a si mesmo, teto de 200 por dia, notificação agrupada por item e dia, Realtime com RLS; configurações
-- "mostrar minhas corridas" e "mostrar o mapa"; recordes e parciais só do dono.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- ---------------------------------------------------------------------------
-- Esquema, RLS e grants
-- ---------------------------------------------------------------------------
select is((select array_agg(t order by t) from unnest(array['activity_stats', 'personal_records', 'user_settings', 'feed_items', 'kudos']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_any_column_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'recordes, configurações, feed e aplausos: RLS ligada, cliente não escreve direto, anon não lê');
select ok(not has_any_column_privilege('authenticated', 'public.feed_items', 'select'),
  'feed_items: o cliente não lê a tabela (o horário de criação nunca sai); só crew_feed()');
select is((select array_agg(column_name::text order by column_name) from information_schema.columns
            where table_schema = 'public' and table_name = 'kudos'), array['day', 'feed_item_id', 'reaction', 'user_id'],
  'kudos sem horário (só o dia) — é o que vai pelo Realtime');
-- revisão M4: kudos saiu do Realtime (DELETE sem RLS levava user_id); os contadores sem dado pessoal entram no lugar
select ok(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'kudos')
          and exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'feed_kudos_counts'),
  'Realtime dos aplausos por feed_kudos_counts (sem user_id), não por kudos');

-- ---------------------------------------------------------------------------
-- Fixtures: A e B na crew FEED2; C fora; uma corrida de A no feed
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0023-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       's23' || c || '@t.com', json_build_object('username', 's23_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c']) c;
update public.profiles set faction = 'owls' where id::text like 'e9e9e9e9-0023-%';
insert into public.crews (name, tag, leader_id) values ('Crew Social', 'FEEDY', 'e9e9e9e9-0023-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0023-4000-8000-00000000000b' from public.crews where tag = 'FEEDY';
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
select ('e9e9e9e9-1023-4000-8000-00000000000' || n)::uuid, 'e9e9e9e9-0023-4000-8000-00000000000a', 'valid',
       now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours', 4200, 1400, 333, true
  from generate_series(1, 2) n;
insert into public.feed_items (id, activity_id, user_id, crew_id, day, meters, moving_seconds, avg_pace, highlights, route, route_hidden,
                               created_at)
select ('e9e9e9e9-2023-4000-8000-00000000000' || n)::uuid, ('e9e9e9e9-1023-4000-8000-00000000000' || n)::uuid,
       'e9e9e9e9-0023-4000-8000-00000000000a', (select id from public.crews where tag = 'FEEDY'), public.br_today() - n + 1,
       4200, 1400, 333, '[{"kind": "zone_conquered", "name": "Centro"}]', array['_p~iF~ps|U'], true, now() - n * interval '1 minute'
  from generate_series(1, 2) n;
insert into public.activity_stats (activity_id, user_id, meters, moving_seconds, splits)
values ('e9e9e9e9-1023-4000-8000-000000000001', 'e9e9e9e9-0023-4000-8000-00000000000a', 4200, 1400, '{330,335,333,340}');
insert into public.personal_records (user_id, kind, value, activity_id, day)
values ('e9e9e9e9-0023-4000-8000-00000000000a', 'longest', 4200, 'e9e9e9e9-1023-4000-8000-000000000001', public.br_today());

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ---------------------------------------------------------------------------
-- Flag desligada
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000b');
select throws_like($$ select public.crew_feed() $$, '%FEATURE_DISABLED%', 'feed desligado: crew_feed recusa');
select throws_like($$ select public.my_records() $$, '%FEATURE_DISABLED%', 'recordes desligados: my_records recusa');
reset role;
update public.game_config set value = value || '{"feed": true, "records": true}' where key = 'features';

-- ---------------------------------------------------------------------------
-- crew_feed: B (mesma crew) vê; C (fora) não vê; sem horário
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000b');
create temp table fb as select public.crew_feed() as f;
select is((select jsonb_array_length(f -> 'items') from fb), 2, 'B (mesma crew) vê as 2 corridas de A');
select is((select f #>> '{items,0,author,username}' from fb), 's23_a', 'autor pelo perfil público');
select ok((select f::text !~* '(created|_at"|activity|user_id|e9e9e9e9-1023|e9e9e9e9-0023)' from fb),
  'item sem horário, sem id de corrida e sem id de usuário');
select is((select f #> '{items,0,route}' from fb), '["_p~iF~ps|U"]'::jsonb, 'rota já cortada (polyline)');
select is((select (f #>> '{items,0,day}')::date from fb), public.br_today(), 'só o dia');
select is((select jsonb_array_length(public.crew_feed(1) -> 'items')), 1, 'paginação: limite');
select is((select jsonb_array_length(public.crew_feed(20, (public.crew_feed(1) ->> 'next')::uuid) -> 'items')), 1,
  'paginação: próxima página pelo id do último item');
select is((select count(*)::int from public.kudos), 0, 'B lê os aplausos dos itens que vê (nenhum ainda)');
select throws_ok($$ select * from public.feed_items $$, '42501', null, 'B não lê feed_items direto');
reset role;
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000c');
select is(public.crew_feed() -> 'items', '[]'::jsonb, 'C (sem crew) não vê nada');
select throws_like($$ select public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000001', 'bora') $$, '%NOT_FOUND%',
  'C não reage a item invisível');
select throws_like($$ select public.feed_item_kudos('e9e9e9e9-2023-4000-8000-000000000001') $$, '%NOT_FOUND%',
  'C não vê quem reagiu');
reset role;

-- ---------------------------------------------------------------------------
-- Reações
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000a');
select throws_like($$ select public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000001', 'bora') $$, '%KUDOS_SELF%',
  'ninguém aplaude a própria corrida');
reset role;
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000b');
select throws_like($$ select public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000001', 'comentario') $$, '%VALIDATION%',
  'só as reações prontas (sem comentário)');
select is((public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000001', 'bora') -> 'kudos' ->> 'bora'), '1', 'Bora!');
select is((public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000001', 'fogo') ->> 'myReaction'), 'fogo', 'trocar a reação');
select is((public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000002', 'raio') -> 'kudos' ->> 'raio'), '1', 'Raio em outro item');
select is((select count(*)::int from public.kudos), 2, 'uma reação por pessoa por item');
select is(public.feed_item_kudos('e9e9e9e9-2023-4000-8000-000000000001'),
  '[{"username": "s23_b", "faction": "owls", "avatarUrl": null, "reaction": "fogo"}]'::jsonb, 'quem reagiu: só nome, time e reação');
select is((public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000002', null) ->> 'myReaction'), null, 'desfazer');
reset role;
select results_eq($$ select count(*)::int, max(body) from public.notifications
                     where user_id = 'e9e9e9e9-0023-4000-8000-00000000000a' and type = 'kudos' $$,
  $$ values (2, 'Sua corrida ganhou 1 reação da crew.'::text) $$,
  'quem correu recebe 1 notificação por item por dia (trocar a reação não notifica de novo)');

-- teto de 200 por dia
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, scored)
select ('e9e9e9e9-4023-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'e9e9e9e9-0023-4000-8000-00000000000a', 'valid',
       now() - interval '9 hours', now() - interval '8 hours', now() - interval '8 hours', 1000, true
  from generate_series(1, 199) n;
insert into public.feed_items (id, activity_id, user_id, crew_id, day, meters, moving_seconds, created_at)
select ('e9e9e9e9-3023-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('e9e9e9e9-4023-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'e9e9e9e9-0023-4000-8000-00000000000a', (select id from public.crews where tag = 'FEEDY'), public.br_today(), 1000, 300,
       now() - interval '1 day'
  from generate_series(1, 199) n;
insert into public.kudos (feed_item_id, user_id, reaction, day)
select ('e9e9e9e9-3023-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'e9e9e9e9-0023-4000-8000-00000000000b', 'bora', public.br_today()
  from generate_series(1, 199) n;
-- revisão M1: o teto conta os itens do dia em kudos_log (desfazer não apaga; refazer no mesmo item não conta de novo).
-- A fixture registra 198 itens; com os 2 da RPC acima são 200, e o item 199 (novo no registro) bate no teto.
insert into public.kudos_log (user_id, day, feed_item_id)
select 'e9e9e9e9-0023-4000-8000-00000000000b', public.br_today(), ('e9e9e9e9-3023-4000-8000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 198) n;
delete from public.kudos where feed_item_id = 'e9e9e9e9-3023-4000-8000-000000000199';
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000b');
select throws_like($$ select public.react_feed_item('e9e9e9e9-3023-4000-8000-000000000199', 'bora') $$, '%KUDOS_LIMIT%',
  'teto de 200 reações por dia');
select is((public.react_feed_item('e9e9e9e9-2023-4000-8000-000000000001', 'raio') ->> 'myReaction'), 'raio',
  'trocar uma reação que já existe não conta no teto');
reset role;

-- ---------------------------------------------------------------------------
-- Configurações e recordes
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000a');
select is(public.my_feed_settings(), '{"shareRunsToFeed": true, "feedShowMap": true}'::jsonb, 'padrão: tudo ligado');
select is(public.set_feed_settings(null, false), '{"shareRunsToFeed": true, "feedShowMap": false}'::jsonb, 'desligar o mapa');
reset role;
select is((select count(*)::int from public.feed_items where user_id = 'e9e9e9e9-0023-4000-8000-00000000000a' and route is not null), 0,
  'sem mapa: as rotas já publicadas somem');
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000a');
select is((public.my_records() -> 'records' -> 0 ->> 'value')::int, 4200, 'my_records: a corrida mais longa');
select is((select count(*)::int from public.activity_stats), 1, 'dono lê as próprias parciais');
reset role;
select pg_temp.login('e9e9e9e9-0023-4000-8000-00000000000b');
select is((select count(*)::int from public.activity_stats) + (select count(*)::int from public.personal_records), 0,
  'ninguém lê parciais nem recordes de outra pessoa');
reset role;

select * from finish();
rollback;
