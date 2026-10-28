-- T1.3 — estrutura e segurança do esquema (RNF-007, D-07)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS ligada em todas as tabelas do schema public');

select is(
  (select count(*)::int from pg_tables where schemaname = 'public'),
  51, '51 tabelas (15 do modelo + privacy_zones e chests da Fase 3 + 25 da v2 onda 1: contrato, recompensas, baú do dia, raid, liga, missões e trilha + 7 da onda 2: pintura, recordes e feed + 2 da onda 3: telemetria)');

select has_extension('postgis', 'PostGIS instalado');
select has_extension('pg_cron', 'pg_cron instalado');
select has_extension('pgcrypto', 'pgcrypto instalado');

select ok(
  exists (select 1 from pg_indexes where tablename = 'zones' and indexdef ilike '%using gist (geom)%'),
  'índice GiST em zones.geom (RNF-009)');

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'zones'),
  'Realtime habilitado em zones (RNF-003)');

select is(
  (select count(*)::int from cron.job where jobname like 'nomaderun-%'),
  8, 'jobs agendados no pg_cron: os 4 da T3.6 + raid (D-67), liga (D-68), desbotar a pintura (D-62) e retenção da telemetria (D-82)');

select is(
  (select schedule from cron.job where jobname = 'nomaderun-decay-zones'),
  '0 6 * * *', 'decaimento às 06:00 UTC = 03:00 de Brasília (RN-005)');

select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and (p.proname like 'svc\_%' or p.proname like 'job\_%')
       and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  'funções internas (svc_*, job_*) não executáveis por anon/authenticated');

select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'toda função security definer tem search_path fixo');

select ok(not has_column_privilege('authenticated', 'public.devices', 'secret', 'select'),
  'cliente não lê devices.secret (D-04)');

select ok(not has_table_privilege('anon', 'public.zones', 'select'), 'anon não lê zonas (só usuários logados)');

select ok(not has_function_privilege('anon', 'public.choose_faction(text)', 'execute'), 'anon não chama choose_faction');

select * from finish();
rollback;
