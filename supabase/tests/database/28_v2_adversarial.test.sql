-- T7.3.8 (onda 3) — casos adversariais da v2 no banco, como o cliente os tentaria (role authenticated). A versão
-- HTTP (PostgREST + Edge Functions, com JWT de verdade) está em supabase/tests/security/v2-security.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0028-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'x28' || c || '@t.com', json_build_object('username', 'x28_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b']) c;
update public.profiles set faction = 'volt' where id::text like 'e9e9e9e9-0028-%';
update public.game_config set value = value || '{"feed": true, "missions": true, "raid": true, "telemetry": true}' where key = 'features';
insert into public.crews (name, tag, leader_id) values ('Crew Ataque', 'ATAQ', 'e9e9e9e9-0028-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0028-4000-8000-00000000000b' from public.crews where tag = 'ATAQ';
-- 201 corridas de A no feed da crew (para o teto de 200 aplausos por dia de B)
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, scored)
select ('e9e9e9e9-1028-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'e9e9e9e9-0028-4000-8000-00000000000a', 'valid',
       now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours', 3000, 1000, true
  from generate_series(1, 201) n;
insert into public.feed_items (id, activity_id, user_id, crew_id, day, meters, moving_seconds)
select ('e9e9e9e9-2028-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('e9e9e9e9-1028-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'e9e9e9e9-0028-4000-8000-00000000000a', (select id from public.crews where tag = 'ATAQ'), public.br_today(), 3000, 1000
  from generate_series(1, 201) n;
insert into public.user_missions (id, user_id, def_id, kind, period_key, slot, metric, target, xp, title, available_from)
values ('e9e9e9e9-3028-4000-8000-000000000001', 'e9e9e9e9-0028-4000-8000-00000000000b', 'd-mover-15', 'diaria',
        public.br_today()::text, 0, 'moving_seconds', 900, 20, 'Mova-se 15 min', now() - interval '1 hour');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- 1) aplaudir a si mesmo
select pg_temp.login('e9e9e9e9-0028-4000-8000-00000000000a');
select throws_like($$ select public.react_feed_item('e9e9e9e9-2028-4000-8000-000000000001', 'bora') $$, '%KUDOS_SELF%',
  'aplaudir a própria corrida: KUDOS_SELF');
reset role;

-- 2) passar de 200 aplausos no dia
select pg_temp.login('e9e9e9e9-0028-4000-8000-00000000000b');
select is((select count(*)::int from generate_series(1, 200) n,
                lateral (select public.react_feed_item(('e9e9e9e9-2028-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'fogo')) x),
  200, '200 aplausos no dia: aceitos');
select throws_like($$ select public.react_feed_item('e9e9e9e9-2028-4000-8000-000000000201', 'raio') $$, '%KUDOS_LIMIT%',
  'o 201º aplauso do dia: KUDOS_LIMIT');
select lives_ok($$ select public.react_feed_item('e9e9e9e9-2028-4000-8000-000000000001', 'raio') $$,
  'trocar a reação de um item já aplaudido não conta de novo');
select throws_ok($$ insert into public.kudos (feed_item_id, user_id, reaction)
                    values ('e9e9e9e9-2028-4000-8000-000000000201', 'e9e9e9e9-0028-4000-8000-00000000000b', 'bora') $$,
  '42501', null, 'driblar o teto inserindo em kudos direto: sem permissão');

-- 3) ler feed_items direto (o created_at nunca sai)
select throws_ok($$ select created_at from public.feed_items $$, '42501', null, 'feed_items direto: sem permissão');

-- 4) zone_cells e paint_marks: RLS ligada, sem grant e sem policy
select throws_ok($$ select * from public.zone_cells $$, '42501', null, 'zone_cells direto: sem permissão');
select throws_ok($$ select * from public.paint_marks $$, '42501', null, 'paint_marks direto: sem permissão');
reset role;
select ok((select bool_and(c.relrowsecurity) and count(*) = 2 from pg_class c
            where c.oid in ('public.zone_cells'::regclass, 'public.paint_marks'::regclass))
          and not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('zone_cells', 'paint_marks'))
          and not has_any_column_privilege('anon', 'public.zone_cells', 'select'),
  'zone_cells e paint_marks: RLS ligada, nenhuma policy, nenhum privilégio de leitura');

-- 5) forjar golpe no chefão
select pg_temp.login('e9e9e9e9-0028-4000-8000-00000000000b');
select throws_ok($$ select public.svc_raid_hit('e9e9e9e9-1028-4000-8000-000000000001', 21000, 999) $$, '42501', null,
  'svc_raid_hit pelo cliente: sem permissão');
select throws_ok($$ insert into public.raid_hits default values $$, '42501', null, 'inserir golpe em raid_hits direto: sem permissão');
select throws_ok($$ delete from public.raids $$, '42501', null, 'apagar ou mexer no chefão direto: sem permissão');

-- 6) resgatar missão 2 vezes (o XP é pago uma vez, na conclusão, pelo servidor)
reset role;
select private.settle_mission('e9e9e9e9-3028-4000-8000-000000000001', 900);
select private.settle_mission('e9e9e9e9-3028-4000-8000-000000000001', 900);
select pg_temp.login('e9e9e9e9-0028-4000-8000-00000000000b');
select results_eq($$ select (public.claim_mission('e9e9e9e9-3028-4000-8000-000000000001') ->> 'xp')::int
                     union all select (public.claim_mission('e9e9e9e9-3028-4000-8000-000000000001') ->> 'xp')::int $$,
  $$ values (20), (20) $$, 'resgatar 2 vezes: a mesma resposta');
reset role;
select results_eq($$ select (select count(*)::int from public.xp_ledger where user_id = 'e9e9e9e9-0028-4000-8000-00000000000b'),
                            (select xp::int from public.profiles where id = 'e9e9e9e9-0028-4000-8000-00000000000b') $$,
  $$ values (1, 20) $$, 'XP da missão pago uma vez só (1 linha no livro, 20 XP)');
select pg_temp.login('e9e9e9e9-0028-4000-8000-00000000000a');
select throws_like($$ select public.claim_mission('e9e9e9e9-3028-4000-8000-000000000001') $$, '%NOT_FOUND%',
  'resgatar a missão de outra pessoa: NOT_FOUND');

-- 7) telemetria sem consentimento
select throws_like($$ select public.track_events('[{"event": "app_open"}]') $$, '%TELEMETRY_CONSENT%',
  'telemetria sem consentimento: TELEMETRY_CONSENT');
select throws_ok($$ insert into public.telemetry_events (user_id, event, day)
                    values ('e9e9e9e9-0028-4000-8000-00000000000a', 'app_open', public.br_today()) $$,
  '42501', null, 'driblar o consentimento inserindo direto: sem permissão');
reset role;

select * from finish();
rollback;
