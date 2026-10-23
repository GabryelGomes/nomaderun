-- T7.1.23 (D-67; contrato E3 §2.3 e §4.2) — Raid real semanal: esquema, RLS, Realtime, paridade com raid.ts
-- (raidSeededUnit, raidCritRoll, raidBossForWeek, raidPhase), janela, tetos de 21 km por corrida e 30 km por dia, teto
-- diário de 300 de dano depois do crítico, fases que só avançam, golpe final, pontos fracos, tela (raid_current) e job
-- idempotente que abre, fecha e premia. Datas fixas (semana de 19/10/2026): o resultado não depende do dia em que roda.
-- Os valores de paridade foram tirados do próprio domain (deno run apps/mobile/src/domain/raid.ts).
begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

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
select ok(not has_function_privilege('authenticated', 'private.apply_raid_hit(uuid, integer, integer, integer, boolean)', 'execute')
          and not has_function_privilege('authenticated', 'public.svc_raid_hit(uuid, integer, integer, integer, boolean)', 'execute')
          and has_function_privilege('service_role', 'public.svc_raid_hit(uuid, integer, integer, integer, boolean)', 'execute'),
  'golpe (raid_hit) só pelo servidor');
select ok(not has_function_privilege('authenticated', 'public.job_raid_tick(timestamptz)', 'execute')
          and has_function_privilege('service_role', 'public.job_raid_tick(timestamptz)', 'execute'), 'job só para o service role');
select is((select schedule from cron.job where jobname = 'nomaderun-raid-tick'), '*/10 * * * *', 'job do raid a cada 10 min');
select is((select array_agg(id order by sort) from public.raid_bosses), array['soneca', 'rei-buzina', 'fuligem', 'mormaco', 'paredao'],
  'os 5 chefões na ordem de RAID_BOSS_IDS');

-- ---------------------------------------------------------------------------
-- Paridade com raid.ts
-- ---------------------------------------------------------------------------
select is(array[round(private.raid_seeded_unit('')::numeric, 12), round(private.raid_seeded_unit('abc')::numeric, 12),
                round(private.raid_seeded_unit('crit:x')::numeric, 12),
                round(private.raid_seeded_unit('Goiânia:raid|2026-10-22|891f1d48110ffff')::numeric, 12)],
  array[0.668922188459, 0.112445696257, 0.896392355906, 0.396122920793]::numeric[],
  'raidSeededUnit: mesmos números do domain (inclusive com acento)');
select ok(private.raid_seeded_unit('crit:e9e9e9e9-1017-4000-8000-000000000101') < 0.1
          and private.raid_seeded_unit('crit:e9e9e9e9-1017-4000-8000-000000000001') >= 0.1,
  'raidCritRoll: a atividade …101 é crítica e a …001 não (como no domain)');
select is(array[private.raid_boss_for_week('2026-10-12'), private.raid_boss_for_week('2026-10-19'), private.raid_boss_for_week('2026-10-26'),
                private.raid_boss_for_week('2026-11-02'), private.raid_boss_for_week('2026-11-23')],
  array['paredao', 'soneca', 'rei-buzina', 'fuligem', 'soneca'], 'raidBossForWeek: rodízio fixo a partir de 19/10/2026');
select is(array[private.raid_phase_of(100, 100), private.raid_phase_of(68, 100), private.raid_phase_of(67, 100),
                private.raid_phase_of(34, 100), private.raid_phase_of(33, 100), private.raid_phase_of(0, 100)],
  array[1, 1, 2, 2, 3, 3]::smallint[], 'raidPhase: 1 (> 67 %), 2 (> 33 %), 3 (o resto)');
select results_eq($$ select week_start, starts_at, ends_at from private.raid_window('2026-10-21 12:00-03') $$,
  $$ values ('2026-10-19'::date, '2026-10-19 06:00-03'::timestamptz, '2026-10-25 21:00-03'::timestamptz) $$,
  'janela: segunda 06:00 → domingo 21:00 (Brasília)');

-- ---------------------------------------------------------------------------
-- Fixtures: A e B (volt, mesma crew), C (volt); zonas próprias (os pontos fracos não dependem do seed)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0017-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'c17' || c || '@t.com', json_build_object('username', 'c17_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c']) c;
update public.profiles set faction = 'volt' where id::text like 'e9e9e9e9-0017-%';
insert into public.crews (name, tag, leader_id) values ('Crew Raid', 'RAIDX', 'e9e9e9e9-0017-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0017-4000-8000-00000000000b' from public.crews where tag = 'RAIDX';
insert into public.zones (id, name, city, geom)
select 'e9e9e9e9e9e9e0' || i, 'Zona Raid ' || i, 'Goiânia',
       extensions.st_makeenvelope(-49.30 + i * 0.01, -16.70, -49.295 + i * 0.01, -16.695, 4326)
  from generate_series(1, 4) i;

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
  $$ values ('soneca'::text, null::text, '2026-10-19'::date, 'active'::text, 1, 1.00::numeric(4, 2), true) $$,
  'raid global da semana 0: Soneca, fase 1, fator 1, vida ≥ 500');
update public.raids set hp_max = 1000, hp = 1000 where week_start = '2026-10-19';

-- ---------------------------------------------------------------------------
-- Golpes: tetos, idempotência, crítico, teto diário de dano, fases e golpe final
-- ---------------------------------------------------------------------------
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000001', '2026-10-21 07:00-03', 25000);
select results_eq($$ select (r ->> 'damage')::int, (r ->> 'countedKm')::numeric, (r ->> 'capped')::boolean, (r ->> 'hpAfter')::int,
                            (r ->> 'crit')::boolean
                       from (select public.svc_raid_hit('e9e9e9e9-1017-4000-8000-000000000001', 25000, 250) as r) x $$,
  $$ values (210, 21::numeric, true, 790, false) $$, 'corrida de 25 km: conta 21 km (210 de dano)');
select is((public.svc_raid_hit('e9e9e9e9-1017-4000-8000-000000000001', 25000, 250) ->> 'repeated')::boolean, true,
  'raid_hit idempotente: a mesma corrida não golpeia duas vezes');
select is((select hp from public.raids where week_start = '2026-10-19'), 790, 'repetir não tira vida de novo');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000002', '2026-10-21 19:00-03', 15000);
select results_eq($$ select (r ->> 'countedKm')::numeric, (r ->> 'damage')::int
                       from (select private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000002', 15000, 150) as r) x $$,
  $$ values (9::numeric, 90) $$, 'teto de 30 km por dia: a 2ª corrida conta só 9 km');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000003', '2026-10-21 20:00-03', 5000);
select is((private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000003', 5000, 50) ->> 'damage')::int, 0, 'dia cheio: dano 0');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000b', 'e9e9e9e9-1017-4000-8000-000000000101', '2026-10-22 07:00-03', 1000);
select results_eq($$ select (r ->> 'damage')::int, (r ->> 'crit')::boolean
                       from (select private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000101', 1000, 9999) as r) x $$,
  $$ values (20, true) $$, 'crítico conferido pelo servidor; sanidade: 1 km crítico dá no máximo 20');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000b', 'e9e9e9e9-1017-4000-8000-000000000007', '2026-10-22 08:00-03', 3000);
select is((private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000007', 3000, 30, 3000) ->> 'weakKm')::numeric, 0::numeric,
  'na fase 1 o ponto fraco não vale');
select is((select phase::int from public.raids where week_start = '2026-10-19'), 2, '65 % de vida: fase 2');
select is((public.job_raid_tick('2026-10-22 12:00-03') ->> 'weakPoints')::int, 3, 'fase 2: 3 pontos fracos no dia');
select is((public.job_raid_tick('2026-10-22 12:10-03') ->> 'weakPoints')::int, 0, 'pontos fracos não repetem no mesmo dia');
select is((select array_agg(zone_id order by private.raid_seeded_unit('global:' || raid_id || '|2026-10-22|' || zone_id))
             from public.raid_weak_points where day = '2026-10-22'),
          (select array_agg(z.id order by private.raid_seeded_unit('global:' || r.id || '|2026-10-22|' || z.id), z.id)
             from public.zones z, public.raids r where r.week_start = '2026-10-19' and not z.blocked
            group by r.id) [1:3], 'pontos fracos = as 3 primeiras zonas por raidSeededUnit (raidWeakPoints)');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000c', 'e9e9e9e9-1017-4000-8000-000000000009', '2026-10-22 08:00-03', 3000, false);
select is(private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000009', 3000, 30), null, 'corrida em revisão não golpeia');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000c', 'e9e9e9e9-1017-4000-8000-000000000105', '2026-10-23 07:00-03', 20000);
select results_eq($$ select (r ->> 'damage')::int, (r ->> 'crit')::boolean, (r ->> 'capped')::boolean, (r ->> 'countedKm')::numeric
                       from (select private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000105', 20000, 400) as r) x $$,
  $$ values (300, true, true, 20::numeric) $$, 'teto diário de 300 aplicado depois do crítico (20 km críticos = 400 → 300)');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000b', 'e9e9e9e9-1017-4000-8000-000000000005', '2026-10-23 08:00-03', 20000);
select results_eq($$ select (r ->> 'damage')::int, (r ->> 'weakKm')::numeric, (r ->> 'phaseAfter')::int, (r ->> 'phaseChanged')::boolean
                       from (select private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000005', 20000, 400, 20000) as r) x $$,
  $$ values (300, 20::numeric, 3, true) $$, 'ponto fraco dobra a partir da fase 2 (e o teto diário corta); fase 3');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000008', '2026-10-24 07:00-03', 10000);
select results_eq($$ select (r ->> 'defeated')::boolean, (r ->> 'finalBlow')::boolean, (r ->> 'phaseAfter')::int, (r ->> 'hpAfter')::int
                       from (select private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000008', 10000, 100) as r) x $$,
  $$ values (true, true, 3, 0) $$, 'o golpe que zera a vida derrota o chefão (golpe final)');
select results_eq($$ select status, defeated_at, participants from public.raids where week_start = '2026-10-19' $$,
  $$ values ('defeated'::text, '2026-10-24 07:00-03'::timestamptz, 3) $$, 'derrotado na hora da corrida, com 3 participantes');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000c', 'e9e9e9e9-1017-4000-8000-000000000006', '2026-10-24 10:00-03', 5000);
select is(private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000006', 5000, 50), null, 'depois de derrotado, ninguém golpeia');

-- ---------------------------------------------------------------------------
-- Tela e RLS (raid_current mostra o raid desta semana ou da anterior: o teste traz o raid para a semana de hoje)
-- ---------------------------------------------------------------------------
update public.raids set week_start = (private.raid_window(now())).week_start where week_start = '2026-10-19';
select pg_temp.login('e9e9e9e9-0017-4000-8000-00000000000a');
select results_eq($$ select (r -> 'raid' ->> 'bossId'), (r -> 'me' ->> 'damage')::int, (r -> 'me' ->> 'rank')::int,
                            jsonb_array_length(r -> 'topRunners'), r ->> 'sinceLastVisit'
                       from (select public.raid_current() as r) x $$,
  $$ values ('soneca'::text, 400, 1, 3, null::text) $$, 'raid_current: chefão, sua parte, posição e top corredores');
select is((public.raid_current() -> 'sinceLastVisit' ->> 'damage')::int, 0, 'segunda visita: dano da cidade desde a última');
select is((public.raid_current() -> 'topCrews' -> 0 ->> 'tag'), 'RAIDX', 'ranking de crews pela crew no momento do golpe');
select ok(public.raid_current()::text !~ 'e9e9e9e9-1017', 'raid_current não expõe ids de corrida');
select is((select count(*)::int from public.raid_hits), 4, 'cada um lê só os próprios golpes');
select throws_ok($$ insert into public.raid_hits (activity_id, raid_id, user_id, day, meters, damage)
                    select 'e9e9e9e9-1017-4000-8000-000000000006', id, auth.uid(), current_date, 1000, 99999 from public.raids $$,
  '42501', null, 'cliente não grava dano');
select throws_ok($$ update public.raids set hp = 0 $$, '42501', null, 'cliente não mexe na vida do chefão');
reset role;
update public.raids set week_start = '2026-10-19' where boss_id = 'soneca' and status = 'defeated';

-- ---------------------------------------------------------------------------
-- Prêmios (idempotentes)
-- ---------------------------------------------------------------------------
select is((public.job_raid_tick('2026-10-25 10:00-03') ->> 'rewarded')::int, 1, 'o job premia o raid derrotado');
select results_eq($$ select kind, xp, chest_rarity, medal_tier from public.raid_rewards
                      where user_id = 'e9e9e9e9-0017-4000-8000-00000000000b' order by kind $$,
  $$ values ('derrota'::text, 200, 'raro'::text, 'prata'::text), ('participacao', 175, null, null), ('top10', 0, null, null) $$,
  'B: XP = dano ÷ 2, +200 da derrota, baú raro (caiu no sábado) e medalha de prata (top 10)');
select is((select xp from public.raid_rewards where user_id = 'e9e9e9e9-0017-4000-8000-00000000000a' and kind = 'participacao'), 200,
  'A: XP do dano (400 ÷ 2)');
select is((select medal_tier from public.raid_rewards where user_id = 'e9e9e9e9-0017-4000-8000-00000000000a' and kind = 'derrota'), 'ouro',
  'golpe final: medalha de ouro');
select ok(exists (select 1 from public.user_cosmetics where user_id = 'e9e9e9e9-0017-4000-8000-00000000000a' and cosmetic_id = 'moldura-golpe-final'),
  'golpe final: moldura cosmética');
select ok(exists (select 1 from public.user_cosmetics where user_id = 'e9e9e9e9-0017-4000-8000-00000000000b'
                     and cosmetic_id = 'titulo-cacador' and variant = 'soneca'), 'top 10: título "Caçador da Soneca"');
select is((select tier from public.user_medals where user_id = 'e9e9e9e9-0017-4000-8000-00000000000b' and medal_id = 'chefao'
              and period = 'soneca'), 'prata', 'medalha do chefão, uma por espécie');
select is((select array_agg(min_rarity) from public.bonus_chests where user_id = 'e9e9e9e9-0017-4000-8000-00000000000b' and source = 'raid'),
  array['raro'], 'o baú do chefão abre junto com o próximo baú do dia');
select is((select count(*)::int from public.xp_ledger where source = 'raid' and user_id::text like 'e9e9e9e9-0017-%'), 6, 'XP do raid pelo livro');
select is((select count(*)::int from public.notifications where type = 'raid' and user_id::text like 'e9e9e9e9-0017-%'), 3,
  'uma notificação por participante');
select is((public.job_raid_tick('2026-10-25 10:10-03') ->> 'rewarded')::int, 0, 'rodar de novo não premia de novo');
select results_eq($$ select (select count(*)::int from public.xp_ledger where source = 'raid' and user_id::text like 'e9e9e9e9-0017-%'),
                            (select count(*)::int from public.notifications where type = 'raid' and user_id::text like 'e9e9e9e9-0017-%') $$,
  $$ values (6, 3) $$, 'nem XP nem notificação em dobro');

-- ---------------------------------------------------------------------------
-- Semanas seguintes: fator de dificuldade (raidNextFactor), fuga e rodízio
-- ---------------------------------------------------------------------------
select is((public.job_raid_tick('2026-10-26 07:00-03') ->> 'opened')::int, 1, 'segunda seguinte: abre o próximo');
select results_eq($$ select boss_id, factor from public.raids where week_start = '2026-10-26' $$,
  $$ values ('rei-buzina'::text, 1.00::numeric(4, 2)) $$, 'caiu no sábado: fator igual; semana 1: Rei Buzina');
select is((public.job_raid_tick('2026-11-01 22:00-03') ->> 'closed')::int, 1, 'domingo 21:00 com vida: o chefão foge');
select is((select status from public.raids where week_start = '2026-10-26'), 'escaped', 'status fugiu');
select is((public.job_raid_tick('2026-11-02 07:00-03') ->> 'opened')::int, 1, 'abre a semana de novembro');
select results_eq($$ select boss_id, factor from public.raids where week_start = '2026-11-02' $$,
  $$ values ('fuligem'::text, 0.90::numeric(4, 2)) $$, 'fugiu: fator −10 %; semana 2: Fuligem');
select pg_temp.run('e9e9e9e9-0017-4000-8000-00000000000a', 'e9e9e9e9-1017-4000-8000-000000000011', '2026-11-03 07:00-03', 2000);
select is((private.apply_raid_hit('e9e9e9e9-1017-4000-8000-000000000011', 2000, 20) ->> 'bossId'), 'fuligem', 'o golpe vai para o chefão da semana');
select is((select factor from public.raids where week_start = '2026-11-02'), 0.90::numeric(4, 2), 'fator guardado na linha');

select * from finish();
rollback;
