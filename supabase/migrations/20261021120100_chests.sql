-- NOMADE RUN — Fase 3 (A2): P-12 / P-19 — missão Caça no servidor (RF-023, RN-017).
--
-- Sorteio: todo dia (de Brasília) cada usuário recebe de 5 a 8 baús num raio de 3 km do último ponto da
-- última corrida (sem corrida: da posição enviada pelo app), nunca dentro de zona bloqueada.
-- Raridades: comum 70% (20 XP), raro 25% (60 XP), lendário 5% (150 XP) — XP igual a CHEST_XP do domain.
-- Abertura: no finish-activity (cálculo oficial), quando um ponto de trecho válido da corrida passa a até
-- 25 m (CHEST_OPEN_RADIUS_M do domain); cada baú abre uma única vez e o XP entra no XP da corrida.

create table public.chests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  rarity text not null check (rarity in ('comum', 'raro', 'lendario')),
  xp integer not null check (xp >= 0),
  opened_at timestamptz,
  activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now()
);
create index chests_user_day_idx on public.chests (user_id, day);
create index chests_activity_idx on public.chests (activity_id);
comment on table public.chests is 'RN-017: baús sorteados por dia para cada usuário. Abertos pelo servidor no finish-activity (chest_opens guarda o histórico).';

alter table public.chests enable row level security;
revoke all on public.chests from anon, authenticated;
grant select on public.chests to authenticated;
create policy chests_select on public.chests for select to authenticated using (user_id = (select auth.uid()));

-- Raridade a partir de um número em [0, 1): 70% comum, 25% raro, 5% lendário.
create or replace function private.chest_rarity(r double precision) returns text
language sql immutable set search_path = '' as $$
  select case when r < 0.70 then 'comum' when r < 0.95 then 'raro' else 'lendario' end
$$;

-- XP de cada raridade (mesmos valores de CHEST_XP em apps/mobile/src/domain/games.ts).
create or replace function private.chest_xp(p_rarity text) returns integer
language sql immutable set search_path = '' as $$
  select case p_rarity when 'comum' then 20 when 'raro' then 60 when 'lendario' then 150 else 0 end
$$;

-- Sorteia os baús de um usuário num dia em torno de (lat, lng). Pontos uniformes no disco de 3 km;
-- ponto dentro de zona bloqueada é sorteado de novo (até 30 tentativas por baú).
create or replace function private.roll_chests(p_user uuid, p_day date, p_lat double precision, p_lng double precision)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer := 5 + floor(random() * 4)::integer; -- 5..8
  v_center extensions.geography := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_pt extensions.geometry;
  v_rarity text;
  v_made integer := 0;
  i integer;
  tries integer;
begin
  for i in 1 .. v_n loop
    for tries in 1 .. 30 loop
      v_pt := extensions.st_project(v_center, 3000 * sqrt(random()), radians(random() * 360))::extensions.geometry;
      exit when not exists (
        select 1 from public.zones z where z.blocked and extensions.st_intersects(z.geom, extensions.st_setsrid(v_pt, 4326)));
      v_pt := null;
    end loop;
    continue when v_pt is null;
    v_rarity := private.chest_rarity(random());
    insert into public.chests (user_id, day, lat, lng, rarity, xp)
    values (p_user, p_day, extensions.st_y(v_pt), extensions.st_x(v_pt), v_rarity, private.chest_xp(v_rarity));
    v_made := v_made + 1;
  end loop;
  return v_made;
end $$;

-- RF-023: baús do dia do usuário logado. Sorteia na primeira chamada do dia (idempotente: as seguintes
-- devolvem os mesmos). Centro = último ponto da última corrida não rejeitada; sem corrida, (p_lat, p_lng).
create or replace function public.daily_chests(p_lat double precision default null, p_lng double precision default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_day date := public.br_today();
  v_lat double precision;
  v_lng double precision;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001';
  end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'VALIDATION: posição inválida' using errcode = 'P0001';
  end if;
  -- uma chamada por vez por usuário/dia (duas abas abertas não sorteiam duas vezes)
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || v_day::text, 0));
  if not exists (select 1 from public.chests where user_id = v_uid and day = v_day) then
    select ap.lat, ap.lng into v_lat, v_lng
      from public.activity_points ap
     where ap.activity_id = (
             select a.id from public.activities a
              where a.user_id = v_uid and a.status <> 'rejected'
                and exists (select 1 from public.activity_points x where x.activity_id = a.id)
              order by a.started_at desc limit 1)
     order by ap.seq desc
     limit 1;
    v_lat := coalesce(v_lat, p_lat);
    v_lng := coalesce(v_lng, p_lng);
    if v_lat is not null then
      perform private.roll_chests(v_uid, v_day, v_lat, v_lng);
    end if;
  end if;
  return jsonb_build_object(
    'day', v_day,
    'chests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'lat', c.lat, 'lng', c.lng, 'rarity', c.rarity, 'xp', c.xp,
               'openedAt', private.ts_to_ms(c.opened_at)) order by c.created_at, c.id)
        from public.chests c where c.user_id = v_uid and c.day = v_day), '[]'::jsonb));
end $$;

revoke all on function private.chest_rarity(double precision) from public, anon, authenticated;
revoke all on function private.chest_xp(text) from public, anon, authenticated;
revoke all on function private.roll_chests(uuid, date, double precision, double precision) from public, anon, authenticated;
revoke all on function public.daily_chests(double precision, double precision) from public, anon;
grant execute on function public.daily_chests(double precision, double precision) to authenticated;
