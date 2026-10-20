-- RN-003 — limites dos alertas de invasão: 1 por zona a cada 6 h e no máximo 5 por dia (Brasília), por usuário.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'b1111111-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'inv@t.com',
   '{"username": "inv_def", "birthdate": "1995-01-01", "terms_accepted": true}');
update public.profiles set faction = 'owls' where id = 'b1111111-0000-4000-8000-000000000001';
insert into public.zones (id, geom, owner)
select z, extensions.st_geomfromtext('POLYGON((10 10, 10.01 10, 10.01 10.01, 10 10))', 4326), 'owls'
  from unnest(array['8b1111111111fff', '8b1111111112fff', '8b1111111113fff']) z;
insert into public.activities (id, user_id, started_at, status, scored) values
  ('ab111111-0000-4000-8000-000000000001', 'b1111111-0000-4000-8000-000000000001', now() - interval '3 days', 'valid', true);
insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome, created_at)
select 'ab111111-0000-4000-8000-000000000001', z, 'b1111111-0000-4000-8000-000000000001', 'owls', 500, 50, 'influence', now() - interval '3 days'
  from unnest(array['8b1111111111fff', '8b1111111112fff', '8b1111111113fff']) z;

create function pg_temp.alert(p_zone text) returns integer language sql as $$
  select private.notify_zone_runners(p_zone, 'owls', 'invasion', 'Alerta de Invasão!', 'x',
                                     jsonb_build_object('zoneId', p_zone), null)
$$;

select is(pg_temp.alert('8b1111111111fff'), 1, 'primeiro alerta da zona é enviado');
select is(pg_temp.alert('8b1111111111fff'), 0, 'mesma zona em menos de 6 h: não envia');
update public.notifications set created_at = now() - interval '6 hours 1 minute' where data ->> 'zoneId' = '8b1111111111fff';
select is(pg_temp.alert('8b1111111111fff'), 1, 'depois de 6 h a mesma zona pode alertar de novo');

-- 5 por dia: os de ontem não contam
delete from public.notifications where user_id = 'b1111111-0000-4000-8000-000000000001';
insert into public.notifications (user_id, type, title, body, data, created_at)
select 'b1111111-0000-4000-8000-000000000001', 'invasion', 'x', 'x', jsonb_build_object('zoneId', 'ontem' || i), public.br_day_start() - interval '1 minute'
  from generate_series(1, 5) i;
select is(pg_temp.alert('8b1111111112fff'), 1, 'alertas de ontem não contam no limite diário');
insert into public.notifications (user_id, type, title, body, data)
select 'b1111111-0000-4000-8000-000000000001', 'invasion', 'x', 'x', jsonb_build_object('zoneId', 'hoje' || i) from generate_series(1, 4) i;
select is(pg_temp.alert('8b1111111113fff'), 0, 'com 5 alertas hoje, o sexto não é enviado');
select is((select count(*)::int from public.notifications where user_id = 'b1111111-0000-4000-8000-000000000001'
             and type = 'invasion' and created_at >= public.br_day_start()), 5, 'no máximo 5 alertas de invasão no dia');

-- preferência desligada
delete from public.notifications where user_id = 'b1111111-0000-4000-8000-000000000001';
update public.profiles set notification_prefs = '{"invasion": false}' where id = 'b1111111-0000-4000-8000-000000000001';
select is(pg_temp.alert('8b1111111111fff'), 0, 'quem desligou alertas de invasão não recebe');

select * from finish();
rollback;
