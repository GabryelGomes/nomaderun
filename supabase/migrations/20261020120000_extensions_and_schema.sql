-- NOMADE RUN — T1.1: extensões e esquema base (ARQUITETURA.md §3).
-- Convenções: nomes em minúsculas, timestamps em timestamptz, facções como texto com check.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Schema não exposto pela API (PostgREST só expõe public/graphql_public).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Utilidades de data (horário de Brasília) e temporada (RN-006: temporada mensal)
-- ---------------------------------------------------------------------------
create or replace function public.br_now() returns timestamp
language sql stable set search_path = '' as $$ select now() at time zone 'America/Sao_Paulo' $$;

create or replace function public.br_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Início (timestamptz) do dia de Brasília que contém o instante informado.
create or replace function public.br_day_start(ts timestamptz default now()) returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('day', ts at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
$$;

-- Temporada atual no formato AAAA-MM (mês de Brasília).
create or replace function public.current_season_id() returns text
language sql stable set search_path = '' as $$ select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') $$;

create or replace function public.season_start(season text default null) returns timestamptz
language sql stable set search_path = '' as $$
  select (to_date(coalesce(season, public.current_season_id()) || '-01', 'YYYY-MM-DD')::timestamp)
         at time zone 'America/Sao_Paulo'
$$;

-- ---------------------------------------------------------------------------
-- seasons (RN-006)
-- ---------------------------------------------------------------------------
create table public.seasons (
  id text primary key check (id ~ '^\d{4}-\d{2}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
comment on table public.seasons is 'Temporadas mensais (RN-006). Ids no formato AAAA-MM, mês de Brasília.';

-- ---------------------------------------------------------------------------
-- profiles (RF-001, RF-002, RF-003, RN-009, RN-011, RN-013, RN-014)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_.]{3,20}$'),
  faction text check (faction in ('striders', 'coyotes', 'owls', 'volt')),
  city text check (city is null or char_length(city) between 2 and 80),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  units text not null default 'km' check (units in ('km', 'mi')),
  notification_prefs jsonb not null default '{"invasion": true, "conquest": true, "moderation": true, "missions": true}'::jsonb
    check (jsonb_typeof(notification_prefs) = 'object'),
  role text not null default 'runner' check (role in ('runner', 'moderator', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  suspended_until timestamptz,
  trust smallint not null default 100 check (trust between 0 and 100),
  xp integer not null default 0 check (xp >= 0),
  streak_weeks smallint not null default 0 check (streak_weeks >= 0),
  freezes_left smallint not null default 1 check (freezes_left >= 0),
  birthdate date not null,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  faction_changed_season text,
  city_changed_season text,
  contribution_reset_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_lower_key on public.profiles (lower(username));
create index profiles_city_idx on public.profiles (city);
create index profiles_faction_idx on public.profiles (faction);
comment on column public.profiles.contribution_reset_at is
  'RF-003: ao trocar de facção, a contribuição pessoal anterior a este instante deixa de contar na temporada.';

-- ---------------------------------------------------------------------------
-- devices (D-04: chave HMAC por aparelho; o segredo nunca volta ao cliente)
-- ---------------------------------------------------------------------------
create table public.devices (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  secret bytea not null check (octet_length(secret) = 32),
  platform text not null check (platform in ('ios', 'android', 'web')),
  model text check (model is null or char_length(model) <= 100),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index devices_user_idx on public.devices (user_id);

-- ---------------------------------------------------------------------------
-- activities / activity_points (RF-004, RF-005, RF-006, D-03)
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  status text not null default 'recording' check (status in ('recording', 'valid', 'partial', 'rejected', 'review')),
  mission text not null default 'livre' check (mission in ('livre', 'fuga', 'caca')),
  started_at timestamptz not null,
  ended_at timestamptz,
  finished_at timestamptz,
  meters real not null default 0,
  moving_seconds real not null default 0,
  avg_pace real,
  rp_total integer not null default 0,
  xp integer not null default 0,
  ghost_pace real check (ghost_pace is null or ghost_pace > 0),
  beat_ghost boolean,
  flags text[] not null default '{}',
  invalid_segments jsonb not null default '[]'::jsonb,
  last_seq integer not null default -1,
  scored boolean not null default false,
  trust_after smallint,
  review_reason text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_user_started_idx on public.activities (user_id, started_at desc);
create index activities_review_idx on public.activities (status) where status = 'review';
create index activities_device_idx on public.activities (device_id);
comment on column public.activities.scored is 'true quando a pontuação já foi aplicada às zonas (corridas em revisão ficam false até a aprovação).';

create table public.activity_points (
  activity_id uuid not null references public.activities (id) on delete cascade,
  seq integer not null check (seq >= 0),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  t bigint not null,
  accuracy double precision,
  speed double precision,
  altitude double precision,
  mocked boolean,
  steps integer check (steps is null or steps >= 0),
  primary key (activity_id, seq)
);

-- ---------------------------------------------------------------------------
-- zones / zone_events / activity_zones (RF-007, RF-008, RN-001..005, D-11)
-- ---------------------------------------------------------------------------
create table public.zones (
  id text primary key check (id ~ '^[0-9a-f]{15}$'),
  name text,
  city text,
  geom extensions.geometry(Polygon, 4326) not null,
  influence jsonb not null default '{"striders": 0, "coyotes": 0, "owls": 0, "volt": 0}'::jsonb,
  owner text check (owner in ('striders', 'coyotes', 'owls', 'volt')),
  shield smallint not null default 0 check (shield between 0 and 3),
  attacker text check (attacker in ('striders', 'coyotes', 'owls', 'volt')),
  attack_started_at timestamptz,
  blocked boolean not null default false,
  version integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index zones_geom_gist on public.zones using gist (geom);
create index zones_owner_idx on public.zones (owner) where owner is not null;
create index zones_city_idx on public.zones (city);
comment on column public.zones.version is 'Incrementada a cada gravação; usada pela concorrência otimista de finish-activity (D-23).';

create table public.zone_events (
  id bigint generated always as identity primary key,
  zone_id text not null references public.zones (id) on delete cascade,
  type text not null check (type in ('captured', 'under_attack', 'defended', 'neutralized', 'shield_up', 'shield_down')),
  faction text check (faction in ('striders', 'coyotes', 'owls', 'volt')),
  from_faction text check (from_faction in ('striders', 'coyotes', 'owls', 'volt')),
  activity_id uuid references public.activities (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index zone_events_zone_idx on public.zone_events (zone_id, created_at desc);
create index zone_events_activity_idx on public.zone_events (activity_id);
create index zone_events_user_idx on public.zone_events (user_id);

create table public.activity_zones (
  activity_id uuid not null references public.activities (id) on delete cascade,
  zone_id text not null references public.zones (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  faction text not null check (faction in ('striders', 'coyotes', 'owls', 'volt')),
  meters real not null,
  rp integer not null,
  outcome text not null check (outcome in ('conquered', 'defended', 'influence', 'none')),
  owner_before text,
  owner_after text,
  created_at timestamptz not null default now(),
  primary key (activity_id, zone_id)
);
create index activity_zones_zone_idx on public.activity_zones (zone_id, created_at desc);
create index activity_zones_user_idx on public.activity_zones (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- safety_contacts (RF-024, máx. 5 por usuário)
-- ---------------------------------------------------------------------------
create table public.safety_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{8,20}$'),
  created_at timestamptz not null default now()
);
create index safety_contacts_user_idx on public.safety_contacts (user_id);

-- ---------------------------------------------------------------------------
-- notifications (RF-009, RF-019, D-13)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('invasion', 'territory_lost', 'conquest', 'moderation', 'mission', 'system')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_user_type_idx on public.notifications (user_id, type, created_at desc);

-- ---------------------------------------------------------------------------
-- fog_cells (RF-022, RN-016) / chest_opens (RF-023, RN-017)
-- ---------------------------------------------------------------------------
create table public.fog_cells (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cell text not null check (cell ~ '^[0-9a-f]{15}$'),
  activity_id uuid references public.activities (id) on delete set null,
  revealed_at timestamptz not null default now(),
  primary key (user_id, cell)
);

create table public.chest_opens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  chest_id text not null check (char_length(chest_id) between 1 and 80),
  rarity text not null check (rarity in ('comum', 'raro', 'lendario')),
  xp integer not null check (xp >= 0),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  activity_id uuid references public.activities (id) on delete set null,
  opened_at timestamptz not null default now(),
  primary key (user_id, chest_id)
);

-- ---------------------------------------------------------------------------
-- crews / crew_members (RF-011, RN-011)
-- ---------------------------------------------------------------------------
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 30),
  tag text not null check (tag ~ '^[A-Z]{3,5}$'),
  faction text not null check (faction in ('striders', 'coyotes', 'owls', 'volt')),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  leader_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index crews_tag_key on public.crews (tag);

create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (user_id)
);
create index crew_members_crew_idx on public.crew_members (crew_id);
comment on table public.crew_members is 'PK em user_id: no máximo uma Crew por usuário (RN-011).';

-- ---------------------------------------------------------------------------
-- moderation_reviews (RF-018)
-- ---------------------------------------------------------------------------
create table public.moderation_reviews (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  moderator_id uuid references public.profiles (id) on delete set null,
  decision text not null check (decision in ('approve', 'reject')),
  justification text not null check (char_length(btrim(justification)) >= 10),
  created_at timestamptz not null default now()
);
create index moderation_reviews_activity_idx on public.moderation_reviews (activity_id);
create index moderation_reviews_moderator_idx on public.moderation_reviews (moderator_id);

-- updated_at automático
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger activities_touch before update on public.activities for each row execute function private.touch_updated_at();
