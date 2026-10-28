-- T7.3.8 (onda 3) — zone_paint_near.paintedToday (E3), my_engagement.streak.pauseAvailable (E7) e
-- notification_prefs só com booleanos (um valor como "abc" derrubava a transação de outra pessoa).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ---------------------------------------------------------------------------
-- Fixtures: A (striders), B (coyotes), C (volt) com zona de privacidade sobre o trecho …383
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e9e9e9e9-0025-4000-8000-00000000000' || c)::uuid, 'authenticated', 'authenticated',
       'p25' || c || '@t.com', json_build_object('username', 'p25_' || c, 'birthdate', '1995-01-01', 'terms_accepted', true)::jsonb
  from unnest(array['a', 'b', 'c']) c;
update public.profiles set faction = 'striders' where id = 'e9e9e9e9-0025-4000-8000-00000000000a';
update public.profiles set faction = 'coyotes' where id = 'e9e9e9e9-0025-4000-8000-00000000000b';
update public.profiles set faction = 'volt' where id = 'e9e9e9e9-0025-4000-8000-00000000000c';

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ---------------------------------------------------------------------------
-- notification_prefs: só booleanos
-- ---------------------------------------------------------------------------
select throws_ok($$ update public.profiles set notification_prefs = '{"kudos": "abc"}' where id = 'e9e9e9e9-0025-4000-8000-00000000000a' $$,
  '23514', null, 'notification_prefs recusa valor que não é booleano (achado: derrubava a transação de outra pessoa)');
select throws_ok($$ update public.profiles set notification_prefs = '{"raid": 1}' where id = 'e9e9e9e9-0025-4000-8000-00000000000a' $$,
  '23514', null, 'número também é recusado');
update public.profiles set notification_prefs = '{"invasion": true, "kudos": false, "recap": true}'
 where id = 'e9e9e9e9-0025-4000-8000-00000000000a';
select is(array[private.notify_pref('e9e9e9e9-0025-4000-8000-00000000000a', 'kudos'),
                private.notify_pref('e9e9e9e9-0025-4000-8000-00000000000a', 'recap'),
                private.notify_pref('e9e9e9e9-0025-4000-8000-00000000000a', 'chests'),
                private.notify_pref('e9e9e9e9-0025-4000-8000-00000000000f', 'kudos')],
  array[false, true, true, true], 'notify_pref: false desliga; chave ausente ou pessoa sem linha = ligada');
select is((select count(*)::int from public.profiles
            where jsonb_path_exists(notification_prefs, '$.* ? (@.type() != "boolean")')), 0,
  'nenhum perfil com preferência que não é booleana (os antigos foram limpos)');
-- o cliente continua podendo mudar as preferências (com booleanos)
select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000b');
update public.profiles set notification_prefs = '{"kudos": false, "streak": true}' where id = 'e9e9e9e9-0025-4000-8000-00000000000b';
select throws_ok($$ update public.profiles set notification_prefs = '{"streak": "sim"}' where id = 'e9e9e9e9-0025-4000-8000-00000000000b' $$,
  '23514', null, 'pelo cliente: só booleano');
reset role;
select is((select notification_prefs from public.profiles where id = 'e9e9e9e9-0025-4000-8000-00000000000b'),
  '{"kudos": false, "streak": true}'::jsonb, 'pelo cliente: preferências booleanas gravadas');

-- ---------------------------------------------------------------------------
-- zone_paint_near.paintedToday
-- ---------------------------------------------------------------------------
insert into public.zones (id, name, city, geom, owner, influence) values
  ('89a90128e3bffff', 'Zona POA 1', 'Porto Alegre', extensions.st_setsrid(extensions.st_geomfromgeojson(
    '{"type":"Polygon","coordinates":[[[-51.2173721778165,-30.036324475878015],[-51.21630560724396,-30.0350282146007],[-51.217260040920266,-30.033559365310325],[-51.21928102307092,-30.03338679177478],[-51.22034758026746,-30.034683058704122],[-51.219393168690495,-30.036151893517015],[-51.2173721778165,-30.036324475878015]]]}'), 4326),
   null, '{"striders": 0, "coyotes": 0, "owls": 0, "volt": 0}')
on conflict (id) do nothing;
insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng) values
  ('8ba90128e380fff', '89a90128e3bffff', 'striders', 1, now(), -30.034855651402665, -51.21832660540752),
  ('8ba90128e381fff', '89a90128e3bffff', 'striders', 2, now() - interval '1 day', -30.034621161960484, -51.21875166319014),
  ('8ba90128e382fff', '89a90128e3bffff', 'coyotes', 1, now(), -30.034695123668254, -51.21788552638041),
  ('8ba90128e383fff', '89a90128e3bffff', 'striders', 1, now(), -30.034460634923736, -51.21831058523841);
insert into public.privacy_zones (user_id, lat, lng, radius_m)
values ('e9e9e9e9-0025-4000-8000-00000000000c', -30.0341006, -51.21831058523841, 50); -- cobre só o trecho …383

-- D-87: a máscara é sorteada; aqui ela é fixada no círculo exato para o teste conferir trecho a trecho
update private.privacy_zone_masks m set lat = z.lat, lng = z.lng, radius_m = z.radius_m from public.privacy_zones z where m.zone_id = z.id;
insert into public.paint_marks (user_id, day, cell) values
  ('e9e9e9e9-0025-4000-8000-00000000000a', public.br_today(), '8ba90128e380fff'),
  ('e9e9e9e9-0025-4000-8000-00000000000a', public.br_today(), '8ba90128e383fff'),      -- em zona de privacidade
  ('e9e9e9e9-0025-4000-8000-00000000000a', public.br_today() - 1, '8ba90128e381fff'),  -- ontem
  ('e9e9e9e9-0025-4000-8000-00000000000a', public.br_today(), '8ba90128e999fff'),      -- trecho que já não existe
  ('e9e9e9e9-0025-4000-8000-00000000000b', public.br_today(), '8ba90128e382fff');

select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000a');
create temp table pa as select public.zone_paint_near(-30.0346, -51.2177, 1500) as s;
grant select on pa to authenticated;
select ok((select s ?& array['rule', 'cells', 'zones', 'paintedToday'] from pa), 'retrato mantém rule, cells e zones e ganha paintedToday');
select is((select s -> 'paintedToday' from pa), '["8ba90128e380fff"]'::jsonb,
  'paintedToday: só os trechos da própria pessoa hoje (sem o de ontem, sem o da zona de privacidade, sem o que sumiu)');
select is((select s -> 'paintedToday' from (select public.zone_paint_near(-15.79, -47.88, 3000) as s) x), '[]'::jsonb,
  'fora do raio: lista vazia (nunca null)');
reset role;
select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000b');
select is((select public.zone_paint_near(-30.0346, -51.2177, 1500) -> 'paintedToday'), '["8ba90128e382fff"]'::jsonb,
  'B vê só o que B pintou (nada de A)');
reset role;
select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000c');
select is((select public.zone_paint_near(-30.0346, -51.2177, 1500) -> 'paintedToday'), '[]'::jsonb, 'C não pintou nada: vazio');
reset role;
select ok((select jsonb_typeof(s -> 'paintedToday') = 'array'
                  and not exists (select 1 from jsonb_array_elements(s -> 'paintedToday') v
                                   where jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[0-9a-f]{15}$')
             from pa), 'paintedToday é só uma lista de ids de trecho (sem hora, autor ou coordenada)');

-- ---------------------------------------------------------------------------
-- my_engagement.streak.pauseAvailable
-- ---------------------------------------------------------------------------
select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000a');
select ok((select (public.my_engagement() -> 'streak') ? 'pauseAvailable'), 'streak traz a chave pauseAvailable');
select is((select public.my_engagement() #> '{streak,pauseAvailable}'), 'null'::jsonb,
  'sequência v2 desligada: null (start_health_pause responderia FEATURE_DISABLED)');
reset role;
update public.game_config set value = value || '{"streakV2": true}' where key = 'features';
select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000a');
select is((select public.my_engagement() #>> '{streak,pauseAvailable}'), 'true', 'nunca usou nesta temporada: disponível');
select public.start_health_pause(1);
select is((select public.my_engagement() #>> '{streak,pauseAvailable}'), 'false', 'pausa valendo: indisponível');
select public.end_health_pause();
reset role;
-- encerrar antes protege a semana atual; mesmo depois que a pausa acaba, a temporada já usou a dela
update public.profiles set pause_from = public.br_today() - 21, pause_until = public.br_today() - 15
 where id = 'e9e9e9e9-0025-4000-8000-00000000000a';
select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000a');
select is((select public.my_engagement() #>> '{streak,pauseAvailable}'), 'false', 'já usou nesta temporada: indisponível');
reset role;
update public.profiles set pause_used_season = '2020-01' where id = 'e9e9e9e9-0025-4000-8000-00000000000a';
select pg_temp.login('e9e9e9e9-0025-4000-8000-00000000000a');
select is((select public.my_engagement() #>> '{streak,pauseAvailable}'), 'true', 'pausa de temporada passada: disponível de novo');
reset role;

select * from finish();
rollback;
