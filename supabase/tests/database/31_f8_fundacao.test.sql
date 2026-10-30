-- Fase 8, onda A, A2 (E9 + E3): D-92 paridade da curva de nível (SQL × domain), D-96 faction_activity(), marcos da
-- pintura (svc_paint_milestones) e eco da crew (crew_echo).
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.mkuser(n text, faction text) returns uuid language plpgsql as $$
declare v uuid := ('e9e9e9e9-0031-4000-8000-0000000000' || n)::uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', 'v31' || n || '@t.com',
          jsonb_build_object('username', 'v31_' || n, 'birthdate', '1995-01-01', 'terms_accepted', true));
  update public.profiles set faction = mkuser.faction where id = v;
  return v;
end $$;

create function pg_temp.run(n text, u uuid, status text, scored boolean, ended interval, extras jsonb default null)
returns uuid language plpgsql as $$
declare v uuid := ('e9e9e9e9-1031-4000-8000-0000000000' || n)::uuid;
begin
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace,
                                 scored, result, v2_extras)
  values (v, u, status, now() - ended - interval '40 minutes', now() - ended, now() - ended, 5000, 1500, 300, scored,
          '{"xp": 0, "zones": []}', extras);
  return v;
end $$;

-- ===========================================================================
-- D-92: uma curva de nível só. Os 50 valores (0 a 50.000 XP: as fronteiras dos níveis 2 a 13 e 24 valores
-- espalhados) e o resultado esperado saem do domain (levelProgress); o Deno `level_parity.test.ts` lê ESTE arquivo
-- entre os marcadores e confere a tabela contra o domain. Aqui, a mesma tabela contra o SQL.
-- ===========================================================================
-- LEVEL_PARITY_BEGIN
select is(
  (select jsonb_agg(jsonb_build_array(x, (private.level_progress(x) ->> 'level')::int,
                                      (private.level_progress(x) ->> 'intoLevel')::int,
                                      (private.level_progress(x) ->> 'needed')::int) order by ord)
     from unnest(array[0, 99, 100, 269, 270, 529, 530, 879, 880, 1339, 1340, 1899, 1900, 2097, 2579, 2580, 3379, 3380,
                       4177, 4299, 4300, 5349, 5350, 6257, 6529, 6530, 7839, 7840, 8337, 10417, 12497, 14577, 16657,
                       18737, 20817, 22897, 24977, 27057, 29137, 31217, 33297, 35377, 37457, 39537, 41617, 43697, 45777,
                       47857, 49937, 50000]::bigint[]) with ordinality u(x, ord)),
  '[[0,1,0,100],[99,1,99,100],[100,2,0,170],[269,2,169,170],[270,3,0,260],[529,3,259,260],[530,4,0,350],[879,4,349,350],[880,5,0,460],[1339,5,459,460],[1340,6,0,560],[1899,6,559,560],[1900,7,0,680],[2097,7,197,680],[2579,7,679,680],[2580,8,0,800],[3379,8,799,800],[3380,9,0,920],[4177,9,797,920],[4299,9,919,920],[4300,10,0,1050],[5349,10,1049,1050],[5350,11,0,1180],[6257,11,907,1180],[6529,11,1179,1180],[6530,12,0,1310],[7839,12,1309,1310],[7840,13,0,1450],[8337,13,497,1450],[10417,14,1127,1600],[12497,15,1607,1740],[14577,17,57,2040],[16657,18,97,2190],[18737,18,2177,2190],[20817,19,2067,2350],[22897,20,1797,2510],[24977,21,1367,2670],[27057,22,777,2830],[29137,23,27,3000],[31217,23,2107,3000],[33297,24,1187,3160],[35377,25,107,3330],[37457,25,2187,3330],[39537,26,937,3500],[41617,26,3017,3500],[43697,27,1597,3680],[45777,27,3677,3680],[47857,28,2077,3850],[49937,29,307,4030],[50000,29,370,4030]]'::jsonb,
  'D-92: nível, XP no nível e XP do nível de 50 valores = levelProgress do domain (uma curva só)');
-- LEVEL_PARITY_END
select is((select (private.level_progress((pr.xp)::bigint) ->> 'level')::int from public.profiles pr limit 1) >= 1, true,
  'D-92: o nível do perfil sai de private.level_progress (a mesma função do my_engagement)');

-- ===========================================================================
-- D-96: faction_activity()
-- ===========================================================================
select pg_temp.mkuser('a1', 'striders');
select pg_temp.mkuser('a2', 'striders');
select pg_temp.mkuser('a3', 'owls');
select pg_temp.mkuser('a4', 'coyotes');
select pg_temp.mkuser('d1', 'volt');
update public.profiles set is_demo = true where id = 'e9e9e9e9-0031-4000-8000-0000000000d1';

select is(has_function_privilege('anon', 'public.faction_activity()', 'execute'), false, 'D-96: anon não chama faction_activity');
select is(has_function_privilege('authenticated', 'public.faction_activity()', 'execute'), true, 'D-96: authenticated chama');

select pg_temp.login('e9e9e9e9-0031-4000-8000-0000000000a1');
create temp table fa0 as select public.faction_activity() as r;
select pg_temp.login('e9e9e9e9-0031-4000-8000-0000000000d1');
create temp table fd0 as select public.faction_activity() as r;
select pg_temp.logout();

select pg_temp.run('01', 'e9e9e9e9-0031-4000-8000-0000000000a1', 'valid', true, interval '1 day');
select pg_temp.run('02', 'e9e9e9e9-0031-4000-8000-0000000000a1', 'valid', true, interval '2 days');   -- a mesma pessoa: conta 1
select pg_temp.run('03', 'e9e9e9e9-0031-4000-8000-0000000000a2', 'partial', true, interval '3 days');
select pg_temp.run('04', 'e9e9e9e9-0031-4000-8000-0000000000a3', 'valid', true, interval '10 days');  -- fora da janela
select pg_temp.run('05', 'e9e9e9e9-0031-4000-8000-0000000000a3', 'review', false, interval '1 day');  -- em revisão
select pg_temp.run('06', 'e9e9e9e9-0031-4000-8000-0000000000a4', 'valid', true, interval '1 day');
update public.profiles set status = 'suspended' where id = 'e9e9e9e9-0031-4000-8000-0000000000a4';      -- suspensa
select pg_temp.run('07', 'e9e9e9e9-0031-4000-8000-0000000000d1', 'valid', true, interval '1 day');    -- demonstração

select pg_temp.login('e9e9e9e9-0031-4000-8000-0000000000a1');
create temp table fa1 as select public.faction_activity() as r;
select pg_temp.login('e9e9e9e9-0031-4000-8000-0000000000d1');
create temp table fd1 as select public.faction_activity() as r;
select pg_temp.logout();

select is((select jsonb_build_object('striders', (a1.r #>> '{counts,striders}')::int - (a0.r #>> '{counts,striders}')::int,
                                     'coyotes', (a1.r #>> '{counts,coyotes}')::int - (a0.r #>> '{counts,coyotes}')::int,
                                     'owls', (a1.r #>> '{counts,owls}')::int - (a0.r #>> '{counts,owls}')::int,
                                     'volt', (a1.r #>> '{counts,volt}')::int - (a0.r #>> '{counts,volt}')::int)
             from fa0 a0, fa1 a1),
  '{"striders": 2, "coyotes": 0, "owls": 0, "volt": 0}'::jsonb,
  'D-96: conta pessoas (não corridas) com corrida aceita em 7 dias; fora: revisão, > 7 dias, conta suspensa e demonstração');
select is((select (r ->> 'isDemo')::boolean from fa1), false, 'D-96: conta real recebe isDemo = false');
select is((select (d1.r #>> '{counts,volt}')::int - (d0.r #>> '{counts,volt}')::int from fd0 d0, fd1 d1), 1,
  'D-96: conta de demonstração só conta a demonstração');
select is((select (r ->> 'isDemo')::boolean from fd1), true, 'D-96: e vem marcada como demonstração');
select is((select array_agg(k order by k) from fa1, jsonb_object_keys(r) k),
  array['counts', 'isDemo', 'since', 'total', 'windowDays'], 'D-96: só números (nenhum id, nome ou lugar)');
select is((select array_agg(k order by k) from fa1, jsonb_object_keys(r -> 'counts') k),
  array['coyotes', 'owls', 'striders', 'volt'], 'D-96: os 4 times sempre aparecem');
select is((select (r ->> 'total')::int = (select sum(v::int) from jsonb_each_text(r -> 'counts') e(k, v)) from fa1), true,
  'D-96: total = soma dos times');
select pg_temp.logout();
select throws_ok($$ select public.faction_activity() $$, 'P0001', 'UNAUTHORIZED: faça login novamente',
  'D-96: sem login não há contagem');

-- ===========================================================================
-- Marcos da pintura: primeiro trecho (1 vez na vida) e recorde de trechos numa corrida
-- ===========================================================================
select is(has_function_privilege('authenticated', 'public.svc_paint_milestones(uuid, uuid)', 'execute'), false,
  'marcos: só o service_role chama svc_paint_milestones');
-- pessoa M: a1 sem trechos, a2 (12), a3 (30), a4 (20, a mais nova), a5 sem pintura (regra v1)
create temp table mm as select ('e9e9e9e9-0031-4000-8000-0000000000' || 'b1')::uuid as u;
select pg_temp.mkuser('b1', 'striders');
select pg_temp.run('21', (select u from mm), 'valid', true, interval '4 days', '{"version": 1, "paint": {"rule": "v2", "cells": 0}}');
select pg_temp.run('22', (select u from mm), 'valid', true, interval '3 days', '{"version": 1, "paint": {"rule": "v2", "cells": 12}}');
select pg_temp.run('23', (select u from mm), 'valid', true, interval '2 days', '{"version": 1, "paint": {"rule": "v2", "cells": 30}}');
select pg_temp.run('24', (select u from mm), 'valid', true, interval '1 hour', '{"version": 1, "paint": {"rule": "v2", "cells": 20}}');
select pg_temp.run('25', (select u from mm), 'valid', true, interval '30 minutes', '{"version": 1, "scored": true}');

select is(public.svc_paint_milestones((select u from mm), 'e9e9e9e9-1031-4000-8000-000000000022'),
  '{"firstPaint": true, "cells": 12, "cellsRecord": null}'::jsonb, 'marcos: a 1ª corrida com trechos ganha o "primeiro trecho"');
select is(public.svc_paint_milestones((select u from mm), 'e9e9e9e9-1031-4000-8000-000000000022'),
  '{"firstPaint": true, "cells": 12, "cellsRecord": null}'::jsonb, 'marcos: repetir devolve o mesmo (idempotente)');
select is((select v2_extras -> 'milestones' from public.activities where id = 'e9e9e9e9-1031-4000-8000-000000000022'),
  '{"firstPaint": true, "cells": 12, "cellsRecord": null}'::jsonb, 'marcos: gravado em activities.v2_extras.milestones');
select is(public.svc_paint_milestones((select u from mm), 'e9e9e9e9-1031-4000-8000-000000000023'),
  '{"firstPaint": false, "cells": 30, "cellsRecord": {"value": 30, "previous": 20}}'::jsonb,
  'marcos: recorde = mais trechos que qualquer outra corrida da pessoa (e nunca outro "primeiro trecho")');
select is(public.svc_paint_milestones((select u from mm), 'e9e9e9e9-1031-4000-8000-000000000024'),
  '{"firstPaint": false, "cells": 20, "cellsRecord": null}'::jsonb, 'marcos: abaixo do recorde não é recorde');
select is(public.svc_paint_milestones((select u from mm), 'e9e9e9e9-1031-4000-8000-000000000021'),
  '{"firstPaint": false, "cells": 0, "cellsRecord": null}'::jsonb, 'marcos: corrida sem trechos não ganha nada');
select is(public.svc_paint_milestones((select u from mm), 'e9e9e9e9-1031-4000-8000-000000000025'), null,
  'marcos: regra v1 (sem pintura) não tem marco');
select is(public.svc_paint_milestones('e9e9e9e9-0031-4000-8000-0000000000a1', 'e9e9e9e9-1031-4000-8000-000000000022'), null,
  'marcos: corrida de outra pessoa → null');

-- ordem das chamadas: a mais nova é avaliada antes da mais antiga → só a mais antiga é o "primeiro trecho"
select pg_temp.mkuser('b2', 'owls');
select pg_temp.run('31', 'e9e9e9e9-0031-4000-8000-0000000000b2', 'valid', true, interval '2 hours', '{"version": 1, "paint": {"cells": 5}}');
select pg_temp.run('32', 'e9e9e9e9-0031-4000-8000-0000000000b2', 'valid', true, interval '1 hour', '{"version": 1, "paint": {"cells": 8}}');
select is(array[(public.svc_paint_milestones('e9e9e9e9-0031-4000-8000-0000000000b2', 'e9e9e9e9-1031-4000-8000-000000000032') ->> 'firstPaint')::boolean,
                (public.svc_paint_milestones('e9e9e9e9-0031-4000-8000-0000000000b2', 'e9e9e9e9-1031-4000-8000-000000000031') ->> 'firstPaint')::boolean],
  array[false, true], 'marcos: fora de ordem, um único "primeiro trecho" (o da corrida que terminou antes)');
-- a mais antiga só é gravada depois que a mais nova já ganhou o marco → não ganha de novo
select pg_temp.mkuser('b3', 'volt');
select pg_temp.run('41', 'e9e9e9e9-0031-4000-8000-0000000000b3', 'valid', true, interval '2 hours', null);
select pg_temp.run('42', 'e9e9e9e9-0031-4000-8000-0000000000b3', 'valid', true, interval '1 hour', '{"version": 1, "paint": {"cells": 4}}');
select is((public.svc_paint_milestones('e9e9e9e9-0031-4000-8000-0000000000b3', 'e9e9e9e9-1031-4000-8000-000000000042') ->> 'firstPaint')::boolean,
  true, 'marcos: a primeira avaliada sem histórico ganha o marco');
update public.activities set v2_extras = '{"version": 1, "paint": {"cells": 9}}' where id = 'e9e9e9e9-1031-4000-8000-000000000041';
select is(public.svc_paint_milestones('e9e9e9e9-0031-4000-8000-0000000000b3', 'e9e9e9e9-1031-4000-8000-000000000041'),
  '{"firstPaint": false, "cells": 9, "cellsRecord": {"value": 9, "previous": 4}}'::jsonb,
  'marcos: "primeiro trecho" é 1 vez na vida, mesmo para uma corrida que terminou antes');

-- ===========================================================================
-- Eco da crew
-- ===========================================================================
select pg_temp.mkuser('e1', 'striders');
select pg_temp.mkuser('e2', 'striders');
select pg_temp.mkuser('e3', 'striders');
select pg_temp.mkuser('e4', 'striders');
select pg_temp.mkuser('e5', 'striders');
insert into public.crews (id, name, tag, faction, leader_id)
values ('e9e9e9e9-2031-4000-8000-000000000001', 'Eco Teste', 'ECOTT', 'striders', 'e9e9e9e9-0031-4000-8000-0000000000e1');
insert into public.crew_members (crew_id, user_id, role) values
  ('e9e9e9e9-2031-4000-8000-000000000001', 'e9e9e9e9-0031-4000-8000-0000000000e1', 'leader'),
  ('e9e9e9e9-2031-4000-8000-000000000001', 'e9e9e9e9-0031-4000-8000-0000000000e2', 'member'),
  ('e9e9e9e9-2031-4000-8000-000000000001', 'e9e9e9e9-0031-4000-8000-0000000000e3', 'member'),
  ('e9e9e9e9-2031-4000-8000-000000000001', 'e9e9e9e9-0031-4000-8000-0000000000e4', 'member')
on conflict (user_id) do nothing;  -- a líder (e1) já entra sozinha ao criar a crew
insert into public.user_settings (user_id, share_runs_to_feed) values ('e9e9e9e9-0031-4000-8000-0000000000e3', false)
on conflict (user_id) do update set share_runs_to_feed = false;
insert into public.zones (id, name, city, geom) values
  ('89a90128e3bffff', 'Zona POA 1', 'Porto Alegre', extensions.st_makeenvelope(-51.221, -30.037, -51.216, -30.033, 4326))
on conflict (id) do nothing;
insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng) values
  ('8ba90128e380fff', '89a90128e3bffff', 'striders', 1, now(), -30.034855651402665, -51.21832660540752),
  ('8ba90128e381fff', '89a90128e3bffff', 'striders', 2, now(), -30.034621161960484, -51.21875166319014),
  ('8ba90128e382fff', '89a90128e3bffff', 'striders', 1, now(), -30.034695123668254, -51.21788552638041),
  ('8ba90128e383fff', '89a90128e3bffff', 'striders', 1, now(), -30.034460634923736, -51.21831058523841)
on conflict (cell) do nothing;
-- e4 mora perto desses trechos: tudo o que ela pinta ali fica fora do eco
insert into public.privacy_zones (user_id, lat, lng, radius_m) values ('e9e9e9e9-0031-4000-8000-0000000000e4', -30.03475, -51.2183, 50);
-- "hoje" = 04/11/2026 (Brasília): ontem = 03/11, anteontem = 02/11
insert into public.paint_marks (user_id, day, cell) values
  ('e9e9e9e9-0031-4000-8000-0000000000e1', '2026-11-02', '8ba90128e380fff'),
  ('e9e9e9e9-0031-4000-8000-0000000000e1', '2026-11-02', '8ba90128e381fff'),
  ('e9e9e9e9-0031-4000-8000-0000000000e1', '2026-11-03', '8ba90128e382fff'),
  ('e9e9e9e9-0031-4000-8000-0000000000e2', '2026-11-03', '8ba90128e380fff'),
  ('e9e9e9e9-0031-4000-8000-0000000000e2', '2026-11-03', '8ba90128e381fff'),
  ('e9e9e9e9-0031-4000-8000-0000000000e2', '2026-11-03', '8ba90128e382fff'),
  ('e9e9e9e9-0031-4000-8000-0000000000e2', '2026-11-03', '8ba90128e383fff'),   -- não é trecho de e1
  ('e9e9e9e9-0031-4000-8000-0000000000e2', '2026-11-02', '8ba90128e380fff'),   -- anteontem: não é o dia do eco
  ('e9e9e9e9-0031-4000-8000-0000000000e3', '2026-11-03', '8ba90128e380fff'),   -- não compartilha com a crew
  ('e9e9e9e9-0031-4000-8000-0000000000e4', '2026-11-03', '8ba90128e380fff'),   -- zona de privacidade dela
  ('e9e9e9e9-0031-4000-8000-0000000000e4', '2026-11-03', '8ba90128e381fff'),
  ('e9e9e9e9-0031-4000-8000-0000000000e5', '2026-11-03', '8ba90128e380fff');   -- fora da crew

create temp table eco as select private.crew_echo_at('e9e9e9e9-0031-4000-8000-0000000000e1',
                                                     timestamp '2026-11-04 12:00' at time zone 'America/Sao_Paulo') as r;
select is((select r - 'notifyFrom' - 'notifyUntil' from eco),
  '{"day": "2026-11-03", "mate": {"username": "v31_e2"}, "cells": 3, "othersCount": 0, "totalCells": 3}'::jsonb,
  'eco: só o colega que compartilha, só os trechos de quem pede, fora da zona de privacidade do colega e fora da crew');
select is((select (r ->> 'notifyFrom')::bigint from eco),
  private.ts_to_ms(timestamp '2026-11-04 07:00' at time zone 'America/Sao_Paulo'), 'eco: aviso a partir das 07h');
select is(array[private.crew_echo_at('e9e9e9e9-0031-4000-8000-0000000000e1', timestamp '2026-11-04 06:59' at time zone 'America/Sao_Paulo'),
                private.crew_echo_at('e9e9e9e9-0031-4000-8000-0000000000e1', timestamp '2026-11-04 22:00' at time zone 'America/Sao_Paulo')],
  array[null, null]::jsonb[], 'eco: nunca entre 22h e 7h');
select is(private.crew_echo_at('e9e9e9e9-0031-4000-8000-0000000000e5', timestamp '2026-11-04 12:00' at time zone 'America/Sao_Paulo'),
  null, 'eco: sem crew, sem eco');
select is(private.crew_echo_at('e9e9e9e9-0031-4000-8000-0000000000e1', timestamp '2026-11-05 12:00' at time zone 'America/Sao_Paulo'),
  null, 'eco: um agregado por dia (o de ontem); sem reforço ontem, null');
update public.game_config set value = value || '{"feed": false}' where key = 'features';
select pg_temp.login('e9e9e9e9-0031-4000-8000-0000000000e1');
select throws_ok($$ select public.crew_echo() $$, 'P0001', 'FEATURE_DISABLED: feed ainda não está ligado',
  'eco: atrás da flag feed');
select pg_temp.logout();
select is(has_function_privilege('authenticated', 'private.crew_echo_at(uuid, timestamptz)', 'execute'), false,
  'eco: a regra com relógio não é chamável pelo app');

select * from finish();
rollback;
