-- T1.3 — RF-024 (≤ 5 contatos), RF-003 (facção 1×/temporada), RN-011/RF-011 (crew da mesma facção, máx. 30)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- 32 corredores striders + 1 coyote
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('55555555-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'authenticated', 'authenticated',
       'c' || i || '@t.com', jsonb_build_object('username', 'crew_' || i, 'birthdate', '1995-01-01', 'terms_accepted', true)
  from generate_series(1, 33) i;
update public.profiles set faction = 'striders' where username like 'crew\_%' and username <> 'crew_33';
update public.profiles set faction = 'coyotes' where username = 'crew_33';

create function pg_temp.login(n int) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', ('55555555-0000-4000-8000-' || lpad(n::text, 12, '0')), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Contatos de segurança
select pg_temp.login(1);
select lives_ok($$ insert into public.safety_contacts (name, phone) select 'Contato ' || i, '+5562999990' || lpad(i::text, 3, '0') from generate_series(1, 5) i $$,
  'cadastra 5 contatos de segurança');
select throws_like($$ insert into public.safety_contacts (name, phone) values ('Sexto', '+5562999990006') $$, '%CONTACTS_LIMIT%', 'o 6º contato é recusado (RF-024)');
select throws_ok($$ insert into public.safety_contacts (user_id, name, phone) values ('55555555-0000-4000-8000-000000000002', 'Intruso', '+5562999990007') $$,
  '42501', null, 'não cadastra contato em nome de outro usuário');

-- Crew: criação pelo líder
select lives_ok($$ insert into public.crews (name, tag) values ('Flamboyant Runners', 'flb') $$, 'cria crew (nome e sigla)');
select results_eq($$ select tag, faction, leader_id from public.crews where name = 'Flamboyant Runners' $$,
  $$ values ('FLB'::text, 'striders'::text, '55555555-0000-4000-8000-000000000001'::uuid) $$, 'sigla em maiúsculas, facção e líder vêm do criador');
select is((select role from public.crew_members where user_id = '55555555-0000-4000-8000-000000000001'), 'leader', 'criador entra como líder');
select throws_like($$ insert into public.crews (name, tag) values ('Outra Crew', 'OTR') $$, '%ALREADY_IN_CREW%', 'quem já tem crew não cria outra (RN-011)');
select throws_ok($$ insert into public.crew_members (crew_id, user_id) select id, '55555555-0000-4000-8000-000000000002' from public.crews limit 1 $$,
  '42501', null, 'entrada em crew só pela RPC join_crew');

-- Entrar por código: facção diferente é recusada; limite de 30
create temp table code as select invite_code from public.crews where tag = 'FLB';
grant select on code to authenticated;
select pg_temp.login(33);
select throws_like($$ select public.join_crew((select invite_code from code)) $$, '%CREW_FACTION_MISMATCH%', 'coyote não entra em crew dos striders (RN-011)');
select pg_temp.login(2);
select throws_like($$ select public.join_crew('XXXXXXXX') $$, '%CREW_NOT_FOUND%', 'código inválido');
select lives_ok($$ select public.join_crew(lower((select invite_code from code))) $$, 'striders entra com o código (sem diferenciar maiúsculas)');
select throws_like($$ select public.join_crew((select invite_code from code)) $$, '%ALREADY_IN_CREW%', 'não entra duas vezes');

reset role;
insert into public.crew_members (crew_id, user_id)
select c.id, ('55555555-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid from public.crews c, generate_series(3, 30) i where c.tag = 'FLB';
select is((select count(*)::int from public.crew_members cm join public.crews c on c.id = cm.crew_id where c.tag = 'FLB'), 30, 'crew com 30 membros');
select pg_temp.login(31);
select throws_like($$ select public.join_crew((select invite_code from code)) $$, '%CREW_FULL%', 'o 31º membro é recusado (RF-011)');

-- RF-003 / RN-011: troca de facção 1× por temporada e saída automática da crew
select pg_temp.login(2);
select is((public.choose_faction('owls') ->> 'faction'), 'owls', 'troca de facção aceita (1ª da temporada)');
select is((select count(*)::int from public.crew_members where user_id = '55555555-0000-4000-8000-000000000002'), 0, 'ao trocar de facção sai da crew');
select ok((select contribution_reset_at is not null from public.profiles where id = '55555555-0000-4000-8000-000000000002'),
  'contribuição pessoal da temporada zerada (RF-003)');
select throws_like($$ select public.choose_faction('volt') $$, '%FACTION_CHANGE_LIMIT%', 'segunda troca na mesma temporada é recusada');

-- Líder sai: o membro mais antigo assume
select pg_temp.login(1);
select public.leave_crew();
reset role;
select is((select leader_id from public.crews where tag = 'FLB'), '55555555-0000-4000-8000-000000000003'::uuid, 'liderança passa ao membro mais antigo');

select * from finish();
rollback;
