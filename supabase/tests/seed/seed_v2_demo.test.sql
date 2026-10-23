-- T7.2.2 — seed v2 de demonstração (supabase/seed_v2_demo.sql): roda 2 vezes sem erro e sem duplicar, e tudo o que
-- ele cria é de demonstração (contas is_demo, itens is_demo, zonas is_demo). Fora da pasta database/ porque depende
-- do seed: rode com
--   NR_EXTRA_SQL="supabase/seed_v2_demo.sql supabase/seed_v2_demo.sql" NR_EXTRA_TESTS=supabase/tests/seed/seed_v2_demo.test.sql \
--     npm run db:test:local
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok((select is_demo from public.profiles where id = '00000000-0000-4000-a000-0000000000d1'), 'parceira_demo é demonstração');
select is((select encrypted_password from auth.users where id = '00000000-0000-4000-a000-0000000000d1'), null,
  'parceira_demo não tem senha (não entra no app)');
select is((select count(*)::int from public.activities where id::text like '00000000-0000-4000-a000-0000000d000%'),
          (select count(*)::int from public.activities a join public.profiles p on p.id = a.user_id
            where a.id::text like '00000000-0000-4000-a000-0000000d000%' and p.is_demo), 'corridas só de contas de demonstração');
select ok((select count(*) = count(*) filter (where f.is_demo) from public.feed_items f), 'todo item do feed é demonstração');
select ok((select bool_and(p.is_demo) from public.crew_members cm join public.profiles p on p.id = cm.user_id
            join public.crews c on c.id = cm.crew_id where c.tag = 'DEMOV'), 'crew de demonstração só com contas de demonstração');
select ok((select coalesce(bool_and(p.is_demo), true) from public.kudos k join public.profiles p on p.id = k.user_id),
  'aplausos só de contas de demonstração');
select ok((select coalesce(bool_and(z.is_demo), true) from public.zone_cells c join public.zones z on z.id = c.zone_id),
  'trechos pintados só em zonas de demonstração');
select is((select count(*)::int from public.xp_ledger where ref like 'demo-%'), 5, 'livro de XP de demonstração sem duplicar (seed rodou 2 vezes)');
select is((select count(*)::int from public.zone_cells), 11, 'trechos sem duplicar');
select is((select count(*)::int from public.raids) + (select count(*)::int from public.league_members), 0,
  'sem Raid nem Liga de demonstração (D-76)');

select * from finish();
rollback;
