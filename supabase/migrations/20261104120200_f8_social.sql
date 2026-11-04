-- NOMADE RUN — Fase 8, onda C, frente C2 (E9 + E8 + E7): social que volta e pendências do servidor. Só aditivo.
--   * D-91/D-96: `faction_activity()` aceita `anon` (escolha do time ANTES da conta) e devolve só as 4 contagens de
--     contas reais (nada de id, nome, lugar ou horário; sem sessão nunca entra conta de demonstração);
--   * moldura "Recruta" (`moldura-recruta`, regra 9 de F8/01): no catálogo e concedida pelo servidor, de forma
--     idempotente, quando a pessoa entra num time (`choose_faction`); quem já tem time ganha agora (backfill);
--   * feed da crew (D-79): `activityId` no item SÓ quando `you = true` (o "Compartilhar" do próprio item);
--   * zonas: referência "perto do Estádio" vinda de marcos públicos da cidade (`landmarks`, sem dado pessoal), em
--     `zones.near_ref`; o nome na tela é "Jardim Goiás · perto do Estádio" (sem o número) e, sem marco perto, só o
--     nome sem número. Sai em /zones, /zone/:id, zone_paint_near e nos avisos;
--   * avisos de zona (invasão, território perdido, conquista) num formato único: título em caixa de frase, nome da
--     zona sem número e prazo "até 02h30" (Brasília) na invasão, com `data.defendUntil` (ms) para o app.
-- Sem tabela com dado pessoal, sem job, sem flag e sem Realtime novos (o `near_ref` viaja no Realtime de `zones`,
-- que já é público para quem tem conta). Nada novo no export/delete LGPD (`user_cosmetics` já sai no export e cai
-- com a conta).

-- ===========================================================================
-- D-96 / D-91: faction_activity() também para quem ainda não tem conta
-- ===========================================================================
-- Com sessão: como antes (conta ativa; demonstração só vê demonstração). Sem sessão (`anon`, a escolha do time da
-- D-91): só as 4 contagens das contas reais, sem a janela em ms. Nada identifica ninguém: é a mesma contagem que o
-- selo "Precisa de reforço" mostra; ninguém com sessão recebe mais que isto.
create or replace function public.faction_activity() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_demo boolean := false;
  v_now timestamptz := now();
  v_from timestamptz := now() - interval '7 days';
  v_counts jsonb;
  v_total integer;
begin
  if v_uid is not null then
    perform private.require_active();
    -- conta real só vê conta real; a demonstração só vê a demonstração (e vem marcada)
    v_demo := coalesce((select pr.is_demo from public.profiles pr where pr.id = v_uid), false);
  end if;
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
  v_total := (select sum(v::integer) from jsonb_each_text(v_counts) e(k, v));
  if v_uid is null then
    return jsonb_build_object('windowDays', 7, 'counts', v_counts, 'total', v_total, 'isDemo', false);
  end if;
  return jsonb_build_object(
    'windowDays', 7,
    'since', private.ts_to_ms(v_from),
    'counts', v_counts,
    'total', v_total,
    'isDemo', v_demo);
end $$;
revoke all on function public.faction_activity() from public;
grant execute on function public.faction_activity() to anon, authenticated;
comment on function public.faction_activity() is
  'D-96/D-91: corredores ativos por time nos últimos 7 dias (só contagens). Sem sessão: só contas reais. Conta de '
  'demonstração só conta demonstração.';

-- ===========================================================================
-- Moldura "Recruta": entrar num time (D-91, regra 9 de F8/01)
-- ===========================================================================
-- `source = 'ftue'` (primeira experiência): o check de cosmetic_defs não muda. No app o "como ganhar" é "Entrar num
-- time". Só cosmético; nunca vendido; não entra no baú.
insert into public.cosmetic_defs (id, slot, name, rarity, source, in_chest_pool, sort)
values ('moldura-recruta', 'frame', 'Recruta', 'comum', 'ftue', false, 46)
on conflict (id) do nothing;

-- Mesma regra de 20261022120000 (choose_faction), mais a moldura: concedida sempre que a pessoa termina com time
-- (1ª escolha, repetição da mesma escolha ou troca). Idempotente pela PK de user_cosmetics; repetir não duplica.
create or replace function public.choose_faction(p_faction text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_prof public.profiles;
  v_season text := public.current_season_id();
  v_new boolean := false;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001';
  end if;
  perform private.require_active();
  if p_faction is null or p_faction not in ('striders', 'coyotes', 'owls', 'volt') then
    raise exception 'INVALID_FACTION: facção inválida' using errcode = 'P0001';
  end if;
  select * into v_prof from public.profiles where id = v_uid for update;
  v_new := not exists (select 1 from public.user_cosmetics c
                        where c.user_id = v_uid and c.cosmetic_id = 'moldura-recruta' and c.variant = '');
  if v_prof.faction is null then
    update public.profiles set faction = p_faction where id = v_uid;
  elsif v_prof.faction = p_faction then
    null; -- nada muda
  elsif v_prof.faction_changed_season = v_season then
    raise exception 'FACTION_CHANGE_LIMIT: a facção só pode ser trocada uma vez por temporada' using errcode = 'P0001';
  else
    update public.profiles
      set faction = p_faction, faction_changed_season = v_season, contribution_reset_at = now()
      where id = v_uid;
    delete from public.crew_members where user_id = v_uid; -- RN-011: sai da crew ao trocar de facção
  end if;
  -- o trigger profiles_recruit_frame já deu a moldura no update; aqui cobre quem repete a mesma escolha
  perform private.grant_cosmetic(v_uid, 'moldura-recruta', '', 'time:entrada');
  select * into v_prof from public.profiles where id = v_uid;
  return jsonb_build_object(
    'faction', v_prof.faction,
    'factionChangedSeason', v_prof.faction_changed_season,
    'canChangeThisSeason', v_prof.faction_changed_season is distinct from v_season,
    -- C2: campo novo e opcional (app antigo ignora). `unlockedNow` = ganhou nesta chamada.
    'recruitFrame', jsonb_build_object('id', 'moldura-recruta', 'unlockedNow', v_new)
  );
end $$;
revoke all on function public.choose_faction(text) from public, anon;
grant execute on function public.choose_faction(text) to authenticated;

-- Qualquer caminho que põe a pessoa num time (choose_faction, seed de demonstração, SQL Editor) dá a moldura.
create or replace function private.profiles_recruit_frame() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.grant_cosmetic(new.id, 'moldura-recruta', '', 'time:entrada');
  return null;
end $$;
revoke all on function private.profiles_recruit_frame() from public, anon, authenticated;
create trigger profiles_recruit_frame after insert or update of faction on public.profiles
  for each row when (new.faction is not null) execute function private.profiles_recruit_frame();

-- Quem já entrou num time antes desta migration também é "Recruta" (inclusive as contas de demonstração).
insert into public.user_cosmetics (user_id, cosmetic_id, variant, source)
select p.id, 'moldura-recruta', '', 'time:entrada'
  from public.profiles p
 where p.faction is not null
on conflict (user_id, cosmetic_id, variant) do nothing;

-- ===========================================================================
-- Feed da crew: activityId só no item da própria pessoa (B3, "Compartilhar" do próprio item)
-- ===========================================================================
-- Mesmo item de 20261023120800 (sem user_id, sem horário). Para os colegas, o id da corrida continua de fora (D-79):
-- com ele dava para cruzar corridas. Para o autor é o próprio dado dele.
create or replace function private.feed_item_json(f public.feed_items, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', f.id, 'day', f.day, 'you', f.user_id = p_viewer,
    'author', (select jsonb_build_object('username', pp.username, 'faction', pp.faction, 'avatarUrl', pp.avatar_url)
                 from private.public_profiles() pp where pp.id = f.user_id),
    'meters', f.meters, 'movingSeconds', f.moving_seconds, 'avgPace', f.avg_pace, 'highlights', f.highlights,
    'route', case when f.route is null then null else to_jsonb(f.route) end, 'routeHidden', f.route_hidden,
    'kudos', jsonb_build_object(
      'bora', (select count(*) from public.kudos k where k.feed_item_id = f.id and k.reaction = 'bora'),
      'fogo', (select count(*) from public.kudos k where k.feed_item_id = f.id and k.reaction = 'fogo'),
      'raio', (select count(*) from public.kudos k where k.feed_item_id = f.id and k.reaction = 'raio')),
    'myReaction', (select k.reaction from public.kudos k where k.feed_item_id = f.id and k.user_id = p_viewer),
    'isDemo', f.is_demo)
  || case when p_viewer is not null and f.user_id = p_viewer then jsonb_build_object('activityId', f.activity_id)
          else '{}'::jsonb end
$$;
revoke all on function private.feed_item_json(public.feed_items, uuid) from public, anon, authenticated;

-- ===========================================================================
-- Zonas: referência "perto do …" (UX-29, regra 2)
-- ===========================================================================
-- Marcos públicos da cidade (praça, parque, estádio): referência curta para quem corre. Nenhum dado pessoal. O
-- cliente não lê a tabela (só as functions privadas abaixo). Novos marcos entram por migration ou pelo SQL Editor.
create table public.landmarks (
  id smallint generated always as identity primary key,
  name text not null unique check (char_length(name) between 2 and 60),
  -- frase pronta, com o artigo certo: "perto do Estádio", "perto da Praça Cívica"
  near_phrase text not null check (char_length(near_phrase) between 8 and 40 and near_phrase ~ '^perto d[oae]s? '),
  city text not null default 'Goiânia' check (char_length(city) between 2 and 60),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  active boolean not null default true
);
comment on table public.landmarks is
  'C2 (UX-29): marcos públicos da cidade para o nome da zona ("Jardim Goiás · perto do Estádio"). Sem dado pessoal.';
alter table public.landmarks enable row level security;
revoke all on public.landmarks from anon, authenticated;
-- (nenhuma política: só as funções security definer leem; o service_role ignora a RLS)

-- Os mesmos 5 marcos da demonstração do app (src/demo/demo-data.ts, PLACES/LANDMARK_SHORT), com as mesmas posições.
insert into public.landmarks (name, near_phrase, lat, lng) values
  ('Parque Flamboyant', 'perto do Parque Flamboyant', -16.7097, -49.2388),
  ('Lago do Flamboyant', 'perto do Lago', -16.7112, -49.2398),
  ('Shopping Flamboyant', 'perto do Shopping', -16.7108, -49.2362),
  ('Estádio Serra Dourada', 'perto do Estádio', -16.7066, -49.2342),
  ('Parque Areião', 'perto do Parque Areião', -16.6985, -49.2508)
on conflict (name) do nothing;

alter table public.zones
  add column near_ref text check (near_ref is null or (char_length(near_ref) between 8 and 40 and near_ref ~ '^perto d'));
comment on column public.zones.near_ref is
  'C2: "perto do Estádio" (marco público mais próximo, até 3 km). Nulo = sem referência (a tela mostra só o nome).';

-- Referência de uma zona: o marco mais perto do centro, até 3 km. A zona que já tem o nome de um marco (ou cujo nome
-- sem número é o de um marco) não leva referência: o nome já diz onde é.
create or replace function private.zone_near_ref(p_name text, p_geom extensions.geometry) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_base text := btrim(regexp_replace(coalesce(p_name, ''), '\s+\d+(/\d+)?$', ''));
  v_c extensions.geometry;
  v_ref text;
begin
  if p_geom is null then return null; end if;
  if v_base <> '' and exists (select 1 from public.landmarks l where l.active and l.name = v_base) then return null; end if;
  v_c := extensions.st_centroid(p_geom);
  select l.near_phrase into v_ref
    from public.landmarks l
   where l.active
     and extensions.st_distancesphere(extensions.st_setsrid(extensions.st_makepoint(l.lng, l.lat), 4326), v_c) <= 3000
   order by extensions.st_distancesphere(extensions.st_setsrid(extensions.st_makepoint(l.lng, l.lat), 4326), v_c), l.id
   limit 1;
  return v_ref;
end $$;
revoke all on function private.zone_near_ref(text, extensions.geometry) from public, anon, authenticated;

-- Nome da zona para avisos e telas: sem o número ("Jardim Goiás 59" → "Jardim Goiás") e com a referência, se houver.
-- Sem nome: "Zona" (nunca o pedaço do id, que não diz nada para quem corre).
create or replace function private.zone_display(p_name text, p_near_ref text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+\d+(/\d+)?$', '')), ''), 'Zona')
         || case when nullif(btrim(coalesce(p_near_ref, '')), '') is not null then ' · ' || btrim(p_near_ref) else '' end
$$;
revoke all on function private.zone_display(text, text) from public, anon, authenticated;

create or replace function private.zones_set_near_ref() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.near_ref := private.zone_near_ref(new.name, new.geom);
  return new;
end $$;
revoke all on function private.zones_set_near_ref() from public, anon, authenticated;
-- Só quando nasce ou muda de nome/forma (o update da pintura não passa por aqui).
create trigger zones_near_ref before insert or update of name, geom on public.zones
  for each row execute function private.zones_set_near_ref();

update public.zones z set near_ref = private.zone_near_ref(z.name, z.geom)
 where z.near_ref is distinct from private.zone_near_ref(z.name, z.geom);

-- /zones (QA-04): o mesmo JSON, mais `near_ref` (campo a mais; a function antiga ignora).
create or replace function public.zones_in_bbox_json(
  min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(z) || jsonb_build_object('near_ref', x.near_ref)), '[]'::jsonb)
    from public.zones_in_bbox(min_lng, min_lat, max_lng, max_lat) z
    left join public.zones x on x.id = z.id
$$;
revoke all on function public.zones_in_bbox_json(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.zones_in_bbox_json(double precision, double precision, double precision, double precision) to authenticated, service_role;

-- /zone/:id: o mesmo detalhe de 20261020120200, mais `nearRef`.
create or replace function public.svc_zone_detail(p_zone text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'zone', jsonb_build_object(
      'id', z.id, 'name', z.name, 'city', z.city, 'owner', z.owner, 'influence', z.influence, 'shield', z.shield,
      'attacker', z.attacker, 'attackStartedAt', private.ts_to_ms(z.attack_started_at), 'blocked', z.blocked,
      'updatedAt', private.ts_to_ms(z.updated_at), 'nearRef', z.near_ref),
    'topRunners', coalesce((
      select jsonb_agg(jsonb_build_object('username', t.username, 'faction', t.faction, 'rp', t.rp) order by t.rp desc)
        from (select pr.username, az.faction, sum(az.rp)::integer as rp
                from public.activity_zones az join public.profiles pr on pr.id = az.user_id
               where az.zone_id = z.id and az.created_at >= public.season_start() and pr.status <> 'inactive'
               group by pr.username, az.faction
               order by rp desc limit 3) t), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('type', e.type, 'faction', e.faction, 'from', e.from_faction,
                                          'at', private.ts_to_ms(e.created_at)) order by e.created_at desc)
        from (select * from public.zone_events where zone_id = z.id order by created_at desc limit 10) e), '[]'::jsonb)
  )
  from public.zones z where z.id = p_zone
$$;

-- zone_paint_near: o mesmo retrato de 20261029120000 (B2), mais `nearRef` em cada zona.
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
         and not private.cell_in_privacy_zone(c.lat, c.lng)), '{}'::jsonb),
    'zones', coalesce((
      select jsonb_object_agg(x.id, jsonb_build_object(
               'owner', x.owner, 'name', private.zone_label(x.id, x.name),
               'inherited', case when x.inherit_until is not null and v_now < x.inherit_until then x.inherit_cells else 0 end,
               'blocked', x.blocked,
               'underAttack', private.paint_under_attack(x, private.paint_counts(x.id, v_now), v_now))
             -- C2: só quando há referência (o formato antigo da zona continua igual)
             || case when x.near_ref is not null then jsonb_build_object('nearRef', x.near_ref) else '{}'::jsonb end)
        from public.zones x
       where x.geom operator(extensions.&&) extensions.st_makeenvelope(p_lng - v_dlng, p_lat - v_dlat, p_lng + v_dlng, p_lat + v_dlat, 4326)
         and extensions.st_dwithin(x.geom::extensions.geography, v_pt, v_radius)), '{}'::jsonb),
    'paintedToday', coalesce((
      select jsonb_agg(m.cell order by m.cell)
        from public.paint_marks m
        join public.zone_cells c on c.cell = m.cell
       where m.user_id = v_uid and m.day = public.br_today()
         and c.lat between p_lat - v_dlat and p_lat + v_dlat and c.lng between p_lng - v_dlng and p_lng + v_dlng
         and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography,
                                   v_pt, v_radius)), '[]'::jsonb));
end $$;
revoke all on function public.zone_paint_near(double precision, double precision, integer) from public, anon;
grant execute on function public.zone_paint_near(double precision, double precision, integer) to authenticated;

-- ===========================================================================
-- Avisos de zona num formato único (regra 2 de 01-PROMPT-FINALIZACAO-100: "até 02h30" só nos avisos)
-- ===========================================================================
-- Um lugar só para o texto, valendo para a regra v1 (svc_apply_activity_result) e a v2 (v2_zone_event): antes de
-- gravar um aviso de zona com `data.zoneId` de uma zona que existe, o título e o corpo são refeitos aqui. Aviso sem
-- zona conhecida (ou de outro tipo) passa como veio. Os limites (RN-003) continuam em notify_zone_runners.
--   invasion:       "Alerta de invasão" · "Os Urban Coyotes estão pintando suas ruas em Jardim Goiás · perto do
--                   Estádio. Defenda até 02h30."  + data.defendUntil (ms)
--   territory_lost: "Território perdido" · "Jardim Goiás agora é dos Urban Coyotes. Corra lá para pintar de volta."
--   conquest:       "Zona conquistada" · "Você pintou Jardim Goiás com a cor dos Neon Striders."
-- Prazo da defesa: v2 = último avanço do ataque + 24 h (PAINT_ATTACK_WINDOW_MS); v1 = início do ataque + 24 h
-- (DEFENSE_WINDOW_MS); nunca no passado. Horário de Brasília, "HHhMM" (formatClock do app).
create or replace function private.zone_notice_text() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_zone public.zones;
  v_place text;
  v_until timestamptz;
  v_team text;
begin
  select * into v_zone from public.zones z where z.id = new.data ->> 'zoneId';
  if v_zone.id is null then return new; end if;
  v_place := private.zone_display(v_zone.name, v_zone.near_ref);
  if new.type = 'invasion' then
    v_team := private.faction_name(coalesce(new.data ->> 'attacker', v_zone.attacker));
    if coalesce(v_team, '') = '' then return new; end if;
    v_until := greatest(
      coalesce(case when v_zone.rule_version = 2 then v_zone.attack_last_at else v_zone.attack_started_at end, now())
        + interval '24 hours',
      now());
    new.title := 'Alerta de invasão';
    new.body := format('Os %s estão pintando suas ruas em %s. Defenda até %s.', v_team, v_place,
                       to_char(v_until at time zone 'America/Sao_Paulo', 'HH24"h"MI'));
    new.data := new.data || jsonb_build_object('defendUntil', private.ts_to_ms(v_until));
  elsif new.type = 'territory_lost' then
    v_team := private.faction_name(coalesce(new.data ->> 'newOwner', v_zone.owner));
    if coalesce(v_team, '') = '' then return new; end if;
    new.title := 'Território perdido';
    new.body := format('%s agora é dos %s. Corra lá para pintar de volta.', v_place, v_team);
  elsif new.type = 'conquest' then
    v_team := private.faction_name((select pr.faction from public.profiles pr where pr.id = new.user_id));
    if coalesce(v_team, '') = '' then return new; end if;
    new.title := 'Zona conquistada';
    new.body := format('Você pintou %s com a cor dos %s.', v_place, v_team);
  end if;
  return new;
end $$;
revoke all on function private.zone_notice_text() from public, anon, authenticated;
create trigger notifications_zone_text before insert on public.notifications
  for each row when (new.type in ('invasion', 'territory_lost', 'conquest') and new.data ? 'zoneId')
  execute function private.zone_notice_text();
