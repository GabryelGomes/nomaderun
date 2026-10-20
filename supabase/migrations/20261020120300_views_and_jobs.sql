-- NOMADE RUN — T1.1 (views de ranking e perfil público) e T3.6 (jobs diários com pg_cron).
--
-- As views públicas são security_invoker e leem funções security definer do schema private (não exposto):
-- assim leem tabelas privadas (activity_zones, profiles) mas expõem só agregados e campos públicos.
-- Nenhuma expõe percurso, e-mail, data de nascimento, papel ou índice de confiança.

-- ---------------------------------------------------------------------------
-- Contribuição válida por usuário na temporada atual (RF-003: troca de facção zera a contribuição)
-- ---------------------------------------------------------------------------
create or replace view private.season_contributions with (security_invoker = false) as
select az.user_id, az.faction, az.zone_id, az.rp, az.meters, az.activity_id, az.created_at
  from public.activity_zones az
  join public.profiles pr on pr.id = az.user_id
 where az.created_at >= public.season_start()
   and (pr.contribution_reset_at is null or az.created_at >= pr.contribution_reset_at)
   and pr.status <> 'inactive';
revoke all on private.season_contributions from public, anon, authenticated;

create or replace view private.public_profiles_rows with (security_invoker = false) as
select pr.id, pr.username, pr.faction, pr.city, pr.xp, pr.avatar_url, pr.created_at,
       cm.crew_id, cr.tag as crew_tag
  from public.profiles pr
  left join public.crew_members cm on cm.user_id = pr.id
  left join public.crews cr on cr.id = cm.crew_id
 where pr.status <> 'inactive';
create or replace function private.public_profiles() returns setof private.public_profiles_rows
language sql stable security definer set search_path = '' as $$ select * from private.public_profiles_rows $$;
create or replace view public.public_profiles with (security_invoker = true) as select * from private.public_profiles();
comment on view private.public_profiles_rows is 'Campos públicos do perfil (API_CONTRATO.md). Contas inativas não aparecem.';

-- RF-015: ranking individual da temporada
create or replace view private.leaderboard_individual_rows with (security_invoker = false) as
select rank() over (order by sum(c.rp) desc) as position,
       pr.id as user_id, pr.username, pr.faction, pr.city, cr.tag as crew_tag,
       sum(c.rp)::integer as rp, round(sum(c.meters))::integer as meters,
       count(distinct c.activity_id)::integer as runs
  from private.season_contributions c
  join public.profiles pr on pr.id = c.user_id
  left join public.crew_members cm on cm.user_id = pr.id
  left join public.crews cr on cr.id = cm.crew_id
 group by pr.id, pr.username, pr.faction, pr.city, cr.tag;
create or replace function private.leaderboard_individual() returns setof private.leaderboard_individual_rows
language sql stable security definer set search_path = '' as $$ select * from private.leaderboard_individual_rows $$;
create or replace view public.leaderboard_individual with (security_invoker = true) as select * from private.leaderboard_individual();

-- RF-015: ranking de crews (soma da temporada dos membros atuais)
create or replace view private.leaderboard_crews_rows with (security_invoker = false) as
select rank() over (order by coalesce(sum(c.rp), 0) desc) as position,
       cr.id as crew_id, cr.name, cr.tag, cr.faction,
       coalesce(sum(c.rp), 0)::integer as rp,
       (select count(*) from public.crew_members m where m.crew_id = cr.id)::integer as members
  from public.crews cr
  left join public.crew_members cm on cm.crew_id = cr.id
  left join private.season_contributions c on c.user_id = cm.user_id
 group by cr.id, cr.name, cr.tag, cr.faction;
create or replace function private.leaderboard_crews() returns setof private.leaderboard_crews_rows
language sql stable security definer set search_path = '' as $$ select * from private.leaderboard_crews_rows $$;
create or replace view public.leaderboard_crews with (security_invoker = true) as select * from private.leaderboard_crews();

-- RF-015: ranking de facções (RP da temporada + zonas dominadas agora)
create or replace view private.leaderboard_factions_rows with (security_invoker = false) as
with f(faction) as (values ('striders'), ('coyotes'), ('owls'), ('volt'))
select rank() over (order by coalesce(s.rp, 0) desc) as position,
       f.faction,
       coalesce(s.rp, 0)::integer as rp,
       coalesce(s.runners, 0)::integer as runners,
       (select count(*) from public.zones z where z.owner = f.faction)::integer as zones
  from f
  left join (select faction, sum(rp) as rp, count(distinct user_id) as runners
               from private.season_contributions group by faction) s on s.faction = f.faction;
create or replace function private.leaderboard_factions() returns setof private.leaderboard_factions_rows
language sql stable security definer set search_path = '' as $$ select * from private.leaderboard_factions_rows $$;
create or replace view public.leaderboard_factions with (security_invoker = true) as select * from private.leaderboard_factions();

-- RF-020 / RN-013: placar entre cidades = soma dos RP válidos dos moradores ÷ √(corredores ativos);
-- só participam cidades com 20+ corredores ativos (score nulo e eligible = false abaixo disso).
create or replace view private.leaderboard_cities_rows with (security_invoker = false) as
with active as (
  select pr.city, count(distinct a.user_id) as runners
    from public.activities a join public.profiles pr on pr.id = a.user_id
   where a.scored and a.finished_at >= public.season_start() and pr.city is not null and pr.status <> 'inactive'
   group by pr.city
), points as (
  select pr.city, sum(c.rp) as rp
    from private.season_contributions c join public.profiles pr on pr.id = c.user_id
   where pr.city is not null
   group by pr.city
)
select rank() over (order by case when a.runners >= 20 then coalesce(p.rp, 0) / sqrt(a.runners) end desc nulls last) as position,
       a.city,
       coalesce(p.rp, 0)::integer as rp,
       a.runners::integer as active_runners,
       a.runners >= 20 as eligible,
       case when a.runners >= 20 then round((coalesce(p.rp, 0) / sqrt(a.runners))::numeric, 2) end as score
  from active a left join points p on p.city = a.city;
create or replace function private.leaderboard_cities() returns setof private.leaderboard_cities_rows
language sql stable security definer set search_path = '' as $$ select * from private.leaderboard_cities_rows $$;
create or replace view public.leaderboard_cities with (security_invoker = true) as select * from private.leaderboard_cities();

revoke all on public.public_profiles, public.leaderboard_individual, public.leaderboard_crews,
              public.leaderboard_factions, public.leaderboard_cities from public, anon;
grant select on public.public_profiles, public.leaderboard_individual, public.leaderboard_crews,
               public.leaderboard_factions, public.leaderboard_cities to authenticated;
revoke all on private.public_profiles_rows, private.leaderboard_individual_rows, private.leaderboard_crews_rows,
              private.leaderboard_factions_rows, private.leaderboard_cities_rows from public, anon, authenticated;
revoke all on function private.public_profiles(), private.leaderboard_individual(), private.leaderboard_crews(),
                       private.leaderboard_factions(), private.leaderboard_cities() from public, anon;
grant execute on function private.public_profiles(), private.leaderboard_individual(), private.leaderboard_crews(),
                          private.leaderboard_factions(), private.leaderboard_cities() to authenticated, service_role;

-- ===========================================================================
-- T3.6 — Jobs. Mesmas constantes do domain (territory.ts / games.ts); os testes pgTAP conferem os números.
-- ===========================================================================

-- RN-005: todo dia às 03:00 de Brasília, influência × 0,90; abaixo de 5 vira 0; dono abaixo de 30 perde a zona.
create or replace function public.job_decay_zones() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  with decayed as (
    select z.id, z.owner,
           (select jsonb_object_agg(k, case when (v::text)::double precision * 0.9 < 5 then 0
                                            else round(((v::text)::double precision * 0.9)::numeric, 4) end)
              from jsonb_each(z.influence) as e(k, v)) as influence
      from public.zones z
     where exists (select 1 from jsonb_each(z.influence) e(k, v) where (v::text)::double precision > 0)
  ), applied as (
    update public.zones z
       set influence = d.influence,
           owner = case when d.owner is not null and coalesce((d.influence ->> d.owner)::double precision, 0) < 30 then null else z.owner end,
           shield = case when d.owner is not null and coalesce((d.influence ->> d.owner)::double precision, 0) < 30 then 0 else z.shield end,
           attacker = case when d.owner is not null and coalesce((d.influence ->> d.owner)::double precision, 0) < 30 then null else z.attacker end,
           attack_started_at = case when d.owner is not null and coalesce((d.influence ->> d.owner)::double precision, 0) < 30 then null else z.attack_started_at end,
           version = z.version + 1,
           updated_at = now()
      from decayed d
     where z.id = d.id
     returning z.id, d.owner as old_owner, z.owner as new_owner
  ), events as (
    insert into public.zone_events (zone_id, type, faction, from_faction)
    select id, 'neutralized', null, old_owner from applied where old_owner is not null and new_owner is null
    returning 1
  )
  select count(*) into n from applied;
  return n;
end $$;

-- RN-004: fim do dia (de Brasília). Dono com ≥ 500 m na zona sobe o escudo (máx. 3); dia sem corrida do dono desce 1.
create or replace function public.job_fortify_zones(p_day date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := coalesce(p_day, public.br_today() - 1);
  v_from timestamptz := (v_day::timestamp) at time zone 'America/Sao_Paulo';
  v_to timestamptz := ((v_day + 1)::timestamp) at time zone 'America/Sao_Paulo';
  n integer;
begin
  with owner_meters as (
    select z.id, z.owner, z.shield,
           coalesce((select sum(az.meters) from public.activity_zones az
                      where az.zone_id = z.id and az.faction = z.owner
                        and az.created_at >= v_from and az.created_at < v_to), 0) as meters
      from public.zones z
     where z.owner is not null
  ), changed as (
    update public.zones z
       set shield = case when m.meters >= 500 then least(3, m.shield + 1) when m.meters <= 0 then greatest(0, m.shield - 1) else m.shield end,
           version = z.version + 1,
           updated_at = now()
      from owner_meters m
     where z.id = m.id
       and (case when m.meters >= 500 then least(3, m.shield + 1) when m.meters <= 0 then greatest(0, m.shield - 1) else m.shield end) <> m.shield
     returning z.id, z.owner, z.shield as new_shield, m.shield as old_shield
  ), events as (
    insert into public.zone_events (zone_id, type, faction)
    select id, case when new_shield > old_shield then 'shield_up' else 'shield_down' end, owner from changed
    returning 1
  )
  select count(*) into n from changed;
  return n;
end $$;

-- RN-014: fecha a semana (segunda a domingo, Brasília). 2+ corridas válidas mantêm a sequência;
-- senão gasta um congelamento; sem congelamento, zera.
create or replace function public.job_close_week(p_week_start date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_start date := coalesce(p_week_start, (date_trunc('week', public.br_now()) - interval '7 days')::date);
  v_from timestamptz := (v_start::timestamp) at time zone 'America/Sao_Paulo';
  v_to timestamptz := ((v_start + 7)::timestamp) at time zone 'America/Sao_Paulo';
  n integer;
begin
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
end $$;

-- RN-006 + RN-014: virada do mês. Fecha a temporada anterior, abre a nova, multiplica a influência por 0,30
-- e devolve o congelamento mensal (1). A troca de facção fica liberada porque a temporada mudou.
create or replace function public.job_season_rollover() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_season text := public.current_season_id();
begin
  if exists (select 1 from public.seasons where id = v_season) then
    return v_season; -- já virou
  end if;
  update public.seasons set status = 'closed' where status = 'active';
  insert into public.seasons (id, starts_at, ends_at)
  values (v_season, public.season_start(v_season), public.season_start(to_char(public.season_start(v_season) + interval '40 days', 'YYYY-MM')));
  update public.zones
     set influence = (select jsonb_object_agg(k, round(((v::text)::double precision * 0.3)::numeric, 4)) from jsonb_each(influence) e(k, v)),
         version = version + 1, updated_at = now();
  update public.profiles set freezes_left = 1 where freezes_left < 1;
  return v_season;
end $$;

revoke all on function public.job_decay_zones() from public, anon, authenticated;
revoke all on function public.job_fortify_zones(date) from public, anon, authenticated;
revoke all on function public.job_close_week(date) from public, anon, authenticated;
revoke all on function public.job_season_rollover() from public, anon, authenticated;
grant execute on function public.job_decay_zones() to service_role;
grant execute on function public.job_fortify_zones(date) to service_role;
grant execute on function public.job_close_week(date) to service_role;
grant execute on function public.job_season_rollover() to service_role;

-- Temporada corrente já existe desde a criação do banco
insert into public.seasons (id, starts_at, ends_at)
values (public.current_season_id(), public.season_start(),
        public.season_start(to_char(public.season_start() + interval '40 days', 'YYYY-MM')))
on conflict do nothing;

-- Agendamentos (pg_cron usa UTC; Brasília = UTC-3, sem horário de verão)
select cron.schedule('nomaderun-fortify-zones', '5 3 * * *', 'select public.job_fortify_zones()');      -- 00:05 BRT (dia anterior)
select cron.schedule('nomaderun-decay-zones', '0 6 * * *', 'select public.job_decay_zones()');          -- 03:00 BRT (RN-005)
select cron.schedule('nomaderun-close-week', '10 3 * * 1', 'select public.job_close_week()');           -- segunda 00:10 BRT
select cron.schedule('nomaderun-season-rollover', '15 3 1 * *', 'select public.job_season_rollover()'); -- dia 1, 00:15 BRT
