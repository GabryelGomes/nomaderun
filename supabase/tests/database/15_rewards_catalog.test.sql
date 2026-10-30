-- T7.1.23 (D-64/D-65) — catálogo de cosméticos e medalhas: esquema, RLS (quem lê e quem escreve), equipar só o que
-- possui, medalha idempotente que só sobe de nível.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select is((select array_agg(t order by t) from unnest(array['cosmetic_defs', 'user_cosmetics', 'user_equipped', 'medal_defs', 'user_medals']) t
            where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)), null,
  'RLS nas 5 tabelas de recompensas');
select is((select array_agg(t order by t) from unnest(array['cosmetic_defs', 'user_cosmetics', 'user_equipped', 'medal_defs', 'user_medals']) t
            where has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'insert')
               or has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'update')
               or has_table_privilege('authenticated', ('public.' || t)::regclass, 'delete')
               or has_table_privilege('anon', ('public.' || t)::regclass, 'select')), null,
  'cliente não escreve em cosméticos e medalhas; anon não lê');
select is((select count(*)::int from public.cosmetic_defs), 34, 'catálogo: 34 cosméticos (10 rastros, 16 molduras, 6 efeitos, título, emblema)');
select is((select count(*)::int from public.cosmetic_defs where in_chest_pool), 7, 'catálogo: 7 cosméticos podem sair no baú do dia');
select is((select count(*)::int from public.medal_defs), 12, 'catálogo: 12 medalhas (E4 §6)');
select ok(not has_function_privilege('authenticated', 'private.award_medal(uuid, text, text, text, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'private.grant_cosmetic(uuid, text, text, text)', 'execute'),
  'award_medal e grant_cosmetic fora do alcance do cliente');
select ok(not has_function_privilege('anon', 'public.equip_cosmetic(text, text)', 'execute'), 'anon não equipa');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0015-4000-8000-00000000000a', 'authenticated', 'authenticated', 'c15a@t.com',
   '{"username": "c15_a", "birthdate": "1995-01-01", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0015-4000-8000-00000000000b', 'authenticated', 'authenticated', 'c15b@t.com',
   '{"username": "c15_b", "birthdate": "1995-01-01", "terms_accepted": true}');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ---------------------------------------------------------------------------
-- Cosméticos
-- ---------------------------------------------------------------------------
select is(private.grant_cosmetic('e9e9e9e9-0015-4000-8000-00000000000a', 'rastro-aurora', '', 'teste'), true, 'grant_cosmetic dá o item');
select is(private.grant_cosmetic('e9e9e9e9-0015-4000-8000-00000000000a', 'rastro-aurora', '', 'teste'), false, 'grant_cosmetic repetido não duplica');
select private.grant_cosmetic('e9e9e9e9-0015-4000-8000-00000000000a', 'emblema-temporada', '2026-10', 'track:2026-10:1');

select pg_temp.login('e9e9e9e9-0015-4000-8000-00000000000a');
select is(public.equip_cosmetic('rastro-aurora') ->> 'slot', 'trail', 'equipa um rastro que possui');
select throws_like($$ select public.equip_cosmetic('rastro-neon') $$, '%COSMETIC_NOT_OWNED%', 'não equipa o que não possui');
select throws_like($$ select public.equip_cosmetic('emblema-temporada', '2026-09') $$, '%COSMETIC_NOT_OWNED%',
  'não equipa a variante de outra temporada');
select is(public.equip_cosmetic('emblema-temporada', '2026-10') ->> 'variant', '2026-10', 'equipa o emblema do mês certo');
select throws_ok($$ insert into public.user_cosmetics (user_id, cosmetic_id, source)
                    values ('e9e9e9e9-0015-4000-8000-00000000000a', 'rastro-neon', 'falso') $$, '42501', null,
  'cliente não se dá cosmético');
select throws_ok($$ insert into public.user_equipped (user_id, slot, cosmetic_id)
                    values ('e9e9e9e9-0015-4000-8000-00000000000a', 'frame', 'moldura-nomade') $$, '42501', null,
  'cliente não grava o equipado direto');
select throws_like($$ select public.unequip_cosmetic('chapeu') $$, '%INVALID_SLOT%', 'slot inválido recusado');
select is(public.unequip_cosmetic('emblem') ->> 'slot', 'emblem', 'desequipa');
select is((select count(*)::int from public.user_equipped where user_id = 'e9e9e9e9-0015-4000-8000-00000000000a'), 1,
  'sobrou só o rastro equipado');

select pg_temp.login('e9e9e9e9-0015-4000-8000-00000000000b');
select is((select cosmetic_id from public.user_equipped where user_id = 'e9e9e9e9-0015-4000-8000-00000000000a'), 'rastro-aurora',
  'o que a pessoa equipou é público');
select is((select count(*)::int from public.user_cosmetics), 0, 'a coleção é privada');
reset role;

-- ---------------------------------------------------------------------------
-- Medalhas: idempotente e só sobe de nível
-- ---------------------------------------------------------------------------
select is(private.award_medal('e9e9e9e9-0015-4000-8000-00000000000a', 'chefao', 'bronze', 'mormaco', null) ->> 'tier', 'bronze',
  'award_medal dá a medalha');
select is(private.award_medal('e9e9e9e9-0015-4000-8000-00000000000a', 'chefao', 'bronze', 'mormaco', null), null,
  'award_medal repetido não muda nada');
select is(private.award_medal('e9e9e9e9-0015-4000-8000-00000000000a', 'chefao', 'ouro', 'mormaco', null) ->> 'previousTier', 'bronze',
  'award_medal sobe de bronze para ouro');
select is(private.award_medal('e9e9e9e9-0015-4000-8000-00000000000a', 'chefao', 'prata', 'mormaco', null), null,
  'nível menor nunca rebaixa');
select throws_like($$ select private.award_medal('e9e9e9e9-0015-4000-8000-00000000000a', 'chefao', 'diamante', '', null) $$,
  '%INVALID_TIER%', 'nível inválido recusado');

select pg_temp.login('e9e9e9e9-0015-4000-8000-00000000000a');
select results_eq($$ select medal_id, period, tier from public.user_medals $$,
  $$ values ('chefao'::text, 'mormaco'::text, 'ouro'::text) $$, 'a pessoa lê a própria estante');
reset role;

select * from finish();
rollback;
