-- NOMADE RUN — Fase 3 (A2): P-13 (Realtime da central de notificações) e RN-010 (zonas de privacidade).

-- ---------------------------------------------------------------------------
-- P-13 / RF-019: notificações chegam pelo Realtime.
-- O Realtime (postgres_changes) aplica a RLS de quem assina: a policy notifications_select
-- (user_id = auth.uid()) garante que cada usuário só recebe as próprias, mesmo sem filtro no canal.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- RN-010: zonas de privacidade. Até 3 endereços por usuário, raio padrão de 200 m.
-- Os pontos dentro do raio pontuam normalmente (o cálculo oficial usa svc_load_activity, que lê tudo),
-- mas nunca aparecem no percurso exibido para terceiros: a policy de activity_points esconde esses pontos
-- de quem não é o dono (hoje, o painel de moderação; amanhã, feed/perfil público/compartilhamento).
-- ---------------------------------------------------------------------------
create table public.privacy_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label text check (label is null or char_length(btrim(label)) between 1 and 40),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m integer not null default 200 check (radius_m between 50 and 1000),
  created_at timestamptz not null default now()
);
create index privacy_zones_user_idx on public.privacy_zones (user_id);
comment on table public.privacy_zones is 'RN-010: endereços marcados pelo usuário (máx. 3). Pontos a até radius_m metros não aparecem para terceiros.';

create or replace function private.privacy_zones_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = new.user_id for update;
  if (select count(*) from public.privacy_zones where user_id = new.user_id) >= 3 then
    raise exception 'PRIVACY_ZONES_LIMIT: no máximo 3 zonas de privacidade' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger privacy_zones_limit before insert on public.privacy_zones
  for each row execute function private.privacy_zones_limit();

alter table public.privacy_zones enable row level security;
revoke all on public.privacy_zones from anon, authenticated;
grant select, delete on public.privacy_zones to authenticated;
grant insert (label, lat, lng, radius_m) on public.privacy_zones to authenticated;
grant update (label, lat, lng, radius_m) on public.privacy_zones to authenticated;
create policy privacy_zones_select on public.privacy_zones for select to authenticated using (user_id = (select auth.uid()));
create policy privacy_zones_insert on public.privacy_zones for insert to authenticated with check (user_id = (select auth.uid()));
create policy privacy_zones_update on public.privacy_zones for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy privacy_zones_delete on public.privacy_zones for delete to authenticated using (user_id = (select auth.uid()));

-- true quando o ponto está dentro de alguma zona de privacidade do usuário.
create or replace function private.in_privacy_zone(p_user uuid, p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.privacy_zones pz
     where pz.user_id = p_user
       and extensions.st_dwithin(
             extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
             extensions.st_setsrid(extensions.st_makepoint(pz.lng, pz.lat), 4326)::extensions.geography,
             pz.radius_m))
$$;

-- true quando o ponto de uma corrida deve ser escondido de quem está consultando (não é o dono).
create or replace function private.route_point_hidden(p_activity uuid, p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.activities a
     where a.id = p_activity
       and a.user_id is distinct from (select auth.uid())
       and private.in_privacy_zone(a.user_id, p_lat, p_lng))
$$;

-- Percurso: o dono vê tudo; staff vê o percurso dos outros sem os pontos das zonas de privacidade (RN-010).
drop policy activity_points_read on public.activity_points;
create policy activity_points_read on public.activity_points for select to authenticated
  using (
    exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid()))
    or ((select private.is_staff()) and not private.route_point_hidden(activity_id, lat, lng))
  );

revoke all on function private.privacy_zones_limit() from public, anon, authenticated;
revoke all on function private.in_privacy_zone(uuid, double precision, double precision) from public, anon;
revoke all on function private.route_point_hidden(uuid, double precision, double precision) from public, anon;
grant execute on function private.in_privacy_zone(uuid, double precision, double precision) to authenticated, service_role;
grant execute on function private.route_point_hidden(uuid, double precision, double precision) to authenticated, service_role;
