-- NOMADE RUN — Fase 7, onda 2 (T7.2.1, D-62/D-63/D-64/D-65/D-66/D-67/D-68/D-79/D-80): gravação v2.
-- O finish-activity (e a aprovação da moderação) continuam chamando o cálculo v1 SEM mudança
-- (svc_finish_context → computeOfficialResult → svc_apply_activity_result). Depois, só se alguma flag v2 estiver
-- ligada, a Edge Function:
--   1. lê svc_v2_context (flags, pintura das zonas tocadas, raid, liga, engajamento, recordes e feed);
--   2. calcula com o domain (applyPaint, scoreRunV2, raidDamage, runXp, weekKeptXp, settleMission) e com
--      _shared/records.ts e _shared/feed.ts;
--   3. grava tudo numa transação em svc_apply_v2 (idempotente: activities.v2_extras marca o que já foi aplicado;
--      cada parte também é idempotente pelas próprias chaves: raid_hits, league_entries, xp_ledger, daily_rewards...);
--   4. devolve o bloco opcional "extras" na resposta. Com as flags desligadas, a resposta é exatamente a de hoje.

-- O que a gravação v2 aplicou nesta corrida (bruto; a Edge Function monta o bloco "extras" a partir dele).
alter table public.activities add column v2_extras jsonb check (v2_extras is null or jsonb_typeof(v2_extras) = 'object');
comment on column public.activities.v2_extras is
  'D-80: resultado da gravação v2 (pintura, pontos, liga, raid, engajamento, recordes, feed). null = v2 não rodou.';

-- Alguma parte da v2 está ligada?
create or replace function private.v2_any_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.territory_rule() = 'v2'
      or exists (select 1 from public.game_config g, jsonb_each(g.value) e
                  where g.key = 'features' and e.key in ('raid', 'league', 'missions', 'dailyChest', 'records', 'feed')
                    and e.value = 'true'::jsonb)
$$;
revoke all on function private.v2_any_on() from public, anon, authenticated;

-- ===========================================================================
-- Contexto da gravação v2 (service role). p_zone_ids: zonas que a pintura toca (paintZoneOf dos trechos).
-- Chama ensure_missions ANTES de contar a corrida (cria a missão de volta, contrato E7 §8 passo 6).
-- ===========================================================================
create or replace function public.svc_v2_context(p_user uuid, p_activity uuid, p_zone_ids text[] default '{}')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.activities;
  pr public.profiles;
  v_end timestamptz;
  v_day date;
  v_week date;
  v_features jsonb := coalesce((select g.value from public.game_config g where g.key = 'features'), '{}'::jsonb);
  v_rule text := private.territory_rule();
  v_out jsonb;
  v_today_ids uuid[];
  r public.raids;
  v_from timestamptz;
begin
  select * into a from public.activities where id = p_activity;
  if a.id is null or a.user_id <> p_user then
    return null;
  end if;
  v_out := jsonb_build_object(
    'flags', jsonb_build_object('territoryRule', v_rule, 'features', v_features),
    'done', a.v2_extras,
    'activity', jsonb_build_object('status', a.status, 'scored', a.scored, 'meters', a.meters,
                                   'movingSeconds', a.moving_seconds, 'avgPace', a.avg_pace, 'beatGhost', a.beat_ghost,
                                   'mission', a.mission, 'endedAt', private.ts_to_ms(coalesce(a.ended_at, a.finished_at)),
                                   'result', a.result));
  if a.v2_extras is not null or not private.v2_any_on() then
    return v_out;
  end if;

  select * into pr from public.profiles where id = p_user;
  v_end := coalesce(a.ended_at, a.finished_at, now());
  v_day := (v_end at time zone 'America/Sao_Paulo')::date;
  v_week := date_trunc('week', v_end at time zone 'America/Sao_Paulo')::date;
  v_today_ids := array(select x.id from public.activities x
                        where x.user_id = p_user and x.id <> a.id and x.scored and x.status in ('valid', 'partial')
                          and (coalesce(x.ended_at, x.finished_at) at time zone 'America/Sao_Paulo')::date = v_day);

  v_out := v_out || jsonb_build_object(
    'day', v_day,
    'profile', jsonb_build_object('faction', pr.faction, 'trust', pr.trust, 'xp', pr.xp, 'lifetimeMeters', pr.lifetime_meters,
                                  'city', pr.city, 'crewId', (select cm.crew_id from public.crew_members cm where cm.user_id = p_user),
                                  'streakWeeks', pr.streak_weeks, 'bestStreak', pr.best_streak_weeks, 'freezesLeft', pr.freezes_left,
                                  'paused', pr.pause_from is not null and public.br_today() between pr.pause_from and pr.pause_until));

  -- Ritmo-base (mesma consulta do svc_finish_context v1), para o esforço relativo do scoreRunV2
  v_out := v_out || jsonb_build_object('recentPaces', coalesce((
    select jsonb_agg(r2.avg_pace order by r2.finished_at)
      from (select x.avg_pace, x.finished_at from public.activities x
             where x.user_id = p_user and x.id <> a.id and x.scored and x.avg_pace > 0
             order by x.finished_at desc limit 10) r2), '[]'::jsonb));

  -- Pintura (só na v2): TODOS os trechos das zonas tocadas (pré-condição do applyPaint) e o que a pessoa já pintou hoje.
  if v_rule = 'v2' then
    v_out := v_out || jsonb_build_object('paint', jsonb_build_object(
      'zones', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'version', z.version, 'owner', z.owner, 'blocked', z.blocked,
                 'inheritFaction', z.inherit_faction, 'inheritCells', z.inherit_cells,
                 'inheritUntil', private.ts_to_ms(z.inherit_until), 'attacker', z.attacker,
                 'attackStartedAt', private.ts_to_ms(z.attack_started_at), 'attackLastAt', private.ts_to_ms(z.attack_last_at),
                 'attackFlips', z.attack_flips, 'name', z.name) order by z.id)
                 from public.zones z where z.id = any (p_zone_ids)), '[]'::jsonb),
      'cells', coalesce((select jsonb_agg(jsonb_build_object('cell', c.cell, 'zoneId', c.zone_id, 'faction', c.faction,
                                                             'layers', c.layers, 'paintedAt', private.ts_to_ms(c.painted_at))
                                          order by c.cell)
                           from public.zone_cells c where c.zone_id = any (p_zone_ids)), '[]'::jsonb),
      'paintedToday', coalesce((select jsonb_agg(m.cell order by m.cell) from public.paint_marks m
                                 where m.user_id = p_user and m.day = v_day), '[]'::jsonb)));
  end if;

  -- Pontos v2 já ganhos hoje por zona (teto diário do scoreZoneV2), a partir das corridas v2 do dia.
  v_out := v_out || jsonb_build_object('earnedTodayV2', coalesce((
    select jsonb_object_agg(s.zone_id, s.rp) from (
      select z ->> 'zoneId' as zone_id, sum((z ->> 'rp')::integer) as rp
        from public.activities x, jsonb_array_elements(coalesce(x.v2_extras -> 'points' -> 'zones', '[]'::jsonb)) z
       where x.id = any (v_today_ids) group by 1) s), '{}'::jsonb));

  -- Raid ativo que cobre o fim da corrida (mesma escolha de apply_raid_hit) e o que a pessoa já fez no dia.
  if coalesce((v_features ->> 'raid')::boolean, false) then
    select * into r from public.raids x
     where x.status = 'active' and v_end >= x.starts_at and v_end < x.ends_at and (x.city is null or x.city = pr.city)
     order by (x.city is null), x.starts_at desc limit 1;
    v_out := v_out || jsonb_build_object('raid', case when r.id is null then null else jsonb_build_object(
      'id', r.id, 'bossId', r.boss_id, 'phase', r.phase, 'hp', r.hp, 'hpMax', r.hp_max,
      'weakZones', coalesce((select jsonb_agg(w.zone_id order by w.zone_id) from public.raid_weak_points w
                              where w.raid_id = r.id and w.day = v_day), '[]'::jsonb),
      'damageToday', coalesce((select sum(h.damage) from public.raid_hits h where h.user_id = p_user and h.day = v_day), 0),
      'metersToday', coalesce((select sum(h.meters) from public.raid_hits h where h.user_id = p_user and h.day = v_day), 0)) end);
  end if;

  -- Engajamento (contrato E7 §8)
  if coalesce((v_features ->> 'missions')::boolean, false) then
    perform private.ensure_missions(p_user, now(), a.id);
    select min(um.available_from) into v_from from public.user_missions um
     where um.user_id = p_user and um.completed_at is null and um.available_from <= now();
    v_out := v_out || jsonb_build_object('engagement', jsonb_build_object(
      'xpDay', jsonb_build_object(
        'meters', coalesce((select sum(x.meters) from public.activities x where x.id = any (v_today_ids)), 0),
        'atlasXp', coalesce((select sum(l.amount) from public.xp_ledger l
                              where l.user_id = p_user and l.source = 'fog' and l.ref = any (v_today_ids::text[])), 0),
        'completed', exists (select 1 from public.xp_ledger l where l.user_id = p_user and l.source = 'run_complete'
                                                               and l.ref = any (v_today_ids::text[])),
        'ghost', exists (select 1 from public.xp_ledger l where l.user_id = p_user and l.source = 'ghost'
                                                           and l.ref = any (v_today_ids::text[]))),
      'weekId', to_char(v_end at time zone 'America/Sao_Paulo', 'IYYY-"W"IW'),
      'weekBefore', (select count(*) from public.activities x
                      where x.user_id = p_user and x.id <> a.id and x.scored and x.status in ('valid', 'partial')
                        and coalesce(x.ended_at, x.finished_at) >= (v_week + time '00:00') at time zone 'America/Sao_Paulo'
                        and coalesce(x.ended_at, x.finished_at) < ((v_week + 7) + time '00:00') at time zone 'America/Sao_Paulo'),
      'seasonId', public.current_season_id(),
      'seasonXp', private.season_xp(p_user, public.current_season_id()),
      'missions', coalesce((select jsonb_agg(private.mission_json(um) order by um.kind, um.slot) from public.user_missions um
                             where um.user_id = p_user and um.completed_at is null and um.available_from <= now()
                               and um.metric not in ('crew_member', 'league_points', 'shares', 'ranking_opened')), '[]'::jsonb),
      -- evidência: as outras atividades pontuadas dentro da janela das missões abertas (a atual entra pela function)
      'evidence', coalesce((select jsonb_agg(jsonb_build_object(
          'id', x.id, 'endedAt', private.ts_to_ms(coalesce(x.ended_at, x.finished_at)),
          'status', case x.status when 'valid' then 'valid' else 'partially_valid' end,
          'meters', x.meters, 'movingSeconds', x.moving_seconds,
          'atlasCells', (select count(*) from public.fog_cells f where f.activity_id = x.id),
          'zonesPainted', coalesce((select jsonb_agg(az.zone_id) from public.activity_zones az
                                     where az.activity_id = x.id and az.rp > 0), '[]'::jsonb),
          'districts', coalesce((select jsonb_agg(distinct private.h3_parent(az.zone_id, 7)) from public.activity_zones az
                                  where az.activity_id = x.id and az.rp > 0), '[]'::jsonb),
          'conquered', (select count(*) from public.activity_zones az where az.activity_id = x.id and az.outcome = 'conquered'),
          'defended', (select count(*) from public.activity_zones az where az.activity_id = x.id and az.outcome = 'defended'),
          'huntChests', (select count(*) from public.chest_opens c where c.activity_id = x.id),
          'beatGhost', x.beat_ghost,
          'group', coalesce(x.result -> 'group', 'null'::jsonb) <> 'null'::jsonb,
          'raidMeters', coalesce((select h.meters from public.raid_hits h where h.activity_id = x.id), 0)))
        from (select * from public.activities y
               where y.user_id = p_user and y.id <> a.id and y.scored and y.status in ('valid', 'partial')
                 and v_from is not null and coalesce(y.ended_at, y.finished_at) >= v_from
               order by coalesce(y.ended_at, y.finished_at) desc limit 300) x), '[]'::jsonb),
      'dailyChest', jsonb_build_object(
        'on', coalesce((v_features ->> 'dailyChest')::boolean, false),
        'stored', private.daily_chests_stored(p_user, public.br_today()),
        'openedToday', exists (select 1 from public.daily_rewards d where d.user_id = p_user and d.day = public.br_today()),
        'pity', pr.daily_chest_pity)));
  end if;

  -- Recordes atuais (para dizer "novo recorde" e o anterior)
  if coalesce((v_features ->> 'records')::boolean, false) then
    v_out := v_out || jsonb_build_object('records', coalesce((
      select jsonb_object_agg(r2.kind, r2.value) from public.personal_records r2 where r2.user_id = p_user), '{}'::jsonb));
  end if;

  -- Feed: crew, configurações e as zonas de privacidade do autor (o corte é na Edge Function, com o domain)
  if coalesce((v_features ->> 'feed')::boolean, false) then
    v_out := v_out || jsonb_build_object('feed', jsonb_build_object(
      'crewId', (select cm.crew_id from public.crew_members cm where cm.user_id = p_user),
      'shareRunsToFeed', coalesce((select s.share_runs_to_feed from public.user_settings s where s.user_id = p_user), true),
      'showMap', coalesce((select s.feed_show_map from public.user_settings s where s.user_id = p_user), true),
      'privacyZones', coalesce((select jsonb_agg(jsonb_build_object('lat', z.lat, 'lng', z.lng, 'radiusM', z.radius_m))
                                  from public.privacy_zones z where z.user_id = p_user), '[]'::jsonb)));
  end if;
  return v_out;
end $$;
revoke all on function public.svc_v2_context(uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.svc_v2_context(uuid, uuid, text[]) to service_role;

-- ===========================================================================
-- Evento de zona da pintura → zone_events + notificações (mesmos textos e limites da v1).
-- ===========================================================================
create or replace function private.v2_zone_event(ev jsonb, p_act uuid, p_user uuid, p_faction text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_zone public.zones;
  v_center extensions.geometry;
  v_n integer := 0;
begin
  select * into v_zone from public.zones where id = ev ->> 'zoneId';
  if v_zone.id is null then
    return 0;
  end if;
  v_center := extensions.st_centroid(v_zone.geom);
  insert into public.zone_events (zone_id, type, faction, from_faction, activity_id, user_id)
  values (ev ->> 'zoneId', ev ->> 'type',
          case ev ->> 'type' when 'captured' then ev ->> 'faction' when 'under_attack' then ev ->> 'attacker' else ev ->> 'owner' end,
          case ev ->> 'type' when 'captured' then ev ->> 'from' when 'under_attack' then ev ->> 'owner'
                             when 'neutralized' then ev ->> 'from' else null end,
          p_act, p_user);
  if ev ->> 'type' = 'under_attack' then
    v_n := private.notify_zone_runners(
      ev ->> 'zoneId', ev ->> 'owner', 'invasion', 'Alerta de Invasão!',
      format('Suas ruas em %s estão sendo pintadas pelos %s. Corra lá nas próximas 24h para defender.',
             private.zone_label(v_zone.id, v_zone.name), private.faction_name(ev ->> 'attacker')),
      jsonb_build_object('zoneId', v_zone.id, 'attacker', ev ->> 'attacker',
                         'lat', extensions.st_y(v_center), 'lng', extensions.st_x(v_center)),
      p_user);
  elsif ev ->> 'type' = 'captured' then
    if ev ->> 'from' is not null then
      v_n := private.notify_zone_runners(
        ev ->> 'zoneId', ev ->> 'from', 'territory_lost', 'Território perdido',
        format('%s agora pertence aos %s. Corra lá para pintar de volta.',
               private.zone_label(v_zone.id, v_zone.name), private.faction_name(ev ->> 'faction')),
        jsonb_build_object('zoneId', v_zone.id, 'newOwner', ev ->> 'faction',
                           'lat', extensions.st_y(v_center), 'lng', extensions.st_x(v_center)),
        p_user);
    end if;
    if ev ->> 'faction' = p_faction then
      insert into public.notifications (user_id, type, title, body, data)
      select p_user, 'conquest', 'Zona conquistada',
             format('Você pintou %s com a cor dos %s.', private.zone_label(v_zone.id, v_zone.name), private.faction_name(p_faction)),
             jsonb_build_object('zoneId', v_zone.id, 'activityId', p_act,
                                'lat', extensions.st_y(v_center), 'lng', extensions.st_x(v_center))
        from public.profiles pr
       where pr.id = p_user and coalesce((pr.notification_prefs ->> 'conquest')::boolean, true);
    end if;
  end if;
  return v_n;
end $$;
revoke all on function private.v2_zone_event(jsonb, uuid, uuid, text) from public, anon, authenticated;

-- ===========================================================================
-- Gravação v2 (service role), numa transação. Idempotente por activities.v2_extras.
-- Erros: ZONE_CONFLICT (zona mudou desde o contexto → a function recarrega e tenta de novo).
-- ===========================================================================
create or replace function public.svc_apply_v2(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_act uuid := (p ->> 'activityId')::uuid;
  v_user uuid := (p ->> 'userId')::uuid;
  v_faction text := p ->> 'faction';
  v_now timestamptz := coalesce(private.ms_to_ts((p ->> 'nowMs')::double precision), now());
  a public.activities;
  pr public.profiles;
  z jsonb;
  c jsonb;
  ev jsonb;
  l jsonb;
  v_ver integer;
  v_new record;
  v_end timestamptz;
  v_day date;
  v_week date;
  v_raw jsonb := jsonb_build_object('version', 1, 'scored', true);
  v_features jsonb := coalesce((select g.value from public.game_config g where g.key = 'features'), '{}'::jsonb);
  v_xp_before integer;
  v_life_before bigint;
  v_season text := public.current_season_id();
  v_season_before integer;
  v_lines jsonb := '[]'::jsonb;
  v_amount integer;
  v_chests jsonb;
  v_done jsonb := '[]'::jsonb;
  v_state jsonb;
  v_run_xp integer := 0;
  v_records jsonb := '[]'::jsonb;
  v_old integer;
  v_kind text;
  v_val integer;
  v_item uuid;
  v_crew uuid;
  v_settings public.user_settings;
begin
  select * into a from public.activities where id = v_act for update;
  if a.id is null or a.user_id <> v_user then
    raise exception 'NOT_FOUND: corrida não encontrada' using errcode = 'P0001';
  end if;
  if a.v2_extras is not null then
    return a.v2_extras || jsonb_build_object('repeated', true);
  end if;
  if not a.scored or a.status not in ('valid', 'partial') then
    raise exception 'NOT_SCORED: a gravação v2 só roda em corrida aceita' using errcode = 'P0001';
  end if;
  select * into pr from public.profiles where id = v_user for update;
  v_end := coalesce(a.ended_at, a.finished_at, v_now);
  v_day := (v_end at time zone 'America/Sao_Paulo')::date;
  v_week := date_trunc('week', v_end at time zone 'America/Sao_Paulo')::date;
  v_xp_before := pr.xp;
  v_life_before := pr.lifetime_meters;
  v_season_before := private.season_xp(v_user, v_season);

  -- -------------------------------------------------------------------------
  -- 1. Pintura (territory_rule = 'v2'): trava as zonas em ordem fixa e confere as versões do contexto
  -- -------------------------------------------------------------------------
  if jsonb_typeof(p -> 'paint') = 'object' then
    if private.territory_rule() <> 'v2' then
      raise exception 'ZONE_CONFLICT: a regra de território mudou durante o cálculo' using errcode = 'P0001';
    end if;
    perform 1 from public.zones where id in (select x ->> 'zoneId' from jsonb_array_elements(p -> 'paint' -> 'zones') x)
     order by id for update;
    for z in select * from jsonb_array_elements(coalesce(p -> 'paint' -> 'zones', '[]'::jsonb)) loop
      select version into v_ver from public.zones where id = z ->> 'zoneId';
      if (z ->> 'expectedVersion') is null then
        if v_ver is not null then
          raise exception 'ZONE_CONFLICT: zona % foi criada por outra corrida', z ->> 'zoneId' using errcode = 'P0001';
        end if;
        insert into public.zones (id, geom, rule_version, version)
        values (z ->> 'zoneId', extensions.st_setsrid(extensions.st_geomfromgeojson(z ->> 'geom'), 4326), 2, 0);
        select n.o_name, n.o_city into v_new from public.zones nz, private.new_zone_name(nz.geom, v_user) n
         where nz.id = z ->> 'zoneId';
        update public.zones set name = v_new.o_name, city = v_new.o_city where id = z ->> 'zoneId';
      elsif v_ver is distinct from (z ->> 'expectedVersion')::integer then
        raise exception 'ZONE_CONFLICT: zona % mudou durante o cálculo', z ->> 'zoneId' using errcode = 'P0001';
      end if;
    end loop;
    for c in select * from jsonb_array_elements(coalesce(p -> 'paint' -> 'cells', '[]'::jsonb)) loop
      insert into public.zone_cells (cell, zone_id, faction, layers, painted_at, lat, lng, season_id, updated_at)
      values (c ->> 'cell', c ->> 'zoneId', c ->> 'faction', (c ->> 'layers')::smallint,
              private.ms_to_ts((c ->> 'paintedAt')::double precision), (c ->> 'lat')::double precision,
              (c ->> 'lng')::double precision, v_season, now())
      on conflict (cell) do update
         set faction = excluded.faction, layers = excluded.layers, painted_at = excluded.painted_at,
             season_id = excluded.season_id, updated_at = now();
    end loop;
    for z in select * from jsonb_array_elements(coalesce(p -> 'paint' -> 'zones', '[]'::jsonb)) loop
      update public.zones
         set owner = case when blocked then null else z ->> 'owner' end,
             influence = private.paint_influence(z -> 'counts'),
             inherit_faction = z ->> 'inheritFaction',
             inherit_cells = (z ->> 'inheritCells')::smallint,
             inherit_until = private.ms_to_ts((z ->> 'inheritUntil')::double precision),
             attacker = z ->> 'attacker',
             attack_started_at = private.ms_to_ts((z ->> 'attackSince')::double precision),
             attack_last_at = private.ms_to_ts((z ->> 'attackLastAt')::double precision),
             attack_flips = coalesce((z ->> 'attackFlips')::smallint, 0),
             shield = 0, rule_version = 2, version = version + 1, updated_at = now()
       where id = z ->> 'zoneId';
    end loop;
    insert into public.paint_marks (user_id, day, cell, activity_id)
    select v_user, v_day, m, v_act from jsonb_array_elements_text(coalesce(p -> 'paint' -> 'marks', '[]'::jsonb)) m
    on conflict do nothing;
    for ev in select * from jsonb_array_elements(coalesce(p -> 'paint' -> 'events', '[]'::jsonb)) loop
      perform private.v2_zone_event(ev, v_act, v_user, v_faction);
    end loop;
    -- O resumo e a tabela de contribuição passam a contar a pintura (conquistou/defendeu)
    for z in select * from jsonb_array_elements(coalesce(p -> 'paint' -> 'summary' -> 'zones', '[]'::jsonb)) loop
      update public.activity_zones
         set outcome = case z ->> 'outcome' when 'conquistada' then 'conquered' when 'defendida' then 'defended' else 'influence' end,
             owner_before = z ->> 'ownerBefore', owner_after = z ->> 'ownerAfter'
       where activity_id = v_act and zone_id = z ->> 'zoneId';
    end loop;
    if jsonb_typeof(a.result -> 'zones') = 'array' then
      update public.activities
         set result = jsonb_set(result, '{zones}', coalesce((
               select jsonb_agg(case when s.zr is null then e
                                     else e || jsonb_build_object(
                                       'outcome', case s.zr ->> 'outcome' when 'conquistada' then 'conquered'
                                                                          when 'defendida' then 'defended' else 'influence' end,
                                       'ownerBefore', s.zr -> 'ownerBefore', 'ownerAfter', s.zr -> 'ownerAfter') end
                                order by ord)
                 from jsonb_array_elements(result -> 'zones') with ordinality t(e, ord)
                 left join lateral (select x as zr from jsonb_array_elements(p -> 'paint' -> 'summary' -> 'zones') x
                                     where x ->> 'zoneId' = e ->> 'zoneId' limit 1) s on true), '[]'::jsonb))
       where id = v_act;
    end if;
    v_raw := v_raw || jsonb_build_object('paint', p -> 'paint' -> 'summary');
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Pontos v2 e Liga (D-68: pontos da liga = pontos da corrida pelo scoreRunV2)
  -- -------------------------------------------------------------------------
  if jsonb_typeof(p -> 'points') = 'object' then
    v_raw := v_raw || jsonb_build_object('points', p -> 'points');
    if coalesce((v_features ->> 'league')::boolean, false) then
      v_raw := v_raw || jsonb_build_object('league',
                 private.add_league_points(v_act, greatest(0, coalesce((p -> 'points' ->> 'total')::integer, 0)), v_now));
    end if;
  end if;

  -- -------------------------------------------------------------------------
  -- 3. Raid (o servidor confere crítico e tetos de novo em apply_raid_hit)
  -- -------------------------------------------------------------------------
  if jsonb_typeof(p -> 'raid') = 'object' then
    v_raw := v_raw || jsonb_build_object('raid', private.apply_raid_hit(
               v_act, (p -> 'raid' ->> 'meters')::integer, (p -> 'raid' ->> 'damage')::integer,
               coalesce((p -> 'raid' ->> 'weakMeters')::integer, 0), coalesce((p -> 'raid' ->> 'pack')::boolean, false)));
  end if;

  -- -------------------------------------------------------------------------
  -- 4. Engajamento (E7 §8): XP em linhas, semana garantida, baús do dia, missões
  -- -------------------------------------------------------------------------
  update public.profiles
     set lifetime_meters = greatest(lifetime_meters,
                                    coalesce((select round(sum(x.meters))::bigint from public.activities x
                                               where x.user_id = v_user and x.scored and x.status in ('valid', 'partial')), 0)),
         last_activity_at = greatest(coalesce(last_activity_at, v_end), v_end)
   where id = v_user;
  if jsonb_typeof(p -> 'xpLines') = 'array' then
    for l in select * from jsonb_array_elements(p -> 'xpLines') loop
      if l ->> 'source' in ('run_distance', 'run_complete', 'fog', 'ghost', 'hunt_chest') then
        v_amount := private.grant_xp(v_user, l ->> 'source', v_act::text, (l ->> 'amount')::integer);
        if v_amount > 0 then
          v_lines := v_lines || jsonb_build_object('source', l ->> 'source', 'amount', v_amount);
          v_run_xp := v_run_xp + v_amount;
        end if;
      end if;
    end loop;
    if jsonb_typeof(p -> 'weekKept') = 'object' then
      v_amount := private.grant_xp(v_user, 'week_kept', p -> 'weekKept' ->> 'ref', (p -> 'weekKept' ->> 'amount')::integer);
      if v_amount > 0 then
        v_lines := v_lines || jsonb_build_object('source', 'week_kept', 'amount', v_amount);
        v_run_xp := v_run_xp + v_amount;
      end if;
    end if;
    -- baús do dia (a própria função confere a flag, o dia, 1 km, confiança e "já abriu hoje")
    v_chests := private.open_daily_chests(v_user, v_act, now());
    if coalesce((v_chests ->> 'opened')::boolean, false) then
      select coalesce(sum((x ->> 'xp')::integer), 0)::integer into v_amount
        from jsonb_array_elements(coalesce(v_chests -> 'prizes', '[]'::jsonb) || coalesce(v_chests -> 'bonus', '[]'::jsonb)) x;
      if v_amount > 0 then
        v_lines := v_lines || jsonb_build_object('source', 'daily_chest', 'amount', v_amount);
      end if;
    end if;
    -- missões: progresso absoluto do domain (settleMission) + as de estado (crew, liga, compartilhar, ranking)
    v_done := private.advance_missions(v_user, coalesce(p -> 'missionProgress', '{}'::jsonb), now());
    v_state := private.settle_state_missions(v_user, now());
    v_done := v_done || coalesce(v_state, '[]'::jsonb);
    select coalesce(sum((x ->> 'xp')::integer), 0)::integer into v_amount from jsonb_array_elements(v_done) x;
    if v_amount > 0 then
      v_lines := v_lines || jsonb_build_object('source', 'mission', 'amount', v_amount);
    end if;
    -- response.xp (clientes antigos) = XP da atividade na v2; o v1 não creditou nada (a function mandou xp = 0)
    update public.activities
       set xp = v_run_xp,
           result = case when result is null then result else jsonb_set(result, '{xp}', to_jsonb(v_run_xp)) end
     where id = v_act;
    select * into pr from public.profiles where id = v_user;
    v_raw := v_raw || jsonb_build_object('engagement', jsonb_build_object(
      'xpBefore', v_xp_before, 'xpAfter', pr.xp, 'runXp', v_run_xp, 'lines', v_lines,
      'lifetimeBefore', v_life_before, 'lifetimeAfter', pr.lifetime_meters,
      'seasonId', v_season, 'seasonXpBefore', v_season_before, 'seasonXpAfter', private.season_xp(v_user, v_season),
      'dailyChests', v_chests,
      'missions', v_done,
      'streak', jsonb_build_object(
        'weeks', pr.streak_weeks, 'best', pr.best_streak_weeks, 'freezesLeft', pr.freezes_left,
        'activitiesThisWeek', (select count(*) from public.activities x
                                where x.user_id = v_user and x.scored and x.status in ('valid', 'partial')
                                  and coalesce(x.ended_at, x.finished_at) >= (v_week + time '00:00') at time zone 'America/Sao_Paulo'
                                  and coalesce(x.ended_at, x.finished_at) < ((v_week + 7) + time '00:00') at time zone 'America/Sao_Paulo'),
        'weekKept', exists (select 1 from jsonb_array_elements(v_lines) x where x ->> 'source' = 'week_kept'),
        'paused', pr.pause_from is not null and public.br_today() between pr.pause_from and pr.pause_until),
      'comeback', (select um.def_id from public.user_missions um
                    where um.user_id = v_user and um.kind = 'volta' and um.created_at >= v_now - interval '1 day'
                    order by um.created_at desc limit 1)));
  end if;

  -- -------------------------------------------------------------------------
  -- 5. Recordes e parciais (só corrida valid conta para recorde)
  -- -------------------------------------------------------------------------
  if jsonb_typeof(p -> 'records') = 'object' and coalesce((v_features ->> 'records')::boolean, false) then
    insert into public.activity_stats (activity_id, user_id, meters, moving_seconds, splits, pace_series,
                                       best_1k_s, best_5k_s, best_10k_s, best_21k_s)
    values (v_act, v_user, (p -> 'records' ->> 'meters')::integer, (p -> 'records' ->> 'movingSeconds')::integer,
            coalesce(array(select jsonb_array_elements_text(p -> 'records' -> 'splits')::integer), '{}'),
            coalesce(array(select jsonb_array_elements_text(p -> 'records' -> 'paceSeries')::integer), '{}'),
            (p -> 'records' ->> 'best1k')::integer, (p -> 'records' ->> 'best5k')::integer,
            (p -> 'records' ->> 'best10k')::integer, (p -> 'records' ->> 'best21k')::integer)
    on conflict (activity_id) do nothing;
    if a.status = 'valid' then
      foreach v_kind in array array['1k', '5k', '10k', '21k', 'longest'] loop
        v_val := case v_kind when '1k' then (p -> 'records' ->> 'best1k')::integer when '5k' then (p -> 'records' ->> 'best5k')::integer
                             when '10k' then (p -> 'records' ->> 'best10k')::integer when '21k' then (p -> 'records' ->> 'best21k')::integer
                             else (p -> 'records' ->> 'meters')::integer end;
        continue when v_val is null or v_val <= 0;
        select r.value into v_old from public.personal_records r where r.user_id = v_user and r.kind = v_kind for update;
        if v_old is null or (v_kind = 'longest' and v_val > v_old) or (v_kind <> 'longest' and v_val < v_old) then
          insert into public.personal_records (user_id, kind, value, activity_id, day, previous)
          values (v_user, v_kind, v_val, v_act, v_day, v_old)
          on conflict (user_id, kind) do update
             set value = excluded.value, activity_id = excluded.activity_id, day = excluded.day,
                 previous = excluded.previous, updated_at = now();
          v_records := v_records || jsonb_build_object('kind', v_kind, 'value', v_val, 'previous', v_old);
        end if;
        v_old := null;
      end loop;
    end if;
    v_raw := v_raw || jsonb_build_object('records', jsonb_build_object('new', v_records));
  end if;

  -- -------------------------------------------------------------------------
  -- 6. Feed da crew (rota já cortada pela function; sem horário)
  -- -------------------------------------------------------------------------
  if jsonb_typeof(p -> 'feed') = 'object' and coalesce((v_features ->> 'feed')::boolean, false) then
    select cm.crew_id into v_crew from public.crew_members cm where cm.user_id = v_user;
    select * into v_settings from public.user_settings s where s.user_id = v_user;
    if v_crew is not null and coalesce(v_settings.share_runs_to_feed, true) then
      insert into public.feed_items (activity_id, user_id, crew_id, day, meters, moving_seconds, avg_pace, highlights,
                                     route, route_hidden, is_demo)
      values (v_act, v_user, v_crew, v_day, round(a.meters)::integer, round(a.moving_seconds)::integer,
              case when a.avg_pace > 0 then round(a.avg_pace)::integer end,
              coalesce((select jsonb_agg(h.e order by h.ord) from (
                select e, ord from jsonb_array_elements(coalesce(p -> 'feed' -> 'highlights', '[]'::jsonb)
                                                        || coalesce((select jsonb_agg(jsonb_build_object('kind', 'pr', 'distance', x ->> 'kind'))
                                                                       from jsonb_array_elements(v_records) x), '[]'::jsonb))
                       with ordinality t(e, ord) order by ord limit 6) h), '[]'::jsonb),
              case when coalesce(v_settings.feed_show_map, true) and jsonb_typeof(p -> 'feed' -> 'route') = 'array'
                   then array(select jsonb_array_elements_text(p -> 'feed' -> 'route')) end,
              case when coalesce(v_settings.feed_show_map, true) and jsonb_typeof(p -> 'feed' -> 'route') = 'array'
                   then coalesce((p -> 'feed' ->> 'routeHidden')::boolean, true) else true end,
              pr.is_demo)
      on conflict (activity_id) do nothing
      returning id into v_item;
      v_raw := v_raw || jsonb_build_object('feed', jsonb_build_object('itemId', v_item));
    end if;
  end if;

  update public.activities set v2_extras = v_raw where id = v_act;
  return v_raw || jsonb_build_object('repeated', false);
end $$;
revoke all on function public.svc_apply_v2(jsonb) from public, anon, authenticated;
grant execute on function public.svc_apply_v2(jsonb) to service_role;
