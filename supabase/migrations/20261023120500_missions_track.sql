-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-65/D-64; contrato E7 §1–§6): missões e trilha da temporada.
-- Missões (regras puras em src/domain/missions.ts; o SQL guarda, trava e confere):
--   * mission_defs com os MESMOS 29 ids e textos de MISSION_CATALOG (kind = MissionCadence: diaria, semanal, ftue, volta);
--   * 3 diárias + 3 semanais (slot 0 leve, 1 padrão, 2 desafio: sempre 1 leve), sorteio determinístico por
--     md5(usuário + período + id), só entre as possíveis (crew, zona do time sob ataque, raid ativo);
--   * alvos adaptativos daily_km / weekly_km / raid_km com os números de dailyKmTarget/weeklyKmTarget/raidKmTarget;
--   * troca de 1 diária por dia NO MESMO slot (progresso 0); primeira semana (slots 1..7, um passo por dia depois do
--     anterior, nunca expira, versão alternativa sem raid/liga); missão de volta (7/14/30 dias, uma por ausência);
--   * progresso ABSOLUTO calculado pelo domain (settleMission) e gravado com greatest(): nunca volta e nunca passa da
--     meta; ao concluir, paga na hora (claimed_at = completed_at, XP pelo livro, baú bônus, cosmético);
--     claim_mission fica como caminho idempotente;
--   * métricas de estado (crew, liga, compartilhar, abrir o ranking) o próprio servidor confere; as de atividade chegam
--     pela gravação v2 do finish-activity (onda 2) em private.advance_missions.
-- Trilha da temporada (E7 §6): 24 degraus de 120 XP da temporada (soma do xp_ledger do mês, sem o XP da própria trilha);
-- resgate idempotente por degrau (claim_track_step); medalha bronze/prata/ouro em 8/16/24.
-- Os períodos usam sempre o relógio do servidor (Brasília).

-- ===========================================================================
-- Missões
-- ===========================================================================
create table public.mission_defs (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  kind text not null check (kind in ('diaria', 'semanal', 'ftue', 'volta')),
  tier text not null check (tier in ('leve', 'padrao', 'desafio')),
  requires text check (requires in ('crew', 'zone_under_attack', 'raid')),
  metric text not null check (metric in ('moving_seconds', 'meters', 'new_fog_cells', 'zones_painted', 'districts',
                                         'chests_opened', 'ghost_wins', 'zones_conquered', 'zones_defended', 'crew_runs',
                                         'runs', 'raid_damage_m', 'painted_runs', 'crew_member', 'league_points',
                                         'ranking_opened', 'shares')),
  target integer check (target is null or target > 0),
  target_rule text not null default 'fixed' check (target_rule in ('fixed', 'daily_km', 'weekly_km', 'raid_km')),
  min_meters integer check (min_meters is null or min_meters > 0),
  reward_xp integer not null check (reward_xp between 0 and 1000),
  title text not null check (char_length(title) between 3 and 40),
  fallback_when text check (fallback_when in ('no_raid', 'no_league')),
  fallback_metric text,
  fallback_target integer check (fallback_target is null or fallback_target > 0),
  fallback_title text check (fallback_title is null or char_length(fallback_title) between 3 and 40),
  bonus jsonb check (bonus is null or jsonb_typeof(bonus) = 'object'),
  step smallint,                     -- primeira semana: 1..7; volta: dias de ausência (7, 14, 30)
  sort smallint not null default 0,  -- ordem de MISSION_CATALOG
  active boolean not null default true,
  is_demo boolean not null default false,
  check ((target_rule = 'fixed') = (target is not null)),
  check ((fallback_when is null) = (fallback_metric is null) and (fallback_metric is null) = (fallback_target is null)
         and (fallback_target is null) = (fallback_title is null))
);
comment on table public.mission_defs is
  'D-65: catálogo de missões = MISSION_CATALOG (src/domain/missions.ts, E7). title ≤ 40 com {x} = alvo em km.';

create table public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  def_id text not null references public.mission_defs (id),
  kind text not null check (kind in ('diaria', 'semanal', 'ftue', 'volta')),
  period_key text not null check (period_key ~ '^(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}|ftue|volta-\d{4}-\d{2}-\d{2})$'),
  slot smallint not null check (slot between 0 and 7),
  variant text not null default 'base' check (variant in ('base', 'fallback')),
  metric text not null,
  target integer not null check (target > 0),
  xp integer not null check (xp >= 0),
  title text not null check (char_length(title) between 3 and 40),
  progress integer not null default 0 check (progress >= 0),
  available_from timestamptz not null,
  completed_at timestamptz,
  claimed_at timestamptz,
  rerolled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, period_key, slot),
  unique (user_id, def_id, period_key),
  check (progress <= target),
  check (claimed_at is null or completed_at is not null)
);
create index user_missions_open_idx on public.user_missions (user_id, period_key) where completed_at is null;
create index user_missions_rerolled_idx on public.user_missions (user_id, rerolled_at) where rerolled_at is not null;

-- Fatos declarados pelo app que contam para missões (compartilhar o card, abrir o ranking): 1 por tipo por dia.
create table public.engagement_marks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('share', 'ranking_opened')),
  day date not null,
  activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);

alter table public.mission_defs enable row level security;
alter table public.user_missions enable row level security;
alter table public.engagement_marks enable row level security;
revoke all on public.mission_defs, public.user_missions, public.engagement_marks from anon, authenticated;
grant select on public.mission_defs, public.user_missions, public.engagement_marks to authenticated;
create policy mission_defs_read on public.mission_defs for select to authenticated using (active);
create policy user_missions_select on public.user_missions for select to authenticated using (user_id = (select auth.uid()));
create policy engagement_marks_select on public.engagement_marks for select to authenticated using (user_id = (select auth.uid()));
create policy user_missions_active_account on public.user_missions as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy engagement_marks_active_account on public.engagement_marks as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

insert into public.mission_defs (id, kind, tier, requires, metric, target, target_rule, min_meters, reward_xp, title,
                                 fallback_when, fallback_metric, fallback_target, fallback_title, bonus, step, sort) values
  -- diárias (20/30/40 XP)
  ('d-mover-15', 'diaria', 'leve', null, 'moving_seconds', 900, 'fixed', null, 20, 'Mova-se 15 min (caminhar vale)', null, null, null, null, null, null, 1),
  ('d-1500m', 'diaria', 'leve', null, 'meters', 1500, 'fixed', null, 20, 'Caminhe ou corra 1,5 km', null, null, null, null, null, null, 2),
  ('d-neblina-5', 'diaria', 'leve', null, 'new_fog_cells', 5, 'fixed', null, 20, 'Revele 5 trechos novos do Atlas', null, null, null, null, null, null, 3),
  ('d-km', 'diaria', 'padrao', null, 'meters', null, 'daily_km', null, 30, 'Corra {x} km hoje', null, null, null, null, null, null, 4),
  ('d-pintar-3', 'diaria', 'padrao', null, 'zones_painted', 3, 'fixed', null, 30, 'Pinte 3 zonas com a cor do time', null, null, null, null, null, null, 5),
  ('d-caca-2', 'diaria', 'padrao', null, 'chests_opened', 2, 'fixed', null, 30, 'Abra 2 baús na Caça', null, null, null, null, null, null, 6),
  ('d-fantasma', 'diaria', 'padrao', null, 'ghost_wins', 1, 'fixed', null, 30, 'Termine à frente do fantasma', null, null, null, null, null, null, 7),
  ('d-conquistar', 'diaria', 'desafio', null, 'zones_conquered', 1, 'fixed', null, 40, 'Conquiste uma zona', null, null, null, null, null, null, 8),
  ('d-defender', 'diaria', 'desafio', 'zone_under_attack', 'zones_defended', 1, 'fixed', null, 40, 'Defenda uma zona sob ataque', null, null, null, null, null, null, 9),
  ('d-crew', 'diaria', 'desafio', 'crew', 'crew_runs', 1, 'fixed', null, 40, 'Corra junto com alguém da crew', null, null, null, null, null, null, 10),
  ('d-neblina-20', 'diaria', 'desafio', null, 'new_fog_cells', 20, 'fixed', null, 40, 'Revele 20 trechos novos da cidade', null, null, null, null, null, null, 11),
  -- semanais (100/150/200 XP; segunda 00:00 a domingo 23:59 de Brasília)
  ('s-2-atividades', 'semanal', 'leve', null, 'runs', 2, 'fixed', null, 100, 'Faça 2 atividades na semana', null, null, null, null, null, null, 12),
  ('s-60-min', 'semanal', 'leve', null, 'moving_seconds', 3600, 'fixed', null, 100, 'Some 60 minutos de movimento', null, null, null, null, null, null, 13),
  ('s-km', 'semanal', 'padrao', null, 'meters', null, 'weekly_km', null, 150, 'Some {x} km na semana', null, null, null, null, null, null, 14),
  ('s-pintar-10', 'semanal', 'padrao', null, 'zones_painted', 10, 'fixed', null, 150, 'Pinte 10 zonas diferentes', null, null, null, null, null, null, 15),
  ('s-bairros-2', 'semanal', 'padrao', null, 'districts', 2, 'fixed', null, 150, 'Corra em 2 bairros diferentes', null, null, null, null, null, null, 16),
  ('s-conquistar-3', 'semanal', 'desafio', null, 'zones_conquered', 3, 'fixed', null, 200, 'Conquiste 3 zonas na semana', null, null, null, null, null, null, 17),
  ('s-chefao', 'semanal', 'desafio', 'raid', 'raid_damage_m', null, 'raid_km', null, 200, 'Cause {x} km de dano no chefão', null, null, null, null, null, null, 18),
  ('s-crew-2', 'semanal', 'desafio', 'crew', 'crew_runs', 2, 'fixed', null, 200, 'Corra 2 vezes com a sua crew', null, null, null, null, null, null, 19),
  -- primeira semana: um passo por dia depois do anterior; nunca expira (400 XP no total)
  ('f1-dominio', 'ftue', 'leve', null, 'painted_runs', 1, 'fixed', 500, 100, 'Corra 500 m e pinte sua 1ª zona', null, null, null, null,
   '{"dailyChest": "raro"}', 1, 20),
  ('f2-caca', 'ftue', 'leve', null, 'chests_opened', 1, 'fixed', null, 40, 'Abra seu primeiro baú na Caça', null, null, null, null, null, 2, 21),
  ('f3-fuga', 'ftue', 'leve', null, 'ghost_wins', 1, 'fixed', 1000, 40, 'Vença o fantasma em 1 km', null, null, null, null, null, 3, 22),
  ('f4-raid', 'ftue', 'leve', null, 'raid_damage_m', 1000, 'fixed', null, 40, 'Cause 1 km de dano no chefão',
   'no_raid', 'new_fog_cells', 10, 'Revele 10 trechos do Atlas', null, 4, 23),
  ('f5-crew', 'ftue', 'leve', null, 'crew_member', 1, 'fixed', null, 60, 'Entre numa crew ou crie a sua', null, null, null, null, null, 5, 24),
  ('f6-liga', 'ftue', 'leve', null, 'league_points', 1, 'fixed', null, 60, 'Some seus primeiros pontos na liga',
   'no_league', 'ranking_opened', 1, 'Veja o ranking do seu time', null, 6, 25),
  ('f7-compartilhar', 'ftue', 'leve', null, 'shares', 1, 'fixed', null, 60, 'Compartilhe o card de uma corrida', null, null, null, null,
   '{"cosmetic": "moldura-primeira-semana"}', 7, 26),
  -- volta depois de 7, 14 e 30 dias sem atividade (step = dias)
  ('v-7', 'volta', 'leve', null, 'moving_seconds', 600, 'fixed', null, 50, 'Volta leve: 10 minutos já contam', null, null, null, null,
   '{"dailyChest": "raro"}', 7, 27),
  ('v-14', 'volta', 'leve', null, 'meters', 1000, 'fixed', null, 60, 'Caminhe 1 km no seu ritmo', null, null, null, null,
   '{"dailyChest": "raro"}', 14, 28),
  ('v-30', 'volta', 'leve', null, 'moving_seconds', 600, 'fixed', null, 80, 'Recomece: 10 minutos, sem pressa', null, null, null, null,
   '{"dailyChest": "lendario", "streakRestart": true}', 30, 29);

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
-- Chaves de período em Brasília: [dia, semana ISO].
create or replace function private.mission_periods(p_at timestamptz) returns text[]
language sql stable set search_path = '' as $$
  select array[(p_at at time zone 'America/Sao_Paulo')::date::text, to_char(p_at at time zone 'America/Sao_Paulo', 'IYYY-"W"IW')]
$$;
revoke all on function private.mission_periods(timestamptz) from public, anon, authenticated;

-- formatMissionKm: 8000 → "8", 8500 → "8,5"
create or replace function private.km_text(p_meters integer) returns text
language sql immutable set search_path = '' as $$
  select replace(rtrim(rtrim(to_char(round(p_meters / 100.0) / 10.0, 'FM99990.0'), '0'), '.'), '.', ',')
$$;
revoke all on function private.km_text(integer) from public, anon, authenticated;

-- Missão possível para a pessoa agora? (zona do time sob ataque: na cidade natal; o servidor não guarda a posição)
create or replace function private.mission_eligible(p_user uuid, p_requires text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_requires
    when 'crew' then exists (select 1 from public.crew_members cm where cm.user_id = p_user)
    when 'raid' then private.feature_on('raid') and exists (select 1 from public.raids r where r.status = 'active')
    when 'zone_under_attack' then exists (select 1 from public.zones z join public.profiles pr on pr.id = p_user
                                           where z.owner = pr.faction and z.attacker is not null
                                             and (pr.city is null or z.city = pr.city))
    else true end
$$;
revoke all on function private.mission_eligible(uuid, text) from public, anon, authenticated;

-- Alvos adaptativos (mesmos números de dailyKmTarget / weeklyKmTarget / raidKmTarget), em metros.
create or replace function private.mission_target(p_user uuid, p_rule text, p_default integer, p_at timestamptz) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_week date := date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date;
  v_median numeric;
  v_max numeric;
  v_km numeric;
begin
  if p_rule = 'daily_km' then
    -- mediana das últimas 10 atividades (> 0 m), arredondada a 0,5 km, entre 2 e 8 km
    select percentile_cont(0.5) within group (order by m) into v_median
      from (select a.meters as m from public.activities a
             where a.user_id = p_user and a.scored and a.meters > 0 and coalesce(a.ended_at, a.finished_at) < p_at
             order by coalesce(a.ended_at, a.finished_at) desc limit 10) x;
    if v_median is null then return 2000; end if;
    return (least(8, greatest(2, round(v_median / 1000 * 2) / 2)) * 1000)::integer;
  elsif p_rule in ('weekly_km', 'raid_km') then
    -- 90 % da mediana das 4 semanas anteriores (semana zerada conta), até +10 % da maior; 0,5 km; 6 a 40 km
    select percentile_cont(0.5) within group (order by m), max(m) into v_median, v_max from (
      select coalesce(sum(a.meters), 0) as m
        from generate_series(1, 4) g
        left join public.activities a
          on a.user_id = p_user and a.scored
         and coalesce(a.ended_at, a.finished_at) >= ((v_week - 7 * g) + time '00:00') at time zone 'America/Sao_Paulo'
         and coalesce(a.ended_at, a.finished_at) < ((v_week - 7 * (g - 1)) + time '00:00') at time zone 'America/Sao_Paulo'
       group by g) s;
    v_km := least(40, greatest(6, round(least(v_median * 0.9, v_max * 1.1) / 1000 * 2) / 2));
    if p_rule = 'raid_km' then
      -- metade do alvo semanal, 0,5 km, entre 1 e 15 km
      return (least(15, greatest(1, round(v_km * 0.5 * 2) / 2)) * 1000)::integer;
    end if;
    return (v_km * 1000)::integer;
  end if;
  return p_default;
end $$;
revoke all on function private.mission_target(uuid, text, integer, timestamptz) from public, anon, authenticated;

-- Atribui uma missão com meta, título e versão finais (alternativa sem raid ou sem liga, como ftueAssignment).
create or replace function private.assign_mission(p_user uuid, p_def text, p_period text, p_slot integer,
                                                  p_from timestamptz, p_at timestamptz default now()) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d public.mission_defs;
  v_fallback boolean;
  v_target integer;
  v_id uuid;
begin
  select * into d from public.mission_defs where id = p_def;
  v_fallback := (d.fallback_when = 'no_raid' and not private.mission_eligible(p_user, 'raid'))
             or (d.fallback_when = 'no_league' and not private.feature_on('league'));
  v_target := case when v_fallback then d.fallback_target
                   when d.target_rule = 'fixed' then d.target
                   else private.mission_target(p_user, d.target_rule, d.target, p_at) end;
  insert into public.user_missions (user_id, def_id, kind, period_key, slot, variant, metric, target, xp, title, available_from)
  values (p_user, d.id, d.kind, p_period, p_slot, case when v_fallback then 'fallback' else 'base' end,
          case when v_fallback then d.fallback_metric else d.metric end, v_target, d.reward_xp,
          replace(case when v_fallback then d.fallback_title else d.title end, '{x}', private.km_text(v_target)), p_from)
  on conflict do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function private.assign_mission(uuid, text, text, integer, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function private.mission_json(um public.user_missions) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', um.id, 'defId', um.def_id, 'kind', um.kind, 'tier', d.tier, 'slot', um.slot, 'variant', um.variant,
    'title', um.title, 'metric', um.metric, 'progress', um.progress, 'target', um.target, 'xp', um.xp, 'bonus', d.bonus,
    'periodKey', um.period_key, 'availableFrom', private.ts_to_ms(um.available_from),
    'availableUntil', private.ts_to_ms(case um.kind
                        when 'diaria' then ((um.period_key::date + 1) + time '00:00') at time zone 'America/Sao_Paulo'
                        when 'semanal' then ((date_trunc('week', um.available_from at time zone 'America/Sao_Paulo')::date + 7)
                                             + time '00:00') at time zone 'America/Sao_Paulo' end),
    'completedAt', private.ts_to_ms(um.completed_at), 'claimedAt', private.ts_to_ms(um.claimed_at),
    'rerolled', um.rerolled_at is not null)
    from public.mission_defs d where d.id = um.def_id
$$;
revoke all on function private.mission_json(public.user_missions) from public, anon, authenticated;

-- settleMission no servidor: progresso absoluto (greatest, nunca passa da meta); conclui uma vez e paga na hora
-- (claimed_at = completed_at): XP pelo livro (mission/ftue/comeback, ref = id da atribuição), baú bônus, cosmético e
-- "sequência recomeça com 1 semana" (v-30). Devolve a missão quando concluiu agora; senão null.
create or replace function private.settle_mission(p_id uuid, p_progress integer, p_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  um public.user_missions;
  d public.mission_defs;
begin
  select * into um from public.user_missions where id = p_id for update;
  if um.id is null or um.completed_at is not null then
    return null;
  end if;
  update public.user_missions
     set progress = least(target, greatest(progress, coalesce(p_progress, 0))),
         completed_at = case when least(target, greatest(progress, coalesce(p_progress, 0))) >= target then p_at end,
         claimed_at = case when least(target, greatest(progress, coalesce(p_progress, 0))) >= target then p_at end
   where id = um.id
  returning * into um;
  if um.completed_at is null then
    return null;
  end if;
  select * into d from public.mission_defs where id = um.def_id;
  perform private.grant_xp(um.user_id, case um.kind when 'ftue' then 'ftue' when 'volta' then 'comeback' else 'mission' end,
                           um.id::text, um.xp);
  if d.bonus ? 'dailyChest' then
    perform private.add_bonus_chest(um.user_id, d.bonus ->> 'dailyChest', 'mission', um.id::text);
  end if;
  if d.bonus ? 'cosmetic' then
    perform private.grant_cosmetic(um.user_id, d.bonus ->> 'cosmetic', '', 'mission:' || um.id);
  end if;
  if coalesce((d.bonus ->> 'streakRestart')::boolean, false) then
    update public.profiles set streak_weeks = greatest(streak_weeks, 1),
                               best_streak_weeks = greatest(best_streak_weeks, 1) where id = um.user_id;
  end if;
  return private.mission_json(um);
end $$;
revoke all on function private.settle_mission(uuid, integer, timestamptz) from public, anon, authenticated;

-- Entrada da gravação v2 (onda 2): { "<user_missions.id>": progresso absoluto do domain, ... }. Só mexe nas atribuições
-- da própria pessoa. Devolve as concluídas agora.
create or replace function private.advance_missions(p_user uuid, p_progress jsonb, p_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  v jsonb;
  v_done jsonb := '[]'::jsonb;
begin
  if p_progress is null or jsonb_typeof(p_progress) <> 'object' then
    return v_done;
  end if;
  for k, v in select e.key, e.value from jsonb_each(p_progress) e
               where e.key ~ '^[0-9a-f-]{36}$' and jsonb_typeof(e.value) = 'number' order by e.key loop
    if exists (select 1 from public.user_missions um where um.id = k::uuid and um.user_id = p_user) then
      v := private.settle_mission(k::uuid, floor((v #>> '{}')::numeric)::integer, p_at);
      if v is not null then
        v_done := v_done || v;
      end if;
    end if;
  end loop;
  return v_done;
end $$;
revoke all on function private.advance_missions(uuid, jsonb, timestamptz) from public, anon, authenticated;

-- Métricas de estado que o próprio servidor confere (não dependem de correr): crew, pontos da liga da semana,
-- compartilhamentos e ranking aberto dentro da janela da atribuição.
create or replace function private.settle_state_missions(p_user uuid, p_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  um public.user_missions;
  v integer;
  r jsonb;
  v_done jsonb := '[]'::jsonb;
begin
  for um in select * from public.user_missions x
             where x.user_id = p_user and x.completed_at is null
               and x.metric in ('crew_member', 'league_points', 'shares', 'ranking_opened') loop
    v := case um.metric
      when 'crew_member' then (exists (select 1 from public.crew_members cm where cm.user_id = p_user))::integer
      when 'league_points' then (exists (select 1 from public.league_members lm where lm.user_id = p_user and lm.points > 0
                                            and lm.week_start = date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date))::integer
      when 'shares' then (select count(*) from public.engagement_marks m where m.user_id = p_user and m.kind = 'share'
                             and m.created_at >= um.available_from)::integer
      when 'ranking_opened' then (exists (select 1 from public.engagement_marks m where m.user_id = p_user and m.kind = 'ranking_opened'
                                             and m.created_at >= um.available_from))::integer
    end;
    if v > 0 then
      r := private.settle_mission(um.id, v, p_at);
      if r is not null then
        v_done := v_done || r;
      end if;
    end if;
  end loop;
  return v_done;
end $$;
revoke all on function private.settle_state_missions(uuid, timestamptz) from public, anon, authenticated;

-- Garante as missões do momento: sorteio diário e semanal, passo da primeira semana e missão de volta.
-- p_exclude: a atividade que está sendo gravada (a gravação v2 chama antes de contá-la, para criar a missão de volta).
create or replace function private.ensure_missions(p_user uuid, p_at timestamptz default now(), p_exclude uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_keys text[] := private.mission_periods(p_at);
  v_today date := (p_at at time zone 'America/Sao_Paulo')::date;
  v_tier text;
  v_cad text;
  v_key text;
  v_from timestamptz;
  v_def text;
  v_slot integer;
  v_last public.user_missions;
  v_ftue timestamptz;
  v_last_run timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('missions:' || p_user, 0));
  -- diárias e semanais: slot 0 leve, 1 padrão, 2 desafio
  foreach v_cad in array array['diaria', 'semanal'] loop
    v_key := case v_cad when 'diaria' then v_keys[1] else v_keys[2] end;
    v_from := case v_cad when 'diaria' then (v_today + time '00:00') at time zone 'America/Sao_Paulo'
                         else (date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date + time '00:00')
                              at time zone 'America/Sao_Paulo' end;
    v_slot := -1;
    foreach v_tier in array array['leve', 'padrao', 'desafio'] loop
      v_slot := v_slot + 1;
      continue when exists (select 1 from public.user_missions um where um.user_id = p_user and um.period_key = v_key
                                                                     and um.slot = v_slot);
      select d.id into v_def from public.mission_defs d
       where d.active and d.kind = v_cad and d.tier = v_tier and private.mission_eligible(p_user, d.requires)
       order by md5(p_user::text || '|' || v_key || '|' || d.id) limit 1;
      if v_def is not null then
        perform private.assign_mission(p_user, v_def, v_key, v_slot, v_from, p_at);
      end if;
    end loop;
  end loop;

  -- primeira semana (ftueSteps): passo 1 na criação; o passo k+1 abre às 00:00 do dia seguinte à conclusão do k
  select pr.ftue_started_at into v_ftue from public.profiles pr where pr.id = p_user;
  if v_ftue is not null then
    select * into v_last from public.user_missions um where um.user_id = p_user and um.period_key = 'ftue'
     order by um.slot desc limit 1;
    if v_last.id is null then
      perform private.assign_mission(p_user, (select d.id from public.mission_defs d where d.kind = 'ftue' and d.active
                                               order by d.step limit 1), 'ftue', 1, v_ftue, p_at);
    elsif v_last.completed_at is not null and (v_last.completed_at at time zone 'America/Sao_Paulo')::date < v_today then
      select d.id into v_def from public.mission_defs d
       where d.kind = 'ftue' and d.active and d.step > v_last.slot order by d.step limit 1;
      if v_def is not null then
        perform private.assign_mission(p_user, v_def, 'ftue', v_last.slot + 1,
                                       (((v_last.completed_at at time zone 'America/Sao_Paulo')::date + 1) + time '00:00')
                                         at time zone 'America/Sao_Paulo', p_at);
      end if;
    end if;
  end if;

  -- volta (comebackAssignment): 7, 14 ou 30 dias sem atividade pontuada; uma por ausência
  select max(coalesce(a.ended_at, a.finished_at)) into v_last_run
    from public.activities a where a.user_id = p_user and a.scored and a.id is distinct from p_exclude
     and coalesce(a.ended_at, a.finished_at) < p_at;
  if v_last_run is not null
     and not exists (select 1 from public.user_missions um where um.user_id = p_user and um.kind = 'volta'
                                                              and um.created_at > v_last_run) then
    select d.id into v_def from public.mission_defs d
     where d.kind = 'volta' and d.active and d.step <= v_today - (v_last_run at time zone 'America/Sao_Paulo')::date
     order by d.step desc limit 1;
    if v_def is not null then
      perform private.assign_mission(p_user, v_def, 'volta-' || v_today, 0, p_at, p_at);
    end if;
  end if;

  perform private.settle_state_missions(p_user, p_at);
end $$;
revoke all on function private.ensure_missions(uuid, timestamptz, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs do app
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
                        where um.user_id = v_uid and um.period_key = v_keys[1]), '[]'::jsonb),
    'weekly', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                         where um.user_id = v_uid and um.period_key = v_keys[2]), '[]'::jsonb),
    'ftue', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                       where um.user_id = v_uid and um.period_key = 'ftue'), '[]'::jsonb),
    'ftueStartedAt', (select private.ts_to_ms(pr.ftue_started_at) from public.profiles pr where pr.id = v_uid),
    'comeback', (select private.mission_json(um) from public.user_missions um
                  where um.user_id = v_uid and um.kind = 'volta' and um.completed_at is null
                  order by um.created_at desc limit 1),
    'rerollsLeft', greatest(0, private.param_num('missions', 'rerollsPerDay', 1)::integer
                               - (select count(*) from public.user_missions um where um.user_id = v_uid
                                     and um.rerolled_at >= public.br_day_start())::integer));
end $$;
revoke all on function public.my_missions() from public, anon;
grant execute on function public.my_missions() to authenticated;

-- Troca 1 missão diária por dia, por outra do mesmo nível, possível e ainda não sorteada hoje; mesmo slot, progresso 0.
create or replace function public.reroll_mission(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  um public.user_missions;
  d public.mission_defs;
  v_target integer;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('missions') then
    raise exception 'FEATURE_DISABLED: missões ainda não estão ligadas' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('missions:' || v_uid, 0));
  select * into um from public.user_missions where id = p_id and user_id = v_uid for update;
  if um.id is null then
    raise exception 'NOT_FOUND: missão não encontrada' using errcode = 'P0001';
  end if;
  if um.kind <> 'diaria' or um.period_key <> public.br_today()::text then
    raise exception 'MISSION_NOT_REROLLABLE: só dá para trocar uma missão diária de hoje' using errcode = 'P0001';
  end if;
  if um.completed_at is not null then
    raise exception 'MISSION_COMPLETED: missão já concluída' using errcode = 'P0001';
  end if;
  if (select count(*) from public.user_missions x where x.user_id = v_uid and x.rerolled_at >= public.br_day_start())
     >= private.param_num('missions', 'rerollsPerDay', 1) then
    raise exception 'MISSION_REROLL_LIMIT: você já trocou uma missão hoje' using errcode = 'P0001';
  end if;
  select x.* into d from public.mission_defs x
   where x.active and x.kind = 'diaria' and x.tier = (select y.tier from public.mission_defs y where y.id = um.def_id)
     and private.mission_eligible(v_uid, x.requires)
     and not exists (select 1 from public.user_missions z where z.user_id = v_uid and z.period_key = um.period_key and z.def_id = x.id)
   order by md5(v_uid::text || '|' || um.period_key || '|troca|' || um.slot || '|' || x.id) limit 1;
  if d.id is null then
    raise exception 'MISSION_NO_OPTION: não há outra missão desse nível hoje' using errcode = 'P0001';
  end if;
  v_target := case when d.target_rule = 'fixed' then d.target else private.mission_target(v_uid, d.target_rule, d.target, now()) end;
  update public.user_missions
     set def_id = d.id, metric = d.metric, target = v_target, xp = d.reward_xp, variant = 'base', progress = 0,
         title = replace(d.title, '{x}', private.km_text(v_target)), rerolled_at = now()
   where id = um.id
  returning * into um;
  return private.mission_json(um);
end $$;
revoke all on function public.reroll_mission(uuid) from public, anon;
grant execute on function public.reroll_mission(uuid) to authenticated;

-- Resgate: idempotente. A conclusão já paga (settle_mission); aqui só devolve alreadyClaimed.
create or replace function public.claim_mission(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  um public.user_missions;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into um from public.user_missions where id = p_id and user_id = v_uid;
  if um.id is null then
    raise exception 'NOT_FOUND: missão não encontrada' using errcode = 'P0001';
  end if;
  if um.completed_at is null then
    raise exception 'MISSION_NOT_COMPLETED: missão ainda não concluída' using errcode = 'P0001';
  end if;
  return jsonb_build_object('id', um.id, 'claimed', false, 'alreadyClaimed', true, 'xp', um.xp,
                            'claimedAt', private.ts_to_ms(um.claimed_at));
end $$;
revoke all on function public.claim_mission(uuid) from public, anon;
grant execute on function public.claim_mission(uuid) to authenticated;

-- Passo 7 da primeira semana: o app avisa depois que o share sheet concluiu (declarado; 1 crédito por dia).
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
  insert into public.engagement_marks (user_id, kind, day, activity_id) values (v_uid, 'share', public.br_today(), p_activity)
  on conflict do nothing;
  if not private.feature_on('missions') then
    return jsonb_build_object('completed', '[]'::jsonb);
  end if;
  return jsonb_build_object('completed', private.settle_state_missions(v_uid, now()));
end $$;
revoke all on function public.record_share(uuid) from public, anon;
grant execute on function public.record_share(uuid) to authenticated;

-- Alternativa do passo 6 sem liga real: "Veja o ranking do seu time" (o app avisa ao abrir o ranking; 1 por dia).
create or replace function public.record_ranking_opened() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  insert into public.engagement_marks (user_id, kind, day) values (v_uid, 'ranking_opened', public.br_today()) on conflict do nothing;
  if not private.feature_on('missions') then
    return jsonb_build_object('completed', '[]'::jsonb);
  end if;
  return jsonb_build_object('completed', private.settle_state_missions(v_uid, now()));
end $$;
revoke all on function public.record_ranking_opened() from public, anon;
grant execute on function public.record_ranking_opened() to authenticated;

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

-- Medalha da temporada pelo degrau alcançado (seasonTrackStep: 8 bronze, 16 prata, 24 ouro). Idempotente.
create or replace function private.award_season_medal(p_user uuid, p_season text, p_step integer) returns jsonb
language sql security definer set search_path = '' as $$
  select case when p_step >= 24 then private.award_medal(p_user, 'temporada', 'ouro', p_season, null)
              when p_step >= 16 then private.award_medal(p_user, 'temporada', 'prata', p_season, null)
              when p_step >= 8 then private.award_medal(p_user, 'temporada', 'bronze', p_season, null) end
$$;
revoke all on function private.award_season_medal(uuid, text, integer) from public, anon, authenticated;

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
  perform private.award_season_medal(v_uid, v_season, v_step);
  return jsonb_build_object(
    'seasonId', v_season,
    'endsAt', private.ts_to_ms(public.season_start(to_char(public.season_start(v_season) at time zone 'America/Sao_Paulo'
                                                           + interval '1 month', 'YYYY-MM'))),
    'xp', v_xp, 'step', v_step, 'stepXp', v_step_xp, 'steps', v_steps,
    'intoStep', case when v_step < v_steps then v_xp - v_step * v_step_xp else 0 end,
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
        perform private.grant_xp(v_uid, 'season_step', v_season || ':' || p_step, r.amount);
      when 'chest' then
        perform private.add_bonus_chest(v_uid, r.rarity, 'track', v_season || ':' || p_step);
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
