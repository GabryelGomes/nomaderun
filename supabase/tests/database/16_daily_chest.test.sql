-- T7.1.23 (D-66) — baú do dia: créditos que acumulam até 3, conta sem corrida não acumula, sorteio com garantia do
-- lendário no 20º, baú bônus com raridade mínima, abertura idempotente (1 por dia), confiança baixa guarda os baús.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

select is((select array_agg(t order by t) from unnest(array['daily_chest_state', 'daily_rewards']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_table_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'baú do dia: RLS ligada, cliente não escreve, anon não lê');
select ok(not has_function_privilege('authenticated', 'private.open_daily_chests(uuid, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'private.add_bonus_chest(uuid, text)', 'execute'),
  'abrir e dar bônus só pelo servidor');
select ok(not has_function_privilege('anon', 'public.my_daily_chest()', 'execute'), 'anon não chama my_daily_chest');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0016-4000-8000-00000000000a', 'authenticated', 'authenticated', 'c16a@t.com',
   '{"username": "c16_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0016-4000-8000-00000000000b', 'authenticated', 'authenticated', 'c16b@t.com',
   '{"username": "c16_b", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0016-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c16c@t.com',
   '{"username": "c16_c", "birthdate": "1995-01-01", "terms_accepted": true}');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.run(uid uuid, act uuid, meters real, secs real) returns void language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
  values (act, uid, 'valid', now() - interval '40 minutes', now() - interval '5 minutes', now(), meters, secs, 330, true)
$$;

-- ---------------------------------------------------------------------------
-- Flag desligada
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000a');
select throws_like($$ select public.my_daily_chest() $$, '%FEATURE_DISABLED%', 'flag desligada: my_daily_chest recusa');
reset role;
select pg_temp.run('e9e9e9e9-0016-4000-8000-00000000000a', 'e9e9e9e9-1016-4000-8000-000000000001', 1200, 400);
select is(private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000a', 'e9e9e9e9-1016-4000-8000-000000000001'), null,
  'flag desligada: a atividade não abre baú');
update public.game_config set value = value || '{"dailyChest": true}' where key = 'features';

-- ---------------------------------------------------------------------------
-- Sorteio puro
-- ---------------------------------------------------------------------------
select is(private.daily_chest_roll(0.10, 0, 'comum'), 'comum', 'sorteio: r < 0,70 = comum');
select is(private.daily_chest_roll(0.80, 0, 'comum'), 'raro', 'sorteio: 0,70 ≤ r < 0,95 = raro');
select is(private.daily_chest_roll(0.97, 0, 'comum'), 'lendario', 'sorteio: r ≥ 0,95 = lendário');
select is(private.daily_chest_roll(0.10, 19, 'comum'), 'lendario', 'garantia: o 20º baú sem lendário é lendário');
select is(private.daily_chest_roll(0.10, 18, 'comum'), 'comum', 'garantia: o 19º ainda sorteia');
select is(private.daily_chest_roll(0.10, 0, 'raro'), 'raro', 'baú bônus: raridade mínima');

-- ---------------------------------------------------------------------------
-- Créditos
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000b');
select is((public.my_daily_chest() ->> 'stored')::int, 1, 'conta nova começa com 1 baú guardado');
select is((public.my_daily_chest() ->> 'pityLeft')::int, 20, 'faltam 20 para o lendário garantido');
select is((public.my_daily_chest() -> 'odds' ->> 'lendario')::numeric, 0.05, 'chances visíveis na resposta');
select throws_ok($$ update public.daily_chest_state set stored = 3 $$, '42501', null, 'cliente não muda os próprios créditos');
reset role;
update public.daily_chest_state set accrued_on = accrued_on - 5 where user_id = 'e9e9e9e9-0016-4000-8000-00000000000b';
select is((private.daily_chest_refresh('e9e9e9e9-0016-4000-8000-00000000000b')).stored, 1::smallint,
  'sem nenhuma corrida, não acumula além do 1º baú');
select pg_temp.run('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000002', 500, 200);
update public.daily_chest_state set accrued_on = accrued_on - 5 where user_id = 'e9e9e9e9-0016-4000-8000-00000000000b';
select is((private.daily_chest_refresh('e9e9e9e9-0016-4000-8000-00000000000b')).stored, 3::smallint, 'acumula até 3, nunca mais');
select is((private.daily_chest_refresh('e9e9e9e9-0016-4000-8000-00000000000b')).stored, 3::smallint, 'refresh no mesmo dia não credita de novo');

-- ---------------------------------------------------------------------------
-- Abertura
-- ---------------------------------------------------------------------------
select is(private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000002'), null,
  'atividade curta (500 m, 200 s) não abre');
select is(private.add_bonus_chest('e9e9e9e9-0016-4000-8000-00000000000b', 'raro'), 1, 'baú bônus raro guardado');
select pg_temp.run('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000003', 1200, 400);
select is(jsonb_array_length(private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000003') -> 'opened'),
  4, 'uma atividade de 1,2 km abre os 3 guardados + o bônus');
select ok((select private.rarity_rank(rarity) >= 2 from public.daily_rewards
            where user_id = 'e9e9e9e9-0016-4000-8000-00000000000b' and kind = 'bonus'), 'o baú bônus saiu pelo menos raro');
select is((private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000003') ->> 'alreadyOpened')::boolean,
  true, 'repetir a mesma atividade devolve os mesmos baús');
select is((select count(*)::int from public.daily_rewards where user_id = 'e9e9e9e9-0016-4000-8000-00000000000b'), 4, 'nada duplicado');
select is((select count(*)::int from public.xp_ledger where user_id = 'e9e9e9e9-0016-4000-8000-00000000000b' and source = 'daily_chest'), 4,
  'XP de cada baú pelo livro, uma vez');
select is((select xp from public.profiles where id = 'e9e9e9e9-0016-4000-8000-00000000000b'),
          (select sum(amount)::int from public.xp_ledger where user_id = 'e9e9e9e9-0016-4000-8000-00000000000b'), 'profiles.xp = livro');
select pg_temp.run('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000004', 3000, 900);
select is(jsonb_array_length(private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000b', 'e9e9e9e9-1016-4000-8000-000000000004') -> 'opened'),
  0, 'uma abertura por dia');
select results_eq($$ select stored::int, cardinality(bonus), opened_on = public.br_today() from public.daily_chest_state
                     where user_id = 'e9e9e9e9-0016-4000-8000-00000000000b' $$,
  $$ values (0, 0, true) $$, 'depois de abrir: 0 guardados, sem bônus, aberto hoje');

-- garantia aplicada na abertura
select private.daily_chest_refresh('e9e9e9e9-0016-4000-8000-00000000000a');
update public.daily_chest_state set pity = 19 where user_id = 'e9e9e9e9-0016-4000-8000-00000000000a';
select is((private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000a', 'e9e9e9e9-1016-4000-8000-000000000001') -> 'opened' -> 0 ->> 'rarity'),
  'lendario', 'abertura com 19 sem lendário: sai lendário');
select results_eq($$ select pity::int, (select pity_used from public.daily_rewards where user_id = 'e9e9e9e9-0016-4000-8000-00000000000a')
                     from public.daily_chest_state where user_id = 'e9e9e9e9-0016-4000-8000-00000000000a' $$,
  $$ values (0, true) $$, 'a garantia zera o contador e fica marcada');

-- confiança baixa guarda os baús
update public.profiles set trust = 30 where id = 'e9e9e9e9-0016-4000-8000-00000000000c';
select pg_temp.run('e9e9e9e9-0016-4000-8000-00000000000c', 'e9e9e9e9-1016-4000-8000-000000000005', 2000, 700);
select is(private.open_daily_chests('e9e9e9e9-0016-4000-8000-00000000000c', 'e9e9e9e9-1016-4000-8000-000000000005') ->> 'locked',
  'LOW_TRUST', 'confiança < 40: os baús ficam guardados');
select is((select stored::int from public.daily_chest_state where user_id = 'e9e9e9e9-0016-4000-8000-00000000000c'), 1, 'e continuam lá');

select pg_temp.login('e9e9e9e9-0016-4000-8000-00000000000a');
select is((select count(*)::int from public.daily_rewards), 1, 'cada um lê só os próprios baús');
reset role;

select * from finish();
rollback;
