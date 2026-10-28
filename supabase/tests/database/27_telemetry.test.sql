-- T7.3.8 (onda 3; D-82) — telemetria opt-in: consentimento, lista fechada de eventos sem localização, envio em lote
-- recusado sem consentimento, tetos, retenção de 30 dias, exportação e exclusão (LGPD).
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- ---------------------------------------------------------------------------
-- Esquema e privilégios
-- ---------------------------------------------------------------------------
select is((select array_agg(column_name::text order by column_name) from information_schema.columns
            where table_schema = 'public' and table_name = 'telemetry_events'),
  array['app_version', 'day', 'event', 'id', 'platform', 'props', 'user_id'],
  'telemetry_events: só o dia (sem horário) e nenhuma coluna de localização');
select ok((select bool_and(c.relrowsecurity) from pg_class c
            where c.oid in ('public.telemetry_consent'::regclass, 'public.telemetry_events'::regclass)), 'RLS ligada nas duas tabelas');
select ok(not has_any_column_privilege('authenticated', 'public.telemetry_events', 'select')
          and not has_any_column_privilege('authenticated', 'public.telemetry_events', 'insert')
          and not has_any_column_privilege('authenticated', 'public.telemetry_consent', 'select')
          and not has_any_column_privilege('authenticated', 'public.telemetry_consent', 'insert')
          and not has_any_column_privilege('anon', 'public.telemetry_events', 'select'),
  'o cliente não lê nem escreve as tabelas (só as RPCs)');
select ok(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename like 'telemetry%'),
  'telemetria fora do Realtime');
select ok(has_function_privilege('authenticated', 'public.track_events(jsonb)', 'execute')
          and not has_function_privilege('anon', 'public.track_events(jsonb)', 'execute')
          and has_function_privilege('authenticated', 'public.set_telemetry_consent(boolean, integer)', 'execute')
          and not has_function_privilege('anon', 'public.set_telemetry_consent(boolean, integer)', 'execute')
          and has_function_privilege('authenticated', 'public.my_telemetry_consent()', 'execute')
          and not has_function_privilege('authenticated', 'public.job_telemetry_retention(date)', 'execute')
          and has_function_privilege('service_role', 'public.job_telemetry_retention(date)', 'execute'),
  'RPCs só para quem está logado; o job só para o service role');
select is((select schedule from cron.job where jobname = 'nomaderun-telemetry-retention'), '40 6 * * *',
  'retenção diária às 03:40 de Brasília');
select is((select value ->> 'telemetry' from public.game_config where key = 'features'), 'false', 'feature desligada por padrão (D-82)');

-- props: lista fechada (sem coordenada nem texto livre)
select is(array[private.telemetry_props_ok('{}'), private.telemetry_props_ok('{"model": "run", "withRoute": true, "count": 3}'),
                private.telemetry_props_ok('{"lat": -16}'), private.telemetry_props_ok('{"source": "-16.68,-49.25"}'),
                private.telemetry_props_ok('{"count": 1.5}'), private.telemetry_props_ok('{"count": 100001}'),
                private.telemetry_props_ok('{"kind": "Rua Tal 123"}'), private.telemetry_props_ok('[]'),
                private.telemetry_props_ok('{"model": {"a": 1}}')],
  array[true, true, false, false, false, false, false, false, false],
  'props: só chaves da lista, texto curto sem ponto/vírgula/espaço, booleano ou inteiro de 0 a 100.000');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0027-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       't27' || c || '@t.com', json_build_object('username', 't27_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b']) c;

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ---------------------------------------------------------------------------
-- Feature desligada e sem consentimento
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0027-4000-8000-00000000000a');
select is(public.my_telemetry_consent(), '{"enabled": false, "optedIn": false, "policyVersion": 1}'::jsonb,
  'padrão: sem consentimento');
select throws_like($$ select public.track_events('[{"event": "app_open"}]') $$, '%FEATURE_DISABLED%', 'feature desligada: recusa');
reset role;
update public.game_config set value = value || '{"telemetry": true}' where key = 'features';
select pg_temp.login('e9e9e9e9-0027-4000-8000-00000000000a');
select throws_like($$ select public.track_events('[{"event": "app_open"}]') $$, '%TELEMETRY_CONSENT%',
  'sem consentimento: recusa (nada é gravado)');
select public.set_telemetry_consent(false);
select throws_like($$ select public.track_events('[{"event": "app_open"}]') $$, '%TELEMETRY_CONSENT%',
  'consentimento negado explicitamente: recusa');
reset role;
select is((select count(*)::int from public.telemetry_events), 0, 'nenhum evento gravado sem consentimento');

-- ---------------------------------------------------------------------------
-- Com consentimento
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0027-4000-8000-00000000000a');
select is(public.set_telemetry_consent(true) - 'deletedEvents', '{"optedIn": true, "policyVersion": 1}'::jsonb, 'consentimento dado');
select is((public.my_telemetry_consent() ->> 'optedIn')::boolean, true, 'my_telemetry_consent reflete a escolha');
select is(public.track_events(format('[{"event": "app_open", "appVersion": "1.4.0", "platform": "android"},
                                       {"event": "run_finish"}, {"event": "zone_conquer", "props": {"count": 2}},
                                       {"event": "share", "props": {"model": "run", "format": "stories", "withRoute": true}},
                                       {"event": "mission_complete", "props": {"missionId": "d-km-2", "kind": "diaria"}},
                                       {"event": "app_open", "day": "%s"}]', public.br_today() - 1)::jsonb),
  '{"accepted": 6, "dropped": 0}'::jsonb, 'os 5 eventos da lista (e app_open de ontem) aceitos');
select is(public.track_events('[{"event": "app_open"}]'), '{"accepted": 0, "dropped": 1}'::jsonb, 'app_open: 1 por dia');
select throws_like($$ select public.track_events('[{"event": "run_finish"}, {"event": "screen_view"}]') $$, '%VALIDATION%',
  'evento fora da lista: o lote inteiro é recusado');
select throws_like($$ select public.track_events('[{"event": "run_finish", "lat": -16.68, "lng": -49.25}]') $$, '%VALIDATION%',
  'campo fora do formato (coordenada): recusado');
select throws_like($$ select public.track_events('[{"event": "share", "props": {"source": "-16.68,-49.25"}}]') $$, '%VALIDATION%',
  'coordenada escondida em props: recusada');
select throws_like($$ select public.track_events('[{"event": "run_finish", "day": "2020-01-01"}]') $$, '%VALIDATION%',
  'dia antigo (mais de 2 dias): recusado');
select throws_like($$ select public.track_events('[{"event": "run_finish", "day": "2026-02-31"}]') $$, '%VALIDATION%',
  'dia que não existe: VALIDATION (não erro de SQL)');
select throws_like($$ select public.track_events('[]') $$, '%VALIDATION%', 'lote vazio: recusado');
select throws_like($$ select public.track_events((select jsonb_agg('{"event": "run_finish"}'::jsonb) from generate_series(1, 51))) $$,
  '%VALIDATION%', 'lote com mais de 50: recusado');
select throws_like($$ select public.track_events('{"event": "run_finish"}') $$, '%VALIDATION%', 'não é lista: recusado');
-- teto de 200 por dia: 5 hoje + 4 lotes de 50
select is((select sum((public.track_events((select jsonb_agg('{"event": "run_finish"}'::jsonb) from generate_series(1, 50))) ->> 'dropped')::int)::int
             from generate_series(1, 4)), 5, 'teto de 200 eventos por dia: o excedente é descartado e contado');
reset role;
select is((select count(*)::int from public.telemetry_events where user_id = 'e9e9e9e9-0027-4000-8000-00000000000a' and day = public.br_today()),
  200, '200 eventos hoje, nenhum a mais');

-- ---------------------------------------------------------------------------
-- LGPD: exportação, retirada do consentimento e exclusão
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0027-4000-8000-00000000000a');
select results_eq($$ select (x #>> '{telemetryConsent,opted_in}')::boolean, jsonb_array_length(x -> 'telemetryEvents')
                       from (select public.account_export_v2() as x) e $$,
  $$ values (true, 201) $$, 'exportação traz o consentimento e os eventos');
reset role;
select pg_temp.login('e9e9e9e9-0027-4000-8000-00000000000b');
select public.set_telemetry_consent(true);
select is(public.track_events('[{"event": "app_open"}]'), '{"accepted": 1, "dropped": 0}'::jsonb, 'B também pode enviar');
reset role;
select pg_temp.login('e9e9e9e9-0027-4000-8000-00000000000a');
select is((public.set_telemetry_consent(false) ->> 'deletedEvents')::int, 201, 'retirar o consentimento apaga os eventos na hora');
reset role;
select results_eq($$ select count(*) filter (where user_id = 'e9e9e9e9-0027-4000-8000-00000000000a')::int,
                            count(*) filter (where user_id = 'e9e9e9e9-0027-4000-8000-00000000000b')::int from public.telemetry_events $$,
  $$ values (0, 1) $$, 'só os de A foram apagados');

-- retenção: 30 dias
insert into public.telemetry_events (user_id, event, day) values
  ('e9e9e9e9-0027-4000-8000-00000000000b', 'run_finish', public.br_today() - 30),
  ('e9e9e9e9-0027-4000-8000-00000000000b', 'run_finish', public.br_today() - 31),
  ('e9e9e9e9-0027-4000-8000-00000000000b', 'run_finish', public.br_today() - 90);
select is(public.job_telemetry_retention(), 2, 'retenção: apaga o que tem mais de 30 dias');
select is(public.job_telemetry_retention(), 0, 'retenção idempotente');

delete from auth.users where id = 'e9e9e9e9-0027-4000-8000-00000000000b';
select is((select count(*)::int from public.telemetry_events where user_id = 'e9e9e9e9-0027-4000-8000-00000000000b')
          + (select count(*)::int from public.telemetry_consent where user_id = 'e9e9e9e9-0027-4000-8000-00000000000b'), 0,
  'exclusão da conta: consentimento e eventos caem em cascata');
select ok('telemetry_events' = any (private.export_v2_tables()) and 'telemetry_consent' = any (private.export_v2_tables()),
  'as duas tabelas estão na lista da exportação v2');

select * from finish();
rollback;
