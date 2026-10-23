-- NOMADE RUN — F1/E9: RASCUNHO do esquema v2 (NÃO é migration; não copie sem revisar na F3).
-- Serve para provar, no banco local (banco-local.sh com NR_EXTRA_SQL), que o desenho de 09-backend.md aplica
-- por cima das 10 migrations atuais, respeita o padrão de RLS/grants do projeto e não quebra as RPCs antigas.
-- Na F3 cada bloco vira uma migration própria (ver 09-backend.md §6), com os números vindos do domain.
-- Os números abaixo (tetos, recompensas, fases) são PROVISÓRIOS: E3/E7 decidem na F2.

-- ===========================================================================
-- 0. Config do jogo e versão do contrato (liga/desliga sem deploy = plano de volta atrás)
-- ===========================================================================
create table public.game_config (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.game_config enable row level security;
revoke all on public.game_config from anon, authenticated;
grant select on public.game_config to authenticated;
create policy game_config_read on public.game_config for select to authenticated using (true);
insert into public.game_config (key, value) values
  ('territory_rule', '"v1"'),
  ('features', '{"raid": false, "league": false, "missions": false, "feed": false, "records": false, "dailyChest": false, "telemetry": false}');

-- Sem security definer: lê game_config pela RLS (authenticated). App novo + servidor antigo: a RPC não existe
-- (PGRST202) e o app assume contrato 1.
create or replace function public.server_info() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'contract', 2,
    'territoryRule', coalesce((select g.value #>> '{}' from public.game_config g where g.key = 'territory_rule'), 'v1'),
    'features', coalesce((select g.value from public.game_config g where g.key = 'features'), '{}'::jsonb),
    'serverTime', (extract(epoch from now()) * 1000)::bigint,
    'brToday', public.br_today())
$$;
revoke all on function public.server_info() from public, anon;
grant execute on function public.server_info() to authenticated;

create or replace function private.feature_on(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (g.value ->> p_name)::boolean from public.game_config g where g.key = 'features'), false)
$$;
revoke all on function private.feature_on(text) from public, anon, authenticated;

-- ===========================================================================
-- 1. Livro de XP: toda recompensa passa aqui (idempotência por fonte + referência)
-- ===========================================================================
create table public.xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('run', 'mission', 'medal', 'raid', 'league', 'daily_chest', 'track')),
  ref text not null check (char_length(ref) between 1 and 120),
  amount integer not null check (amount between 0 and 5000),
  created_at timestamptz not null default now(),
  unique (user_id, source, ref)
);
create index xp_ledger_user_idx on public.xp_ledger (user_id, created_at desc);
alter table public.xp_ledger enable row level security;
revoke all on public.xp_ledger from anon, authenticated;
grant select on public.xp_ledger to authenticated;
create policy xp_ledger_select on public.xp_ledger for select to authenticated using (user_id = (select auth.uid()));
create policy xp_ledger_active_account on public.xp_ledger as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

create or replace function private.grant_xp(p_user uuid, p_source text, p_ref text, p_amount integer) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_amount <= 0 then return false; end if;
  insert into public.xp_ledger (user_id, source, ref, amount) values (p_user, p_source, p_ref, p_amount)
  on conflict (user_id, source, ref) do nothing;
  if not found then return false; end if;
  update public.profiles set xp = xp + p_amount where id = p_user;
  return true;
end $$;
revoke all on function private.grant_xp(uuid, text, text, integer) from public, anon, authenticated;

-- ===========================================================================
-- 2. Raid real (chefão global, vida em metros, fases 100/66/33 %, 48 h)
-- ===========================================================================
create table public.raid_bosses (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 40),
  art_key text not null check (char_length(art_key) between 2 and 40),
  is_demo boolean not null default false
);
create table public.raids (
  id uuid primary key default gen_random_uuid(),
  boss_id text not null references public.raid_bosses (id),
  scope text not null default 'global' check (scope in ('global', 'city')),
  city text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hp_m bigint not null check (hp_m > 0),
  damage_m bigint not null default 0 check (damage_m >= 0),
  status text not null default 'active' check (status in ('active', 'defeated', 'expired')),
  defeated_at timestamptz,
  rewarded_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((scope = 'global' and city is null) or (scope = 'city' and city is not null))
);
create unique index raids_one_active_key on public.raids ((coalesce(city, ''))) where status = 'active';
create index raids_status_ends_idx on public.raids (status, ends_at);

create table public.raid_hits (
  raid_id uuid not null references public.raids (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  faction text not null check (faction in ('striders', 'coyotes', 'owls', 'volt')),
  crew_id uuid references public.crews (id) on delete set null,
  damage_m integer not null check (damage_m > 0),
  created_at timestamptz not null default now(),
  primary key (raid_id, activity_id)
);
create index raid_hits_raid_user_idx on public.raid_hits (raid_id, user_id);
create index raid_hits_user_idx on public.raid_hits (user_id, created_at desc);

create table public.raid_rewards (
  raid_id uuid not null references public.raids (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier text not null check (tier in ('participante', 'top10', 'mvp')),
  xp integer not null check (xp >= 0),
  granted_at timestamptz not null default now(),
  primary key (raid_id, user_id)
);

alter table public.raid_bosses enable row level security;
alter table public.raids enable row level security;
alter table public.raid_hits enable row level security;
alter table public.raid_rewards enable row level security;
revoke all on public.raid_bosses, public.raids, public.raid_hits, public.raid_rewards from anon, authenticated;
grant select on public.raid_bosses, public.raids, public.raid_hits, public.raid_rewards to authenticated;
create policy raid_bosses_read on public.raid_bosses for select to authenticated using (true);
create policy raids_read on public.raids for select to authenticated using (true);
create policy raid_hits_select_own on public.raid_hits for select to authenticated using (user_id = (select auth.uid()));
create policy raid_rewards_select_own on public.raid_rewards for select to authenticated using (user_id = (select auth.uid()));
create policy raid_hits_active_account on public.raid_hits as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy raid_rewards_active_account on public.raid_rewards as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
-- vida global ao vivo: só números públicos (sem dado pessoal)
alter publication supabase_realtime add table public.raids;

create or replace function private.raid_phase(p_damage bigint, p_hp bigint) returns smallint
language sql immutable set search_path = '' as $$
  select case when p_damage >= p_hp then 4
              when p_damage::numeric / p_hp >= 0.67 then 3
              when p_damage::numeric / p_hp >= 0.34 then 2
              else 1 end::smallint
$$;

-- Dano de uma corrida aceita (chamada dentro da gravação do resultado). Idempotente por (raid, corrida).
-- Tetos PROVISÓRIOS: 21 km por corrida, 30 km por pessoa por dia de Brasília.
create or replace function private.apply_raid_damage(p_activity uuid, p_damage_m integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.activities;
  r public.raids;
  v_today bigint;
  v_dmg integer;
  v_before smallint;
  v_after public.raids;
begin
  select * into a from public.activities where id = p_activity;
  if a.id is null or not a.scored or p_damage_m <= 0 or not private.feature_on('raid') then
    return null;
  end if;
  select * into r from public.raids
   where status = 'active' and scope = 'global' and coalesce(a.ended_at, now()) between starts_at and ends_at
   for update;
  if r.id is null then return null; end if;
  if exists (select 1 from public.raid_hits h where h.raid_id = r.id and h.activity_id = a.id) then
    return jsonb_build_object('raidId', r.id, 'damage', (select h.damage_m from public.raid_hits h where h.raid_id = r.id and h.activity_id = a.id),
                              'phase', private.raid_phase(r.damage_m, r.hp_m), 'repeated', true);
  end if;
  select coalesce(sum(h.damage_m), 0) into v_today from public.raid_hits h
   where h.raid_id = r.id and h.user_id = a.user_id and h.created_at >= public.br_day_start();
  v_dmg := least(p_damage_m, 21000, greatest(0, 30000 - v_today))::integer;
  if v_dmg <= 0 then
    return jsonb_build_object('raidId', r.id, 'damage', 0, 'capped', true, 'phase', private.raid_phase(r.damage_m, r.hp_m));
  end if;
  insert into public.raid_hits (raid_id, activity_id, user_id, faction, crew_id, damage_m)
  select r.id, a.id, a.user_id, pr.faction, (select cm.crew_id from public.crew_members cm where cm.user_id = a.user_id), v_dmg
    from public.profiles pr where pr.id = a.user_id;
  v_before := private.raid_phase(r.damage_m, r.hp_m);
  update public.raids
     set damage_m = least(hp_m, damage_m + v_dmg),
         status = case when damage_m + v_dmg >= hp_m then 'defeated' else status end,
         defeated_at = case when damage_m + v_dmg >= hp_m then now() else defeated_at end
   where id = r.id
  returning * into v_after;
  return jsonb_build_object('raidId', r.id, 'damage', v_dmg, 'capped', v_dmg < p_damage_m,
                            'phaseBefore', v_before, 'phase', private.raid_phase(v_after.damage_m, v_after.hp_m),
                            'defeated', v_after.status = 'defeated');
end $$;
revoke all on function private.apply_raid_damage(uuid, integer) from public, anon, authenticated;

-- Tela do raid: chefão, vida, fase, prazo, meu dano, top 10 pessoas e top 5 crews (sem ids de corrida).
create or replace function public.raid_current() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  r public.raids;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into r from public.raids where status in ('active', 'defeated') order by starts_at desc limit 1;
  if r.id is null then return jsonb_build_object('raid', null); end if;
  return jsonb_build_object('raid', jsonb_build_object(
      'id', r.id, 'bossId', r.boss_id, 'boss', (select b.name from public.raid_bosses b where b.id = r.boss_id),
      'artKey', (select b.art_key from public.raid_bosses b where b.id = r.boss_id),
      'hpM', r.hp_m, 'damageM', r.damage_m, 'phase', private.raid_phase(r.damage_m, r.hp_m), 'status', r.status,
      'startsAt', private.ts_to_ms(r.starts_at), 'endsAt', private.ts_to_ms(r.ends_at), 'isDemo', r.is_demo),
    'me', jsonb_build_object('damageM', coalesce((select sum(h.damage_m) from public.raid_hits h where h.raid_id = r.id and h.user_id = v_uid), 0)),
    'topRunners', coalesce((select jsonb_agg(t order by t.damage desc) from (
        select pp.username, pp.faction, sum(h.damage_m)::bigint as damage
          from public.raid_hits h join private.public_profiles() pp on pp.id = h.user_id
         where h.raid_id = r.id group by pp.username, pp.faction order by damage desc limit 10) t), '[]'::jsonb),
    'topCrews', coalesce((select jsonb_agg(t order by t.damage desc) from (
        select pc.name, pc.tag, sum(h.damage_m)::bigint as damage
          from public.raid_hits h join private.public_crews() pc on pc.id = h.crew_id
         where h.raid_id = r.id group by pc.name, pc.tag order by damage desc limit 5) t), '[]'::jsonb));
end $$;
revoke all on function public.raid_current() from public, anon;
grant execute on function public.raid_current() to authenticated;

-- Job a cada 10 min: expira, premia (idempotente) e abre o próximo chefão (48 h).
create or replace function public.job_tick_raids() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer := 0;
  r record;
  v_boss text;
  v_active integer;
begin
  update public.raids set status = 'expired' where status = 'active' and ends_at < now();
  for r in select * from public.raids where status in ('defeated', 'expired') and rewarded_at is null for update skip locked loop
    if r.status = 'defeated' then
      insert into public.raid_rewards (raid_id, user_id, tier, xp)
      select r.id, s.user_id,
             case when s.pos = 1 then 'mvp' when s.pos <= 10 then 'top10' else 'participante' end,
             case when s.pos = 1 then 500 when s.pos <= 10 then 300 else 100 end
        from (select h.user_id, row_number() over (order by sum(h.damage_m) desc, min(h.created_at)) as pos
                from public.raid_hits h where h.raid_id = r.id group by h.user_id) s
      on conflict do nothing;
      perform private.grant_xp(rw.user_id, 'raid', r.id::text, rw.xp) from public.raid_rewards rw where rw.raid_id = r.id;
    end if;
    update public.raids set rewarded_at = now() where id = r.id;
    n := n + 1;
  end loop;
  if private.feature_on('raid') and not exists (select 1 from public.raids where status = 'active') then
    select b.id into v_boss from public.raid_bosses b where not b.is_demo
     order by md5(b.id || to_char(public.br_now(), 'IYYY-IW')) limit 1;
    if v_boss is not null then
      select count(distinct a.user_id) into v_active from public.activities a
       where a.scored and a.finished_at >= now() - interval '7 days';
      insert into public.raids (boss_id, starts_at, ends_at, hp_m)
      values (v_boss, now(), now() + interval '48 hours', greatest(50000, v_active * 8000)::bigint);
      n := n + 1;
    end if;
  end if;
  return n;
end $$;
revoke all on function public.job_tick_raids() from public, anon, authenticated;
grant execute on function public.job_tick_raids() to service_role;

-- ===========================================================================
-- 3. Missões (3 diárias + 3 semanais) com resgate idempotente
-- ===========================================================================
create table public.mission_defs (
  id text primary key check (id ~ '^[a-z0-9_]{3,40}$'),
  kind text not null check (kind in ('daily', 'weekly', 'monthly', 'ftue')),
  metric text not null check (metric in ('meters', 'runs', 'zones_conquered', 'zones_defended', 'chests_opened',
                                         'raid_damage_m', 'new_fog_cells', 'kudos_given', 'crew_runs')),
  target integer not null check (target > 0),
  reward_xp integer not null check (reward_xp between 0 and 1000),
  title text not null check (char_length(title) between 3 and 60),
  icon text not null check (char_length(icon) between 2 and 30),
  active boolean not null default true,
  is_demo boolean not null default false
);
create table public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  def_id text not null references public.mission_defs (id),
  period_key text not null check (period_key ~ '^(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}|\d{4}-\d{2}|ftue)$'),
  metric text not null,
  target integer not null check (target > 0),
  reward_xp integer not null check (reward_xp >= 0),
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, def_id, period_key),
  check (claimed_at is null or completed_at is not null)
);
create index user_missions_open_idx on public.user_missions (user_id, period_key) where claimed_at is null;
alter table public.mission_defs enable row level security;
alter table public.user_missions enable row level security;
revoke all on public.mission_defs, public.user_missions from anon, authenticated;
grant select on public.mission_defs, public.user_missions to authenticated;
create policy mission_defs_read on public.mission_defs for select to authenticated using (active);
create policy user_missions_select on public.user_missions for select to authenticated using (user_id = (select auth.uid()));
create policy user_missions_active_account on public.user_missions as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

create or replace function private.period_keys(p_at timestamptz default now()) returns text[]
language sql stable set search_path = '' as $$
  select array[(p_at at time zone 'America/Sao_Paulo')::date::text,
               to_char(p_at at time zone 'America/Sao_Paulo', 'IYYY-"W"IW'),
               to_char(p_at at time zone 'America/Sao_Paulo', 'YYYY-MM'),
               'ftue']
$$;

-- Lista (e sorteia na 1ª chamada do período) as missões do dia e da semana.
create or replace function public.my_missions() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_keys text[] := private.period_keys();
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || v_keys[1], 1));
  insert into public.user_missions (user_id, def_id, period_key, metric, target, reward_xp)
  select v_uid, d.id, case d.kind when 'daily' then v_keys[1] else v_keys[2] end, d.metric, d.target, d.reward_xp
    from (select d.*, row_number() over (partition by d.kind order by md5(v_uid::text || d.id ||
                 case d.kind when 'daily' then v_keys[1] else v_keys[2] end)) as k
            from public.mission_defs d where d.active and d.kind in ('daily', 'weekly')) d
   where d.k <= 3
  on conflict (user_id, def_id, period_key) do nothing;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', um.id, 'defId', um.def_id, 'kind', d.kind, 'title', d.title, 'icon', d.icon, 'metric', um.metric,
      'progress', um.progress, 'target', um.target, 'rewardXp', um.reward_xp,
      'completedAt', private.ts_to_ms(um.completed_at), 'claimedAt', private.ts_to_ms(um.claimed_at))
      order by d.kind, um.created_at)
    from public.user_missions um join public.mission_defs d on d.id = um.def_id
   where um.user_id = v_uid and um.period_key = any (v_keys)), '[]'::jsonb);
end $$;
revoke all on function public.my_missions() from public, anon;
grant execute on function public.my_missions() to authenticated;

-- Avança o progresso com as métricas oficiais da corrida (calculadas pelo domain no finish). Só missões já sorteadas.
create or replace function private.advance_missions(p_user uuid, p_metrics jsonb, p_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done jsonb;
begin
  with upd as (
    update public.user_missions um
       set progress = least(um.target, um.progress + greatest(0, (p_metrics ->> um.metric)::integer)),
           completed_at = case when um.completed_at is null and um.progress + (p_metrics ->> um.metric)::integer >= um.target
                               then now() else um.completed_at end
     where um.user_id = p_user and um.period_key = any (private.period_keys(p_at)) and um.completed_at is null
       and p_metrics ? um.metric and (p_metrics ->> um.metric)::integer > 0
    returning um.id, um.def_id, um.completed_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'defId', def_id)) filter (where completed_at is not null), '[]'::jsonb)
    into v_done from upd;
  return v_done;
end $$;
revoke all on function private.advance_missions(uuid, jsonb, timestamptz) from public, anon, authenticated;

create or replace function public.claim_mission(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  um public.user_missions;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into um from public.user_missions where id = p_id and user_id = v_uid for update;
  if um.id is null then raise exception 'NOT_FOUND: missão não encontrada' using errcode = 'P0001'; end if;
  if um.completed_at is null then raise exception 'MISSION_NOT_COMPLETED: missão ainda não concluída' using errcode = 'P0001'; end if;
  if um.claimed_at is not null then
    return jsonb_build_object('id', um.id, 'claimed', false, 'alreadyClaimed', true, 'xp', 0);
  end if;
  update public.user_missions set claimed_at = now() where id = um.id;
  perform private.grant_xp(v_uid, 'mission', um.id::text, um.reward_xp);
  return jsonb_build_object('id', um.id, 'claimed', true, 'alreadyClaimed', false, 'xp', um.reward_xp);
end $$;
revoke all on function public.claim_mission(uuid) from public, anon;
grant execute on function public.claim_mission(uuid) to authenticated;

-- ===========================================================================
-- 4. Liga semanal (grupos de até 30 por divisão; fecha segunda 03:20 BRT, cobrindo corridas sincronizadas atrasadas)
-- ===========================================================================
create table public.league_groups (
  id uuid primary key default gen_random_uuid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  division smallint not null check (division between 0 and 4),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index league_groups_open_idx on public.league_groups (week_start, division) where closed_at is null;
create table public.league_members (
  week_start date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.league_groups (id) on delete cascade,
  division smallint not null check (division between 0 and 4),
  points integer not null default 0 check (points >= 0),
  joined_at timestamptz not null default now(),
  final_rank smallint,
  outcome text check (outcome in ('promoted', 'stays', 'relegated')),
  primary key (week_start, user_id)
);
create index league_members_group_idx on public.league_members (group_id, points desc);
create table public.league_standings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  division smallint not null default 0 check (division between 0 and 4),
  updated_at timestamptz not null default now()
);
alter table public.league_groups enable row level security;
alter table public.league_members enable row level security;
alter table public.league_standings enable row level security;
revoke all on public.league_groups, public.league_members, public.league_standings from anon, authenticated;
grant select on public.league_standings, public.league_members to authenticated;
create policy league_standings_select on public.league_standings for select to authenticated using (user_id = (select auth.uid()));
create policy league_members_select_own on public.league_members for select to authenticated using (user_id = (select auth.uid()));
create policy league_members_active_account on public.league_members as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy league_standings_active_account on public.league_standings as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

create or replace function private.week_start(p_at timestamptz) returns date
language sql stable set search_path = '' as $$ select date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date $$;

create or replace function private.add_league_points(p_user uuid, p_points integer, p_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_week date := private.week_start(p_at);
  v_div smallint;
  v_group uuid;
begin
  if p_points <= 0 or not private.feature_on('league') then return null; end if;
  if exists (select 1 from public.league_groups g where g.week_start = v_week and g.closed_at is not null) then
    return null; -- semana já fechada: corrida sincronizada tarde demais não muda a liga
  end if;
  if not exists (select 1 from public.league_members m where m.week_start = v_week and m.user_id = p_user) then
    select coalesce((select s.division from public.league_standings s where s.user_id = p_user), 0) into v_div;
    perform pg_advisory_xact_lock(hashtextextended('league' || v_week::text || v_div::text, 0));
    select g.id into v_group from public.league_groups g
     where g.week_start = v_week and g.division = v_div and g.closed_at is null
       and (select count(*) from public.league_members m where m.group_id = g.id) < 30
     order by g.created_at limit 1;
    if v_group is null then
      insert into public.league_groups (week_start, division) values (v_week, v_div) returning id into v_group;
    end if;
    insert into public.league_members (week_start, user_id, group_id, division) values (v_week, p_user, v_group, v_div)
    on conflict do nothing;
  end if;
  update public.league_members set points = points + p_points where week_start = v_week and user_id = p_user
  returning group_id into v_group;
  return jsonb_build_object('weekStart', v_week, 'groupId', v_group, 'points', p_points);
end $$;
revoke all on function private.add_league_points(uuid, integer, timestamptz) from public, anon, authenticated;

create or replace function public.league_current() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_week date := private.week_start(now());
  m public.league_members;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into m from public.league_members where week_start = v_week and user_id = v_uid;
  return jsonb_build_object(
    'weekStart', v_week,
    'closesAt', private.ts_to_ms(((v_week + 7)::timestamp) at time zone 'America/Sao_Paulo'),
    'division', coalesce(m.division, (select s.division from public.league_standings s where s.user_id = v_uid), 0),
    'joined', m.user_id is not null,
    'members', coalesce((select jsonb_agg(jsonb_build_object('position', t.pos, 'username', t.username, 'faction', t.faction,
                                                             'avatarUrl', t.avatar_url, 'points', t.points, 'you', t.user_id = v_uid)
                                          order by t.pos)
        from (select lm.user_id, pp.username, pp.faction, pp.avatar_url, lm.points,
                     row_number() over (order by lm.points desc, lm.joined_at) as pos
                from public.league_members lm join private.public_profiles() pp on pp.id = lm.user_id
               where lm.group_id = m.group_id) t), '[]'::jsonb));
end $$;
revoke all on function public.league_current() from public, anon;
grant execute on function public.league_current() to authenticated;

-- Mesma regra de domain/games.ts leagueOutcome: 5 primeiros sobem, 5 últimos descem (pontas não passam do limite).
create or replace function public.job_close_league(p_week_start date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_week date := coalesce(p_week_start, private.week_start(now()) - 7);
  n integer := 0;
  g record;
begin
  for g in select * from public.league_groups where week_start = v_week and closed_at is null order by id for update loop
    with ranked as (
      select lm.user_id, row_number() over (order by lm.points desc, lm.joined_at) as pos,
             count(*) over () as size
        from public.league_members lm where lm.group_id = g.id
    ), outcome as (
      select r.user_id, r.pos,
             case when r.pos <= 5 and g.division < 4 then 'promoted'
                  when r.pos > r.size - 5 and g.division > 0 then 'relegated'
                  else 'stays' end as res
        from ranked r
    ), upd as (
      update public.league_members lm set final_rank = o.pos, outcome = o.res
        from outcome o where lm.group_id = g.id and lm.user_id = o.user_id
      returning lm.user_id, o.res
    )
    insert into public.league_standings (user_id, division, updated_at)
    select u.user_id, greatest(0, least(4, g.division + case u.res when 'promoted' then 1 when 'relegated' then -1 else 0 end)), now()
      from upd u
    on conflict (user_id) do update set division = excluded.division, updated_at = now();
    update public.league_groups set closed_at = now() where id = g.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.job_close_league(date) from public, anon, authenticated;
grant execute on function public.job_close_league(date) to service_role;

-- ===========================================================================
-- 5. Feed e aplausos ("Bora!") — só a crew vê; sem comentário livre
-- ===========================================================================
create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('run', 'zone_captured', 'medal', 'raid_defeated', 'league_promoted', 'level_up')),
  activity_id uuid references public.activities (id) on delete cascade,
  crew_id uuid references public.crews (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1024),
  created_at timestamptz not null default now()
);
create index feed_items_crew_idx on public.feed_items (crew_id, created_at desc);
create index feed_items_actor_idx on public.feed_items (actor_id, created_at desc);
create unique index feed_items_activity_kind_key on public.feed_items (activity_id, kind) where activity_id is not null;

create table public.kudos (
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reaction text not null default 'bora' check (reaction in ('bora', 'fogo', 'raio')),
  created_at timestamptz not null default now(),
  primary key (feed_item_id, user_id)
);
create index kudos_user_day_idx on public.kudos (user_id, created_at desc);

create or replace function private.can_see_feed_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feed_items f
                  where f.id = p_item
                    and (f.actor_id = (select auth.uid())
                         or (f.crew_id is not null and f.crew_id = (select cm.crew_id from public.crew_members cm where cm.user_id = (select auth.uid())))))
$$;
revoke all on function private.can_see_feed_item(uuid) from public, anon;
grant execute on function private.can_see_feed_item(uuid) to authenticated, service_role;

-- teto de 200 aplausos por dia (Brasília), sem aplaudir a si mesmo
create or replace function private.kudos_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.feed_items f where f.id = new.feed_item_id and f.actor_id = new.user_id) then
    raise exception 'KUDOS_SELF: não dá para aplaudir a própria corrida' using errcode = 'P0001';
  end if;
  if (select count(*) from public.kudos k where k.user_id = new.user_id and k.created_at >= public.br_day_start()) >= 200 then
    raise exception 'KUDOS_LIMIT: limite de aplausos do dia' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.kudos_rules() from public, anon, authenticated;
create trigger kudos_rules before insert on public.kudos for each row execute function private.kudos_rules();

alter table public.feed_items enable row level security;
alter table public.kudos enable row level security;
revoke all on public.feed_items, public.kudos from anon, authenticated;
grant select on public.feed_items to authenticated;
grant select, delete on public.kudos to authenticated;
grant insert (feed_item_id, reaction) on public.kudos to authenticated;
create policy feed_items_select on public.feed_items for select to authenticated using (private.can_see_feed_item(id));
create policy kudos_select on public.kudos for select to authenticated using (private.can_see_feed_item(feed_item_id));
create policy kudos_insert on public.kudos for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_see_feed_item(feed_item_id));
create policy kudos_delete on public.kudos for delete to authenticated using (user_id = (select auth.uid()));
create policy feed_items_active_account on public.feed_items as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy kudos_active_account on public.kudos as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
alter publication supabase_realtime add table public.kudos;

-- ===========================================================================
-- 6. Recordes pessoais e estatísticas da corrida (parciais por km, série de ritmo reduzida)
-- ===========================================================================
create table public.activity_stats (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  splits jsonb not null default '[]'::jsonb check (jsonb_typeof(splits) = 'array' and jsonb_array_length(splits) <= 100),
  pace_series jsonb not null default '[]'::jsonb check (jsonb_typeof(pace_series) = 'array' and jsonb_array_length(pace_series) <= 200),
  best_1k_s integer check (best_1k_s > 0),
  best_5k_s integer check (best_5k_s > 0),
  best_10k_s integer check (best_10k_s > 0),
  created_at timestamptz not null default now()
);
create index activity_stats_user_idx on public.activity_stats (user_id, created_at desc);
create table public.personal_records (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('1k', '5k', '10k', '21k', 'longest')),
  value integer not null check (value > 0),
  activity_id uuid references public.activities (id) on delete set null,
  achieved_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.activity_stats enable row level security;
alter table public.personal_records enable row level security;
revoke all on public.activity_stats, public.personal_records from anon, authenticated;
grant select on public.activity_stats, public.personal_records to authenticated;
create policy activity_stats_select on public.activity_stats for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy personal_records_select on public.personal_records for select to authenticated using (user_id = (select auth.uid()));
create policy activity_stats_active_account on public.activity_stats as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy personal_records_active_account on public.personal_records as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

-- grava um recorde só se for melhor (tempo menor; 'longest' = maior distância). Devolve o anterior quando bateu.
create or replace function private.upsert_record(p_user uuid, p_kind text, p_value integer, p_activity uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_old integer;
begin
  if p_value is null or p_value <= 0 then return null; end if;
  select value into v_old from public.personal_records where user_id = p_user and kind = p_kind for update;
  if v_old is not null and ((p_kind = 'longest' and p_value <= v_old) or (p_kind <> 'longest' and p_value >= v_old)) then
    return null;
  end if;
  insert into public.personal_records (user_id, kind, value, activity_id) values (p_user, p_kind, p_value, p_activity)
  on conflict (user_id, kind) do update set value = excluded.value, activity_id = excluded.activity_id, achieved_at = now();
  return jsonb_build_object('kind', p_kind, 'value', p_value, 'previous', v_old);
end $$;
revoke all on function private.upsert_record(uuid, text, integer, uuid) from public, anon, authenticated;

-- ===========================================================================
-- 7. Baú do dia (abre 1 vez por dia de Brasília depois de uma corrida aceita de 1 km; chances públicas)
-- ===========================================================================
create table public.daily_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  rarity text not null check (rarity in ('comum', 'raro', 'lendario')),
  xp integer not null check (xp >= 0),
  opened_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_rewards enable row level security;
revoke all on public.daily_rewards from anon, authenticated;
grant select on public.daily_rewards to authenticated;
create policy daily_rewards_select on public.daily_rewards for select to authenticated using (user_id = (select auth.uid()));
create policy daily_rewards_active_account on public.daily_rewards as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

create or replace function public.open_daily_chest() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_day date := public.br_today();
  d public.daily_rewards;
  v_rarity text;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || v_day::text, 2));
  select * into d from public.daily_rewards where user_id = v_uid and day = v_day;
  if d.user_id is not null then
    return jsonb_build_object('day', v_day, 'rarity', d.rarity, 'xp', d.xp, 'alreadyOpened', true);
  end if;
  if not exists (select 1 from public.activities a where a.user_id = v_uid and a.scored and a.meters >= 1000
                   and a.finished_at >= public.br_day_start()) then
    raise exception 'DAILY_CHEST_LOCKED: corra 1 km hoje para abrir o baú do dia' using errcode = 'P0001';
  end if;
  v_rarity := private.chest_rarity(random());
  insert into public.daily_rewards (user_id, day, rarity, xp) values (v_uid, v_day, v_rarity, private.chest_xp(v_rarity));
  perform private.grant_xp(v_uid, 'daily_chest', v_day::text, private.chest_xp(v_rarity));
  return jsonb_build_object('day', v_day, 'rarity', v_rarity, 'xp', private.chest_xp(v_rarity), 'alreadyOpened', false,
                            'odds', jsonb_build_object('comum', 0.70, 'raro', 0.25, 'lendario', 0.05));
end $$;
revoke all on function public.open_daily_chest() from public, anon;
grant execute on function public.open_daily_chest() to authenticated;

-- ===========================================================================
-- 8. Card de compartilhamento: números + rota já cortada (zonas de privacidade e 200 m das pontas)
-- ===========================================================================
create or replace function public.share_card(p_activity uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  a public.activities;
  v_line extensions.geometry;
  v_len double precision;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into a from public.activities where id = p_activity;
  if a.id is null or a.user_id <> v_uid then raise exception 'NOT_FOUND: corrida não encontrada' using errcode = 'P0001'; end if;
  select extensions.st_makeline(extensions.st_setsrid(extensions.st_makepoint(ap.lng, ap.lat), 4326) order by ap.seq)
    into v_line
    from public.activity_points ap
   where ap.activity_id = a.id and not private.in_privacy_zone(v_uid, ap.lat, ap.lng);
  if v_line is not null and extensions.st_npoints(v_line) >= 2 then
    v_len := extensions.st_length(v_line::extensions.geography);
    if v_len > 600 then
      v_line := extensions.st_linesubstring(v_line, 200 / v_len, 1 - 200 / v_len);
    else
      v_line := null; -- corrida curta demais para cortar as pontas: o card sai sem rota
    end if;
  end if;
  return jsonb_build_object(
    'activityId', a.id, 'status', a.status, 'meters', round(a.meters), 'movingSeconds', round(a.moving_seconds),
    'avgPace', a.avg_pace, 'startedAt', private.ts_to_ms(a.started_at),
    'faction', (select pr.faction from public.profiles pr where pr.id = v_uid),
    'zonesConquered', (select count(*) from public.activity_zones az where az.activity_id = a.id and az.outcome = 'conquered'),
    'raidDamageM', coalesce((select sum(h.damage_m) from public.raid_hits h where h.activity_id = a.id), 0),
    'records', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'value', r.value)) from public.personal_records r
                          where r.user_id = v_uid and r.activity_id = a.id), '[]'::jsonb),
    'route', case when v_line is null then null
                  else extensions.st_asencodedpolyline(extensions.st_simplify(v_line, 0.00003), 5) end);
end $$;
revoke all on function public.share_card(uuid) from public, anon;
grant execute on function public.share_card(uuid) to authenticated;

-- ===========================================================================
-- 9. Gravação v2: chama a v1 (inalterada) e aplica os extras na MESMA transação.
--    p.extras vem do domain no finish: { raidDamageM, missionMetrics{}, leaguePoints, stats{splits,paceSeries,best1kS,...}, longestM }
-- ===========================================================================
create or replace function public.svc_apply_activity_result_v2(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_res jsonb;
  v_act uuid := (p ->> 'activityId')::uuid;
  v_user uuid := (p ->> 'userId')::uuid;
  x jsonb := coalesce(p -> 'extras', '{}'::jsonb);
  a public.activities;
  v_extras jsonb := '{}'::jsonb;
  v_records jsonb := '[]'::jsonb;
  v_rec jsonb;
  k text;
begin
  v_res := public.svc_apply_activity_result(p);
  if v_res ? 'error' then return v_res; end if;
  select * into a from public.activities where id = v_act;
  if a.scored then
    v_extras := v_extras || jsonb_build_object('raid', private.apply_raid_damage(v_act, coalesce((x ->> 'raidDamageM')::integer, 0)));
    if private.feature_on('missions') then
      v_extras := v_extras || jsonb_build_object('missionsCompleted',
        private.advance_missions(v_user, coalesce(x -> 'missionMetrics', '{}'::jsonb), coalesce(a.ended_at, now())));
    end if;
    v_extras := v_extras || jsonb_build_object('league',
      private.add_league_points(v_user, coalesce((x ->> 'leaguePoints')::integer, 0), coalesce(a.ended_at, now())));
    if private.feature_on('records') and x ? 'stats' then
      insert into public.activity_stats (activity_id, user_id, splits, pace_series, best_1k_s, best_5k_s, best_10k_s)
      values (v_act, v_user, coalesce(x -> 'stats' -> 'splits', '[]'::jsonb), coalesce(x -> 'stats' -> 'paceSeries', '[]'::jsonb),
              (x -> 'stats' ->> 'best1kS')::integer, (x -> 'stats' ->> 'best5kS')::integer, (x -> 'stats' ->> 'best10kS')::integer)
      on conflict (activity_id) do nothing;
      if a.status = 'valid' then
        foreach k in array array['1k', '5k', '10k'] loop
          v_rec := private.upsert_record(v_user, k, (x -> 'stats' ->> ('best' || k || 'S'))::integer, v_act);
          if v_rec is not null then v_records := v_records || v_rec; end if;
        end loop;
        v_rec := private.upsert_record(v_user, 'longest', round(a.meters)::integer, v_act);
        if v_rec is not null then v_records := v_records || v_rec; end if;
      end if;
      v_extras := v_extras || jsonb_build_object('records', v_records);
    end if;
    if private.feature_on('feed') then
      insert into public.feed_items (actor_id, kind, activity_id, crew_id, payload)
      select v_user, 'run', v_act, cm.crew_id,
             jsonb_build_object('meters', round(a.meters), 'movingSeconds', round(a.moving_seconds), 'avgPace', a.avg_pace,
                                'zonesConquered', (select count(*) from public.activity_zones az where az.activity_id = v_act and az.outcome = 'conquered'))
        from (select (select c.crew_id from public.crew_members c where c.user_id = v_user) as crew_id) cm
      on conflict do nothing;
    end if;
  end if;
  -- o bloco extras entra no resultado guardado (finish repetido devolve o mesmo) e é opcional para o app antigo
  update public.activities set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('v', 2, 'extras', v_extras)
   where id = v_act;
  return v_res || jsonb_build_object('result', (v_res -> 'result') || jsonb_build_object('v', 2, 'extras', v_extras));
end $$;

-- ===========================================================================
-- 10. Notificações novas (superconjunto do CHECK; app antigo mostra como 'system') e LGPD
-- ===========================================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('invasion', 'territory_lost', 'conquest', 'moderation', 'mission', 'system',
                  'raid', 'league', 'kudos', 'medal', 'reward'));

create or replace function private.account_export_v2(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'xpLedger', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.created_at) from public.xp_ledger x where x.user_id = p_user), '[]'::jsonb),
    'raidHits', coalesce((select jsonb_agg(to_jsonb(h) - 'user_id' order by h.created_at) from public.raid_hits h where h.user_id = p_user), '[]'::jsonb),
    'raidRewards', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id') from public.raid_rewards r where r.user_id = p_user), '[]'::jsonb),
    'missions', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.created_at) from public.user_missions m where m.user_id = p_user), '[]'::jsonb),
    'league', coalesce((select jsonb_agg(to_jsonb(l) - 'user_id' order by l.week_start) from public.league_members l where l.user_id = p_user), '[]'::jsonb),
    'leagueStanding', (select to_jsonb(s) - 'user_id' from public.league_standings s where s.user_id = p_user),
    'feedItems', coalesce((select jsonb_agg(to_jsonb(f) - 'actor_id' order by f.created_at) from public.feed_items f where f.actor_id = p_user), '[]'::jsonb),
    'kudosGiven', coalesce((select jsonb_agg(to_jsonb(k) - 'user_id' order by k.created_at) from public.kudos k where k.user_id = p_user), '[]'::jsonb),
    'activityStats', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id') from public.activity_stats s where s.user_id = p_user), '[]'::jsonb),
    'personalRecords', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id') from public.personal_records r where r.user_id = p_user), '[]'::jsonb),
    'dailyRewards', coalesce((select jsonb_agg(to_jsonb(d) - 'user_id' order by d.day) from public.daily_rewards d where d.user_id = p_user), '[]'::jsonb))
$$;
revoke all on function private.account_export_v2(uuid) from public, anon, authenticated;
-- Na F3: svc_account_export passa a devolver o export antigo || private.account_export_v2(p_user)
-- (redefinida numa migration de LGPD no fim de cada onda; o teste 22_lgpd_v2 confere que toda tabela com user_id entra).

-- Só o service role executa as funções internas (mesmo laço das migrations atuais)
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'svc\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
revoke all on function private.raid_phase(bigint, bigint), private.period_keys(timestamptz), private.week_start(timestamptz)
  from public, anon;

-- Jobs (UTC; Brasília = UTC−3)
select cron.schedule('nomaderun-tick-raids', '*/10 * * * *', 'select public.job_tick_raids()');
select cron.schedule('nomaderun-close-league', '20 6 * * 1', 'select public.job_close_league()');   -- segunda 03:20 BRT
