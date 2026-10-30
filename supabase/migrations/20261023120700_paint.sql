-- NOMADE RUN — Fase 7, onda 2 (T7.2.1, D-62, D-84; contrato E3 §3 e §4): pintura de ruas no banco.
-- Tudo aditivo. Enquanto game_config.territory_rule = 'v1', nada daqui muda o jogo: as tabelas ficam vazias e os jobs
-- antigos (decaimento e fortificar) continuam iguais.
--   * private.domain_constants(): as constantes do domain que o SQL repete (um único lugar; o teste Deno
--     supabase/functions/tests/parity.test.ts compara este JSON com os módulos do domain);
--   * zones ganha as colunas da pintura (herança, ataque v2, versão da regra);
--   * zone_cells: trechos pintados (H3 res 11) SEM autor; paint_marks: "1 camada por corredor por trecho por dia"
--     (o cliente não lê nenhuma das duas);
--   * zone_paint_near(): retrato sem autor, sem hora e sem os trechos dentro de zonas de privacidade (LiveSnapshot);
--   * job_fade_cells(): desbotar diário (03:00 BRT), virada de temporada da pintura e limpeza de paint_marks;
--   * virada v1 → v2: herança de 3 trechos virtuais do dono por 7 dias (trigger em game_config.territory_rule);
--   * D-84: a Fuligem fica fora do rodízio nas semanas que começam em agosto e setembro.

-- ===========================================================================
-- Constantes do domain repetidas no SQL (paridade: supabase/functions/tests/parity.test.ts)
-- ===========================================================================
create or replace function private.domain_constants() returns jsonb
language sql immutable set search_path = '' as $$
  select
-- domain-constants:begin
'{
  "PAINT_CELL_RES": 11,
  "PAINT_MAX_LAYERS": 3,
  "PAINT_FADE_MS": 604800000,
  "ZONE_MIN_CELLS": 3,
  "PAINT_INHERIT_CELLS": 3,
  "PAINT_INHERIT_MS": 604800000,
  "PAINT_ATTACK_RATIO": 0.5,
  "PAINT_ATTACK_FLIPS": 3,
  "PAINT_ATTACK_WINDOW_MS": 86400000,
  "ZONE_RES": 9,
  "FACTION_IDS": ["striders", "coyotes", "owls", "volt"],
  "RAID_BOSS_IDS": ["soneca", "rei-buzina", "fuligem", "mormaco", "paredao"],
  "RAID_ROTATION_EPOCH": 1792400400000,
  "RAID_PHASE2_AT": 0.67,
  "RAID_PHASE3_AT": 0.33,
  "RAID_SMOKE_BOSS": "fuligem",
  "RAID_SMOKE_MONTHS": [8, 9],
  "LEVEL_CURVE": {"base": 50, "exponent": 1.3, "round": 10, "plus": 50},
  "MAX_LEVEL": 50,
  "RUNNER_TITLES": [
    {"id": "recruta-do-asfalto", "name": "Recruta do Asfalto", "minLevel": 1},
    {"id": "pe-na-rua", "name": "Pé na Rua", "minLevel": 5},
    {"id": "desbravador-de-bairro", "name": "Desbravador de Bairro", "minLevel": 10},
    {"id": "guardiao-de-esquina", "name": "Guardião de Esquina", "minLevel": 15},
    {"id": "estrategista-urbano", "name": "Estrategista Urbano", "minLevel": 20},
    {"id": "lenda-do-bairro", "name": "Lenda do Bairro", "minLevel": 30},
    {"id": "mestre-da-cidade", "name": "Mestre da Cidade", "minLevel": 40},
    {"id": "nomade", "name": "Nômade", "minLevel": 50}],
  "RUNNER_BANDS": [
    {"id": "asfalto", "name": "Asfalto", "minKm": 0},
    {"id": "bronze", "name": "Bronze", "minKm": 10},
    {"id": "prata", "name": "Prata", "minKm": 50},
    {"id": "ouro", "name": "Ouro", "minKm": 150},
    {"id": "neon", "name": "Neon", "minKm": 400},
    {"id": "holografico", "name": "Holográfico", "minKm": 1000},
    {"id": "lenda", "name": "Lenda", "minKm": 2500},
    {"id": "nomade", "name": "Nômade", "minKm": 5000}],
  "SEASON_TRACK": {"stepXp": 120, "steps": 24, "prestigeXp": 240, "bronze": 8, "prata": 16, "ouro": 24},
  "STREAK_RUNS_PER_WEEK": 2,
  "DAILY_CHEST_PITY": 20,
  "DAILY_CHEST_MAX_STORED": 3,
  "SHARE_MIN_PIECE_M": 150
}'
-- domain-constants:end
  ::jsonb
$$;
revoke all on function private.domain_constants() from public, anon, authenticated;
comment on function private.domain_constants() is
  'Constantes do domain (apps/mobile/src/domain) repetidas no SQL. Mudou no domain? Mude aqui: o teste Deno de paridade falha.';

create or replace function private.dc(p_key text) returns numeric
language sql immutable set search_path = '' as $$
  select (private.domain_constants() ->> p_key)::numeric
$$;
revoke all on function private.dc(text) from public, anon, authenticated;

-- Regra de território em vigor ('v1' ou 'v2').
create or replace function private.territory_rule() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select g.value #>> '{}' from public.game_config g where g.key = 'territory_rule'), 'v1')
$$;
revoke all on function private.territory_rule() from public, anon, authenticated;

-- ===========================================================================
-- zones: colunas da pintura (D-62; contrato E3 §3.1). owner, attacker e attack_started_at são reaproveitados
-- (PaintAttack.since = attack_started_at). Na v2, influence vira espelho do placar (trechos × 10) para o app antigo.
-- ===========================================================================
alter table public.zones
  add column rule_version smallint not null default 1 check (rule_version in (1, 2)),
  add column inherit_faction text check (inherit_faction in ('striders', 'coyotes', 'owls', 'volt')),
  add column inherit_cells smallint check (inherit_cells is null or inherit_cells between 0 and 3),
  add column inherit_until timestamptz,
  add column attack_last_at timestamptz,
  add column attack_flips smallint not null default 0 check (attack_flips >= 0),
  add constraint zones_inherit_complete check ((inherit_faction is null) = (inherit_until is null)
                                               and (inherit_faction is null) = (inherit_cells is null));

-- ===========================================================================
-- zone_cells: trechos pintados. Sem autor (nem painted_by): o retrato público é anônimo por construção.
-- painted_at = PaintCell.paintedAt (relógio do desbotar). lat/lng = centro do trecho (para o raio do retrato).
-- ===========================================================================
create table public.zone_cells (
  cell text primary key check (cell ~ '^[0-9a-f]{15}$'),
  zone_id text not null references public.zones (id) on delete cascade,
  faction text not null check (faction in ('striders', 'coyotes', 'owls', 'volt')),
  layers smallint not null check (layers between 1 and 3),
  painted_at timestamptz not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  season_id text not null default public.current_season_id() check (season_id ~ '^\d{4}-\d{2}$'),
  updated_at timestamptz not null default now(),
  check (private.h3_parent(cell, 9) = zone_id)
);
create index zone_cells_zone_idx on public.zone_cells (zone_id);
create index zone_cells_lat_lng_idx on public.zone_cells (lat, lng);
comment on table public.zone_cells is
  'D-62: trechos (H3 res 11) com 1 a 3 camadas de um time. Sem autor. O cliente não lê a tabela: usa zone_paint_near().';

-- 1 camada por corredor por trecho por dia (paintedToday). Limpeza diária pelo job_fade_cells (> 2 dias).
create table public.paint_marks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  cell text not null check (cell ~ '^[0-9a-f]{15}$'),
  activity_id uuid references public.activities (id) on delete cascade,
  primary key (user_id, day, cell)
);
comment on table public.paint_marks is
  'D-62: trechos que cada pessoa já pintou no dia (Brasília). Só o servidor lê; apagado depois de 2 dias.';

alter table public.zone_cells enable row level security;
alter table public.paint_marks enable row level security;
revoke all on public.zone_cells, public.paint_marks from anon, authenticated;
-- Sem policy de leitura para o cliente (RLS ligada e nenhum grant): só security definer e o service role.

-- ===========================================================================
-- Placar e dono (zoneCounts, zoneOwnerByCells, isZoneUnderAttackV2)
-- ===========================================================================
-- Camadas efetivas em p_now (effectiveLayers): min(3, camadas) − ⌊(agora − pintado) / 7 dias⌋, no mínimo 0.
create or replace function private.paint_effective_layers(p_layers integer, p_painted_at timestamptz, p_now timestamptz)
returns integer
language sql immutable set search_path = '' as $$
  select greatest(0, least(private.dc('PAINT_MAX_LAYERS')::integer, p_layers)
                     - floor(greatest(0, extract(epoch from (p_now - p_painted_at)) * 1000) / private.dc('PAINT_FADE_MS'))::integer)
$$;
revoke all on function private.paint_effective_layers(integer, timestamptz, timestamptz) from public, anon, authenticated;

-- zoneCounts: trechos vivos por time + herança que ainda vale.
create or replace function private.paint_counts(p_zone text, p_now timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'striders', count(*) filter (where c.faction = 'striders')
                + case when z.inherit_faction = 'striders' and p_now < z.inherit_until then z.inherit_cells else 0 end,
    'coyotes', count(*) filter (where c.faction = 'coyotes')
               + case when z.inherit_faction = 'coyotes' and p_now < z.inherit_until then z.inherit_cells else 0 end,
    'owls', count(*) filter (where c.faction = 'owls')
            + case when z.inherit_faction = 'owls' and p_now < z.inherit_until then z.inherit_cells else 0 end,
    'volt', count(*) filter (where c.faction = 'volt')
            + case when z.inherit_faction = 'volt' and p_now < z.inherit_until then z.inherit_cells else 0 end)
    from public.zones z
    left join public.zone_cells c on c.zone_id = z.id and private.paint_effective_layers(c.layers, c.painted_at, p_now) > 0
   where z.id = p_zone
   group by z.id, z.inherit_faction, z.inherit_until, z.inherit_cells
$$;
revoke all on function private.paint_counts(text, timestamptz) from public, anon, authenticated;

-- zoneOwnerByCells: o time sozinho no topo com pelo menos 3 trechos; empate mantém o dono (se está no empate).
create or replace function private.paint_owner(p_counts jsonb, p_current text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_top integer := 0;
  v_leaders text[] := '{}';
  f text;
begin
  for f in select jsonb_array_elements_text(private.domain_constants() -> 'FACTION_IDS') loop
    v_top := greatest(v_top, coalesce((p_counts ->> f)::integer, 0));
  end loop;
  if v_top < private.dc('ZONE_MIN_CELLS') then
    return null;
  end if;
  for f in select jsonb_array_elements_text(private.domain_constants() -> 'FACTION_IDS') loop
    if coalesce((p_counts ->> f)::integer, 0) = v_top then
      v_leaders := v_leaders || f;
    end if;
  end loop;
  if cardinality(v_leaders) = 1 then
    return v_leaders[1];
  end if;
  return case when p_current = any (v_leaders) then p_current else null end;
end $$;
revoke all on function private.paint_owner(jsonb, text) from public, anon, authenticated;

-- isZoneUnderAttackV2 (pressão: rival ≥ 50 % dos trechos do dono, ou ≥ 3 trechos virados; expira em 24 h).
create or replace function private.paint_under_attack(z public.zones, p_counts jsonb, p_now timestamptz) returns boolean
language sql immutable set search_path = '' as $$
  select z.owner is not null and z.attacker is not null and z.attacker <> z.owner and z.attack_last_at is not null
     and extract(epoch from (p_now - z.attack_last_at)) * 1000 <= private.dc('PAINT_ATTACK_WINDOW_MS')
     and ((coalesce((p_counts ->> z.attacker)::integer, 0) > 0
           and coalesce((p_counts ->> z.attacker)::integer, 0)
               >= coalesce((p_counts ->> z.owner)::integer, 0) * private.dc('PAINT_ATTACK_RATIO'))
          or z.attack_flips >= private.dc('PAINT_ATTACK_FLIPS'))
$$;
revoke all on function private.paint_under_attack(public.zones, jsonb, timestamptz) from public, anon, authenticated;

-- Espelho v1 do placar (app antigo): influence = trechos × 10.
create or replace function private.paint_influence(p_counts jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('striders', coalesce((p_counts ->> 'striders')::integer, 0) * 10,
                            'coyotes', coalesce((p_counts ->> 'coyotes')::integer, 0) * 10,
                            'owls', coalesce((p_counts ->> 'owls')::integer, 0) * 10,
                            'volt', coalesce((p_counts ->> 'volt')::integer, 0) * 10)
$$;
revoke all on function private.paint_influence(jsonb) from public, anon, authenticated;

-- refreshZoneOwner (job): reavalia o dono pelo placar atual; herança e ataque vencidos somem. Devolve o evento ou null.
create or replace function private.paint_refresh_zone(p_zone text, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  z public.zones;
  v_counts jsonb;
  v_owner text;
  v_event jsonb;
begin
  select * into z from public.zones where id = p_zone for update;
  if z.id is null then
    return null;
  end if;
  if z.inherit_until is not null and p_now >= z.inherit_until then
    update public.zones set inherit_faction = null, inherit_cells = null, inherit_until = null where id = z.id
    returning * into z;
  end if;
  v_counts := private.paint_counts(z.id, p_now);
  v_owner := case when z.blocked then null else private.paint_owner(v_counts, z.owner) end;
  if v_owner is distinct from z.owner and not z.blocked then
    v_event := case when v_owner is not null
                    then jsonb_build_object('type', 'captured', 'zoneId', z.id, 'faction', v_owner, 'from', z.owner)
                    else jsonb_build_object('type', 'neutralized', 'zoneId', z.id, 'from', z.owner) end;
    insert into public.zone_events (zone_id, type, faction, from_faction)
    values (z.id, v_event ->> 'type', v_owner, z.owner);
  end if;
  update public.zones
     set owner = v_owner,
         influence = private.paint_influence(v_counts),
         attacker = case when v_owner is distinct from z.owner or z.blocked or z.attack_last_at is null
                              or extract(epoch from (p_now - z.attack_last_at)) * 1000 > private.dc('PAINT_ATTACK_WINDOW_MS')
                         then null else attacker end,
         attack_started_at = case when v_owner is distinct from z.owner or z.blocked or z.attack_last_at is null
                                       or extract(epoch from (p_now - z.attack_last_at)) * 1000 > private.dc('PAINT_ATTACK_WINDOW_MS')
                                  then null else attack_started_at end,
         attack_last_at = case when v_owner is distinct from z.owner or z.blocked or z.attack_last_at is null
                                    or extract(epoch from (p_now - z.attack_last_at)) * 1000 > private.dc('PAINT_ATTACK_WINDOW_MS')
                               then null else attack_last_at end,
         attack_flips = case when v_owner is distinct from z.owner or z.blocked or z.attack_last_at is null
                                  or extract(epoch from (p_now - z.attack_last_at)) * 1000 > private.dc('PAINT_ATTACK_WINDOW_MS')
                             then 0 else attack_flips end,
         rule_version = 2,
         version = version + 1,
         updated_at = now()
   where id = z.id;
  return v_event;
end $$;
revoke all on function private.paint_refresh_zone(text, timestamptz) from public, anon, authenticated;

-- ===========================================================================
-- zone_paint_near: retrato para a previsão ao vivo (LiveSnapshot do live-events.ts, contrato E3 §3.3).
-- Sem autor, sem hora e sem trechos dentro de QUALQUER zona de privacidade.
-- ===========================================================================
create or replace function public.zone_paint_near(p_lat double precision, p_lng double precision, p_radius_m integer default 1500)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_radius integer;
  v_pt extensions.geography;
  v_dlat double precision;
  v_dlng double precision;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if p_lat is null or p_lng is null or p_lat not between -85 and 85 or p_lng not between -180 and 180 then
    raise exception 'VALIDATION: coordenada inválida' using errcode = 'P0001';
  end if;
  v_radius := least(greatest(coalesce(p_radius_m, 1500), 100), 3000);
  v_pt := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_dlat := v_radius / 111000.0;
  v_dlng := v_radius / (111000.0 * greatest(cos(radians(p_lat)), 0.2));
  return jsonb_build_object(
    'rule', private.territory_rule(),
    'cells', coalesce((
      select jsonb_object_agg(c.cell, jsonb_build_object('faction', c.faction,
                                                         'layers', private.paint_effective_layers(c.layers, c.painted_at, v_now)))
        from public.zone_cells c
       where c.lat between p_lat - v_dlat and p_lat + v_dlat and c.lng between p_lng - v_dlng and p_lng + v_dlng
         and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography,
                                   v_pt, v_radius)
         and private.paint_effective_layers(c.layers, c.painted_at, v_now) > 0
         and not exists (
           select 1 from public.privacy_zones pz
            where pz.lat between c.lat - 0.0095 and c.lat + 0.0095
              and abs(pz.lng - c.lng) <= 0.0095 / greatest(cos(radians(c.lat)), 0.2)
              and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography,
                                        extensions.st_setsrid(extensions.st_makepoint(pz.lng, pz.lat), 4326)::extensions.geography,
                                        pz.radius_m))), '{}'::jsonb),
    'zones', coalesce((
      select jsonb_object_agg(x.id, jsonb_build_object(
               'owner', x.owner, 'name', private.zone_label(x.id, x.name),
               'inherited', case when x.inherit_until is not null and v_now < x.inherit_until then x.inherit_cells else 0 end,
               'blocked', x.blocked,
               'underAttack', private.paint_under_attack(x, private.paint_counts(x.id, v_now), v_now)))
        from public.zones x
       where x.geom operator(extensions.&&) extensions.st_makeenvelope(p_lng - v_dlng, p_lat - v_dlat, p_lng + v_dlng, p_lat + v_dlat, 4326)
         and extensions.st_dwithin(x.geom::extensions.geography, v_pt, v_radius)), '{}'::jsonb));
end $$;
revoke all on function public.zone_paint_near(double precision, double precision, integer) from public, anon;
grant execute on function public.zone_paint_near(double precision, double precision, integer) to authenticated;

-- ===========================================================================
-- Virada v1 → v2 (D-62): cada zona com dono começa com 3 trechos virtuais do dono, válidos por 7 dias.
-- Idempotente: só mexe nas zonas que ainda estão na regra 1.
-- ===========================================================================
create or replace function private.paint_switch_to_v2(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.zones z
     set inherit_faction = case when z.owner is not null and not z.blocked then z.owner end,
         inherit_cells = case when z.owner is not null and not z.blocked then private.dc('PAINT_INHERIT_CELLS')::smallint end,
         inherit_until = case when z.owner is not null and not z.blocked
                              then p_now + (private.dc('PAINT_INHERIT_MS') / 1000) * interval '1 second' end,
         owner = case when z.blocked then null else z.owner end,
         influence = private.paint_influence(case when z.owner is not null and not z.blocked
                                                  then jsonb_build_object(z.owner, private.dc('PAINT_INHERIT_CELLS'))
                                                  else '{}'::jsonb end),
         shield = 0, attacker = null, attack_started_at = null, attack_last_at = null, attack_flips = 0,
         rule_version = 2, version = z.version + 1, updated_at = now()
   where z.rule_version = 1;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.paint_switch_to_v2(timestamptz) from public, anon, authenticated;

-- Mesma coisa para a Edge Function / SQL Editor (service role), se os autores preferirem rodar à mão.
create or replace function public.job_territory_switch(p_now timestamptz default now()) returns integer
language sql security definer set search_path = '' as $$
  select case when private.territory_rule() = 'v2' then private.paint_switch_to_v2(p_now) else 0 end
$$;
revoke all on function public.job_territory_switch(timestamptz) from public, anon, authenticated;
grant execute on function public.job_territory_switch(timestamptz) to service_role;

-- Ligar territory_rule = 'v2' (SQL Editor) já aplica a herança na mesma transação.
create or replace function private.game_config_territory_switch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.key = 'territory_rule' and new.value = '"v2"'::jsonb and old.value is distinct from new.value then
    perform private.paint_switch_to_v2(now());
  end if;
  return new;
end $$;
revoke all on function private.game_config_territory_switch() from public, anon, authenticated;
create trigger game_config_territory_switch after update of value on public.game_config
  for each row execute function private.game_config_territory_switch();

-- ===========================================================================
-- Job diário (03:00 BRT): virada de temporada da pintura, desbotar, dono reavaliado e limpeza de paint_marks.
-- Na v2 substitui job_decay_zones + job_fortify_zones (que passam a rodar só na v1, ver o fim do arquivo).
-- Idempotente: o desbotar é calculado a partir de painted_at (fadeCell), não da hora em que o job roda.
-- ===========================================================================
create or replace function public.job_fade_cells(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_season text := public.current_season_id();
  v_reset integer := 0;
  v_faded integer := 0;
  v_removed integer := 0;
  v_marks integer := 0;
  v_events integer := 0;
  v_zones text[];
  v_zone text;
  v_ev jsonb;
begin
  delete from public.paint_marks where day < (p_now at time zone 'America/Sao_Paulo')::date - 2;
  get diagnostics v_marks = row_count;
  if private.territory_rule() <> 'v2' then
    return jsonb_build_object('rule', 'v1', 'marksRemoved', v_marks);
  end if;

  -- zonas afetadas: com trecho que muda agora, herança ou ataque vencidos
  v_zones := array(
    select distinct c.zone_id from public.zone_cells c
     where c.season_id <> v_season
        or extract(epoch from (p_now - c.painted_at)) * 1000 >= private.dc('PAINT_FADE_MS')
    union
    select z.id from public.zones z
     where z.rule_version = 2
       and ((z.inherit_until is not null and z.inherit_until <= p_now)
            or (z.attack_last_at is not null
                and extract(epoch from (p_now - z.attack_last_at)) * 1000 > private.dc('PAINT_ATTACK_WINDOW_MS')))
    order by 1);

  -- seasonResetPaint: todo trecho vivo de temporada anterior volta a 1 camada, relógio reiniciado
  delete from public.zone_cells c
   where c.season_id <> v_season and private.paint_effective_layers(c.layers, c.painted_at, p_now) = 0;
  get diagnostics v_removed = row_count;
  update public.zone_cells c set layers = 1, painted_at = p_now, season_id = v_season, updated_at = now()
   where c.season_id <> v_season;
  get diagnostics v_reset = row_count;

  -- fadeCells: some por inteiro ou perde camadas (o resto do relógio fica guardado)
  with gone as (
    delete from public.zone_cells c where private.paint_effective_layers(c.layers, c.painted_at, p_now) = 0 returning 1)
  select v_removed + count(*) into v_removed from gone;
  update public.zone_cells c
     set layers = c.layers - floor(extract(epoch from (p_now - c.painted_at)) * 1000 / private.dc('PAINT_FADE_MS'))::integer,
         painted_at = c.painted_at + floor(extract(epoch from (p_now - c.painted_at)) * 1000 / private.dc('PAINT_FADE_MS'))
                                     * (private.dc('PAINT_FADE_MS') / 1000) * interval '1 second',
         updated_at = now()
   where extract(epoch from (p_now - c.painted_at)) * 1000 >= private.dc('PAINT_FADE_MS');
  get diagnostics v_faded = row_count;

  foreach v_zone in array v_zones loop
    v_ev := private.paint_refresh_zone(v_zone, p_now);
    if v_ev is not null then
      v_events := v_events + 1;
    end if;
  end loop;

  return jsonb_build_object('rule', 'v2', 'seasonReset', v_reset, 'faded', v_faded, 'removed', v_removed,
                            'zones', cardinality(v_zones), 'events', v_events, 'marksRemoved', v_marks);
end $$;
revoke all on function public.job_fade_cells(timestamptz) from public, anon, authenticated;
grant execute on function public.job_fade_cells(timestamptz) to service_role;

select cron.schedule('nomaderun-fade-cells', '0 6 * * *', 'select public.job_fade_cells()'); -- 03:00 BRT

-- Na v2, o decaimento e o fortificar por influência não valem mais (a pintura desbota sozinha).
-- Mesmos nomes e horários: o pg_cron atualiza o comando do job existente.
select cron.schedule('nomaderun-fortify-zones', '5 3 * * *',
                     $cmd$select public.job_fortify_zones() where private.territory_rule() = 'v1'$cmd$);
select cron.schedule('nomaderun-decay-zones', '0 6 * * *',
                     $cmd$select public.job_decay_zones() where private.territory_rule() = 'v1'$cmd$);

-- ===========================================================================
-- D-84: nas semanas que começam em agosto ou setembro, a Fuligem é pulada e entra o próximo chefão do rodízio.
-- Mesma regra do raidBossForWeek (raid.ts, E3). Rodízio fixo a partir de 19/10/2026 (Soneca).
-- ===========================================================================
create or replace function private.raid_boss_for_week(p_week_start date) returns text
language sql stable security definer set search_path = '' as $$
  with base as (
    select (((((p_week_start - date '2026-10-19') / 7) % 5) + 5) % 5) as i
  ), pick as (
    select case when b.id = (private.domain_constants() ->> 'RAID_SMOKE_BOSS')
                     and (private.domain_constants() -> 'RAID_SMOKE_MONTHS') @> to_jsonb(extract(month from p_week_start)::integer)
                then (base.i + 1) % 5 else base.i end as i
      from base join public.raid_bosses b on b.sort = base.i
  )
  select b.id from public.raid_bosses b join pick on b.sort = pick.i
$$;
revoke all on function private.raid_boss_for_week(date) from public, anon, authenticated;
