-- NOMADE RUN — Fase 7, onda 2 (T7.2.2; contrato E7 §3, LGPD/RNF-013): my_engagement() e exportação v2.
--   * my_engagement(): nível, título, faixa, sequência, baú do dia, missões e trilha num só retorno (E7 §3), com
--     a curva, os títulos e as faixas de private.domain_constants() (paridade com progression.ts no teste Deno);
--   * account_export_v2(): a exportação antiga + TODAS as tabelas novas com dado da pessoa. O teste estrutural
--     (pgTAP 24) falha se uma tabela com coluna de usuário não estiver em private.export_v2_tables().

-- ===========================================================================
-- Progressão (levelProgress, titleForLevel, runnerBand, seasonTrackStep) em SQL, a partir das constantes do domain
-- ===========================================================================
-- xpToNextLevel(n) = arred10(50 · n^1,3) + 50
create or replace function private.xp_to_next_level(p_level integer) returns integer
language sql immutable set search_path = '' as $$
  select (round((private.domain_constants() #>> '{LEVEL_CURVE,base}')::numeric
                * power(p_level::numeric, (private.domain_constants() #>> '{LEVEL_CURVE,exponent}')::numeric)
                / (private.domain_constants() #>> '{LEVEL_CURVE,round}')::numeric)
          * (private.domain_constants() #>> '{LEVEL_CURVE,round}')::numeric
          + (private.domain_constants() #>> '{LEVEL_CURVE,plus}')::numeric)::integer
$$;
revoke all on function private.xp_to_next_level(integer) from public, anon, authenticated;

create or replace function private.level_progress(p_xp bigint) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_level integer := 1;
  v_left bigint := greatest(0, coalesce(p_xp, 0));
  v_max integer := private.dc('MAX_LEVEL')::integer;
  v_title jsonb;
begin
  while v_level < v_max and v_left >= private.xp_to_next_level(v_level) loop
    v_left := v_left - private.xp_to_next_level(v_level);
    v_level := v_level + 1;
  end loop;
  select t into v_title from jsonb_array_elements(private.domain_constants() -> 'RUNNER_TITLES') t
   where (t ->> 'minLevel')::integer <= v_level order by (t ->> 'minLevel')::integer desc limit 1;
  return jsonb_build_object('level', v_level, 'intoLevel', v_left,
                            'needed', case when v_level >= v_max then 0 else private.xp_to_next_level(v_level) end,
                            'isMax', v_level >= v_max,
                            'title', jsonb_build_object('id', v_title ->> 'id', 'name', v_title ->> 'name'));
end $$;
revoke all on function private.level_progress(bigint) from public, anon, authenticated;

create or replace function private.runner_band(p_meters bigint) returns jsonb
language sql immutable set search_path = '' as $$
  with b as (
    select t, ord from jsonb_array_elements(private.domain_constants() -> 'RUNNER_BANDS') with ordinality x(t, ord)
  ), cur as (
    select t, ord from b where (t ->> 'minKm')::numeric * 1000 <= greatest(0, coalesce(p_meters, 0)) order by ord desc limit 1
  )
  select jsonb_build_object('id', cur.t ->> 'id', 'name', cur.t ->> 'name',
                            'next', (select n.t ->> 'id' from b n where n.ord = cur.ord + 1),
                            'metersToNext', coalesce((select ceil((n.t ->> 'minKm')::numeric * 1000 - greatest(0, coalesce(p_meters, 0)))::bigint
                                                        from b n where n.ord = cur.ord + 1), 0))
    from cur
$$;
revoke all on function private.runner_band(bigint) from public, anon, authenticated;

create or replace function private.season_track_step(p_xp integer) returns jsonb
language sql immutable set search_path = '' as $$
  with k as (select private.domain_constants() -> 'SEASON_TRACK' as t),
  s as (select least((t ->> 'steps')::integer, greatest(0, coalesce(p_xp, 0)) / (t ->> 'stepXp')::integer) as step, t from k)
  select jsonb_build_object(
    'step', s.step,
    'intoStep', case when s.step < (s.t ->> 'steps')::integer then greatest(0, coalesce(p_xp, 0)) - s.step * (s.t ->> 'stepXp')::integer else 0 end,
    'medal', case when s.step >= (s.t ->> 'ouro')::integer then 'ouro' when s.step >= (s.t ->> 'prata')::integer then 'prata'
                  when s.step >= (s.t ->> 'bronze')::integer then 'bronze' end,
    'prestigeStars', greatest(0, (greatest(0, coalesce(p_xp, 0)) - (s.t ->> 'steps')::integer * (s.t ->> 'stepXp')::integer)
                                 / (s.t ->> 'prestigeXp')::integer))
    from s
$$;
revoke all on function private.season_track_step(integer) from public, anon, authenticated;

-- ===========================================================================
-- my_engagement(): a tela "Você", o resumo e a faixa de hoje num só retorno (E7 §3).
-- Partes de feature desligada vêm null (o app mostra o estado vazio); nível, título e faixa sempre existem.
-- ===========================================================================
create or replace function public.my_engagement() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  pr public.profiles;
  v_keys text[] := private.mission_periods(now());
  v_season text := public.current_season_id();
  v_week date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  v_level jsonb;
  v_season_xp integer;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into pr from public.profiles where id = v_uid;
  v_level := private.level_progress(pr.xp);
  if private.feature_on('missions') then
    perform private.ensure_missions(v_uid, now());
  end if;
  v_season_xp := private.season_xp(v_uid, v_season);
  return jsonb_build_object(
    'level', v_level -> 'level', 'xp', pr.xp, 'intoLevel', v_level -> 'intoLevel', 'needed', v_level -> 'needed',
    'isMax', v_level -> 'isMax', 'title', v_level -> 'title',
    'band', private.runner_band(pr.lifetime_meters),
    'lifetimeMeters', pr.lifetime_meters,
    'streak', jsonb_build_object(
      'weeks', pr.streak_weeks, 'best', pr.best_streak_weeks, 'freezesLeft', pr.freezes_left,
      'activitiesThisWeek', (select count(*) from public.activities a
                              where a.user_id = v_uid and a.scored and a.status in ('valid', 'partial')
                                and coalesce(a.ended_at, a.finished_at) >= (v_week + time '00:00') at time zone 'America/Sao_Paulo'),
      'pause', case when pr.pause_from is null then null
                    else jsonb_build_object('from', pr.pause_from, 'until', pr.pause_until) end),
    'dailyChest', case when not private.feature_on('dailyChest') then null else jsonb_build_object(
      'stored', case when exists (select 1 from public.daily_rewards d where d.user_id = v_uid and d.day = public.br_today())
                     then 0 else private.daily_chests_stored(v_uid) end,
      'openedToday', exists (select 1 from public.daily_rewards d where d.user_id = v_uid and d.day = public.br_today()),
      'pityLeft', greatest(1, private.param_num('daily_chest', 'pityAt', 20)::integer - pr.daily_chest_pity),
      'odds', (select g.value -> 'odds' from public.game_config g where g.key = 'daily_chest')) end,
    'missions', case when not private.feature_on('missions') then null else jsonb_build_object(
      'daily', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                          where um.user_id = v_uid and um.period_key = v_keys[1]), '[]'::jsonb),
      'weekly', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                           where um.user_id = v_uid and um.period_key = v_keys[2]), '[]'::jsonb),
      'ftue', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                         where um.user_id = v_uid and um.period_key = 'ftue'), '[]'::jsonb),
      'comeback', (select private.mission_json(um) from public.user_missions um
                    where um.user_id = v_uid and um.kind = 'volta' and um.completed_at is null
                    order by um.created_at desc limit 1)) end,
    'season', case when not private.feature_on('track') then null
                   else jsonb_build_object('id', v_season, 'xp', v_season_xp) || private.season_track_step(v_season_xp) end);
end $$;
revoke all on function public.my_engagement() from public, anon;
grant execute on function public.my_engagement() to authenticated;

-- ===========================================================================
-- LGPD v2: exportação com todas as tabelas que têm dado da pessoa
-- ===========================================================================
-- Tabelas do public com coluna que aponta para a pessoa (FK para profiles/auth.users) cobertas pela exportação.
-- O pgTAP 24 compara esta lista com o catálogo: tabela nova com usuário e fora daqui = teste vermelho.
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
    'user_settings', 'feed_items', 'kudos']
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
                               where f.user_id = p_user), '[]'::jsonb))
$$;
revoke all on function private.account_export_v2(uuid) from public, anon, authenticated;

-- Para a Edge Function account-export (service role).
create or replace function public.svc_account_export_v2(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.account_export_v2(p_user)
$$;
revoke all on function public.svc_account_export_v2(uuid) from public, anon, authenticated;
grant execute on function public.svc_account_export_v2(uuid) to service_role;

-- A própria pessoa, direto pela API (mesmo conteúdo; o e-mail vem do Auth no app).
create or replace function public.account_export_v2() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  return private.account_export_v2(v_uid);
end $$;
revoke all on function public.account_export_v2() from public, anon;
grant execute on function public.account_export_v2() to authenticated;
