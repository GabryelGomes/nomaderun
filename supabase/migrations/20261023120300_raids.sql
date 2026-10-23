-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-67): Raid real semanal (chefão da cidade).
-- "Toda semana um chefão invade a cidade: cada quilômetro que você corre tira 10 de vida dele."
--   * janela segunda 06:00 → domingo 21:00 (Brasília); global por enquanto (coluna city pronta);
--   * vida = max(500, 0,75 × mediana dos km semanais das 4 semanas anteriores × 10 × fator); fator 0,7–1,5
--     (+10% se caiu antes de sábado, −10% se fugiu);
--   * fases 100/67/33 % (a fase só avança); 3 pontos fracos por dia a partir da fase 2;
--   * dano calculado pelo domain (raid.ts, E3) na gravação v2 (onda 2); o servidor aplica os tetos de 21 km por corrida
--     e 30 km por dia, a idempotência por corrida e um limite de sanidade (≤ 10/km × 5);
--   * recompensas: XP = dano ÷ 2 (até 300), e, se derrotado, +200 XP, baú do chefão, medalha e cosméticos;
--   * Realtime em raids (só números públicos: vida, fase, status). Cores e arte dos chefões: E4 (violeta só para vilões).

-- ===========================================================================
-- Tabelas
-- ===========================================================================
create table public.raid_bosses (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 30),
  theme text not null check (char_length(theme) between 2 and 60),
  weakness text not null check (char_length(weakness) between 2 and 60),
  intro_line text not null check (char_length(intro_line) between 2 and 90),
  defeat_line text not null check (char_length(defeat_line) between 2 and 90),
  art_key text not null check (char_length(art_key) between 2 and 40),
  months smallint[] not null default '{}',          -- meses temáticos (calendário da E4)
  blocked_months smallint[] not null default '{}',  -- meses em que não aparece (Fuligem fora das queimadas)
  sort smallint not null default 0,
  active boolean not null default true,
  is_demo boolean not null default false
);

create table public.raids (
  id uuid primary key default gen_random_uuid(),
  boss_id text not null references public.raid_bosses (id),
  city text check (city is null or char_length(city) between 2 and 80), -- null = global
  week_start date not null check (extract(isodow from week_start) = 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hp_max integer not null check (hp_max > 0),
  hp integer not null check (hp >= 0),
  phase smallint not null default 1 check (phase between 1 and 4), -- 4 = derrotado
  factor numeric(4, 2) not null default 1 check (factor between 0.5 and 2),
  status text not null default 'active' check (status in ('active', 'defeated', 'escaped')),
  participants integer not null default 0 check (participants >= 0),
  defeated_at timestamptz,
  rewarded_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (hp <= hp_max),
  check ((status = 'defeated') = (defeated_at is not null))
);
create unique index raids_week_city_key on public.raids (week_start, coalesce(city, ''));
create index raids_status_idx on public.raids (status, ends_at);
comment on table public.raids is 'D-67: um chefão por semana e por escopo (city null = global). Sem dado pessoal: vai para o Realtime.';
create trigger raids_touch before update on public.raids for each row execute function private.touch_updated_at();

create table public.raid_hits (
  activity_id uuid primary key references public.activities (id) on delete cascade, -- cada corrida golpeia uma vez
  raid_id uuid not null references public.raids (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  crew_id uuid references public.crews (id) on delete set null,  -- foto do momento, para o ranking de crews
  day date not null,                                             -- dia de Brasília da corrida (teto diário)
  meters integer not null check (meters >= 0),                   -- metros que contaram, depois dos tetos
  weak_meters integer not null default 0 check (weak_meters >= 0 and weak_meters <= meters),
  damage integer not null check (damage >= 0),
  crit boolean not null default false,
  final_blow boolean not null default false,
  created_at timestamptz not null default now()
);
create index raid_hits_raid_user_idx on public.raid_hits (raid_id, user_id);
create index raid_hits_user_day_idx on public.raid_hits (user_id, day);

create table public.raid_weak_points (
  raid_id uuid not null references public.raids (id) on delete cascade,
  day date not null,
  zone_id text not null references public.zones (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (raid_id, day, zone_id)
);

create table public.raid_rewards (
  raid_id uuid not null references public.raids (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('participacao', 'derrota', 'top10', 'golpe_final')),
  xp integer not null default 0 check (xp >= 0),
  chest_rarity text check (chest_rarity in ('comum', 'raro', 'lendario')),
  cosmetic_id text references public.cosmetic_defs (id),
  medal_tier text check (medal_tier in ('bronze', 'prata', 'ouro')),
  granted_at timestamptz not null default now(),
  primary key (raid_id, user_id, kind)
);
create index raid_rewards_user_idx on public.raid_rewards (user_id, granted_at desc);

-- "Dano da cidade desde a sua última visita" (D-67)
create table public.raid_visits (
  raid_id uuid not null references public.raids (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now(),
  seen_hp integer not null check (seen_hp >= 0),
  primary key (raid_id, user_id)
);

alter table public.raid_bosses enable row level security;
alter table public.raids enable row level security;
alter table public.raid_hits enable row level security;
alter table public.raid_weak_points enable row level security;
alter table public.raid_rewards enable row level security;
alter table public.raid_visits enable row level security;
revoke all on public.raid_bosses, public.raids, public.raid_hits, public.raid_weak_points, public.raid_rewards,
              public.raid_visits from anon, authenticated;
grant select on public.raid_bosses, public.raids, public.raid_hits, public.raid_weak_points, public.raid_rewards,
               public.raid_visits to authenticated;
create policy raid_bosses_read on public.raid_bosses for select to authenticated using (active);
create policy raids_read on public.raids for select to authenticated using (true);
create policy raid_weak_points_read on public.raid_weak_points for select to authenticated using (true);
create policy raid_hits_select_own on public.raid_hits for select to authenticated using (user_id = (select auth.uid()));
create policy raid_rewards_select_own on public.raid_rewards for select to authenticated using (user_id = (select auth.uid()));
create policy raid_visits_select_own on public.raid_visits for select to authenticated using (user_id = (select auth.uid()));
create policy raid_hits_active_account on public.raid_hits as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy raid_rewards_active_account on public.raid_rewards as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy raid_visits_active_account on public.raid_visits as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

-- Vida e fase ao vivo para o mapa e a Arena: números públicos, nenhum dado pessoal.
alter publication supabase_realtime add table public.raids;

-- Elenco da E4 (ids estáveis usados pela arte e por domain/raid.ts) e calendário sugerido.
insert into public.raid_bosses (id, name, theme, weakness, intro_line, defeat_line, art_key, months, blocked_months, sort) values
  ('soneca', 'Soneca', 'preguiça, "só amanhã"', 'corrida antes das 8h',
   'Só mais cinco minutinhos... a semana inteira.', 'Tá bom, tá bom... levantei.', 'chefao-soneca', '{1}', '{}', 1),
  ('rei-buzina', 'Rei Buzina', 'trânsito, carro em cima da faixa', 'ruas de bairro',
   'Aqui quem manda é o engarrafamento. Buzina pra mim!', 'Tá... abre o sinal.', 'chefao-rei-buzina', '{3}', '{}', 2),
  ('fuligem', 'Fuligem', 'fumaça, poluição', 'parques e lagos',
   'Respira fundo... se tiver coragem.', 'Ventou... e eu sumi.', 'chefao-fuligem', '{11}', '{8,9}', 3),
  ('mormaco', 'Mormaço', 'calor, ar parado', 'sombra dos parques',
   'Quarenta graus e ar parado. Só me vence quem corre cedo.', 'Isso é... chuva?', 'chefao-mormaco', '{9,10}', '{}', 4),
  ('paredao', 'Paredão', 'concreto, muro, ladeira', 'quem sobe ruas novas',
   'Cimento, muro e ladeira. Por aqui ninguém passa.', '...desmoronei.', 'chefao-paredao', '{}', '{}', 5);

-- ===========================================================================
-- Funções puras / auxiliares
-- ===========================================================================
-- Fase pela vida restante: 1 (> 67 %), 2 (> 33 %), 3 (> 0), 4 (derrotado).
create or replace function private.raid_phase_of(p_hp integer, p_hp_max integer) returns smallint
language sql immutable set search_path = '' as $$
  select case when p_hp <= 0 then 4
              when p_hp::numeric / p_hp_max <= 0.33 then 3
              when p_hp::numeric / p_hp_max <= 0.67 then 2
              else 1 end::smallint
$$;
revoke all on function private.raid_phase_of(integer, integer) from public, anon, authenticated;

-- Janela da semana que contém p_at: segunda 06:00 → domingo 21:00 (Brasília).
create or replace function private.raid_window(p_at timestamptz, out week_start date, out starts_at timestamptz, out ends_at timestamptz)
language sql stable set search_path = '' as $$
  select w, (w + time '06:00') at time zone 'America/Sao_Paulo', ((w + 6) + time '21:00') at time zone 'America/Sao_Paulo'
    from (select date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date as w) x
$$;
revoke all on function private.raid_window(timestamptz) from public, anon, authenticated;

-- Chefão da semana: o do mês temático; senão, rodízio pela semana entre os que não estão bloqueados no mês.
create or replace function private.raid_pick_boss(p_week_start date) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select b.id from public.raid_bosses b
      where b.active and not b.is_demo and extract(month from p_week_start)::smallint = any (b.months)
      order by md5(b.id || p_week_start::text) limit 1),
    (select b.id from public.raid_bosses b
      where b.active and not b.is_demo and not (extract(month from p_week_start)::smallint = any (b.blocked_months))
      order by b.sort
      offset (extract(week from p_week_start)::integer
              % greatest(1, (select count(*) from public.raid_bosses c where c.active and not c.is_demo
                               and not (extract(month from p_week_start)::smallint = any (c.blocked_months)))::integer))
      limit 1))
$$;
revoke all on function private.raid_pick_boss(date) from public, anon, authenticated;

-- ===========================================================================
-- Golpe de uma corrida aceita (chamado pela gravação v2 do finish-activity, onda 2; idempotente por corrida).
-- p_meters: metros válidos da corrida; p_damage: dano do domain (raid.ts) para esses metros; p_weak_meters: metros em
-- ponto fraco; p_crit: crítico sorteado pelo domain (semente = id da corrida).
-- ===========================================================================
create or replace function private.apply_raid_hit(p_activity uuid, p_meters integer, p_damage integer, p_crit boolean,
                                                  p_weak_meters integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  h public.raid_hits;
  a public.activities;
  r public.raids;
  v_city text;
  v_day date;
  v_day_m bigint;
  v_counted integer;
  v_damage integer;
  v_ceiling numeric;
  v_hp integer;
  v_phase_before smallint;
  v_first boolean;
  v_final boolean;
begin
  select * into h from public.raid_hits where activity_id = p_activity;
  if h.activity_id is not null then
    select * into r from public.raids where id = h.raid_id;
    return jsonb_build_object('raidId', r.id, 'bossId', r.boss_id, 'damage', h.damage, 'meters', h.meters, 'crit', h.crit,
                              'finalBlow', h.final_blow, 'phase', r.phase, 'hp', r.hp, 'hpMax', r.hp_max,
                              'defeated', r.status = 'defeated', 'repeated', true);
  end if;
  if not private.feature_on('raid') or coalesce(p_meters, 0) <= 0 then
    return null;
  end if;
  select * into a from public.activities where id = p_activity;
  if a.id is null or not a.scored or a.status not in ('valid', 'partial') then
    return null;
  end if;
  select pr.city into v_city from public.profiles pr where pr.id = a.user_id;
  select * into r from public.raids x
   where x.status = 'active' and coalesce(a.ended_at, a.finished_at) >= x.starts_at and coalesce(a.ended_at, a.finished_at) < x.ends_at
     and (x.city is null or x.city = v_city)
   order by (x.city is null), x.starts_at desc
   limit 1
   for update;
  if r.id is null then
    return null;
  end if;

  v_day := (coalesce(a.ended_at, a.finished_at) at time zone 'America/Sao_Paulo')::date;
  select coalesce(sum(x.meters), 0) into v_day_m from public.raid_hits x where x.user_id = a.user_id and x.day = v_day;
  v_counted := greatest(0, least(p_meters,
                                 (private.param_num('raid', 'runCapKm', 21) * 1000)::integer,
                                 (private.param_num('raid', 'dayCapKm', 30) * 1000)::integer - v_day_m))::integer;
  -- dano proporcional aos metros que contaram, com teto de sanidade (10/km × multiplicador máximo)
  v_ceiling := v_counted / 1000.0 * private.param_num('raid', 'damagePerKm', 10) * private.param_num('raid', 'maxMultiplier', 5);
  v_damage := floor(least(greatest(coalesce(p_damage, 0), 0)::numeric * v_counted / p_meters, v_ceiling))::integer;

  v_first := not exists (select 1 from public.raid_hits x where x.raid_id = r.id and x.user_id = a.user_id);
  v_phase_before := r.phase;
  v_hp := greatest(0, r.hp - v_damage);
  v_final := r.hp > 0 and v_hp = 0 and v_damage > 0;
  insert into public.raid_hits (activity_id, raid_id, user_id, crew_id, day, meters, weak_meters, damage, crit, final_blow)
  values (a.id, r.id, a.user_id, (select cm.crew_id from public.crew_members cm where cm.user_id = a.user_id), v_day,
          v_counted, least(greatest(coalesce(p_weak_meters, 0), 0), v_counted), v_damage, coalesce(p_crit, false), v_final);
  update public.raids
     set hp = v_hp,
         phase = greatest(phase, private.raid_phase_of(v_hp, hp_max)),
         status = case when v_hp = 0 then 'defeated' else status end,
         -- hora do golpe final = fim da corrida (não a hora em que ela sincronizou)
         defeated_at = case when v_hp = 0 then coalesce(defeated_at, a.ended_at, a.finished_at, now()) else defeated_at end,
         participants = participants + case when v_first then 1 else 0 end
   where id = r.id
  returning * into r;
  return jsonb_build_object('raidId', r.id, 'bossId', r.boss_id, 'damage', v_damage, 'meters', v_counted,
                            'capped', v_counted < p_meters, 'crit', coalesce(p_crit, false), 'finalBlow', v_final,
                            'phaseBefore', v_phase_before, 'phase', r.phase, 'hp', r.hp, 'hpMax', r.hp_max,
                            'defeated', r.status = 'defeated', 'repeated', false);
end $$;
revoke all on function private.apply_raid_hit(uuid, integer, integer, boolean, integer) from public, anon, authenticated;

-- ===========================================================================
-- Tela do raid: chefão, vida, fase, prazo, pontos fracos de hoje, "Sua parte", dano desde a última visita,
-- top 10 corredores e top 5 crews (sem ids de corrida nem de usuário).
-- ===========================================================================
create or replace function public.raid_current() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_city text;
  r public.raids;
  b public.raid_bosses;
  v public.raid_visits;
  v_today date := public.br_today();
  v_cfg jsonb := (select g.value from public.game_config g where g.key = 'raid');
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('raid') then
    raise exception 'FEATURE_DISABLED: raid ainda não está ligada' using errcode = 'P0001';
  end if;
  select pr.city into v_city from public.profiles pr where pr.id = v_uid;
  select * into r from public.raids x
   where (x.city is null or x.city = v_city) and x.week_start >= (private.raid_window(now())).week_start - 7
   order by x.week_start desc, (x.city is null)
   limit 1;
  if r.id is null then
    return jsonb_build_object('raid', null, 'params', v_cfg);
  end if;
  select * into b from public.raid_bosses where id = r.boss_id;
  select * into v from public.raid_visits where raid_id = r.id and user_id = v_uid;
  insert into public.raid_visits (raid_id, user_id, seen_at, seen_hp) values (r.id, v_uid, now(), r.hp)
  on conflict (raid_id, user_id) do update set seen_at = now(), seen_hp = excluded.seen_hp;

  return jsonb_build_object(
    'raid', jsonb_build_object(
      'id', r.id, 'bossId', r.boss_id, 'name', b.name, 'theme', b.theme, 'weakness', b.weakness, 'introLine', b.intro_line,
      'defeatLine', b.defeat_line, 'artKey', b.art_key, 'city', r.city, 'weekStart', r.week_start,
      'startsAt', private.ts_to_ms(r.starts_at), 'endsAt', private.ts_to_ms(r.ends_at),
      'hp', r.hp, 'hpMax', r.hp_max, 'phase', r.phase, 'status', r.status, 'participants', r.participants,
      'defeatedAt', private.ts_to_ms(r.defeated_at), 'isDemo', r.is_demo,
      'weakPoints', coalesce((select jsonb_agg(jsonb_build_object('zoneId', z.id, 'name', z.name,
                                'center', jsonb_build_array(round(extensions.st_x(extensions.st_centroid(z.geom))::numeric, 6),
                                                            round(extensions.st_y(extensions.st_centroid(z.geom))::numeric, 6)))
                                order by z.id)
                                from public.raid_weak_points w join public.zones z on z.id = w.zone_id
                               where w.raid_id = r.id and w.day = v_today), '[]'::jsonb)),
    'me', jsonb_build_object(
      'damage', coalesce((select sum(h.damage) from public.raid_hits h where h.raid_id = r.id and h.user_id = v_uid), 0),
      'meters', coalesce((select sum(h.meters) from public.raid_hits h where h.raid_id = r.id and h.user_id = v_uid), 0),
      'hits', (select count(*) from public.raid_hits h where h.raid_id = r.id and h.user_id = v_uid),
      'todayMeters', coalesce((select sum(h.meters) from public.raid_hits h where h.user_id = v_uid and h.day = v_today), 0),
      'rank', (select t.pos from (select h.user_id, rank() over (order by sum(h.damage) desc) as pos
                                    from public.raid_hits h where h.raid_id = r.id group by h.user_id) t where t.user_id = v_uid),
      'rewards', coalesce((select jsonb_agg(jsonb_build_object('kind', rw.kind, 'xp', rw.xp, 'chestRarity', rw.chest_rarity,
                                                               'cosmeticId', rw.cosmetic_id, 'medalTier', rw.medal_tier) order by rw.kind)
                             from public.raid_rewards rw where rw.raid_id = r.id and rw.user_id = v_uid), '[]'::jsonb)),
    'sinceLastVisit', case when v.raid_id is null then null
                           else jsonb_build_object('damage', greatest(0, v.seen_hp - r.hp), 'since', private.ts_to_ms(v.seen_at)) end,
    'topRunners', coalesce((select jsonb_agg(jsonb_build_object('position', t.pos, 'username', t.username, 'faction', t.faction,
                                                                'avatarUrl', t.avatar_url, 'damage', t.damage, 'you', t.user_id = v_uid)
                                             order by t.pos, t.username)
        from (select h.user_id, pp.username, pp.faction, pp.avatar_url, sum(h.damage)::bigint as damage,
                     rank() over (order by sum(h.damage) desc) as pos
                from public.raid_hits h join private.public_profiles() pp on pp.id = h.user_id
               where h.raid_id = r.id group by h.user_id, pp.username, pp.faction, pp.avatar_url
               order by damage desc, pp.username limit 10) t), '[]'::jsonb),
    'topCrews', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'tag', t.tag, 'faction', t.faction, 'damage', t.damage)
                                           order by t.damage desc, t.tag)
        from (select pc.name, pc.tag, pc.faction, sum(h.damage)::bigint as damage
                from public.raid_hits h join private.public_crews() pc on pc.id = h.crew_id
               where h.raid_id = r.id group by pc.name, pc.tag, pc.faction order by damage desc, pc.tag limit 5) t), '[]'::jsonb),
    'params', v_cfg);
end $$;
revoke all on function public.raid_current() from public, anon;
grant execute on function public.raid_current() to authenticated;

-- ===========================================================================
-- Job (a cada 10 min; idempotente): fecha (fugiu), premia, sorteia os pontos fracos do dia e abre a semana.
-- ===========================================================================
create or replace function public.job_raid_tick(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_closed integer := 0;
  v_rewarded integer := 0;
  v_opened integer := 0;
  v_weak integer := 0;
  v_n integer;
  r record;
  p record;
  w record;
  v_day date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_prev public.raids;
  v_factor numeric;
  v_median numeric;
  v_hp integer;
  v_boss text;
  v_dow integer;
  v_chest text;
  v_min_damage integer := private.param_num('raid', 'rewardMinDamage', 10)::integer;
begin
  -- 1. fecha: passou de domingo 21:00 com vida > 0 = fugiu
  update public.raids set status = 'escaped' where status = 'active' and ends_at <= p_now;
  get diagnostics v_closed = row_count;

  -- 2. premia (uma vez por raid: rewarded_at; uma vez por pessoa e tipo: PK de raid_rewards e o livro de XP)
  for r in select * from public.raids where status in ('defeated', 'escaped') and rewarded_at is null
           order by starts_at for update skip locked loop
    v_dow := extract(isodow from (coalesce(r.defeated_at, r.ends_at) at time zone 'America/Sao_Paulo'))::integer;
    for p in select h.user_id, sum(h.damage)::integer as damage, rank() over (order by sum(h.damage) desc) as pos,
                    bool_or(h.final_blow) as final_blow
               from public.raid_hits h where h.raid_id = r.id group by h.user_id loop
      -- XP = dano ÷ 2 (até 300), sempre
      insert into public.raid_rewards (raid_id, user_id, kind, xp)
      values (r.id, p.user_id, 'participacao',
              least(private.param_num('raid', 'hitXpWeekCap', 300),
                    floor(p.damage / private.param_num('raid', 'hitXpDivisor', 2)))::integer)
      on conflict do nothing;
      if r.status = 'defeated' and p.damage >= v_min_damage then
        -- baú do chefão: até quinta = 15% lendário / 85% raro; sexta e sábado = raro; domingo = comum
        v_chest := case when v_dow <= 4 then
                          case when get_byte(decode(md5(r.id::text || p.user_id::text), 'hex'), 0) / 256.0 < 0.15
                               then 'lendario' else 'raro' end
                        when v_dow <= 6 then 'raro' else 'comum' end;
        insert into public.raid_rewards (raid_id, user_id, kind, xp, chest_rarity, medal_tier)
        values (r.id, p.user_id, 'derrota', private.param_num('raid', 'defeatXp', 200)::integer, v_chest,
                case when p.final_blow then 'ouro' when p.pos <= 10 then 'prata' else 'bronze' end)
        on conflict do nothing;
        if found then
          perform private.add_bonus_chest(p.user_id, v_chest);
          perform private.award_medal(p.user_id, 'chefao',
                                      case when p.final_blow then 'ouro' when p.pos <= 10 then 'prata' else 'bronze' end,
                                      r.boss_id, null);
        end if;
        if p.final_blow then
          insert into public.raid_rewards (raid_id, user_id, kind, cosmetic_id)
          values (r.id, p.user_id, 'golpe_final', 'moldura-golpe-final') on conflict do nothing;
          perform private.grant_cosmetic(p.user_id, 'moldura-golpe-final', '', 'raid:' || r.id);
        end if;
      end if;
      if p.pos <= 10 and p.damage >= v_min_damage then
        insert into public.raid_rewards (raid_id, user_id, kind, cosmetic_id)
        values (r.id, p.user_id, 'top10', 'titulo-cacador') on conflict do nothing;
        perform private.grant_cosmetic(p.user_id, 'titulo-cacador', r.boss_id, 'raid:' || r.id);
      end if;
      perform private.grant_xp(p.user_id, 'raid', r.id::text || ':' || rw.kind, rw.xp)
         from public.raid_rewards rw where rw.raid_id = r.id and rw.user_id = p.user_id and rw.xp > 0;
      if private.notify_pref(p.user_id, 'raid') then
        insert into public.notifications (user_id, type, title, body, data)
        values (p.user_id, 'raid',
                case when r.status = 'defeated' then 'Chefão derrotado!' else 'O chefão fugiu' end,
                case when r.status = 'defeated' then 'A cidade venceu. Sua recompensa está no resumo.'
                     else 'Ele volta mais fraco na próxima semana. Sua parte já virou XP.' end,
                jsonb_build_object('kind', 'raid_result', 'raidId', r.id, 'bossId', r.boss_id, 'status', r.status,
                                   'damage', p.damage));
      end if;
    end loop;
    update public.raids set rewarded_at = now() where id = r.id;
    v_rewarded := v_rewarded + 1;
  end loop;

  -- 3. pontos fracos do dia (a partir da fase 2), sorteados por semente do raid + dia
  for w in select * from public.raids where status = 'active' and phase >= 2
             and p_now >= ((v_day + time '06:00') at time zone 'America/Sao_Paulo') loop
    if (select count(*) from public.raid_weak_points x where x.raid_id = w.id and x.day = v_day)
       < private.param_num('raid', 'weakPointsPerDay', 3) then
      insert into public.raid_weak_points (raid_id, day, zone_id)
      select w.id, v_day, z.id from public.zones z
       where not z.blocked and (w.city is null or z.city = w.city)
       order by md5(w.id::text || v_day::text || z.id)
       limit private.param_num('raid', 'weakPointsPerDay', 3)::integer
      on conflict do nothing;
      get diagnostics v_n = row_count;
      v_weak := v_weak + v_n;
    end if;
  end loop;

  -- 4. abre a semana (só com a flag ligada e dentro da janela segunda 06:00 → domingo 21:00)
  if private.feature_on('raid') then
    select * into w from private.raid_window(p_now);
    if p_now >= w.starts_at and p_now < w.ends_at
       and not exists (select 1 from public.raids x where x.week_start = w.week_start and x.city is null) then
      select * into v_prev from public.raids x where x.city is null and x.week_start < w.week_start
       order by x.week_start desc limit 1;
      v_factor := coalesce(v_prev.factor, 1)
                  + case when v_prev.status = 'defeated'
                              and v_prev.defeated_at < ((v_prev.week_start + 5) + time '00:00') at time zone 'America/Sao_Paulo'
                           then private.param_num('raid', 'factorStep', 0.1)
                         when v_prev.status = 'escaped' then -private.param_num('raid', 'factorStep', 0.1)
                         else 0 end;
      v_factor := least(private.param_num('raid', 'factorMax', 1.5), greatest(private.param_num('raid', 'factorMin', 0.7), v_factor));
      -- mediana dos km semanais (corridas aceitas) das 4 semanas anteriores
      select percentile_cont(0.5) within group (order by km) into v_median from (
        select coalesce(sum(a.meters), 0) / 1000.0 as km
          from generate_series(1, 4) g
          left join public.activities a
            on a.scored and a.status in ('valid', 'partial')
           and a.ended_at >= ((w.week_start - 7 * g) + time '00:00') at time zone 'America/Sao_Paulo'
           and a.ended_at < ((w.week_start - 7 * (g - 1)) + time '00:00') at time zone 'America/Sao_Paulo'
         group by g) s;
      v_hp := greatest(private.param_num('raid', 'hpMin', 500),
                       round(private.param_num('raid', 'hpShare', 0.75) * coalesce(v_median, 0)
                             * private.param_num('raid', 'damagePerKm', 10) * v_factor))::integer;
      v_boss := private.raid_pick_boss(w.week_start);
      if v_boss is not null then
        insert into public.raids (boss_id, city, week_start, starts_at, ends_at, hp_max, hp, factor)
        values (v_boss, null, w.week_start, w.starts_at, w.ends_at, v_hp, v_hp, v_factor)
        on conflict do nothing;
        get diagnostics v_opened = row_count;
      end if;
    end if;
  end if;

  return jsonb_build_object('closed', v_closed, 'rewarded', v_rewarded, 'weakPoints', v_weak, 'opened', v_opened);
end $$;
revoke all on function public.job_raid_tick(timestamptz) from public, anon, authenticated;
grant execute on function public.job_raid_tick(timestamptz) to service_role;

-- A cada 10 min (UTC). Abre segunda 06:00 BRT (09:00 UTC), fecha domingo 21:00 BRT (segunda 00:00 UTC).
select cron.schedule('nomaderun-raid-tick', '*/10 * * * *', 'select public.job_raid_tick()');
