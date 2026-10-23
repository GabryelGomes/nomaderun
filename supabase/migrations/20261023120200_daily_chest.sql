-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-66): baú do dia.
-- "Ganhe 1 baú por dia; guarde até 3; uma atividade abre todos." Chances visíveis; o 20º baú sem lendário é lendário.
-- Só XP e cosméticos; nunca vendido. O dia é o de Brasília, pelo relógio do servidor.
--   * daily_chest_state: créditos guardados (0..3), garantia (pity) e baús bônus (missões, volta, trilha);
--   * daily_rewards: cada baú aberto (histórico, LGPD);
--   * my_daily_chest(): estado para a tela (acumula os créditos dos dias que passaram);
--   * private.open_daily_chests(user, activity): abre tudo com uma atividade ≥ 1 km ou ≥ 15 min. Quem chama é a
--     gravação v2 do finish-activity (onda 2), na mesma transação do resultado oficial;
--   * private.daily_chest_roll(): sorteio puro (testável) com a garantia do lendário e a raridade mínima do bônus.

create table public.daily_chest_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stored smallint not null default 1 check (stored between 0 and 3),
  accrued_on date not null,                         -- último dia de Brasília que já gerou crédito
  pity smallint not null default 0 check (pity between 0 and 100), -- baús abertos desde o último lendário
  bonus text[] not null default '{}' check (cardinality(bonus) <= 10
                                             and bonus <@ array['comum', 'raro', 'lendario']::text[]),
  opened_on date,                                   -- último dia com abertura (1 abertura por dia)
  updated_at timestamptz not null default now()
);
comment on table public.daily_chest_state is
  'D-66: créditos do baú do dia. Conta nova começa com 1 guardado e, sem nenhuma corrida, não acumula além de 1 (E7 §7).';

create table public.daily_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  n smallint not null check (n between 1 and 13),
  kind text not null default 'dia' check (kind in ('dia', 'bonus')),
  rarity text not null check (rarity in ('comum', 'raro', 'lendario')),
  xp integer not null check (xp >= 0),
  cosmetic_id text references public.cosmetic_defs (id),
  duplicate boolean not null default false,
  pity_used boolean not null default false,
  activity_id uuid references public.activities (id) on delete set null,
  opened_at timestamptz not null default now(),
  primary key (user_id, day, n)
);
create index daily_rewards_activity_idx on public.daily_rewards (activity_id);

alter table public.daily_chest_state enable row level security;
alter table public.daily_rewards enable row level security;
revoke all on public.daily_chest_state, public.daily_rewards from anon, authenticated;
grant select on public.daily_chest_state, public.daily_rewards to authenticated;
create policy daily_chest_state_select on public.daily_chest_state for select to authenticated using (user_id = (select auth.uid()));
create policy daily_rewards_select on public.daily_rewards for select to authenticated using (user_id = (select auth.uid()));
create policy daily_chest_state_active_account on public.daily_chest_state as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy daily_rewards_active_account on public.daily_rewards as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

create or replace function private.rarity_rank(p_rarity text) returns smallint
language sql immutable set search_path = '' as $$
  select case p_rarity when 'comum' then 1 when 'raro' then 2 when 'lendario' then 3 else 0 end::smallint
$$;
revoke all on function private.rarity_rank(text) from public, anon, authenticated;

-- Sorteio puro: r em [0, 1) → raridade pelas chances de game_config; pity + 1 >= pityAt força lendário;
-- p_min é a raridade mínima (baú bônus). Devolve a raridade.
create or replace function private.daily_chest_roll(p_r double precision, p_pity integer, p_min text default 'comum') returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_odds jsonb := coalesce((select g.value -> 'odds' from public.game_config g where g.key = 'daily_chest'),
                           '{"comum": 0.70, "raro": 0.25, "lendario": 0.05}'::jsonb);
  v_pity_at integer := private.param_num('daily_chest', 'pityAt', 20)::integer;
  v_rarity text;
begin
  if p_pity + 1 >= v_pity_at then
    return 'lendario';
  end if;
  v_rarity := case when p_r < (v_odds ->> 'comum')::numeric then 'comum'
                   when p_r < (v_odds ->> 'comum')::numeric + (v_odds ->> 'raro')::numeric then 'raro'
                   else 'lendario' end;
  if private.rarity_rank(v_rarity) < private.rarity_rank(coalesce(p_min, 'comum')) then
    v_rarity := p_min;
  end if;
  return v_rarity;
end $$;
revoke all on function private.daily_chest_roll(double precision, integer, text) from public, anon, authenticated;

-- Atualiza os créditos até hoje e devolve o estado (cria na primeira vez, com 1 baú guardado).
create or replace function private.daily_chest_refresh(p_user uuid) returns public.daily_chest_state
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.br_today();
  v_max integer := private.param_num('daily_chest', 'maxStored', 3)::integer;
  s public.daily_chest_state;
begin
  insert into public.daily_chest_state (user_id, stored, accrued_on) values (p_user, 1, v_today)
  on conflict (user_id) do nothing;
  select * into s from public.daily_chest_state where user_id = p_user for update;
  if s.accrued_on < v_today then
    -- sem nenhuma corrida aceita, a conta não acumula além do 1º baú
    if not exists (select 1 from public.activities a where a.user_id = p_user and a.scored) then
      v_max := 1;
    end if;
    update public.daily_chest_state
       set stored = greatest(stored, least(v_max, stored + (v_today - accrued_on))), accrued_on = v_today, updated_at = now()
     where user_id = p_user
    returning * into s;
  end if;
  return s;
end $$;
revoke all on function private.daily_chest_refresh(uuid) from public, anon, authenticated;

-- Baú bônus garantido (passo 1 da primeira semana, missão de volta, degraus da trilha). Abre junto na próxima abertura.
create or replace function private.add_bonus_chest(p_user uuid, p_min_rarity text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if p_min_rarity not in ('comum', 'raro', 'lendario') then
    raise exception 'INVALID_RARITY: raridade inválida' using errcode = 'P0001';
  end if;
  perform private.daily_chest_refresh(p_user);
  update public.daily_chest_state set bonus = (bonus || p_min_rarity)[greatest(1, cardinality(bonus) - 8):], updated_at = now()
   where user_id = p_user
  returning cardinality(bonus) into v_n;
  return v_n;
end $$;
revoke all on function private.add_bonus_chest(uuid, text) from public, anon, authenticated;

-- Abre todos os baús guardados (+ bônus) com uma atividade aceita. Idempotente: a mesma atividade devolve os mesmos
-- baús; uma abertura por dia de Brasília. Devolve { opened: [...], alreadyOpened, locked? }.
create or replace function private.open_daily_chests(p_user uuid, p_activity uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.br_today();
  a public.activities;
  s public.daily_chest_state;
  v_min_m numeric := private.param_num('daily_chest', 'minMeters', 1000);
  v_min_s numeric := private.param_num('daily_chest', 'minMovingSeconds', 900);
  v_dup_xp integer := private.param_num('daily_chest', 'duplicateCosmeticXp', 20)::integer;
  v_chance jsonb := coalesce((select g.value -> 'cosmeticChance' from public.game_config g where g.key = 'daily_chest'), '{}'::jsonb);
  v_xp_of jsonb := coalesce((select g.value -> 'xp' from public.game_config g where g.key = 'daily_chest'),
                            '{"comum": 15, "raro": 40, "lendario": 100}'::jsonb);
  v_queue text[];
  v_kind text;
  v_rarity text;
  v_pity integer;
  v_pity_used boolean;
  v_cosmetic text;
  v_dup boolean;
  v_xp integer;
  v_n integer := 0;
  i integer;
begin
  if exists (select 1 from public.daily_rewards d where d.user_id = p_user and d.activity_id = p_activity) then
    return jsonb_build_object('alreadyOpened', true, 'opened', (
      select jsonb_agg(jsonb_build_object('n', d.n, 'kind', d.kind, 'rarity', d.rarity, 'xp', d.xp, 'cosmeticId', d.cosmetic_id,
                                          'duplicate', d.duplicate, 'pityUsed', d.pity_used) order by d.n)
        from public.daily_rewards d where d.user_id = p_user and d.activity_id = p_activity));
  end if;
  if not private.feature_on('dailyChest') then
    return null;
  end if;
  select * into a from public.activities where id = p_activity and user_id = p_user;
  if a.id is null or not a.scored or a.status not in ('valid', 'partial')
     or (a.meters < v_min_m and a.moving_seconds < v_min_s) then
    return null;
  end if;
  s := private.daily_chest_refresh(p_user);
  if s.opened_on = v_today then
    return jsonb_build_object('alreadyOpened', true, 'opened', '[]'::jsonb);
  end if;
  -- confiança baixa (RN-009): os baús ficam guardados até a revisão
  if (select pr.trust from public.profiles pr where pr.id = p_user) < 40 then
    return jsonb_build_object('locked', 'LOW_TRUST', 'opened', '[]'::jsonb);
  end if;
  v_queue := array_fill('comum'::text, array[s.stored]) || s.bonus;
  if cardinality(v_queue) = 0 then
    return jsonb_build_object('alreadyOpened', false, 'opened', '[]'::jsonb);
  end if;
  v_pity := s.pity;
  for i in 1 .. cardinality(v_queue) loop
    v_kind := case when i <= s.stored then 'dia' else 'bonus' end;
    v_pity_used := v_pity + 1 >= private.param_num('daily_chest', 'pityAt', 20)::integer;
    v_rarity := private.daily_chest_roll(random(), v_pity, v_queue[i]);
    v_pity := case when v_rarity = 'lendario' then 0 else least(100, v_pity + 1) end;
    v_xp := coalesce((v_xp_of ->> v_rarity)::integer, 0);
    v_cosmetic := null;
    v_dup := false;
    if random() < coalesce((v_chance ->> v_rarity)::numeric, 0) then
      select d.id into v_cosmetic from public.cosmetic_defs d
       where d.in_chest_pool and d.active and d.rarity = v_rarity
         and not exists (select 1 from public.user_cosmetics c where c.user_id = p_user and c.cosmetic_id = d.id)
       order by random() limit 1;
      if v_cosmetic is null then
        v_dup := true; -- já tem todos: cosmético repetido vira XP (E7 §4.5)
      else
        perform private.grant_cosmetic(p_user, v_cosmetic, '', 'daily_chest:' || v_today || ':' || i);
      end if;
    end if;
    insert into public.daily_rewards (user_id, day, n, kind, rarity, xp, cosmetic_id, duplicate, pity_used, activity_id)
    values (p_user, v_today, i, v_kind, v_rarity, v_xp + case when v_dup then v_dup_xp else 0 end, v_cosmetic, v_dup,
            v_pity_used, p_activity);
    perform private.grant_xp(p_user, 'daily_chest', v_today || ':' || i, v_xp);
    if v_dup then
      perform private.grant_xp(p_user, 'duplicate_cosmetic', 'daily_chest:' || v_today || ':' || i, v_dup_xp);
    end if;
    v_n := v_n + 1;
  end loop;
  update public.daily_chest_state set stored = 0, bonus = '{}', pity = v_pity, opened_on = v_today, updated_at = now()
   where user_id = p_user;
  return jsonb_build_object('alreadyOpened', false, 'opened', (
    select jsonb_agg(jsonb_build_object('n', d.n, 'kind', d.kind, 'rarity', d.rarity, 'xp', d.xp, 'cosmeticId', d.cosmetic_id,
                                        'duplicate', d.duplicate, 'pityUsed', d.pity_used) order by d.n)
      from public.daily_rewards d where d.user_id = p_user and d.activity_id = p_activity));
end $$;
revoke all on function private.open_daily_chests(uuid, uuid) from public, anon, authenticated;

-- Tela: créditos guardados, bônus, garantia ("faltam N para o lendário"), chances e XP de cada raridade.
create or replace function public.my_daily_chest() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  s public.daily_chest_state;
  v_cfg jsonb := (select g.value from public.game_config g where g.key = 'daily_chest');
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('dailyChest') then
    raise exception 'FEATURE_DISABLED: baú do dia ainda não está ligado' using errcode = 'P0001';
  end if;
  s := private.daily_chest_refresh(v_uid);
  return jsonb_build_object(
    'stored', s.stored,
    'maxStored', coalesce((v_cfg ->> 'maxStored')::int, 3),
    'bonus', to_jsonb(s.bonus),
    'pityLeft', greatest(1, coalesce((v_cfg ->> 'pityAt')::int, 20) - s.pity),
    'openedToday', s.opened_on is not distinct from public.br_today(),
    'odds', v_cfg -> 'odds',
    'xp', v_cfg -> 'xp',
    'cosmeticChance', v_cfg -> 'cosmeticChance',
    'minMeters', coalesce((v_cfg ->> 'minMeters')::int, 1000),
    'minMovingSeconds', coalesce((v_cfg ->> 'minMovingSeconds')::int, 900),
    'today', coalesce((select jsonb_agg(jsonb_build_object('n', d.n, 'kind', d.kind, 'rarity', d.rarity, 'xp', d.xp,
                                                           'cosmeticId', d.cosmetic_id, 'duplicate', d.duplicate) order by d.n)
                         from public.daily_rewards d where d.user_id = v_uid and d.day = public.br_today()), '[]'::jsonb));
end $$;
revoke all on function public.my_daily_chest() from public, anon;
grant execute on function public.my_daily_chest() to authenticated;
