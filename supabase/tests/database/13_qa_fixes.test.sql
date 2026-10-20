-- Fase 4 (A2) — correções dos achados do QA (docs/QA.md): QA-01 convite de crew, QA-02 ghostPace no servidor,
-- QA-04 /zones com até 2.000 zonas, QA-05 avatar_url, QA-07 conta inativa sem acesso, QA-08 limites de pontos e de
-- corridas abertas, QA-16 staff sem data de nascimento e cidade natal no cadastro.
-- Independente do estado do banco: todos os dados são criados aqui e desfeitos no rollback.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'a13a13a1-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'q1@t.com',
   '{"username": "qa_lider", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'a13a13a1-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'q2@t.com',
   '{"username": "qa_outro", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'a13a13a1-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'q3@t.com',
   '{"username": "qa_moder", "birthdate": "1990-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'a13a13a1-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'q4@t.com',
   '{"username": "qa_inativo", "birthdate": "1990-01-01", "terms_accepted": true}');
update public.profiles set faction = 'striders' where id::text like 'a13a13a1-%';
update public.profiles set role = 'moderator' where id = 'a13a13a1-0000-4000-8000-000000000003';
insert into public.notifications (user_id, type, title, body) values ('a13a13a1-0000-4000-8000-000000000004', 'system', 'Oi', 'corpo');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.affected(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- QA-01: código de convite
select pg_temp.login('a13a13a1-0000-4000-8000-000000000001');
insert into public.crews (name, tag) values ('Crew QA', 'QACR');
select isnt((select invite_code from public.crews where tag = 'QACR'), null, 'QA-01: o líder lê o código de convite da própria crew');
create temp table qa_code as select invite_code from public.crews where tag = 'QACR';
grant select on qa_code to authenticated;

select pg_temp.login('a13a13a1-0000-4000-8000-000000000002');
select is((select count(*)::int from public.crews where tag = 'QACR'), 0, 'QA-01: quem não é membro não lê a linha da crew (nem o código)');
select is((select count(*)::int from public.public_crews where tag = 'QACR'), 1, 'QA-01: a crew aparece para todos na view public_crews');
select is((select members from public.public_crews where tag = 'QACR'), 1, 'QA-01: public_crews traz a quantidade de membros');
select lives_ok($$ select public.join_crew((select invite_code from qa_code)) $$, 'QA-01: join_crew(código) continua funcionando');
select isnt((select invite_code from public.crews where tag = 'QACR'), null, 'QA-01: depois de entrar, o membro vê o código para convidar');
reset role;
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'public_crews' and column_name = 'invite_code'),
  0, 'QA-01: public_crews não tem a coluna invite_code');

-- ---------------------------------------------------------------- QA-16: staff sem data de nascimento
select pg_temp.login('a13a13a1-0000-4000-8000-000000000003');
select is((select count(*)::int from public.profiles where id <> 'a13a13a1-0000-4000-8000-000000000003'), 0,
  'QA-16: moderador não lê a tabela profiles de outros (onde fica a data de nascimento)');
select is((select username from public.staff_profiles where id = 'a13a13a1-0000-4000-8000-000000000001'), 'qa_lider',
  'QA-16: moderador lê os dados de que precisa pela view staff_profiles');
select is((select trust::int from public.staff_profiles where id = 'a13a13a1-0000-4000-8000-000000000001'), 100, 'QA-16: staff_profiles traz o índice de confiança');
select throws_ok($$ select moderator_id from public.moderation_reviews $$, '42501', null, 'QA-16: moderator_id não é legível pela API');
select pg_temp.login('a13a13a1-0000-4000-8000-000000000001');
select is((select count(*)::int from public.staff_profiles), 0, 'QA-16: corredor comum não lê staff_profiles');
select is((select birthdate from public.profiles where id = 'a13a13a1-0000-4000-8000-000000000001'), '1995-01-01'::date, 'QA-16: o dono continua lendo o próprio perfil completo');
reset role;
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'staff_profiles'
             and column_name in ('birthdate', 'terms_accepted_at', 'privacy_accepted_at', 'notification_prefs')), 0,
  'QA-16: staff_profiles sem nascimento, aceites ou preferências');

-- ---------------------------------------------------------------- QA-05: avatar_url
select pg_temp.login('a13a13a1-0000-4000-8000-000000000001');
select throws_ok($$ update public.profiles set avatar_url = 'javascript:alert(1)' where id = 'a13a13a1-0000-4000-8000-000000000001' $$,
  '23514', null, 'QA-05: avatar_url recusa outro esquema');
select throws_ok($$ update public.profiles set avatar_url = 'https://rastreio.example.com/pixel.gif' where id = 'a13a13a1-0000-4000-8000-000000000001' $$,
  '23514', null, 'QA-05: avatar_url recusa outro host');
select throws_ok($$ update public.profiles set avatar_url = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/a13a13a1-0000-4000-8000-000000000002/a.png'
                    where id = 'a13a13a1-0000-4000-8000-000000000001' $$,
  '23514', null, 'QA-05: avatar_url recusa a pasta de outro usuário');
select throws_ok($$ update public.profiles set avatar_url = 'http://127.0.0.1:54321/storage/v1/object/public/outro/a13a13a1-0000-4000-8000-000000000001/a.png'
                    where id = 'a13a13a1-0000-4000-8000-000000000001' $$,
  '23514', null, 'QA-05: avatar_url recusa outro bucket');
select lives_ok($$ update public.profiles set avatar_url = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/a13a13a1-0000-4000-8000-000000000001/avatar-1760000000000.jpg'
                   where id = 'a13a13a1-0000-4000-8000-000000000001' $$, 'QA-05: aceita a URL pública do bucket avatars na pasta do próprio usuário (local)');
select lives_ok($$ update public.profiles set avatar_url = 'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/a13a13a1-0000-4000-8000-000000000001/a.webp'
                   where id = 'a13a13a1-0000-4000-8000-000000000001' $$, 'QA-05: aceita a URL pública no Supabase Cloud');
select lives_ok($$ update public.profiles set avatar_url = null where id = 'a13a13a1-0000-4000-8000-000000000001' $$, 'QA-05: remover a foto (null) continua possível');
select throws_ok($$ update public.profiles set notification_prefs = jsonb_build_object('x', repeat('a', 600)) where id = 'a13a13a1-0000-4000-8000-000000000001' $$,
  '23514', null, 'QA-05: notification_prefs com tamanho limitado');

-- ---------------------------------------------------------------- QA-07: conta inativa
reset role;
update public.profiles set status = 'inactive' where id = 'a13a13a1-0000-4000-8000-000000000004';
select pg_temp.login('a13a13a1-0000-4000-8000-000000000004');
select is((select count(*)::int from public.notifications), 0, 'QA-07: conta inativa não lê as próprias notificações');
select is((select count(*)::int from public.profiles), 0, 'QA-07: conta inativa não lê o próprio perfil');
select is(pg_temp.affected($q$update public.profiles set city = 'Burla' where id = 'a13a13a1-0000-4000-8000-000000000004'$q$), 0,
  'QA-07: conta inativa não altera o perfil');
select throws_ok($$ insert into public.safety_contacts (name, phone) values ('X', '+5562999990000') $$, '42501', null,
  'QA-07: conta inativa não grava contatos');
select throws_like($$ select public.choose_faction('owls') $$, '%ACCOUNT_INACTIVE%', 'QA-07: conta inativa não usa as RPCs');
select throws_like($$ select public.check_request() $$, '%ACCOUNT_INACTIVE%', 'QA-07: o pre-request do PostgREST recusa a conta inativa');
select pg_temp.login('a13a13a1-0000-4000-8000-000000000001');
select lives_ok($$ select public.check_request() $$, 'QA-07: o pre-request deixa passar a conta ativa');
reset role;
update public.profiles set status = 'suspended', suspended_until = now() + interval '30 days' where id = 'a13a13a1-0000-4000-8000-000000000004';
select pg_temp.login('a13a13a1-0000-4000-8000-000000000004');
select is((select count(*)::int from public.notifications), 1, 'QA-07: suspensão de competição (RN-009) não tira o acesso aos próprios dados');
reset role;
select is((select setconfig::text like '%pgrst.db_pre_request=public.check_request%' from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
            where r.rolname = 'authenticator'), true, 'QA-07: PostgREST configurado com db_pre_request');

-- ---------------------------------------------------------------- QA-02 / QA-08: ingestão no servidor
insert into public.devices (id, user_id, secret, platform)
  values ('a13a13a1-1111-4000-8000-000000000001', 'a13a13a1-0000-4000-8000-000000000002', extensions.gen_random_bytes(32), 'ios');
create function pg_temp.ingest(p_act uuid, p_from int, p_n int, p_extra jsonb default '{}') returns jsonb language sql as $$
  select public.svc_ingest_points(jsonb_build_object(
    'userId', 'a13a13a1-0000-4000-8000-000000000002', 'activityId', p_act, 'deviceId', 'a13a13a1-1111-4000-8000-000000000001',
    'fromSeq', p_from, 'toSeq', p_from + p_n - 1,
    'points', (select jsonb_agg(jsonb_build_object('seq', p_from + i, 'lat', -10.0, 'lng', -50.0 + i * 0.00002, 't', 1760000000000 + (p_from + i) * 1000))
                 from generate_series(0, p_n - 1) i)) || p_extra)
$$;
select pg_temp.ingest('a13a13a1-2222-4000-8000-000000000001', 0, 2, '{"mission": "livre", "ghostPace": 330}');
select is((select ghost_pace from public.activities where id = 'a13a13a1-2222-4000-8000-000000000001'), null::real,
  'QA-02: ghostPace não é gravado fora da missão fuga');
select pg_temp.ingest('a13a13a1-2222-4000-8000-000000000002', 0, 2, '{"mission": "fuga", "ghostPace": 330}');
select is((select ghost_pace from public.activities where id = 'a13a13a1-2222-4000-8000-000000000002'), 330::real,
  'QA-02: ghostPace gravado na missão fuga');
select pg_temp.ingest('a13a13a1-2222-4000-8000-000000000003', 0, 2, '{"mission": "fuga", "ghostPace": 3600}');
select is((select ghost_pace from public.activities where id = 'a13a13a1-2222-4000-8000-000000000003'), null::real,
  'QA-02: ghostPace fora de 150–900 s/km não é gravado');

select is(pg_temp.ingest('a13a13a1-2222-4000-8000-000000000004', 0, 2) ->> 'error', 'TOO_MANY_OPEN_RUNS',
  'QA-08: a 4ª corrida aberta ao mesmo tempo é recusada');
select is((pg_temp.ingest('a13a13a1-2222-4000-8000-000000000001', 2, 1) ->> 'accepted')::int, 1,
  'QA-08: corrida já aberta continua recebendo pontos');
update public.activities set created_at = now() - interval '25 hours' where id = 'a13a13a1-2222-4000-8000-000000000003';
select is((pg_temp.ingest('a13a13a1-2222-4000-8000-000000000004', 0, 2) ->> 'accepted')::int, 2,
  'QA-08: corrida aberta há mais de 24 h (abandonada) não conta no limite');

update public.activities set last_seq = 14398 where id = 'a13a13a1-2222-4000-8000-000000000004';
select is(pg_temp.ingest('a13a13a1-2222-4000-8000-000000000004', 14399, 2) ->> 'error', 'POINTS_LIMIT',
  'QA-08: lote que passa de 14.400 pontos por corrida é recusado');
select is((pg_temp.ingest('a13a13a1-2222-4000-8000-000000000004', 14399, 1) ->> 'lastSeq')::int, 14399,
  'QA-08: o ponto de número 14.400 (seq 14399) ainda é aceito');

-- ---------------------------------------------------------------- QA-04: /zones com até 2.000 zonas
insert into public.zones (id, geom)
select 'f' || lpad(to_hex(i), 14, '0'),
       extensions.st_setsrid(extensions.st_makepolygon(extensions.st_makeline(array[
         extensions.st_makepoint(100 + (i % 50) * 0.001, 60 + (i / 50) * 0.001), extensions.st_makepoint(100.0005 + (i % 50) * 0.001, 60 + (i / 50) * 0.001),
         extensions.st_makepoint(100.0005 + (i % 50) * 0.001, 60.0005 + (i / 50) * 0.001), extensions.st_makepoint(100 + (i % 50) * 0.001, 60 + (i / 50) * 0.001)])), 4326)
  from generate_series(1, 2100) i;
select is(jsonb_array_length(public.zones_in_bbox_json(99.9, 59.9, 100.9, 60.9)), 2000,
  'QA-04: zones_in_bbox_json devolve 2.000 zonas num único JSON (não sofre o max_rows)');
select ok((public.zones_in_bbox_json(99.9, 59.9, 100.9, 60.9) -> 0) ?& array['id', 'name', 'city', 'owner', 'influence', 'shield', 'attacker', 'attack_started_at', 'blocked'],
  'QA-04: mesmos campos de zones_in_bbox');

-- ---------------------------------------------------------------- Cidade natal no cadastro
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'a13a13a1-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'q5@t.com',
   '{"username": "qa_cidade", "birthdate": "1995-01-01", "terms_accepted": true, "city": "  Anápolis  "}');
select is((select city from public.profiles where id = 'a13a13a1-0000-4000-8000-000000000005'), 'Anápolis',
  'cadastro grava a cidade natal enviada nos metadados (sem espaços nas pontas)');
select throws_like($$ insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'a13a13a1-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'q6@t.com',
   '{"username": "qa_cidade2", "birthdate": "1995-01-01", "terms_accepted": true, "city": "X"}') $$,
  '%CITY_INVALID%', 'cidade natal fora de 2–80 caracteres é recusada com código próprio');

select * from finish();
rollback;
