-- T7.1.23 (D-63; contrato E7 §3 e §7) — sequência v2 e pausa de saúde: com a flag desligada o job_close_week faz o
-- mesmo de antes; ligada, segue closeStreakWeek (congelamento só com sequência a proteger, semana na pausa não muda,
-- melhor sequência nunca diminui, aviso na central). Pausa de 1 a 4 semanas, 1 vez por temporada.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select ok(not has_function_privilege('anon', 'public.start_health_pause(integer)', 'execute')
          and not has_function_privilege('anon', 'public.end_health_pause()', 'execute'), 'anon não pausa');
select is((select array_agg(c order by c) from unnest(array['pause_from', 'pause_until', 'pause_used_season', 'best_streak_weeks',
                                                           'daily_chest_pity', 'lifetime_meters', 'ftue_started_at', 'last_activity_at']) c
            where has_column_privilege('authenticated', 'public.profiles', c, 'update')), null,
  'colunas novas do perfil só pelo servidor');

-- Fixtures: semana fixa de 07/09/2026 (segunda)
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0020-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'c20' || c || '@t.com', json_build_object('username', 'c20_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c', 'd', 'e', 'f']) c;
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.run(uid uuid, ended timestamptz) returns void language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
  values (gen_random_uuid(), uid, 'valid', ended - interval '40 minutes', ended, ended, 3000, 1000, 330, true)
$$;
-- A: 2 atividades (mantém) · B: 3 semanas e 1 congelamento, sem atividade · C: 3 semanas, sem congelamento
-- D: 0 semanas e 1 congelamento · E: 3 semanas, em pausa · F: igual a D, para a regra v1
select pg_temp.run('e9e9e9e9-0020-4000-8000-00000000000a', '2026-09-08 07:00-03');
select pg_temp.run('e9e9e9e9-0020-4000-8000-00000000000a', '2026-09-10 07:00-03');
update public.profiles set streak_weeks = 4, best_streak_weeks = 4, freezes_left = 1 where id = 'e9e9e9e9-0020-4000-8000-00000000000a';
update public.profiles set streak_weeks = 3, best_streak_weeks = 5, freezes_left = 1 where id = 'e9e9e9e9-0020-4000-8000-00000000000b';
update public.profiles set streak_weeks = 3, best_streak_weeks = 3, freezes_left = 0 where id = 'e9e9e9e9-0020-4000-8000-00000000000c';
update public.profiles set streak_weeks = 0, freezes_left = 1 where id in ('e9e9e9e9-0020-4000-8000-00000000000d', 'e9e9e9e9-0020-4000-8000-00000000000f');
update public.profiles set streak_weeks = 3, best_streak_weeks = 3, freezes_left = 1, pause_from = '2026-09-07', pause_until = '2026-09-20',
                           pause_used_season = '2026-09' where id = 'e9e9e9e9-0020-4000-8000-00000000000e';

-- ---------------------------------------------------------------------------
-- Flag desligada: regra v1 intacta
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.job_close_week('2026-08-31') $$, 'flag desligada: o job roda como antes');
select results_eq($$ select streak_weeks::int, freezes_left::int from public.profiles where id = 'e9e9e9e9-0020-4000-8000-00000000000f' $$,
  $$ values (0, 0) $$, 'v1: sem sequência ainda gasta o congelamento (comportamento antigo preservado)');
-- desfaz o efeito da semana anterior para a regra v2
update public.profiles set streak_weeks = 4, best_streak_weeks = 4, freezes_left = 1 where id = 'e9e9e9e9-0020-4000-8000-00000000000a';
update public.profiles set streak_weeks = 3, best_streak_weeks = 5, freezes_left = 1 where id = 'e9e9e9e9-0020-4000-8000-00000000000b';
update public.profiles set streak_weeks = 3, best_streak_weeks = 3, freezes_left = 0 where id = 'e9e9e9e9-0020-4000-8000-00000000000c';
update public.profiles set streak_weeks = 0, freezes_left = 1 where id = 'e9e9e9e9-0020-4000-8000-00000000000d';
update public.profiles set streak_weeks = 3, freezes_left = 1 where id = 'e9e9e9e9-0020-4000-8000-00000000000e';
update public.game_config set value = value || '{"streakV2": true}' where key = 'features';

-- ---------------------------------------------------------------------------
-- Regra v2 (closeStreakWeek)
-- ---------------------------------------------------------------------------
select ok(public.job_close_week('2026-09-07') >= 3, 'flag ligada: fecha a semana');
select results_eq($$ select substr(id::text, 36), streak_weeks::int, best_streak_weeks::int, freezes_left::int from public.profiles
                      where id::text like 'e9e9e9e9-0020-%' and substr(id::text, 36) in ('a', 'b', 'c', 'd', 'e') order by id $$,
  $$ values ('a'::text, 5, 5, 1), ('b', 3, 5, 0), ('c', 0, 3, 0), ('d', 0, 0, 1), ('e', 3, 3, 1) $$,
  '2 atividades mantêm; congelamento protege; sem congelamento zera (a melhor fica); sem sequência não gasta; pausa não muda');
select is((select count(*)::int from public.notifications where user_id::text like 'e9e9e9e9-0020-%' and type = 'engagement'
              and data ->> 'kind' = 'sequencia'), 1, 'aviso "Semana protegida pelo congelamento" só para quem gastou');

-- ---------------------------------------------------------------------------
-- Pausa de saúde
-- ---------------------------------------------------------------------------
update public.game_config set value = value || '{"streakV2": false}' where key = 'features';
select pg_temp.login('e9e9e9e9-0020-4000-8000-00000000000d');
select throws_like($$ select public.start_health_pause(2) $$, '%FEATURE_DISABLED%', 'flag desligada: sem pausa');
reset role;
update public.game_config set value = value || '{"streakV2": true}' where key = 'features';
select pg_temp.login('e9e9e9e9-0020-4000-8000-00000000000d');
select throws_like($$ select public.start_health_pause(0) $$, '%PAUSE_WEEKS%', 'pausa de 0 semanas: recusada');
select throws_like($$ select public.start_health_pause(5) $$, '%PAUSE_WEEKS%', 'pausa de 5 semanas: recusada');
create temp table p1 as select public.start_health_pause(2) as r;
select results_eq($$ select (r ->> 'from')::date, (r ->> 'until')::date, r ->> 'seasonId' from p1 $$,
  $$ values (date_trunc('week', public.br_today())::date, date_trunc('week', public.br_today())::date + 13, public.current_season_id()) $$,
  '2 semanas a partir da segunda da semana atual');
select throws_like($$ select public.start_health_pause(1) $$, '%PAUSE_ACTIVE%', 'pausa já valendo');
select throws_ok($$ update public.profiles set pause_until = '2030-01-01' where id = auth.uid() $$, '42501', null,
  'cliente não estende a pausa direto na tabela');
select is((public.end_health_pause() ->> 'until')::date, date_trunc('week', public.br_today())::date + 6,
  'encerrar antes protege só a semana atual');
select throws_like($$ select public.start_health_pause(1) $$, '%PAUSE_ACTIVE%', 'a semana atual continua protegida');
reset role;
update public.profiles set pause_from = '2020-01-06', pause_until = '2020-01-12' where id = 'e9e9e9e9-0020-4000-8000-00000000000d';
select pg_temp.login('e9e9e9e9-0020-4000-8000-00000000000d');
select throws_like($$ select public.start_health_pause(1) $$, '%PAUSE_USED%', 'uma pausa por temporada');
select pg_temp.login('e9e9e9e9-0020-4000-8000-00000000000f');
select is(public.end_health_pause(), null, 'sem pausa: encerrar não faz nada');
select public.start_health_pause(4);
select is((public.end_health_pause() ->> 'until')::date - (public.end_health_pause() ->> 'from')::date, 6,
  'outra pessoa pausa 4 semanas e encerra na mesma semana');
reset role;
select is((select count(*)::int from public.profiles where id::text like 'e9e9e9e9-0020-%' and pause_used_season = public.current_season_id()), 2,
  'a temporada da pausa fica registrada');

select * from finish();
rollback;
