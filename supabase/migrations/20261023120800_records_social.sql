-- NOMADE RUN — Fase 7, onda 2 (T7.2.2, D-79; E8 §9 e F1 09-backend §4.5–§4.6): recordes, parciais, feed e aplausos.
--   * activity_stats / personal_records: derivados das atividades pela gravação v2 (parciais por km, melhores
--     esforços de 1/5/10/21 km e a mais longa). Recorde só com status 'valid' (a parcial não conta);
--   * user_settings: "Mostrar minhas corridas para a crew" e "Mostrar o mapa" (padrão ligados);
--   * feed_items: 1 item por corrida aceita, SÓ para a crew, SEM horário (só o dia) e com a rota já cortada na Edge
--     Function por clipRouteForSharing (polyline precisão 4, até 80 pontos). O cliente lê só por crew_feed();
--   * kudos: Bora!, Fogo e Raio, sem comentário, sem aplaudir a si mesmo, teto de 200 por dia, Realtime.
-- Tudo atrás de game_config.features.records / features.feed (desligadas por padrão).

-- ===========================================================================
-- Recordes e parciais
-- ===========================================================================
create table public.activity_stats (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  meters integer not null check (meters >= 0),
  moving_seconds integer not null check (moving_seconds >= 0),
  splits integer[] not null default '{}' check (cardinality(splits) <= 100),          -- segundos de cada km completo
  pace_series integer[] not null default '{}' check (cardinality(pace_series) <= 200), -- s/km ao longo da corrida
  best_1k_s integer check (best_1k_s is null or best_1k_s > 0),
  best_5k_s integer check (best_5k_s is null or best_5k_s > 0),
  best_10k_s integer check (best_10k_s is null or best_10k_s > 0),
  best_21k_s integer check (best_21k_s is null or best_21k_s > 0),
  created_at timestamptz not null default now()
);
create index activity_stats_user_idx on public.activity_stats (user_id);
comment on table public.activity_stats is
  'Parciais e melhores esforços de uma corrida aceita, calculados só sobre trechos válidos (gravação v2).';

create table public.personal_records (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('1k', '5k', '10k', '21k', 'longest')),
  value integer not null check (value > 0),          -- segundos (1k..21k) ou metros (longest)
  activity_id uuid not null references public.activities (id) on delete cascade,
  day date not null,                                 -- dia (Brasília) da corrida; sem horário
  previous integer check (previous is null or previous > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
comment on table public.personal_records is
  'Recordes pessoais (só corridas valid). Tempo menor vence nas distâncias; maior distância vence em longest.';

alter table public.activity_stats enable row level security;
alter table public.personal_records enable row level security;
revoke all on public.activity_stats, public.personal_records from anon, authenticated;
grant select on public.activity_stats, public.personal_records to authenticated;
create policy activity_stats_select on public.activity_stats for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy personal_records_select on public.personal_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy activity_stats_active_account on public.activity_stats as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy personal_records_active_account on public.personal_records as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

-- Recordes da própria pessoa (tela "Você").
create or replace function public.my_records() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('records') then
    raise exception 'FEATURE_DISABLED: recordes ainda não estão ligados' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'records', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'value', r.value, 'activityId', r.activity_id,
                                                             'day', r.day, 'previous', r.previous)
                                          order by array_position(array['1k', '5k', '10k', '21k', 'longest'], r.kind))
                           from public.personal_records r where r.user_id = v_uid), '[]'::jsonb));
end $$;
revoke all on function public.my_records() from public, anon;
grant execute on function public.my_records() to authenticated;

-- ===========================================================================
-- Configurações sociais (E8 §9.4). Escrita só pela RPC.
-- ===========================================================================
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  share_runs_to_feed boolean not null default true,
  feed_show_map boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon, authenticated;
grant select on public.user_settings to authenticated;
create policy user_settings_select on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_active_account on public.user_settings as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create trigger user_settings_touch before update on public.user_settings for each row execute function private.touch_updated_at();

create or replace function public.my_feed_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  return jsonb_build_object(
    'shareRunsToFeed', coalesce((select s.share_runs_to_feed from public.user_settings s where s.user_id = v_uid), true),
    'feedShowMap', coalesce((select s.feed_show_map from public.user_settings s where s.user_id = v_uid), true));
end $$;
revoke all on function public.my_feed_settings() from public, anon;
grant execute on function public.my_feed_settings() to authenticated;

-- null = não muda. Desligar "Mostrar minhas corridas" também tira do feed os itens que já estavam lá.
create or replace function public.set_feed_settings(p_share_runs boolean default null, p_show_map boolean default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  insert into public.user_settings (user_id, share_runs_to_feed, feed_show_map)
  values (v_uid, coalesce(p_share_runs, true), coalesce(p_show_map, true))
  on conflict (user_id) do update
     set share_runs_to_feed = coalesce(p_share_runs, public.user_settings.share_runs_to_feed),
         feed_show_map = coalesce(p_show_map, public.user_settings.feed_show_map);
  if p_share_runs = false then
    delete from public.feed_items where user_id = v_uid;
  end if;
  if p_show_map = false then
    update public.feed_items set route = null, route_hidden = true where user_id = v_uid;
  end if;
  return public.my_feed_settings();
end $$;
revoke all on function public.set_feed_settings(boolean, boolean) from public, anon;
grant execute on function public.set_feed_settings(boolean, boolean) to authenticated;

-- ===========================================================================
-- Feed da crew (D-79)
-- ===========================================================================
create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  crew_id uuid not null references public.crews (id) on delete cascade,  -- foto do momento: quem vê é essa crew
  day date not null,                                                     -- dia (Brasília) da corrida; SEM horário
  meters integer not null check (meters >= 0),
  moving_seconds integer not null check (moving_seconds >= 0),
  avg_pace integer check (avg_pace is null or avg_pace > 0),
  highlights jsonb not null default '[]'::jsonb
    check (jsonb_typeof(highlights) = 'array' and jsonb_array_length(highlights) <= 6 and octet_length(highlights::text) <= 1024),
  -- polylines (precisão 4) dos pedaços visíveis, já cortados por clipRouteForSharing; null = sem rota
  route text[] check (route is null or (cardinality(route) between 1 and 20
                                        and octet_length(array_to_string(route, '')) <= 1200)),
  route_hidden boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()                          -- só para ordenar; nunca sai pela API
);
create index feed_items_crew_idx on public.feed_items (crew_id, created_at desc, id desc);
create index feed_items_user_idx on public.feed_items (user_id);
comment on table public.feed_items is
  'D-79: 1 item por corrida aceita, visível só para a crew (crew_id) e o autor. Sem horário. O cliente lê por crew_feed().';

create table public.kudos (
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('bora', 'fogo', 'raio')),
  day date not null default public.br_today(),                           -- teto diário; sem horário
  primary key (feed_item_id, user_id)
);
create index kudos_user_day_idx on public.kudos (user_id, day);
comment on table public.kudos is 'D-79: reações prontas (Bora!, Fogo, Raio), uma por pessoa por item. Realtime com RLS.';

alter table public.feed_items enable row level security;
alter table public.kudos enable row level security;
revoke all on public.feed_items, public.kudos from anon, authenticated;
grant select on public.kudos to authenticated;   -- o Realtime aplica esta RLS na assinatura

-- Quem vê o item: o autor e quem é da crew do item agora.
create or replace function private.can_see_feed_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feed_items f
                  where f.id = p_item
                    and (f.user_id = (select auth.uid())
                         or exists (select 1 from public.crew_members cm
                                     where cm.crew_id = f.crew_id and cm.user_id = (select auth.uid()))))
$$;
revoke all on function private.can_see_feed_item(uuid) from public, anon;
grant execute on function private.can_see_feed_item(uuid) to authenticated;

create policy kudos_select on public.kudos for select to authenticated using ((select private.can_see_feed_item(feed_item_id)));
create policy kudos_active_account on public.kudos as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

alter publication supabase_realtime add table public.kudos;

-- Um item do feed como o app recebe (sem activity_id, sem user_id, sem horário).
create or replace function private.feed_item_json(f public.feed_items, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', f.id, 'day', f.day, 'you', f.user_id = p_viewer,
    'author', (select jsonb_build_object('username', pp.username, 'faction', pp.faction, 'avatarUrl', pp.avatar_url)
                 from private.public_profiles() pp where pp.id = f.user_id),
    'meters', f.meters, 'movingSeconds', f.moving_seconds, 'avgPace', f.avg_pace, 'highlights', f.highlights,
    'route', case when f.route is null then null else to_jsonb(f.route) end, 'routeHidden', f.route_hidden,
    'kudos', jsonb_build_object(
      'bora', (select count(*) from public.kudos k where k.feed_item_id = f.id and k.reaction = 'bora'),
      'fogo', (select count(*) from public.kudos k where k.feed_item_id = f.id and k.reaction = 'fogo'),
      'raio', (select count(*) from public.kudos k where k.feed_item_id = f.id and k.reaction = 'raio')),
    'myReaction', (select k.reaction from public.kudos k where k.feed_item_id = f.id and k.user_id = p_viewer),
    'isDemo', f.is_demo)
$$;
revoke all on function private.feed_item_json(public.feed_items, uuid) from public, anon, authenticated;

-- Feed da minha crew, 20 por página (p_before = id do último item da página anterior).
create or replace function public.crew_feed(p_limit integer default 20, p_before uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_crew uuid;
  v_cursor public.feed_items;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('feed') then
    raise exception 'FEATURE_DISABLED: feed ainda não está ligado' using errcode = 'P0001';
  end if;
  select cm.crew_id into v_crew from public.crew_members cm where cm.user_id = v_uid;
  if v_crew is null then
    return jsonb_build_object('crew', null, 'items', '[]'::jsonb, 'next', null);
  end if;
  if p_before is not null then
    select * into v_cursor from public.feed_items f where f.id = p_before and f.crew_id = v_crew;
  end if;
  return (
    with page as (
      select f.* from public.feed_items f
       where f.crew_id = v_crew
         and (v_cursor.id is null or (f.created_at, f.id) < (v_cursor.created_at, v_cursor.id))
       order by f.created_at desc, f.id desc
       limit v_limit + 1)
    select jsonb_build_object(
      'crew', (select jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'faction', c.faction)
                 from public.crews c where c.id = v_crew),
      'items', coalesce((select jsonb_agg(private.feed_item_json(p, v_uid) order by p.created_at desc, p.id desc)
                           from (select * from page order by created_at desc, id desc limit v_limit) p), '[]'::jsonb),
      'next', case when (select count(*) from page) > v_limit
                   then (select p.id from (select * from page order by created_at desc, id desc limit v_limit) p
                          order by p.created_at, p.id limit 1) end));
end $$;
revoke all on function public.crew_feed(integer, uuid) from public, anon;
grant execute on function public.crew_feed(integer, uuid) to authenticated;

-- Quem reagiu a um item (só nomes da crew; sem horário).
create or replace function public.feed_item_kudos(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('feed') then
    raise exception 'FEATURE_DISABLED: feed ainda não está ligado' using errcode = 'P0001';
  end if;
  if not private.can_see_feed_item(p_item) then
    raise exception 'NOT_FOUND: item do feed não encontrado' using errcode = 'P0001';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('username', pp.username, 'faction', pp.faction,
                                                       'avatarUrl', pp.avatar_url, 'reaction', k.reaction)
                                    order by pp.username)
                     from public.kudos k join private.public_profiles() pp on pp.id = k.user_id
                    where k.feed_item_id = p_item), '[]'::jsonb);
end $$;
revoke all on function public.feed_item_kudos(uuid) from public, anon;
grant execute on function public.feed_item_kudos(uuid) to authenticated;

-- Reagir (bora | fogo | raio), trocar a reação ou desfazer (p_reaction = null).
-- Erros: KUDOS_SELF (próprio item), KUDOS_LIMIT (200 por dia), NOT_FOUND (item invisível), VALIDATION.
-- Quem correu recebe 1 notificação por item por dia, atualizada com o total (o app agrupa o aviso local).
create or replace function public.react_feed_item(p_item uuid, p_reaction text default 'bora') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  f public.feed_items;
  v_had boolean;
  v_total integer;
  v_note uuid;
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
  if not v_had and (select count(*) from public.kudos k where k.user_id = v_uid and k.day = public.br_today()) >= 200 then
    raise exception 'KUDOS_LIMIT: limite de 200 reações por dia' using errcode = 'P0001';
  end if;
  insert into public.kudos (feed_item_id, user_id, reaction) values (p_item, v_uid, p_reaction)
  on conflict (feed_item_id, user_id) do update set reaction = excluded.reaction;

  if not v_had and private.notify_pref(f.user_id, 'kudos') then
    v_total := (select count(*) from public.kudos k where k.feed_item_id = p_item);
    select n.id into v_note from public.notifications n
     where n.user_id = f.user_id and n.type = 'kudos' and n.data ->> 'feedItemId' = p_item::text
       and n.created_at >= public.br_day_start()
     order by n.created_at desc limit 1;
    if v_note is null then
      insert into public.notifications (user_id, type, title, body, data)
      values (f.user_id, 'kudos', 'Bora!', 'Sua corrida ganhou 1 reação da crew.',
              jsonb_build_object('kind', 'kudos', 'feedItemId', p_item, 'count', v_total));
    else
      update public.notifications
         set body = format('Sua corrida ganhou %s reações da crew.', v_total),
             data = data || jsonb_build_object('count', v_total), read_at = null
       where id = v_note;
    end if;
  end if;
  return private.feed_item_json(f, v_uid);
end $$;
revoke all on function public.react_feed_item(uuid, text) from public, anon;
grant execute on function public.react_feed_item(uuid, text) to authenticated;

-- Tirar uma corrida própria do feed.
create or replace function public.delete_feed_item(p_item uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  delete from public.feed_items where id = p_item and user_id = v_uid;
  return found;
end $$;
revoke all on function public.delete_feed_item(uuid) from public, anon;
grant execute on function public.delete_feed_item(uuid) to authenticated;
