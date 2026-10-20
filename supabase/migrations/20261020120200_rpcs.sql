-- NOMADE RUN — T1.1: RPCs do cliente (API_CONTRATO.md) e funções internas usadas pelas Edge Functions.
-- Erros esperados são levantados como 'CODIGO: mensagem em pt-BR' (errcode P0001), para o app exibir a mensagem.

-- ---------------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------------
create or replace function private.faction_name(f text) returns text
language sql immutable set search_path = '' as $$
  select case f
    when 'striders' then 'Neon Striders'
    when 'volt' then 'Volt Runners'
    when 'owls' then 'Night Owls'
    when 'coyotes' then 'Urban Coyotes'
    else coalesce(f, '') end
$$;

create or replace function private.zone_label(p_id text, p_name text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(p_name, ''), 'Zona ' || upper(substr(p_id, 8, 4)))
$$;

create or replace function private.ms_to_ts(ms double precision) returns timestamptz
language sql immutable set search_path = '' as $$ select case when ms is null then null else to_timestamp(ms / 1000.0) end $$;

create or replace function private.ts_to_ms(ts timestamptz) returns bigint
language sql immutable set search_path = '' as $$ select case when ts is null then null else (extract(epoch from ts) * 1000)::bigint end $$;

-- ---------------------------------------------------------------------------
-- RF-003 / RN-011: escolha e troca de facção
-- ---------------------------------------------------------------------------
create or replace function public.choose_faction(p_faction text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_prof public.profiles;
  v_season text := public.current_season_id();
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001';
  end if;
  if p_faction is null or p_faction not in ('striders', 'coyotes', 'owls', 'volt') then
    raise exception 'INVALID_FACTION: facção inválida' using errcode = 'P0001';
  end if;
  select * into v_prof from public.profiles where id = v_uid for update;
  if v_prof.faction is null then
    update public.profiles set faction = p_faction where id = v_uid;
  elsif v_prof.faction = p_faction then
    null; -- nada muda
  elsif v_prof.faction_changed_season = v_season then
    raise exception 'FACTION_CHANGE_LIMIT: a facção só pode ser trocada uma vez por temporada' using errcode = 'P0001';
  else
    update public.profiles
      set faction = p_faction, faction_changed_season = v_season, contribution_reset_at = now()
      where id = v_uid;
    delete from public.crew_members where user_id = v_uid; -- RN-011: sai da crew ao trocar de facção
  end if;
  select * into v_prof from public.profiles where id = v_uid;
  return jsonb_build_object(
    'faction', v_prof.faction,
    'factionChangedSeason', v_prof.faction_changed_season,
    'canChangeThisSeason', v_prof.faction_changed_season is distinct from v_season
  );
end $$;

-- ---------------------------------------------------------------------------
-- RF-011: crews
-- ---------------------------------------------------------------------------
create or replace function public.join_crew(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_crew public.crews;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.crew_members where user_id = v_uid) then
    raise exception 'ALREADY_IN_CREW: saia da crew atual antes de entrar em outra' using errcode = 'P0001';
  end if;
  select * into v_crew from public.crews where invite_code = upper(btrim(coalesce(p_code, '')));
  if v_crew.id is null then
    raise exception 'CREW_NOT_FOUND: código de convite inválido' using errcode = 'P0001';
  end if;
  insert into public.crew_members (crew_id, user_id, role) values (v_crew.id, v_uid, 'member');
  return jsonb_build_object('crewId', v_crew.id, 'name', v_crew.name, 'tag', v_crew.tag, 'faction', v_crew.faction);
end $$;

create or replace function public.leave_crew() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001';
  end if;
  delete from public.crew_members where user_id = v_uid;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- RF-019: marcar notificações como lidas (ids nulo = todas)
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(ids uuid[] default null) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  n integer;
begin
  update public.notifications set read_at = now()
   where user_id = (select auth.uid()) and read_at is null and (ids is null or id = any (ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- RF-002: administrador inativa/reativa contas (inativa também bloqueia o login)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN: apenas administradores podem alterar o status de contas' using errcode = 'P0001';
  end if;
  if p_status not in ('active', 'inactive', 'suspended') then
    raise exception 'INVALID_STATUS: status inválido' using errcode = 'P0001';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'FORBIDDEN: não é possível alterar o próprio status' using errcode = 'P0001';
  end if;
  update public.profiles
     set status = p_status,
         suspended_until = case when p_status = 'suspended' then now() + interval '30 days' else null end
   where id = p_user_id;
  if not found then
    raise exception 'NOT_FOUND: usuário não encontrado' using errcode = 'P0001';
  end if;
  update auth.users
     set banned_until = case when p_status = 'inactive' then 'infinity'::timestamptz else null end
   where id = p_user_id;
  return jsonb_build_object('userId', p_user_id, 'status', p_status);
end $$;

-- ---------------------------------------------------------------------------
-- RF-007 / RNF-009: zonas visíveis na tela (índice GiST, máx. 2.000)
-- ---------------------------------------------------------------------------
create or replace function public.zones_in_bbox(
  min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision
) returns table (
  id text, name text, city text, owner text, influence jsonb, shield smallint, attacker text,
  attack_started_at timestamptz, blocked boolean, updated_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select z.id, z.name, z.city, z.owner, z.influence, z.shield, z.attacker, z.attack_started_at, z.blocked, z.updated_at
    from public.zones z
   where extensions.st_intersects(z.geom, extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326))
   limit 2000
$$;

-- Permissões das RPCs do cliente
revoke all on function public.choose_faction(text) from public, anon;
revoke all on function public.join_crew(text) from public, anon;
revoke all on function public.leave_crew() from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.admin_set_user_status(uuid, text) from public, anon;
revoke all on function public.zones_in_bbox(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.choose_faction(text) to authenticated;
grant execute on function public.join_crew(text) to authenticated;
grant execute on function public.leave_crew() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
grant execute on function public.zones_in_bbox(double precision, double precision, double precision, double precision) to authenticated, service_role;

-- ===========================================================================
-- Funções internas (svc_*): só o service role (Edge Functions) executa.
-- ===========================================================================

-- D-04: registra (ou renova) a chave HMAC do aparelho. Idempotente por deviceId.
create or replace function public.svc_register_device(
  p_user uuid, p_device uuid, p_secret_b64 text, p_platform text, p_model text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.devices where id = p_device for update;
  if v_owner is not null and v_owner <> p_user then
    return jsonb_build_object('error', 'DEVICE_TAKEN');
  end if;
  insert into public.devices (id, user_id, secret, platform, model)
  values (p_device, p_user, decode(p_secret_b64, 'base64'), p_platform, p_model)
  on conflict (id) do update
    set secret = excluded.secret, platform = excluded.platform, model = excluded.model, last_seen_at = now();
  return jsonb_build_object('deviceId', p_device);
end $$;

-- Segredo do aparelho (base64) para conferir a assinatura do lote.
create or replace function public.svc_device_secret(p_user uuid, p_device uuid) returns text
language sql stable security definer set search_path = '' as $$
  select encode(secret, 'base64') from public.devices where id = p_device and user_id = p_user
$$;

-- D-03: ingestão idempotente de um lote já autenticado e com assinatura conferida.
create or replace function public.svc_ingest_points(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (p ->> 'userId')::uuid;
  v_act uuid := (p ->> 'activityId')::uuid;
  v_dev uuid := (p ->> 'deviceId')::uuid;
  v_from integer := (p ->> 'fromSeq')::integer;
  v_to integer := (p ->> 'toSeq')::integer;
  v_status text;
  a public.activities;
  v_dups integer;
  v_mismatch integer;
  v_inserted integer;
  v_first_t double precision := (p -> 'points' -> 0 ->> 't')::double precision;
begin
  select status into v_status from public.profiles where id = v_user;
  if v_status is null or v_status = 'inactive' then
    return jsonb_build_object('error', 'ACCOUNT_INACTIVE');
  end if;

  insert into public.activities (id, user_id, device_id, started_at, mission, ghost_pace)
  values (
    v_act, v_user, v_dev,
    private.ms_to_ts(coalesce((p ->> 'startedAt')::double precision, v_first_t)),
    coalesce(p ->> 'mission', 'livre'),
    (p ->> 'ghostPace')::real
  )
  on conflict (id) do nothing;

  select * into a from public.activities where id = v_act for update;
  if a.user_id <> v_user then
    return jsonb_build_object('error', 'NOT_OWNER');
  end if;
  if a.device_id is distinct from v_dev then
    return jsonb_build_object('error', 'DEVICE_MISMATCH', 'lastSeq', a.last_seq);
  end if;
  if a.status <> 'recording' then
    return jsonb_build_object('error', 'ACTIVITY_CLOSED', 'lastSeq', a.last_seq);
  end if;
  if v_from > a.last_seq + 1 then
    return jsonb_build_object('error', 'OUT_OF_ORDER', 'lastSeq', a.last_seq);
  end if;

  with incoming as (
    select * from jsonb_to_recordset(p -> 'points') as x(
      seq integer, lat double precision, lng double precision, t bigint, accuracy double precision,
      speed double precision, altitude double precision, mocked boolean, steps integer)
  )
  select count(ap.seq),
         count(ap.seq) filter (where (ap.lat, ap.lng, ap.t, ap.accuracy, ap.speed, ap.altitude, ap.mocked, ap.steps)
                                     is distinct from (i.lat, i.lng, i.t, i.accuracy, i.speed, i.altitude, i.mocked, i.steps))
    into v_dups, v_mismatch
    from incoming i
    left join public.activity_points ap on ap.activity_id = v_act and ap.seq = i.seq;

  if v_mismatch > 0 then
    return jsonb_build_object('error', 'REPLAY_MISMATCH', 'lastSeq', a.last_seq);
  end if;

  insert into public.activity_points (activity_id, seq, lat, lng, t, accuracy, speed, altitude, mocked, steps)
  select v_act, x.seq, x.lat, x.lng, x.t, x.accuracy, x.speed, x.altitude, x.mocked, x.steps
    from jsonb_to_recordset(p -> 'points') as x(
      seq integer, lat double precision, lng double precision, t bigint, accuracy double precision,
      speed double precision, altitude double precision, mocked boolean, steps integer)
   where x.seq > a.last_seq
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  update public.activities set last_seq = greatest(last_seq, v_to) where id = v_act;
  update public.devices set last_seen_at = now() where id = v_dev;

  return jsonb_build_object('accepted', v_inserted, 'duplicates', v_dups, 'lastSeq', greatest(a.last_seq, v_to));
end $$;

-- Carrega a corrida e os pontos (jsonb único: não sofre o limite de linhas da API).
create or replace function public.svc_load_activity(p_activity uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'activity', to_jsonb(a) - 'result',
    'result', a.result,
    'points', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seq', ap.seq, 'lat', ap.lat, 'lng', ap.lng, 't', ap.t, 'accuracy', ap.accuracy,
        'speed', ap.speed, 'altitude', ap.altitude, 'mocked', ap.mocked, 'steps', ap.steps) order by ap.seq)
      from public.activity_points ap where ap.activity_id = a.id), '[]'::jsonb)
  )
  from public.activities a where a.id = p_activity
$$;

-- Contexto para o cálculo oficial (RN-001: ritmo-base, sequência, limite diário; zonas atuais; neblina).
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
      select jsonb_agg(f.cell) from public.fog_cells f where f.user_id = p_user and f.cell = any (p_fog_cells)), '[]'::jsonb)
  )
$$;

-- Notifica corredores de uma facção que correram na zona nos últimos 30 dias (RF-009).
-- Para alertas de invasão aplica RN-003: 1 por zona a cada 6 h e no máximo 5 por dia.
create or replace function private.notify_zone_runners(
  p_zone text, p_faction text, p_type text, p_title text, p_body text, p_data jsonb, p_exclude uuid
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.notifications (user_id, type, title, body, data)
  select r.user_id, p_type, p_title, p_body, p_data
    from (
      select distinct az.user_id
        from public.activity_zones az
        join public.profiles pr on pr.id = az.user_id
       where az.zone_id = p_zone
         and az.created_at > now() - interval '30 days'
         and pr.faction = p_faction
         and pr.status <> 'inactive'
         and az.user_id is distinct from p_exclude
         and coalesce((pr.notification_prefs ->> 'invasion')::boolean, true)
    ) r
   where p_type <> 'invasion' or (
     not exists (
       select 1 from public.notifications n
        where n.user_id = r.user_id and n.type = 'invasion' and n.data ->> 'zoneId' = p_zone
          and n.created_at > now() - interval '6 hours')
     and (select count(*) from public.notifications n
           where n.user_id = r.user_id and n.type = 'invasion' and n.created_at >= public.br_day_start()) < 5
   );
  get diagnostics n = row_count;
  return n;
end $$;

-- Grava o resultado oficial de uma corrida numa única transação (D-23).
-- As zonas são travadas (SELECT ... FOR UPDATE, em ordem de id) e a versão lida pelo cálculo é conferida:
-- se outra corrida mexeu nelas no meio tempo, levanta ZONE_CONFLICT e a Edge Function recalcula.
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

    update public.profiles set xp = xp + greatest(0, coalesce((p ->> 'xp')::integer, 0)) where id = v_user;
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
         result = p -> 'result'
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

  return jsonb_build_object('ok', true, 'notified', v_notified);
end $$;

-- RF-018: rejeição pela moderação
create or replace function public.svc_moderate_reject(p_activity uuid, p_moderator uuid, p_justification text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.activities;
begin
  select * into a from public.activities where id = p_activity for update;
  if a.id is null then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;
  if a.status <> 'review' then
    return jsonb_build_object('error', 'NOT_IN_REVIEW');
  end if;
  update public.activities
     set status = 'rejected', scored = false, rp_total = 0, xp = 0, review_reason = 'MODERATION_REJECTED',
         result = coalesce(result, '{}'::jsonb) || jsonb_build_object('status', 'rejected', 'rpTotal', 0, 'xp', 0, 'zones', '[]'::jsonb)
   where id = p_activity;
  insert into public.moderation_reviews (activity_id, moderator_id, decision, justification)
  values (p_activity, p_moderator, 'reject', p_justification);
  insert into public.notifications (user_id, type, title, body, data)
  values (a.user_id, 'moderation', 'Corrida rejeitada',
          format('Sua corrida foi rejeitada pela moderação e não gera pontos. Justificativa: %s', p_justification),
          jsonb_build_object('activityId', p_activity, 'decision', 'reject'));
  return jsonb_build_object('ok', true);
end $$;

-- Detalhe da zona para a folha (RF-007): 3 maiores corredores da temporada e 10 últimos eventos.
create or replace function public.svc_zone_detail(p_zone text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'zone', jsonb_build_object(
      'id', z.id, 'name', z.name, 'city', z.city, 'owner', z.owner, 'influence', z.influence, 'shield', z.shield,
      'attacker', z.attacker, 'attackStartedAt', private.ts_to_ms(z.attack_started_at), 'blocked', z.blocked,
      'updatedAt', private.ts_to_ms(z.updated_at)),
    'topRunners', coalesce((
      select jsonb_agg(jsonb_build_object('username', t.username, 'faction', t.faction, 'rp', t.rp) order by t.rp desc)
        from (select pr.username, az.faction, sum(az.rp)::integer as rp
                from public.activity_zones az join public.profiles pr on pr.id = az.user_id
               where az.zone_id = z.id and az.created_at >= public.season_start() and pr.status <> 'inactive'
               group by pr.username, az.faction
               order by rp desc limit 3) t), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('type', e.type, 'faction', e.faction, 'from', e.from_faction,
                                          'at', private.ts_to_ms(e.created_at)) order by e.created_at desc)
        from (select * from public.zone_events where zone_id = z.id order by created_at desc limit 10) e), '[]'::jsonb)
  )
  from public.zones z where z.id = p_zone
$$;

-- LGPD (RF-002, RNF-013): exportação dos dados pessoais
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
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname not in ('is_staff', 'is_admin')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
