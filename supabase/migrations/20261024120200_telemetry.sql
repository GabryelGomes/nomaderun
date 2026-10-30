-- NOMADE RUN — Fase 7, onda 3 (T7.3.8; D-82): telemetria opt-in, desligada por padrão.
--   * telemetry_consent: a escolha da pessoa (padrão: sem consentimento = nada é gravado);
--   * telemetry_events: lista FECHADA de 5 eventos (abrir, correr, conquistar, compartilhar, missão concluída), só o
--     DIA (Brasília), sem horário e sem localização: `props` aceita só chaves de uma lista fechada, com texto curto
--     sem ponto (nada de coordenada), booleano ou inteiro de 0 a 100.000;
--   * track_events(p_events): envio em lote (até 50); recusa com TELEMETRY_CONSENT sem consentimento e com
--     FEATURE_DISABLED com `features.telemetry` desligada; no máximo 200 eventos por pessoa por dia e 1 `app_open`
--     por dia (o excedente é descartado e contado em `dropped`, para o app não reenviar);
--   * set_telemetry_consent(p_opt_in) / my_telemetry_consent(): retirar o consentimento apaga os eventos na hora;
--   * job_telemetry_retention: apaga eventos com mais de 30 dias (03:40 BRT, idempotente);
--   * LGPD: as duas tabelas entram no account_export_v2 e caem em cascata no account-delete.
-- O cliente não lê nem escreve as tabelas (RLS ligada, nenhum grant, nenhuma policy): só as RPCs abaixo.

-- ===========================================================================
-- Tabelas
-- ===========================================================================
-- Props: chaves e valores de uma lista fechada (imutável, usada no CHECK e na RPC).
create or replace function private.telemetry_props_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and jsonb_typeof(p) = 'object' and octet_length(p::text) <= 256
     and (select count(*) from jsonb_object_keys(p)) <= 6
     and not exists (
       select 1 from jsonb_each(p) e
        where e.key not in ('model', 'format', 'withRoute', 'kind', 'source', 'missionId', 'count')
           or not case jsonb_typeof(e.value)
                    when 'boolean' then true
                    when 'string' then (e.value #>> '{}') ~ '^[a-z0-9_-]{1,32}$'
                    when 'number' then case when (e.value #>> '{}') ~ '^[0-9]{1,6}$'
                                            then (e.value #>> '{}')::integer <= 100000 else false end
                    else false end)
$$;
revoke all on function private.telemetry_props_ok(jsonb) from public, anon, authenticated;

create table public.telemetry_consent (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  opted_in boolean not null default false,
  policy_version smallint not null default 1 check (policy_version between 1 and 100),
  updated_at timestamptz not null default now()
);
comment on table public.telemetry_consent is
  'D-82: consentimento da telemetria (opt-in). Sem linha = sem consentimento. Só pelas RPCs.';

create table public.telemetry_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event text not null check (event in ('app_open', 'run_finish', 'zone_conquer', 'share', 'mission_complete')),
  day date not null,                                                  -- dia (Brasília); SEM horário
  props jsonb not null default '{}'::jsonb check (private.telemetry_props_ok(props)),
  app_version text check (app_version is null or app_version ~ '^[0-9A-Za-z.+-]{1,20}$'),
  platform text check (platform is null or platform in ('ios', 'android', 'web'))
);
create index telemetry_events_user_day_idx on public.telemetry_events (user_id, day);
create index telemetry_events_day_idx on public.telemetry_events (day);
comment on table public.telemetry_events is
  'D-82: eventos de uso com consentimento. Lista fechada, só o dia, sem localização; apagados com 30 dias.';

alter table public.telemetry_consent enable row level security;
alter table public.telemetry_events enable row level security;
revoke all on public.telemetry_consent, public.telemetry_events from anon, authenticated;
-- Sem policy e sem grant para o cliente: só as RPCs security definer abaixo e o service role.

-- ===========================================================================
-- RPCs
-- ===========================================================================
create or replace function public.my_telemetry_consent() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  c public.telemetry_consent;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into c from public.telemetry_consent where user_id = v_uid;
  return jsonb_build_object('optedIn', coalesce(c.opted_in, false), 'policyVersion', coalesce(c.policy_version, 1),
                            'enabled', private.feature_on('telemetry'));
end $$;
revoke all on function public.my_telemetry_consent() from public, anon;
grant execute on function public.my_telemetry_consent() to authenticated;

-- Dar ou retirar o consentimento. Retirar apaga na hora todos os eventos da pessoa.
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

-- Envio em lote: [{ event, day?, props?, appVersion?, platform? }], 1 a 50 itens. Lote inválido = VALIDATION (nada é
-- gravado); excedente do teto diário = descartado e contado em `dropped`.
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
  if not coalesce((select c.opted_in from public.telemetry_consent c where c.user_id = v_uid), false) then
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

  perform pg_advisory_xact_lock(hashtextextended('telemetry:' || v_uid, 0));
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
-- Retenção: 30 dias (03:40 BRT). Idempotente.
-- ===========================================================================
create or replace function public.job_telemetry_retention(p_today date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.telemetry_events where day < coalesce(p_today, public.br_today()) - 30;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.job_telemetry_retention(date) from public, anon, authenticated;
grant execute on function public.job_telemetry_retention(date) to service_role;

select cron.schedule('nomaderun-telemetry-retention', '40 6 * * *', 'select public.job_telemetry_retention()'); -- 03:40 BRT

-- ===========================================================================
-- LGPD v2: + telemetria (a lista e a exportação; o resto igual à onda 2)
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
    'telemetry_consent', 'telemetry_events']
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
                                  where x.user_id = p_user), '[]'::jsonb))
$$;
revoke all on function private.account_export_v2(uuid) from public, anon, authenticated;
