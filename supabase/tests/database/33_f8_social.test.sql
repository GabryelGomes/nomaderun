-- Fase 8, onda C, C2 (E9 + E8 + E7): faction_activity() para anon (D-91/D-96), moldura "Recruta" no servidor,
-- activityId no item do próprio feed, referência "perto do …" das zonas e o formato único dos avisos de zona.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

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

create function pg_temp.mkuser(n text, faction text) returns uuid language plpgsql as $$
declare v uuid := ('e9e9e9e9-0032-4000-8000-0000000000' || n)::uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', 'v32' || n || '@t.com',
          jsonb_build_object('username', 'v32_' || n, 'birthdate', '1995-01-01', 'terms_accepted', true));
  if faction is not null then update public.profiles set faction = mkuser.faction where id = v; end if;
  return v;
end $$;

-- ===========================================================================
-- D-91/D-96: faction_activity() sem sessão
-- ===========================================================================
select is(has_function_privilege('anon', 'public.faction_activity()', 'execute'), true,
  'faction_activity: anon chama (escolha do time antes da conta)');
select is(has_function_privilege('public', 'public.faction_activity()', 'execute'), false,
  'faction_activity: PUBLIC continua sem grant (só anon e authenticated, explícitos)');
select is((select prosecdef from pg_proc where oid = 'public.faction_activity()'::regprocedure), true,
  'faction_activity: security definer (anon não lê activities nem profiles)');

select pg_temp.mkuser('a1', 'owls');
select pg_temp.mkuser('d1', 'owls');
update public.profiles set is_demo = true where id = 'e9e9e9e9-0032-4000-8000-0000000000d1';

select pg_temp.as_anon();
create temp table an0 as select public.faction_activity() as r;
select pg_temp.logout();
create temp table c0 as select private.faction_counts(false, now()) as c;   -- B1 (34): sem sessão lê do cache
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
values ('e9e9e9e9-1032-4000-8000-000000000001', 'e9e9e9e9-0032-4000-8000-0000000000a1', 'valid',
        now() - interval '1 day 40 minutes', now() - interval '1 day', now() - interval '1 day', 5000, 1500, 300, true),
       ('e9e9e9e9-1032-4000-8000-000000000002', 'e9e9e9e9-0032-4000-8000-0000000000d1', 'valid',
        now() - interval '1 day 40 minutes', now() - interval '1 day', now() - interval '1 day', 5000, 1500, 300, true);
select pg_temp.as_anon();
create temp table an1 as select public.faction_activity() as r;
select throws_ok($$ select * from public.activities $$, '42501', null, 'anon continua sem ler activities');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon continua sem ler profiles');
select pg_temp.logout();
create temp table c1 as select private.faction_counts(false, now()) as c;

-- B1 (20261104120300, pgTAP 34): sem sessão só { needsBoost, isDemo }, do cache; as contagens ficam no servidor
select is((select array_agg(k order by k) from an1, jsonb_object_keys(r) k),
  array['isDemo', 'needsBoost'], 'anon: só needsBoost e isDemo (B1: sem contagens, sem since, sem id, nome ou lugar)');
select is((select array_agg(k order by k) from c1, jsonb_object_keys(c) k),
  array['coyotes', 'owls', 'striders', 'volt'], 'contagem por trás do cache: os 4 times sempre aparecem');
select is((select (r ->> 'isDemo')::boolean from an1), false, 'anon: nunca demonstração');
select is((select (a1.c ->> 'owls')::int - (a0.c ->> 'owls')::int from c0 a0, c1 a1), 1,
  'sem sessão: conta a conta real nova e NÃO a de demonstração');
select ok((select jsonb_typeof(r -> 'needsBoost') in ('null', 'string') from an1), 'anon: needsBoost é um time ou null');
select ok((select r::text !~* '(e9e9e9e9|v32_|username|lat|lng|zone)' from an1), 'anon: nada pessoal no corpo');
-- com sessão continua como no 31 (com a janela)
select pg_temp.login('e9e9e9e9-0032-4000-8000-0000000000a1');
select ok(public.faction_activity() ? 'since', 'com sessão: a janela (since) continua');
select pg_temp.logout();

-- ===========================================================================
-- Moldura "Recruta"
-- ===========================================================================
select results_eq($$ select slot, name, rarity, source, in_chest_pool, active from public.cosmetic_defs where id = 'moldura-recruta' $$,
  $$ values ('frame'::text, 'Recruta'::text, 'comum'::text, 'ftue'::text, false, true) $$,
  'moldura-recruta no catálogo: moldura comum, fora do baú, ativa');
select pg_temp.mkuser('c1', null);
select is((select count(*)::int from public.user_cosmetics where user_id = 'e9e9e9e9-0032-4000-8000-0000000000c1'::uuid), 0,
  'conta nova sem time ainda não é Recruta');
select pg_temp.login('e9e9e9e9-0032-4000-8000-0000000000c1');
create temp table cf1 as select public.choose_faction('volt') as r;
create temp table cf2 as select public.choose_faction('volt') as r;
select is((select r -> 'recruitFrame' from cf1), '{"id": "moldura-recruta", "unlockedNow": true}'::jsonb,
  'choose_faction: 1ª escolha dá a moldura (unlockedNow)');
select is((select r -> 'recruitFrame' from cf2), '{"id": "moldura-recruta", "unlockedNow": false}'::jsonb,
  'choose_faction: repetir não dá de novo');
select is((select r ->> 'faction' from cf2), 'volt', 'choose_faction: contrato antigo mantido (faction)');
select is((select count(*)::int from public.user_cosmetics where cosmetic_id = 'moldura-recruta'), 1,
  'a pessoa lê a própria moldura em user_cosmetics (RLS), 1 linha só (idempotente)');
select lives_ok($$ select public.equip_cosmetic('moldura-recruta') $$, 'pode equipar a moldura Recruta');
select pg_temp.logout();
select is((select count(*)::int from public.user_cosmetics
            where user_id = 'e9e9e9e9-0032-4000-8000-0000000000a1' and cosmetic_id = 'moldura-recruta'), 1,
  'entrar num time por outro caminho (update de faction) também dá a moldura (trigger)');
select ok(not exists (select 1 from public.profiles p
                       where p.faction is not null
                         and not exists (select 1 from public.user_cosmetics c
                                          where c.user_id = p.id and c.cosmetic_id = 'moldura-recruta')),
  'toda conta com time tem a moldura Recruta (backfill + trigger)');
select pg_temp.as_anon();
select throws_ok($$ select public.choose_faction('volt') $$, '42501', null, 'anon não chama choose_faction');
select pg_temp.logout();

-- ===========================================================================
-- Feed: activityId só no item da própria pessoa
-- ===========================================================================
select pg_temp.mkuser('fa', 'striders');
select pg_temp.mkuser('fb', 'striders');
insert into public.crews (name, tag, leader_id) values ('Crew C2', 'FEEDC', 'e9e9e9e9-0032-4000-8000-0000000000fa');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0032-4000-8000-0000000000fb' from public.crews where tag = 'FEEDC';
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
values ('e9e9e9e9-1032-4000-8000-0000000000f1', 'e9e9e9e9-0032-4000-8000-0000000000fa', 'valid',
        now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours', 4200, 1400, 333, true);
insert into public.feed_items (id, activity_id, user_id, crew_id, day, meters, moving_seconds, avg_pace)
values ('e9e9e9e9-2032-4000-8000-0000000000f1', 'e9e9e9e9-1032-4000-8000-0000000000f1', 'e9e9e9e9-0032-4000-8000-0000000000fa',
        (select id from public.crews where tag = 'FEEDC'), public.br_today(), 4200, 1400, 333);
update public.game_config set value = value || '{"feed": true}' where key = 'features';
select pg_temp.login('e9e9e9e9-0032-4000-8000-0000000000fa');
create temp table fda as select public.crew_feed() as f;
select pg_temp.login('e9e9e9e9-0032-4000-8000-0000000000fb');
create temp table fdb as select public.crew_feed() as f;
select pg_temp.logout();
select is((select f #>> '{items,0,activityId}' from fda), 'e9e9e9e9-1032-4000-8000-0000000000f1',
  'feed: o autor recebe o activityId do próprio item (you = true)');
select is((select (f #>> '{items,0,you}')::boolean from fda), true, 'feed: e o item é dele');
select ok((select not (f -> 'items' -> 0 ? 'activityId') from fdb), 'feed: o colega da crew NÃO recebe activityId');
select ok((select f::text !~* '(e9e9e9e9-1032|user_id|created)' from fdb), 'feed: nada de id de corrida para o colega');

-- ===========================================================================
-- Zonas: "perto do …"
-- ===========================================================================
select is((select relrowsecurity from pg_class where oid = 'public.landmarks'::regclass), true, 'landmarks com RLS');
select is(has_table_privilege('authenticated', 'public.landmarks', 'select') or has_table_privilege('anon', 'public.landmarks', 'select'),
  false, 'landmarks: o cliente não lê a tabela');
insert into public.zones (id, name, city, geom) values
  ('8932c2c2c2c2fff', 'Jardim Goiás 59', 'Goiânia',
   extensions.st_geomfromtext('POLYGON((-49.2352 -16.7076, -49.2332 -16.7076, -49.2332 -16.7056, -49.2352 -16.7076))', 4326)),
  ('8932c2c2c2c3fff', 'Estádio Serra Dourada', 'Goiânia',
   extensions.st_geomfromtext('POLYGON((-49.2352 -16.7076, -49.2332 -16.7076, -49.2332 -16.7056, -49.2352 -16.7076))', 4326)),
  ('8932c2c2c2c4fff', 'Centro 3', 'Longe',
   extensions.st_geomfromtext('POLYGON((10 10, 10.001 10, 10.001 10.001, 10 10))', 4326));
select is((select near_ref from public.zones where id = '8932c2c2c2c2fff'), 'perto do Estádio',
  'zona nova ganha a referência do marco mais perto (trigger)');
select is((select near_ref from public.zones where id = '8932c2c2c2c3fff'), null, 'zona com nome de marco não leva referência');
select is((select near_ref from public.zones where id = '8932c2c2c2c4fff'), null, 'sem marco a até 3 km: sem referência');
select is(private.zone_display('Jardim Goiás 59', 'perto do Estádio'), 'Jardim Goiás · perto do Estádio',
  'nome na tela: sem número e com a referência');
select is(private.zone_display('Setor Pedro Ludovico 35/36', null), 'Setor Pedro Ludovico', 'sem referência: só o nome, sem número');
select is(private.zone_display(null, null), 'Zona', 'sem nome: "Zona"');
select is((select z ->> 'near_ref' from jsonb_array_elements(public.zones_in_bbox_json(-49.24, -16.71, -49.23, -16.70)) z
            where z ->> 'id' = '8932c2c2c2c2fff'), 'perto do Estádio', '/zones leva near_ref');
select is(public.svc_zone_detail('8932c2c2c2c2fff') #>> '{zone,nearRef}', 'perto do Estádio', '/zone/:id leva nearRef');

-- ===========================================================================
-- Avisos de zona num formato único
-- ===========================================================================
update public.zones set owner = 'striders', attacker = 'coyotes', rule_version = 2,
       attack_started_at = date_trunc('minute', now()) - interval '1 hour', attack_last_at = date_trunc('minute', now()) + interval '30 minutes'
 where id = '8932c2c2c2c2fff';
insert into public.notifications (user_id, type, title, body, data)
values ('e9e9e9e9-0032-4000-8000-0000000000fb', 'invasion', 'Alerta de Invasão!', 'velho',
        jsonb_build_object('zoneId', '8932c2c2c2c2fff', 'attacker', 'coyotes')),
       ('e9e9e9e9-0032-4000-8000-0000000000fb', 'territory_lost', 'x', 'velho',
        jsonb_build_object('zoneId', '8932c2c2c2c2fff', 'newOwner', 'coyotes')),
       ('e9e9e9e9-0032-4000-8000-0000000000fb', 'conquest', 'x', 'velho', jsonb_build_object('zoneId', '8932c2c2c2c2fff')),
       ('e9e9e9e9-0032-4000-8000-0000000000fb', 'invasion', 'Alerta de Invasão!', 'sem zona', jsonb_build_object('zoneId', 'nao-existe'));
select is((select title || ' | ' || body from public.notifications
            where user_id = 'e9e9e9e9-0032-4000-8000-0000000000fb' and type = 'invasion' and data ->> 'zoneId' = '8932c2c2c2c2fff'),
  'Alerta de invasão | Os Urban Coyotes estão pintando suas ruas em Jardim Goiás · perto do Estádio. Defenda até '
    || to_char((date_trunc('minute', now()) + interval '24 hours 30 minutes') at time zone 'America/Sao_Paulo', 'HH24"h"MI') || '.',
  'invasão: título em caixa de frase, zona sem número com referência e "até HHhMM" (v2: último avanço + 24 h)');
select is((select (data ->> 'defendUntil')::bigint from public.notifications
            where user_id = 'e9e9e9e9-0032-4000-8000-0000000000fb' and type = 'invasion' and data ->> 'zoneId' = '8932c2c2c2c2fff'),
  private.ts_to_ms(date_trunc('minute', now()) + interval '24 hours 30 minutes'), 'invasão: data.defendUntil (ms) para o app');
select is((select title || ' | ' || body from public.notifications
            where user_id = 'e9e9e9e9-0032-4000-8000-0000000000fb' and type = 'territory_lost'),
  'Território perdido | Jardim Goiás · perto do Estádio agora é dos Urban Coyotes. Corra lá para pintar de volta.',
  'território perdido no mesmo formato');
select is((select title || ' | ' || body from public.notifications
            where user_id = 'e9e9e9e9-0032-4000-8000-0000000000fb' and type = 'conquest'),
  'Zona conquistada | Você pintou Jardim Goiás · perto do Estádio com a cor dos Neon Striders.',
  'conquista no mesmo formato (time de quem recebe)');
select is((select body from public.notifications
            where user_id = 'e9e9e9e9-0032-4000-8000-0000000000fb' and data ->> 'zoneId' = 'nao-existe'), 'sem zona',
  'aviso sem zona conhecida passa como veio');

select * from finish();
rollback;
