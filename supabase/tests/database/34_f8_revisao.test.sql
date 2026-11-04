-- Fase 8, onda D (E9): correções da revisão F8-D (20261104120300_f8_revisao).
--   M2: eco da crew respeita "mostrar mapa no feed" do colega;
--   B5: eco e join_crew não misturam conta real com conta de demonstração; eco devolve isDemo;
--   B1: faction_activity() sem sessão lê do cache (5 min) e devolve só { needsBoost, isDemo }.
-- Cada caso marcado [antes: falha] falha com as migrations até 20261104120200 e passa com esta.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.mkuser(n text, demo boolean default false) returns uuid language plpgsql as $$
declare v uuid := ('e9e9e9e9-0034-4000-8000-0000000000' || n)::uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', 'v34' || n || '@t.com',
          jsonb_build_object('username', 'v34_' || n, 'birthdate', '1995-01-01', 'terms_accepted', true));
  update public.profiles set faction = 'striders', is_demo = demo where id = v;
  return v;
end $$;

create function pg_temp.uid(n text) returns uuid language sql as $$ select ('e9e9e9e9-0034-4000-8000-0000000000' || n)::uuid $$;

create function pg_temp.crew(n text, tag text, leader text) returns uuid language plpgsql as $$
declare v uuid := ('e9e9e9e9-2034-4000-8000-0000000000' || n)::uuid;
begin
  insert into public.crews (id, name, tag, faction, leader_id) values (v, 'Revisao ' || tag, tag, 'striders', pg_temp.uid(leader));
  insert into public.crew_members (crew_id, user_id, role) values (v, pg_temp.uid(leader), 'leader')
  on conflict (user_id) do nothing;   -- a líder já entra sozinha ao criar a crew
  return v;
end $$;

create function pg_temp.member(crew text, n text) returns void language sql as $$
  insert into public.crew_members (crew_id, user_id, role)
  values (('e9e9e9e9-2034-4000-8000-0000000000' || crew)::uuid, pg_temp.uid(n), 'member')
$$;

create function pg_temp.eco(n text) returns jsonb language sql as $$
  select private.crew_echo_at(pg_temp.uid(n), timestamp '2026-11-04 12:00' at time zone 'America/Sao_Paulo')
$$;

-- trechos com lugar conhecido (os mesmos do 31); "hoje" = 04/11/2026, ontem = 03/11
insert into public.zones (id, name, city, geom) values
  ('89a90128e3bffff', 'Zona POA 1', 'Porto Alegre', extensions.st_makeenvelope(-51.221, -30.037, -51.216, -30.033, 4326))
on conflict (id) do nothing;
insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng) values
  ('8ba90128e380fff', '89a90128e3bffff', 'striders', 1, now(), -30.034855651402665, -51.21832660540752),
  ('8ba90128e381fff', '89a90128e3bffff', 'striders', 1, now(), -30.034621161960484, -51.21875166319014)
on conflict (cell) do nothing;

-- ===========================================================================
-- M2: colega com o mapa do feed escondido não aparece no eco
-- ===========================================================================
select pg_temp.mkuser('a1');
select pg_temp.mkuser('a2');
select pg_temp.crew('01', 'RVMAP', 'a1');
select pg_temp.member('01', 'a2');
insert into public.user_settings (user_id, feed_show_map) values (pg_temp.uid('a2'), false)
on conflict (user_id) do update set feed_show_map = false;
insert into public.paint_marks (user_id, day, cell) values
  (pg_temp.uid('a1'), '2026-11-03', '8ba90128e380fff'),
  (pg_temp.uid('a2'), '2026-11-03', '8ba90128e380fff');

select is(pg_temp.eco('a1'), null, 'M2 [antes: falha]: colega com "mostrar mapa no feed" desligado fica fora do eco');
update public.user_settings set feed_show_map = true where user_id = pg_temp.uid('a2');
select is(pg_temp.eco('a1') #>> '{mate,username}', 'v34_a2', 'M2 (controle): com o mapa visível, o colega volta ao eco');
select is((pg_temp.eco('a1') ->> 'isDemo')::boolean, false, 'B5 [antes: falha]: eco de conta real vem com isDemo = false');
update public.user_settings set share_runs_to_feed = false where user_id = pg_temp.uid('a2');
select is(pg_temp.eco('a1'), null, 'M2 (controle): "mostrar minhas corridas na crew" desligado continua fora');

-- ===========================================================================
-- B5: eco só com colegas do mesmo tipo de conta
-- ===========================================================================
select pg_temp.mkuser('b1');
select pg_temp.mkuser('b2', true);        -- demonstração numa crew real (entrou antes da trava do join_crew)
select pg_temp.crew('02', 'RVREA', 'b1');
select pg_temp.member('02', 'b2');
insert into public.paint_marks (user_id, day, cell) values
  (pg_temp.uid('b1'), '2026-11-03', '8ba90128e380fff'),
  (pg_temp.uid('b2'), '2026-11-03', '8ba90128e380fff');
select is(pg_temp.eco('b1'), null, 'B5 [antes: falha]: conta real não recebe eco de colega de demonstração');

select pg_temp.mkuser('d1', true);
select pg_temp.mkuser('d2', true);
select pg_temp.mkuser('d3');              -- conta real numa crew de demonstração
select pg_temp.crew('03', 'RVDEM', 'd1');
select pg_temp.member('03', 'd2');
select pg_temp.member('03', 'd3');
insert into public.paint_marks (user_id, day, cell) values
  (pg_temp.uid('d1'), '2026-11-03', '8ba90128e380fff'),
  (pg_temp.uid('d1'), '2026-11-03', '8ba90128e381fff'),
  (pg_temp.uid('d2'), '2026-11-03', '8ba90128e380fff'),
  (pg_temp.uid('d3'), '2026-11-03', '8ba90128e381fff');
select is(pg_temp.eco('d1') - 'notifyFrom' - 'notifyUntil',
  '{"day": "2026-11-03", "mate": {"username": "v34_d2"}, "cells": 1, "othersCount": 0, "totalCells": 1, "isDemo": true}'::jsonb,
  'B5 [antes: falha]: demonstração só conta demonstração (a conta real d3 fica fora) e vem com isDemo = true');
select is(pg_temp.eco('d3'), null, 'B5 [antes: falha]: a conta real d3 não recebe eco dos colegas de demonstração');

-- ===========================================================================
-- B5: join_crew não mistura real com demonstração
-- ===========================================================================
delete from public.crew_members where user_id = pg_temp.uid('d3');   -- a crew de demonstração volta a ser só demonstração
select pg_temp.mkuser('c1');              -- real, sem crew
select pg_temp.mkuser('c2', true);        -- demonstração, sem crew
create temp table rv_codes as
  select (select invite_code from public.crews where tag = 'RVDEM') as demo_code,
         (select invite_code from public.crews where tag = 'RVMAP') as real_code;
grant select on rv_codes to authenticated;

select pg_temp.login(pg_temp.uid('c1'));
select throws_ok($$ select public.join_crew((select demo_code from rv_codes)) $$, 'P0001',
  'CREW_NOT_FOUND: código de convite inválido', 'B5 [antes: falha]: conta real não entra em crew de demonstração (como código inválido)');
select lives_ok($$ select public.join_crew((select real_code from rv_codes)) $$, 'B5 (controle): conta real entra em crew real');
select pg_temp.login(pg_temp.uid('c2'));
select throws_ok($$ select public.join_crew((select real_code from rv_codes)) $$, 'P0001',
  'CREW_NOT_FOUND: código de convite inválido', 'B5 [antes: falha]: conta de demonstração não entra em crew real');
select lives_ok($$ select public.join_crew((select demo_code from rv_codes)) $$, 'B5 (controle): demonstração entra em crew de demonstração');
select pg_temp.logout();
select is((select count(*)::int from public.crew_members cm join public.crews c on c.id = cm.crew_id
            where c.tag = 'RVMAP' and cm.user_id = pg_temp.uid('c2')), 0, 'B5: a tentativa recusada não deixou linha');

-- ===========================================================================
-- B1: a regra do selo no SQL = factionNeedingBoost do domain
-- ===========================================================================
-- O Deno `f8_revisao.test.ts` lê ESTE bloco e confere cada caso contra o domain.
-- BOOST_PARITY_BEGIN
select is(
  (select jsonb_agg(to_jsonb(private.faction_needing_boost(c)) order by ord)
     from jsonb_array_elements('[{"striders": 3, "coyotes": 3, "owls": 1, "volt": 2}, {"striders": 1, "coyotes": 1, "owls": 1, "volt": 0}, {"striders": 1, "coyotes": 1, "owls": 1, "volt": 1}, {"striders": 2, "coyotes": 1, "owls": 1, "volt": 1}, {"striders": 0, "coyotes": 2, "owls": 2, "volt": 2}, {"striders": 5}, {"striders": "9", "coyotes": 3, "owls": 3, "volt": 3}, {"striders": -4, "coyotes": 2, "owls": 2, "volt": 2}, {"striders": 2.9, "coyotes": 2.2, "owls": 3, "volt": 3}, {"striders": 0.5, "coyotes": 2, "owls": 2, "volt": 2}, {"striders": 4, "coyotes": 0, "owls": 0, "volt": 1}, {"striders": 10, "coyotes": 7, "owls": 7, "volt": 6}, {}, {"striders": 1, "coyotes": 1, "owls": 1, "volt": 2}, {"striders": 2, "coyotes": 2, "owls": 2, "volt": 1}]'::jsonb)
          with ordinality t(c, ord)),
  '["owls", null, null, null, "striders", null, "striders", "striders", null, "striders", null, "volt", null, null, "volt"]'::jsonb,
  'B1 [antes: falha]: needsBoost no SQL = factionNeedingBoost (total < 4, empate, lixo vira 0, fração arredonda para baixo)');
-- BOOST_PARITY_END

-- ===========================================================================
-- B1: faction_activity() sem sessão: cache e só { needsBoost, isDemo }
-- ===========================================================================
select is(has_table_privilege('anon', 'private.faction_activity_cache', 'select'), false, 'B1: anon não lê o cache');
select is(has_table_privilege('authenticated', 'private.faction_activity_cache', 'select'), false, 'B1: authenticated não lê o cache');
select is((select relrowsecurity from pg_class where oid = 'private.faction_activity_cache'::regclass), true, 'B1: cache com RLS ligada');
select is(has_function_privilege('anon', 'private.faction_activity_anon_at(timestamptz)', 'execute'), false,
  'B1: a regra com relógio não é chamável de fora');

delete from private.faction_activity_cache;
select pg_temp.as_anon();
create temp table fa_anon as select public.faction_activity() as r;
select pg_temp.logout();
select is((select array_agg(k order by k) from fa_anon, jsonb_object_keys(r) k), array['isDemo', 'needsBoost'],
  'B1 [antes: falha]: sem sessão só needsBoost e isDemo (sem contagens)');
select is((select refreshed_at from private.faction_activity_cache where is_demo = false), now(),
  'B1 [antes: falha]: a 1ª chamada sem sessão grava o cache');

-- dentro dos 5 min, a resposta sai do cache (não da contagem ao vivo)
update private.faction_activity_cache set counts = '{"striders": 9, "coyotes": 9, "owls": 1, "volt": 9}' where is_demo = false;
select pg_temp.as_anon();
create temp table fa_cached as select public.faction_activity() as r;
select pg_temp.logout();
select is((select r from fa_cached), '{"needsBoost": "owls", "isDemo": false}'::jsonb,
  'B1 [antes: falha]: com o cache recente, sem sessão lê do cache');
-- com 5 min, o próximo pedido refaz com a contagem ao vivo (só contas reais)
select is(private.faction_activity_anon_at(now() + interval '5 minutes'),
  jsonb_build_object('needsBoost', private.faction_needing_boost(private.faction_counts(false, now() + interval '5 minutes')),
                     'isDemo', false),
  'B1 [antes: falha]: cache com 5 min é refeito pela contagem ao vivo');
select is((select counts from private.faction_activity_cache where is_demo = false),
  private.faction_counts(false, now() + interval '5 minutes'), 'B1 [antes: falha]: e o cache guarda a contagem nova');

-- com sessão: contagens ao vivo + needsBoost
select pg_temp.login(pg_temp.uid('a1'));
create temp table fa_auth as select public.faction_activity() as r;
select pg_temp.logout();
select is((select r -> 'needsBoost' from fa_auth), coalesce(to_jsonb(private.faction_needing_boost((select r -> 'counts' from fa_auth))), 'null'::jsonb),
  'B1 [antes: falha]: com sessão, needsBoost (mesma regra) junto das contagens');

select * from finish();
rollback;
