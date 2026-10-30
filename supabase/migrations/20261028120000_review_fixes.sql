-- NOMADE RUN — correções da revisão da lógica v2 (revisor-onda4-logica.md: A1, M1–M5, B4). Só aditivo.
--   * A1 (D-87): o corte de privacidade do retrato da pintura (e do percurso visto pela staff) deixa de ser o círculo
--     exato da zona, cujo "buraco" entregava o centro (a casa) com 3,5 m de erro. Cada zona ganha uma MÁSCARA estável:
--     centro deslocado de 0,6 a 1,0 × raio numa direção sorteada e raio = raio + deslocamento + folga (25–85 m), que
--     cobre a zona inteira. Os sorteios são gravados UMA vez por zona (mover a zona move a máscara junto, com o mesmo
--     deslocamento), para não dar para tirar a média de vários retratos;
--   * M1: teto de 200 aplausos por dia conta os itens aplaudidos no dia (kudos_log), que desfazer não apaga; o autor só
--     é avisado quando o par (pessoa, item) é novo no dia (refazer não reabre o aviso); "1 reação" no singular;
--   * M2: track_events e set_telemetry_consent pegam a mesma trava por pessoa ANTES de ler/gravar o consentimento;
--   * M3: criar ou mover uma zona de privacidade tira na hora as rotas da pessoa já publicadas no feed;
--   * M4: kudos sai do Realtime (DELETE não passa pela RLS e levava user_id); entra feed_kudos_counts, só contadores
--     por item, sem dado pessoal, com a RLS de can_see_feed_item;
--   * M5: "Minha semana" só conta como conquista a zona que ficou com o time da pessoa;
--   * B4: league_current mostra a semana anterior até o fechamento (segunda 03:20).

-- ===========================================================================
-- A1 (D-87): máscara estável por zona de privacidade
-- ===========================================================================
create table private.privacy_zone_masks (
  zone_id uuid primary key references public.privacy_zones (id) on delete cascade,
  offset_frac real not null check (offset_frac between 0.6 and 1),       -- deslocamento / raio (sorteado 1 vez)
  azimuth real not null check (azimuth >= 0 and azimuth < 6.2832),       -- direção em radianos (sorteada 1 vez)
  margin_m real not null check (margin_m between 25 and 85),              -- folga (sorteada 1 vez)
  lat double precision not null default 0,
  lng double precision not null default 0,
  radius_m real not null default 1 check (radius_m > 0)
);
create index privacy_zone_masks_lat_lng_idx on private.privacy_zone_masks (lat, lng);
alter table private.privacy_zone_masks enable row level security;
revoke all on private.privacy_zone_masks from public, anon, authenticated;
comment on table private.privacy_zone_masks is
  'D-87: máscara de cada zona de privacidade (centro deslocado e raio maior, sorteados uma vez). Nunca sai do banco.';

-- Cria (com sorteio) ou atualiza a máscara de uma zona; o sorteio de uma zona que já tem máscara não muda.
create or replace function private.privacy_mask_apply(p_zone uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.privacy_zone_masks (zone_id, offset_frac, azimuth, margin_m)
  select z.id, 0.6 + 0.4 * random(), least(6.2831, 2 * pi() * random()), 25 + 60 * random()
    from public.privacy_zones z where z.id = p_zone
  on conflict (zone_id) do nothing;
  update private.privacy_zone_masks m
     set lat = x.lat, lng = x.lng, radius_m = x.r
    from (select mm.zone_id, extensions.st_y(c.pt) as lat, extensions.st_x(c.pt) as lng,
                 z.radius_m * (1 + mm.offset_frac) + mm.margin_m as r
            from private.privacy_zone_masks mm
            join public.privacy_zones z on z.id = mm.zone_id
            cross join lateral (select extensions.st_project(
                                         extensions.st_setsrid(extensions.st_makepoint(z.lng, z.lat), 4326)::extensions.geography,
                                         z.radius_m * mm.offset_frac, mm.azimuth)::extensions.geometry as pt) c
           where mm.zone_id = p_zone) x
   where m.zone_id = x.zone_id;
end $$;
revoke all on function private.privacy_mask_apply(uuid) from public, anon, authenticated;

create or replace function private.privacy_zones_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.privacy_mask_apply(new.id);
  -- M3: a rota já publicada no feed foi cortada sem esta zona: sai na hora (o resto do item fica)
  update public.feed_items set route = null, route_hidden = true where user_id = new.user_id and route is not null;
  return null;
end $$;
revoke all on function private.privacy_zones_after_write() from public, anon, authenticated;

create trigger privacy_zones_after_write after insert or update of lat, lng, radius_m on public.privacy_zones
  for each row execute function private.privacy_zones_after_write();

select private.privacy_mask_apply(id) from public.privacy_zones;

-- Retrato da pintura (cells e paintedToday): esconde o que cai na máscara de QUALQUER zona (raio máx. ≈ 2.085 m).
create or replace function private.cell_in_privacy_zone(p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.privacy_zone_masks m
     where m.lat between p_lat - 0.02 and p_lat + 0.02
       and abs(m.lng - p_lng) <= 0.02 / greatest(cos(radians(p_lat)), 0.2)
       and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
                                 extensions.st_setsrid(extensions.st_makepoint(m.lng, m.lat), 4326)::extensions.geography,
                                 m.radius_m))
$$;
revoke all on function private.cell_in_privacy_zone(double precision, double precision) from public, anon, authenticated;

-- Percurso de outra pessoa visto pela staff (activity_points_read): mesmo corte pela máscara.
create or replace function private.in_privacy_zone(p_user uuid, p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.privacy_zones pz
      join private.privacy_zone_masks m on m.zone_id = pz.id
     where pz.user_id = p_user
       and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
                                 extensions.st_setsrid(extensions.st_makepoint(m.lng, m.lat), 4326)::extensions.geography,
                                 m.radius_m))
$$;

-- ===========================================================================
-- M1: teto de aplausos por itens do dia + aviso só no par novo + singular
-- ===========================================================================
create table public.kudos_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  primary key (user_id, day, feed_item_id)
);
alter table public.kudos_log enable row level security;
revoke all on public.kudos_log from anon, authenticated;
comment on table public.kudos_log is
  'M1: itens que cada pessoa aplaudiu no dia (teto de 200; desfazer não apaga). Guarda 2 dias. Só pelo servidor.';
insert into public.kudos_log (user_id, day, feed_item_id)
select k.user_id, k.day, k.feed_item_id from public.kudos k where k.day >= public.br_today() - 1
on conflict do nothing;

create or replace function private.kudos_text(p_total integer) returns text
language sql immutable set search_path = '' as $$
  select case when p_total = 1 then 'Sua corrida ganhou 1 reação da crew.'
              else format('Sua corrida ganhou %s reações da crew.', p_total) end
$$;
revoke all on function private.kudos_text(integer) from public, anon, authenticated;

create or replace function public.react_feed_item(p_item uuid, p_reaction text default 'bora') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  f public.feed_items;
  v_had boolean;
  v_total integer;
  v_note uuid;
  v_new_pair boolean;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('feed') then
    raise exception 'FEATURE_DISABLED: feed ainda não está ligado' using errcode = 'P0001';
  end if;
  if p_reaction is not null and p_reaction not in ('bora', 'fogo', 'raio') then
    raise exception 'VALIDATION: reação inválida' using errcode = 'P0001';
  end if;
  select * into f from public.feed_items x where x.id = p_item;
  if f.id is null or not private.can_see_feed_item(p_item) then
    raise exception 'NOT_FOUND: item do feed não encontrado' using errcode = 'P0001';
  end if;
  if f.user_id = v_uid then
    raise exception 'KUDOS_SELF: não dá para aplaudir a própria corrida' using errcode = 'P0001';
  end if;
  if p_reaction is null then
    delete from public.kudos where feed_item_id = p_item and user_id = v_uid;
    return private.feed_item_json(f, v_uid);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('kudos:' || v_uid || ':' || public.br_today(), 0));
  v_had := exists (select 1 from public.kudos k where k.feed_item_id = p_item and k.user_id = v_uid);
  -- M1: o teto conta os itens aplaudidos no dia (kudos_log), que desfazer não apaga
  v_new_pair := not exists (select 1 from public.kudos_log g where g.user_id = v_uid and g.day = public.br_today()
                                                              and g.feed_item_id = p_item);
  if v_new_pair and (select count(*) from public.kudos_log g where g.user_id = v_uid and g.day = public.br_today()) >= 200 then
    raise exception 'KUDOS_LIMIT: limite de 200 reações por dia' using errcode = 'P0001';
  end if;
  if v_new_pair then
    delete from public.kudos_log g where g.user_id = v_uid and g.day < public.br_today() - 1;
    insert into public.kudos_log (user_id, day, feed_item_id) values (v_uid, public.br_today(), p_item);
  end if;
  insert into public.kudos (feed_item_id, user_id, reaction) values (p_item, v_uid, p_reaction)
  on conflict (feed_item_id, user_id) do update set reaction = excluded.reaction;

  -- M1: só avisa o autor quando o par (pessoa, item) é novo no dia; refazer não reabre o aviso
  if not v_had and v_new_pair and private.notify_pref(f.user_id, 'kudos') then
    v_total := (select count(*) from public.kudos k where k.feed_item_id = p_item);
    select n.id into v_note from public.notifications n
     where n.user_id = f.user_id and n.type = 'kudos' and n.data ->> 'feedItemId' = p_item::text
       and n.created_at >= public.br_day_start()
     order by n.created_at desc limit 1;
    if v_note is null then
      insert into public.notifications (user_id, type, title, body, data)
      values (f.user_id, 'kudos', 'Bora!', private.kudos_text(v_total),
              jsonb_build_object('kind', 'kudos', 'feedItemId', p_item, 'count', v_total));
    else
      update public.notifications
         set body = private.kudos_text(v_total),
             data = data || jsonb_build_object('count', v_total), read_at = null
       where id = v_note;
    end if;
  end if;
  return private.feed_item_json(f, v_uid);
end $$;
revoke all on function public.react_feed_item(uuid, text) from public, anon;
grant execute on function public.react_feed_item(uuid, text) to authenticated;

-- ===========================================================================
-- M4: kudos fora do Realtime; contadores por item, sem dado pessoal
-- ===========================================================================
create table public.feed_kudos_counts (
  feed_item_id uuid primary key references public.feed_items (id) on delete cascade,
  bora integer not null default 0 check (bora >= 0),
  fogo integer not null default 0 check (fogo >= 0),
  raio integer not null default 0 check (raio >= 0),
  total integer not null default 0 check (total >= 0)
);
alter table public.feed_kudos_counts enable row level security;
revoke all on public.feed_kudos_counts from anon, authenticated;
grant select on public.feed_kudos_counts to authenticated;   -- o Realtime aplica esta RLS na assinatura (INSERT/UPDATE)
create policy feed_kudos_counts_select on public.feed_kudos_counts for select to authenticated
  using ((select private.can_see_feed_item(feed_item_id)));
create policy feed_kudos_counts_active_account on public.feed_kudos_counts as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
comment on table public.feed_kudos_counts is
  'M4: contadores de reação por item do feed, para o Realtime. Sem user_id (o DELETE do Realtime não passa pela RLS).';

create or replace function private.feed_kudos_recount(p_item uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.feed_kudos_counts (feed_item_id, bora, fogo, raio, total)
  select p_item, count(*) filter (where k.reaction = 'bora'), count(*) filter (where k.reaction = 'fogo'),
         count(*) filter (where k.reaction = 'raio'), count(*)
    from public.kudos k
   where k.feed_item_id = p_item and exists (select 1 from public.feed_items f where f.id = p_item)
  having exists (select 1 from public.feed_items f where f.id = p_item)
  on conflict (feed_item_id) do update
    set bora = excluded.bora, fogo = excluded.fogo, raio = excluded.raio, total = excluded.total
    where (public.feed_kudos_counts.bora, public.feed_kudos_counts.fogo, public.feed_kudos_counts.raio)
          is distinct from (excluded.bora, excluded.fogo, excluded.raio)
$$;
revoke all on function private.feed_kudos_recount(uuid) from public, anon, authenticated;

create or replace function private.kudos_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.feed_kudos_recount(coalesce(new.feed_item_id, old.feed_item_id));
  return null;
end $$;
revoke all on function private.kudos_after_write() from public, anon, authenticated;
create trigger kudos_after_write after insert or update or delete on public.kudos
  for each row execute function private.kudos_after_write();

select private.feed_kudos_recount(id) from public.feed_items where exists (select 1 from public.kudos k where k.feed_item_id = feed_items.id);

alter publication supabase_realtime drop table public.kudos;
alter publication supabase_realtime add table public.feed_kudos_counts;

-- ===========================================================================
-- M2: telemetria — a mesma trava nas duas funções
-- ===========================================================================
create or replace function public.set_telemetry_consent(p_opt_in boolean, p_policy_version integer default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_deleted integer := 0;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if p_opt_in is null then raise exception 'VALIDATION: informe true ou false' using errcode = 'P0001'; end if;
  if p_policy_version is null or p_policy_version not between 1 and 100 then
    raise exception 'VALIDATION: versão da política inválida' using errcode = 'P0001';
  end if;
  -- M2: mesma trava do track_events: o envio em andamento termina antes (e é apagado aqui) ou já vê o consentimento novo
  perform pg_advisory_xact_lock(hashtextextended('telemetry:' || v_uid, 0));
  insert into public.telemetry_consent (user_id, opted_in, policy_version, updated_at)
  values (v_uid, p_opt_in, p_policy_version, now())
  on conflict (user_id) do update set opted_in = excluded.opted_in, policy_version = excluded.policy_version, updated_at = now();
  if not p_opt_in then
    delete from public.telemetry_events where user_id = v_uid;
    get diagnostics v_deleted = row_count;
  end if;
  return jsonb_build_object('optedIn', p_opt_in, 'policyVersion', p_policy_version, 'deletedEvents', v_deleted);
end $$;
revoke all on function public.set_telemetry_consent(boolean, integer) from public, anon;
grant execute on function public.set_telemetry_consent(boolean, integer) to authenticated;

create or replace function public.track_events(p_events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := public.br_today();
  v_cap integer := 200;
  e jsonb;
  v_event text;
  v_day date;
  v_props jsonb;
  v_version text;
  v_platform text;
  v_accepted integer := 0;
  v_dropped integer := 0;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('telemetry') then
    raise exception 'FEATURE_DISABLED: telemetria não está ligada' using errcode = 'P0001';
  end if;
  -- M2: trava ANTES de ler o consentimento (set_telemetry_consent pega a mesma trava)
  perform pg_advisory_xact_lock(hashtextextended('telemetry:' || v_uid, 0));
  if not coalesce((select c.opted_in from public.telemetry_consent c where c.user_id = v_uid for share), false) then
    raise exception 'TELEMETRY_CONSENT: sem consentimento, nenhum evento é gravado' using errcode = 'P0001';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 50
     or octet_length(p_events::text) > 32768 then
    raise exception 'VALIDATION: envie de 1 a 50 eventos' using errcode = 'P0001';
  end if;

  -- 1ª passada: valida tudo antes de gravar qualquer coisa
  for e in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(e) <> 'object'
       or exists (select 1 from jsonb_object_keys(e) k where k not in ('event', 'day', 'props', 'appVersion', 'platform')) then
      raise exception 'VALIDATION: evento com formato inválido' using errcode = 'P0001';
    end if;
    if jsonb_typeof(e -> 'event') is distinct from 'string'
       or (e ->> 'event') not in ('app_open', 'run_finish', 'zone_conquer', 'share', 'mission_complete') then
      raise exception 'VALIDATION: evento fora da lista' using errcode = 'P0001';
    end if;
    if e ? 'day' then
      if jsonb_typeof(e -> 'day') <> 'string' or (e ->> 'day') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'VALIDATION: dia inválido (hoje ou até 2 dias atrás)' using errcode = 'P0001';
      end if;
      begin
        v_day := (e ->> 'day')::date;
      exception when others then
        raise exception 'VALIDATION: dia inválido (hoje ou até 2 dias atrás)' using errcode = 'P0001';
      end;
      if v_day not between v_today - 2 and v_today then
        raise exception 'VALIDATION: dia inválido (hoje ou até 2 dias atrás)' using errcode = 'P0001';
      end if;
    end if;
    if e ? 'props' and not private.telemetry_props_ok(e -> 'props') then
      raise exception 'VALIDATION: props fora da lista (sem localização, texto curto)' using errcode = 'P0001';
    end if;
    if e ? 'appVersion' and (jsonb_typeof(e -> 'appVersion') <> 'string' or (e ->> 'appVersion') !~ '^[0-9A-Za-z.+-]{1,20}$') then
      raise exception 'VALIDATION: versão do app inválida' using errcode = 'P0001';
    end if;
    if e ? 'platform' and (jsonb_typeof(e -> 'platform') <> 'string' or (e ->> 'platform') not in ('ios', 'android', 'web')) then
      raise exception 'VALIDATION: plataforma inválida' using errcode = 'P0001';
    end if;
  end loop;

  for e in select value from jsonb_array_elements(p_events) loop
    v_event := e ->> 'event';
    v_day := coalesce((e ->> 'day')::date, v_today);
    v_props := coalesce(e -> 'props', '{}'::jsonb);
    v_version := e ->> 'appVersion';
    v_platform := e ->> 'platform';
    if (select count(*) from public.telemetry_events t where t.user_id = v_uid and t.day = v_day) >= v_cap
       or (v_event = 'app_open' and exists (select 1 from public.telemetry_events t
                                             where t.user_id = v_uid and t.day = v_day and t.event = 'app_open')) then
      v_dropped := v_dropped + 1;
    else
      insert into public.telemetry_events (user_id, event, day, props, app_version, platform)
      values (v_uid, v_event, v_day, v_props, v_version, v_platform);
      v_accepted := v_accepted + 1;
    end if;
  end loop;
  return jsonb_build_object('accepted', v_accepted, 'dropped', v_dropped);
end $$;
revoke all on function public.track_events(jsonb) from public, anon;
grant execute on function public.track_events(jsonb) to authenticated;

-- ===========================================================================
-- M5: "Minha semana" conta só as zonas que ficaram com o time da pessoa
-- ===========================================================================
create or replace function private.weekly_recap(p_user uuid, p_week_start date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (
    select p_week_start as d0,
           (p_week_start::timestamp) at time zone 'America/Sao_Paulo' as t0,
           ((p_week_start + 7)::timestamp) at time zone 'America/Sao_Paulo' as t1
  ), runs as (
    select a.id, a.meters, a.moving_seconds, ((a.started_at at time zone 'America/Sao_Paulo')::date - w.d0) as dow
      from public.activities a, w
     where a.user_id = p_user and a.scored and a.status in ('valid', 'partial')
       and a.started_at >= w.t0 and a.started_at < w.t1
  )
  select jsonb_build_object(
    'weekStart', p_week_start,
    'weekEnd', p_week_start + 6,
    'final', public.br_today() > p_week_start + 6,
    'days', (select jsonb_agg(coalesce((select round(sum(r.meters))::integer from runs r where r.dow = d), 0) order by d)
               from generate_series(0, 6) d),
    'meters', coalesce((select round(sum(r.meters))::integer from runs r), 0),
    'runs', (select count(*)::integer from runs),
    'movingSeconds', coalesce((select round(sum(r.moving_seconds))::integer from runs r), 0),
    'zones', (select count(distinct e.zone_id)::integer from public.zone_events e, w
               where e.user_id = p_user and e.type = 'captured' and e.created_at >= w.t0 and e.created_at < w.t1
                 and e.faction = (select pr.faction from public.profiles pr where pr.id = p_user)),
    'streakWeeks', coalesce((select pr.streak_weeks from public.profiles pr where pr.id = p_user), 0),
    'isDemo', coalesce((select pr.is_demo from public.profiles pr where pr.id = p_user), false))
$$;
revoke all on function private.weekly_recap(uuid, date) from public, anon, authenticated;

-- ===========================================================================
-- B4: league_current até o fechamento da semana anterior
-- ===========================================================================
create or replace function public.league_current() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_week date := private.week_start_br(now());
  m public.league_members;
  l public.league_members;
  v_div smallint;
  v_size integer;
  v_moves integer;
  v_small boolean;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  -- B4: entre segunda 00:00 e o fechamento (03:20), a semana que vale ainda é a anterior
  if now() < private.league_closes_at(v_week - 7) then v_week := v_week - 7; end if;
  if not private.feature_on('league') then
    raise exception 'FEATURE_DISABLED: liga ainda não está ligada' using errcode = 'P0001';
  end if;
  select * into m from public.league_members where week_start = v_week and user_id = v_uid;
  select * into l from public.league_members where user_id = v_uid and outcome is not null order by week_start desc limit 1;
  v_div := coalesce(m.division, (select s.division from public.league_standings s where s.user_id = v_uid), 0);
  v_size := coalesce((select count(*) from public.league_members x where x.group_id = m.group_id), 0);
  v_small := v_size < private.param_num('league', 'smallGroup', 6);
  v_moves := private.league_moves(v_size);
  return jsonb_build_object(
    'weekStart', v_week,
    'closesAt', private.ts_to_ms(private.league_closes_at(v_week)),
    'division', v_div,
    'divisionName', private.division_name(v_div),
    'joined', m.user_id is not null,
    'groupSize', v_size,
    'smallGroup', v_small,
    'promoteSlots', case when v_div >= 4 then 0 when v_small then 1 else v_moves end,
    'relegateSlots', case when v_div <= 0 or v_small then 0 else v_moves end,
    'members', coalesce((select jsonb_agg(jsonb_build_object('position', t.pos, 'username', t.username, 'faction', t.faction,
                                                             'avatarUrl', t.avatar_url, 'points', t.points, 'you', t.user_id = v_uid,
                                                             'zone', case when v_div < 4 and t.points > 0
                                                                               and (case when v_small then t.pos = 1 else t.pos <= v_moves end)
                                                                          then 'promote'
                                                                          when v_div > 0 and not v_small and t.pos > v_size - v_moves
                                                                          then 'relegate' end)
                                          order by t.pos)
        from (select lm.user_id, pp.username, pp.faction, pp.avatar_url, lm.points,
                     row_number() over (order by lm.points desc, lm.reached_at, lm.user_id) as pos
                from public.league_members lm join private.public_profiles() pp on pp.id = lm.user_id
               where lm.group_id = m.group_id) t), '[]'::jsonb),
    'lastResult', case when l.user_id is null then null
                       else jsonb_build_object('weekStart', l.week_start, 'division', l.division,
                                               'divisionName', private.division_name(l.division), 'finalRank', l.final_rank,
                                               'outcome', l.outcome) end);
end $$;
revoke all on function public.league_current() from public, anon;
grant execute on function public.league_current() to authenticated;

-- ===========================================================================
-- LGPD: kudos_log na exportação (feed_kudos_counts não tem dado da pessoa)
-- ===========================================================================
create or replace function private.export_v2_tables() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    -- v1 (svc_account_export)
    'profiles', 'devices', 'activities', 'activity_zones', 'safety_contacts', 'notifications', 'fog_cells', 'chest_opens',
    'chests', 'privacy_zones', 'crew_members', 'crews', 'moderation_reviews', 'zone_events',
    -- v2
    'xp_ledger', 'user_cosmetics', 'user_equipped', 'user_medals', 'daily_rewards', 'bonus_chests',
    'raid_hits', 'raid_rewards', 'raid_visits', 'league_members', 'league_reservations', 'league_entries', 'league_standings',
    'user_missions', 'engagement_marks', 'track_claims', 'paint_marks', 'activity_stats', 'personal_records',
    'user_settings', 'feed_items', 'kudos',
    -- v2, onda 3 (D-82)
    'telemetry_consent', 'telemetry_events',
    -- revisão (M1)
    'kudos_log']
$$;
revoke all on function private.export_v2_tables() from public, anon, authenticated;

create or replace function private.account_export_v2(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.svc_account_export(p_user) || jsonb_build_object(
    'exportVersion', 2,
    'zoneEvents', coalesce((select jsonb_agg(to_jsonb(e) - 'user_id' order by e.created_at) from public.zone_events e
                             where e.user_id = p_user), '[]'::jsonb),
    'crewsLed', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'createdAt', c.created_at))
                           from public.crews c where c.leader_id = p_user), '[]'::jsonb),
    'moderationDecisions', coalesce((select jsonb_agg(jsonb_build_object('activityId', m.activity_id, 'decision', m.decision,
                                                                        'justification', m.justification, 'createdAt', m.created_at))
                                      from public.moderation_reviews m where m.moderator_id = p_user), '[]'::jsonb),
    'xpLedger', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.created_at, x.id) from public.xp_ledger x
                           where x.user_id = p_user), '[]'::jsonb),
    'cosmetics', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.user_cosmetics x where x.user_id = p_user), '[]'::jsonb),
    'equipped', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.user_equipped x where x.user_id = p_user), '[]'::jsonb),
    'medals', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.user_medals x where x.user_id = p_user), '[]'::jsonb),
    'dailyRewards', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.day, x.n) from public.daily_rewards x
                               where x.user_id = p_user), '[]'::jsonb),
    'bonusChests', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.bonus_chests x where x.user_id = p_user), '[]'::jsonb),
    'raidHits', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.raid_hits x where x.user_id = p_user), '[]'::jsonb),
    'raidRewards', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.raid_rewards x where x.user_id = p_user), '[]'::jsonb),
    'raidVisits', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.raid_visits x where x.user_id = p_user), '[]'::jsonb),
    'leagueMembers', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.league_members x where x.user_id = p_user), '[]'::jsonb),
    'leagueReservations', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.league_reservations x
                                     where x.user_id = p_user), '[]'::jsonb),
    'leagueEntries', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.league_entries x where x.user_id = p_user), '[]'::jsonb),
    'leagueStandings', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.league_standings x
                                  where x.user_id = p_user), '[]'::jsonb),
    'missions', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.created_at) from public.user_missions x
                           where x.user_id = p_user), '[]'::jsonb),
    'engagementMarks', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.engagement_marks x
                                  where x.user_id = p_user), '[]'::jsonb),
    'trackClaims', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.track_claims x where x.user_id = p_user), '[]'::jsonb),
    'paintMarks', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.day, x.cell) from public.paint_marks x
                             where x.user_id = p_user), '[]'::jsonb),
    'activityStats', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.activity_stats x where x.user_id = p_user), '[]'::jsonb),
    'personalRecords', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.personal_records x
                                  where x.user_id = p_user), '[]'::jsonb),
    'settings', (select to_jsonb(x) - 'user_id' from public.user_settings x where x.user_id = p_user),
    'feedItems', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.day) from public.feed_items x
                            where x.user_id = p_user), '[]'::jsonb),
    'kudosGiven', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.kudos x where x.user_id = p_user), '[]'::jsonb),
    'kudosReceived', coalesce((select jsonb_agg(jsonb_build_object('feedItemId', k.feed_item_id, 'reaction', k.reaction, 'day', k.day))
                                from public.kudos k join public.feed_items f on f.id = k.feed_item_id
                               where f.user_id = p_user), '[]'::jsonb),
    -- onda 3 (D-82)
    'telemetryConsent', (select to_jsonb(x) - 'user_id' from public.telemetry_consent x where x.user_id = p_user),
    'telemetryEvents', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'id' order by x.day, x.id) from public.telemetry_events x
                                  where x.user_id = p_user), '[]'::jsonb),
    -- revisão (M1)
    'kudosLog', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.day) from public.kudos_log x
                           where x.user_id = p_user), '[]'::jsonb))
$$;
revoke all on function private.account_export_v2(uuid) from public, anon, authenticated;

