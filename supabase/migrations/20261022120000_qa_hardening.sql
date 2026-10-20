-- NOMADE RUN — Fase 4 (A2): correções dos achados do QA (docs/QA.md, D-50).
-- QA-01 convite de crew só para membros · QA-02 ghostPace só na Fuga (150–900 s/km) · QA-04 /zones com até 2.000 zonas
-- QA-05 avatar_url só no bucket avatars · QA-07 conta inativa sem acesso (RLS + pre-request do PostgREST)
-- QA-08 teto de pontos por corrida e de corridas abertas · QA-16 staff sem data de nascimento nem moderator_id
-- Cadastro: cidade natal dos metadados validada (CITY_INVALID).

-- ===========================================================================
-- QA-07: conta inativa (status = 'inactive') perde o acesso ao PostgREST, ao Realtime e ao Storage na hora,
-- sem esperar o JWT de 1 h expirar. 'suspended' é a suspensão de competição (RN-009, 30 dias): a pessoa continua
-- usando o app e as corridas vão para a moderação, como nas Edge Functions.
-- ===========================================================================
create or replace function private.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select pr.status <> 'inactive' from public.profiles pr where pr.id = (select auth.uid())), false)
$$;
revoke all on function private.is_active() from public, anon;
grant execute on function private.is_active() to authenticated, service_role;

create or replace function private.require_active() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active() then
    raise exception 'ACCOUNT_INACTIVE: conta inativa' using errcode = 'P0001';
  end if;
end $$;
revoke all on function private.require_active() from public, anon;
grant execute on function private.require_active() to authenticated, service_role;

-- Pre-request do PostgREST: roda antes de toda requisição REST/RPC. Conta inativa recebe 401 ACCOUNT_INACTIVE.
-- Fica em public (anon também passa por aqui e não enxerga o schema private); não é security definer.
create or replace function public.check_request() returns void
language plpgsql stable set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return; -- anon e service role
  end if;
  if not private.is_active() then
    raise exception 'ACCOUNT_INACTIVE: conta inativa' using errcode = 'PT401';
  end if;
end $$;
revoke all on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

-- Policies restritivas: somam-se (AND) às permissivas de cada tabela com dados privados ou escrita do cliente.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'devices', 'activities', 'activity_points', 'activity_zones', 'safety_contacts',
                           'notifications', 'fog_cells', 'chest_opens', 'chests', 'privacy_zones', 'moderation_reviews', 'crews'] loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select private.is_active())) with check ((select private.is_active()))',
                   t || '_active_account', t);
  end loop;
end $$;
create policy crew_members_active_account on public.crew_members as restrictive for delete to authenticated
  using ((select private.is_active()));
create policy avatars_active_account on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'avatars' or (select private.is_active()))
  with check (bucket_id <> 'avatars' or (select private.is_active()));

-- RPCs security definer do cliente (não passam pela RLS): conferem a conta também.
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
  perform private.require_active();
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

create or replace function public.join_crew(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_crew public.crews;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001';
  end if;
  perform private.require_active();
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
  perform private.require_active();
  delete from public.crew_members where user_id = v_uid;
  return found;
end $$;

create or replace function public.daily_chests(p_lat double precision default null, p_lng double precision default null) returns jsonb
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
  perform private.require_active();
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

-- ===========================================================================
-- QA-01: a linha da crew (com invite_code) só é legível por membros; nome/sigla/facção para todos em public_crews.
-- ===========================================================================
create or replace function private.is_crew_member(p_crew uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.crew_members where crew_id = p_crew and user_id = (select auth.uid()))
$$;
revoke all on function private.is_crew_member(uuid) from public, anon;
grant execute on function private.is_crew_member(uuid) to authenticated, service_role;

drop policy crews_read on public.crews;
-- leader_id vem do trigger BEFORE INSERT: o líder lê a crew recém-criada no RETURNING (antes do crew_members existir)
create policy crews_read_members on public.crews for select to authenticated
  using (leader_id = (select auth.uid()) or private.is_crew_member(id));

create or replace view private.public_crews_rows with (security_invoker = false) as
select cr.id, cr.name, cr.tag, cr.faction, cr.leader_id, cr.created_at,
       (select count(*) from public.crew_members m where m.crew_id = cr.id)::integer as members
  from public.crews cr;
create or replace function private.public_crews() returns setof private.public_crews_rows
language sql stable security definer set search_path = '' as $$ select * from private.public_crews_rows $$;
create or replace view public.public_crews with (security_invoker = true) as select * from private.public_crews();
comment on view public.public_crews is 'QA-01: crews visíveis para todos, sem o código de convite (só membros leem public.crews).';
revoke all on private.public_crews_rows from public, anon, authenticated;
revoke all on function private.public_crews() from public, anon;
grant execute on function private.public_crews() to authenticated, service_role;
revoke all on public.public_crews from public, anon;
grant select on public.public_crews to authenticated;

-- ===========================================================================
-- QA-16: staff lê perfis de outros só pela view staff_profiles (sem nascimento, aceites e preferências);
-- moderator_id não sai pela API (fica para auditoria no banco).
-- ===========================================================================
drop policy profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));

create or replace view private.staff_profiles_rows with (security_invoker = false) as
select pr.id, pr.username, pr.faction, pr.city, pr.avatar_url, pr.role, pr.status, pr.suspended_until, pr.trust,
       pr.xp, pr.streak_weeks, pr.is_demo, pr.created_at, pr.updated_at
  from public.profiles pr;
create or replace function private.staff_profiles() returns setof private.staff_profiles_rows
language sql stable security definer set search_path = '' as $$
  select * from private.staff_profiles_rows where private.is_staff()
$$;
create or replace view public.staff_profiles with (security_invoker = true) as select * from private.staff_profiles();
comment on view public.staff_profiles is 'QA-16: perfis para o painel de moderação/admin (só staff ativo vê linhas; sem data de nascimento).';
revoke all on private.staff_profiles_rows from public, anon, authenticated;
revoke all on function private.staff_profiles() from public, anon;
grant execute on function private.staff_profiles() to authenticated, service_role;
revoke all on public.staff_profiles from public, anon;
grant select on public.staff_profiles to authenticated;

revoke select on public.moderation_reviews from authenticated;
grant select (id, activity_id, decision, justification, created_at) on public.moderation_reviews to authenticated;

-- ===========================================================================
-- QA-05: avatar_url só a URL pública do bucket avatars, na pasta do próprio usuário; preferências com tamanho limitado.
-- Hosts: Supabase Cloud (<ref de 20 letras>.supabase.co), localhost e IPs de rede local (Expo Go no aparelho).
-- ===========================================================================
create or replace function private.valid_avatar_url(p_url text, p_user uuid) returns boolean
language sql immutable set search_path = '' as $$
  select p_url is null or (
    char_length(p_url) <= 500
    and p_url ~ ('^https?://(localhost|127\.0\.0\.1|10(\.[0-9]{1,3}){3}|192\.168(\.[0-9]{1,3}){2}|172\.(1[6-9]|2[0-9]|3[01])(\.[0-9]{1,3}){2}'
                 || '|[a-z0-9]{20}\.supabase\.co)(:[0-9]{2,5})?/storage/v1/object/public/avatars/'
                 || p_user::text || '/[A-Za-z0-9._-]{1,100}(\?[A-Za-z0-9=&._-]{0,100})?$'))
$$;
grant execute on function private.valid_avatar_url(text, uuid) to authenticated, service_role;
alter table public.profiles add constraint profiles_avatar_url_bucket check (private.valid_avatar_url(avatar_url, id));
alter table public.profiles add constraint profiles_notification_prefs_size check (octet_length(notification_prefs::text) <= 512);

-- ===========================================================================
-- QA-04: /zones devolve até 2.000 zonas num único JSON (o max_rows do PostgREST corta resultados em linhas).
-- ===========================================================================
create or replace function public.zones_in_bbox_json(
  min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(z)), '[]'::jsonb) from public.zones_in_bbox(min_lng, min_lat, max_lng, max_lat) z
$$;
revoke all on function public.zones_in_bbox_json(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.zones_in_bbox_json(double precision, double precision, double precision, double precision) to authenticated, service_role;

-- ===========================================================================
-- QA-02 / QA-08: ingestão com fantasma só na Fuga (150–900 s/km), no máximo 14.400 pontos por corrida
-- (4 h a 1 ponto/s) e no máximo 3 corridas abertas por usuário (abertas há mais de 24 h contam como abandonadas).
-- ===========================================================================
create or replace function public.svc_ingest_points(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c_max_points constant integer := 14400;
  c_max_open constant integer := 3;
  v_user uuid := (p ->> 'userId')::uuid;
  v_act uuid := (p ->> 'activityId')::uuid;
  v_dev uuid := (p ->> 'deviceId')::uuid;
  v_from integer := (p ->> 'fromSeq')::integer;
  v_to integer := (p ->> 'toSeq')::integer;
  v_mission text := coalesce(p ->> 'mission', 'livre');
  v_ghost real := (p ->> 'ghostPace')::real;
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

  if not exists (select 1 from public.activities where id = v_act) then
    perform 1 from public.profiles where id = v_user for update; -- serializa a criação de corridas do usuário
    if (select count(*) from public.activities
         where user_id = v_user and status = 'recording' and created_at > now() - interval '24 hours') >= c_max_open then
      return jsonb_build_object('error', 'TOO_MANY_OPEN_RUNS');
    end if;
  end if;

  insert into public.activities (id, user_id, device_id, started_at, mission, ghost_pace)
  values (
    v_act, v_user, v_dev,
    private.ms_to_ts(coalesce((p ->> 'startedAt')::double precision, v_first_t)),
    v_mission,
    case when v_mission = 'fuga' and v_ghost between 150 and 900 then v_ghost end
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
  if v_to >= c_max_points then
    return jsonb_build_object('error', 'POINTS_LIMIT', 'lastSeq', a.last_seq);
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

-- ===========================================================================
-- Cadastro: cidade natal opcional nos metadados (o app passa a enviar), com a mesma regra da coluna (2–80).
-- ===========================================================================
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := nullif(btrim(meta ->> 'username'), '');
  v_city text := nullif(btrim(meta ->> 'city'), '');
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
  if v_city is not null and char_length(v_city) not between 2 and 80 then
    raise exception 'CITY_INVALID: a cidade natal deve ter de 2 a 80 caracteres' using errcode = '22023';
  end if;

  insert into public.profiles (id, username, birthdate, terms_accepted_at, privacy_accepted_at, city, is_demo)
  values (
    new.id, v_username, v_birth, now(), now(), v_city,
    coalesce((new.raw_app_meta_data ->> 'is_demo')::boolean, false)
  );
  return new;
end $$;
