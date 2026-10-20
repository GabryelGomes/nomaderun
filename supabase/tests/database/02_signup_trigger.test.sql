-- T1.3 — RF-001: perfil criado no cadastro; recusa < 16 anos e cadastro sem aceite dos termos
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.new_user(p_email text, p_meta jsonb) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email, p_meta, '{}'::jsonb);
  return v;
end $$;

select throws_like(
  $$ select pg_temp.new_user('jovem@t.com', jsonb_build_object('username', 'jovem', 'birthdate', (current_date - interval '15 years')::date, 'terms_accepted', true)) $$,
  '%AGE_UNDER_16%', 'recusa quem tem menos de 16 anos');

select throws_like(
  $$ select pg_temp.new_user('semtermos@t.com', '{"username": "semtermos", "birthdate": "2000-01-01", "terms_accepted": false}') $$,
  '%TERMS_REQUIRED%', 'recusa cadastro sem aceite dos termos');

select throws_like(
  $$ select pg_temp.new_user('semprivacidade@t.com', '{"username": "semprivacidade", "birthdate": "2000-01-01", "terms_accepted": true, "privacy_accepted": false}') $$,
  '%TERMS_REQUIRED%', 'recusa cadastro sem aceite da política de privacidade');

select throws_like(
  $$ select pg_temp.new_user('semdata@t.com', '{"username": "semdata", "terms_accepted": true}') $$,
  '%BIRTHDATE_REQUIRED%', 'exige data de nascimento');

select throws_like(
  $$ select pg_temp.new_user('nome@t.com', '{"username": "ab", "birthdate": "2000-01-01", "terms_accepted": true}') $$,
  '%USERNAME_INVALID%', 'nome de usuário com menos de 3 caracteres é recusado');

select lives_ok(
  $$ select pg_temp.new_user('ok@t.com', jsonb_build_object('username', 'Ana_Corre', 'birthdate', (current_date - interval '16 years')::date, 'terms_accepted', true, 'privacy_accepted', true, 'city', 'Goiânia')) $$,
  'aceita quem completa 16 anos hoje, com termos aceitos');

select results_eq(
  $$ select username, role, status, trust::int, xp, units, city from public.profiles where username = 'Ana_Corre' $$,
  $$ values ('Ana_Corre'::text, 'runner'::text, 'active'::text, 100, 0, 'km'::text, 'Goiânia'::text) $$,
  'perfil nasce como runner, ativo, trust 100, xp 0, km');

select throws_like(
  $$ select pg_temp.new_user('dup@t.com', '{"username": "ana_corre", "birthdate": "2000-01-01", "terms_accepted": true}') $$,
  '%USERNAME_TAKEN%', 'nome de usuário único sem diferenciar maiúsculas');

select is(public.username_available('ana_corre'), false, 'username_available: nome em uso');
select is(public.username_available('novo_nome'), true, 'username_available: nome livre');

select * from finish();
rollback;
