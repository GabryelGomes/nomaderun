-- T7.2.1 (D-62, D-84; contrato E3 §3–§4) — pintura de ruas no banco: esquema e RLS (sem autor, cliente não lê),
-- placar/dono (zoneCounts, zoneOwnerByCells, isZoneUnderAttackV2), retrato zone_paint_near (sem autor, sem hora,
-- sem zonas de privacidade), virada v1 → v2 com herança, job de desbotar (idempotente), temporada da pintura,
-- jobs antigos só na v1 e o rodízio do chefão sem a Fuligem em agosto e setembro.
-- Zonas e trechos H3 reais de Porto Alegre (fora do seed), gerados com o h3-js do projeto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- ---------------------------------------------------------------------------
-- Esquema, RLS e grants
-- ---------------------------------------------------------------------------
select is((select array_agg(t order by t) from unnest(array['zone_cells', 'paint_marks']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'select')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_any_column_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'zone_cells e paint_marks: RLS ligada e nenhum acesso do cliente (nem leitura)');
select is((select array_agg(column_name::text order by column_name) from information_schema.columns
            where table_schema = 'public' and table_name = 'zone_cells' and (column_name like '%user%' or column_name like '%by' or data_type = 'uuid')),
  null, 'zone_cells não tem autor (nenhuma coluna de usuário)');
select ok(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('zone_cells', 'paint_marks')),
  'pintura fora do Realtime');
select has_column('public', 'zones', 'inherit_until', 'zones ganhou as colunas da pintura (herança)');
select has_column('public', 'zones', 'attack_flips', 'zones ganhou as colunas da pintura (ataque v2)');
select ok(has_function_privilege('authenticated', 'public.zone_paint_near(double precision, double precision, integer)', 'execute')
          and not has_function_privilege('anon', 'public.zone_paint_near(double precision, double precision, integer)', 'execute'),
  'zone_paint_near: só para quem está logado');
select ok(not has_function_privilege('authenticated', 'public.job_fade_cells(timestamptz)', 'execute')
          and has_function_privilege('service_role', 'public.job_fade_cells(timestamptz)', 'execute')
          and not has_function_privilege('authenticated', 'public.job_territory_switch(timestamptz)', 'execute'),
  'jobs da pintura só para o service role');
select is((select schedule from cron.job where jobname = 'nomaderun-fade-cells'), '0 6 * * *', 'desbotar às 03:00 de Brasília');
select ok((select command from cron.job where jobname = 'nomaderun-decay-zones') like '%territory_rule() = ''v1''%'
          and (select command from cron.job where jobname = 'nomaderun-fortify-zones') like '%territory_rule() = ''v1''%',
  'decaimento e fortificar por influência só rodam na v1');
select throws_ok($$ insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng)
                    values ('8ba90128e380fff', '89a90128e3bffff', 'volt', 1, now(), -30, -51) $$,
  '23503', null, 'trecho só entra em zona que existe');
select throws_ok($$ insert into public.zones (id, geom) values ('89a90128e0fffff', extensions.st_makeenvelope(0, 0, 1, 1, 4326));
                    insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng)
                    values ('8ba90128e380fff', '89a90128e0fffff', 'volt', 1, now(), -30, -51) $$,
  '23514', null, 'trecho só entra na zona-mãe dele (h3_parent res 9)');

-- ---------------------------------------------------------------------------
-- Fixtures: duas zonas vizinhas; A (striders), B (coyotes); C (volt) com zona de privacidade sobre um trecho
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0021-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'p21' || c || '@t.com', json_build_object('username', 'p21_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c']) c;
update public.profiles set faction = 'striders' where id = 'e9e9e9e9-0021-4000-8000-00000000000a';
update public.profiles set faction = 'coyotes' where id = 'e9e9e9e9-0021-4000-8000-00000000000b';
update public.profiles set faction = 'volt' where id = 'e9e9e9e9-0021-4000-8000-00000000000c';
insert into public.zones (id, name, city, geom, owner, influence) values
  ('89a90128e3bffff', 'Zona POA 1', 'Porto Alegre', extensions.st_setsrid(extensions.st_geomfromgeojson(
    '{"type":"Polygon","coordinates":[[[-51.2173721778165,-30.036324475878015],[-51.21630560724396,-30.0350282146007],[-51.217260040920266,-30.033559365310325],[-51.21928102307092,-30.03338679177478],[-51.22034758026746,-30.034683058704122],[-51.219393168690495,-30.036151893517015],[-51.2173721778165,-30.036324475878015]]]}'), 4326),
   'coyotes', '{"striders": 0, "coyotes": 80, "owls": 0, "volt": 0}'),
  ('89a90128e0fffff', 'Zona POA 2', 'Porto Alegre', extensions.st_setsrid(extensions.st_geomfromgeojson(
    '{"type":"Polygon","coordinates":[[[-51.21439671011163,-30.03796580771684],[-51.21333012616855,-30.036669552092093],[-51.21428458578148,-30.035200748296834],[-51.21630560724396,-30.0350282146007],[-51.2173721778165,-30.036324475878015],[-51.21641774029824,-30.03779326519891],[-51.21439671011163,-30.03796580771684]]]}'), 4326),
   null, '{"striders": 0, "coyotes": 0, "owls": 0, "volt": 0}');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.cell(c text, z text, f text, l integer, at timestamptz, lat double precision, lng double precision) returns void
language sql as $$
  insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng) values (c, z, f, l, at, lat, lng)
$$;

-- ---------------------------------------------------------------------------
-- Funções puras (paridade com paint.ts)
-- ---------------------------------------------------------------------------
select is(array[private.paint_effective_layers(3, now(), now()), private.paint_effective_layers(3, now() - interval '8 days', now()),
                private.paint_effective_layers(1, now() - interval '7 days', now()), private.paint_effective_layers(5, now(), now()),
                private.paint_effective_layers(2, now() - interval '13 days', now())],
  array[3, 2, 0, 3, 1], 'effectiveLayers: perde 1 camada a cada 7 dias, no máximo 3');
select is(array[private.paint_owner('{"striders": 3}', null), private.paint_owner('{"striders": 2}', null),
                private.paint_owner('{"striders": 3, "coyotes": 3}', 'coyotes'), private.paint_owner('{"striders": 3, "coyotes": 3}', 'owls'),
                private.paint_owner('{"striders": 4, "coyotes": 3}', 'coyotes'), private.paint_owner('{}', 'volt')],
  array['striders', null, 'coyotes', null, 'striders', null], 'zoneOwnerByCells: mínimo 3, maioria sozinha, empate mantém o dono');
select is(private.paint_influence('{"striders": 2, "volt": 5}'), '{"striders": 20, "coyotes": 0, "owls": 0, "volt": 50}'::jsonb,
  'espelho v1 para o app antigo: influência = trechos × 10');

-- ---------------------------------------------------------------------------
-- Virada v1 → v2: herança de 3 trechos virtuais do dono por 7 dias (trigger em game_config)
-- ---------------------------------------------------------------------------
select is(public.job_fade_cells()->>'rule', 'v1', 'na v1 o job de desbotar só limpa paint_marks');
update public.game_config set value = '"v2"' where key = 'territory_rule';
select results_eq($$ select owner, inherit_faction, inherit_cells::int, rule_version::int, influence ->> 'coyotes'
                       from public.zones where id = '89a90128e3bffff' $$,
  $$ values ('coyotes'::text, 'coyotes'::text, 3, 2, '30'::text) $$, 'zona com dono herdou 3 trechos virtuais do dono');
select ok((select inherit_until between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days'
             from public.zones where id = '89a90128e3bffff'), 'herança vale 7 dias');
select results_eq($$ select inherit_faction, rule_version::int from public.zones where id = '89a90128e0fffff' $$,
  $$ values (null::text, 2) $$, 'zona sem dono não herda nada');
select is(public.job_territory_switch(), 0, 'virada idempotente: rodar de novo não mexe em nada');
select is(private.paint_counts('89a90128e3bffff', now()), '{"striders": 0, "coyotes": 3, "owls": 0, "volt": 0}'::jsonb,
  'placar com a herança: 3 do dono');

-- trechos: 4 striders na zona 1 (um deles dentro da zona de privacidade de C), 1 owls que já desbotou
select pg_temp.cell('8ba90128e380fff', '89a90128e3bffff', 'striders', 1, now(), -30.034855651402665, -51.21832660540752);
select pg_temp.cell('8ba90128e381fff', '89a90128e3bffff', 'striders', 2, now() - interval '1 day', -30.034621161960484, -51.21875166319014);
select pg_temp.cell('8ba90128e382fff', '89a90128e3bffff', 'striders', 3, now() - interval '8 days', -30.034695123668254, -51.21788552638041);
select pg_temp.cell('8ba90128e383fff', '89a90128e3bffff', 'striders', 1, now(), -30.034460634923736, -51.21831058523841);
select pg_temp.cell('8ba90128e384fff', '89a90128e3bffff', 'owls', 1, now() - interval '9 days', -30.035250665253834, -51.21834262559783);
insert into public.privacy_zones (user_id, lat, lng, radius_m)
values ('e9e9e9e9-0021-4000-8000-00000000000c', -30.0341006, -51.21831058523841, 50); -- cobre só o trecho …383 (a 40 m)
update public.zones set attacker = 'striders', attack_started_at = now() - interval '1 hour', attack_last_at = now() - interval '1 hour',
                        attack_flips = 1 where id = '89a90128e3bffff';

select is(private.paint_counts('89a90128e3bffff', now()), '{"striders": 4, "coyotes": 3, "owls": 0, "volt": 0}'::jsonb,
  'zoneCounts: trechos vivos por time + herança (o desbotado não conta)');
select ok(private.paint_under_attack((select z from public.zones z where z.id = '89a90128e3bffff'),
                                     private.paint_counts('89a90128e3bffff', now()), now()),
  'isZoneUnderAttackV2: rival com ≥ 50 % dos trechos do dono e ataque recente');

-- ---------------------------------------------------------------------------
-- zone_paint_near: retrato sem autor, sem hora e sem trecho em zona de privacidade (de qualquer pessoa)
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0021-4000-8000-00000000000a');
create temp table snap as select public.zone_paint_near(-30.0346, -51.2177, 1500) as s;
grant select on snap to authenticated;
select is((select s ->> 'rule' from snap), 'v2', 'retrato diz a regra em vigor');
select is((select array_agg(k order by k) from snap, jsonb_object_keys(s -> 'cells') k),
  array['8ba90128e380fff', '8ba90128e381fff', '8ba90128e382fff'], 'só trechos vivos e fora de zonas de privacidade');
select is((select s -> 'cells' -> '8ba90128e382fff' from snap), '{"faction": "striders", "layers": 2}'::jsonb,
  'camadas efetivas (3 pintadas há 8 dias = 2), só time e camadas');
-- onda 3: a única ocorrência permitida de "painted" é o NOME da chave paintedToday (ids de trechos da própria pessoa)
select ok((select replace(s::text, '"paintedToday"', '') !~ '(painted|user|_at|lat|lng|e9e9e9e9)' from snap), 'nenhum autor, hora ou coordenada no retrato');
select is((select s -> 'zones' -> '89a90128e3bffff' from snap),
  '{"owner": "coyotes", "name": "Zona POA 1", "inherited": 3, "blocked": false, "underAttack": true}'::jsonb,
  'zona no retrato: dono, nome, herança, bloqueio e ataque');
select throws_ok($$ select public.zone_paint_near(95, 0, 100) $$, 'P0001', 'VALIDATION: coordenada inválida', 'coordenada validada');
select throws_ok($$ select * from public.zone_cells $$, '42501', null, 'cliente não lê zone_cells');
reset role;

-- ---------------------------------------------------------------------------
-- Job de desbotar (idempotente) e reavaliação do dono
-- ---------------------------------------------------------------------------
-- herança vencida: a zona fica com quem tem mais trechos (striders 3 vivos depois do desbotar + 1 = 4)
update public.zones set inherit_until = now() - interval '1 minute' where id = '89a90128e3bffff';
create temp table fade1 as select public.job_fade_cells(now()) as r;
select is((select (r ->> 'removed')::int from fade1), 1, 'o trecho que desbotou por completo some');
select results_eq($$ select layers::int, painted_at > now() - interval '2 days' from public.zone_cells where cell = '8ba90128e382fff' $$,
  $$ values (2, true) $$, 'fadeCell: perde 1 camada e o relógio guarda o resto (painted_at + 7 dias)');
select results_eq($$ select owner, inherit_faction, attacker, influence ->> 'striders' from public.zones where id = '89a90128e3bffff' $$,
  $$ values ('striders'::text, null::text, null::text, '40'::text) $$, 'dono reavaliado: herança vencida some, striders vira dono, ataque acaba');
select is((select count(*)::int from public.zone_events where zone_id = '89a90128e3bffff' and type = 'captured' and faction = 'striders'
                                                          and from_faction = 'coyotes'), 1, 'evento de troca de dono registrado');
create temp table fade2 as select public.job_fade_cells(now()) as r;
select is((select (r ->> 'faded')::int + (r ->> 'removed')::int + (r ->> 'events')::int from fade2), 0, 'job idempotente: rodar de novo não muda nada');

-- temporada nova: todo trecho vivo volta a 1 camada com o relógio reiniciado
update public.zone_cells set season_id = '2000-01' where zone_id = '89a90128e3bffff';
create temp table fade3 as select public.job_fade_cells(now()) as r;
select is((select (r ->> 'seasonReset')::int from fade3), 4, 'virada de temporada da pintura (seasonResetPaint)');
select is((select array_agg(distinct layers::int) from public.zone_cells where zone_id = '89a90128e3bffff'), array[1],
  'todos os trechos com 1 camada');

-- paint_marks com mais de 2 dias somem
insert into public.paint_marks (user_id, day, cell) values
  ('e9e9e9e9-0021-4000-8000-00000000000a', public.br_today() - 3, '8ba90128e380fff'),
  ('e9e9e9e9-0021-4000-8000-00000000000a', public.br_today(), '8ba90128e380fff');
select is((public.job_fade_cells(now()) ->> 'marksRemoved')::int, 1, 'paint_marks de mais de 2 dias são apagadas');

-- ---------------------------------------------------------------------------
-- D-84: a Fuligem fica fora do rodízio em agosto e setembro
-- ---------------------------------------------------------------------------
select is(array[private.raid_boss_for_week('2027-08-09'), private.raid_boss_for_week('2027-09-13'), private.raid_boss_for_week('2028-08-28')],
  array['mormaco', 'mormaco', 'mormaco'], 'semanas da Fuligem em agosto/setembro: entra o próximo do rodízio');
select is(array[private.raid_boss_for_week('2026-11-02'), private.raid_boss_for_week('2027-07-05'), private.raid_boss_for_week('2027-10-18')],
  array['fuligem', 'fuligem', 'fuligem'], 'fora de agosto e setembro a Fuligem continua no rodízio');
select is(array[private.raid_boss_for_week('2027-08-02'), private.raid_boss_for_week('2027-08-16'), private.raid_boss_for_week('2026-10-19')],
  array['rei-buzina', 'mormaco', 'soneca'], 'as outras semanas seguem o rodízio');

select * from finish();
rollback;
