-- NOMADE RUN — Fase 3 (A2): P-16 / RF-015 — rankings por período (semana, temporada) e por escopo
-- (geral, facção, cidade, distrito). As views leaderboard_* (temporada, geral) continuam como estavam.
--
-- Distrito = célula H3 de resolução 7 que contém a zona (DISTRICT_RES / districtOf em src/domain/grid.ts).
-- O banco não tem a extensão h3: private.h3_parent calcula o pai pelos bits do índice H3 (o teste pgTAP
-- compara com valores gerados pelo districtOf do domain).
-- Cidade = cidade natal do corredor (profiles.city), como no placar entre cidades (RN-013).
-- Semana = segunda 00:00 a domingo 23:59 de Brasília (igual à sequência semanal, RN-014).

-- Pai de uma célula H3 (texto hexadecimal de 15 dígitos) na resolução p_res.
-- Layout do índice: bits 52–55 = resolução; dígitos de 3 bits por resolução r em (15 - r) * 3.
-- O pai troca a resolução e marca como 7 (sem uso) os dígitos das resoluções mais finas.
create or replace function private.h3_parent(p_cell text, p_res integer) returns text
language plpgsql immutable set search_path = '' as $$
declare
  h bigint;
  cur integer;
begin
  if p_cell is null or p_cell !~ '^[0-9a-f]{15}$' or p_res is null then
    return null;
  end if;
  h := ('x' || lpad(p_cell, 16, '0'))::bit(64)::bigint;
  cur := ((h >> 52) & 15)::integer;
  if p_res < 0 or p_res > cur then
    return null;
  end if;
  h := (h & ~(15::bigint << 52)) | (p_res::bigint << 52);
  h := h | ((1::bigint << ((15 - p_res) * 3)) - 1);
  return lpad(to_hex(h), 15, '0');
end $$;

create or replace function private.district_of(p_zone text) returns text
language sql immutable set search_path = '' as $$ select private.h3_parent(p_zone, 7) $$;

-- Início do período (Brasília): semana corrente ou temporada (mês) corrente.
create or replace function private.period_start(p_period text) returns timestamptz
language sql stable set search_path = '' as $$
  select case p_period
    when 'week' then (date_trunc('week', public.br_now())) at time zone 'America/Sao_Paulo'
    else public.season_start() end
$$;

create or replace function private.check_ranking_args(p_period text, p_scope text, p_value text, p_scopes text[]) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_period is null or p_period not in ('week', 'season') then
    raise exception 'VALIDATION: período inválido (use week ou season)' using errcode = 'P0001';
  end if;
  if p_scope is null or not (p_scope = any (p_scopes)) then
    raise exception 'VALIDATION: escopo inválido (use %)', array_to_string(p_scopes, ', ') using errcode = 'P0001';
  end if;
  if p_scope <> 'general' and coalesce(btrim(p_value), '') = '' then
    raise exception 'VALIDATION: informe o valor do escopo (facção, cidade ou distrito)' using errcode = 'P0001';
  end if;
  if p_scope = 'district' and p_value !~ '^[0-9a-f]{15}$' then
    raise exception 'VALIDATION: distrito inválido (índice H3 de resolução 7)' using errcode = 'P0001';
  end if;
end $$;

-- Contribuições válidas no período (RF-003: troca de facção zera a contribuição; contas inativas fora).
create or replace function private.period_contributions(p_period text)
returns table (user_id uuid, faction text, city text, zone_id text, rp integer, meters real, activity_id uuid)
language sql stable security definer set search_path = '' as $$
  select az.user_id, pr.faction, pr.city, az.zone_id, az.rp, az.meters, az.activity_id
    from public.activity_zones az
    join public.profiles pr on pr.id = az.user_id
   where az.created_at >= private.period_start(p_period)
     and (pr.contribution_reset_at is null or az.created_at >= pr.contribution_reset_at)
     and pr.status <> 'inactive'
$$;

-- RF-015: corredores. Escopos: general | faction (p_value = facção) | city (cidade natal) | district (H3 res 7).
create or replace function public.ranking_runners(
  p_period text default 'season', p_scope text default 'general', p_value text default null, p_limit integer default 100
) returns table ("position" bigint, user_id uuid, username text, faction text, city text, crew_tag text, rp integer, meters integer, runs integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.check_ranking_args(p_period, p_scope, p_value, array['general', 'faction', 'city', 'district']);
  return query
  select rank() over (order by sum(c.rp) desc),
         pr.id, pr.username, pr.faction, pr.city, cr.tag,
         sum(c.rp)::integer, round(sum(c.meters))::integer, count(distinct c.activity_id)::integer
    from private.period_contributions(p_period) c
    join public.profiles pr on pr.id = c.user_id
    left join public.crew_members cm on cm.user_id = pr.id
    left join public.crews cr on cr.id = cm.crew_id
   where (p_scope <> 'faction' or pr.faction = p_value)
     and (p_scope <> 'city' or pr.city = p_value)
     and (p_scope <> 'district' or private.district_of(c.zone_id) = p_value)
   group by pr.id, pr.username, pr.faction, pr.city, cr.tag
   order by 1, pr.username
   limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

-- RF-015: crews (soma dos membros atuais). Escopos: general | faction | city (cidade natal dos membros) | district.
-- Nos escopos city/district só aparecem crews com pontos ali.
create or replace function public.ranking_crews(
  p_period text default 'season', p_scope text default 'general', p_value text default null, p_limit integer default 100
) returns table ("position" bigint, crew_id uuid, name text, tag text, faction text, rp integer, members integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.check_ranking_args(p_period, p_scope, p_value, array['general', 'faction', 'city', 'district']);
  return query
  with s as (
    select cm.crew_id, sum(c.rp) as rp
      from private.period_contributions(p_period) c
      join public.crew_members cm on cm.user_id = c.user_id
     where (p_scope <> 'city' or c.city = p_value)
       and (p_scope <> 'district' or private.district_of(c.zone_id) = p_value)
     group by cm.crew_id
  )
  select rank() over (order by coalesce(s.rp, 0) desc),
         cr.id, cr.name, cr.tag, cr.faction, coalesce(s.rp, 0)::integer,
         (select count(*) from public.crew_members m where m.crew_id = cr.id)::integer
    from public.crews cr
    left join s on s.crew_id = cr.id
   where (p_scope <> 'faction' or cr.faction = p_value)
     and (p_scope not in ('city', 'district') or s.rp > 0)
   order by 1, cr.name
   limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

-- RF-015: facções. Escopos: general | city (RP de quem tem a cidade natal; zonas com zones.city) | district.
create or replace function public.ranking_factions(
  p_period text default 'season', p_scope text default 'general', p_value text default null
) returns table ("position" bigint, faction text, rp integer, runners integer, zones integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.check_ranking_args(p_period, p_scope, p_value, array['general', 'city', 'district']);
  return query
  with f(faction) as (values ('striders'), ('coyotes'), ('owls'), ('volt')),
  s as (
    select c.faction, sum(c.rp) as rp, count(distinct c.user_id) as runners
      from private.period_contributions(p_period) c
     where (p_scope <> 'city' or c.city = p_value)
       and (p_scope <> 'district' or private.district_of(c.zone_id) = p_value)
     group by c.faction
  )
  select rank() over (order by coalesce(s.rp, 0) desc),
         f.faction, coalesce(s.rp, 0)::integer, coalesce(s.runners, 0)::integer,
         (select count(*) from public.zones z
           where z.owner = f.faction
             and (p_scope <> 'city' or z.city = p_value)
             and (p_scope <> 'district' or private.district_of(z.id) = p_value))::integer
    from f left join s on s.faction = f.faction
   order by 1, f.faction;
end $$;

-- Nome legível de um distrito: o nome-base mais comum das zonas dele ("Jardim Goiás"); sem nomes, "Distrito XXXX".
create or replace function public.district_label(p_district text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select regexp_replace(z.name, '\s+\d+$', '') as base
       from public.zones z
      where z.name is not null and private.district_of(z.id) = p_district
      group by base order by count(*) desc, base limit 1),
    'Distrito ' || upper(substr(coalesce(p_district, ''), 4, 4)))
$$;

revoke all on function private.h3_parent(text, integer) from public, anon;
revoke all on function private.district_of(text) from public, anon;
revoke all on function private.period_start(text) from public, anon;
revoke all on function private.check_ranking_args(text, text, text, text[]) from public, anon, authenticated;
revoke all on function private.period_contributions(text) from public, anon, authenticated;
grant execute on function private.h3_parent(text, integer), private.district_of(text) to authenticated, service_role;
revoke all on function public.ranking_runners(text, text, text, integer) from public, anon;
revoke all on function public.ranking_crews(text, text, text, integer) from public, anon;
revoke all on function public.ranking_factions(text, text, text) from public, anon;
revoke all on function public.district_label(text) from public, anon;
grant execute on function public.ranking_runners(text, text, text, integer), public.ranking_crews(text, text, text, integer),
                          public.ranking_factions(text, text, text), public.district_label(text) to authenticated, service_role;
