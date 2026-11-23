-- RF-013 (mapa de calor), cobrado pelos testes externos nas baterias 2 a 5.
-- Intensidade por zona na área visível: corridas (`runs`) e trocas de dono (`flips`) nas últimas 24 horas, nos
-- últimos 7 dias ou na temporada. Aditiva: nenhuma tabela muda; a function só lê `activity_zones` e `zones`.
--
-- Privacidade: a resposta não tem quem correu nem quando (só a contagem por zona). Corrida só conta numa zona com
-- pelo menos 2 corredores diferentes no período, para o calor não apontar o trajeto de uma pessoa só (ex.: a
-- rua de casa). A troca de dono já é pública (mapa e avisos), então conta sempre.
create or replace function public.zone_heat_json(
  min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision,
  p_period text default '7d'
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_since timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHORIZED: faça login novamente';
  end if;
  v_since := case p_period
    when '24h' then now() - interval '24 hours'
    when '7d' then now() - interval '7 days'
    when 'season' then public.season_start()
  end;
  if v_since is null then
    raise exception 'INVALID_PERIOD: use 24h, 7d ou season';
  end if;
  if min_lng is null or min_lat is null or max_lng is null or max_lat is null
     or max_lng - min_lng not between 0 and 1 or max_lat - min_lat not between 0 and 1 then
    raise exception 'INVALID_BBOX: área do mapa inválida ou grande demais';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', h.zone_id, 'runs', h.runs, 'flips', h.flips) order by h.zone_id)
      from (
        select az.zone_id,
               (case when count(distinct az.user_id) >= 2 then count(*) else 0 end)::int as runs,
               (count(*) filter (where az.owner_before is distinct from az.owner_after))::int as flips
          from public.activity_zones az
          join public.zones z on z.id = az.zone_id
         where az.created_at >= v_since
           and extensions.st_intersects(z.geom, extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326))
         group by az.zone_id
         limit 2000
      ) h
     where h.runs > 0 or h.flips > 0
  ), '[]'::jsonb);
end $$;
revoke all on function public.zone_heat_json(double precision, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.zone_heat_json(double precision, double precision, double precision, double precision, text) to authenticated, service_role;
