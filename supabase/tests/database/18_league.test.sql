-- T7.1.23 (D-68; contrato E3 §2.4 e §4.3) — Liga semanal: esquema, RLS, entrada na 1ª corrida (leaguePlaceNewcomer),
-- pontos idempotentes por corrida, grupos de até 30, fechamento na segunda 03:20 (idempotente) com leagueStandingsV2
-- (vagas = min(5, ⌊n/6⌋); grupo pequeno < 6: só o 1º sobe, ninguém desce; quem fez 0 não sobe; desempate por quem
-- chegou antes aos pontos), grupos da semana seguinte (leagueGroupsV2, reserva), semana fechada recusa pontos e a tela
-- mostra só o próprio grupo. Datas fixas (semana de 14/09/2026), exceto a tela.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- ---------------------------------------------------------------------------
-- Esquema, RLS e grants
-- ---------------------------------------------------------------------------
select is((select array_agg(t order by t) from unnest(array['league_groups', 'league_members', 'league_reservations', 'league_entries',
                                                           'league_standings']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_table_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'liga: RLS nas 5 tabelas, cliente não escreve, anon não lê');
select ok(not has_table_privilege('authenticated', 'public.league_groups', 'select')
          and not has_table_privilege('authenticated', 'public.league_reservations', 'select'), 'cliente não lista os grupos dos outros');
select ok(not has_function_privilege('authenticated', 'private.add_league_points(uuid, integer, timestamptz)', 'execute'),
  'pontos só pelo servidor');
select ok(not has_function_privilege('authenticated', 'public.job_close_league(timestamptz)', 'execute')
          and has_function_privilege('service_role', 'public.job_close_league(timestamptz)', 'execute'), 'job só para o service role');
select is((select schedule from cron.job where jobname = 'nomaderun-close-league'), '20 6 * * 1', 'fecha segunda 06:20 UTC = 03:20 de Brasília');
select is(private.league_closes_at('2026-09-14'), '2026-09-21 03:20-03'::timestamptz, 'leagueWeek: semana de 14/09 fecha em 21/09 às 03:20');
select is(array[private.league_moves(5), private.league_moves(6), private.league_moves(12), private.league_moves(30), private.league_moves(36)],
  array[0, 1, 2, 5, 5], 'leagueMovesFor: 0 abaixo de 6; min(5, ⌊n/6⌋)');

-- ---------------------------------------------------------------------------
-- Fixtures: U01..U31 (divisão 0), D1..D6 (divisão 1), E1 e E2 (divisão 2); A e B para a tela
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0018-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'authenticated', 'authenticated', 'c18u' || i || '@t.com',
       json_build_object('username', 'c18_u' || lpad(i::text, 2, '0'), 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from generate_series(1, 31) i;
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0018-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid,
       'authenticated', 'authenticated', 'c18d' || i || '@t.com',
       json_build_object('username', 'c18_d' || i, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from generate_series(1, 8) i;
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0018-4000-8000-00000000aaaa', 'authenticated', 'authenticated', 'c18a@t.com',
   '{"username": "c18_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0018-4000-8000-00000000bbbb', 'authenticated', 'authenticated', 'c18b@t.com',
   '{"username": "c18_b", "birthdate": "1995-01-01", "terms_accepted": true}');
update public.profiles set faction = 'owls' where id::text like 'e9e9e9e9-0018-%';
insert into public.league_standings (user_id, division, best_division)
select ('e9e9e9e9-0018-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, case when i <= 6 then 1 else 2 end, case when i <= 6 then 1 else 2 end
  from generate_series(1, 8) i;

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.run(uid uuid, act uuid, ended timestamptz, rp integer) returns void language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored, rp_total)
  values (act, uid, 'valid', ended - interval '40 minutes', ended, ended, 5000, 1650, 330, true, rp)
$$;

-- ---------------------------------------------------------------------------
-- Flag desligada
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0018-4000-8000-000000000001', 'e9e9e9e9-1018-4000-8000-000000000001', '2026-09-15 07:00-03', 10);
select is(private.add_league_points('e9e9e9e9-1018-4000-8000-000000000001', null, '2026-09-18 12:00-03'), null,
  'flag desligada: a corrida não entra na liga');
select pg_temp.login('e9e9e9e9-0018-4000-8000-00000000aaaa');
select throws_like($$ select public.league_current() $$, '%FEATURE_DISABLED%', 'flag desligada: league_current recusa');
reset role;
update public.game_config set value = value || '{"league": true}' where key = 'features';

-- ---------------------------------------------------------------------------
-- Entrada e pontos
-- ---------------------------------------------------------------------------
select results_eq($$ select (r ->> 'points')::int, (r ->> 'total')::int, (r ->> 'division')::int, (r ->> 'repeated')::boolean
                       from (select private.add_league_points('e9e9e9e9-1018-4000-8000-000000000001', null, '2026-09-18 12:00-03') r) x $$,
  $$ values (10, 10, 0, false) $$, '1ª corrida da semana: entra na divisão 0 com os pontos da corrida');
select is((private.add_league_points('e9e9e9e9-1018-4000-8000-000000000001', null, '2026-09-18 12:00-03') ->> 'repeated')::boolean, true,
  'a mesma corrida não soma duas vezes');
select is((select points from public.league_members where user_id = 'e9e9e9e9-0018-4000-8000-000000000001'), 10, 'pontos não dobraram');
-- U02..U31 entram com i × 10 pontos
select pg_temp.run(('e9e9e9e9-0018-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
                   ('e9e9e9e9-1018-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, '2026-09-16 07:00-03', i * 10)
  from generate_series(2, 31) i;
select count(private.add_league_points(('e9e9e9e9-1018-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, null, '2026-09-18 12:00-03'))
  from generate_series(2, 31) i;
select results_eq($$ select g.idx::int, count(m.user_id)::int from public.league_groups g join public.league_members m on m.group_id = g.id
                      where g.week_start = '2026-09-14' and g.division = 0 group by g.idx order by g.idx $$,
  $$ values (0, 30), (1, 1) $$, 'leaguePlaceNewcomer: o último grupo enche até 30; o 31º abre o grupo seguinte');
-- D1..D6 (divisão 1): D1 com 0 pontos, D2..D6 com 10..50
select pg_temp.run(('e9e9e9e9-0018-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid,
                   ('e9e9e9e9-1018-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, '2026-09-17 07:00-03', (i - 1) * 10)
  from generate_series(1, 6) i;
select count(private.add_league_points(('e9e9e9e9-1018-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, null, '2026-09-18 12:00-03'))
  from generate_series(1, 6) i;
select is((select count(distinct group_id)::int from public.league_members where week_start = '2026-09-14' and division = 1), 1,
  'divisão 1: um grupo de 6');
-- E1 e E2 (divisão 2) empatados em 50 pontos: E2 chegou antes
select pg_temp.run('e9e9e9e9-0018-4000-8000-000000000108', 'e9e9e9e9-1018-4000-8000-000000000108', '2026-09-15 08:00-03', 50);
select pg_temp.run('e9e9e9e9-0018-4000-8000-000000000107', 'e9e9e9e9-1018-4000-8000-000000000107', '2026-09-16 08:00-03', 50);
select private.add_league_points('e9e9e9e9-1018-4000-8000-000000000108', null, '2026-09-15 09:00-03');
select private.add_league_points('e9e9e9e9-1018-4000-8000-000000000107', null, '2026-09-16 09:00-03');

-- ---------------------------------------------------------------------------
-- Fechamento
-- ---------------------------------------------------------------------------
select is(public.job_close_league('2026-09-21 03:00-03'), 0, 'antes de segunda 03:20 não fecha');
select pg_temp.run('e9e9e9e9-0018-4000-8000-000000000102', 'e9e9e9e9-1018-4000-8000-000000000199', '2026-09-20 20:00-03', 15);
select is((private.add_league_points('e9e9e9e9-1018-4000-8000-000000000199', null, '2026-09-21 02:00-03') ->> 'total')::int, 25,
  'corrida de domingo sincronizada até segunda 03:20 ainda conta');
select is(public.job_close_league('2026-09-21 03:30-03'), 4, 'segunda 03:30: fecha os 4 grupos da semana');
select is((select array_agg(substr(user_id::text, 33) order by user_id) from public.league_members
            where week_start = '2026-09-14' and outcome = 'promoted' and division = 0),
  array['0026', '0027', '0028', '0029', '0030', '0031'], 'grupo de 30: os 5 primeiros sobem; grupo de 1: o 1º sobe (pontuou)');
select is((select count(*)::int from public.league_members where week_start = '2026-09-14' and division = 0 and outcome = 'relegated'), 0,
  'divisão 0 não desce');
select results_eq($$ select substr(user_id::text, 33), outcome, final_rank::int from public.league_members
                      where week_start = '2026-09-14' and division = 1 and outcome <> 'stays' order by outcome $$,
  $$ values ('0106'::text, 'promoted'::text, 1), ('0101', 'relegated', 6) $$,
  'grupo de 6: 1 sobe e 1 desce');
select results_eq($$ select substr(user_id::text, 33), outcome, final_rank::int from public.league_members
                      where week_start = '2026-09-14' and division = 2 order by final_rank $$,
  $$ values ('0108'::text, 'promoted'::text, 1), ('0107', 'stays', 2) $$,
  'grupo pequeno (2): só o 1º sobe e ninguém desce; empate decidido por quem chegou antes aos pontos');
select results_eq($$ select division::int, best_division::int, weeks_played from public.league_standings
                      where user_id = 'e9e9e9e9-0018-4000-8000-000000000106' $$,
  $$ values (2, 2, 1) $$, 'quem subiu muda de divisão na tabela de posição');
select is((select division::int from public.league_standings where user_id = 'e9e9e9e9-0018-4000-8000-000000000101'), 0, 'quem desceu também');
select is((select division::int from public.league_standings where user_id = 'e9e9e9e9-0018-4000-8000-000000000026'), 1, 'divisão 0 → 1');
select is((select count(*)::int from public.notifications where type = 'league' and user_id::text like 'e9e9e9e9-0018-%'), 9,
  'notificação só para quem subiu ou desceu (6 + 1 + 1 + 1)');
select is((select tier from public.user_medals where user_id = 'e9e9e9e9-0018-4000-8000-000000000108' and medal_id = 'liga'), 'prata',
  'subir para a divisão 3 dá a medalha da liga de prata');
select is(public.job_close_league('2026-09-21 03:40-03'), 0, 'rodar de novo não fecha nada');
select is((select weeks_played from public.league_standings where user_id = 'e9e9e9e9-0018-4000-8000-000000000106'), 1,
  'nem conta a semana duas vezes');
select pg_temp.run('e9e9e9e9-0018-4000-8000-000000000104', 'e9e9e9e9-1018-4000-8000-000000000198', '2026-09-20 21:00-03', 99);
select is(private.add_league_points('e9e9e9e9-1018-4000-8000-000000000198', null, '2026-09-21 04:00-03') ->> 'error', 'WEEK_CLOSED',
  'semana fechada recusa pontos');

-- ---------------------------------------------------------------------------
-- Grupos da semana seguinte (leagueGroupsV2) e entrada no meio da semana
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.league_reservations where week_start = '2026-09-21'), 39,
  'fechamento reserva vaga para os 39 que jogaram');
select results_eq($$ select g.division::int, count(r.user_id)::int from public.league_groups g join public.league_reservations r on r.group_id = g.id
                      where g.week_start = '2026-09-21' group by g.division order by g.division $$,
  $$ values (0, 26), (1, 10), (2, 2), (3, 1) $$, 'grupos da semana nova pela divisão nova (até 30 por grupo)');
select pg_temp.run('e9e9e9e9-0018-4000-8000-000000000001', 'e9e9e9e9-1018-4000-8000-000000000201', '2026-09-22 07:00-03', 5);
select private.add_league_points('e9e9e9e9-1018-4000-8000-000000000201', null, '2026-09-22 08:00-03');
select is((select group_id from public.league_members where week_start = '2026-09-21' and user_id = 'e9e9e9e9-0018-4000-8000-000000000001'),
          (select group_id from public.league_reservations where week_start = '2026-09-21' and user_id = 'e9e9e9e9-0018-4000-8000-000000000001'),
  'quem tem reserva entra no grupo reservado');
select pg_temp.run('e9e9e9e9-0018-4000-8000-00000000aaaa', 'e9e9e9e9-1018-4000-8000-000000000202', '2026-09-24 07:00-03', 5);
select private.add_league_points('e9e9e9e9-1018-4000-8000-000000000202', null, '2026-09-24 08:00-03');
select is((select g.idx::int from public.league_members m join public.league_groups g on g.id = m.group_id
            where m.week_start = '2026-09-21' and m.user_id = 'e9e9e9e9-0018-4000-8000-00000000aaaa'), 0,
  'quem chega no meio da semana sem reserva entra no último grupo da divisão, se tem vaga');
delete from public.league_members where week_start = '2026-09-21';
delete from public.league_entries where week_start = '2026-09-21';

-- ---------------------------------------------------------------------------
-- Tela (semana de hoje) e RLS
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0018-4000-8000-00000000aaaa', 'e9e9e9e9-1018-4000-8000-00000000aaa1',
                   greatest(now() - interval '1 minute', (private.week_start_br(now()) + time '00:00:01') at time zone 'America/Sao_Paulo'), 40);
select pg_temp.run('e9e9e9e9-0018-4000-8000-00000000bbbb', 'e9e9e9e9-1018-4000-8000-00000000bbb1',
                   greatest(now() - interval '1 minute', (private.week_start_br(now()) + time '00:00:01') at time zone 'America/Sao_Paulo'), 60);
select count(private.add_league_points(x, null, now()))
  from unnest(array['e9e9e9e9-1018-4000-8000-00000000aaa1', 'e9e9e9e9-1018-4000-8000-00000000bbb1']::uuid[]) x;
create temp table expected_close as select private.ts_to_ms(private.league_closes_at(private.week_start_br(now()))) as ms;
grant select on expected_close to authenticated;
select pg_temp.login('e9e9e9e9-0018-4000-8000-00000000aaaa');
select results_eq($$ select (r ->> 'joined')::boolean, r ->> 'divisionName', jsonb_array_length(r -> 'members'),
                            r -> 'members' -> 0 ->> 'username', (r -> 'members' -> 1 ->> 'you')::boolean, (r ->> 'smallGroup')::boolean,
                            (r ->> 'promoteSlots')::int, (r ->> 'relegateSlots')::int
                       from (select public.league_current() r) x $$,
  $$ values (true, 'Calçada'::text, 2, 'c18_b'::text, true, true, 1, 0) $$, 'league_current: meu grupo, ordenado por pontos, com "você" e as vagas');
select is((public.league_current() ->> 'closesAt')::bigint, (select ms from expected_close), 'prazo: segunda 03:20');
select ok(public.league_current()::text !~ 'e9e9e9e9', 'league_current não expõe ids');
select is((select count(*)::int from public.league_members where week_start = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date), 1,
  'a tabela mostra só a própria participação');
select throws_ok($$ update public.league_members set points = 9999 $$, '42501', null, 'cliente não muda os próprios pontos');
reset role;

select * from finish();
rollback;
