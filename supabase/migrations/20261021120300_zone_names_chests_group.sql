-- NOMADE RUN — Fase 3 (A2): nomes de zonas novas (P-12), baús e M_grupo no cálculo oficial (P-12/P-19, RN-001),
-- exportação LGPD com as tabelas novas.

-- ---------------------------------------------------------------------------
-- P-12: nome legível para zona criada fora do seed (determinístico, sem IBGE).
-- Base = nome da zona com nome mais próxima (até ~3 km), sem o número final ("Jardim Goiás 24" → "Jardim Goiás");
-- sem vizinha, a cidade natal do corredor que criou a zona; sem cidade, "Zona".
-- Número = maior número já usado com essa base + 1 ("Jardim Goiás 39"; se só existe "Parque Flamboyant", vira
-- "Parque Flamboyant 2"). Cidade = a da vizinha (ou a cidade natal do corredor).
-- ---------------------------------------------------------------------------
create or replace function private.new_zone_name(p_geom extensions.geometry, p_user uuid, out o_name text, out o_city text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_c extensions.geometry := extensions.st_centroid(p_geom);
  v_base text;
  v_max integer;
begin
  select regexp_replace(z.name, '\s+\d+$', ''), z.city into v_base, o_city
    from public.zones z
   where z.name is not null and btrim(z.name) <> ''
     and extensions.st_dwithin(z.geom, v_c, 0.03)
     and extensions.st_distancesphere(extensions.st_centroid(z.geom), v_c) <= 3000
   order by z.geom operator(extensions.<->) v_c
   limit 1;
  if v_base is null or btrim(v_base) = '' then
    select nullif(btrim(pr.city), '') into o_city from public.profiles pr where pr.id = p_user;
    v_base := coalesce(o_city, 'Zona');
  end if;
  select max(substr(z.name, char_length(v_base) + 2)::integer) into v_max
    from public.zones z
   where left(z.name, char_length(v_base) + 1) = v_base || ' '
     and substr(z.name, char_length(v_base) + 2) ~ '^[0-9]{1,6}$';
  if v_max is null and exists (select 1 from public.zones z where z.name = v_base) then
    v_max := 1;
  end if;
  o_name := v_base || ' ' || (coalesce(v_max, 0) + 1);
end $$;

-- Zonas já criadas sem nome (antes desta migration) ganham nome agora, na ordem de criação.
do $$
declare
  r record;
  n record;
begin
  for r in select z.id, z.geom,
                  (select az.user_id from public.activity_zones az where az.zone_id = z.id order by az.created_at limit 1) as first_user
             from public.zones z where z.name is null or btrim(z.name) = '' order by z.created_at, z.id loop
    select * into n from private.new_zone_name(r.geom, r.first_user);
    update public.zones set name = n.o_name, city = coalesce(city, n.o_city) where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Contexto do cálculo oficial (D-23) + baús ainda fechados da missão Caça (RN-017).
-- ---------------------------------------------------------------------------
create or replace function public.svc_finish_context(
  p_user uuid, p_activity uuid, p_zone_ids text[], p_fog_cells text[]
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object(
        'faction', pr.faction, 'trust', pr.trust, 'status', pr.status, 'suspendedUntil', private.ts_to_ms(pr.suspended_until),
        'streakWeeks', pr.streak_weeks, 'role', pr.role)
      from public.profiles pr where pr.id = p_user),
    'recentPaces', coalesce((
      select jsonb_agg(r.avg_pace order by r.finished_at)
        from (select a.avg_pace, a.finished_at from public.activities a
               where a.user_id = p_user and a.id <> p_activity and a.scored and a.avg_pace > 0
               order by a.finished_at desc limit 10) r), '[]'::jsonb),
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id, 'name', z.name, 'influence', z.influence, 'owner', z.owner, 'shield', z.shield,
        'attacker', z.attacker, 'attackStartedAt', private.ts_to_ms(z.attack_started_at),
        'blocked', z.blocked, 'version', z.version))
        from public.zones z where z.id = any (p_zone_ids)), '[]'::jsonb),
    'earnedToday', coalesce((
      select jsonb_object_agg(s.zone_id, s.rp) from (
        select az.zone_id, sum(az.rp) as rp from public.activity_zones az
         where az.user_id = p_user and az.zone_id = any (p_zone_ids) and az.created_at >= public.br_day_start()
         group by az.zone_id) s), '{}'::jsonb),
    'revealedFog', coalesce((
      select jsonb_agg(f.cell) from public.fog_cells f where f.user_id = p_user and f.cell = any (p_fog_cells)), '[]'::jsonb),
    -- RN-017: baús fechados do usuário sorteados entre o dia (Brasília) do início da corrida e hoje; só na missão Caça
    'chests', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'lat', c.lat, 'lng', c.lng, 'rarity', c.rarity) order by c.id)
        from public.chests c
        join public.activities a on a.id = p_activity
       where c.user_id = p_user and c.opened_at is null and a.mission = 'caca'
         and c.day between (a.started_at at time zone 'America/Sao_Paulo')::date and public.br_today()), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------
-- RN-001 (M_grupo): percursos dos outros membros da Crew do corredor no mesmo intervalo de tempo.
-- Devolve, por membro, os pontos [t, lat, lng] entre p_from_ms − 15 s e p_to_ms + 15 s de corridas não
-- rejeitadas (inclusive as que ainda estão gravando, porque o app envia lotes a cada 5 s).
-- ---------------------------------------------------------------------------
create or replace function public.svc_crew_tracks(p_user uuid, p_from_ms bigint, p_to_ms bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (
    select cm.crew_id from public.crew_members cm where cm.user_id = p_user
  ), mates as (
    select cm.user_id from public.crew_members cm join me on me.crew_id = cm.crew_id where cm.user_id <> p_user
  ), acts as (
    select a.id, a.user_id from public.activities a join mates m on m.user_id = a.user_id
     where a.status <> 'rejected'
       and a.started_at <= private.ms_to_ts(p_to_ms + 15000)
       and a.started_at >= private.ms_to_ts(p_from_ms) - interval '12 hours'
  )
  select jsonb_build_object(
    'crewId', (select crew_id from me),
    'tracks', coalesce((
      select jsonb_agg(jsonb_build_object('userId', t.user_id, 'points', t.points))
        from (select acts.user_id,
                     jsonb_agg(jsonb_build_array(ap.t, ap.lat, ap.lng) order by ap.t) as points
                from acts join public.activity_points ap on ap.activity_id = acts.id
               where ap.t between p_from_ms - 15000 and p_to_ms + 15000
               group by acts.user_id) t), '[]'::jsonb))
$$;

-- Gravação do resultado oficial (D-23) + nomes de zonas novas + baús abertos (RN-017).
create or replace function public.svc_apply_activity_result(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_act uuid := (p ->> 'activityId')::uuid;
  v_user uuid := (p ->> 'userId')::uuid;
  v_mode text := coalesce(p ->> 'mode', 'finish');
  v_scored boolean := coalesce((p ->> 'scored')::boolean, false);
  v_faction text := p ->> 'faction';
  a public.activities;
  z jsonb;
  ev jsonb;
  v_ver integer;
  v_zone public.zones;
  v_center extensions.geometry;
  v_notified integer := 0;
  v_status text := p ->> 'status';
  v_names jsonb := '{}'::jsonb;
  v_new record;
  v_result jsonb := p -> 'result';
  v_chest_ids uuid[];
begin
  select * into a from public.activities where id = v_act for update;
  if a.id is null then
    raise exception 'NOT_FOUND: corrida não encontrada' using errcode = 'P0001';
  end if;
  if v_mode = 'finish' and a.status <> 'recording' then
    return jsonb_build_object('error', 'ALREADY_FINISHED', 'result', a.result);
  end if;
  if v_mode = 'approve' and a.status <> 'review' then
    return jsonb_build_object('error', 'NOT_IN_REVIEW');
  end if;

  if v_scored then
    -- trava as zonas existentes em ordem fixa (evita deadlock) e confere as versões
    perform 1 from public.zones where id in (select x ->> 'id' from jsonb_array_elements(p -> 'zones') x) order by id for update;
    for z in select * from jsonb_array_elements(coalesce(p -> 'zones', '[]'::jsonb)) loop
      select version into v_ver from public.zones where id = z ->> 'id';
      if (z ->> 'expectedVersion') is null then
        if v_ver is not null then
          raise exception 'ZONE_CONFLICT: zona % foi criada por outra corrida', z ->> 'id' using errcode = 'P0001';
        end if;
        insert into public.zones (id, name, geom, influence, owner, shield, attacker, attack_started_at, blocked, version)
        values (
          z ->> 'id', z ->> 'name',
          extensions.st_setsrid(extensions.st_geomfromgeojson(z ->> 'geom'), 4326),
          z -> 'influence', z ->> 'owner', (z ->> 'shield')::smallint, z ->> 'attacker',
          private.ms_to_ts((z ->> 'attackStartedAt')::double precision), coalesce((z ->> 'blocked')::boolean, false), 1)
        on conflict (id) do nothing;
        if not found then
          raise exception 'ZONE_CONFLICT: zona % foi criada por outra corrida', z ->> 'id' using errcode = 'P0001';
        end if;
        -- zona nova sem nome (fora do seed): nome legível e cidade da vizinha mais próxima (P-12)
        if coalesce(btrim(z ->> 'name'), '') = '' then
          select n.o_name, n.o_city into v_new
            from public.zones nz, private.new_zone_name(nz.geom, v_user) n
           where nz.id = z ->> 'id';
          update public.zones set name = v_new.o_name, city = v_new.o_city where id = z ->> 'id';
          v_names := v_names || jsonb_build_object(z ->> 'id', v_new.o_name);
        end if;
      else
        if v_ver is distinct from (z ->> 'expectedVersion')::integer then
          raise exception 'ZONE_CONFLICT: zona % mudou durante o cálculo', z ->> 'id' using errcode = 'P0001';
        end if;
        update public.zones
           set influence = z -> 'influence', owner = z ->> 'owner', shield = (z ->> 'shield')::smallint,
               attacker = z ->> 'attacker', attack_started_at = private.ms_to_ts((z ->> 'attackStartedAt')::double precision),
               version = version + 1, updated_at = now()
         where id = z ->> 'id';
      end if;
    end loop;

    insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome, owner_before, owner_after)
    select v_act, x ->> 'zoneId', v_user, v_faction, (x ->> 'meters')::real, (x ->> 'rp')::integer, x ->> 'outcome',
           x ->> 'ownerBefore', x ->> 'ownerAfter'
      from jsonb_array_elements(coalesce(p -> 'activityZones', '[]'::jsonb)) x
    on conflict (activity_id, zone_id) do nothing;

    insert into public.fog_cells (user_id, cell, activity_id)
    select v_user, c, v_act from jsonb_array_elements_text(coalesce(p -> 'fogCells', '[]'::jsonb)) c
    on conflict do nothing;

    -- eventos e notificações
    for ev in select * from jsonb_array_elements(coalesce(p -> 'events', '[]'::jsonb)) loop
      select * into v_zone from public.zones where id = ev ->> 'zoneId';
      v_center := extensions.st_centroid(v_zone.geom);
      insert into public.zone_events (zone_id, type, faction, from_faction, activity_id, user_id)
      values (
        ev ->> 'zoneId', ev ->> 'type',
        case ev ->> 'type' when 'captured' then ev ->> 'faction' when 'under_attack' then ev ->> 'attacker' else ev ->> 'owner' end,
        case ev ->> 'type' when 'captured' then ev ->> 'from' when 'under_attack' then ev ->> 'owner' when 'neutralized' then ev ->> 'from' else null end,
        v_act, v_user);

      if ev ->> 'type' = 'under_attack' then
        v_notified := v_notified + private.notify_zone_runners(
          ev ->> 'zoneId', ev ->> 'owner', 'invasion', 'Alerta de Invasão!',
          format('Seu território em %s está sendo conquistado pelos %s. Corra lá nas próximas 24h para defender.',
                 private.zone_label(v_zone.id, v_zone.name), private.faction_name(ev ->> 'attacker')),
          jsonb_build_object('zoneId', v_zone.id, 'attacker', ev ->> 'attacker',
                             'lat', extensions.st_y(v_center), 'lng', extensions.st_x(v_center)),
          v_user);
      elsif ev ->> 'type' = 'captured' then
        if ev ->> 'from' is not null then
          v_notified := v_notified + private.notify_zone_runners(
            ev ->> 'zoneId', ev ->> 'from', 'territory_lost', 'Território perdido',
            format('%s agora pertence aos %s. Corra lá para reconquistar.',
                   private.zone_label(v_zone.id, v_zone.name), private.faction_name(ev ->> 'faction')),
            jsonb_build_object('zoneId', v_zone.id, 'newOwner', ev ->> 'faction',
                               'lat', extensions.st_y(v_center), 'lng', extensions.st_x(v_center)),
            v_user);
        end if;
        if ev ->> 'faction' = v_faction then
          insert into public.notifications (user_id, type, title, body, data)
          select v_user, 'conquest', 'Zona conquistada',
                 format('Você conquistou %s para os %s.', private.zone_label(v_zone.id, v_zone.name), private.faction_name(v_faction)),
                 jsonb_build_object('zoneId', v_zone.id, 'activityId', v_act,
                                    'lat', extensions.st_y(v_center), 'lng', extensions.st_x(v_center))
            from public.profiles pr
           where pr.id = v_user and coalesce((pr.notification_prefs ->> 'conquest')::boolean, true);
        end if;
      end if;
    end loop;

    -- RN-017: baús abertos nesta corrida (uma vez cada; se outro finish abriu antes, recalcula)
    v_chest_ids := array(select (x ->> 'chestId')::uuid from jsonb_array_elements(coalesce(p -> 'chests', '[]'::jsonb)) x);
    if cardinality(v_chest_ids) > 0 then
      perform 1 from public.chests where id = any (v_chest_ids) order by id for update;
      if (select count(*) from public.chests where id = any (v_chest_ids) and user_id = v_user and opened_at is null)
         <> cardinality(v_chest_ids) then
        raise exception 'ZONE_CONFLICT: baú já aberto por outra corrida' using errcode = 'P0001';
      end if;
      update public.chests set opened_at = now(), activity_id = v_act where id = any (v_chest_ids);
      insert into public.chest_opens (user_id, chest_id, rarity, xp, lat, lng, activity_id)
      select v_user, c.id::text, c.rarity, private.chest_xp(c.rarity), c.lat, c.lng, v_act
        from public.chests c where c.id = any (v_chest_ids)
      on conflict do nothing;
    end if;

    update public.profiles set xp = xp + greatest(0, coalesce((p ->> 'xp')::integer, 0)) where id = v_user;
  end if;

  -- nomes das zonas criadas agora entram no resultado guardado e devolvido
  if v_names <> '{}'::jsonb and jsonb_typeof(v_result -> 'zones') = 'array' then
    v_result := jsonb_set(v_result, '{zones}', coalesce((
      select jsonb_agg(case when v_names ? (e ->> 'zoneId') then jsonb_set(e, '{name}', v_names -> (e ->> 'zoneId')) else e end
                       order by ord)
        from jsonb_array_elements(v_result -> 'zones') with ordinality t(e, ord)), '[]'::jsonb));
  end if;

  update public.activities
     set status = v_status,
         ended_at = coalesce(private.ms_to_ts((p ->> 'endedAt')::double precision), ended_at, now()),
         finished_at = now(),
         meters = coalesce((p ->> 'meters')::real, 0),
         moving_seconds = coalesce((p ->> 'movingSeconds')::real, 0),
         avg_pace = (p ->> 'avgPace')::real,
         rp_total = coalesce((p ->> 'rpTotal')::integer, 0),
         xp = coalesce((p ->> 'xp')::integer, 0),
         beat_ghost = (p ->> 'beatGhost')::boolean,
         flags = coalesce(array(select jsonb_array_elements_text(p -> 'flags')), '{}'),
         invalid_segments = coalesce(p -> 'invalidSegments', '[]'::jsonb),
         scored = v_scored,
         trust_after = coalesce((p ->> 'trustAfter')::smallint, trust_after),
         review_reason = p ->> 'reviewReason',
         result = v_result
   where id = v_act;

  if v_mode = 'finish' and (p ->> 'trustAfter') is not null then
    update public.profiles set trust = (p ->> 'trustAfter')::smallint where id = v_user;
  end if;
  if coalesce((p ->> 'suspend')::boolean, false) then
    update public.profiles set status = 'suspended', suspended_until = now() + interval '30 days'
     where id = v_user and status = 'active';
  end if;

  if v_mode = 'approve' then
    insert into public.moderation_reviews (activity_id, moderator_id, decision, justification)
    values (v_act, (p -> 'moderation' ->> 'moderatorId')::uuid, 'approve', p -> 'moderation' ->> 'justification');
    insert into public.notifications (user_id, type, title, body, data)
    values (v_user, 'moderation', 'Corrida aprovada',
            format('Sua corrida foi aprovada pela moderação e pontuou %s RP. Justificativa: %s',
                   coalesce(p ->> 'rpTotal', '0'), p -> 'moderation' ->> 'justification'),
            jsonb_build_object('activityId', v_act, 'decision', 'approve'));
  end if;

  return jsonb_build_object('ok', true, 'notified', v_notified, 'result', v_result);
end $$;


-- LGPD: exportação inclui baús e zonas de privacidade.
create or replace function public.svc_account_export(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exportedAt', now(),
    'profile', (select to_jsonb(pr) from public.profiles pr where pr.id = p_user),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'platform', d.platform, 'model', d.model,
                         'createdAt', d.created_at, 'lastSeenAt', d.last_seen_at)) from public.devices d where d.user_id = p_user), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg((to_jsonb(a) - 'result') || jsonb_build_object(
        'points', coalesce((select jsonb_agg(to_jsonb(ap) - 'activity_id' order by ap.seq)
                              from public.activity_points ap where ap.activity_id = a.id), '[]'::jsonb),
        'zones', coalesce((select jsonb_agg(to_jsonb(az) - 'activity_id' - 'user_id')
                             from public.activity_zones az where az.activity_id = a.id), '[]'::jsonb))
        order by a.started_at)
      from public.activities a where a.user_id = p_user), '[]'::jsonb),
    'safetyContacts', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id') from public.safety_contacts c where c.user_id = p_user), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at) from public.notifications n where n.user_id = p_user), '[]'::jsonb),
    'fogCells', coalesce((select jsonb_agg(f.cell) from public.fog_cells f where f.user_id = p_user), '[]'::jsonb),
    'chestOpens', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id') from public.chest_opens c where c.user_id = p_user), '[]'::jsonb),
    'chests', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.day, c.created_at) from public.chests c where c.user_id = p_user), '[]'::jsonb),
    'privacyZones', coalesce((select jsonb_agg(to_jsonb(z) - 'user_id' order by z.created_at) from public.privacy_zones z where z.user_id = p_user), '[]'::jsonb),
    'crew', (select jsonb_build_object('crewId', cm.crew_id, 'name', cr.name, 'tag', cr.tag, 'role', cm.role, 'joinedAt', cm.joined_at)
               from public.crew_members cm join public.crews cr on cr.id = cm.crew_id where cm.user_id = p_user),
    'moderationReviews', coalesce((select jsonb_agg(jsonb_build_object('activityId', m.activity_id, 'decision', m.decision,
                                   'justification', m.justification, 'createdAt', m.created_at))
                                   from public.moderation_reviews m join public.activities a on a.id = m.activity_id
                                  where a.user_id = p_user), '[]'::jsonb)
  )
$$;


-- Só o service role executa as funções internas
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'svc\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
revoke all on function private.new_zone_name(extensions.geometry, uuid) from public, anon, authenticated;
