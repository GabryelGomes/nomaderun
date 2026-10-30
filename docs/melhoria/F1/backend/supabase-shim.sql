-- NOMADE RUN — F1/E9: shim mínimo do Supabase para rodar as migrations e os testes pgTAP num
-- Postgres 16 "puro" (sem Docker). Reproduz só o que as migrations, o seed e os testes usam:
--   * roles anon / authenticated / service_role (+ authenticator e supabase_admin, sem login);
--   * esquemas auth, storage e extensions, com os grants do Supabase;
--   * auth.users e auth.identities com as colunas usadas pelo seed e pelos testes;
--   * auth.uid(), auth.role(), auth.jwt() e auth.email() lendo request.jwt.claims (igual ao GoTrue);
--   * storage.buckets, storage.objects (RLS ligada) e storage.foldername();
--   * a publicação supabase_realtime (vazia; as migrations adicionam zones e notifications);
--   * os privilégios padrão do schema public (o Supabase concede tudo a anon/authenticated/service_role
--     e as migrations revogam o que não querem), e o search_path "$user", public, extensions.
-- NÃO é o Supabase: não há GoTrue, PostgREST, Realtime nem Storage API. Serve para esquema, RLS, RPCs e jobs.
-- Rode como superusuário, no banco alvo, ANTES da primeira migration.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin superuser;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;

-- ---------------------------------------------------------------------------
-- Esquemas
-- ---------------------------------------------------------------------------
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Privilégios padrão do Supabase no schema public (as migrations revogam o que não querem).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- search_path do Supabase (o PostgREST usa extra_search_path = public, extensions)
do $$ begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end $$;
alter role anon set search_path = "$user", public, extensions;
alter role authenticated set search_path = "$user", public, extensions;
alter role service_role set search_path = "$user", public, extensions;

-- ---------------------------------------------------------------------------
-- auth (subconjunto do GoTrue)
-- ---------------------------------------------------------------------------
create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  email_change_token_current varchar(255) default '',
  email_change_confirm_status smallint default 0,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  phone text unique default null,
  phone_confirmed_at timestamptz,
  phone_change text default '',
  phone_change_token varchar(255) default '',
  phone_change_sent_at timestamptz,
  banned_until timestamptz,
  reauthentication_token varchar(255) default '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean not null default false,
  is_anonymous boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
create unique index if not exists users_email_partial_key on auth.users (email) where is_sso_user = false;

create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  email text generated always as (lower(identity_data ->> 'email')) stored,
  unique (provider_id, provider)
);

-- Mesmo corpo das funções do GoTrue: claims vêm de request.jwt.claims (ou das chaves antigas request.jwt.claim.*).
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt() to public;
-- Como no Supabase: o cliente não lê auth.users; só o service_role (e o dono das funções security definer).
revoke all on auth.users, auth.identities from anon, authenticated;
grant all on auth.users, auth.identities to service_role;

-- ---------------------------------------------------------------------------
-- storage (subconjunto da Storage API)
-- ---------------------------------------------------------------------------
create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  owner_id text,
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  user_metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;

create or replace function storage.filename(name text) returns text
language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end $$;

grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text), storage.filename(text) to public;

-- ---------------------------------------------------------------------------
-- Realtime: publicação vazia (as migrations fazem "alter publication ... add table")
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
