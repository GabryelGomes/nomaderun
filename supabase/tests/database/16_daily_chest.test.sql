-- T7.1.23 (D-66; contrato E7 §5) — baú do dia: guardados derivados (até 3; conta sem atividade = 1), sorteio por HMAC
-- com segredo do servidor, garantia do lendário no 20º, baú bônus com raridade mínima, abertura com atividade de 1 km
-- (uma por dia, idempotente), confiança baixa guarda, XP 15/40/100 pelo livro e o pity em profiles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

select is((select array_agg(t order by t) from unnest(array['daily_rewards', 'bonus_chests']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_table_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'baú do dia: RLS ligada, cliente não escreve, anon não lê');
select ok(not has_table_privilege('authenticated', 'private.server_secrets', 'select')
          and not has_table_privilege('service_role', 'private.server_secrets', 'select'), 'ninguém pela API lê o segredo do HMAC');
select is((select octet_length(value) from private.server_secrets where name = 'daily_chest_hmac'), 32,
  'segredo de 32 bytes gerado no próprio banco');
select ok(not has_function_privilege('authenticated', 'private.open_daily_chests(uuid, uuid, timestamptz)', 'execute')
          and not has_function_privilege('authenticated', 'private.add_bonus_chest(uuid, text, text, text)', 'execute')
          and not has_function_privilege('authenticated', 'private.daily_chest_hmac_rolls(uuid, date, text)', 'execute'),
  'abrir, dar bônus e sortear só pelo servidor');
select ok(not has_function_privilege('anon', 'public.open_daily_chests()', 'execute')
          and not has_function_privilege('anon', 'public.my_daily_chest()', 'execute'), 'anon não chama as RPCs do baú');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0016-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'c16' || c || '@t.com', json_build_object('username', 'c16_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c', 'd']) c;

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- atividade "de hoje" (Brasília), qualquer que seja a hora em que o teste roda
create function pg_temp.run_today(uid uuid, act uuid, meters real) returns void language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
  select act, uid, 'valid', t - interval '1 second', t, t, meters, meters * 0.33, 330, true
    from (select greatest(now() - interval '1 minute', (public.br_today() + time '00:00:02') at time zone 'America/Sao_Paulo') t) x
$$;

-- ---------------------------------------------------------------------------
-- Funções puras e HMAC
-- ---------------------------------------------------------------------------
select is((select rarity from private.daily_chest_roll(0.10, 0)), 'comum', 'sorteio: r < 0,70 = comum');
select is((select rarity from private.daily_chest_roll(0.80, 0)), 'raro', 'sorteio: 0,70 ≤ r < 0,95 = raro');
select is((select rarity from private.daily_chest_roll(0.97, 0)), 'lendario', 'sorteio: r ≥ 0,95 = lendário');
select results_eq($$ select rarity, guaranteed from private.daily_chest_roll(0.10, 19) $$, $$ values ('lendario'::text, true) $$,
  'garantia: o 20º baú sem lendário é lendário (garantido)');
select results_eq($$ select rarity, guaranteed from private.daily_chest_roll(0.97, 19) $$, $$ values ('lendario'::text, false) $$,
  'lendário que saiu no sorteio não conta como garantido');
select is((select rarity from private.daily_chest_roll(0.10, 18)), 'comum', 'o 19º ainda sorteia');
select is((select rarity from private.daily_chest_roll(0.10, 0, 'raro')), 'raro', 'baú bônus: raridade mínima');
select is(private.daily_chest_hmac_rolls('e9e9e9e9-0016-4000-8000-00000000000a', '2026-10-23', '1'),
          private.daily_chest_hmac_rolls('e9e9e9e9-0016-4000-8000-00000000000a', '2026-10-23', '1'), 'HMAC: mesma semente, mesmo sorteio');
select ok(private.daily_chest_hmac_rolls('e9e9e9e9-0016-4000-8000-00000000000a', '2026-10-23', '1')
          <> private.daily_chest_hmac_rolls('e9e9e9e9-0016-4000-8000-00000000000a', '2026-10-23', '2'), 'HMAC: outro baú, outro sorteio');
select ok((select bool_and(r >= 0 and r < 1) from unnest(private.daily_chest_hmac_rolls('e9e9e9e9-0016-4000-8000-00000000000b',
                                                                                     '2026-10-23', '3')) r), 'HMAC: números em [0, 1)');

-- ---------------------------------------------------------------------------
-- Guardados (derivados)
-- ---------------------------------------------------------------------------
select is(private.daily_chests_stored('e9e9e9e9-0016-4000-8000-00000000000a'), 1, 'conta sem atividade: 1 baú guardado');
update public.profiles set created_at = now() - interval '5 days' where id = 'e9e9e9e9-0016-4000-8000-00000000000a';
select is(private.daily_chests_stored('e9e9e9e9-0016-4000-8000-00000000000a'), 1, 'sem atividade não acumula, mesmo com 5 dias');
select pg_temp.run_today('e9e9e9e9-0016-4000-8000-00000000000a', 'e9e9e9e9-1016-4000-8000-000000000001', 600);
select is(private.daily_chests_stored('e9e9e9e9-0016-4000-8000-00000000000a'), 3, 'nunca aberto: min(3, dias desde a criação + 1)');
insert into public.daily_rewards (user_id, day, n, rarity, xp) values ('e9e9e9e9-0016-4000-8000-00000000000d', public.br_today() - 2, 1, 'comum', 15);
select is(private.daily_chests_stored('e9e9e9e9-0016-4000-8000-00000000000d'), 2, 'aberto há 2 dias: 2 guardados');

-- ---------------------------------------------------------------------------
-- Flag, trancado e abertura
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000a');
select throws_like($$ select public.open_daily_chests() $$, '%FEATURE_DISABLED%', 'flag desligada: open_daily_chests recusa');
reset role;
select is(private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000a') ->> 'reason', 'disabled', 'flag desligada: a gravação não abre');
update public.game_config set value = value || '{"dailyChest": true}' where key = 'features';

select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000b');
select throws_like($$ select public.open_daily_chests() $$, '%DAILY_CHEST_LOCKED%', 'sem atividade hoje: trancado');
select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000a');
select throws_like($$ select public.open_daily_chests() $$, '%DAILY_CHEST_LOCKED%', 'atividade de 600 m não abre');
select throws_ok($$ update public.profiles set daily_chest_pity = 19 where id = auth.uid() $$, '42501', null,
  'cliente não mexe no contador da garantia');
reset role;
select is(private.add_bonus_chest('e9e9e9e9-0016-4000-8000-00000000000a', 'raro', 'mission', 'm-1'), true, 'baú bônus raro guardado');
select is(private.add_bonus_chest('e9e9e9e9-0016-4000-8000-00000000000a', 'raro', 'mission', 'm-1'), false, 'bônus idempotente por fonte + referência');
select pg_temp.run_today('e9e9e9e9-0016-4000-8000-00000000000a', 'e9e9e9e9-1016-4000-8000-000000000002', 1200);
select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000a');
create temp table o1 as select public.open_daily_chests() as r;
select results_eq($$ select jsonb_array_length(r -> 'prizes'), jsonb_array_length(r -> 'bonus'), (r ->> 'alreadyOpened')::boolean from o1 $$,
  $$ values (3, 1, false) $$, '1,2 km hoje: abre os 3 guardados + o bônus');
select ok((select r -> 'bonus' -> 0 ->> 'rarity' in ('raro', 'lendario') from o1), 'o bônus saiu pelo menos raro');
select ok((select bool_and((p ->> 'xp')::int = case p ->> 'rarity' when 'comum' then 15 when 'raro' then 40 else 100 end)
             from o1, jsonb_array_elements(r -> 'prizes') p), 'XP 15/40/100 por raridade');
select results_eq($$ select (r ->> 'alreadyOpened')::boolean, jsonb_array_length(r -> 'prizes') from (select public.open_daily_chests() r) x $$,
  $$ values (true, 3) $$, 'abrir de novo hoje devolve os mesmos baús');
select results_eq($$ select (r ->> 'stored')::int, (r ->> 'openedToday')::boolean, jsonb_array_length(r -> 'bonus')
                       from (select public.my_daily_chest() r) x $$,
  $$ values (0, true, 0) $$, 'depois de abrir: 0 guardados e nenhum bônus pendente');
reset role;
select is((select count(*)::int from public.daily_rewards where user_id = 'e9e9e9e9-0016-4000-8000-00000000000a'), 3, 'nada duplicado');
select is((select count(*)::int from public.xp_ledger where user_id = 'e9e9e9e9-0016-4000-8000-00000000000a' and source = 'daily_chest'), 4,
  'XP de cada baú pelo livro, uma vez');
select is((select xp from public.profiles where id = 'e9e9e9e9-0016-4000-8000-00000000000a'),
          (select sum(amount)::int from public.xp_ledger where user_id = 'e9e9e9e9-0016-4000-8000-00000000000a'), 'profiles.xp = livro');
select is((select daily_chest_pity::int from public.profiles where id = 'e9e9e9e9-0016-4000-8000-00000000000a'),
          (select case when bool_or(rarity = 'lendario') then 3 - max(n) filter (where rarity = 'lendario') else 3 end::int
             from public.daily_rewards where user_id = 'e9e9e9e9-0016-4000-8000-00000000000a'),
  'pity conta os baús desde o último lendário');

-- garantia aplicada na abertura
update public.profiles set daily_chest_pity = 19 where id = 'e9e9e9e9-0016-4000-8000-00000000000c';
select pg_temp.run_today('e9e9e9e9-0016-4000-8000-00000000000c', 'e9e9e9e9-1016-4000-8000-000000000003', 2000);
select results_eq($$ select r -> 'prizes' -> 0 ->> 'rarity', jsonb_array_length(r -> 'prizes')
                       from (select private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000c') r) x $$,
  $$ values ('lendario'::text, 1) $$, 'conta nova com 19 sem lendário: o baú sai lendário');
select is((select daily_chest_pity::int from public.profiles where id = 'e9e9e9e9-0016-4000-8000-00000000000c'), 0, 'a garantia zera o contador');

-- confiança baixa guarda os baús
update public.profiles set trust = 30 where id = 'e9e9e9e9-0016-4000-8000-00000000000b';
select pg_temp.run_today('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000004', 3000);
select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000b');
select throws_like($$ select public.open_daily_chests() $$, '%DAILY_CHEST_REVIEW%', 'confiança < 40: os baús ficam guardados');
select is((public.my_daily_chest() ->> 'stored')::int, 1, 'e continuam lá');
select is((select count(*)::int from public.daily_rewards), 0, 'cada um lê só os próprios baús');
reset role;

select * from finish();
rollback;
