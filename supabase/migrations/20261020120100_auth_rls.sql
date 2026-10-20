-- NOMADE RUN — T1.1: criação do perfil, papéis, regras em triggers e RLS em todas as tabelas (D-07).

-- ---------------------------------------------------------------------------
-- Papéis (security definer, search_path fixo, fora do schema exposto)
-- ---------------------------------------------------------------------------
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('moderator', 'admin') and status = 'active'
  )
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  )
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_staff() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

-- Atalhos públicos (o app usa para decidir se mostra o painel de moderação).
create or replace function public.is_staff() returns boolean
language sql stable set search_path = '' as $$ select private.is_staff() $$;
create or replace function public.is_admin() returns boolean
language sql stable set search_path = '' as $$ select private.is_admin() $$;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RF-001: perfil nasce junto com auth.users; recusa < 16 anos ou sem aceite dos termos
-- raw_user_meta_data esperado (signUp options.data):
--   { "username": "ana_corre", "birthdate": "2000-05-31", "terms_accepted": true, "privacy_accepted": true }
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := nullif(btrim(meta ->> 'username'), '');
  v_birth date;
  v_terms boolean := coalesce((meta ->> 'terms_accepted')::boolean, (meta ->> 'accepted_terms')::boolean, false);
  v_privacy boolean := coalesce((meta ->> 'privacy_accepted')::boolean, (meta ->> 'accepted_privacy')::boolean, v_terms);
begin
  begin
    v_birth := (meta ->> 'birthdate')::date;
  exception when others then
    raise exception 'BIRTHDATE_INVALID: data de nascimento inválida' using errcode = '22023';
  end;
  if v_birth is null then
    raise exception 'BIRTHDATE_REQUIRED: informe a data de nascimento' using errcode = '22023';
  end if;
  if v_birth < date '1900-01-01' or v_birth > (current_date - interval '16 years')::date then
    raise exception 'AGE_UNDER_16: é preciso ter pelo menos 16 anos' using errcode = '22023';
  end if;
  if not v_terms or not v_privacy then
    raise exception 'TERMS_REQUIRED: é preciso aceitar os termos de uso e a política de privacidade' using errcode = '22023';
  end if;
  if v_username is null or v_username !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'USERNAME_INVALID: nome de usuário deve ter de 3 a 20 letras, números, _ ou .' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    raise exception 'USERNAME_TAKEN: nome de usuário já está em uso' using errcode = '23505';
  end if;

  insert into public.profiles (id, username, birthdate, terms_accepted_at, privacy_accepted_at, city, is_demo)
  values (
    new.id, v_username, v_birth, now(), now(),
    nullif(btrim(meta ->> 'city'), ''),
    coalesce((new.raw_app_meta_data ->> 'is_demo')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Verificação antes do cadastro (o Auth devolve só "Database error saving new user" quando o trigger recusa).
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[A-Za-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username))
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RN-013: cidade natal trocada no máximo 1× por temporada (quando a mudança vem do usuário)
-- ---------------------------------------------------------------------------
create or replace function private.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and new.city is distinct from old.city and old.city is not null then
    if old.city_changed_season = public.current_season_id() then
      raise exception 'CITY_CHANGE_LIMIT: a cidade natal só pode ser trocada uma vez por temporada' using errcode = 'P0001';
    end if;
    new.city_changed_season := public.current_season_id();
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function private.profiles_guard();

-- ---------------------------------------------------------------------------
-- RF-024: no máximo 5 contatos de segurança
-- ---------------------------------------------------------------------------
create or replace function private.safety_contacts_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = new.user_id for update;
  if (select count(*) from public.safety_contacts where user_id = new.user_id) >= 5 then
    raise exception 'CONTACTS_LIMIT: no máximo 5 contatos de segurança' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger safety_contacts_limit before insert on public.safety_contacts
  for each row execute function private.safety_contacts_limit();

-- ---------------------------------------------------------------------------
-- RN-011 / RF-011: crews da mesma facção, 1 crew por usuário, máx. 30 membros
-- ---------------------------------------------------------------------------
create or replace function private.crews_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_faction text;
begin
  if (select auth.uid()) is not null then
    new.leader_id := (select auth.uid());
  end if;
  if new.leader_id is null then
    raise exception 'CREW_LEADER_REQUIRED: a crew precisa de um líder' using errcode = 'P0001';
  end if;
  select faction into v_faction from public.profiles where id = new.leader_id;
  if v_faction is null then
    raise exception 'FACTION_REQUIRED: escolha uma facção antes de criar uma crew' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.crew_members where user_id = new.leader_id) then
    raise exception 'ALREADY_IN_CREW: saia da crew atual antes de criar outra' using errcode = 'P0001';
  end if;
  new.faction := v_faction;
  new.tag := upper(new.tag);
  new.invite_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  return new;
end $$;
create trigger crews_before_insert before insert on public.crews
  for each row execute function private.crews_before_insert();

create or replace function private.crews_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.crew_members (crew_id, user_id, role) values (new.id, new.leader_id, 'leader');
  return new;
end $$;
create trigger crews_after_insert after insert on public.crews
  for each row execute function private.crews_after_insert();

create or replace function private.crew_members_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_crew_faction text;
  v_user_faction text;
begin
  select faction into v_crew_faction from public.crews where id = new.crew_id for update;
  if v_crew_faction is null then
    raise exception 'CREW_NOT_FOUND: crew não encontrada' using errcode = 'P0001';
  end if;
  select faction into v_user_faction from public.profiles where id = new.user_id;
  if v_user_faction is distinct from v_crew_faction then
    raise exception 'CREW_FACTION_MISMATCH: a crew precisa ser da mesma facção do corredor' using errcode = 'P0001';
  end if;
  if (select count(*) from public.crew_members where crew_id = new.crew_id) >= 30 then
    raise exception 'CREW_FULL: a crew já tem 30 membros' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger crew_members_rules before insert on public.crew_members
  for each row execute function private.crew_members_rules();

-- Líder saiu: o membro mais antigo assume; crew vazia é apagada.
create or replace function private.crew_members_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_next uuid;
begin
  if not exists (select 1 from public.crews where id = old.crew_id) then
    return old;
  end if;
  if not exists (select 1 from public.crew_members where crew_id = old.crew_id) then
    delete from public.crews where id = old.crew_id;
  elsif old.role = 'leader' then
    select user_id into v_next from public.crew_members where crew_id = old.crew_id order by joined_at, user_id limit 1;
    update public.crew_members set role = 'leader' where user_id = v_next;
    update public.crews set leader_id = v_next where id = old.crew_id;
  end if;
  return old;
end $$;
create trigger crew_members_after_delete after delete on public.crew_members
  for each row execute function private.crew_members_after_delete();

-- ---------------------------------------------------------------------------
-- RLS em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.seasons enable row level security;
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.activities enable row level security;
alter table public.activity_points enable row level security;
alter table public.zones enable row level security;
alter table public.zone_events enable row level security;
alter table public.activity_zones enable row level security;
alter table public.safety_contacts enable row level security;
alter table public.notifications enable row level security;
alter table public.fog_cells enable row level security;
alter table public.chest_opens enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.moderation_reviews enable row level security;

-- Privilégios: anon não acessa tabelas; authenticated só o que a policy e o grant permitem.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.seasons to authenticated;
create policy seasons_read on public.seasons for select to authenticated using (true);

-- profiles: lê o próprio (staff lê todos); atualiza só campos editáveis (role/trust/status/xp nunca)
grant select on public.profiles to authenticated;
grant update (username, city, avatar_url, units, notification_prefs) on public.profiles to authenticated;
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- devices: o dono vê os aparelhos, nunca a coluna secret
grant select (id, user_id, platform, model, created_at, last_seen_at) on public.devices to authenticated;
create policy devices_read_own on public.devices for select to authenticated using (user_id = (select auth.uid()));

-- activities e pontos: só o dono (e staff para moderação); escrita só pelo service role
grant select on public.activities to authenticated;
create policy activities_read on public.activities for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

grant select on public.activity_points to authenticated;
create policy activity_points_read on public.activity_points for select to authenticated
  using (
    exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid()))
    or (select private.is_staff())
  );

grant select on public.activity_zones to authenticated;
create policy activity_zones_read on public.activity_zones for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- zonas e eventos: leitura pública para usuários logados
grant select on public.zones to authenticated;
create policy zones_read on public.zones for select to authenticated using (true);

-- zone_events sem user_id/activity_id para o cliente (privacidade de percurso, RN-010)
grant select (id, zone_id, type, faction, from_faction, created_at) on public.zone_events to authenticated;
create policy zone_events_read on public.zone_events for select to authenticated using (true);

-- safety_contacts: CRUD dos próprios
grant select, insert, delete on public.safety_contacts to authenticated;
grant update (name, phone) on public.safety_contacts to authenticated;
create policy safety_contacts_select on public.safety_contacts for select to authenticated using (user_id = (select auth.uid()));
create policy safety_contacts_insert on public.safety_contacts for insert to authenticated with check (user_id = (select auth.uid()));
create policy safety_contacts_update on public.safety_contacts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy safety_contacts_delete on public.safety_contacts for delete to authenticated using (user_id = (select auth.uid()));

-- notifications: lê as próprias e marca read_at
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- neblina e baús: leitura das próprias (escrita pelo servidor)
grant select on public.fog_cells to authenticated;
create policy fog_cells_select on public.fog_cells for select to authenticated using (user_id = (select auth.uid()));
grant select on public.chest_opens to authenticated;
create policy chest_opens_select on public.chest_opens for select to authenticated using (user_id = (select auth.uid()));

-- crews: todos leem; qualquer um cria (trigger aplica RN-011); líder renomeia ou apaga
grant select on public.crews to authenticated;
grant insert (name, tag) on public.crews to authenticated;
grant update (name) on public.crews to authenticated;
grant delete on public.crews to authenticated;
create policy crews_read on public.crews for select to authenticated using (true);
-- o trigger crews_before_insert (BEFORE, roda antes da checagem da policy) define leader_id = auth.uid()
create policy crews_insert on public.crews for insert to authenticated with check (leader_id = (select auth.uid()));
create policy crews_update_leader on public.crews for update to authenticated
  using (leader_id = (select auth.uid())) with check (leader_id = (select auth.uid()));
create policy crews_delete_leader on public.crews for delete to authenticated using (leader_id = (select auth.uid()));

-- crew_members: todos leem; entrada só via join_crew(); o próprio sai ou o líder remove
grant select, delete on public.crew_members to authenticated;
create policy crew_members_read on public.crew_members for select to authenticated using (true);
create policy crew_members_delete on public.crew_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.crews c where c.id = crew_id and c.leader_id = (select auth.uid()))
  );

-- moderation_reviews: staff lê tudo; o corredor lê as decisões sobre as próprias corridas
grant select on public.moderation_reviews to authenticated;
create policy moderation_reviews_read on public.moderation_reviews for select to authenticated
  using (
    (select private.is_staff())
    or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid()))
  );

-- Realtime no mapa (RNF-003)
alter publication supabase_realtime add table public.zones;
