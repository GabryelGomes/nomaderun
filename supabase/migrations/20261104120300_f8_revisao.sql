-- NOMADE RUN — Fase 8, onda D (E9): correções da revisão F8-D (docs/melhoria/relatorios/F8-D-revisao.md). Só aditivo.
--   * M2: o eco da crew (`private.crew_echo_at`) passa a respeitar "mostrar mapa no feed" (`user_settings.feed_show_map`)
--     do colega: quem esconde o mapa não aparece no eco (o eco diria por onde a pessoa passou ontem);
--   * B5: o eco só considera colegas do MESMO tipo de conta (real ↔ real, demonstração ↔ demonstração) e devolve
--     `isDemo`; `join_crew` não deixa uma conta real entrar numa crew de demonstração (nem o contrário). A resposta é
--     a mesma de código inválido (`CREW_NOT_FOUND`): os códigos do seed estão no repositório;
--   * B1: `faction_activity()` sem sessão lê só de um cache (`private.faction_activity_cache`, refeito sob demanda a
--     cada 5 min, um pedido por vez) e devolve só `{ needsBoost, isDemo }`, sem as contagens. Com sessão, continua
--     com as contagens ao vivo e ganha `needsBoost` (a mesma regra de `factionNeedingBoost`, do domain).
-- Sem coluna nova em tabela existente, sem dado pessoal novo (o cache só tem 4 contagens agregadas: fora do export e
-- do delete LGPD), sem job, sem flag e sem Realtime novos.

-- ===========================================================================
-- B1: "Precisa de reforço" — regra SQL igual a factionNeedingBoost (src/domain/faction-activity.ts)
-- ===========================================================================
-- O time com MENOS ativos, só se for o único no menor número e o total for >= BOOST_MIN_TOTAL_ACTIVE (4). Valor que
-- não é número positivo conta 0 (como `count()` do domain). O pgTAP 34 confere casos de fronteira com o domain.
create or replace function private.faction_needing_boost(p_counts jsonb) returns text
language sql immutable set search_path = '' as $$
  with v as (
    select f.faction,
           case when jsonb_typeof(p_counts -> f.faction) = 'number' and (p_counts ->> f.faction)::numeric > 0
                then floor((p_counts ->> f.faction)::numeric) else 0 end as n
      from unnest(array['striders', 'coyotes', 'owls', 'volt']) f(faction)
  ), m as (select min(n) as lo, sum(n) as total from v)
  select case
           when p_counts is null or jsonb_typeof(p_counts) <> 'object' then null
           when (select total from m) < 4 then null
           when (select count(*) from v, m where v.n = m.lo) <> 1 then null
           else (select v.faction from v, m where v.n = m.lo)
         end
$$;
revoke all on function private.faction_needing_boost(jsonb) from public, anon, authenticated;

-- Contagem ao vivo (a mesma da C2): pessoas ativas, com time, com corrida aceita terminada nos 7 dias até p_now.
create or replace function private.faction_counts(p_demo boolean, p_now timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ran as (
    select distinct a.user_id
      from public.activities a
     where a.scored and a.status in ('valid', 'partial')
       and a.started_at >= p_now - interval '8 days'            -- usa activities_scored_started_idx
       and coalesce(a.ended_at, a.finished_at, a.started_at) >= p_now - interval '7 days'
       and coalesce(a.ended_at, a.finished_at, a.started_at) <= p_now
  ), active as (
    select p.faction, count(*)::integer as n
      from ran r
      join public.profiles p on p.id = r.user_id
     where p.faction is not null and p.status = 'active' and p.is_demo = p_demo
     group by p.faction
  )
  select jsonb_object_agg(f.faction, coalesce(a.n, 0) order by f.ord)
    from unnest(array['striders', 'coyotes', 'owls', 'volt']) with ordinality f(faction, ord)
    left join active a on a.faction = f.faction
$$;
revoke all on function private.faction_counts(boolean, timestamptz) from public, anon, authenticated;

-- ===========================================================================
-- B1: cache do "sem sessão"
-- ===========================================================================
-- Uma linha por tipo de conta (hoje só `false`: sem sessão nunca entra demonstração). Só 4 contagens agregadas.
create table if not exists private.faction_activity_cache (
  is_demo boolean primary key,
  counts jsonb not null check (jsonb_typeof(counts) = 'object'),
  refreshed_at timestamptz not null
);
alter table private.faction_activity_cache enable row level security;   -- sem política: só o dono (functions definer)
revoke all on private.faction_activity_cache from public, anon, authenticated;
comment on table private.faction_activity_cache is
  'B1 (F8-D): contagens de ativos por time para quem ainda não tem conta. Refeito sob demanda a cada 5 min.';

-- Sem sessão: lê o cache; se tiver 5 min ou mais, UM pedido refaz (pg_try_advisory_xact_lock) e os outros usam o
-- que já está lá. Sem cache e com outro pedido refazendo: sem selo desta vez (nunca duas varreduras juntas).
-- O relógio é parâmetro para o pgTAP; public.faction_activity() chama com now().
create or replace function private.faction_activity_anon_at(p_now timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_counts jsonb;
  v_at timestamptz;
begin
  select c.counts, c.refreshed_at into v_counts, v_at from private.faction_activity_cache c where c.is_demo = false;
  if v_at is null or p_now - v_at >= interval '5 minutes' then
    if pg_try_advisory_xact_lock(hashtextextended('nomaderun:faction_activity_cache', 0)) then
      v_counts := private.faction_counts(false, p_now);
      insert into private.faction_activity_cache as c (is_demo, counts, refreshed_at)
      values (false, v_counts, p_now)
      on conflict (is_demo) do update set counts = excluded.counts, refreshed_at = excluded.refreshed_at;
    end if;
  end if;
  return jsonb_build_object('needsBoost', private.faction_needing_boost(v_counts), 'isDemo', false);
end $$;
revoke all on function private.faction_activity_anon_at(timestamptz) from public, anon, authenticated;

-- ===========================================================================
-- B1: faction_activity()
-- ===========================================================================
-- Sem sessão (D-91, escolha do time antes da conta): `{ needsBoost, isDemo: false }`, do cache. Com sessão: como antes
-- (contagens ao vivo, `since`; demonstração só conta demonstração) + `needsBoost`. `volatile` porque o caminho sem
-- sessão grava o cache (o app chama por POST, como todo `supabase.rpc`).
create or replace function public.faction_activity() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_demo boolean;
  v_now timestamptz := now();
  v_counts jsonb;
begin
  if v_uid is null then
    return private.faction_activity_anon_at(v_now);
  end if;
  perform private.require_active();
  -- conta real só vê conta real; a demonstração só vê a demonstração (e vem marcada)
  v_demo := coalesce((select pr.is_demo from public.profiles pr where pr.id = v_uid), false);
  v_counts := private.faction_counts(v_demo, v_now);
  return jsonb_build_object(
    'windowDays', 7,
    'since', private.ts_to_ms(v_now - interval '7 days'),
    'counts', v_counts,
    'total', (select sum(v::integer) from jsonb_each_text(v_counts) e(k, v)),
    'needsBoost', private.faction_needing_boost(v_counts),
    'isDemo', v_demo);
end $$;
revoke all on function public.faction_activity() from public;
grant execute on function public.faction_activity() to anon, authenticated;
comment on function public.faction_activity() is
  'D-96/D-91/B1: sem sessão só { needsBoost, isDemo } (cache de 5 min, contas reais). Com sessão: contagens por time '
  'nos últimos 7 dias + needsBoost; conta de demonstração só conta demonstração.';

-- ===========================================================================
-- M2 + B5: eco da crew
-- ===========================================================================
-- Como na A2 (20261031120000), mais: colega com o mapa do feed escondido (`feed_show_map = false`) fica fora (M2), e
-- só entra colega do mesmo tipo de conta de quem pede (B5). A resposta ganha `isDemo` (o tipo de quem pede, que é o
-- de todos os colegas contados).
create or replace function private.crew_echo_at(p_uid uuid, p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_crew uuid;
  v_demo boolean;
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
  v_demo := coalesce((select pr.is_demo from public.profiles pr where pr.id = p_uid), false);
  with hits as (
    select distinct m.user_id as mate, m.cell
      from public.paint_marks m
      join public.crew_members cm on cm.user_id = m.user_id and cm.crew_id = v_crew
      join public.profiles p on p.id = m.user_id and p.status = 'active'
                            and p.is_demo = v_demo                -- B5: real só com real, demonstração só com demonstração
      join public.zone_cells zc on zc.cell = m.cell          -- trecho sem lugar conhecido não entra (não dá para cortar)
      left join public.user_settings s on s.user_id = m.user_id
     where m.day = v_day and m.user_id <> p_uid
       and coalesce(s.share_runs_to_feed, true)
       and coalesce(s.feed_show_map, true)                    -- M2: mapa escondido no feed = sem eco
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
    'notifyUntil', private.ts_to_ms((v_today + time '22:00') at time zone 'America/Sao_Paulo'),
    'isDemo', v_demo);
end $$;
revoke all on function private.crew_echo_at(uuid, timestamptz) from public, anon, authenticated;

-- ===========================================================================
-- B5: join_crew não mistura conta real com conta de demonstração
-- ===========================================================================
-- Como em 20261022120000_qa_hardening, mais: se a crew tem líder ou membro de outro tipo de conta, a resposta é a de
-- código inválido (não confirma que o código existe). As outras regras (mesma facção, limite de 30) continuam nos
-- triggers de crew_members.
create or replace function public.join_crew(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_crew public.crews;
  v_demo boolean;
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
  v_demo := coalesce((select pr.is_demo from public.profiles pr where pr.id = v_uid), false);
  if exists (select 1 from public.profiles pr
              where (pr.id = v_crew.leader_id
                     or pr.id in (select cm.user_id from public.crew_members cm where cm.crew_id = v_crew.id))
                and pr.is_demo is distinct from v_demo) then
    raise exception 'CREW_NOT_FOUND: código de convite inválido' using errcode = 'P0001';
  end if;
  insert into public.crew_members (crew_id, user_id, role) values (v_crew.id, v_uid, 'member');
  return jsonb_build_object('crewId', v_crew.id, 'name', v_crew.name, 'tag', v_crew.tag, 'faction', v_crew.faction);
end $$;
revoke all on function public.join_crew(text) from public, anon;
grant execute on function public.join_crew(text) to authenticated;
