-- Revisão da lógica v2 (revisor-onda4-logica.md): cada caso reproduz a falha apontada e confere a correção.
-- A1 (D-87) buraco da pintura · M1 teto e aviso dos aplausos · M2 corrida da telemetria (2 sessões, dblink) ·
-- M3 rota do feed depois de criar zona · M4 Realtime dos aplausos · M5 conquista de terceiro time · B4 liga.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(27);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0029-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'v29' || c || '@t.com', json_build_object('username', 'v29_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c', 'd']) c;
update public.profiles set faction = 'striders' where id::text like 'e9e9e9e9-0029-%';

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.geo(lat double precision, lng double precision) returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
$$;

-- ---------------------------------------------------------------------------
-- M2 (primeiro: as sessões extras não podem esperar travas desta transação): corrida entre track_events e set_telemetry_consent (2 sessões de verdade)
-- ---------------------------------------------------------------------------
create temp table cs as select format('dbname=%s port=%s host=%s user=%s', current_database(), current_setting('port'),
                                      split_part(current_setting('unix_socket_directories'), ',', 1), current_user) as s;
select dblink_connect('m2a', (select s from cs));
select dblink_connect('m2b', (select s from cs));
select dblink_exec('m2a', $q$insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', 'e9e9e9e9-0029-4000-8000-0000000000d2', 'authenticated', 'authenticated',
          'v29m2@t.com', '{"username": "v29_m2", "birthdate": "1995-01-01", "terms_accepted": true}')$q$);
select dblink_exec('m2a', $q$update public.game_config set value = value || '{"telemetry": true}' where key = 'features'$q$);
select dblink_exec('m2a', $q$insert into public.telemetry_consent (user_id, opted_in) values ('e9e9e9e9-0029-4000-8000-0000000000d2', true)$q$);
select x from unnest(array['m2a', 'm2b']) c,
  dblink(c, $q$select set_config('request.jwt.claims', '{"sub": "e9e9e9e9-0029-4000-8000-0000000000d2", "role": "authenticated"}', false)$q$) as t(x text);
-- sessão A: envio aberto (sem commit)
select dblink_exec('m2a', 'begin');
select x from dblink('m2a', $q$select public.track_events('[{"event": "run_finish"}, {"event": "share"}]')::text$q$) as t(x text);
-- sessão B: desliga o consentimento no meio do envio
select dblink_send_query('m2b', 'select public.set_telemetry_consent(false)::text');
select pg_sleep(0.5);
select is(dblink_is_busy('m2b'), 1, 'desligar espera o envio em andamento terminar (mesma trava)');
select dblink_exec('m2a', 'commit');
select is((select r from dblink_get_result('m2b') as t(r text))::jsonb ->> 'deletedEvents', '2',
  'o envio terminou primeiro e os 2 eventos foram apagados junto com o consentimento');
select * from dblink_get_result('m2b') as t(r text);
select is((select n from dblink('m2a', $q$select count(*)::int from public.telemetry_events
                                         where user_id = 'e9e9e9e9-0029-4000-8000-0000000000d2'$q$) as t(n int)), 0,
  'depois: nenhum evento sobrou (antes: 2 sobravam)');
-- limpeza das linhas confirmadas pelas sessões
select dblink_exec('m2a', $q$delete from auth.users where id = 'e9e9e9e9-0029-4000-8000-0000000000d2'$q$);
select dblink_exec('m2a', $q$update public.game_config set value = value || '{"telemetry": false}' where key = 'features'$q$);
select dblink_disconnect('m2a');
select dblink_disconnect('m2b');

-- ---------------------------------------------------------------------------
-- A1 (D-87): o ataque do revisor — pedir o retrato em volta da área e tirar a média do que falta
-- ---------------------------------------------------------------------------
insert into public.privacy_zones (id, user_id, label, lat, lng, radius_m)
values ('e9e9e9e9-4029-4000-8000-000000000001', 'e9e9e9e9-0029-4000-8000-00000000000d', 'Casa', -23.5521, -46.6312, 200);
-- grade de "trechos" a cada ~20 m num disco de 1.500 m em volta de (-23,5505; -46,6333)
create temp table grid as
select -23.5505 + i * 0.00018 as lat, -46.6333 + j * 0.000196 as lng
  from generate_series(-75, 75) i, generate_series(-75, 75) j
 where (i * i + j * j) <= 75 * 75;
create temp table hole_old as
select avg(lat) as lat, avg(lng) as lng from grid
 where extensions.st_dwithin(pg_temp.geo(lat, lng), pg_temp.geo(-23.5521, -46.6312), 200);
create temp table hole_new as
select avg(lat) as lat, avg(lng) as lng, count(*) as n from grid where private.cell_in_privacy_zone(lat, lng);

select cmp_ok((select extensions.st_distance(pg_temp.geo(h.lat, h.lng), pg_temp.geo(-23.5521, -46.6312)) from hole_old h), '<', 10::double precision,
  'antes (círculo exato): o centro do buraco entrega a casa com menos de 10 m de erro');
select cmp_ok((select extensions.st_distance(pg_temp.geo(h.lat, h.lng), pg_temp.geo(-23.5521, -46.6312)) from hole_new h), '>', 100::double precision,
  'depois (máscara): o centro do buraco fica a mais de 0,5 × raio da casa');
select is((select count(*)::int from grid g
            where extensions.st_dwithin(pg_temp.geo(g.lat, g.lng), pg_temp.geo(-23.5521, -46.6312), 200)
              and not private.cell_in_privacy_zone(g.lat, g.lng)), 0,
  'a máscara cobre a zona inteira (nenhum ponto da zona fica visível)');
create temp table mask1 as select * from private.privacy_zone_masks where zone_id = 'e9e9e9e9-4029-4000-8000-000000000001';
select ok((select m.offset_frac between 0.6 and 1 and m.margin_m between 25 and 85
                  and abs(m.radius_m - (200 * (1 + m.offset_frac) + m.margin_m)) < 0.01 from mask1 m),
  'máscara: deslocamento de 0,6 a 1 × raio, folga de 25 a 85 m, raio que cobre a zona');
select is((select count(*)::int from grid g where private.cell_in_privacy_zone(g.lat, g.lng)), (select n::int from hole_new),
  'estável: o mesmo retrato a cada chamada (nada para tirar a média)');
update public.privacy_zones set label = 'Lar' where id = 'e9e9e9e9-4029-4000-8000-000000000001';
select is((select row(m.lat, m.lng, m.radius_m)::text from private.privacy_zone_masks m where m.zone_id = 'e9e9e9e9-4029-4000-8000-000000000001'),
  (select row(m.lat, m.lng, m.radius_m)::text from mask1 m), 'mudar só o rótulo não sorteia de novo');
update public.privacy_zones set lat = -23.5531 where id = 'e9e9e9e9-4029-4000-8000-000000000001';
select ok((select n.offset_frac = o.offset_frac and n.azimuth = o.azimuth and n.margin_m = o.margin_m and n.lat < o.lat
             from private.privacy_zone_masks n, mask1 o where n.zone_id = 'e9e9e9e9-4029-4000-8000-000000000001'),
  'mover a zona move a máscara junto, com o MESMO sorteio (não dá para cruzar dois sorteios)');
update public.privacy_zones set lat = -23.5521 where id = 'e9e9e9e9-4029-4000-8000-000000000001';
select ok(not has_table_privilege('authenticated', 'private.privacy_zone_masks', 'select')
          and not has_table_privilege('anon', 'private.privacy_zone_masks', 'select'), 'a máscara não sai do banco');
select ok((select prosrc ~ 'cell_in_privacy_zone\(c\.lat, c\.lng\).*cell_in_privacy_zone\(c\.lat, c\.lng\)'
             from pg_proc where oid = 'public.zone_paint_near(double precision, double precision, integer)'::regprocedure),
  'zone_paint_near usa a máscara em cells e em paintedToday');
-- percurso visto pela staff: um ponto fora da zona mas dentro da máscara também some
select ok(private.in_privacy_zone('e9e9e9e9-0029-4000-8000-00000000000d',
            extensions.st_y(extensions.st_project(pg_temp.geo(-23.5521, -46.6312), 210, (select azimuth from mask1))::extensions.geometry),
            extensions.st_x(extensions.st_project(pg_temp.geo(-23.5521, -46.6312), 210, (select azimuth from mask1))::extensions.geometry)),
  'in_privacy_zone (percurso para a staff) também usa a máscara');

-- ---------------------------------------------------------------------------
-- M1: teto de aplausos e aviso ao autor
-- ---------------------------------------------------------------------------
update public.game_config set value = value || '{"feed": true, "telemetry": true}' where key = 'features';
insert into public.crews (name, tag, leader_id) values ('Crew Rev', 'REVW', 'e9e9e9e9-0029-4000-8000-00000000000a');
insert into public.crew_members (crew_id, user_id) select id, 'e9e9e9e9-0029-4000-8000-00000000000b' from public.crews where tag = 'REVW';
insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, moving_seconds, scored)
select ('e9e9e9e9-1029-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'e9e9e9e9-0029-4000-8000-00000000000a', 'valid',
       now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours', 3000, 1000, true
  from generate_series(1, 202) n;
insert into public.feed_items (id, activity_id, user_id, crew_id, day, meters, moving_seconds, route)
select ('e9e9e9e9-2029-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('e9e9e9e9-1029-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'e9e9e9e9-0029-4000-8000-00000000000a', (select id from public.crews where tag = 'REVW'), public.br_today(), 3000, 1000,
       array['_p~iF~ps|U']
  from generate_series(1, 202) n;

select pg_temp.login('e9e9e9e9-0029-4000-8000-00000000000b');
select count(*) from generate_series(1, 50) n,
  lateral (select public.react_feed_item('e9e9e9e9-2029-4000-8000-000000000202', case when n % 2 = 1 then 'bora' end)) x;
reset role;
update public.notifications set read_at = now() where user_id = 'e9e9e9e9-0029-4000-8000-00000000000a' and type = 'kudos';
select pg_temp.login('e9e9e9e9-0029-4000-8000-00000000000b');
select count(*) from generate_series(1, 20) n,
  lateral (select public.react_feed_item('e9e9e9e9-2029-4000-8000-000000000202', case when n % 2 = 1 then 'fogo' end)) x;
reset role;
select results_eq($$ select count(*)::int, max(body), bool_and(read_at is not null) from public.notifications
                     where user_id = 'e9e9e9e9-0029-4000-8000-00000000000a' and type = 'kudos' $$,
  $$ values (1, 'Sua corrida ganhou 1 reação da crew.'::text, true) $$,
  'aplaudir e desfazer 35 vezes: 1 aviso, no singular, e continua lido (não reabre)');
-- 200 itens aplaudidos e desfeitos no dia: o 201º item bate no teto (antes: desfazer liberava o teto)
select pg_temp.login('e9e9e9e9-0029-4000-8000-00000000000b');
do $$
begin
  for n in 1..199 loop
    perform public.react_feed_item(('e9e9e9e9-2029-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'bora');
    perform public.react_feed_item(('e9e9e9e9-2029-4000-8000-' || lpad(n::text, 12, '0'))::uuid, null);
  end loop;
end $$;
select is((select count(*)::int from public.kudos where user_id = 'e9e9e9e9-0029-4000-8000-00000000000b'), 0, 'todos desfeitos');
select throws_like($$ select public.react_feed_item('e9e9e9e9-2029-4000-8000-000000000200', 'bora') $$, '%KUDOS_LIMIT%',
  'desfazer não libera o teto: o 201º item do dia é recusado');
select lives_ok($$ select public.react_feed_item('e9e9e9e9-2029-4000-8000-000000000001', 'raio') $$,
  'refazer num item já aplaudido hoje continua valendo');
reset role;
select is(array[private.kudos_text(1), private.kudos_text(2)],
  array['Sua corrida ganhou 1 reação da crew.', 'Sua corrida ganhou 2 reações da crew.'], 'singular e plural');

-- ---------------------------------------------------------------------------
-- M4: Realtime dos aplausos sem dado pessoal
-- ---------------------------------------------------------------------------
select ok(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'kudos')
          and exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'feed_kudos_counts'),
  'kudos fora do Realtime; feed_kudos_counts dentro');
select is((select array_agg(column_name::text order by column_name) from information_schema.columns
            where table_schema = 'public' and table_name = 'feed_kudos_counts'),
  array['bora', 'feed_item_id', 'fogo', 'raio', 'total'], 'feed_kudos_counts: só contadores (sem user_id, sem horário)');
select results_eq($$ select bora, fogo, raio, total from public.feed_kudos_counts
                     where feed_item_id in ('e9e9e9e9-2029-4000-8000-000000000001', 'e9e9e9e9-2029-4000-8000-000000000002')
                     order by feed_item_id $$,
  $$ values (0, 0, 1, 1), (0, 0, 0, 0) $$, 'contadores acompanham aplaudir, trocar e desfazer');
select pg_temp.login('e9e9e9e9-0029-4000-8000-00000000000c');
select is((select count(*)::int from public.feed_kudos_counts), 0, 'quem está fora da crew não vê os contadores (RLS)');
reset role;
select pg_temp.login('e9e9e9e9-0029-4000-8000-00000000000b');
select ok((select count(*) > 0 from public.feed_kudos_counts), 'a crew vê os contadores');
reset role;

-- ---------------------------------------------------------------------------
-- M3: criar zona de privacidade tira as rotas já publicadas
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.feed_items where user_id = 'e9e9e9e9-0029-4000-8000-00000000000a' and route is not null), 202,
  'antes: as rotas de A estão no feed');
insert into public.privacy_zones (user_id, lat, lng, radius_m) values ('e9e9e9e9-0029-4000-8000-00000000000a', -16.70, -49.26, 200);
select results_eq($$ select count(*) filter (where route is not null)::int, bool_and(route_hidden) from public.feed_items
                     where user_id = 'e9e9e9e9-0029-4000-8000-00000000000a' $$,
  $$ values (0, true) $$, 'depois de criar a zona: nenhuma rota de A no feed (o item fica, sem mapa)');

-- ---------------------------------------------------------------------------
-- M5: zona que foi para um terceiro time não é conquista da pessoa
-- ---------------------------------------------------------------------------
insert into public.zones (id, geom) values
  ('89a90128e0fffff', extensions.st_makeenvelope(0, 0, 1, 1, 4326)),
  ('89a90128e3bffff', extensions.st_makeenvelope(1, 1, 2, 2, 4326))
on conflict (id) do nothing;
insert into public.zone_events (zone_id, type, faction, from_faction, user_id) values
  ('89a90128e0fffff', 'captured', 'volt', 'owls', 'e9e9e9e9-0029-4000-8000-00000000000c'),      -- terceiro time
  ('89a90128e3bffff', 'captured', 'striders', 'owls', 'e9e9e9e9-0029-4000-8000-00000000000c');  -- o time dela
select is((private.weekly_recap('e9e9e9e9-0029-4000-8000-00000000000c', date_trunc('week', public.br_today())::date) ->> 'zones')::int, 1,
  'Minha semana: só a zona que ficou com o time da pessoa conta');

-- ---------------------------------------------------------------------------
-- B4: liga até o fechamento da semana anterior
-- ---------------------------------------------------------------------------
select ok((select prosrc ~ 'now\(\) < private\.league_closes_at\(v_week - 7\)' from pg_proc where oid = 'public.league_current()'::regprocedure),
  'league_current mostra a semana anterior enquanto ela não fechou (segunda antes das 03:20)');

select * from finish();
rollback;
