-- DF06 — marca de corrida simulada no servidor: coluna com padrão false, só o service_role liga, só na corrida do dono.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0036-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       's36' || c || '@t.com', json_build_object('username', 's36_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b']) c;
insert into public.activities (id, user_id, status, started_at)
values ('e9e9e9e9-1036-4000-8000-000000000001', 'e9e9e9e9-0036-4000-8000-00000000000a', 'recording', now());

select is((select simulated from public.activities where id = 'e9e9e9e9-1036-4000-8000-000000000001'), false, 'corrida nasce como não simulada');
select ok(not has_function_privilege('authenticated', 'public.svc_mark_simulated(uuid, uuid)', 'execute'), 'o app não chama direto (só o ingest-points)');
select is(public.svc_mark_simulated('e9e9e9e9-0036-4000-8000-00000000000b', 'e9e9e9e9-1036-4000-8000-000000000001'), false, 'outra conta não marca');
select is(public.svc_mark_simulated('e9e9e9e9-0036-4000-8000-00000000000a', 'e9e9e9e9-1036-4000-8000-000000000001'), true, 'o dono marca');
select is(public.svc_mark_simulated('e9e9e9e9-0036-4000-8000-00000000000a', 'e9e9e9e9-1036-4000-8000-000000000001'), false, 'marcar de novo não muda nada');
select is((select simulated from public.activities where id = 'e9e9e9e9-1036-4000-8000-000000000001'), true, 'a marca ficou gravada');

select * from finish();
rollback;
