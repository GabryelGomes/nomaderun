-- NOMADE RUN — seed v2 de DEMONSTRAÇÃO (T7.2.2). Roda DEPOIS do supabase/seed.sql (precisa das contas *_demo e das
-- zonas de demonstração de Goiânia). Idempotente: rodar 2 vezes não duplica nada nem dá erro.
--
--   psql "$DB_URL" -f supabase/seed_v2_demo.sql            (local; no Cloud, só para a apresentação)
--
-- TUDO aqui é demonstração e fica marcado:
--   * conta nova "parceira_demo" com is_demo = true e SEM senha (não entra no app; só existe para o feed da crew);
--   * crew "Crew Demonstração" (DEMOV), só com contas de demonstração;
--   * corridas das contas de demonstração (o dono é is_demo), itens do feed com is_demo = true, aplausos entre elas;
--   * parciais e recordes do corredor_demo e livro de XP com ref "demo-…";
--   * trechos pintados SÓ em zonas de demonstração (zones.is_demo = true).
-- Fica de fora de propósito (D-76: nenhuma informação falsa em conta real): Raid e Liga. São globais/da cidade e
-- apareceriam para quem não é demonstração; abrem pelos jobs reais (flags) ou pelo modo demonstração do app (E10).
-- Nenhuma flag é ligada aqui: game_config fica como está.

do $$
declare
  v_runner constant uuid := '00000000-0000-4000-a000-000000000001';   -- corredor_demo (striders), do seed.sql
  v_partner constant uuid := '00000000-0000-4000-a000-0000000000d1';  -- parceira_demo (striders), sem senha
  v_crew uuid;
  v_other uuid;
begin
  if not exists (select 1 from public.profiles where id = v_runner and is_demo) then
    raise notice 'seed_v2_demo: conta corredor_demo não encontrada; rode supabase/seed.sql antes. Nada foi feito.';
    return;
  end if;

  -- conta de demonstração sem senha (não faz login)
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_partner, 'authenticated', 'authenticated', 'parceira.demo@nomaderun.app',
          '{"provider": "email", "providers": ["email"], "is_demo": true}'::jsonb,
          '{"username": "parceira_demo", "birthdate": "1998-07-02", "terms_accepted": true, "privacy_accepted": true, "city": "Goiânia"}'::jsonb,
          now(), now())
  on conflict (id) do nothing;
  update public.profiles set faction = 'striders' where id = v_partner and faction is null;

  -- crew de demonstração: só se o corredor_demo não estiver numa crew de verdade
  select cm.crew_id into v_other from public.crew_members cm where cm.user_id = v_runner;
  select c.id into v_crew from public.crews c where c.tag = 'DEMOV' and c.leader_id = v_runner;
  if v_crew is null and v_other is null then
    insert into public.crews (name, tag, leader_id) values ('Crew Demonstração', 'DEMOV', v_runner) returning id into v_crew;
  end if;
  if v_crew is not null and (v_other is null or v_other = v_crew) then
    insert into public.crew_members (crew_id, user_id) values (v_crew, v_partner) on conflict (user_id) do nothing;
  else
    v_crew := null;
    raise notice 'seed_v2_demo: corredor_demo já está numa crew que não é de demonstração; o feed de demonstração foi pulado.';
  end if;

  -- corridas de demonstração (aceitas), com o resultado no formato do contrato
  insert into public.activities (id, user_id, status, mission, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace,
                                 rp_total, xp, scored, last_seq, result)
  select x.id, x.uid, 'valid', 'livre', x.ended - (x.secs || ' seconds')::interval, x.ended, x.ended, x.meters, x.secs,
         round(x.secs / (x.meters / 1000.0)), x.rp, 0, true, -1,
         jsonb_build_object('activityId', x.id, 'status', 'valid', 'meters', x.meters, 'movingSeconds', x.secs,
                            'avgPace', round(x.secs / (x.meters / 1000.0)), 'rpTotal', x.rp, 'xp', 0, 'flags', '[]'::jsonb,
                            'invalidSegments', '[]'::jsonb, 'zones', '[]'::jsonb, 'newFogCells', 0, 'beatGhost', null,
                            'trust', 100, 'review', null, 'chests', '[]'::jsonb, 'group', null, 'demo', true)
    from (values
      ('00000000-0000-4000-a000-0000000d0001'::uuid, v_runner, (public.br_today() + time '06:40') at time zone 'America/Sao_Paulo', 5230::real, 1650::real, 140),
      ('00000000-0000-4000-a000-0000000d0002'::uuid, v_runner, ((public.br_today() - 2) + time '18:10') at time zone 'America/Sao_Paulo', 10120::real, 3300::real, 260),
      ('00000000-0000-4000-a000-0000000d0003'::uuid, v_partner, ((public.br_today() - 1) + time '07:05') at time zone 'America/Sao_Paulo', 4010::real, 1380::real, 95)
    ) as x(id, uid, ended, meters, secs, rp)
   where x.ended <= now()
  on conflict (id) do nothing;

  -- parciais e recordes (corredor_demo)
  insert into public.activity_stats (activity_id, user_id, meters, moving_seconds, splits, pace_series, best_1k_s, best_5k_s, best_10k_s)
  values ('00000000-0000-4000-a000-0000000d0002', v_runner, 10120, 3300, '{335,328,330,326,331,329,327,325,324,320}',
          '{336,330,329,328,331,330,327,326,324,321}', 318, 1640, 3277)
  on conflict (activity_id) do nothing;
  insert into public.activity_stats (activity_id, user_id, meters, moving_seconds, splits, pace_series, best_1k_s, best_5k_s)
  select '00000000-0000-4000-a000-0000000d0001', v_runner, 5230, 1650, '{318,316,315,317,314}', '{319,316,315,316,314}', 310, 1580
   where exists (select 1 from public.activities where id = '00000000-0000-4000-a000-0000000d0001')
  on conflict (activity_id) do nothing;
  insert into public.personal_records (user_id, kind, value, activity_id, day)
  select v_runner, r.kind, r.value, r.act, (a.ended_at at time zone 'America/Sao_Paulo')::date
    from (values ('1k', 310, '00000000-0000-4000-a000-0000000d0001'::uuid), ('5k', 1580, '00000000-0000-4000-a000-0000000d0001'::uuid),
                 ('10k', 3277, '00000000-0000-4000-a000-0000000d0002'::uuid), ('longest', 10120, '00000000-0000-4000-a000-0000000d0002'::uuid)) r(kind, value, act)
    join public.activities a on a.id = r.act
  on conflict (user_id, kind) do nothing;

  -- livro de XP (refs "demo-…": idempotente pelo unique do livro; o XP do perfil sobe uma vez só)
  perform private.grant_xp(v_runner, l.source, l.ref, l.amount)
     from (values ('run_distance', 'demo-00000000-0000-4000-a000-0000000d0002', 100), ('run_complete', 'demo-00000000-0000-4000-a000-0000000d0002', 30),
                  ('fog', 'demo-00000000-0000-4000-a000-0000000d0002', 24), ('mission', 'demo-missao-1', 30),
                  ('daily_chest', 'demo-bau-1', 40)) l(source, ref, amount);
  update public.profiles
     set lifetime_meters = greatest(lifetime_meters, 19360), last_activity_at = greatest(coalesce(last_activity_at, now() - interval '1 day'), now() - interval '1 hour')
   where id = v_runner;

  -- missões: não sorteia aqui; o próprio servidor sorteia na 1ª chamada de my_missions/my_engagement (determinístico)

  -- feed da crew de demonstração (rota já "cortada": polylines fixas em volta do Parque Flamboyant, sem as pontas)
  if v_crew is not null then
    insert into public.feed_items (id, activity_id, user_id, crew_id, day, meters, moving_seconds, avg_pace, highlights, route, route_hidden, is_demo)
    select x.id, x.act, a.user_id, v_crew, (a.ended_at at time zone 'America/Sao_Paulo')::date, round(a.meters)::integer,
           round(a.moving_seconds)::integer, round(a.avg_pace)::integer, x.highlights, x.route, true, true
      from (values
        ('00000000-0000-4000-a000-0000000f0001'::uuid, '00000000-0000-4000-a000-0000000d0001'::uuid,
         '[{"kind": "zone_conquered", "name": "Setor Sul 4"}, {"kind": "pr", "distance": "5k"}]'::jsonb,
         array['bieItr`]GFEFEHEHCJAJAJ?L@J@J@JDJBHFFFHFDFDHBH@H@H?HAHCFEHEFGDGDIDIBK@K@K?MAKAKAKEKCIGG']),
        ('00000000-0000-4000-a000-0000000f0002'::uuid, '00000000-0000-4000-a000-0000000d0002'::uuid,
         '[{"kind": "pr", "distance": "10k"}]'::jsonb, null::text[]),
        ('00000000-0000-4000-a000-0000000f0003'::uuid, '00000000-0000-4000-a000-0000000d0003'::uuid,
         '[]'::jsonb, array['b{dI~u`]ECEEECEAEAEAE?E@E@EBEBEDEBEDEBEBE@E@E?E?EAECECEC'])
      ) as x(id, act, highlights, route)
      join public.activities a on a.id = x.act
    on conflict (activity_id) do nothing;
    insert into public.kudos (feed_item_id, user_id, reaction, day)
    select x.item, x.uid, x.reaction, public.br_today()
      from (values ('00000000-0000-4000-a000-0000000f0001'::uuid, v_partner, 'bora'),
                   ('00000000-0000-4000-a000-0000000f0002'::uuid, v_partner, 'fogo'),
                   ('00000000-0000-4000-a000-0000000f0003'::uuid, v_runner, 'raio')) x(item, uid, reaction)
     where exists (select 1 from public.feed_items f where f.id = x.item)
    on conflict (feed_item_id, user_id) do nothing;
  end if;

  -- pintura: só em zonas de demonstração (Setor Sul 4, Setor Sul 1 e Setor Sul 15)
  insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng)
  select c.cell, c.zone, c.faction, c.layers, now() - (c.days || ' days')::interval, c.lat, c.lng
    from (values
      ('8ba8c0cc4540fff', '89a8c0cc457ffff', 'striders', 2, 1, -16.6793656, -49.2376890),
      ('8ba8c0cc4541fff', '89a8c0cc457ffff', 'striders', 1, 0, -16.6791098, -49.2381098),
      ('8ba8c0cc4542fff', '89a8c0cc457ffff', 'striders', 3, 2, -16.6791551, -49.2372538),
      ('8ba8c0cc4543fff', '89a8c0cc457ffff', 'striders', 1, 0, -16.6788993, -49.2376746),
      ('8ba8c0cc4544fff', '89a8c0cc457ffff', 'striders', 1, 3, -16.6798318, -49.2377035),
      ('8ba8c0cc4100fff', '89a8c0cc413ffff', 'volt', 2, 1, -16.6823115, -49.2437827),
      ('8ba8c0cc4101fff', '89a8c0cc413ffff', 'volt', 1, 4, -16.6820557, -49.2442035),
      ('8ba8c0cc4102fff', '89a8c0cc413ffff', 'volt', 3, 0, -16.6821011, -49.2433474),
      ('8ba8c0cc4103fff', '89a8c0cc413ffff', 'volt', 1, 2, -16.6818453, -49.2437682),
      ('8ba8c0cc4cc0fff', '89a8c0cc4cfffff', 'striders', 1, 0, -16.6826291, -49.2377902),
      ('8ba8c0cc4cc1fff', '89a8c0cc4cfffff', 'striders', 1, 1, -16.6823733, -49.2382110)
    ) as c(cell, zone, faction, layers, days, lat, lng)
    join public.zones z on z.id = c.zone and z.is_demo
  on conflict (cell) do nothing;
end $$;
