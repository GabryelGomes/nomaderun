-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-68): Liga semanal real.
--   * a pessoa entra na 1ª corrida aceita da semana (Brasília), sem cadastro: quem não corre não entra;
--   * grupos de até 30 da mesma divisão (Calçada, Rua, Avenida, Rodovia, Maratona); com gente suficiente, grupos por
--     volume parecido (faixa de km semanais das 4 semanas anteriores);
--   * pontos = pontos da corrida (rp_total, esforço relativo com teto diário); idempotente por corrida;
--   * fecha na segunda às 03:20 (Brasília): corrida de domingo que sincronizar até lá ainda conta; depois, a semana
--     recusa pontos;
--   * grupo pequeno: vagas de subida e de descida = min(5, ⌊n/5⌋) (grupo com menos de 5 não move ninguém);
--     subir exige pontos > 0; desempate por quem chegou primeiro aos pontos.
-- A regra pura fica em src/domain/league.ts (E3); estes números vêm de game_config.league.

create table public.league_groups (
  id uuid primary key default gen_random_uuid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  division smallint not null check (division between 0 and 4),
  bucket smallint not null default 0 check (bucket between 0 and 9),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  size_at_close smallint
);
create index league_groups_open_idx on public.league_groups (week_start, division, bucket) where closed_at is null;

create table public.league_members (
  week_start date not null check (extract(isodow from week_start) = 1),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.league_groups (id) on delete cascade,
  division smallint not null check (division between 0 and 4),
  bucket smallint not null default 0,
  points integer not null default 0 check (points >= 0),
  runs integer not null default 0 check (runs >= 0),
  joined_at timestamptz not null default now(),
  last_points_at timestamptz not null default now(),
  final_rank smallint,
  outcome text check (outcome in ('promoted', 'stays', 'relegated')),
  primary key (week_start, user_id)
);
create index league_members_group_idx on public.league_members (group_id, points desc);
create index league_members_user_idx on public.league_members (user_id, week_start desc);

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
alter table public.league_entries enable row level security;
alter table public.league_standings enable row level security;
revoke all on public.league_groups, public.league_members, public.league_entries, public.league_standings from anon, authenticated;
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
-- Auxiliares
-- ===========================================================================
create or replace function private.week_start_br(p_at timestamptz) returns date
language sql stable set search_path = '' as $$ select date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date $$;
revoke all on function private.week_start_br(timestamptz) from public, anon, authenticated;

-- Fechamento da semana: segunda seguinte às 03:20 (Brasília).
create or replace function private.league_closes_at(p_week date) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select ((p_week + 7) + coalesce((select (g.value ->> 'closesAt')::time from public.game_config g where g.key = 'league'), time '03:20'))
         at time zone 'America/Sao_Paulo'
$$;
revoke all on function private.league_closes_at(date) from public, anon, authenticated;

-- Vagas de subida/descida: min(5, ⌊n/5⌋).
create or replace function private.league_slots(p_size integer) returns integer
language sql stable security definer set search_path = '' as $$
  select least(private.param_num('league', 'maxSlots', 5), floor(p_size / private.param_num('league', 'slotDivisor', 5)))::integer
$$;
revoke all on function private.league_slots(integer) from public, anon, authenticated;

-- Faixa de volume: média de km semanais das 4 semanas anteriores contra os limites de game_config (5, 15, 30 km).
create or replace function private.league_bucket(p_user uuid, p_week date) returns smallint
language sql stable security definer set search_path = '' as $$
  select (select count(*) from jsonb_array_elements_text(coalesce((select g.value -> 'volumeBucketsKm' from public.game_config g
                                                                    where g.key = 'league'), '[5, 15, 30]'::jsonb)) l
           where l::numeric <= (select coalesce(sum(a.meters), 0) / 4000.0 from public.activities a
                                 where a.user_id = p_user and a.scored and a.status in ('valid', 'partial')
                                   and a.ended_at >= ((p_week - 28) + time '00:00') at time zone 'America/Sao_Paulo'
                                   and a.ended_at < (p_week + time '00:00') at time zone 'America/Sao_Paulo'))::smallint
$$;
revoke all on function private.league_bucket(uuid, date) from public, anon, authenticated;

create or replace function private.division_name(p_division integer) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select g.value -> 'divisions' ->> p_division from public.game_config g where g.key = 'league'),
                  'Divisão ' || (p_division + 1))
$$;
revoke all on function private.division_name(integer) from public, anon, authenticated;

-- ===========================================================================
-- Pontos de uma corrida aceita (chamado pela gravação v2 do finish-activity, onda 2). Idempotente por corrida.
-- p_points: pontos do domain (null = rp_total da corrida). p_now só existe para os testes.
-- ===========================================================================
create or replace function private.add_league_points(p_activity uuid, p_points integer default null, p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.activities;
  e public.league_entries;
  m public.league_members;
  v_week date;
  v_points integer;
  v_div smallint;
  v_bucket smallint;
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
     or exists (select 1 from public.league_groups g where g.week_start = v_week and g.closed_at is not null) then
    return jsonb_build_object('weekStart', v_week, 'error', 'WEEK_CLOSED');
  end if;
  v_points := greatest(0, coalesce(p_points, a.rp_total, 0));

  select * into m from public.league_members where week_start = v_week and user_id = a.user_id for update;
  if m.user_id is null then
    v_div := coalesce((select s.division from public.league_standings s where s.user_id = a.user_id), 0);
    v_bucket := private.league_bucket(a.user_id, v_week);
    perform pg_advisory_xact_lock(hashtextextended('league:' || v_week || ':' || v_div, 0));
    -- 1) grupo aberto da mesma divisão e faixa; 2) com pouca gente na divisão, qualquer grupo aberto (o mais parecido);
    -- 3) senão, grupo novo
    select g.id into v_group from public.league_groups g
     where g.week_start = v_week and g.division = v_div and g.closed_at is null and g.bucket = v_bucket
       and (select count(*) from public.league_members x where x.group_id = g.id) < v_size
     order by g.created_at limit 1;
    if v_group is null and (select count(*) from public.league_members x where x.week_start = v_week and x.division = v_div) < v_size then
      select g.id into v_group from public.league_groups g
       where g.week_start = v_week and g.division = v_div and g.closed_at is null
         and (select count(*) from public.league_members x where x.group_id = g.id) < v_size
       order by abs(g.bucket - v_bucket), g.created_at limit 1;
    end if;
    if v_group is null then
      insert into public.league_groups (week_start, division, bucket) values (v_week, v_div, v_bucket) returning id into v_group;
    end if;
    insert into public.league_members (week_start, user_id, group_id, division, bucket)
    values (v_week, a.user_id, v_group, v_div, v_bucket)
    returning * into m;
  end if;

  insert into public.league_entries (activity_id, week_start, user_id, points) values (a.id, v_week, a.user_id, v_points);
  update public.league_members
     set points = points + v_points, runs = runs + 1,
         last_points_at = case when v_points > 0 then now() else last_points_at end
   where week_start = v_week and user_id = a.user_id
  returning * into m;
  return jsonb_build_object('weekStart', v_week, 'points', v_points, 'total', m.points, 'division', m.division,
                            'divisionName', private.division_name(m.division), 'repeated', false);
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
  v_slots integer;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if not private.feature_on('league') then
    raise exception 'FEATURE_DISABLED: liga ainda não está ligada' using errcode = 'P0001';
  end if;
  select * into m from public.league_members where week_start = v_week and user_id = v_uid;
  select * into l from public.league_members where user_id = v_uid and outcome is not null order by week_start desc limit 1;
  v_div := coalesce(m.division, (select s.division from public.league_standings s where s.user_id = v_uid), 0);
  v_size := (select count(*) from public.league_members x where x.group_id = m.group_id);
  v_slots := private.league_slots(coalesce(v_size, 0));
  return jsonb_build_object(
    'weekStart', v_week,
    'closesAt', private.ts_to_ms(private.league_closes_at(v_week)),
    'division', v_div,
    'divisionName', private.division_name(v_div),
    'joined', m.user_id is not null,
    'groupSize', coalesce(v_size, 0),
    'promoteSlots', case when v_div < 4 then v_slots else 0 end,
    'relegateSlots', case when v_div > 0 then v_slots else 0 end,
    'members', coalesce((select jsonb_agg(jsonb_build_object('position', t.pos, 'username', t.username, 'faction', t.faction,
                                                             'avatarUrl', t.avatar_url, 'points', t.points, 'you', t.user_id = v_uid,
                                                             'zone', case when t.pos <= v_slots and t.points > 0 and v_div < 4 then 'promote'
                                                                          when t.pos > v_size - v_slots and v_div > 0 then 'relegate' end)
                                          order by t.pos)
        from (select lm.user_id, pp.username, pp.faction, pp.avatar_url, lm.points,
                     row_number() over (order by lm.points desc, lm.last_points_at, lm.joined_at) as pos
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
-- Fechamento (segunda 03:20 BRT; idempotente por grupo). Fecha toda semana anterior que já passou da hora,
-- inclusive uma que o job tenha perdido.
-- ===========================================================================
create or replace function public.job_close_league(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer := 0;
  g public.league_groups;
  v_size integer;
  v_slots integer;
  o record;
begin
  for g in select * from public.league_groups x
            where x.closed_at is null and p_now >= private.league_closes_at(x.week_start)
            order by x.week_start, x.id for update skip locked loop
    v_size := (select count(*) from public.league_members x where x.group_id = g.id);
    v_slots := private.league_slots(v_size);
    for o in
      with ranked as (
        select lm.user_id, lm.points,
               row_number() over (order by lm.points desc, lm.last_points_at, lm.joined_at) as pos
          from public.league_members lm where lm.group_id = g.id
      )
      select r.user_id, r.pos, r.points,
             case when r.pos <= v_slots and r.points > 0 and g.division < 4 then 'promoted'
                  when r.pos > v_size - v_slots and g.division > 0 then 'relegated'
                  else 'stays' end as res
        from ranked r
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
  return n;
end $$;
revoke all on function public.job_close_league(timestamptz) from public, anon, authenticated;
grant execute on function public.job_close_league(timestamptz) to service_role;

-- Segunda 03:20 de Brasília = 06:20 UTC.
select cron.schedule('nomaderun-close-league', '20 6 * * 1', 'select public.job_close_league()');
