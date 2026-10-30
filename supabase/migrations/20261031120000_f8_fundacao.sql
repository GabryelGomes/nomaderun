-- NOMADE RUN — Fase 8, onda A, frente A2 (E9 + E3): "uma verdade só". Só aditivo.
--   * D-92: a curva de nível do app passa a ser UMA (`levelProgress`, progression.ts), a mesma de
--     `private.level_progress` (20261023121000). Nada muda aqui no cálculo: o pgTAP 31 compara 50 valores de XP com o
--     domain (a tabela do teste é conferida contra o domain pelo Deno `level_parity.test.ts`);
--   * D-96: `faction_activity()` — quantos corredores de cada time tiveram corrida aceita nos últimos 7 dias. Só
--     contagens (nenhum id, nome ou lugar). Conta real nunca recebe número de conta de demonstração (e vice-versa);
--   * marcos da pintura no resultado da corrida: `svc_paint_milestones()` grava `v2_extras.milestones` com
--     "primeiro trecho pintado" (1 vez na vida) e "recorde de trechos numa corrida" (comparação só consigo);
--   * eco da crew: `crew_echo()` — "Rafa reforçou 3 trechos que você pintou", agregado do dia anterior (Brasília),
--     só entre 07h e 22h, só com colegas que compartilham corridas com a crew e fora das zonas de privacidade deles.

-- ===========================================================================
-- Índice para as contagens globais da semana (faction_activity): só corridas pontuadas.
-- ===========================================================================
create index if not exists activities_scored_started_idx on public.activities (started_at) where scored;

-- ===========================================================================
-- D-96: faction_activity()
-- ===========================================================================
-- Ativo = pessoa com status 'active', com time, e pelo menos uma corrida aceita (pontuada, valid/partial) que terminou
-- nos últimos 7 dias. Os 4 times sempre aparecem (0 quando ninguém correu). O selo "Precisa de reforço" é decidido no
-- app pela regra pura `factionNeedingBoost` (src/domain/faction-activity.ts): o servidor entrega só os números.
create or replace function public.faction_activity() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_demo boolean;
  v_now timestamptz := now();
  v_from timestamptz := now() - interval '7 days';
  v_counts jsonb;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  -- conta real só vê conta real; a demonstração só vê a demonstração (e vem marcada)
  v_demo := coalesce((select pr.is_demo from public.profiles pr where pr.id = v_uid), false);
  with ran as (
    select distinct a.user_id
      from public.activities a
     where a.scored and a.status in ('valid', 'partial')
       and a.started_at >= v_from - interval '1 day'            -- usa activities_scored_started_idx
       and coalesce(a.ended_at, a.finished_at, a.started_at) >= v_from
       and coalesce(a.ended_at, a.finished_at, a.started_at) <= v_now
  ), active as (
    select p.faction, count(*)::integer as n
      from ran r
      join public.profiles p on p.id = r.user_id
     where p.faction is not null and p.status = 'active' and p.is_demo = v_demo
     group by p.faction
  )
  select jsonb_object_agg(f.faction, coalesce(a.n, 0) order by f.ord)
    into v_counts
    from unnest(array['striders', 'coyotes', 'owls', 'volt']) with ordinality f(faction, ord)
    left join active a on a.faction = f.faction;
  return jsonb_build_object(
    'windowDays', 7,
    'since', private.ts_to_ms(v_from),
    'counts', v_counts,
    'total', (select sum(v::integer) from jsonb_each_text(v_counts) e(k, v)),
    'isDemo', v_demo);
end $$;
revoke all on function public.faction_activity() from public, anon;
grant execute on function public.faction_activity() to authenticated;
comment on function public.faction_activity() is
  'D-96: corredores ativos por time nos últimos 7 dias (só contagens). Conta de demonstração só conta demonstração.';

-- ===========================================================================
-- Marcos da pintura: primeiro trecho (1 vez na vida) e recorde de trechos numa corrida
-- ===========================================================================
-- Trechos de uma corrida = v2_extras.paint.cells (o que a gravação v2 já aplicou). Regra v1 (sem `paint`) → sem marco.
create or replace function private.paint_cells_of(p_extras jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_extras -> 'paint') = 'object' and jsonb_typeof(p_extras -> 'paint' -> 'cells') = 'number'
              then greatest(0, (p_extras -> 'paint' ->> 'cells')::numeric)::integer
              else 0 end
$$;
revoke all on function private.paint_cells_of(jsonb) from public, anon, authenticated;

-- Chamada pela function (finish-activity / moderate-activity) logo depois de svc_apply_v2. Idempotente: a resposta fica
-- em activities.v2_extras.milestones e a repetição devolve a mesma. Mesma trava por pessoa de svc_apply_v2 (perfil
-- `for update`), então duas corridas da mesma pessoa nunca ganham os dois o "primeiro trecho".
--   firstPaint: a corrida pintou ≥ 1 trecho e nenhuma OUTRA corrida da pessoa com trechos já ganhou o marco nem
--               terminou antes desta (corridas pintadas antes desta migration contam como "antes");
--   cellsRecord: trechos > o maior número de trechos de qualquer outra corrida da pessoa (≥ 1). Nunca junto com o
--               firstPaint (a 1ª corrida pintada não é "recorde"). Comparação só com a própria pessoa.
create or replace function public.svc_paint_milestones(p_user uuid, p_activity uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.activities;
  v_cells integer;
  v_end timestamptz;
  v_first boolean;
  v_best integer;
  v_out jsonb;
begin
  perform 1 from public.profiles where id = p_user for update;
  select * into a from public.activities where id = p_activity and user_id = p_user for update;
  if a.id is null or a.v2_extras is null or not a.scored then
    return null;
  end if;
  if jsonb_typeof(a.v2_extras -> 'milestones') = 'object' then
    return a.v2_extras -> 'milestones';
  end if;
  if jsonb_typeof(a.v2_extras -> 'paint') is distinct from 'object' then
    return null;
  end if;
  v_cells := private.paint_cells_of(a.v2_extras);
  v_end := coalesce(a.ended_at, a.finished_at, a.started_at);
  select max(private.paint_cells_of(o.v2_extras)) into v_best
    from public.activities o
   where o.user_id = p_user and o.id <> a.id and o.scored and private.paint_cells_of(o.v2_extras) > 0;
  v_first := v_cells > 0 and not exists (
    select 1 from public.activities o
     where o.user_id = p_user and o.id <> a.id and o.scored and private.paint_cells_of(o.v2_extras) > 0
       and (coalesce((o.v2_extras #>> '{milestones,firstPaint}')::boolean, false)
            or (coalesce(o.ended_at, o.finished_at, o.started_at), o.id) < (v_end, a.id)));
  v_out := jsonb_build_object(
    'firstPaint', v_first,
    'cells', v_cells,
    'cellsRecord', case when not v_first and v_cells > 0 and coalesce(v_best, 0) >= 1 and v_cells > v_best
                        then jsonb_build_object('value', v_cells, 'previous', v_best) end);
  update public.activities set v2_extras = v2_extras || jsonb_build_object('milestones', v_out) where id = a.id;
  return v_out;
end $$;
revoke all on function public.svc_paint_milestones(uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_paint_milestones(uuid, uuid) to service_role;

-- ===========================================================================
-- Eco da crew: quem da crew reforçou ontem os trechos que você pintou
-- ===========================================================================
-- Fonte: paint_marks (quem pintou qual trecho em cada dia de Brasília; o servidor guarda 2 dias). "Seus trechos" = os
-- que você marcou ontem ou anteontem; "reforço" = um colega da sua crew (mesmo time) marcou o mesmo trecho ontem.
-- Fora: colega que não compartilha corridas com a crew (user_settings.share_runs_to_feed), conta não ativa e trecho
-- dentro da máscara de uma zona de privacidade DO COLEGA (D-87). Só nome do colega e contagens; nada de lugar.
-- Entre 22h e 7h (Brasília) devolve null: o aviso nunca sai nesse horário. 1 agregado por dia (o de ontem).
-- Regra com o relógio como parâmetro (o pgTAP fixa a hora); public.crew_echo() chama com now().
create or replace function private.crew_echo_at(p_uid uuid, p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_crew uuid;
  v_local timestamp := p_now at time zone 'America/Sao_Paulo';
  v_today date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_day date := (p_now at time zone 'America/Sao_Paulo')::date - 1;
  v_name text;
  v_top_cells integer;
  v_mates integer;
  v_cells integer;
begin
  select cm.crew_id into v_crew from public.crew_members cm where cm.user_id = p_uid;
  if v_crew is null or extract(hour from v_local) < 7 or extract(hour from v_local) >= 22 then
    return null;
  end if;
  with hits as (
    select distinct m.user_id as mate, m.cell
      from public.paint_marks m
      join public.crew_members cm on cm.user_id = m.user_id and cm.crew_id = v_crew
      join public.profiles p on p.id = m.user_id and p.status = 'active'
      join public.zone_cells zc on zc.cell = m.cell          -- trecho sem lugar conhecido não entra (não dá para cortar)
     where m.day = v_day and m.user_id <> p_uid
       and coalesce((select s.share_runs_to_feed from public.user_settings s where s.user_id = m.user_id), true)
       and exists (select 1 from public.paint_marks mine
                    where mine.user_id = p_uid and mine.cell = m.cell and mine.day between v_day - 1 and v_day)
       and not exists (
         select 1 from public.privacy_zones pz
           join private.privacy_zone_masks mk on mk.zone_id = pz.id
          where pz.user_id = m.user_id
            and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(zc.lng, zc.lat), 4326)::extensions.geography,
                                      extensions.st_setsrid(extensions.st_makepoint(mk.lng, mk.lat), 4326)::extensions.geography,
                                      mk.radius_m + 50))
  ), per_mate as (
    select h.mate, p.username, count(*)::integer as cells
      from hits h join public.profiles p on p.id = h.mate
     group by h.mate, p.username
  )
  select (select count(*)::integer from per_mate),
         (select count(distinct h.cell)::integer from hits h),
         (select pm.username from per_mate pm order by pm.cells desc, pm.username limit 1),
         (select pm.cells from per_mate pm order by pm.cells desc, pm.username limit 1)
    into v_mates, v_cells, v_name, v_top_cells;
  if coalesce(v_cells, 0) = 0 then
    return null;
  end if;
  return jsonb_build_object(
    'day', v_day,
    'mate', jsonb_build_object('username', v_name),
    'cells', v_top_cells,
    'othersCount', v_mates - 1,
    'totalCells', v_cells,
    'notifyFrom', private.ts_to_ms((v_today + time '07:00') at time zone 'America/Sao_Paulo'),
    'notifyUntil', private.ts_to_ms((v_today + time '22:00') at time zone 'America/Sao_Paulo'));
end $$;
revoke all on function private.crew_echo_at(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.crew_echo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('feed') then
    raise exception 'FEATURE_DISABLED: feed ainda não está ligado' using errcode = 'P0001';
  end if;
  return private.crew_echo_at(v_uid, now());
end $$;
revoke all on function public.crew_echo() from public, anon;
grant execute on function public.crew_echo() to authenticated;
comment on function public.crew_echo() is
  'Eco da crew (F8 A2): colega da crew que mais reforçou ontem os trechos que você pintou (só nome e contagens).';
