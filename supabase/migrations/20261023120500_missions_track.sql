-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-65/D-64): missões e trilha da temporada.
-- Missões:
--   * mission_defs com os MESMOS ids do catálogo da E7 (docs/melhoria/F1/engajamento/catalogo.ts → src/domain/missions.ts);
--   * 3 diárias + 3 semanais (1 leve, 1 padrão, 1 desafio: sempre 1 leve), sorteio determinístico por
--     md5(usuário + período + id); só entram as missões possíveis (crew, raid real, zona do time sob ataque);
--   * metas adaptativas (d-km, s-km, s-chefao) calculadas com os dados do próprio servidor;
--   * troca de 1 diária por dia; primeira semana com 7 passos (1 por dia, nunca expira); missão de volta (7/14/30 dias);
--   * progresso só com as métricas OFICIAIS da corrida (private.advance_missions, chamada pela gravação v2 na onda 2),
--     sem passar da meta; métricas de conjunto (zonas, bairros) contam itens distintos;
--   * resgate idempotente (claim_mission) pelo livro de XP; baú bônus e cosmético quando a missão dá.
-- Trilha da temporada (E7 §6): 24 degraus de 120 XP da temporada (soma do xp_ledger do mês, sem o XP da própria trilha);
-- resgate idempotente por degrau (claim_track_step); medalha bronze/prata/ouro em 8/16/24.
-- Os períodos usam sempre o relógio do servidor (Brasília).

-- ===========================================================================
-- Missões
-- ===========================================================================
create table public.mission_defs (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  cadence text not null check (cadence in ('diaria', 'semanal', 'ftue', 'volta')),
  tier text not null check (tier in ('leve', 'padrao', 'desafio')),
  text text not null check (char_length(text) between 3 and 40),
  metric text not null check (metric in ('moving_seconds', 'meters', 'new_fog_cells', 'zones_painted', 'chests_opened',
                                         'ghost_beaten', 'ghost_beaten_1km', 'zones_conquered', 'zones_defended', 'group_runs',
                                         'runs', 'districts', 'raid_meters', 'crew_member', 'league_points', 'shares')),
  target integer not null check (target > 0),
  target_rule text check (target_rule in ('d-km', 's-km', 's-chefao')),
  xp integer not null check (xp between 0 and 1000),
  extra text check (extra is null or char_length(extra) <= 60),
  reward_chest text check (reward_chest in ('comum', 'raro', 'lendario')),
  reward_cosmetic text references public.cosmetic_defs (id),
  requires text check (requires in ('crew', 'raid', 'league', 'zone_attack')),
  fallback_text text check (fallback_text is null or char_length(fallback_text) between 3 and 40),
  fallback_metric text,
  fallback_target integer check (fallback_target is null or fallback_target > 0),
  step smallint,
  sort smallint not null default 0,
  active boolean not null default true,
  is_demo boolean not null default false,
  check ((fallback_text is null) = (fallback_metric is null) and (fallback_metric is null) = (fallback_target is null))
);
comment on table public.mission_defs is 'D-65: catálogo de missões (ids iguais aos de src/domain/missions.ts, E7). Textos ≤ 40 caracteres.';

create table public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  def_id text not null references public.mission_defs (id),
  cadence text not null check (cadence in ('diaria', 'semanal', 'ftue', 'volta')),
  period_key text not null check (period_key ~ '^(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}|ftue|volta-\d{4}-\d{2}-\d{2})$'),
  slot smallint not null check (slot between 1 and 9),
  metric text not null,
  target integer not null check (target > 0),
  xp integer not null check (xp >= 0),
  text text not null check (char_length(text) between 3 and 40),
  progress integer not null default 0 check (progress >= 0),
  seen text[] not null default '{}' check (cardinality(seen) <= 200),
  completed_at timestamptz,
  claimed_at timestamptz,
  rerolled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, def_id, period_key),
  check (progress <= target),
  check (claimed_at is null or completed_at is not null),
  check (rerolled_at is null or completed_at is null)
);
create unique index user_missions_slot_key on public.user_missions (user_id, period_key, slot) where rerolled_at is null;
create index user_missions_open_idx on public.user_missions (user_id, period_key) where completed_at is null and rerolled_at is null;

alter table public.mission_defs enable row level security;
alter table public.user_missions enable row level security;
revoke all on public.mission_defs, public.user_missions from anon, authenticated;
grant select on public.mission_defs, public.user_missions to authenticated;
create policy mission_defs_read on public.mission_defs for select to authenticated using (active);
create policy user_missions_select on public.user_missions for select to authenticated using (user_id = (select auth.uid()));
create policy user_missions_active_account on public.user_missions as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

insert into public.mission_defs (id, cadence, tier, text, metric, target, target_rule, xp, extra, reward_chest, reward_cosmetic,
                                 requires, fallback_text, fallback_metric, fallback_target, step, sort) values
  -- diárias (20/30/40 XP)
  ('d-mover-15', 'diaria', 'leve', 'Mova-se 15 min (caminhar vale)', 'moving_seconds', 900, null, 20, null, null, null, null, null, null, null, null, 1),
  ('d-1500m', 'diaria', 'leve', 'Caminhe ou corra 1,5 km', 'meters', 1500, null, 20, null, null, null, null, null, null, null, null, 2),
  ('d-neblina-5', 'diaria', 'leve', 'Revele 5 trechos novos da Neblina', 'new_fog_cells', 5, null, 20, null, null, null, null, null, null, null, null, 3),
  ('d-km', 'diaria', 'padrao', 'Corra {x} km hoje', 'meters', 2000, 'd-km', 30, null, null, null, null, null, null, null, null, 4),
  ('d-pintar-3', 'diaria', 'padrao', 'Pinte 3 zonas com a cor do time', 'zones_painted', 3, null, 30, null, null, null, null, null, null, null, null, 5),
  ('d-caca-2', 'diaria', 'padrao', 'Abra 2 baús na Caça', 'chests_opened', 2, null, 30, null, null, null, null, null, null, null, null, 6),
  ('d-fantasma', 'diaria', 'padrao', 'Termine à frente do fantasma', 'ghost_beaten', 1, null, 30, null, null, null, null, null, null, null, null, 7),
  ('d-conquistar', 'diaria', 'desafio', 'Conquiste uma zona', 'zones_conquered', 1, null, 40, null, null, null, null, null, null, null, null, 8),
  ('d-defender', 'diaria', 'desafio', 'Defenda uma zona sob ataque', 'zones_defended', 1, null, 40, null, null, null, 'zone_attack', null, null, null, null, 9),
  ('d-crew', 'diaria', 'desafio', 'Corra junto com alguém da crew', 'group_runs', 1, null, 40, null, null, null, 'crew', null, null, null, null, 10),
  ('d-neblina-20', 'diaria', 'desafio', 'Revele 20 trechos novos da cidade', 'new_fog_cells', 20, null, 40, null, null, null, null, null, null, null, null, 11),
  -- semanais (100/150/200 XP; segunda 00:00 a domingo 23:59 de Brasília)
  ('s-2-atividades', 'semanal', 'leve', 'Faça 2 atividades na semana', 'runs', 2, null, 100, null, null, null, null, null, null, null, null, 20),
  ('s-60-min', 'semanal', 'leve', 'Some 60 minutos de movimento', 'moving_seconds', 3600, null, 100, null, null, null, null, null, null, null, null, 21),
  ('s-km', 'semanal', 'padrao', 'Some {x} km na semana', 'meters', 6000, 's-km', 150, null, null, null, null, null, null, null, null, 22),
  ('s-pintar-10', 'semanal', 'padrao', 'Pinte 10 zonas diferentes', 'zones_painted', 10, null, 150, null, null, null, null, null, null, null, null, 23),
  ('s-bairros-2', 'semanal', 'padrao', 'Corra em 2 bairros diferentes', 'districts', 2, null, 150, null, null, null, null, null, null, null, null, 24),
  ('s-conquistar-3', 'semanal', 'desafio', 'Conquiste 3 zonas na semana', 'zones_conquered', 3, null, 200, null, null, null, null, null, null, null, null, 25),
  ('s-chefao', 'semanal', 'desafio', 'Cause {x} km de dano no chefão', 'raid_meters', 3000, 's-chefao', 200, null, null, null, 'raid', null, null, null, null, 26),
  ('s-crew-2', 'semanal', 'desafio', 'Corra 2 vezes com a sua crew', 'group_runs', 2, null, 200, null, null, null, 'crew', null, null, null, null, 27),
  -- primeira semana: um passo por dia depois do anterior; nunca expira
  ('f1-dominio', 'ftue', 'leve', 'Corra 500 m e pinte sua 1ª zona', 'zones_painted', 1, null, 100, 'baú do dia raro garantido', 'raro', null, null, null, null, null, 1, 40),
  ('f2-caca', 'ftue', 'leve', 'Abra seu primeiro baú na Caça', 'chests_opened', 1, null, 40, null, null, null, null, null, null, null, 2, 41),
  ('f3-fuga', 'ftue', 'leve', 'Vença o fantasma em 1 km', 'ghost_beaten_1km', 1, null, 40, null, null, null, null, null, null, null, 3, 42),
  ('f4-raid', 'ftue', 'leve', 'Cause 1 km de dano no chefão', 'raid_meters', 1000, null, 40, null, null, null, 'raid',
   'Revele 10 trechos da Neblina', 'new_fog_cells', 10, 4, 43),
  ('f5-crew', 'ftue', 'leve', 'Entre numa crew ou crie a sua', 'crew_member', 1, null, 60, null, null, null, null, null, null, null, 5, 44),
  ('f6-liga', 'ftue', 'leve', 'Some seus primeiros pontos na liga', 'league_points', 1, null, 60, null, null, null, 'league',
   'Corra e veja o ranking do seu time', 'runs', 1, 6, 45),
  ('f7-compartilhar', 'ftue', 'leve', 'Compartilhe o card de uma corrida', 'shares', 1, null, 60, 'moldura "Primeira Semana"', null,
   'moldura-primeira-semana', null, null, null, null, 7, 46),
  -- volta depois de 7, 14 e 30 dias sem atividade (step = dias)
  ('v-7', 'volta', 'leve', 'Volta leve: 10 minutos já contam', 'moving_seconds', 600, null, 50, 'baú do dia raro garantido', 'raro', null, null, null, null, null, 7, 60),
  ('v-14', 'volta', 'leve', 'Caminhe 1 km no seu ritmo', 'meters', 1000, null, 60, 'baú do dia raro garantido', 'raro', null, null, null, null, null, 14, 61),
  ('v-30', 'volta', 'leve', 'Recomece: 10 minutos, sem pressa', 'moving_seconds', 600, null, 80, 'baú lendário garantido', 'lendario', null, null, null, null, null, 30, 62);

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
-- Chaves de período em Brasília: [dia, semana ISO].
create or replace function private.mission_periods(p_at timestamptz) returns text[]
language sql stable set search_path = '' as $$
  select array[(p_at at time zone 'America/Sao_Paulo')::date::text, to_char(p_at at time zone 'America/Sao_Paulo', 'IYYY-"W"IW')]
$$;
revoke all on function private.mission_periods(timestamptz) from public, anon, authenticated;

-- "3,5" / "8" (km com vírgula, sem ",0")
create or replace function private.km_text(p_meters integer) returns text
language sql immutable set search_path = '' as $$
  select replace(rtrim(rtrim(to_char(p_meters / 1000.0, 'FM99990.0'), '0'), '.'), '.', ',')
$$;
revoke all on function private.km_text(integer) from public, anon, authenticated;

-- Missão possível para a pessoa agora?
create or replace function private.mission_eligible(p_user uuid, p_requires text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_requires
    when 'crew' then exists (select 1 from public.crew_members cm where cm.user_id = p_user)
    when 'raid' then private.feature_on('raid') and exists (select 1 from public.raids r where r.status = 'active')
    when 'league' then private.feature_on('league')
    when 'zone_attack' then exists (select 1 from public.zones z join public.profiles pr on pr.id = p_user
                                     where z.owner = pr.faction and z.attacker is not null
                                       and (pr.city is null or z.city = pr.city))
    else true end
$$;
revoke all on function private.mission_eligible(uuid, text) from public, anon, authenticated;

-- Meta adaptativa (E7 §5.1), em metros.
create or replace function private.mission_target(p_user uuid, p_rule text, p_default integer, p_at timestamptz) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_week date := date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date;
  v_median numeric;
  v_max numeric;
  v_t numeric;
begin
  if p_rule = 'd-km' then
    -- mediana das últimas 10 corridas, arredondada a 0,5 km, entre 2 e 8 km
    select percentile_cont(0.5) within group (order by m) into v_median
      from (select a.meters as m from public.activities a where a.user_id = p_user and a.scored and a.ended_at < p_at
             order by a.ended_at desc limit 10) x;
    if v_median is null then return 2000; end if;
    return least(8000, greatest(2000, round(v_median / 500) * 500))::integer;
  elsif p_rule in ('s-km', 's-chefao') then
    -- 90 % da mediana semanal das últimas 4 semanas, até +10 % da maior; 6 a 40 km
    select percentile_cont(0.5) within group (order by km), max(km) into v_median, v_max from (
      select coalesce(sum(a.meters), 0) as km
        from generate_series(1, 4) g
        left join public.activities a
          on a.user_id = p_user and a.scored
         and a.ended_at >= ((v_week - 7 * g) + time '00:00') at time zone 'America/Sao_Paulo'
         and a.ended_at < ((v_week - 7 * (g - 1)) + time '00:00') at time zone 'America/Sao_Paulo'
       group by g) s;
    v_t := case when coalesce(v_max, 0) = 0 then 6000 else least(0.9 * v_median, 1.1 * v_max) end;
    v_t := least(40000, greatest(6000, round(v_t / 1000) * 1000));
    if p_rule = 's-chefao' then
      -- metade da meta semanal de km, entre 3 e 15 km
      return least(15000, greatest(3000, round(v_t / 2 / 500) * 500))::integer;
    end if;
    return v_t::integer;
  end if;
  return p_default;
end $$;
revoke all on function private.mission_target(uuid, text, integer, timestamptz) from public, anon, authenticated;

-- Atribui uma missão (com meta e texto finais, ou com o substituto quando a exigência não vale agora).
create or replace function private.assign_mission(p_user uuid, p_def text, p_period text, p_slot integer, p_at timestamptz)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d public.mission_defs;
  v_target integer;
  v_text text;
  v_metric text;
  v_id uuid;
begin
  select * into d from public.mission_defs where id = p_def;
  if d.requires is not null and d.fallback_metric is not null and not private.mission_eligible(p_user, d.requires) then
    v_metric := d.fallback_metric; v_target := d.fallback_target; v_text := d.fallback_text;
  else
    v_metric := d.metric;
    v_target := case when d.target_rule is null then d.target else private.mission_target(p_user, d.target_rule, d.target, p_at) end;
    v_text := replace(d.text, '{x}', private.km_text(v_target));
  end if;
  insert into public.user_missions (user_id, def_id, cadence, period_key, slot, metric, target, xp, text)
  values (p_user, d.id, d.cadence, p_period, p_slot, v_metric, v_target, d.xp, v_text)
  on conflict do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function private.assign_mission(uuid, text, text, integer, timestamptz) from public, anon, authenticated;

-- Garante as missões do momento: sorteio diário e semanal, passo da primeira semana e missão de volta.
-- p_exclude: a corrida que está sendo gravada (a gravação v2 chama antes de contar a corrida, para a missão de volta).
create or replace function private.ensure_missions(p_user uuid, p_at timestamptz default now(), p_exclude uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_keys text[] := private.mission_periods(p_at);
  v_today date := (p_at at time zone 'America/Sao_Paulo')::date;
  v_tier text;
  v_cad text;
  v_key text;
  v_def text;
  v_slot integer;
  v_last public.user_missions;
  v_step smallint;
  v_last_run date;
  v_days integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('missions:' || p_user, 0));
  -- diárias e semanais: 1 leve + 1 padrão + 1 desafio
  foreach v_cad in array array['diaria', 'semanal'] loop
    v_key := case v_cad when 'diaria' then v_keys[1] else v_keys[2] end;
    v_slot := 0;
    foreach v_tier in array array['leve', 'padrao', 'desafio'] loop
      v_slot := v_slot + 1;
      continue when exists (select 1 from public.user_missions um where um.user_id = p_user and um.period_key = v_key
                                                                     and um.slot = v_slot);
      select d.id into v_def from public.mission_defs d
       where d.active and d.cadence = v_cad and d.tier = v_tier and private.mission_eligible(p_user, d.requires)
       order by md5(p_user::text || v_key || d.id) limit 1;
      if v_def is not null then
        perform private.assign_mission(p_user, v_def, v_key, v_slot, p_at);
      end if;
    end loop;
  end loop;

  -- primeira semana: só para conta nova (janela de 14 dias) ou para quem já começou; 1 passo por dia
  select * into v_last from public.user_missions um where um.user_id = p_user and um.period_key = 'ftue' order by um.slot desc limit 1;
  if v_last.id is null then
    if (select pr.created_at from public.profiles pr where pr.id = p_user)
       >= p_at - make_interval(days => private.param_num('missions', 'ftueWindowDays', 14)::integer) then
      perform private.assign_mission(p_user, (select d.id from public.mission_defs d where d.cadence = 'ftue' and d.active
                                               order by d.step limit 1), 'ftue', 1, p_at);
    end if;
  elsif v_last.completed_at is not null and (v_last.completed_at at time zone 'America/Sao_Paulo')::date < v_today then
    select d.id, d.step into v_def, v_step from public.mission_defs d
     where d.cadence = 'ftue' and d.active and d.step > (select x.step from public.mission_defs x where x.id = v_last.def_id)
     order by d.step limit 1;
    if v_def is not null then
      perform private.assign_mission(p_user, v_def, 'ftue', v_last.slot + 1, p_at);
    end if;
  end if;
  -- passo "entre numa crew" conclui sozinho quando a pessoa já tem crew
  update public.user_missions um set progress = um.target, completed_at = coalesce(um.completed_at, p_at)
   where um.user_id = p_user and um.period_key = 'ftue' and um.metric = 'crew_member' and um.completed_at is null
     and exists (select 1 from public.crew_members cm where cm.user_id = p_user);

  -- volta: 7, 14 ou 30 dias sem atividade aceita (uma por ausência)
  select (max(a.ended_at) at time zone 'America/Sao_Paulo')::date into v_last_run
    from public.activities a where a.user_id = p_user and a.scored and a.id is distinct from p_exclude and a.ended_at < p_at;
  if v_last_run is not null then
    v_days := v_today - v_last_run;
    select d.id into v_def from public.mission_defs d
     where d.cadence = 'volta' and d.active and d.step <= v_days order by d.step desc limit 1;
    if v_def is not null then
      perform private.assign_mission(p_user, v_def, 'volta-' || v_last_run, 1, p_at);
    end if;
  end if;
end $$;
revoke all on function private.ensure_missions(uuid, timestamptz, uuid) from public, anon, authenticated;

create or replace function private.mission_json(um public.user_missions) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', um.id, 'defId', um.def_id, 'cadence', um.cadence, 'tier', d.tier, 'slot', um.slot,
                            'text', um.text, 'metric', um.metric, 'progress', um.progress, 'target', um.target, 'xp', um.xp,
                            'extra', d.extra, 'periodKey', um.period_key, 'step', d.step,
                            'completedAt', private.ts_to_ms(um.completed_at), 'claimedAt', private.ts_to_ms(um.claimed_at))
    from public.mission_defs d where d.id = um.def_id
$$;
revoke all on function private.mission_json(public.user_missions) from public, anon, authenticated;

-- Avança o progresso com as métricas oficiais da corrida (gravação v2, onda 2). Números somam; listas (zonas, bairros)
-- contam itens distintos. Nunca passa da meta; cada missão conclui uma vez. Devolve as concluídas agora.
create or replace function private.advance_missions(p_user uuid, p_metrics jsonb, p_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_keys text[] := private.mission_periods(p_at);
  um public.user_missions;
  v jsonb;
  v_seen text[];
  v_progress integer;
  v_done jsonb := '[]'::jsonb;
begin
  if p_metrics is null or jsonb_typeof(p_metrics) <> 'object' then
    return v_done;
  end if;
  for um in select * from public.user_missions x
             where x.user_id = p_user and x.completed_at is null and x.rerolled_at is null
               and (x.period_key = any (v_keys) or x.period_key = 'ftue' or x.period_key like 'volta-%')
               and p_metrics ? x.metric
             order by x.created_at for update loop
    v := p_metrics -> um.metric;
    if jsonb_typeof(v) = 'array' then
      select coalesce(array_agg(distinct e), '{}') into v_seen
        from (select unnest(um.seen) as e union select jsonb_array_elements_text(v)) x
       where e is not null;
      v_seen := v_seen[1:200];
      v_progress := least(um.target, cardinality(v_seen));
    elsif jsonb_typeof(v) = 'number' then
      v_seen := um.seen;
      v_progress := least(um.target, um.progress + greatest(0, floor((v #>> '{}')::numeric))::integer);
    else
      continue;
    end if;
    update public.user_missions
       set progress = v_progress, seen = v_seen,
           completed_at = case when v_progress >= um.target then p_at else null end
     where id = um.id
    returning * into um;
    if um.completed_at is not null then
      v_done := v_done || private.mission_json(um);
    end if;
  end loop;
  return v_done;
end $$;
revoke all on function private.advance_missions(uuid, jsonb, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs do cliente
-- ---------------------------------------------------------------------------
create or replace function public.my_missions() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_keys text[] := private.mission_periods(now());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('missions') then
    raise exception 'FEATURE_DISABLED: missões ainda não estão ligadas' using errcode = 'P0001';
  end if;
  perform private.ensure_missions(v_uid, now());
  return jsonb_build_object(
    'periods', jsonb_build_object('daily', v_keys[1], 'weekly', v_keys[2]),
    'daily', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                        where um.user_id = v_uid and um.period_key = v_keys[1] and um.rerolled_at is null), '[]'::jsonb),
    'weekly', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                         where um.user_id = v_uid and um.period_key = v_keys[2] and um.rerolled_at is null), '[]'::jsonb),
    'ftue', (select jsonb_build_object('step', um.slot, 'total', private.param_num('missions', 'ftueSteps', 7),
                                       'mission', private.mission_json(um))
               from public.user_missions um where um.user_id = v_uid and um.period_key = 'ftue'
              order by um.slot desc limit 1),
    'comeback', (select private.mission_json(um) from public.user_missions um
                  where um.user_id = v_uid and um.period_key like 'volta-%' and um.claimed_at is null
                  order by um.created_at desc limit 1),
    'rerollsLeft', greatest(0, private.param_num('missions', 'rerollsPerDay', 1)::integer
                               - (select count(*) from public.user_missions um where um.user_id = v_uid
                                     and um.rerolled_at >= public.br_day_start())::integer));
end $$;
revoke all on function public.my_missions() from public, anon;
grant execute on function public.my_missions() to authenticated;

-- Troca 1 missão diária por dia, por outra do mesmo nível (autonomia, E7 §5.1).
create or replace function public.reroll_mission(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  um public.user_missions;
  v_def text;
  v_new uuid;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('missions') then
    raise exception 'FEATURE_DISABLED: missões ainda não estão ligadas' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('missions:' || v_uid, 0));
  select * into um from public.user_missions where id = p_id and user_id = v_uid for update;
  if um.id is null or um.rerolled_at is not null then
    raise exception 'NOT_FOUND: missão não encontrada' using errcode = 'P0001';
  end if;
  if um.cadence <> 'diaria' or um.period_key <> public.br_today()::text then
    raise exception 'MISSION_NOT_REROLLABLE: só dá para trocar uma missão de hoje' using errcode = 'P0001';
  end if;
  if um.completed_at is not null then
    raise exception 'MISSION_NOT_REROLLABLE: missão já concluída' using errcode = 'P0001';
  end if;
  if (select count(*) from public.user_missions x where x.user_id = v_uid and x.rerolled_at >= public.br_day_start())
     >= private.param_num('missions', 'rerollsPerDay', 1) then
    raise exception 'REROLL_LIMIT: você já trocou uma missão hoje' using errcode = 'P0001';
  end if;
  select d.id into v_def from public.mission_defs d
   where d.active and d.cadence = 'diaria' and d.tier = (select x.tier from public.mission_defs x where x.id = um.def_id)
     and private.mission_eligible(v_uid, d.requires)
     and not exists (select 1 from public.user_missions y where y.user_id = v_uid and y.period_key = um.period_key and y.def_id = d.id)
   order by md5(v_uid::text || um.period_key || d.id || 'troca') limit 1;
  if v_def is null then
    raise exception 'MISSION_NO_ALTERNATIVE: não há outra missão desse nível hoje' using errcode = 'P0001';
  end if;
  update public.user_missions set rerolled_at = now() where id = um.id;
  v_new := private.assign_mission(v_uid, v_def, um.period_key, um.slot, now());
  return (select private.mission_json(x) from public.user_missions x where x.id = v_new);
end $$;
revoke all on function public.reroll_mission(uuid) from public, anon;
grant execute on function public.reroll_mission(uuid) to authenticated;

-- Resgate idempotente: XP pelo livro (fonte mission/ftue/comeback, referência = id da atribuição), baú bônus e cosmético.
create or replace function public.claim_mission(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  um public.user_missions;
  d public.mission_defs;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into um from public.user_missions where id = p_id and user_id = v_uid for update;
  if um.id is null or um.rerolled_at is not null then
    raise exception 'NOT_FOUND: missão não encontrada' using errcode = 'P0001';
  end if;
  select * into d from public.mission_defs where id = um.def_id;
  if um.claimed_at is not null then
    return jsonb_build_object('id', um.id, 'claimed', false, 'alreadyClaimed', true, 'xp', 0, 'chest', null, 'cosmeticId', null);
  end if;
  if um.completed_at is null then
    raise exception 'MISSION_NOT_COMPLETED: missão ainda não concluída' using errcode = 'P0001';
  end if;
  update public.user_missions set claimed_at = now() where id = um.id;
  perform private.grant_xp(v_uid, case um.cadence when 'ftue' then 'ftue' when 'volta' then 'comeback' else 'mission' end,
                           um.id::text, um.xp);
  if d.reward_chest is not null then
    perform private.add_bonus_chest(v_uid, d.reward_chest);
  end if;
  if d.reward_cosmetic is not null then
    perform private.grant_cosmetic(v_uid, d.reward_cosmetic, '', 'mission:' || um.id);
  end if;
  return jsonb_build_object('id', um.id, 'claimed', true, 'alreadyClaimed', false, 'xp', um.xp,
                            'chest', d.reward_chest, 'cosmeticId', d.reward_cosmetic);
end $$;
revoke all on function public.claim_mission(uuid) from public, anon;
grant execute on function public.claim_mission(uuid) to authenticated;

-- Passo 7 da primeira semana: o app avisa depois que o share sheet concluiu (declarado; só XP baixo e cosmético).
create or replace function public.record_share(p_activity uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not exists (select 1 from public.activities a where a.id = p_activity and a.user_id = v_uid and a.status <> 'recording') then
    raise exception 'NOT_FOUND: corrida não encontrada' using errcode = 'P0001';
  end if;
  if not private.feature_on('missions') then
    return jsonb_build_object('completed', '[]'::jsonb);
  end if;
  return jsonb_build_object('completed', private.advance_missions(v_uid, '{"shares": 1}'::jsonb, now()));
end $$;
revoke all on function public.record_share(uuid) from public, anon;
grant execute on function public.record_share(uuid) to authenticated;

-- ===========================================================================
-- Trilha da temporada (E7 §6)
-- ===========================================================================
create table public.track_rewards (
  step smallint not null check (step between 1 and 24),
  n smallint not null default 1 check (n between 1 and 3),
  kind text not null check (kind in ('cosmetic', 'xp', 'chest', 'freeze', 'medal')),
  cosmetic_id text references public.cosmetic_defs (id),
  amount integer check (amount is null or amount between 1 and 500),
  rarity text check (rarity in ('comum', 'raro', 'lendario')),
  medal_tier text check (medal_tier in ('bronze', 'prata', 'ouro')),
  primary key (step, n),
  check ((kind = 'cosmetic') = (cosmetic_id is not null)),
  check ((kind = 'xp') = (amount is not null)),
  check ((kind = 'chest') = (rarity is not null)),
  check ((kind = 'medal') = (medal_tier is not null))
);

create table public.track_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  season_id text not null check (season_id ~ '^\d{4}-\d{2}$'),
  step smallint not null check (step between 1 and 24),
  claimed_at timestamptz not null default now(),
  primary key (user_id, season_id, step)
);

alter table public.track_rewards enable row level security;
alter table public.track_claims enable row level security;
revoke all on public.track_rewards, public.track_claims from anon, authenticated;
grant select on public.track_rewards, public.track_claims to authenticated;
create policy track_rewards_read on public.track_rewards for select to authenticated using (true);
create policy track_claims_select on public.track_claims for select to authenticated using (user_id = (select auth.uid()));
create policy track_claims_active_account on public.track_claims as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

insert into public.track_rewards (step, n, kind, cosmetic_id, amount, rarity, medal_tier) values
  (1, 1, 'chest', null, null, 'raro', null),
  (2, 1, 'cosmetic', 'emblema-temporada', null, null, null),
  (3, 1, 'cosmetic', 'moldura-temporada', null, null, null),
  (4, 1, 'cosmetic', 'rastro-temporada', null, null, null),
  (5, 1, 'xp', null, 50, null, null), (6, 1, 'xp', null, 50, null, null), (7, 1, 'xp', null, 50, null, null),
  (8, 1, 'medal', null, null, null, 'bronze'), (8, 2, 'freeze', null, null, null, null),
  (9, 1, 'cosmetic', 'efeito-faisca-mes', null, null, null),
  (10, 1, 'chest', null, null, 'lendario', null),
  (11, 1, 'xp', null, 50, null, null),
  (12, 1, 'cosmetic', 'rastro-temporada-brilho', null, null, null),
  (13, 1, 'xp', null, 75, null, null), (14, 1, 'xp', null, 75, null, null), (15, 1, 'xp', null, 75, null, null),
  (16, 1, 'medal', null, null, null, 'prata'), (16, 2, 'cosmetic', 'moldura-temporada-rara', null, null, null),
  (17, 1, 'chest', null, null, 'raro', null),
  (18, 1, 'cosmetic', 'efeito-pulso-mes', null, null, null),
  (19, 1, 'xp', null, 75, null, null),
  (20, 1, 'cosmetic', 'rastro-temporada-animado', null, null, null),
  (21, 1, 'xp', null, 100, null, null), (22, 1, 'xp', null, 100, null, null), (23, 1, 'xp', null, 100, null, null),
  (24, 1, 'medal', null, null, null, 'ouro'), (24, 2, 'cosmetic', 'moldura-temporada-animada', null, null, null);

-- XP da temporada: soma do livro no mês, sem o XP que a própria trilha deu (não se retroalimenta).
create or replace function private.season_xp(p_user uuid, p_season text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(x.amount), 0)::integer from public.xp_ledger x
   where x.user_id = p_user and x.season_id = p_season and x.source <> 'season_step'
$$;
revoke all on function private.season_xp(uuid, text) from public, anon, authenticated;

create or replace function public.my_track() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_season text := public.current_season_id();
  v_step_xp integer := private.param_num('track', 'stepXp', 120)::integer;
  v_steps integer := private.param_num('track', 'steps', 24)::integer;
  v_xp integer;
  v_step integer;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('track') then
    raise exception 'FEATURE_DISABLED: trilha da temporada ainda não está ligada' using errcode = 'P0001';
  end if;
  v_xp := private.season_xp(v_uid, v_season);
  v_step := least(v_steps, v_xp / v_step_xp);
  return jsonb_build_object(
    'seasonId', v_season,
    'endsAt', private.ts_to_ms(public.season_start(to_char(public.season_start(v_season) at time zone 'America/Sao_Paulo'
                                                           + interval '1 month', 'YYYY-MM'))),
    'xp', v_xp, 'step', v_step, 'stepXp', v_step_xp, 'steps', v_steps,
    'nextStepXp', case when v_step < v_steps then (v_step + 1) * v_step_xp else null end,
    'prestigeStars', greatest(0, (v_xp - v_steps * v_step_xp) / (2 * v_step_xp)),
    'medal', (select um.tier from public.user_medals um where um.user_id = v_uid and um.medal_id = 'temporada' and um.period = v_season),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('step', s.step, 'unlocked', s.step <= v_step,
                                   'claimed', exists (select 1 from public.track_claims c where c.user_id = v_uid
                                                         and c.season_id = v_season and c.step = s.step),
                                   'items', (select jsonb_agg(jsonb_build_object('kind', r.kind, 'cosmeticId', r.cosmetic_id,
                                                                                 'amount', r.amount, 'rarity', r.rarity,
                                                                                 'medalTier', r.medal_tier) order by r.n)
                                               from public.track_rewards r where r.step = s.step)) order by s.step)
                           from (select distinct step from public.track_rewards) s), '[]'::jsonb));
end $$;
revoke all on function public.my_track() from public, anon;
grant execute on function public.my_track() to authenticated;

-- Resgate de um degrau já alcançado (idempotente por usuário + temporada + degrau).
create or replace function public.claim_track_step(p_step integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_season text := public.current_season_id();
  r public.track_rewards;
  v_items jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('track') then
    raise exception 'FEATURE_DISABLED: trilha da temporada ainda não está ligada' using errcode = 'P0001';
  end if;
  if p_step is null or p_step < 1 or p_step > private.param_num('track', 'steps', 24) then
    raise exception 'INVALID_STEP: degrau inválido' using errcode = 'P0001';
  end if;
  if private.season_xp(v_uid, v_season) < p_step * private.param_num('track', 'stepXp', 120) then
    raise exception 'TRACK_LOCKED: degrau ainda não alcançado' using errcode = 'P0001';
  end if;
  insert into public.track_claims (user_id, season_id, step) values (v_uid, v_season, p_step) on conflict do nothing;
  if not found then
    return jsonb_build_object('step', p_step, 'seasonId', v_season, 'alreadyClaimed', true, 'items', '[]'::jsonb);
  end if;
  for r in select * from public.track_rewards where step = p_step order by n loop
    case r.kind
      when 'cosmetic' then
        perform private.grant_cosmetic(v_uid, r.cosmetic_id,
                                       case when (select d.source from public.cosmetic_defs d where d.id = r.cosmetic_id) = 'trilha'
                                            then v_season else '' end,
                                       'track:' || v_season || ':' || p_step);
      when 'xp' then
        perform private.grant_xp(v_uid, 'season_step', v_season || ':' || p_step || ':' || r.n, r.amount);
      when 'chest' then
        perform private.add_bonus_chest(v_uid, r.rarity);
      when 'freeze' then
        update public.profiles set freezes_left = least(private.param_num('track', 'maxFreezes', 2)::integer, freezes_left + 1)
         where id = v_uid and freezes_left < private.param_num('track', 'maxFreezes', 2);
      when 'medal' then
        perform private.award_medal(v_uid, 'temporada', r.medal_tier, v_season, null);
    end case;
    v_items := v_items || jsonb_build_object('kind', r.kind, 'cosmeticId', r.cosmetic_id, 'amount', r.amount, 'rarity', r.rarity,
                                             'medalTier', r.medal_tier);
  end loop;
  return jsonb_build_object('step', p_step, 'seasonId', v_season, 'alreadyClaimed', false, 'items', v_items);
end $$;
revoke all on function public.claim_track_step(integer) from public, anon;
grant execute on function public.claim_track_step(integer) to authenticated;
