-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-63; contrato E7 §3 e §7): sequência semanal v2 e pausa de saúde.
--   * job_close_week: com features.streakV2 DESLIGADA faz exatamente o que fazia (RN-014). Ligada, segue
--     closeStreakWeek (src/domain/progression.ts): 2 atividades mantêm (mesmo na pausa) → semana na pausa fica como está →
--     congelamento automático só se há sequência a proteger → senão zera; best_streak_weeks nunca diminui; avisa na
--     central quando gastou o congelamento;
--   * start_health_pause(p_weeks) / end_health_pause(): 1 a 4 semanas, 1 vez por temporada, a partir da segunda da
--     semana atual; encerrar antes protege só a semana atual. Erros: PAUSE_WEEKS, PAUSE_USED, PAUSE_ACTIVE.

create or replace function public.job_close_week(p_week_start date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_start date := coalesce(p_week_start, (date_trunc('week', public.br_now()) - interval '7 days')::date);
  v_from timestamptz := (v_start::timestamp) at time zone 'America/Sao_Paulo';
  v_to timestamptz := ((v_start + 7)::timestamp) at time zone 'America/Sao_Paulo';
  n integer;
begin
  if not private.feature_on('streakV2') then
    -- regra v1 (RN-014), sem mudança nenhuma
    with runs as (
      select pr.id,
             (select count(*) from public.activities a
               where a.user_id = pr.id and a.scored and a.finished_at >= v_from and a.finished_at < v_to) as cnt
        from public.profiles pr
       where pr.status <> 'inactive'
    )
    update public.profiles pr
       set streak_weeks = case when r.cnt >= 2 then pr.streak_weeks + 1 when pr.freezes_left > 0 then pr.streak_weeks else 0 end,
           freezes_left = case when r.cnt < 2 and pr.freezes_left > 0 then pr.freezes_left - 1 else pr.freezes_left end
      from runs r
     where pr.id = r.id and (r.cnt >= 2 or pr.streak_weeks > 0 or pr.freezes_left > 0);
    get diagnostics n = row_count;
    return n;
  end if;

  -- regra v2 (closeStreakWeek)
  with runs as (
    select pr.id,
           (select count(*) from public.activities a
             where a.user_id = pr.id and a.scored and a.finished_at >= v_from and a.finished_at < v_to) as cnt,
           (pr.pause_from is not null and v_start <= pr.pause_until and v_start + 6 >= pr.pause_from) as paused
      from public.profiles pr
     where pr.status <> 'inactive'
  ), decided as (
    select r.id,
           case when r.cnt >= 2 then 'kept'
                when r.paused then 'paused'
                when pr.streak_weeks > 0 and pr.freezes_left > 0 then 'frozen'
                else 'reset' end as outcome
      from runs r join public.profiles pr on pr.id = r.id
  ), upd as (
    update public.profiles pr
       set streak_weeks = case d.outcome when 'kept' then pr.streak_weeks + 1 when 'reset' then 0 else pr.streak_weeks end,
           best_streak_weeks = greatest(pr.best_streak_weeks, case d.outcome when 'kept' then pr.streak_weeks + 1 else pr.streak_weeks end),
           freezes_left = case d.outcome when 'frozen' then pr.freezes_left - 1 else pr.freezes_left end
      from decided d
     where pr.id = d.id and d.outcome <> 'paused'
       and (d.outcome = 'kept' or d.outcome = 'frozen' or pr.streak_weeks > 0)
    returning pr.id, d.outcome, pr.streak_weeks, pr.freezes_left
  ), notified as (
    insert into public.notifications (user_id, type, title, body, data)
    select u.id, 'engagement', 'Semana protegida pelo congelamento', 'Sua sequência de ' || u.streak_weeks || ' semanas continua.',
           jsonb_build_object('kind', 'sequencia', 'weekStart', v_start, 'weeks', u.streak_weeks, 'freezesLeft', u.freezes_left)
      from upd u
     where u.outcome = 'frozen' and private.notify_pref(u.id, 'streak')
    returning 1
  )
  select count(*) into n from upd;
  return n;
end $$;
revoke all on function public.job_close_week(date) from public, anon, authenticated;
grant execute on function public.job_close_week(date) to service_role;

-- ---------------------------------------------------------------------------
-- Pausa de saúde (lesão, viagem, descanso)
-- ---------------------------------------------------------------------------
create or replace function public.start_health_pause(p_weeks integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := public.br_today();
  v_from date := date_trunc('week', public.br_today())::date;
  pr public.profiles;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('streakV2') then
    raise exception 'FEATURE_DISABLED: pausa de saúde ainda não está ligada' using errcode = 'P0001';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 4 then
    raise exception 'PAUSE_WEEKS: escolha de 1 a 4 semanas' using errcode = 'P0001';
  end if;
  select * into pr from public.profiles where id = v_uid for update;
  if pr.pause_from is not null and pr.pause_from <= v_today and v_today <= pr.pause_until then
    raise exception 'PAUSE_ACTIVE: sua pausa já está valendo' using errcode = 'P0001';
  end if;
  if pr.pause_used_season = public.current_season_id() then
    raise exception 'PAUSE_USED: a pausa de saúde vale 1 vez por temporada' using errcode = 'P0001';
  end if;
  update public.profiles set pause_from = v_from, pause_until = v_from + 7 * p_weeks - 1, pause_used_season = public.current_season_id()
   where id = v_uid;
  return jsonb_build_object('from', v_from, 'until', v_from + 7 * p_weeks - 1, 'seasonId', public.current_season_id());
end $$;
revoke all on function public.start_health_pause(integer) from public, anon;
grant execute on function public.start_health_pause(integer) to authenticated;

create or replace function public.end_health_pause() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := public.br_today();
  v_sunday date := date_trunc('week', public.br_today())::date + 6;
  pr public.profiles;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into pr from public.profiles where id = v_uid for update;
  if pr.pause_from is not null and pr.pause_from <= v_today and v_today <= pr.pause_until then
    -- a semana atual continua protegida; as seguintes voltam a contar
    update public.profiles set pause_until = least(pause_until, v_sunday) where id = v_uid returning * into pr;
  end if;
  return case when pr.pause_from is null then null
              else jsonb_build_object('from', pr.pause_from, 'until', pr.pause_until, 'seasonId', pr.pause_used_season) end;
end $$;
revoke all on function public.end_health_pause() from public, anon;
grant execute on function public.end_health_pause() to authenticated;
