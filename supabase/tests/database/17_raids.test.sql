-- T7.1.23 (D-67) — Raid real semanal: esquema, RLS, Realtime, calendário dos chefões, janela, tetos de 21 km por corrida e
-- 30 km por dia, fases que só avançam, golpe final, pontos fracos, tela (raid_current) e job idempotente que abre,
-- fecha e premia. Todas as datas são fixas (semana de 19/10/2026), então o resultado não depende do dia em que roda.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- ---------------------------------------------------------------------------
-- Esquema, RLS e grants
-- ---------------------------------------------------------------------------
select is((select array_agg(t order by t) from unnest(array['raid_bosses', 'raids', 'raid_hits', 'raid_weak_points', 'raid_rewards', 'raid_visits']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_table_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'raid: RLS nas 6 tabelas, cliente não escreve, anon não lê');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'raids'),
  'Realtime em raids (vida e fase ao vivo)');
select is((select array_agg(column_name::text order by column_name) from information_schema.columns
            where table_schema = 'public' and table_name = 'raids' and (column_name like '%user%' or data_type = 'uuid')),
  array['id'], 'raids não tem coluna de usuário (seguro para o Realtime)');
select ok(not has_function_privilege('authenticated', 'private.apply_raid_hit(uuid, integer, integer, boolean, integer)', 'execute'),
  'golpe só pelo servidor');
select ok(not has_function_privilege('authenticated', 'public.job_raid_tick(timestamptz)', 'execute')
          and has_function_privilege('service_role', 'public.job_raid_tick(timestamptz)', 'execute'), 'job só para o service role');
select is((select schedule from cron.job where jobname = 'nomaderun-raid-tick'), '*/10 * * * *', 'job do raid a cada 10 min');
select is((select array_agg(id order by sort) from public.raid_bosses), array['soneca', 'rei-buzina', 'fuligem', 'mormaco', 'paredao'],
  'os 5 chefões com os ids da arte (E4) e do raid.ts (E3)');

-- ---------------------------------------------------------------------------
-- Funções puras
-- ---------------------------------------------------------------------------
select is(private.raid_pick_boss('2026-10-19'), 'mormaco', 'outubro: Mormaço');
select is(private.raid_pick_boss('2026-11-02'), 'fuligem', 'novembro: Fuligem');
select is(private.raid_pick_boss('2027-01-04'), 'soneca', 'janeiro: Soneca');
select ok(private.raid_pick_boss('2026-08-03') <> 'fuligem' and private.raid_pick_boss('2026-08-10') <> 'fuligem',
  'agosto (queimadas): nunca a Fuligem');
select is(array[private.raid_phase_of(100, 100), private.raid_phase_of(68, 100), private.raid_phase_of(67, 100),
                private.raid_phase_of(33, 100), private.raid_phase_of(1, 100), private.raid_phase_of(0, 100)],
  array[1, 1, 2, 3, 3, 4]::smallint[], 'fases 100/67/33 % e derrotado');
select results_eq($$ select week_start, starts_at, ends_at from private.raid_window('2026-10-21 12:00-03') $$,
  $$ values ('2026-10-19'::date, '2026-10-19 06:00-03'::timestamptz, '2026-10-25 21:00-03'::timestamptz) $$,
  'janela: segunda 06:00 → domingo 21:00 (Brasília)');

-- ---------------------------------------------------------------------------
-- Fixtures: A e B (volt, mesma crew), C (volt)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0017-4000-8000-00000000000a', 'authenticated', 'authenticated', 'c17a@t.com',
   '{"username": "c17_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0017-4000-8000-00000000000b', 'authenticated', 'authenticated', 'c17b@t.com',
   '{"username": "c17_b", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0017-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c17c@t.com',
   '{"username": "c17_c", "birthdate": "1995-01-01", "terms_accepted": true}');
update public.profiles set faction = 'volt' where id::text like 'e9e9e9e9-0017-%';
insert into public.crews (name, tag, leader_id) values ('Crew Raid', 'RAIDX', 'e9e9e9e9-0017-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0017-4000-8000-00000000000b' from public.crews where tag = 'RAIDX';

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.run(uid uuid, act uuid, ended timestamptz, meters real, scored boolean default true) returns void language sql as $$
  insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace, scored)
  values (act, uid, case when scored then 'valid' else 'review' end, ended - interval '2 hours', ended, ended, meters, meters * 0.33, 330, scored)
$$;

-- ---------------------------------------------------------------------------
-- Flag desligada: não abre e a tela recusa
-- ---------------------------------------------------------------------------
select is((public.job_raid_tick('2026-10-21 12:00-03') ->> 'opened')::int, 0, 'flag desligada: o job não abre raid');
select pg_temp.login('e9e9e9e9-0017-4000-8000-00000000000a');
select throws_like($$ select public.raid_current() $$, '%FEATURE_DISABLED%', 'flag desligada: raid_current recusa');
reset role;
update public.game_config set value = value || '{"raid": true}' where key = 'features';

-- ---------------------------------------------------------------------------
-- Abertura
-- ---------------------------------------------------------------------------
select is((public.job_raid_tick('2026-10-19 05:50-03') ->> 'opened')::int, 0, 'antes de segunda 06:00 não abre');
select is((public.job_raid_tick('2026-10-21 12:00-03') ->> 'opened')::int, 1, 'dentro da janela abre o chefão da semana');
select is((public.job_raid_tick('2026-10-21 12:10-03') ->> 'opened')::int, 0, 'job de novo não abre outro');
select results_eq($$ select boss_id, city, week_start, status, phase::int, factor, hp = hp_max and hp_max >= 500
                       from public.raids where week_start = '2026-10-19' $$,
  $$ values ('mormaco'::text, null::text, '2026-10-19'::date, 'active'::text, 1, 1.00::numeric(4, 2), true) $$,
  'raid global de outubro: Mormaço, fase 1, fator 1, vida ≥ 500');
update public.raids set hp_max = 1000, hp = 1000 where week_start = '2026-10-19';

-- ---------------------------------------------------------------------------
-- Golpes: tetos, idempotência, sanidade, fases e golpe final
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000001', '2026-10-21 07:00-03', 25000);
select results_eq($$ select (r ->> 'damage')::int, (r ->> 'meters')::int, (r ->> 'capped')::boolean, (r ->> 'hp')::int
                       from (select private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000001', 25000, 250, false) as r) x $$,
  $$ values (210, 21000, true, 790) $$, 'corrida de 25 km: conta 21 km (210 de dano)');
select is((private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000001', 25000, 250, false) ->> 'repeated')::boolean, true,
  'a mesma corrida não golpeia duas vezes');
select is((select hp from public.raids where week_start = '2026-10-19'), 790, 'repetir não tira vida de novo');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000002', '2026-10-21 19:00-03', 15000);
select is((private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000002', 15000, 150, false) ->> 'meters')::int, 9000,
  'teto de 30 km por dia: a 2ª corrida conta só 9 km');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000003', '2026-10-21 20:00-03', 5000);
select is((private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000003', 5000, 50, false) ->> 'damage')::int, 0,
  'dia cheio: dano 0');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000b', 'e9e9e9e9-1017-4000-8000-000000000004', '2026-10-22 07:00-03', 1000);
select is((private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000004', 1000, 9999, true) ->> 'damage')::int, 50,
  'limite de sanidade: 1 km dá no máximo 50 de dano');
select is((select phase::int from public.raids where week_start = '2026-10-19'), 2, '65 % de vida: fase 2');
select is((public.job_raid_tick('2026-10-22 12:00-03') ->> 'weakPoints')::int, 3, 'fase 2: 3 pontos fracos no dia');
select is((public.job_raid_tick('2026-10-22 12:10-03') ->> 'weakPoints')::int, 0, 'pontos fracos não repetem no mesmo dia');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000c', 'e9e9e9e9-1017-4000-8000-000000000009', '2026-10-22 08:00-03', 3000, false);
select is(private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000009', 3000, 30, false), null, 'corrida em revisão não golpeia');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000b', 'e9e9e9e9-1017-4000-8000-000000000005', '2026-10-23 07:00-03', 20000);
select results_eq($$ select (r ->> 'defeated')::boolean, (r ->> 'finalBlow')::boolean, (r ->> 'phase')::int, (r ->> 'hp')::int
                       from (select private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000005', 20000, 700, false) as r) x $$,
  $$ values (true, true, 4, 0) $$, 'o golpe que zera a vida derrota o chefão (golpe final)');
select results_eq($$ select status, defeated_at, participants from public.raids where week_start = '2026-10-19' $$,
  $$ values ('defeated'::text, '2026-10-23 07:00-03'::timestamptz, 2) $$, 'derrotado na hora da corrida, com 2 participantes');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000c', 'e9e9e9e9-1017-4000-8000-000000000006', '2026-10-23 09:00-03', 5000);
select is(private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000006', 5000, 50, false), null, 'depois de derrotado, ninguém golpeia');

-- ---------------------------------------------------------------------------
-- Tela e RLS (raid_current mostra o raid desta semana ou da anterior: o teste traz o raid para a semana de hoje)
-- ---------------------------------------------------------------------------
update public.raids set week_start = (private.raid_window(now())).week_start where week_start = '2026-10-19';
select pg_temp.login('e9e9e9e9-0017-4000-8000-00000000000a');
select results_eq($$ select (r -> 'raid' ->> 'bossId'), (r -> 'me' ->> 'damage')::int, (r -> 'me' ->> 'rank')::int,
                            jsonb_array_length(r -> 'topRunners'), r ->> 'sinceLastVisit'
                       from (select public.raid_current() as r) x $$,
  $$ values ('mormaco'::text, 300, 2, 2, null::text) $$, 'raid_current: chefão, sua parte, posição e top corredores');
select is((public.raid_current() -> 'sinceLastVisit' ->> 'damage')::int, 0, 'segunda visita: dano da cidade desde a última');
select is((public.raid_current() -> 'topCrews' -> 0 ->> 'tag'), 'RAIDX', 'ranking de crews pela crew no momento do golpe');
select ok(public.raid_current()::text !~ 'e9e9e9e9-1017', 'raid_current não expõe ids de corrida');
select is((select count(*)::int from public.raid_hits), 3, 'cada um lê só os próprios golpes');
select throws_ok($$ insert into public.raid_hits (activity_id, raid_id, user_id, day, meters, damage)
                    select 'e9e9e9e9-1017-4000-8000-000000000006', id, auth.uid(), current_date, 1000, 99999 from public.raids $$,
  '42501', null, 'cliente não grava dano');
select throws_ok($$ update public.raids set hp = 0 $$, '42501', null, 'cliente não mexe na vida do chefão');
reset role;
update public.raids set week_start = '2026-10-19' where boss_id = 'mormaco' and status = 'defeated';

-- ---------------------------------------------------------------------------
-- Prêmios (idempotentes)
-- ---------------------------------------------------------------------------
select is((public.job_raid_tick('2026-10-24 10:00-03') ->> 'rewarded')::int, 1, 'o job premia o raid derrotado');
select results_eq($$ select kind, xp, chest_rarity, medal_tier from public.raid_rewards
                      where user_id = 'e9e9e9e9-0017-4000-8000-00000000000a' order by kind $$,
  $$ values ('derrota'::text, 200, 'raro'::text, 'prata'::text), ('participacao', 150, null, null), ('top10', 0, null, null) $$,
  'A: XP = dano ÷ 2, +200 da derrota, baú raro (caiu na sexta) e medalha de prata (top 10)');
select is((select xp from public.raid_rewards where user_id = 'e9e9e9e9-0017-4000-8000-00000000000b' and kind = 'participacao'), 300,
  'B: XP do dano com teto de 300');
select is((select medal_tier from public.raid_rewards where user_id = 'e9e9e9e9-0017-4000-8000-00000000000b' and kind = 'derrota'), 'ouro',
  'golpe final: medalha de ouro');
select ok(exists (select 1 from public.user_cosmetics where user_id = 'e9e9e9e9-0017-4000-8000-00000000000b' and cosmetic_id = 'moldura-golpe-final'),
  'golpe final: moldura cosmética');
select ok(exists (select 1 from public.user_cosmetics where user_id = 'e9e9e9e9-0017-4000-8000-00000000000a'
                     and cosmetic_id = 'titulo-cacador' and variant = 'mormaco'), 'top 10: título "Caçador do Mormaço"');
select is((select tier from public.user_medals where user_id = 'e9e9e9e9-0017-4000-8000-00000000000a' and medal_id = 'chefao'
              and period = 'mormaco'), 'prata', 'medalha do chefão, uma por espécie');
select is((select bonus from public.daily_chest_state where user_id = 'e9e9e9e9-0017-4000-8000-00000000000a'), array['raro'],
  'o baú do chefão abre junto com o próximo baú do dia');
select is((select count(*)::int from public.xp_ledger where source = 'raid' and user_id::text like 'e9e9e9e9-0017-%'), 4, 'XP do raid pelo livro');
select is((select count(*)::int from public.notifications where type = 'raid' and user_id::text like 'e9e9e9e9-0017-%'), 2,
  'uma notificação por participante');
select is((public.job_raid_tick('2026-10-24 10:10-03') ->> 'rewarded')::int, 0, 'rodar de novo não premia de novo');
select results_eq($$ select (select count(*)::int from public.xp_ledger where source = 'raid' and user_id::text like 'e9e9e9e9-0017-%'),
                            (select count(*)::int from public.notifications where type = 'raid' and user_id::text like 'e9e9e9e9-0017-%') $$,
  $$ values (4, 2) $$, 'nem XP nem notificação em dobro');

-- ---------------------------------------------------------------------------
-- Semanas seguintes: fator de dificuldade, fuga e calendário
-- ---------------------------------------------------------------------------
select is((public.job_raid_tick('2026-10-26 07:00-03') ->> 'opened')::int, 1, 'segunda seguinte: abre o próximo');
select results_eq($$ select boss_id, factor from public.raids where week_start = '2026-10-26' $$,
  $$ values ('mormaco'::text, 1.10::numeric(4, 2)) $$, 'caiu antes de sábado: fator +10 %');
select is((public.job_raid_tick('2026-11-01 22:00-03') ->> 'closed')::int, 1, 'domingo 21:00 com vida: o chefão foge');
select is((select status from public.raids where week_start = '2026-10-26'), 'escaped', 'status fugiu');
select is((public.job_raid_tick('2026-11-02 07:00-03') ->> 'opened')::int, 1, 'abre a semana de novembro');
select results_eq($$ select boss_id, factor from public.raids where week_start = '2026-11-02' $$,
  $$ values ('fuligem'::text, 1.00::numeric(4, 2)) $$, 'fugiu: fator −10 %; novembro: Fuligem');

select * from finish();
rollback;
