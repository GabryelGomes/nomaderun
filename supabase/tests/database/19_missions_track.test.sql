-- T7.1.23 (D-65/D-64; contrato E7 §1–§6) — missões e trilha da temporada: catálogo = MISSION_CATALOG (ids com hífen),
-- colunas do contrato, sorteio 3+3 determinístico (slot 0 leve, 1 padrão, 2 desafio) só com missões possíveis, alvos
-- adaptativos, progresso absoluto (greatest, teto na meta), conclusão paga na hora uma vez, troca de 1 diária por dia no
-- mesmo slot, primeira semana (1 passo por dia, alternativas sem raid/liga, crew, ranking e compartilhar), volta, trilha.
begin;
create extension if not exists pgtap with schema extensions;
select plan(74);

-- ---------------------------------------------------------------------------
-- Esquema, RLS, catálogo
-- ---------------------------------------------------------------------------
select is((select array_agg(t order by t) from unnest(array['mission_defs', 'user_missions', 'engagement_marks', 'track_rewards', 'track_claims']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_table_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'missões e trilha: RLS, cliente não escreve, anon não lê');
select is((select array_agg(f order by f) from unnest(array['private.advance_missions(uuid, jsonb, timestamptz)',
                                                           'private.ensure_missions(uuid, timestamptz, uuid)',
                                                           'private.settle_mission(uuid, integer, timestamptz)',
                                                           'private.assign_mission(uuid, text, text, integer, timestamptz, timestamptz)']) f
            where has_function_privilege('authenticated', f, 'execute')), null, 'progresso e sorteio só pelo servidor');
select ok(not has_function_privilege('anon', 'public.my_missions()', 'execute') and not has_function_privilege('anon', 'public.claim_mission(uuid)', 'execute'),
  'anon não chama as RPCs de missão');
select is((select array_agg(c order by c) from unnest(array['kind', 'tier', 'requires', 'metric', 'target', 'target_rule', 'min_meters',
            'reward_xp', 'title', 'fallback_when', 'fallback_metric', 'fallback_target', 'fallback_title', 'bonus', 'active', 'is_demo']) c
            where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mission_defs'
                                 and column_name = c)), null, 'mission_defs com as colunas do contrato E7 §2');
select is((select array_agg(c order by c) from unnest(array['slot', 'variant', 'available_from', 'rerolled_at']) c
            where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_missions'
                                 and column_name = c)), null, 'user_missions com slot, variant, available_from e rerolled_at');
select is((select array_agg(id order by id) from public.mission_defs),
  array['d-1500m', 'd-caca-2', 'd-conquistar', 'd-crew', 'd-defender', 'd-fantasma', 'd-km', 'd-mover-15', 'd-neblina-20',
        'd-neblina-5', 'd-pintar-3', 'f1-dominio', 'f2-caca', 'f3-fuga', 'f4-raid', 'f5-crew', 'f6-liga', 'f7-compartilhar',
        's-2-atividades', 's-60-min', 's-bairros-2', 's-chefao', 's-conquistar-3', 's-crew-2', 's-km', 's-pintar-10',
        'v-14', 'v-30', 'v-7'],
  'catálogo: as 29 missões com os ids de MISSION_CATALOG');
select lives_ok($$ insert into public.mission_defs (id, kind, tier, metric, target, reward_xp, title, active)
                   values ('x-teste-1', 'diaria', 'leve', 'runs', 1, 1, 'Teste', false) $$, 'id com hífen é aceito');
select throws_ok($$ insert into public.mission_defs (id, kind, tier, metric, target, reward_xp, title)
                    values ('x_teste', 'diaria', 'leve', 'runs', 1, 1, 'Teste') $$, '23514', null, 'id com sublinhado é recusado');
delete from public.mission_defs where id = 'x-teste-1';
select is((select max(char_length(replace(coalesce(t, ''), '{x}', '15'))) from public.mission_defs d, unnest(array[d.title, d.fallback_title]) t)
          <= 40, true, 'todo título (com {x} e alternativa) cabe em 40 caracteres');
select is((select count(*)::int from (select kind, tier from public.mission_defs where kind in ('diaria', 'semanal') group by kind, tier) x), 6,
  'diárias e semanais têm leve, padrão e desafio');
select is(array[private.km_text(3500), private.km_text(8000), private.km_text(1500), private.km_text(40000), private.km_text(8540)],
  array['3,5', '8', '1,5', '40', '8,5'], 'km como formatMissionKm');
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
create function pg_temp.today_start() returns timestamptz language sql as $$
  select (public.br_today() + time '00:00') at time zone 'America/Sao_Paulo'
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
select results_eq($$ select jsonb_array_length(r -> 'daily'), jsonb_array_length(r -> 'weekly'), r -> 'ftue' -> 0 ->> 'defId',
                            (r -> 'ftue' -> 0 ->> 'slot')::int, r ->> 'comeback', (r ->> 'rerollsLeft')::int from m1 $$,
  $$ values (3, 3, 'f1-dominio'::text, 1, null::text, 1) $$, 'conta nova: 3 diárias, 3 semanais e o passo 1 da primeira semana');
select is((select array[r -> 'daily' -> 0 ->> 'tier', r -> 'daily' -> 1 ->> 'tier', r -> 'daily' -> 2 ->> 'tier',
                        r -> 'weekly' -> 0 ->> 'tier'] from m1),
  array['leve', 'padrao', 'desafio', 'leve'], 'slot 0 leve, 1 padrão, 2 desafio: sempre 1 leve');
select is((select jsonb_path_query_array(public.my_missions(), '$.daily[*].defId')),
          (select jsonb_path_query_array(r, '$.daily[*].defId') from m1), 'chamar de novo devolve as mesmas (determinístico)');
select is((select count(*)::int from public.user_missions), 7, 'nada sorteado em dobro');
select is((select count(*)::int from m1, jsonb_array_elements(r -> 'daily') d where d ->> 'defId' = 'd-crew')
        + (select count(*)::int from m1, jsonb_array_elements(r -> 'weekly') d where d ->> 'defId' in ('s-crew-2', 's-chefao')), 0,
  'sem crew e sem raid real: essas missões não aparecem');
select is((select (r -> 'daily' -> 0 ->> 'availableUntil')::bigint - (r -> 'daily' -> 0 ->> 'availableFrom')::bigint from m1), 86400000::bigint,
  'janela da diária: o dia de Brasília');
reset role;
select is((select r -> 'daily' -> 0 ->> 'defId' from m1),
          (select id from public.mission_defs where kind = 'diaria' and tier = 'leve' and active
            order by md5('e9e9e9e9-0019-4000-8000-00000000000a' || '|' || public.br_today()::text || '|' || id) limit 1),
  'sorteio reproduzível pela semente');

-- ---------------------------------------------------------------------------
-- Alvos adaptativos (mesmos números do domain)
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000c', pg_temp.week_ago(2) + make_interval(mins => g), 4200) from generate_series(1, 10) g;
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000d', pg_temp.week_ago(g), 10000) from generate_series(1, 4) g;
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000b', 'daily_km', null, now()), 2000, 'd-km sem atividades: 2 km');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000c', 'daily_km', null, now()), 4000, 'd-km: mediana das 10 últimas (4,2 → 4 km)');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000d', 'daily_km', null, now()), 8000, 'd-km: no máximo 8 km');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000c', 'weekly_km', null, now()), 6000, 's-km: mínimo 6 km');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000d', 'weekly_km', null, now()), 9000, 's-km: 90 % da mediana semanal');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000d', 'raid_km', null, now()), 4500, 's-chefao: metade do alvo semanal');
select is(private.mission_target('e9e9e9e9-0019-4000-8000-00000000000c', 'raid_km', null, now()), 3000, 's-chefao com o mínimo semanal: 3 km');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000d', 'd-km', '2020-01-01', 1, now(), now());
select is((select title from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000d' and def_id = 'd-km'),
  'Corra 8 km hoje', 'título com o alvo da pessoa');

-- ---------------------------------------------------------------------------
-- Progresso absoluto e pagamento na conclusão
-- ---------------------------------------------------------------------------
create temp table e_m as
  select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000e', 'd-pintar-3', public.br_today()::text, 1, pg_temp.today_start(), now()) as pintar,
         private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000e', 'd-1500m', public.br_today()::text, 0, pg_temp.today_start(), now()) as m1500;
grant select on e_m to authenticated;
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e',
            (select jsonb_build_object(pintar::text, 2, m1500::text, 1000) from e_m))), 0, 'progresso parcial não conclui');
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e',
            (select jsonb_build_object(pintar::text, 1) from e_m))), 0, 'valor menor não faz o progresso voltar');
select is((select progress from public.user_missions where id = (select pintar from e_m)), 2, 'progresso = maior valor absoluto visto');
select is((select array_agg(x ->> 'defId' order by x ->> 'defId')
             from jsonb_array_elements(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e',
                                       (select jsonb_build_object(pintar::text, 5, m1500::text, 1500) from e_m))) x),
  array['d-1500m', 'd-pintar-3'], 'as duas concluem');
select results_eq($$ select def_id, progress, target, claimed_at = completed_at from public.user_missions
                      where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e' order by def_id $$,
  $$ values ('d-1500m'::text, 1500, 1500, true), ('d-pintar-3', 3, 3, true) $$, 'nunca passa da meta e paga na conclusão');
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000e',
            (select jsonb_build_object(m1500::text, 9000) from e_m))), 0, 'missão concluída não conclui de novo');
select results_eq($$ select count(*)::int, sum(amount)::int from public.xp_ledger
                      where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e' and source = 'mission' $$,
  $$ values (2, 50) $$, 'XP pago uma vez por missão, pelo livro');
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000a',
            (select jsonb_build_object(m1500::text, 1500) from e_m))), 0, 'a gravação de um não mexe nas missões de outro');

-- ---------------------------------------------------------------------------
-- Resgate idempotente e RLS
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select results_eq($$ select (r ->> 'alreadyClaimed')::boolean, (r ->> 'xp')::int from (select public.claim_mission((select m1500 from e_m)) r) x $$,
  $$ values (true, 20) $$, 'claim_mission: já pago na conclusão (idempotente)');
select throws_like($$ select public.reroll_mission((select m1500 from e_m)) $$, '%MISSION_COMPLETED%', 'não troca missão concluída');
select throws_ok($$ update public.user_missions set progress = 0 $$, '42501', null, 'cliente não mexe no progresso');
select throws_ok($$ insert into public.user_missions (user_id, def_id, kind, period_key, slot, metric, target, xp, title, available_from)
                    values (auth.uid(), 'd-km', 'diaria', '2026-01-01', 1, 'meters', 1, 1000, 'Falsa', now()) $$, '42501', null,
  'cliente não cria missão');
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000a');
select is((select count(*)::int from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e'), 0,
  'ninguém vê as missões dos outros');
select throws_like($$ select public.claim_mission((select m1500 from e_m)) $$, '%NOT_FOUND%', 'resgatar a missão de outro: NOT_FOUND');
select throws_like($$ select public.claim_mission((select id from public.user_missions where slot = 0 and period_key = public.br_today()::text)) $$,
  '%MISSION_NOT_COMPLETED%', 'não resgata missão incompleta');

-- ---------------------------------------------------------------------------
-- Troca de 1 diária por dia, no mesmo slot
-- ---------------------------------------------------------------------------
create temp table rr as
  select id as old_id, def_id as old_def from public.user_missions where period_key = public.br_today()::text and slot = 2;
create temp table rr2 as select public.reroll_mission((select old_id from rr)) as r;
select results_eq($$ select r ->> 'tier', r ->> 'defId' <> (select old_def from rr), (r ->> 'slot')::int, (r ->> 'progress')::int,
                            (r ->> 'id')::uuid = (select old_id from rr), (r ->> 'rerolled')::boolean from rr2 $$,
  $$ values ('desafio'::text, true, 2, 0, true, true) $$, 'troca por outra do mesmo nível, no mesmo slot, com progresso 0');
select throws_like($$ select public.reroll_mission((select old_id from rr)) $$, '%MISSION_REROLL_LIMIT%', 'só 1 troca por dia');
select throws_like($$ select public.reroll_mission((select id from public.user_missions where slot = 0 and period_key like '%-W%')) $$,
  '%MISSION_NOT_REROLLABLE%', 'semanal não troca');
select results_eq($$ select jsonb_array_length(r -> 'daily'), (r ->> 'rerollsLeft')::int from (select public.my_missions() r) x $$,
  $$ values (3, 0) $$, 'continuam 3 diárias; nenhuma troca sobrando');
reset role;

-- ---------------------------------------------------------------------------
-- Primeira semana
-- ---------------------------------------------------------------------------
select is((select array_agg(x ->> 'defId') from jsonb_array_elements(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000a',
             (select jsonb_build_object(id::text, 1) from public.user_missions where def_id = 'f1-dominio'))) x), array['f1-dominio'],
  'passo 1 conclui com a primeira atividade que pinta');
select results_eq($$ select source, amount from public.xp_ledger where user_id = 'e9e9e9e9-0019-4000-8000-00000000000a' $$,
  $$ values ('ftue'::text, 100) $$, 'XP do passo como ftue (100)');
select is((select min_rarity from public.bonus_chests where user_id = 'e9e9e9e9-0019-4000-8000-00000000000a' and source = 'mission'), 'raro',
  'passo 1 deixa o baú do dia raro garantido');
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000a');
select is(jsonb_array_length(public.my_missions() -> 'ftue'), 1, 'o passo 2 só libera no dia seguinte');
reset role;
update public.user_missions set completed_at = now() - interval '1 day', claimed_at = now() - interval '1 day' where def_id = 'f1-dominio';
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000a');
select results_eq($$ select def_id, slot::int, available_from = (((now() - interval '1 day') at time zone 'America/Sao_Paulo')::date + 1
                                                                 + time '00:00') at time zone 'America/Sao_Paulo'
                      from public.user_missions where user_id = 'e9e9e9e9-0019-4000-8000-00000000000a' and period_key = 'ftue'
                     order by slot desc limit 1 $$,
  $$ values ('f2-caca'::text, 2, true) $$, 'no dia seguinte libera o passo 2, a partir de 00:00');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000b', 'f4-raid', 'ftue', 4, now(), now());
select results_eq($$ select variant, title, metric, target from public.user_missions where def_id = 'f4-raid' $$,
  $$ values ('fallback'::text, 'Revele 10 trechos do Atlas'::text, 'new_fog_cells'::text, 10) $$, 'sem raid real: o passo 4 usa a alternativa');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000b', 'f6-liga', 'ftue', 6, now(), now());
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000b');
select is((public.record_ranking_opened() -> 'completed' -> 0 ->> 'defId'), 'f6-liga', 'sem liga real: ver o ranking conclui o passo 6');
reset role;
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000f', 'f5-crew', 'ftue', 5, now(), now());
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000f');
select isnt((select claimed_at from public.user_missions where def_id = 'f5-crew'), null, 'quem já tem crew conclui (e recebe) o passo 5');
select private.assign_mission('e9e9e9e9-0019-4000-8000-00000000000b', 'f7-compartilhar', 'ftue', 7, now(), now());
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000b', now() - interval '1 hour', 3000);
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000b');
select is((public.record_share((select id from public.activities where user_id = auth.uid())) -> 'completed' -> 0 ->> 'defId'),
  'f7-compartilhar', 'compartilhar conclui o passo 7');
select is((public.record_share((select id from public.activities where user_id = auth.uid())) -> 'completed'), '[]'::jsonb,
  'compartilhar de novo não conclui nada');
select is((select count(*)::int from public.engagement_marks where kind = 'share'), 1, '1 compartilhamento por dia');
select is((select cosmetic_id from public.user_cosmetics where cosmetic_id = 'moldura-primeira-semana'), 'moldura-primeira-semana',
  'passo 7 dá a moldura "Primeira Semana"');
select throws_like($$ select public.record_share('e9e9e9e9-1019-4000-8000-000000000999') $$, '%NOT_FOUND%', 'compartilhar corrida alheia: NOT_FOUND');
reset role;

-- ---------------------------------------------------------------------------
-- Volta
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0019-4000-8000-00000000000c', now() - interval '20 days', 2000);
delete from public.activities where user_id = 'e9e9e9e9-0019-4000-8000-00000000000c' and ended_at > now() - interval '19 days';
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000c');
select private.ensure_missions('e9e9e9e9-0019-4000-8000-00000000000c');
select results_eq($$ select def_id, period_key, slot::int from public.user_missions
                      where user_id = 'e9e9e9e9-0019-4000-8000-00000000000c' and kind = 'volta' $$,
  $$ values ('v-14'::text, 'volta-' || public.br_today(), 0) $$, '20 dias sem atividade: a missão de volta de 14 dias, uma vez só');
select is(jsonb_array_length(private.advance_missions('e9e9e9e9-0019-4000-8000-00000000000c',
            (select jsonb_build_object(id::text, 1000) from public.user_missions where def_id = 'v-14'))), 1, 'a volta conclui');
select results_eq($$ select (select source from public.xp_ledger where user_id = 'e9e9e9e9-0019-4000-8000-00000000000c'),
                            (select min_rarity from public.bonus_chests where user_id = 'e9e9e9e9-0019-4000-8000-00000000000c') $$,
  $$ values ('comeback'::text, 'raro'::text) $$, 'XP como comeback e baú raro garantido');

-- ---------------------------------------------------------------------------
-- Trilha da temporada
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select throws_like($$ select public.claim_track_step(1) $$, '%TRACK_LOCKED%', 'degrau não alcançado (50 XP)');
reset role;
select private.grant_xp('e9e9e9e9-0019-4000-8000-00000000000e', 'run_distance', 'teste-1', 700);
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select results_eq($$ select (r ->> 'xp')::int, (r ->> 'step')::int, (r ->> 'nextStepXp')::int, jsonb_array_length(r -> 'rewards'), r ->> 'medal'
                       from (select public.my_track() r) x $$,
  $$ values (750, 6, 840, 24, null::text) $$, 'my_track: 750 XP do mês = degrau 6 de 24');
select is((public.claim_track_step(1) -> 'items' -> 0 ->> 'rarity'), 'raro', 'degrau 1: baú raro');
select is((public.claim_track_step(1) ->> 'alreadyClaimed')::boolean, true, 'resgatar o mesmo degrau de novo não paga');
select is((public.claim_track_step(2) -> 'items' -> 0 ->> 'cosmeticId'), 'emblema-temporada', 'degrau 2: emblema do mês');
select is((select variant from public.user_cosmetics where cosmetic_id = 'emblema-temporada'), public.current_season_id(),
  'o emblema é desta temporada');
select is((public.claim_track_step(5) -> 'items' -> 0 ->> 'amount')::int, 50, 'degrau 5: +50 XP');
select is((public.my_track() ->> 'xp')::int, 750, 'o XP da trilha não conta para a própria trilha');
select throws_like($$ select public.claim_track_step(7) $$, '%TRACK_LOCKED%', 'degrau 7 ainda bloqueado');
reset role;
select results_eq($$ select source, ref from public.xp_ledger where user_id = 'e9e9e9e9-0019-4000-8000-00000000000e' and source = 'season_step' $$,
  $$ values ('season_step'::text, public.current_season_id() || ':5') $$, 'ref do degrau: AAAA-MM:degrau');
select private.grant_xp('e9e9e9e9-0019-4000-8000-00000000000e', 'run_distance', 'teste-2', 300);
select pg_temp.login('e9e9e9e9-0019-4000-8000-00000000000e');
select is((public.my_track() ->> 'medal'), 'bronze', 'degrau 8: medalha de bronze da temporada');
reset role;

select * from finish();
rollback;
