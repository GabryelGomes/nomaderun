-- T7.1.22 (D-80) — contrato v2: game_config (flags desligadas), server_info(), xp_ledger + grant_xp, XP que nunca
-- diminui e os tipos novos de notificação (superconjunto).
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- ---------------------------------------------------------------------------
-- Esquema e grants
-- ---------------------------------------------------------------------------
select has_table('public', 'game_config', 'tabela game_config');
select has_table('public', 'xp_ledger', 'tabela xp_ledger');
select ok((select relrowsecurity from pg_class where oid = 'public.game_config'::regclass), 'RLS em game_config');
select ok((select relrowsecurity from pg_class where oid = 'public.xp_ledger'::regclass), 'RLS em xp_ledger');
select ok(not has_table_privilege('anon', 'public.game_config', 'select'), 'anon não lê game_config');
select ok(not has_any_column_privilege('authenticated', 'public.game_config', 'insert')
          and not has_any_column_privilege('authenticated', 'public.game_config', 'update')
          and not has_table_privilege('authenticated', 'public.game_config', 'delete'),
  'cliente não escreve em game_config (flags só pelo service role)');
select ok(not has_any_column_privilege('authenticated', 'public.xp_ledger', 'insert')
          and not has_any_column_privilege('authenticated', 'public.xp_ledger', 'update')
          and not has_table_privilege('authenticated', 'public.xp_ledger', 'delete'),
  'cliente não escreve no livro de XP');
select ok(not has_function_privilege('authenticated', 'private.grant_xp(uuid, text, text, integer)', 'execute')
          and not has_function_privilege('anon', 'private.grant_xp(uuid, text, text, integer)', 'execute'),
  'grant_xp fora do alcance do cliente');
select ok(not has_function_privilege('authenticated', 'public.svc_grant_xp(uuid, text, text, integer)', 'execute')
          and has_function_privilege('service_role', 'public.svc_grant_xp(uuid, text, text, integer)', 'execute'),
  'svc_grant_xp só para o service role');
select ok(not has_function_privilege('anon', 'public.server_info()', 'execute'), 'anon não chama server_info');

-- ---------------------------------------------------------------------------
-- Flags: tudo desligado por padrão; territory_rule = v1
-- ---------------------------------------------------------------------------
select is((select count(*)::int from jsonb_each((select value from public.game_config where key = 'features')) f
            where f.value <> 'false'::jsonb), 0, 'todas as flags de feature começam desligadas');
select ok((select value ? 'raid' and value ? 'league' and value ? 'missions' and value ? 'dailyChest'
             from public.game_config where key = 'features'), 'flags raid, league, missions e dailyChest existem');
select throws_ok($$ update public.game_config set value = '"v3"' where key = 'territory_rule' $$, '23514', null,
  'territory_rule só aceita v1 ou v2');

-- Fixtures
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0014-4000-8000-00000000000a', 'authenticated', 'authenticated', 'c14a@t.com',
   '{"username": "c14_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0014-4000-8000-00000000000b', 'authenticated', 'authenticated', 'c14b@t.com',
   '{"username": "c14_b", "birthdate": "1995-01-01", "terms_accepted": true}');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ---------------------------------------------------------------------------
-- server_info
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0014-4000-8000-00000000000a');
select is((public.server_info() ->> 'contract')::int, 2, 'server_info: contrato 2');
select is(public.server_info() ->> 'territoryRule', 'v1', 'server_info: regra de território v1 até a virada de temporada');
select is((public.server_info() -> 'features' ->> 'raid')::boolean, false, 'server_info: flags vêm de game_config');
select is((public.server_info() -> 'params' -> 'raid' ->> 'runCapKm')::int, 21, 'server_info: parâmetros públicos (teto de 21 km)');
select is((public.server_info() -> 'params' -> 'daily_chest' -> 'odds' ->> 'lendario')::numeric, 0.05,
  'server_info: chances do baú visíveis (D-66)');
select ok((public.server_info() ->> 'brToday') is not null and (public.server_info() ->> 'serverTime')::bigint > 0,
  'server_info: hora do servidor e dia de Brasília');
select is((select count(*)::int from public.game_config), 7, 'cliente lê game_config pela RLS');
reset role;

-- ---------------------------------------------------------------------------
-- grant_xp: idempotente por fonte + referência; XP nunca diminui
-- ---------------------------------------------------------------------------
select is(private.grant_xp('e9e9e9e9-0014-4000-8000-00000000000a', 'mission', 'm-1', 30), 30, 'grant_xp credita');
select is(private.grant_xp('e9e9e9e9-0014-4000-8000-00000000000a', 'mission', 'm-1', 30), 0, 'grant_xp repetido não paga de novo');
select is(private.grant_xp('e9e9e9e9-0014-4000-8000-00000000000a', 'mission', 'm-2', -50), 0, 'grant_xp ignora valor negativo');
select is((select xp from public.profiles where id = 'e9e9e9e9-0014-4000-8000-00000000000a'), 30, 'profiles.xp = soma do livro');
select is((select season_id from public.xp_ledger where ref_id = 'm-1'), public.current_season_id(), 'crédito guarda a temporada');
select throws_like($$ update public.profiles set xp = 0 where id = 'e9e9e9e9-0014-4000-8000-00000000000a' $$, '%XP_DECREASE%',
  'XP nunca diminui, nem pelo servidor');

select pg_temp.login('e9e9e9e9-0014-4000-8000-00000000000b');
select is((select count(*)::int from public.xp_ledger), 0, 'cada um lê só o próprio livro');
select throws_ok($$ insert into public.xp_ledger (user_id, source, ref_id, amount)
                    values ('e9e9e9e9-0014-4000-8000-00000000000b', 'mission', 'falso', 5000) $$,
  '42501', null, 'cliente não se credita XP');
reset role;

-- ---------------------------------------------------------------------------
-- Notificações: superconjunto
-- ---------------------------------------------------------------------------
select lives_ok($$ insert into public.notifications (user_id, type, title, body) values
  ('e9e9e9e9-0014-4000-8000-00000000000a', 'raid', 'Chefão', 'corpo'),
  ('e9e9e9e9-0014-4000-8000-00000000000a', 'league', 'Liga', 'corpo'),
  ('e9e9e9e9-0014-4000-8000-00000000000a', 'reward', 'Baú', 'corpo'),
  ('e9e9e9e9-0014-4000-8000-00000000000a', 'invasion', 'Antigo', 'corpo') $$,
  'tipos novos (raid, league, reward) e antigos aceitos');
select throws_ok($$ insert into public.notifications (user_id, type, title, body)
                    values ('e9e9e9e9-0014-4000-8000-00000000000a', 'spam', 'x', 'y') $$, '23514', null,
  'tipo fora da lista continua recusado');

select * from finish();
rollback;
