-- Fase 3 (A2) — P-13: notificações no Realtime com RLS; RN-010: zonas de privacidade escondem o percurso de terceiros.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '81111111-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pa@t.com',
   '{"username": "priv_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '81111111-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pb@t.com',
   '{"username": "priv_b", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', '81111111-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pm@t.com',
   '{"username": "priv_mod", "birthdate": "1990-01-01", "terms_accepted": true}');
update public.profiles set role = 'moderator' where id = '81111111-0000-4000-8000-000000000003';

-- corrida de A: 2 pontos perto de casa (-16.70, -49.20), 3 pontos a ~1 km
insert into public.activities (id, user_id, started_at, status) values
  ('a8111111-0000-4000-8000-000000000001', '81111111-0000-4000-8000-000000000001', now(), 'review');
insert into public.activity_points (activity_id, seq, lat, lng, t) values
  ('a8111111-0000-4000-8000-000000000001', 0, -16.70000, -49.20000, 1760000000000),
  ('a8111111-0000-4000-8000-000000000001', 1, -16.70100, -49.20000, 1760000001000),
  ('a8111111-0000-4000-8000-000000000001', 2, -16.71000, -49.20000, 1760000002000),
  ('a8111111-0000-4000-8000-000000000001', 3, -16.71100, -49.20000, 1760000003000),
  ('a8111111-0000-4000-8000-000000000001', 4, -16.71200, -49.20000, 1760000004000);

select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'),
  'notifications está na publicação do Realtime (P-13)');
select ok(exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_select'
                    and qual like '%auth.uid()%'), 'RLS de notifications filtra por auth.uid() (o Realtime aplica a mesma policy)');
select ok((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'privacy_zones'), 'RLS ligada em privacy_zones');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- A cadastra a casa e mais dois endereços; o quarto é recusado
select pg_temp.login('81111111-0000-4000-8000-000000000001');
select lives_ok($$ insert into public.privacy_zones (label, lat, lng) values ('Casa', -16.70, -49.20) $$, 'usuário cadastra endereço (raio padrão)');
select is((select radius_m from public.privacy_zones where label = 'Casa'), 200, 'raio padrão de 200 m (RN-010)');
select lives_ok($$ insert into public.privacy_zones (label, lat, lng, radius_m) values ('Trabalho', -16.60, -49.30, 300), ('Academia', -16.65, -49.25, 100) $$,
  'até 3 endereços');
select throws_like($$ insert into public.privacy_zones (lat, lng) values (-16.5, -49.5) $$, '%PRIVACY_ZONES_LIMIT%', 'o quarto endereço é recusado');
select throws_ok($$ update public.privacy_zones set radius_m = 5000 where label = 'Casa' $$, '23514', null, 'raio fora de 50–1000 m é recusado');
select is((select count(*)::int from public.activity_points where activity_id = 'a8111111-0000-4000-8000-000000000001'), 5,
  'o dono vê o próprio percurso inteiro');

-- B não vê os endereços nem o percurso de A
select pg_temp.login('81111111-0000-4000-8000-000000000002');
select is((select count(*)::int from public.privacy_zones), 0, 'outro usuário não lê as zonas de privacidade de A');
select throws_ok($$ insert into public.privacy_zones (user_id, lat, lng) values ('81111111-0000-4000-8000-000000000001', 0, 0) $$,
  '42501', null, 'ninguém cria zona de privacidade em nome de outro');
select is((select count(*)::int from public.activity_points where activity_id = 'a8111111-0000-4000-8000-000000000001'), 0,
  'corredor comum não lê percurso alheio');

-- moderador (painel web) vê o percurso sem os pontos perto da casa
-- D-87: a máscara é sorteada (maior que a zona); aqui fica fixada no círculo exato para conferir ponto a ponto
reset role;
update private.privacy_zone_masks m set lat = z.lat, lng = z.lng, radius_m = z.radius_m from public.privacy_zones z where m.zone_id = z.id;
select pg_temp.login('81111111-0000-4000-8000-000000000003');
select is((select count(*)::int from public.activity_points where activity_id = 'a8111111-0000-4000-8000-000000000001'), 3,
  'painel de moderação não recebe os pontos dentro da zona de privacidade (RN-010)');
select is((select array_agg(seq order by seq) from public.activity_points where activity_id = 'a8111111-0000-4000-8000-000000000001'),
  array[2, 3, 4], 'só os pontos fora do raio de 200 m aparecem');
reset role;

-- o cálculo oficial (service role) continua usando todos os pontos: dentro da zona pontua normalmente
select is(jsonb_array_length(public.svc_load_activity('a8111111-0000-4000-8000-000000000001') -> 'points'), 5,
  'svc_load_activity (cálculo e moderação) lê todos os pontos');
select is(jsonb_array_length(public.svc_account_export('81111111-0000-4000-8000-000000000001') -> 'privacyZones'), 3,
  'exportação LGPD inclui as zonas de privacidade');

select * from finish();
rollback;
