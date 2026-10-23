-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-66; contrato E7 §2, §3 e §5): baú do dia.
-- "Ganhe 1 baú por dia; guarde até 3; uma atividade abre todos." Chances visíveis; o 20º baú sem lendário é lendário.
-- Só XP e cosméticos; nunca vendido. O dia é o de Brasília, pelo relógio do servidor. Mesmas regras de
-- src/domain/progression.ts (dailyChestsStored, canOpenDailyChests, rollDailyChest, resolveCosmeticDrop):
--   * guardados DERIVADOS (não gravados): min(3, dias desde a última abertura); sem nenhuma atividade: 1;
--     nunca aberto: min(3, dias desde a criação + 1);
--   * abre com uma atividade pontuada (valid/partial) de ≥ 1 km no dia e confiança ≥ 40; 1 abertura por dia;
--   * sorteio r = HMAC-SHA256(segredo do servidor, "userId|dia|n"): bytes 0–3 = raridade, 4–7 = cosmético,
--     8–11 = qual cosmético; o segredo nasce no próprio banco (private.server_secrets) e nunca sai dele;
--   * garantia: profiles.daily_chest_pity = baús abertos desde o último lendário (0..19);
--   * baú bônus (missão, raid, trilha): bonus_chests, idempotente por (fonte, referência), abre junto com os do dia.
-- Quem abre: open_daily_chests() (RPC do app) e, na onda 2, a gravação v2 do finish-activity (mesma função privada).

-- ===========================================================================
-- Segredo do servidor (gerado aqui, nunca no código; o cliente não tem acesso ao schema private)
-- ===========================================================================
create table private.server_secrets (
  name text primary key check (name ~ '^[a-z_]{3,40}$'),
  value bytea not null check (octet_length(value) >= 32),
  created_at timestamptz not null default now()
);
revoke all on private.server_secrets from public, anon, authenticated;
insert into private.server_secrets (name, value) values ('daily_chest_hmac', extensions.gen_random_bytes(32))
on conflict (name) do nothing;

-- ===========================================================================
-- Tabelas
-- ===========================================================================
create table public.daily_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  n smallint not null check (n between 1 and 3),
  rarity text not null check (rarity in ('comum', 'raro', 'lendario')),
  xp integer not null check (xp >= 0),
  cosmetic_id text references public.cosmetic_defs (id),
  duplicate boolean not null default false,
  guaranteed boolean not null default false,
  activity_id uuid references public.activities (id) on delete set null,
  opened_at timestamptz not null default now(),
  primary key (user_id, day, n)
);
create index daily_rewards_activity_idx on public.daily_rewards (activity_id);
comment on table public.daily_rewards is 'D-66: baús do dia abertos (até 3 por abertura, 1 abertura por dia de Brasília).';

create table public.bonus_chests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('mission', 'raid', 'track')),
  ref text not null check (char_length(ref) between 1 and 120),
  min_rarity text not null check (min_rarity in ('comum', 'raro', 'lendario')),
  rarity text check (rarity in ('comum', 'raro', 'lendario')),
  xp integer check (xp >= 0),
  cosmetic_id text references public.cosmetic_defs (id),
  duplicate boolean not null default false,
  activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  unique (user_id, source, ref),
  check ((opened_at is null) = (rarity is null))
);
create index bonus_chests_pending_idx on public.bonus_chests (user_id) where opened_at is null;
comment on table public.bonus_chests is 'Baús garantidos (passo 1 da primeira semana, volta, chefão, trilha): abrem junto com o próximo baú do dia.';

alter table public.daily_rewards enable row level security;
alter table public.bonus_chests enable row level security;
revoke all on public.daily_rewards, public.bonus_chests from anon, authenticated;
grant select on public.daily_rewards, public.bonus_chests to authenticated;
create policy daily_rewards_select on public.daily_rewards for select to authenticated using (user_id = (select auth.uid()));
create policy bonus_chests_select on public.bonus_chests for select to authenticated using (user_id = (select auth.uid()));
create policy daily_rewards_active_account on public.daily_rewards as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy bonus_chests_active_account on public.bonus_chests as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

-- ===========================================================================
-- Funções puras / auxiliares
-- ===========================================================================
create or replace function private.rarity_rank(p_rarity text) returns smallint
language sql immutable set search_path = '' as $$
  select case p_rarity when 'comum' then 1 when 'raro' then 2 when 'lendario' then 3 else 0 end::smallint
$$;
revoke all on function private.rarity_rank(text) from public, anon, authenticated;

-- Três números em [0, 1) a partir do HMAC do servidor: raridade, cosmético e qual cosmético.
create or replace function private.daily_chest_hmac_rolls(p_user uuid, p_day date, p_n text) returns double precision[]
language sql stable security definer set search_path = '' as $$
  select array[
    ((get_byte(h, 0)::bigint << 24) + (get_byte(h, 1) << 16) + (get_byte(h, 2) << 8) + get_byte(h, 3)) / 4294967296.0,
    ((get_byte(h, 4)::bigint << 24) + (get_byte(h, 5) << 16) + (get_byte(h, 6) << 8) + get_byte(h, 7)) / 4294967296.0,
    ((get_byte(h, 8)::bigint << 24) + (get_byte(h, 9) << 16) + (get_byte(h, 10) << 8) + get_byte(h, 11)) / 4294967296.0]::double precision[]
    from (select extensions.hmac(convert_to(p_user::text || '|' || p_day::text || '|' || p_n, 'UTF8'),
                                 (select s.value from private.server_secrets s where s.name = 'daily_chest_hmac'), 'sha256') as h) x
$$;
revoke all on function private.daily_chest_hmac_rolls(uuid, date, text) from public, anon, authenticated;

-- rollDailyChest: raridade pelas chances de game_config; pity + 1 >= 20 força lendário; p_min = raridade mínima
-- (baú bônus). Devolve (raridade, garantido).
create or replace function private.daily_chest_roll(p_r double precision, p_pity integer, p_min text default 'comum',
                                                    out rarity text, out guaranteed boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_odds jsonb := coalesce((select g.value -> 'odds' from public.game_config g where g.key = 'daily_chest'),
                           '{"comum": 0.70, "raro": 0.25, "lendario": 0.05}'::jsonb);
  v_forced boolean := p_pity + 1 >= private.param_num('daily_chest', 'pityAt', 20);
begin
  rarity := case when v_forced then 'lendario'
                 when p_r >= (v_odds ->> 'comum')::numeric + (v_odds ->> 'raro')::numeric then 'lendario'
                 when p_r >= (v_odds ->> 'comum')::numeric then 'raro'
                 else 'comum' end;
  -- como no domain: "garantido" só quando a garantia mudou o resultado
  guaranteed := v_forced and p_r < (v_odds ->> 'comum')::numeric + (v_odds ->> 'raro')::numeric;
  if private.rarity_rank(rarity) < private.rarity_rank(coalesce(p_min, 'comum')) then
    rarity := p_min;
  end if;
end $$;
revoke all on function private.daily_chest_roll(double precision, integer, text) from public, anon, authenticated;

-- dailyChestsStored (derivado; nada gravado)
create or replace function private.daily_chests_stored(p_user uuid, p_today date default public.br_today()) returns integer
language sql stable security definer set search_path = '' as $$
  select case
    when (select max(d.day) from public.daily_rewards d where d.user_id = p_user) is not null then
      greatest(0, least(private.param_num('daily_chest', 'maxStored', 3)::integer,
                        p_today - (select max(d.day) from public.daily_rewards d where d.user_id = p_user)))
    when not exists (select 1 from public.activities a where a.user_id = p_user and a.scored) then 1
    else greatest(1, least(private.param_num('daily_chest', 'maxStored', 3)::integer,
                           p_today - (select (pr.created_at at time zone 'America/Sao_Paulo')::date
                                        from public.profiles pr where pr.id = p_user) + 1))
  end
$$;
revoke all on function private.daily_chests_stored(uuid, date) from public, anon, authenticated;

-- resolveCosmeticDrop: escolhe no catálogo da raridade; se a pessoa já tem, vira +20 XP.
create or replace function private.cosmetic_drop(p_user uuid, p_rarity text, p_roll double precision) returns text
language sql stable security definer set search_path = '' as $$
  select c.id from (select d.id, row_number() over (order by d.id) - 1 as i, count(*) over () as n
                      from public.cosmetic_defs d where d.in_chest_pool and d.active and d.rarity = p_rarity) c
   where c.i = least(c.n - 1, floor(greatest(0, p_roll) * c.n))
$$;
revoke all on function private.cosmetic_drop(uuid, text, double precision) from public, anon, authenticated;

-- Baú bônus garantido (idempotente por fonte + referência). Devolve true se foi criado agora.
create or replace function private.add_bonus_chest(p_user uuid, p_min_rarity text, p_source text, p_ref text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.bonus_chests (user_id, source, ref, min_rarity) values (p_user, p_source, p_ref, p_min_rarity)
  on conflict (user_id, source, ref) do nothing;
  return found;
end $$;
revoke all on function private.add_bonus_chest(uuid, text, text, text) from public, anon, authenticated;

-- ===========================================================================
-- Abertura (uma por dia; abre os guardados, até 3, e os bônus pendentes)
-- p_activity: a atividade que abre (null = a melhor do dia). Devolve
-- { opened: true, prizes: [...], bonus: [...], pityLeft } ou { opened: false, reason: status|distance|review|already, stored }.
-- ===========================================================================
create or replace function private.open_daily_chests(p_user uuid, p_activity uuid default null, p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_day_start timestamptz := (v_today + time '00:00') at time zone 'America/Sao_Paulo';
  a public.activities;
  v_stored integer;
  v_pity integer;
  v_xp_of jsonb := coalesce((select g.value -> 'xp' from public.game_config g where g.key = 'daily_chest'),
                            '{"comum": 15, "raro": 40, "lendario": 100}'::jsonb);
  v_chance jsonb := coalesce((select g.value -> 'cosmeticChance' from public.game_config g where g.key = 'daily_chest'),
                             '{"comum": 0, "raro": 0.05, "lendario": 0.30}'::jsonb);
  v_dup_xp integer := private.param_num('daily_chest', 'duplicateCosmeticXp', 20)::integer;
  v_rolls double precision[];
  v_roll record;
  v_cosmetic text;
  v_dup boolean;
  b public.bonus_chests;
  i integer;
begin
  if not private.feature_on('dailyChest') then
    return jsonb_build_object('opened', false, 'reason', 'disabled', 'stored', 0);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('daily_chest:' || p_user || ':' || v_today, 0));
  v_stored := private.daily_chests_stored(p_user, v_today);
  if exists (select 1 from public.daily_rewards d where d.user_id = p_user and d.day = v_today) then
    return jsonb_build_object('opened', false, 'reason', 'already', 'stored', 0);
  end if;
  select * into a from public.activities x
   where x.user_id = p_user and (p_activity is null or x.id = p_activity)
     and coalesce(x.ended_at, x.finished_at) >= v_day_start and coalesce(x.ended_at, x.finished_at) < v_day_start + interval '1 day'
   order by (x.scored and x.status in ('valid', 'partial')) desc, x.meters desc
   limit 1;
  if a.id is null or not a.scored or a.status not in ('valid', 'partial') then
    return jsonb_build_object('opened', false, 'reason', 'status', 'stored', v_stored);
  end if;
  if a.meters < private.param_num('daily_chest', 'minMeters', 1000) then
    return jsonb_build_object('opened', false, 'reason', 'distance', 'stored', v_stored);
  end if;
  if (select pr.trust from public.profiles pr where pr.id = p_user) < private.param_num('daily_chest', 'minTrust', 40) then
    return jsonb_build_object('opened', false, 'reason', 'review', 'stored', v_stored);
  end if;

  select pr.daily_chest_pity into v_pity from public.profiles pr where pr.id = p_user for update;
  for i in 1 .. v_stored loop
    v_rolls := private.daily_chest_hmac_rolls(p_user, v_today, i::text);
    select * into v_roll from private.daily_chest_roll(v_rolls[1], v_pity);
    v_pity := case when v_roll.rarity = 'lendario' then 0 else v_pity + 1 end;
    v_cosmetic := null;
    v_dup := false;
    if v_rolls[2] < coalesce((v_chance ->> v_roll.rarity)::numeric, 0) then
      v_cosmetic := private.cosmetic_drop(p_user, v_roll.rarity, v_rolls[3]);
      if v_cosmetic is null or exists (select 1 from public.user_cosmetics c where c.user_id = p_user and c.cosmetic_id = v_cosmetic
                                                                              and c.variant = '') then
        v_cosmetic := null;
        v_dup := true;
      end if;
    end if;
    insert into public.daily_rewards (user_id, day, n, rarity, xp, cosmetic_id, duplicate, guaranteed, activity_id)
    values (p_user, v_today, i, v_roll.rarity, (v_xp_of ->> v_roll.rarity)::integer, v_cosmetic, v_dup, v_roll.guaranteed, a.id);
    perform private.grant_xp(p_user, 'daily_chest', v_today || ':' || i, (v_xp_of ->> v_roll.rarity)::integer);
    if v_cosmetic is not null then
      perform private.grant_cosmetic(p_user, v_cosmetic, '', 'daily_chest:' || v_today || ':' || i);
    elsif v_dup then
      perform private.grant_xp(p_user, 'duplicate_cosmetic', v_today || ':' || i, v_dup_xp);
    end if;
  end loop;
  update public.profiles set daily_chest_pity = v_pity where id = p_user;

  -- bônus pendentes (raridade mínima garantida; não mexem na contagem da garantia)
  for b in select * from public.bonus_chests x where x.user_id = p_user and x.opened_at is null order by x.created_at for update loop
    v_rolls := private.daily_chest_hmac_rolls(p_user, v_today, 'bonus|' || b.id);
    select * into v_roll from private.daily_chest_roll(v_rolls[1], 0, b.min_rarity);
    v_cosmetic := null;
    v_dup := false;
    if v_rolls[2] < coalesce((v_chance ->> v_roll.rarity)::numeric, 0) then
      v_cosmetic := private.cosmetic_drop(p_user, v_roll.rarity, v_rolls[3]);
      if v_cosmetic is null or exists (select 1 from public.user_cosmetics c where c.user_id = p_user and c.cosmetic_id = v_cosmetic
                                                                              and c.variant = '') then
        v_cosmetic := null;
        v_dup := true;
      end if;
    end if;
    update public.bonus_chests
       set rarity = v_roll.rarity, xp = (v_xp_of ->> v_roll.rarity)::integer, cosmetic_id = v_cosmetic, duplicate = v_dup,
           activity_id = a.id, opened_at = p_now
     where id = b.id;
    perform private.grant_xp(p_user, 'daily_chest', 'bonus:' || b.id, (v_xp_of ->> v_roll.rarity)::integer);
    if v_cosmetic is not null then
      perform private.grant_cosmetic(p_user, v_cosmetic, '', 'bonus_chest:' || b.id);
    elsif v_dup then
      perform private.grant_xp(p_user, 'duplicate_cosmetic', 'bonus:' || b.id, v_dup_xp);
    end if;
  end loop;

  return jsonb_build_object(
    'opened', true,
    'prizes', coalesce((select jsonb_agg(jsonb_build_object('n', d.n, 'rarity', d.rarity, 'xp', d.xp, 'cosmeticId', d.cosmetic_id,
                                                            'duplicate', d.duplicate, 'guaranteed', d.guaranteed) order by d.n)
                          from public.daily_rewards d where d.user_id = p_user and d.day = v_today), '[]'::jsonb),
    'bonus', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'source', x.source, 'rarity', x.rarity, 'xp', x.xp,
                                                           'cosmeticId', x.cosmetic_id, 'duplicate', x.duplicate) order by x.created_at)
                         from public.bonus_chests x where x.user_id = p_user and x.opened_at = p_now), '[]'::jsonb),
    'pityLeft', greatest(1, private.param_num('daily_chest', 'pityAt', 20)::integer - v_pity),
    'activityId', a.id);
end $$;
revoke all on function private.open_daily_chests(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ===========================================================================
-- RPCs do app
-- ===========================================================================
-- Abre os baús do dia (E7 §3). Erros: DAILY_CHEST_LOCKED (sem atividade pontuada de 1 km hoje),
-- DAILY_CHEST_REVIEW (confiança < 40). Já aberto hoje: { alreadyOpened: true } com os prêmios de hoje.
create or replace function public.open_daily_chests() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_res jsonb;
  v_odds jsonb := (select g.value -> 'odds' from public.game_config g where g.key = 'daily_chest');
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('dailyChest') then
    raise exception 'FEATURE_DISABLED: baú do dia ainda não está ligado' using errcode = 'P0001';
  end if;
  v_res := private.open_daily_chests(v_uid, null, now());
  if (v_res ->> 'opened')::boolean then
    return jsonb_build_object('prizes', v_res -> 'prizes', 'bonus', v_res -> 'bonus', 'pityLeft', v_res -> 'pityLeft',
                              'odds', v_odds, 'alreadyOpened', false);
  end if;
  case v_res ->> 'reason'
    when 'already' then
      return jsonb_build_object(
        'prizes', coalesce((select jsonb_agg(jsonb_build_object('n', d.n, 'rarity', d.rarity, 'xp', d.xp, 'cosmeticId', d.cosmetic_id,
                                                                'duplicate', d.duplicate, 'guaranteed', d.guaranteed) order by d.n)
                              from public.daily_rewards d where d.user_id = v_uid and d.day = public.br_today()), '[]'::jsonb),
        'bonus', '[]'::jsonb,
        'pityLeft', greatest(1, private.param_num('daily_chest', 'pityAt', 20)::integer
                                - (select pr.daily_chest_pity from public.profiles pr where pr.id = v_uid)),
        'odds', v_odds, 'alreadyOpened', true);
    when 'review' then
      raise exception 'DAILY_CHEST_REVIEW: seus baús ficam guardados até a revisão das corridas' using errcode = 'P0001';
    else
      raise exception 'DAILY_CHEST_LOCKED: corra 1 km hoje para abrir os baús' using errcode = 'P0001';
  end case;
end $$;
revoke all on function public.open_daily_chests() from public, anon;
grant execute on function public.open_daily_chests() to authenticated;

-- Estado para a tela: guardados, bônus pendentes, "faltam N para o lendário", chances e XP de cada raridade.
create or replace function public.my_daily_chest() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cfg jsonb := (select g.value from public.game_config g where g.key = 'daily_chest');
  v_opened boolean;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('dailyChest') then
    raise exception 'FEATURE_DISABLED: baú do dia ainda não está ligado' using errcode = 'P0001';
  end if;
  v_opened := exists (select 1 from public.daily_rewards d where d.user_id = v_uid and d.day = public.br_today());
  return jsonb_build_object(
    'stored', case when v_opened then 0 else private.daily_chests_stored(v_uid) end,
    'maxStored', coalesce((v_cfg ->> 'maxStored')::int, 3),
    'bonus', coalesce((select jsonb_agg(x.min_rarity order by x.created_at) from public.bonus_chests x
                        where x.user_id = v_uid and x.opened_at is null), '[]'::jsonb),
    'pityLeft', greatest(1, coalesce((v_cfg ->> 'pityAt')::int, 20)
                            - (select pr.daily_chest_pity from public.profiles pr where pr.id = v_uid)),
    'openedToday', v_opened,
    'odds', v_cfg -> 'odds',
    'xp', v_cfg -> 'xp',
    'cosmeticChance', v_cfg -> 'cosmeticChance',
    'minMeters', coalesce((v_cfg ->> 'minMeters')::int, 1000));
end $$;
revoke all on function public.my_daily_chest() from public, anon;
grant execute on function public.my_daily_chest() to authenticated;
