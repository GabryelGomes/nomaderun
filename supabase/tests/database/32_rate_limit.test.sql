-- Fase 8, onda C, C3 (E10 + E9, D-99): limite de chamadas por pessoa das Edge Functions
-- (private.rate_limits + public.svc_rate_limit_hit). Janela de 3600 s nos testes para a virada de janela não cair
-- no meio (e, mesmo se cair, a janela anterior pesa ~100% e o resultado é o mesmo).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0032-4000-8000-00000000000a', 'authenticated', 'authenticated', 'rl_a@t.com',
   '{"username": "rl_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0032-4000-8000-00000000000b', 'authenticated', 'authenticated', 'rl_b@t.com',
   '{"username": "rl_b", "birthdate": "1995-01-01", "terms_accepted": true}');

-- 1. Estrutura e privilégios
select has_table('private', 'rate_limits', 'tabela private.rate_limits existe');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'private' and c.relname = 'rate_limits'), 'private.rate_limits com RLS ligada');
select ok(not has_table_privilege('authenticated', 'private.rate_limits', 'select')
          and not has_table_privilege('authenticated', 'private.rate_limits', 'insert')
          and not has_table_privilege('authenticated', 'private.rate_limits', 'update')
          and not has_table_privilege('anon', 'private.rate_limits', 'select'),
          'cliente não lê nem escreve o contador');
select ok(not has_function_privilege('authenticated', 'public.svc_rate_limit_hit(uuid, text, integer, integer)', 'execute')
          and not has_function_privilege('anon', 'public.svc_rate_limit_hit(uuid, text, integer, integer)', 'execute'),
          'cliente não chama svc_rate_limit_hit (não zera nem gasta o limite de outra pessoa)');
select ok(has_function_privilege('service_role', 'public.svc_rate_limit_hit(uuid, text, integer, integer)', 'execute'),
          'service role chama svc_rate_limit_hit');
select ok((select bool_or(cfg like 'search_path=%') from pg_proc p, unnest(p.proconfig) cfg
            where p.oid = 'public.svc_rate_limit_hit(uuid, text, integer, integer)'::regprocedure),
          'svc_rate_limit_hit com search_path fixo');

-- 2. Comportamento: limite 3 por janela
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'finish', 3, 3600) ->> 'allowed')::boolean, true, '1ª chamada passa');
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'finish', 3, 3600) ->> 'remaining')::integer, 1, '2ª chamada passa e sobra 1');
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'finish', 3, 3600) ->> 'allowed')::boolean, true, '3ª chamada passa (no limite)');
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'finish', 3, 3600) ->> 'allowed')::boolean, false, '4ª chamada é recusada');
select ok((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'finish', 3, 3600) ->> 'retryAfter')::integer between 1 and 3600,
          'recusa diz em quantos segundos tentar de novo (1..janela)');
select is((select hits from private.rate_limits where user_id = 'e9e9e9e9-0032-4000-8000-00000000000a' and bucket = 'finish'), 3,
          'chamada recusada não conta (quem insiste não fica preso para sempre)');

-- 3. Baldes e pessoas são independentes
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'geral', 3, 3600) ->> 'allowed')::boolean, true,
          'outro balde da mesma pessoa continua livre');
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000b', 'finish', 3, 3600) ->> 'allowed')::boolean, true,
          'outra pessoa no mesmo balde continua livre');

-- 4. Janela velha (2 janelas atrás) não pesa: zera
update private.rate_limits set window_start = window_start - interval '2 hours'
 where user_id = 'e9e9e9e9-0032-4000-8000-00000000000a' and bucket = 'finish';
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'finish', 3, 3600) ->> 'allowed')::boolean, true,
          'depois de 2 janelas o contador recomeça');

-- 5. Janela anterior cheia pesa na atual (janela deslizante, não fixa)
update private.rate_limits set window_start = window_start - interval '1 hour', hits = 10000, prev_hits = 0
 where user_id = 'e9e9e9e9-0032-4000-8000-00000000000a' and bucket = 'finish';
select is((public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'finish', 3, 3600) ->> 'allowed')::boolean, false,
          'janela anterior cheia ainda conta no começo da nova (não dá para estourar o limite na virada)');

-- 6. Entradas inválidas
select throws_ok($$ select public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'Geral; drop', 3, 60) $$,
                 'P0001', 'VALIDATION: balde inválido', 'balde fora do padrão é recusado');
select throws_ok($$ select public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'geral', 0, 60) $$,
                 'P0001', 'VALIDATION: limite fora de 1..10000', 'limite 0 é recusado');
select throws_ok($$ select public.svc_rate_limit_hit('e9e9e9e9-0032-4000-8000-00000000000a', 'geral', 3, 0) $$,
                 'P0001', 'VALIDATION: janela fora de 1..3600 s', 'janela 0 é recusada');

-- 7. Excluir a conta apaga o contador (LGPD: nada sobra)
delete from auth.users where id = 'e9e9e9e9-0032-4000-8000-00000000000b';
select is((select count(*)::integer from private.rate_limits where user_id = 'e9e9e9e9-0032-4000-8000-00000000000b'), 0,
          'excluir a conta apaga as linhas do contador');

select * from finish();
rollback;
