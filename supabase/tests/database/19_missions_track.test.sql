-- T7.1.23 (D-65/D-64) — missões e trilha da temporada: catálogo com os ids da E7, sorteio 3+3 determinístico com 1 leve,
-- só missões possíveis, metas adaptativas, progresso com teto (somas e conjuntos distintos), resgate idempotente, troca
-- de 1 por dia, primeira semana (1 passo por dia, substituto sem raid, crew automática, compartilhar), volta, trilha.
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

-- ---------------------------------------------------------------------------
-- Esquema, RLS, catálogo
-- ---------------------------------------------------------------------------
select is((select array_agg(t order by t) from unnest(array['mission_defs', 'user_missions', 'track_rewards', 'track_claims']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_table_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'missões e trilha: RLS, cliente não escreve, anon não lê');
select is((select array_agg(f order by f) from unnest(array['private.advance_missions(uuid, jsonb, timestamptz)',
                                                           'private.ensure_missions(uuid, timestamptz, uuid)',
                                                           'private.assign_mission(uuid, text, text, integer, timestamptz)']) f
            where has_function_privilege('authenticated', f, 'execute')), null, 'progresso e sorteio só pelo servidor');
select ok(not has_function_privilege('anon', 'public.my_missions()', 'execute') and not has_function_privilege('anon', 'public.claim_mission(uuid)', 'execute'),
  'anon não chama as RPCs de missão');
select is((select array_agg(id order by id) from public.mission_defs),
  array['d-1500m', 'd-caca-2', 'd-conquistar', 'd-crew', 'd-defender', 'd-fantasma', 'd-km', 'd-mover-15', 'd-neblina-20',
        'd-neblina-5', 'd-pintar-3', 'f1-dominio', 'f2-caca', 'f3-fuga', 'f4-raid', 'f5-crew', 'f6-liga', 'f7-compartilhar',
        's-2-atividades', 's-60-min', 's-bairros-2', 's-chefao', 's-conquistar-3', 's-crew-2', 's-km', 's-pintar-10',
        'v-14', 'v-30', 'v-7'],
  'catálogo: as 29 missões com os ids do catalogo.ts da E7');
select is((select max(char_length(replace(coalesce(t, ''), '{x}', '15'))) from public.mission_defs d, unnest(array[d.text, d.fallback_text]) t)
          <= 40, true, 'todo texto (com {x} e substituto) cabe em 40 caracteres');
select is((select count(*)::int from (select cadence, tier from public.mission_defs where cadence in ('diaria', 'semanal')
                                       group by cadence, tier) x), 6, 'diárias e semanais têm leve, padrão e desafio');
select is(array[private.km_text(3500), private.km_text(8000), private.km_text(1500), private.km_text(40000)],
  array['3,5', '8', '1,5', '40'], 'km com vírgula e sem ",0"');
select is((select count(*)::int from public.track_rewards), 27, 'trilha: 24 degraus (27 itens)');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0019-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'c19' || c || '@t.com', json_build_object('username', 'c19_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c', 'd', 'e', 'f']) c;
update public.profiles set faction = 'coyotes' where id::text like 'e9e9e9e9-0019-%';
insert into public.crews (name, tag, leader_id) values ('Crew Missão', 'MISSA', 'e9e9e9e9-0019-4000-8000-00000000000f');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.run(uid uuid, ended timestamptz, meters real) returns void language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
  values (gen_random_uuid(), uid, 'valid', ended - interval '40 minutes', ended, ended, meters, meters * 0.33, 330, true)
$$;
create function pg_temp.week_ago(g integer) returns timestamptz language sql as $$
  select ((date_trunc('week', now() at time zone 'America/Sao_Paulo')::date - 7 * g + 2) + time '12:00') at time zone 'America/Sao_Paulo'
$$;

-- ---------------------------------------------------------------------------
-- Flag e sorteio
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000a');
select throws_like($$ select public.my_missions() $$, '%FEATURE_DISABLED%', 'flag desligada: my_missions recusa');
reset role;
update public.game_config set value = value || '{"missions": true, "track": true}' where key = 'features';

select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000a');
create temp table m1 as select public.my_missions() as r;
select results_eq($$ select jsonb_array_length(r -> 'daily'), jsonb_array_length(r -> 'weekly'), r -> 'ftue' -> 'mission' ->> 'defId',
                            (r -> 'ftue' ->> 'step')::int, r ->> 'comeback', (r ->> 'rerollsLeft')::int from m1 $$,
  $$ values (3, 3, 'f1-dominio'::text, 1, null::text, 1) $$, 'conta nova: 3 diárias, 3 semanais e o passo 1 da primeira semana');
select is((select array[r -> 'daily' -> 0 ->> 'tier', r -> 'daily' -> 1 ->> 'tier', r -> 'daily' -> 2 ->> 'tier',
                        r -> 'weekly' -> 0 ->> 'tier'] from m1),
  array['leve', 'padrao', 'desafio', 'leve'], 'sempre 1 leve (e 1 padrão e 1 desafio)');
select is((select jsonb_path_query_array(public.my_missions(), '$.daily[*].defId')),
          (select jsonb_path_query_array(r, '$.daily[*].defId') from m1), 'chamar de novo devolve as mesmas (determinístico)');
select is((select count(*)::int from public.user_missions), 7, 'nada sorteado em dobro');
select is((select count(*)::int from m1, jsonb_array_elements(r -> 'daily') d where d ->> 'defId' = 'd-crew')
        + (select count(*)::int from m1, jsonb_array_elements(r -> 'weekly') d where d ->> 'defId' in ('s-crew-2', 's-chefao')), 0,
  'sem crew e sem raid real: essas missões não aparecem');
reset role;
-- o sorteio é o md5(usuário + período + id): conferido de fora
select is((select r -> 'daily' -> 0 ->> 'defId' from m1),
          (select id from public.mission_defs where cadence = 'diaria' and tier = 'leve'
            order by md5('e9e9e9e9-0019-4000-8000-00000000000a' || public.br_today()::text || id) limit 1),
  'sorteio reproduzível pela semente');

-- ---------------------------------------------------------------------------
-- Metas adaptativas
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000c', pg_temp.week_ago(2) + make_interval(mins => g), 4200) from generate_series(1, 10) g;
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000d', pg_temp.week_ago(g), 10000) from generate_series(1, 4) g;
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000b', 'd-km', 2000, now()), 2000, 'd-km sem corridas: 2 km');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000c', 'd-km', 2000, now()), 4000, 'd-km: mediana das 10 últimas (4,2 → 4 km)');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000d', 'd-km', 2000, now()), 8000, 'd-km: no máximo 8 km');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000c', 's-km', 6000, now()), 6000, 's-km: mínimo 6 km');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000d', 's-km', 6000, now()), 9000, 's-km: 90 % da mediana semanal');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000d', 's-chefao', 3000, now()), 4500, 's-chefao: metade da meta semanal');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000d', 'd-km', '2020-01-01', 2, now());
select is((select text from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000d' and def_id = 'd-km'),
  'Corra 8 km hoje', 'texto com a meta da pessoa');

-- ---------------------------------------------------------------------------
-- Progresso: somas e conjuntos, teto, conclusão única
-- ---------------------------------------------------------------------------
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000e', 'd-pintar-3', public.br_today()::text, 2, now());
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000e', 'd-1500m', public.br_today()::text, 1, now());
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e', '{"zones_painted": ["z1", "z2"], "meters": 1000}')),
  0, 'progresso parcial não conclui');
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e', '{"zones_painted": ["z2"]}')), 0,
  'mesma zona não conta duas vezes');
select is((select progress from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e' and def_id = 'd-pintar-3'), 2,
  'conjunto distinto: 2 zonas');
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select throws_like($$ select public.claim_mission((select id from public.user_missions where def_id = 'd-pintar-3')) $$,
  '%MISSION_NOT_COMPLETED%', 'não resgata missão incompleta');
reset role;
select is((select array_agg(x ->> 'defId' order by x ->> 'defId')
             from jsonb_array_elements(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e',
                                       '{"zones_painted": ["z3", "z4", "z5"], "meters": 4000}')) x),
  array['d-1500m', 'd-pintar-3'], 'as duas concluem');
select results_eq($$ select def_id, progress, target from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e'
                     order by def_id $$,
  $$ values ('d-1500m'::text, 1500, 1500), ('d-pintar-3', 3, 3) $$, 'progresso nunca passa da meta');
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e', '{"meters": 9000}')), 0,
  'missão concluída não conclui de novo');

-- ---------------------------------------------------------------------------
-- Resgate idempotente
-- ---------------------------------------------------------------------------
create temp table e_ids as select id from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e' and def_id = 'd-1500m';
grant select on e_ids to authenticated;
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select results_eq($$ select (r ->> 'claimed')::boolean, (r ->> 'xp')::int
                       from (select public.claim_mission((select id from public.user_missions where def_id = 'd-1500m')) r) x $$,
  $$ values (true, 20) $$, 'claim_mission resgata o XP da missão');
select is((public.claim_mission((select id from public.user_missions where def_id = 'd-1500m')) ->> 'alreadyClaimed')::boolean, true,
  'resgatar de novo é idempotente');
select throws_ok($$ update public.user_missions set progress = 0 $$, '42501', null, 'cliente não mexe no progresso');
select throws_ok($$ insert into public.user_missions (user_id, def_id, cadence, period_key, slot, metric, target, xp, text)
                    values (auth.uid(), 'd-km', 'diaria', '2026-01-01', 1, 'meters', 1, 1000, 'Falsa') $$, '42501', null,
  'cliente não cria missão');
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000a');
select is((select count(*)::int from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e'), 0,
  'ninguém vê as missões dos outros');
select throws_like($$ select public.claim_mission((select id from e_ids)) $$, '%NOT_FOUND%', 'resgatar a missão de outro: NOT_FOUND');
reset role;
select is((select count(*)::int from public.xp_ledger where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e' and source = 'mission'), 1,
  'missão paga XP uma vez');

-- ---------------------------------------------------------------------------
-- Troca de 1 diária por dia
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000a');
create temp table rr as
  select (select id from public.user_missions where period_key = public.br_today()::text and slot = 3) as old_id,
         (select def_id from public.user_missions where period_key = public.br_today()::text and slot = 3) as old_def;
create temp table rr2 as select public.reroll_mission((select old_id from rr)) as r;
select results_eq($$ select r ->> 'tier', r ->> 'defId' <> (select old_def from rr), (r ->> 'slot')::int from rr2 $$,
  $$ values ('desafio'::text, true, 3) $$, 'troca por outra do mesmo nível, no mesmo lugar');
select throws_like($$ select public.reroll_mission((select (r ->> 'id')::uuid from rr2)) $$, '%REROLL_LIMIT%', 'só 1 troca por dia');
select throws_like($$ select public.reroll_mission((select id from public.user_missions where slot = 1 and period_key like '%-W%')) $$,
  '%MISSION_NOT_REROLLABLE%', 'semanal não troca');
select is(jsonb_array_length(public.my_missions() -> 'daily'), 3, 'continuam 3 diárias depois da troca');
reset role;

-- ---------------------------------------------------------------------------
-- Primeira semana
-- ---------------------------------------------------------------------------
select is((select array_agg(x ->> 'defId') from jsonb_array_elements(
             private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000a', '{"zones_painted": ["8a"]}')) x
           where x ->> 'cadence' = 'ftue'), array['f1-dominio'], 'passo 1: pintar a 1ª zona');
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000a');
select is((public.claim_mission((select id from public.user_missions where def_id = 'f1-dominio')) ->> 'chest'), 'raro',
  'passo 1 dá o baú do dia raro garantido');
select is((public.my_missions() -> 'ftue' ->> 'step')::int, 1, 'o passo 2 só libera no dia seguinte');
reset role;
select is((select bonus from public.daily_chest_state where user_id = 'e9e9e9e9-0019-4000-8000-00000000000a'), array['raro'],
  'baú raro guardado para a próxima abertura');
select is((select source from public.xp_ledger where user_id = 'e9e9e9e9-0019-4000-8000-00000000000a'), 'ftue', 'XP do passo como ftue');
update public.user_missions set completed_at = now() - interval '1 day' where def_id = 'f1-dominio';
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000a');
select is((select def_id from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000a' and period_key = 'ftue'
            order by slot desc limit 1), 'f2-caca', 'no dia seguinte libera o passo 2');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000b', 'f4-raid', 'ftue', 4, now());
select results_eq($$ select text, metric, target from public.user_missions where def_id = 'f4-raid' $$,
  $$ values ('Revele 10 trechos da Neblina'::text, 'new_fog_cells'::text, 10) $$, 'sem raid real: o passo 4 usa o substituto');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000f', 'f5-crew', 'ftue', 5, now());
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000f');
select isnt((select completed_at from public.user_missions where def_id = 'f5-crew'), null, 'quem já tem crew conclui o passo 5 sozinho');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000b', 'f7-compartilhar', 'ftue', 7, now());
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000b', now() - interval '1 hour', 3000);
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000b');
select is((public.record_share((select id from public.activities where user_id = auth.uid())) -> 'completed' -> 0 ->> 'defId'),
  'f7-compartilhar', 'compartilhar conclui o passo 7');
select is((public.claim_mission((select id from public.user_missions where def_id = 'f7-compartilhar')) ->> 'cosmeticId'),
  'moldura-primeira-semana', 'passo 7 dá a moldura "Primeira Semana"');
select throws_like($$ select public.record_share('e9e9e9e9-1019-4000-8000-000000000999') $$, '%NOT_FOUND%', 'compartilhar corrida alheia: NOT_FOUND');
reset role;

-- ---------------------------------------------------------------------------
-- Volta
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000c', now() - interval '20 days', 2000);
delete from public.activities where user_id = 'e9e9e9e9-0019-4000-8000-00000000000c' and ended_at > now() - interval '19 days';
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000c');
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000c');
select results_eq($$ select def_id, period_key like 'volta-%' from public.user_missions
                      where user_id = 'e9e9e9e9-0019-4000-8000-00000000000c' and cadence = 'volta' $$,
  $$ values ('v-14'::text, true) $$, '20 dias sem correr: a missão de volta de 14 dias, uma vez só');

-- ---------------------------------------------------------------------------
-- Trilha da temporada
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select throws_like($$ select public.claim_track_step(1) $$, '%TRACK_LOCKED%', 'degrau não alcançado (20 XP)');
reset role;
select private.grant_xp('e9e9e9e9-0019-4000-8000-00000000000e', 'run_distance', 'teste-1', 700);
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select results_eq($$ select (r ->> 'xp')::int, (r ->> 'step')::int, (r ->> 'nextStepXp')::int, jsonb_array_length(r -> 'rewards')
                       from (select public.my_track() r) x $$,
  $$ values (720, 6, 840, 24) $$, 'my_track: 720 XP do mês = degrau 6 de 24');
select is((public.claim_track_step(1) -> 'items' -> 0 ->> 'rarity'), 'raro', 'degrau 1: baú raro');
select is((public.claim_track_step(1) ->> 'alreadyClaimed')::boolean, true, 'resgatar o mesmo degrau de novo não paga');
select is((public.claim_track_step(2) -> 'items' -> 0 ->> 'cosmeticId'), 'emblema-temporada', 'degrau 2: emblema do mês');
select is((select variant from public.user_cosmetics where cosmetic_id = 'emblema-temporada'), public.current_season_id(),
  'o emblema é desta temporada');
select is((public.claim_track_step(5) -> 'items' -> 0 ->> 'amount')::int, 50, 'degrau 5: +50 XP');
select is((public.my_track() ->> 'xp')::int, 720, 'o XP da trilha não conta para a própria trilha');
select throws_like($$ select public.claim_track_step(7) $$, '%TRACK_LOCKED%', 'degrau 7 ainda bloqueado');
reset role;

select * from finish();
rollback;
