-- T4.2 (A5) — auditoria de segurança do banco (RNF-007, OWASP A01/A05): garantias estruturais (RLS, grants,
-- security definer com search_path fixo, funções internas fora do alcance do cliente, colunas sensíveis fora das
-- views públicas) e tentativas de escalada por um usuário comum, pelo líder de crew e pelo moderador.
-- Achados que ainda não estão corrigidos ficam no teste adversarial (supabase/tests/security) e em docs/QA.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- ---------------------------------------------------------------------------
-- 1. Garantias estruturais (catálogo)
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null, 'toda tabela do schema public tem RLS ligada');

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  null, 'toda função security definer tem search_path fixo');

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'svc\_%' or p.proname like 'job\_%')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  null, 'funções svc_* e job_* só para o service role');

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  array['username_available'], 'anon só executa username_available entre as funções security definer');

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
      and (has_table_privilege('anon', c.oid, 'select') or has_any_column_privilege('anon', c.oid, 'select')
           or has_any_column_privilege('anon', c.oid, 'insert') or has_any_column_privilege('anon', c.oid, 'update'))),
  null, 'anon não tem privilégio em nenhuma tabela ou view do public');

select is(
  (select array_agg(t order by t) from unnest(array[
      'activities', 'activity_points', 'activity_zones', 'zones', 'zone_events', 'notifications', 'fog_cells',
      'chest_opens', 'chests', 'moderation_reviews', 'devices', 'seasons', 'crew_members', 'profiles',
      -- v2 (D-80): flags, livro de XP e o estado das features novas também só pelo servidor
      'game_config', 'xp_ledger', 'cosmetic_defs', 'user_cosmetics', 'user_equipped', 'medal_defs', 'user_medals',
      'daily_chest_state', 'daily_rewards', 'raid_bosses', 'raids', 'raid_hits', 'raid_weak_points', 'raid_rewards', 'raid_visits']) t
    where has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')),
  null, 'cliente não insere direto em tabelas escritas só pelo servidor (corridas, pontos, zonas, notificações, perfis, XP...)');

select is(
  (select array_agg(t order by t) from unnest(array[
      'activities', 'activity_points', 'activity_zones', 'zones', 'zone_events', 'fog_cells', 'chest_opens', 'chests',
      'moderation_reviews', 'devices', 'seasons', 'crew_members',
      'game_config', 'xp_ledger', 'cosmetic_defs', 'user_cosmetics', 'user_equipped', 'medal_defs', 'user_medals',
      'daily_chest_state', 'daily_rewards', 'raid_bosses', 'raids', 'raid_hits', 'raid_weak_points', 'raid_rewards', 'raid_visits']) t
    where has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')),
  null, 'cliente não altera tabelas escritas só pelo servidor');

select is(
  (select array_agg(t order by t) from unnest(array[
      'activities', 'activity_points', 'activity_zones', 'zones', 'zone_events', 'notifications', 'fog_cells',
      'chest_opens', 'chests', 'moderation_reviews', 'devices', 'seasons', 'profiles',
      'game_config', 'xp_ledger', 'cosmetic_defs', 'user_cosmetics', 'user_equipped', 'medal_defs', 'user_medals',
      'daily_chest_state', 'daily_rewards', 'raid_bosses', 'raids', 'raid_hits', 'raid_weak_points', 'raid_rewards', 'raid_visits']) t
    where has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')),
  null, 'cliente não apaga corridas, zonas, notificações, perfis (exclusão de conta só pela function)');

select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['avatar_url', 'city', 'notification_prefs', 'units', 'username'],
  'perfil: cliente só altera username, cidade, foto, unidade e preferências');

select is(
  (select array_agg(table_name || '.' || column_name order by table_name, column_name) from information_schema.columns
    where table_schema = 'public'
      and table_name in ('public_profiles', 'leaderboard_individual', 'leaderboard_crews', 'leaderboard_factions', 'leaderboard_cities')
      and column_name in ('birthdate', 'email', 'role', 'trust', 'status', 'secret', 'suspended_until', 'notification_prefs',
                          'terms_accepted_at', 'privacy_accepted_at', 'is_demo', 'invite_code', 'lat', 'lng')),
  null, 'views públicas não expõem nascimento, e-mail, papel, confiança, status, convite ou coordenadas');

select ok(
  (select bool_and(pg_get_function_result(p.oid) !~* '(birthdate|email|trust|role|secret|invite_code)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('ranking_runners', 'ranking_crews', 'ranking_factions', 'district_label', 'daily_chests', 'zones_in_bbox')),
  'RPCs de ranking/baús/zonas não devolvem colunas sensíveis');

select ok(
  not has_column_privilege('authenticated', 'public.devices', 'secret', 'select'),
  'devices.secret sem grant de leitura para o cliente');

select is(
  (select array_agg(tablename::text order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'),
  -- v2 (D-67): raids entra de propósito; só tem números públicos (vida, fase, status), sem coluna de usuário
  array['notifications', 'raids', 'zones'], 'Realtime publica só zones, notifications e raids (RLS vale na assinatura)');

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars' $$,
  $$ values (true, 2097152::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'bucket avatars: 2 MB e só jpeg/png/webp (sem SVG/HTML)');

-- ---------------------------------------------------------------------------
-- Fixtures: A (striders), B (striders, líder de crew), C (coyotes), M (moderador), D (admin)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'sa@t.com',
   '{"username": "sec_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'sb@t.com',
   '{"username": "sec_b", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'sc@t.com',
   '{"username": "sec_c", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'sm@t.com',
   '{"username": "sec_m", "birthdate": "1990-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'sd@t.com',
   '{"username": "sec_d", "birthdate": "1990-01-01", "terms_accepted": true}');
update public.profiles set faction = 'striders' where id in ('a5a5a5a5-0000-4000-8000-00000000000a', 'a5a5a5a5-0000-4000-8000-00000000000b');
update public.profiles set faction = 'coyotes' where id = 'a5a5a5a5-0000-4000-8000-00000000000c';
update public.profiles set faction = 'owls', role = 'moderator' where id = 'a5a5a5a5-0000-4000-8000-00000000000e';
update public.profiles set faction = 'volt', role = 'admin' where id = 'a5a5a5a5-0000-4000-8000-00000000000d';
insert into public.notifications (id, user_id, type, title, body)
  values ('a5a5a5a5-1111-4000-8000-000000000001', 'a5a5a5a5-0000-4000-8000-00000000000a', 'system', 'Original', 'corpo');
insert into public.safety_contacts (id, user_id, name, phone)
  values ('a5a5a5a5-2222-4000-8000-000000000001', 'a5a5a5a5-0000-4000-8000-00000000000a', 'Mãe', '+55 62 99999-0000');
insert into public.privacy_zones (user_id, lat, lng) values ('a5a5a5a5-0000-4000-8000-00000000000a', -16.7, -49.2);
insert into public.devices (id, user_id, secret, platform)
  values ('a5a5a5a5-3333-4000-8000-000000000001', 'a5a5a5a5-0000-4000-8000-00000000000a', extensions.gen_random_bytes(32), 'ios');
insert into public.fog_cells (user_id, cell) values ('a5a5a5a5-0000-4000-8000-00000000000a', '8aa8c0ce2c37fff');

create function pg_temp.affected(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- B cria uma crew (striders)
select pg_temp.login('a5a5a5a5-0000-4000-8000-00000000000b');
insert into public.crews (name, tag) values ('Crew Segura', 'SEG');
-- QA-01: só membros leem o código; o líder guarda para o teste de RN-011 abaixo
create temp table seg_code as select invite_code from public.crews where tag = 'SEG';
grant select on seg_code to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Usuário comum (A)
-- ---------------------------------------------------------------------------
select pg_temp.login('a5a5a5a5-0000-4000-8000-00000000000a');
select throws_ok($$ update public.notifications set title = 'Phishing' where id = 'a5a5a5a5-1111-4000-8000-000000000001' $$,
  '42501', null, 'dono não reescreve o texto da própria notificação (só read_at)');
select throws_ok($$ update public.notifications set user_id = 'a5a5a5a5-0000-4000-8000-00000000000b' $$,
  '42501', null, 'dono não transfere notificação para outro usuário');
select throws_ok($$ update public.safety_contacts set user_id = 'a5a5a5a5-0000-4000-8000-00000000000b' $$,
  '42501', null, 'contato de segurança não muda de dono');
select throws_ok($$ update public.privacy_zones set user_id = 'a5a5a5a5-0000-4000-8000-00000000000b' $$,
  '42501', null, 'zona de privacidade não muda de dono');
select throws_ok($$ insert into public.privacy_zones (user_id, lat, lng) values ('a5a5a5a5-0000-4000-8000-00000000000b', 0, 0) $$,
  '42501', null, 'zona de privacidade não é criada em nome de outro (user_id sem grant)');
select throws_ok($$ insert into public.crews (name, tag, faction) values ('Falsa', 'FAL', 'coyotes') $$,
  '42501', null, 'cliente não escolhe a facção da crew (vem do líder)');
select throws_ok($$ insert into public.crews (name, tag, leader_id) values ('Falsa', 'FAL', 'a5a5a5a5-0000-4000-8000-00000000000b') $$,
  '42501', null, 'cliente não cria crew em nome de outro líder');
select throws_ok($$ insert into public.crew_members (crew_id, user_id) select id, 'a5a5a5a5-0000-4000-8000-00000000000a' from public.crews where tag = 'SEG' $$,
  '42501', null, 'entrada em crew só pela RPC join_crew');
select is(pg_temp.affected($q$update public.crews set name = 'Tomada' where tag = 'SEG'$q$), 0,
  'quem não é líder não renomeia a crew');
select is(pg_temp.affected($q$delete from public.crews where tag = 'SEG'$q$), 0,
  'quem não é líder não apaga a crew');
select is(pg_temp.affected($q$delete from public.crew_members where user_id = 'a5a5a5a5-0000-4000-8000-00000000000b'$q$), 0,
  'quem não é líder não expulsa o líder de outra crew');
select throws_like($$ select public.admin_set_user_status('a5a5a5a5-0000-4000-8000-00000000000b', 'inactive') $$, '%FORBIDDEN%',
  'corredor não inativa contas');
select is(public.username_available($$x' or '1'='1$$), false, 'username_available com texto malicioso só responde false');
select is((select count(*)::int from public.public_crews where tag = 'SEG'), 1, 'crews são visíveis para todos em public_crews (nome e sigla, sem o convite; QA-01)');

-- ---------------------------------------------------------------------------
-- 3. Líder de crew (B)
-- ---------------------------------------------------------------------------
select pg_temp.login('a5a5a5a5-0000-4000-8000-00000000000b');
select throws_ok($$ update public.crews set tag = 'XYZ' where tag = 'SEG' $$, '42501', null, 'líder não troca a sigla depois de criada');
select throws_ok($$ update public.crews set faction = 'coyotes' where tag = 'SEG' $$, '42501', null, 'líder não troca a facção da crew');
select throws_ok($$ update public.crews set invite_code = 'AAAAAAAA' where tag = 'SEG' $$, '42501', null, 'líder não escolhe o código de convite');
select throws_ok($$ update public.crews set leader_id = 'a5a5a5a5-0000-4000-8000-00000000000a' where tag = 'SEG' $$, '42501', null,
  'líder não passa a liderança direto na tabela');

-- C (coyotes) não entra na crew dos striders
select pg_temp.login('a5a5a5a5-0000-4000-8000-00000000000c');
select throws_like($$ select public.join_crew((select invite_code from seg_code)) $$, '%CREW_FACTION_MISMATCH%',
  'usuário de outra facção não entra na crew (RN-011)');

-- ---------------------------------------------------------------------------
-- 4. Moderador (M): lê corridas para moderar, mas não dados pessoais que não precisa
-- ---------------------------------------------------------------------------
select pg_temp.login('a5a5a5a5-0000-4000-8000-00000000000e');
select is((select count(*)::int from public.privacy_zones), 0, 'moderador não lê zonas de privacidade de outros');
select is((select count(*)::int from public.devices), 0, 'moderador não lê aparelhos de outros');
select is((select count(*)::int from public.fog_cells), 0, 'moderador não lê a neblina de outros');
select is((select count(*)::int from public.notifications), 0, 'moderador não lê notificações de outros');
select throws_ok($$ update public.profiles set role = 'admin' where id = 'a5a5a5a5-0000-4000-8000-00000000000e' $$, '42501', null,
  'moderador não se promove a admin');
select is(pg_temp.affected($q$update public.profiles set city = 'Outra' where id = 'a5a5a5a5-0000-4000-8000-00000000000a'$q$), 0,
  'moderador lê, mas não altera o perfil de outros');
select throws_like($$ select public.admin_set_user_status('a5a5a5a5-0000-4000-8000-00000000000a', 'inactive') $$, '%FORBIDDEN%',
  'moderador não inativa contas (só admin)');

-- ---------------------------------------------------------------------------
-- 5. Admin (D)
-- ---------------------------------------------------------------------------
select pg_temp.login('a5a5a5a5-0000-4000-8000-00000000000d');
select throws_like($$ select public.admin_set_user_status('a5a5a5a5-0000-4000-8000-00000000000d', 'inactive') $$, '%FORBIDDEN%',
  'admin não altera o próprio status');
select throws_like($$ select public.admin_set_user_status('a5a5a5a5-0000-4000-8000-00000000000a', 'root') $$, '%INVALID_STATUS%',
  'status fora da lista é recusado');
select throws_ok($$ update public.profiles set role = 'moderator' where id = 'a5a5a5a5-0000-4000-8000-00000000000a' $$, '42501', null,
  'nem o admin muda papéis pela API (só no banco, pela coordenação)');
select is((select count(*)::int from public.safety_contacts), 0, 'admin não lê contatos de segurança de outros');

select * from finish();
rollback;
