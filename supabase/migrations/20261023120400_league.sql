-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-68; contrato E3 §2.4 e §4.3): Liga semanal real.
-- Mesmas regras de src/domain/league.ts (E3):
--   * semana = leagueWeek: segunda 00:00 → fecha na segunda seguinte às 03:20 (Brasília); corrida de domingo que
--     sincronizar até lá ainda conta; depois, a semana recusa pontos;
--   * a pessoa entra na 1ª corrida aceita da semana (sem cadastro: quem não corre não entra);
--   * grupos de até 30 da mesma divisão (Calçada, Rua, Avenida, Rodovia, Maratona):
--       - no fechamento, leagueGroupsV2 monta os grupos da semana seguinte para quem jogou (por divisão nova, ordenados
--         pelo volume das 4 últimas semanas, em ⌈n/30⌉ blocos de tamanhos quase iguais) e guarda como reserva;
--       - na 1ª corrida, quem tem reserva entra no seu grupo; quem não tem segue leaguePlaceNewcomer (último grupo da
--         divisão, se tiver vaga; senão, um grupo novo);
--   * pontos = pontos da corrida (scoreRunV2 na gravação v2; rp_total enquanto ela não existe), idempotente por corrida;
--   * fechamento = leagueStandingsV2: pontos, depois quem chegou antes aos pontos (reached_at), depois o id; sobem e
--     descem min(5, ⌊n/6⌋); grupo pequeno (< 6): só o 1º sobe (se pontuou) e ninguém desce; quem fez 0 nunca sobe.

create table public.league_groups (
  id uuid primary key default gen_random_uuid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  division smallint not null check (division between 0 and 4),
  idx smallint not null check (idx >= 0),               -- LeagueGroup.index
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  size_at_close smallint,
  unique (week_start, division, idx)
);
create index league_groups_open_idx on public.league_groups (week_start, division) where closed_at is null;

create table public.league_members (
  week_start date not null check (extract(isodow from week_start) = 1),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.league_groups (id) on delete cascade,
  division smallint not null check (division between 0 and 4),
  points integer not null default 0 check (points >= 0),
  runs integer not null default 0 check (runs >= 0),
  joined_at timestamptz not null default now(),
  reached_at timestamptz not null default now(),        -- quando chegou aos pontos atuais (desempate)
  final_rank smallint,
  outcome text check (outcome in ('promoted', 'stays', 'relegated')),
  primary key (week_start, user_id)
);
create index league_members_group_idx on public.league_members (group_id, points desc);
create index league_members_user_idx on public.league_members (user_id, week_start desc);

-- vaga reservada pelo fechamento (leagueGroupsV2) para a semana seguinte; vira membro na 1ª corrida
create table public.league_reservations (
  week_start date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.league_groups (id) on delete cascade,
  volume_m bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (week_start, user_id)
);
create index league_reservations_group_idx on public.league_reservations (group_id);

-- uma linha por corrida que contou (idempotência e auditoria)
create table public.league_entries (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  week_start date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null check (points >= 0),
  created_at timestamptz not null default now()
);
create index league_entries_user_idx on public.league_entries (user_id, week_start);

create table public.league_standings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  division smallint not null default 0 check (division between 0 and 4),
  best_division smallint not null default 0 check (best_division between 0 and 4),
  weeks_played integer not null default 0 check (weeks_played >= 0),
  updated_at timestamptz not null default now()
);

alter table public.league_groups enable row level security;
alter table public.league_members enable row level security;
alter table public.league_reservations enable row level security;
alter table public.league_entries enable row level security;
alter table public.league_standings enable row level security;
revoke all on public.league_groups, public.league_members, public.league_reservations, public.league_entries,
              public.league_standings from anon, authenticated;
-- o grupo inteiro só sai pelo RPC league_current (nome, time, foto e pontos, sem ids); a tabela mostra só o próprio
grant select on public.league_members, public.league_entries, public.league_standings to authenticated;
create policy league_members_select_own on public.league_members for select to authenticated using (user_id = (select auth.uid()));
create policy league_entries_select_own on public.league_entries for select to authenticated using (user_id = (select auth.uid()));
create policy league_standings_select_own on public.league_standings for select to authenticated using (user_id = (select auth.uid()));
create policy league_members_active_account on public.league_members as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy league_entries_active_account on public.league_entries as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy league_standings_active_account on public.league_standings as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

-- ===========================================================================
-- Auxiliares (paridade com league.ts)
-- ===========================================================================
create or replace function private.week_start_br(p_at timestamptz) returns date
language sql stable set search_path = '' as $$ select date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date $$;
revoke all on function private.week_start_br(timestamptz) from public, anon, authenticated;

-- leagueWeek(...).closesAt: segunda seguinte às 03:20 (Brasília).
create or replace function private.league_closes_at(p_week date) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select ((p_week + 7) + coalesce((select (g.value ->> 'closesAt')::time from public.game_config g where g.key = 'league'), time '03:20'))
         at time zone 'America/Sao_Paulo'
$$;
revoke all on function private.league_closes_at(date) from public, anon, authenticated;

-- leagueMovesFor: 0 abaixo de 6 pessoas; senão min(5, ⌊n/6⌋).
create or replace function private.league_moves(p_size integer) returns integer
language sql stable security definer set search_path = '' as $$
  select case when p_size < private.param_num('league', 'smallGroup', 6) then 0
              else least(private.param_num('league', 'movesMax', 5), floor(p_size / private.param_num('league', 'moveEvery', 6))) end::integer
$$;
revoke all on function private.league_moves(integer) from public, anon, authenticated;

-- Volume para agrupar: metros das corridas aceitas nas 4 semanas antes de p_week.
create or replace function private.league_volume(p_user uuid, p_week date) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(round(sum(a.meters)), 0)::bigint from public.activities a
   where a.user_id = p_user and a.scored and a.status in ('valid', 'partial')
     and coalesce(a.ended_at, a.finished_at) >= ((p_week - 7 * private.param_num('league', 'volumeWeeks', 4)::integer) + time '00:00')
                                                 at time zone 'America/Sao_Paulo'
     and coalesce(a.ended_at, a.finished_at) < (p_week + time '00:00') at time zone 'America/Sao_Paulo'
$$;
revoke all on function private.league_volume(uuid, date) from public, anon, authenticated;

create or replace function private.division_name(p_division integer) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select g.value -> 'divisions' ->> p_division from public.game_config g where g.key = 'league'),
                  'Divisão ' || (p_division + 1))
$$;
revoke all on function private.division_name(integer) from public, anon, authenticated;

-- Ocupação de um grupo: membros + reservas ainda não usadas.
create or replace function private.league_group_size(p_group uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.league_members m where m.group_id = p_group)::integer
       + (select count(*) from public.league_reservations r where r.group_id = p_group
            and not exists (select 1 from public.league_members m where m.week_start = r.week_start and m.user_id = r.user_id))::integer
$$;
revoke all on function private.league_group_size(uuid) from public, anon, authenticated;

-- ===========================================================================
-- Pontos de uma corrida aceita (chamado pela gravação v2 do finish-activity, onda 2). Idempotente por corrida.
-- p_points: pontos do domain (scoreRunV2; null = rp_total da corrida). p_now só existe para os testes.
-- ===========================================================================
create or replace function private.add_league_points(p_activity uuid, p_points integer default null, p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.activities;
  e public.league_entries;
  m public.league_members;
  g public.league_groups;
  v_week date;
  v_points integer;
  v_div smallint;
  v_group uuid;
  v_size integer := private.param_num('league', 'groupSize', 30)::integer;
begin
  select * into e from public.league_entries where activity_id = p_activity;
  if e.activity_id is not null then
    select * into m from public.league_members where week_start = e.week_start and user_id = e.user_id;
    return jsonb_build_object('weekStart', e.week_start, 'points', e.points, 'total', m.points, 'division', m.division,
                              'repeated', true);
  end if;
  if not private.feature_on('league') then
    return null;
  end if;
  select * into a from public.activities where id = p_activity;
  if a.id is null or not a.scored or a.status not in ('valid', 'partial') then
    return null;
  end if;
  v_week := private.week_start_br(coalesce(a.ended_at, a.finished_at));
  -- semana já fechada (ou passou do horário de fechar): corrida sincronizada tarde demais não muda a liga
  if p_now >= private.league_closes_at(v_week)
     or exists (select 1 from public.league_groups x where x.week_start = v_week and x.closed_at is not null) then
    return jsonb_build_object('weekStart', v_week, 'error', 'WEEK_CLOSED');
  end if;
  v_points := greatest(0, coalesce(p_points, a.rp_total, 0));

  select * into m from public.league_members where week_start = v_week and user_id = a.user_id for update;
  if m.user_id is null then
    v_div := coalesce((select s.division from public.league_standings s where s.user_id = a.user_id), 0);
    perform pg_advisory_xact_lock(hashtextextended('league:' || v_week || ':' || v_div, 0));
    -- 1) vaga reservada no fechamento (leagueGroupsV2)
    select r.group_id into v_group from public.league_reservations r join public.league_groups x on x.id = r.group_id
     where r.week_start = v_week and r.user_id = a.user_id and x.closed_at is null and x.division = v_div;
    -- 2) leaguePlaceNewcomer: último grupo da divisão, se tiver vaga; senão, um grupo novo
    if v_group is null then
      select * into g from public.league_groups x where x.week_start = v_week and x.division = v_div
       order by x.idx desc limit 1;
      if g.id is not null and private.league_group_size(g.id) < v_size then
        v_group := g.id;
      else
        insert into public.league_groups (week_start, division, idx) values (v_week, v_div, coalesce(g.idx + 1, 0))
        returning id into v_group;
      end if;
    end if;
    insert into public.league_members (week_start, user_id, group_id, division, reached_at, joined_at)
    values (v_week, a.user_id, v_group, v_div, p_now, p_now)
    returning * into m;
  end if;

  insert into public.league_entries (activity_id, week_start, user_id, points) values (a.id, v_week, a.user_id, v_points);
  update public.league_members
     set points = points + v_points, runs = runs + 1,
         reached_at = case when v_points > 0 then p_now else reached_at end
   where week_start = v_week and user_id = a.user_id
  returning * into m;
  return jsonb_build_object('weekStart', v_week, 'points', v_points, 'total', m.points, 'division', m.division,
                            'divisionName', private.division_name(m.division),
                            'groupSize', (select count(*) from public.league_members x where x.group_id = m.group_id),
                            'rank', (select t.pos from (select x.user_id, row_number() over (order by x.points desc, x.reached_at, x.user_id) as pos
                                                          from public.league_members x where x.group_id = m.group_id) t
                                      where t.user_id = m.user_id),
                            'repeated', false);
end $$;
revoke all on function private.add_league_points(uuid, integer, timestamptz) from public, anon, authenticated;

-- ===========================================================================
-- Tela da liga: só o próprio grupo (posição, nome, time, foto, pontos, "você"), vagas e prazo.
-- ===========================================================================
create or replace function public.league_current() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_week date := private.week_start_br(now());
  m public.league_members;
  l public.league_members;
  v_div smallint;
  v_size integer;
  v_moves integer;
  v_small boolean;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('league') then
    raise exception 'FEATURE_DISABLED: liga ainda não está ligada' using errcode = 'P0001';
  end if;
  select * into m from public.league_members where week_start = v_week and user_id = v_uid;
  select * into l from public.league_members where user_id = v_uid and outcome is not null order by week_start desc limit 1;
  v_div := coalesce(m.division, (select s.division from public.league_standings s where s.user_id = v_uid), 0);
  v_size := coalesce((select count(*) from public.league_members x where x.group_id = m.group_id), 0);
  v_small := v_size < private.param_num('league', 'smallGroup', 6);
  v_moves := private.league_moves(v_size);
  return jsonb_build_object(
    'weekStart', v_week,
    'closesAt', private.ts_to_ms(private.league_closes_at(v_week)),
    'division', v_div,
    'divisionName', private.division_name(v_div),
    'joined', m.user_id is not null,
    'groupSize', v_size,
    'smallGroup', v_small,
    'promoteSlots', case when v_div >= 4 then 0 when v_small then 1 else v_moves end,
    'relegateSlots', case when v_div <= 0 or v_small then 0 else v_moves end,
    'members', coalesce((select jsonb_agg(jsonb_build_object('position', t.pos, 'username', t.username, 'faction', t.faction,
                                                             'avatarUrl', t.avatar_url, 'points', t.points, 'you', t.user_id = v_uid,
                                                             'zone', case when v_div < 4 and t.points > 0
                                                                               and (case when v_small then t.pos = 1 else t.pos <= v_moves end)
                                                                          then 'promote'
                                                                          when v_div > 0 and not v_small and t.pos > v_size - v_moves
                                                                          then 'relegate' end)
                                          order by t.pos)
        from (select lm.user_id, pp.username, pp.faction, pp.avatar_url, lm.points,
                     row_number() over (order by lm.points desc, lm.reached_at, lm.user_id) as pos
                from public.league_members lm join private.public_profiles() pp on pp.id = lm.user_id
               where lm.group_id = m.group_id) t), '[]'::jsonb),
    'lastResult', case when l.user_id is null then null
                       else jsonb_build_object('weekStart', l.week_start, 'division', l.division,
                                               'divisionName', private.division_name(l.division), 'finalRank', l.final_rank,
                                               'outcome', l.outcome) end);
end $$;
revoke all on function public.league_current() from public, anon;
grant execute on function public.league_current() to authenticated;

-- ===========================================================================
-- Fechamento (segunda 03:20 BRT; idempotente por grupo). Fecha toda semana que já passou da hora (inclusive uma que o
-- job tenha perdido) e, para cada semana fechada agora, monta os grupos da semana seguinte (leagueGroupsV2).
-- ===========================================================================
create or replace function public.job_close_league(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer := 0;
  v_week date;
  g public.league_groups;
  v_size integer;
  v_moves integer;
  v_small boolean;
  o record;
  x record;
  v_next date;
  v_cur_div integer;
  v_cur_idx integer;
  v_offset integer;
  v_group uuid;
begin
  for v_week in select distinct lg.week_start from public.league_groups lg
                 where lg.closed_at is null and p_now >= private.league_closes_at(lg.week_start) order by 1 loop
    for g in select * from public.league_groups lg where lg.week_start = v_week and lg.closed_at is null
              order by lg.division, lg.idx for update skip locked loop
      v_size := (select count(*) from public.league_members lm where lm.group_id = g.id);
      v_small := v_size < private.param_num('league', 'smallGroup', 6);
      v_moves := private.league_moves(v_size);
      for o in
        select r.user_id, r.pos, r.points,
               case when g.division < 4 and r.points > 0 and (case when v_small then r.pos = 1 else r.pos <= v_moves end)
                    then 'promoted'
                    when g.division > 0 and not v_small and r.pos > v_size - v_moves then 'relegated'
                    else 'stays' end as res
          from (select lm.user_id, lm.points, row_number() over (order by lm.points desc, lm.reached_at, lm.user_id) as pos
                  from public.league_members lm where lm.group_id = g.id) r
      loop
        update public.league_members set final_rank = o.pos, outcome = o.res where group_id = g.id and user_id = o.user_id;
        insert into public.league_standings as s (user_id, division, best_division, weeks_played, updated_at)
        values (o.user_id,
                g.division + case o.res when 'promoted' then 1 when 'relegated' then -1 else 0 end,
                g.division + case o.res when 'promoted' then 1 else 0 end, 1, now())
        on conflict (user_id) do update
          set division = excluded.division, best_division = greatest(s.best_division, excluded.division),
              weeks_played = s.weeks_played + 1, updated_at = now();
        if o.res = 'promoted' then
          perform private.award_medal(o.user_id, 'liga',
                                      case when g.division + 1 >= 4 then 'ouro' when g.division + 1 >= 3 then 'prata' else 'bronze' end,
                                      '', null);
        end if;
        if o.res <> 'stays' and private.notify_pref(o.user_id, 'league') then
          insert into public.notifications (user_id, type, title, body, data)
          values (o.user_id, 'league',
                  case o.res when 'promoted' then 'Você subiu de divisão!' else 'Nova divisão na liga' end,
                  case o.res when 'promoted' then 'Agora você está na divisão ' || private.division_name(g.division + 1) || '.'
                             else 'Nesta semana você corre na divisão ' || private.division_name(g.division - 1) || '.' end,
                  jsonb_build_object('kind', 'league_result', 'weekStart', g.week_start, 'outcome', o.res, 'position', o.pos,
                                     'division', g.division + case o.res when 'promoted' then 1 else -1 end));
        end if;
      end loop;
      update public.league_groups set closed_at = now(), size_at_close = v_size where id = g.id;
      n := n + 1;
    end loop;

    -- leagueGroupsV2 para a semana seguinte: quem jogou esta semana, pela divisão nova e pelo volume das 4 últimas
    -- semanas (maior primeiro; empate pelo id), em ⌈n/30⌉ blocos de tamanhos que diferem no máximo em 1.
    v_next := v_week + 7;
    v_cur_div := -1;
    v_cur_idx := -1;
    for x in
      with mem as (
        select lm.user_id, s.division, private.league_volume(lm.user_id, v_next) as vol
          from public.league_members lm join public.league_standings s on s.user_id = lm.user_id
         where lm.week_start = v_week
           and not exists (select 1 from public.league_members y where y.week_start = v_next and y.user_id = lm.user_id)
           and not exists (select 1 from public.league_reservations y where y.week_start = v_next and y.user_id = lm.user_id)
      ), ranked as (
        select mem.*, (row_number() over (partition by mem.division order by mem.vol desc, mem.user_id) - 1)::integer as p,
               (count(*) over (partition by mem.division))::integer as cnt
          from mem
      ), calc as (
        select ranked.*, ceil(cnt / private.param_num('league', 'groupSize', 30))::integer as k from ranked
      )
      select c.user_id, c.division, c.vol,
             case when c.p < (c.cnt % c.k) * (c.cnt / c.k + 1) then c.p / (c.cnt / c.k + 1)
                  else (c.cnt % c.k) + (c.p - (c.cnt % c.k) * (c.cnt / c.k + 1)) / (c.cnt / c.k) end as gidx
        from calc c
       order by c.division, gidx, c.p
    loop
      if x.division <> v_cur_div or x.gidx <> v_cur_idx then
        v_cur_div := x.division;
        v_cur_idx := x.gidx;
        -- próximo índice da divisão (depois de algum grupo que já exista na semana nova)
        v_offset := coalesce((select max(lg.idx) + 1 from public.league_groups lg
                               where lg.week_start = v_next and lg.division = x.division), 0);
        insert into public.league_groups (week_start, division, idx) values (v_next, x.division, v_offset)
        returning id into v_group;
      end if;
      insert into public.league_reservations (week_start, user_id, group_id, volume_m) values (v_next, x.user_id, v_group, x.vol)
      on conflict do nothing;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.job_close_league(timestamptz) from public, anon, authenticated;
grant execute on function public.job_close_league(timestamptz) to service_role;

-- Segunda 03:20 de Brasília = 06:20 UTC.
select cron.schedule('nomaderun-close-league', '20 6 * * 1', 'select public.job_close_league()');
