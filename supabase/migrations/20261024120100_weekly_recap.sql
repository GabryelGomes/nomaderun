-- NOMADE RUN — Fase 7, onda 3 (T7.3.8; pedido da E8-onda2): resumo da semana para o card "Minha semana".
--   * weekly_recap(p_week_start): os números da semana (segunda a domingo, Brasília) da própria pessoa: km por dia
--     (days[7], segunda primeiro), corridas, tempo em movimento, zonas conquistadas e sequência. SEM horário: só a
--     data da segunda-feira e totais por dia;
--   * svc_weekly_recap(p_user, p_week_start): o mesmo + as até 3 corridas mais longas da semana e as zonas de
--     privacidade, só para a Edge Function `weekly-recap`, que corta as rotas com clipRouteForSharing (semente nova a
--     cada chamada) e devolve só as polylines cortadas. Os ids e as zonas nunca saem da function.
-- Somente leitura: nenhuma tabela nova, nenhum job.

create or replace function private.weekly_recap(p_user uuid, p_week_start date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (
    select p_week_start as d0,
           (p_week_start::timestamp) at time zone 'America/Sao_Paulo' as t0,
           ((p_week_start + 7)::timestamp) at time zone 'America/Sao_Paulo' as t1
  ), runs as (
    select a.id, a.meters, a.moving_seconds, ((a.started_at at time zone 'America/Sao_Paulo')::date - w.d0) as dow
      from public.activities a, w
     where a.user_id = p_user and a.scored and a.status in ('valid', 'partial')
       and a.started_at >= w.t0 and a.started_at < w.t1
  )
  select jsonb_build_object(
    'weekStart', p_week_start,
    'weekEnd', p_week_start + 6,
    'final', public.br_today() > p_week_start + 6,
    'days', (select jsonb_agg(coalesce((select round(sum(r.meters))::integer from runs r where r.dow = d), 0) order by d)
               from generate_series(0, 6) d),
    'meters', coalesce((select round(sum(r.meters))::integer from runs r), 0),
    'runs', (select count(*)::integer from runs),
    'movingSeconds', coalesce((select round(sum(r.moving_seconds))::integer from runs r), 0),
    'zones', (select count(distinct e.zone_id)::integer from public.zone_events e, w
               where e.user_id = p_user and e.type = 'captured' and e.created_at >= w.t0 and e.created_at < w.t1),
    'streakWeeks', coalesce((select pr.streak_weeks from public.profiles pr where pr.id = p_user), 0),
    'isDemo', coalesce((select pr.is_demo from public.profiles pr where pr.id = p_user), false))
$$;
revoke all on function private.weekly_recap(uuid, date) from public, anon, authenticated;

-- Semana pedida: segunda-feira, desta semana para trás, até 52 semanas. Null = semana atual.
create or replace function private.recap_week(p_week_start date) returns date
language plpgsql stable set search_path = '' as $$
declare
  v_current date := date_trunc('week', public.br_today())::date;
begin
  if p_week_start is null then return v_current; end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'VALIDATION: weekStart deve ser uma segunda-feira' using errcode = 'P0001';
  end if;
  if p_week_start > v_current or p_week_start < v_current - 7 * 52 then
    raise exception 'VALIDATION: weekStart fora do intervalo (até 52 semanas atrás)' using errcode = 'P0001';
  end if;
  return p_week_start;
end $$;
revoke all on function private.recap_week(date) from public, anon, authenticated;

-- A própria pessoa (sem rotas). O app usa a function `weekly-recap`, que traz as rotas cortadas; esta RPC é o
-- caminho sem rota (e o que a demonstração imita).
create or replace function public.weekly_recap(p_week_start date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  return private.weekly_recap(v_uid, private.recap_week(p_week_start)) || jsonb_build_object('routes', '[]'::jsonb);
end $$;
revoke all on function public.weekly_recap(date) from public, anon;
grant execute on function public.weekly_recap(date) to authenticated;

-- Edge Function weekly-recap (service role): números + candidatas a rota (até 3, as mais longas, só válidas/parciais
-- com pontos) + zonas de privacidade da pessoa. A function remove `routeIds` e `privacyZones` da resposta.
create or replace function public.svc_weekly_recap(p_user uuid, p_week_start date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_week date := private.recap_week(p_week_start);
begin
  if not exists (select 1 from public.profiles pr where pr.id = p_user and pr.status <> 'inactive') then
    raise exception 'ACCOUNT_INACTIVE: conta inativa' using errcode = 'P0001';
  end if;
  return private.weekly_recap(p_user, v_week) || jsonb_build_object(
    'routeIds', coalesce((
      select jsonb_agg(x.id order by x.meters desc, x.id)
        from (select a.id, a.meters from public.activities a
               where a.user_id = p_user and a.scored and a.status in ('valid', 'partial') and a.last_seq >= 1
                 and a.started_at >= (v_week::timestamp) at time zone 'America/Sao_Paulo'
                 and a.started_at < ((v_week + 7)::timestamp) at time zone 'America/Sao_Paulo'
               order by a.meters desc, a.id limit 3) x), '[]'::jsonb),
    'privacyZones', coalesce((
      select jsonb_agg(jsonb_build_object('lat', pz.lat, 'lng', pz.lng, 'radiusM', pz.radius_m))
        from public.privacy_zones pz where pz.user_id = p_user), '[]'::jsonb));
end $$;
revoke all on function public.svc_weekly_recap(uuid, date) from public, anon, authenticated;
grant execute on function public.svc_weekly_recap(uuid, date) to service_role;
