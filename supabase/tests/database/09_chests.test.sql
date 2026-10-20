-- Fase 3 (A2) — RF-023 / RN-017: sorteio diário de baús e abertura gravada pelo servidor (P-12/P-19).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '91111111-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ca@t.com',
   '{"username": "chest_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '91111111-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'cb@t.com',
   '{"username": "chest_b", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '91111111-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cc@t.com',
   '{"username": "chest_c", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '91111111-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'cd@t.com',
   '{"username": "chest_d", "birthdate": "1995-01-01", "terms_accepted": true}');
update public.profiles set faction = 'volt' where id::text like '91111111-%';

-- raridades e XP (RN-017; XP = CHEST_XP do domain)
select is(private.chest_rarity(0), 'comum', '0,00 → comum');
select is(private.chest_rarity(0.6999), 'comum', '0,6999 → comum (70%)');
select is(private.chest_rarity(0.70), 'raro', '0,70 → raro');
select is(private.chest_rarity(0.9499), 'raro', '0,9499 → raro (25%)');
select is(private.chest_rarity(0.95), 'lendario', '0,95 → lendário (5%)');
select is(array[private.chest_xp('comum'), private.chest_xp('raro'), private.chest_xp('lendario')], array[20, 60, 150], 'XP 20 / 60 / 150');
select ok((with d as (select private.chest_rarity(random()) r from generate_series(1, 6000))
           select avg((r = 'comum')::int) between 0.66 and 0.74 and avg((r = 'raro')::int) between 0.21 and 0.29
              and avg((r = 'lendario')::int) between 0.03 and 0.07 from d),
  'em 6.000 sorteios a distribuição fica perto de 70/25/5 %');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- zona bloqueada cobrindo toda a metade leste do disco de 3 km em torno de (0, 20)
insert into public.zones (id, geom, blocked) values
  ('8b2222222222fff', extensions.st_geomfromtext('POLYGON((20 -0.05, 20.05 -0.05, 20.05 0.05, 20 0.05, 20 -0.05))', 4326), true);

-- A: sem corrida e sem posição → nada; com posição → 5 a 8 baús a até 3 km
select pg_temp.login('91111111-0000-4000-8000-000000000001');
select is(jsonb_array_length(public.daily_chests() -> 'chests'), 0, 'sem corrida e sem posição: nenhum baú');
select throws_like($$ select public.daily_chests(-16.7, null) $$, '%VALIDATION%', 'posição incompleta é recusada');
select ok(jsonb_array_length(public.daily_chests(0, 20) -> 'chests') between 5 and 8, 'sorteia de 5 a 8 baús no dia');
select is((select count(*)::int from public.chests), jsonb_array_length(public.daily_chests(0, 20) -> 'chests'), 'o usuário lê os próprios baús');
select ok((select bool_and(extensions.st_distance(extensions.st_makepoint(lng, lat)::extensions.geography,
                                                  extensions.st_makepoint(20, 0)::extensions.geography) <= 3000.5) from public.chests),
  'todos a até 3 km do centro');
select ok((select bool_and(lng < 20) from public.chests), 'nenhum baú dentro da zona bloqueada (metade leste)');
select is((select array_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(public.daily_chests(5, 5) -> 'chests') x),
          (select array_agg(id::text order by id::text) from public.chests),
  'mesma lista no resto do dia (não sorteia de novo, mesmo com outra posição)');
select throws_ok($$ insert into public.chests (user_id, day, lat, lng, rarity, xp) values (auth.uid(), current_date, 0, 0, 'lendario', 150) $$,
  '42501', null, 'cliente não cria baú');
select throws_ok($$ update public.chests set opened_at = now() $$, '42501', null, 'cliente não abre baú direto');

-- B não vê os baús de A
select pg_temp.login('91111111-0000-4000-8000-000000000002');
select is((select count(*)::int from public.chests where user_id = '91111111-0000-4000-8000-000000000001'), 0, 'outro usuário não lê os baús de A');
reset role;

-- D: centro = último ponto da última corrida (ignora a posição enviada)
insert into public.activities (id, user_id, started_at, status) values
  ('a9111111-0000-4000-8000-000000000004', '91111111-0000-4000-8000-000000000004', now() - interval '1 day', 'valid');
insert into public.activity_points (activity_id, seq, lat, lng, t) values
  ('a9111111-0000-4000-8000-000000000004', 0, 30.0, 30.0, 1760000000000),
  ('a9111111-0000-4000-8000-000000000004', 1, 30.01, 30.0, 1760000001000);
select pg_temp.login('91111111-0000-4000-8000-000000000004');
select ok((select bool_and(extensions.st_distance(extensions.st_makepoint((x ->> 'lng')::float8, (x ->> 'lat')::float8)::extensions.geography,
                                                  extensions.st_makepoint(30.0, 30.01)::extensions.geography) <= 3000.5)
             from jsonb_array_elements(public.daily_chests(-16.7, -49.2) -> 'chests') x),
  'com corrida anterior, o centro é o último ponto dela (RN-017)');
reset role;

-- abertura pelo servidor (svc_apply_activity_result) — só na missão Caça
insert into public.activities (id, user_id, started_at, mission) values
  ('a9111111-0000-4000-8000-000000000001', '91111111-0000-4000-8000-000000000001', now(), 'caca'),
  ('a9111111-0000-4000-8000-000000000002', '91111111-0000-4000-8000-000000000001', now(), 'caca'),
  ('a9111111-0000-4000-8000-000000000003', '91111111-0000-4000-8000-000000000001', now(), 'livre');
select is(jsonb_array_length(public.svc_finish_context('91111111-0000-4000-8000-000000000001', 'a9111111-0000-4000-8000-000000000001', '{}', '{}') -> 'chests'),
          (select count(*)::int from public.chests where user_id = '91111111-0000-4000-8000-000000000001'),
  'contexto do cálculo traz os baús fechados na missão Caça');
select is(jsonb_array_length(public.svc_finish_context('91111111-0000-4000-8000-000000000001', 'a9111111-0000-4000-8000-000000000003', '{}', '{}') -> 'chests'),
  0, 'em corrida livre nenhum baú entra no cálculo');

create function pg_temp.finish(p_act uuid, p_chest uuid) returns jsonb language sql as $$
  select public.svc_apply_activity_result(jsonb_build_object(
    'mode', 'finish', 'activityId', p_act, 'userId', '91111111-0000-4000-8000-000000000001', 'faction', 'volt',
    'status', 'valid', 'scored', true, 'meters', 500, 'movingSeconds', 150, 'avgPace', 300, 'rpTotal', 0, 'xp', 25,
    'flags', '[]'::jsonb, 'invalidSegments', '[]'::jsonb, 'trustAfter', 100, 'suspend', false,
    'zones', '[]'::jsonb, 'activityZones', '[]'::jsonb, 'events', '[]'::jsonb, 'fogCells', '[]'::jsonb,
    'chests', jsonb_build_array(jsonb_build_object('chestId', p_chest, 'rarity', 'comum', 'xp', 20)),
    'result', '{"status": "valid", "zones": []}'::jsonb))
$$;
select is(pg_temp.finish('a9111111-0000-4000-8000-000000000001', (select id from public.chests where user_id = '91111111-0000-4000-8000-000000000001' order by id limit 1)) ->> 'ok',
  'true', 'resultado com baú aberto é gravado');
select results_eq($$ select activity_id, opened_at is not null from public.chests where user_id = '91111111-0000-4000-8000-000000000001' and opened_at is not null $$,
  $$ values ('a9111111-0000-4000-8000-000000000001'::uuid, true) $$, 'baú marcado como aberto pela corrida');
select is((select count(*)::int from public.chest_opens where user_id = '91111111-0000-4000-8000-000000000001'), 1,
  'histórico em chest_opens (o app lê esta tabela)');
select throws_like($$ select pg_temp.finish('a9111111-0000-4000-8000-000000000002', (select id from public.chests where user_id = '91111111-0000-4000-8000-000000000001' order by id limit 1)) $$,
  '%ZONE_CONFLICT%', 'o mesmo baú não abre duas vezes (a function recalcula sem ele)');
select is(jsonb_array_length(public.svc_finish_context('91111111-0000-4000-8000-000000000001', 'a9111111-0000-4000-8000-000000000002', '{}', '{}') -> 'chests'),
          (select count(*)::int from public.chests where user_id = '91111111-0000-4000-8000-000000000001') - 1,
  'baú aberto sai do contexto das próximas corridas');

select * from finish();
rollback;
