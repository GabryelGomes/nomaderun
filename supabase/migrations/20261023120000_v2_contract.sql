-- NOMADE RUN — Fase 7, onda 1 (T7.1.22, D-80): contrato v2 do servidor.
-- Tudo aditivo e DESLIGADO por padrão: o app publicado (contrato 1) continua igual.
--   * game_config: flags das features novas (todas false) e parâmetros públicos do jogo (nunca segredo);
--   * server_info(): devolve { contract: 2, territoryRule, features, params, serverTime, brToday }. No servidor antigo a
--     RPC não existe (PGRST202) e o app novo deduz contrato 1;
--   * xp_ledger + private.grant_xp: toda recompensa nova passa pelo livro (idempotente por fonte + referência);
--   * profiles.xp nunca diminui (trigger);
--   * notifications.type ganha os tipos novos (superconjunto: o app antigo mostra o tipo desconhecido como 'system').

-- ===========================================================================
-- game_config (leitura para quem está logado; escrita só pelo service role / SQL Editor)
-- ===========================================================================
create table public.game_config (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  check (key <> 'features' or jsonb_typeof(value) = 'object'),
  check (key <> 'territory_rule' or value in ('"v1"'::jsonb, '"v2"'::jsonb))
);
comment on table public.game_config is
  'D-80: flags (features, territory_rule) e parâmetros públicos do jogo. Ligar/desligar sem deploy é o plano de volta atrás. Nunca guarde segredo aqui: todo usuário logado lê.';
create trigger game_config_touch before update on public.game_config for each row execute function private.touch_updated_at();

alter table public.game_config enable row level security;
revoke all on public.game_config from anon, authenticated;
grant select on public.game_config to authenticated;
create policy game_config_read on public.game_config for select to authenticated using (true);

insert into public.game_config (key, value) values
  ('territory_rule', '"v1"'),
  ('features', '{"raid": false, "league": false, "missions": false, "medals": false, "track": false,
                 "dailyChest": false, "feed": false, "records": false, "telemetry": false}'),
  -- D-67 (E3 §9): janela segunda 06:00 → domingo 21:00 (Brasília); 10 de dano por km; crítico 10%;
  -- tetos de 21 km por corrida e 30 km por dia; fases 100/67/33 %; 3 pontos fracos por dia a partir da fase 2.
  ('raid', '{"damagePerKm": 10, "critChance": 0.10, "runCapKm": 21, "dayCapKm": 30, "maxMultiplier": 5,
             "phases": [0.67, 0.33], "weakPointsPerDay": 3, "weakPointMultiplier": 2,
             "hpMin": 500, "hpShare": 0.75, "factorMin": 0.7, "factorMax": 1.5, "factorStep": 0.1,
             "opensAt": "06:00", "closesAt": "21:00", "rewardMinDamage": 10,
             "defeatXp": 200, "hitXpDivisor": 2, "hitXpWeekCap": 300}'),
  -- D-68: grupos de até 30; pontos = pontos da corrida (rp_total); fecha segunda 03:20 (Brasília);
  -- grupo pequeno: vagas = min(5, ⌊n/5⌋); subir exige pontos > 0.
  ('league', '{"groupSize": 30, "maxSlots": 5, "slotDivisor": 5, "divisions": ["Calçada", "Rua", "Avenida", "Rodovia", "Maratona"],
               "closesAt": "03:20", "volumeBucketsKm": [5, 15, 30]}'),
  -- D-65: 3 diárias + 3 semanais (1 leve, 1 padrão, 1 desafio); troca de 1 diária por dia; primeira semana com 7 passos.
  ('missions', '{"daily": 3, "weekly": 3, "rerollsPerDay": 1, "ftueSteps": 7, "ftueWindowDays": 14}'),
  -- D-66 (E7 §7): crédito diário que acumula até 3; abre com atividade ≥ 1 km ou ≥ 15 min; 20º sem lendário = lendário.
  ('daily_chest', '{"maxStored": 3, "pityAt": 20, "minMeters": 1000, "minMovingSeconds": 900,
                    "odds": {"comum": 0.70, "raro": 0.25, "lendario": 0.05},
                    "xp": {"comum": 15, "raro": 40, "lendario": 100},
                    "cosmeticChance": {"comum": 0, "raro": 0.05, "lendario": 0.30}, "duplicateCosmeticXp": 20}'),
  -- E7 §6: trilha da temporada (mês) com 24 degraus de 120 XP; medalha em 8/16/24.
  ('track', '{"steps": 24, "stepXp": 120, "medalSteps": {"bronze": 8, "prata": 16, "ouro": 24}, "maxFreezes": 2}');

-- Flag de uma feature (false quando a chave falta). Só para o servidor (RLS não importa: security definer).
create or replace function private.feature_on(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (g.value ->> p_name)::boolean from public.game_config g where g.key = 'features'), false)
$$;
revoke all on function private.feature_on(text) from public, anon, authenticated;

-- Parâmetro numérico de game_config (ex.: private.param_num('raid', 'runCapKm', 21)).
create or replace function private.param_num(p_key text, p_name text, p_default numeric) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select (g.value ->> p_name)::numeric from public.game_config g where g.key = p_key), p_default)
$$;
revoke all on function private.param_num(text, text, numeric) from public, anon, authenticated;

-- ===========================================================================
-- server_info(): versão do contrato + flags. Sem security definer: lê game_config pela RLS (só authenticated).
-- ===========================================================================
create or replace function public.server_info() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'contract', 2,
    'territoryRule', coalesce((select g.value #>> '{}' from public.game_config g where g.key = 'territory_rule'), 'v1'),
    'features', coalesce((select g.value from public.game_config g where g.key = 'features'), '{}'::jsonb),
    'params', coalesce((select jsonb_object_agg(g.key, g.value) from public.game_config g
                         where g.key not in ('features', 'territory_rule')), '{}'::jsonb),
    'serverTime', (extract(epoch from now()) * 1000)::bigint,
    'brToday', public.br_today())
$$;
revoke all on function public.server_info() from public, anon;
grant execute on function public.server_info() to authenticated, service_role;

-- ===========================================================================
-- xp_ledger: livro de XP (fontes da E7 §10.1 + raid/liga/medalha/trilha)
-- ===========================================================================
create table public.xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('run_distance', 'run_complete', 'fog', 'ghost', 'hunt_chest', 'daily_chest',
                                         'mission', 'week_kept', 'ftue', 'comeback', 'season_step', 'duplicate_cosmetic',
                                         'raid', 'league', 'medal')),
  ref_id text not null check (char_length(ref_id) between 1 and 120),
  amount integer not null check (amount between 1 and 5000),
  season_id text not null default public.current_season_id() check (season_id ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now(),
  unique (user_id, source, ref_id)
);
create index xp_ledger_user_idx on public.xp_ledger (user_id, created_at desc);
create index xp_ledger_user_season_idx on public.xp_ledger (user_id, season_id);
comment on table public.xp_ledger is
  'D-64/D-80: cada crédito de XP com fonte e referência. unique(user_id, source, ref_id) = nenhuma recompensa paga duas vezes. Só cresce.';

alter table public.xp_ledger enable row level security;
revoke all on public.xp_ledger from anon, authenticated;
revoke all on sequence public.xp_ledger_id_seq from anon, authenticated;
grant select on public.xp_ledger to authenticated;
create policy xp_ledger_select on public.xp_ledger for select to authenticated using (user_id = (select auth.uid()));
create policy xp_ledger_active_account on public.xp_ledger as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

-- Credita XP uma única vez por (usuário, fonte, referência). Devolve o XP creditado agora (0 se já existia ou se <= 0).
create or replace function private.grant_xp(p_user uuid, p_source text, p_ref text, p_amount integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_amount integer := least(coalesce(p_amount, 0), 5000);
begin
  if p_user is null or v_amount <= 0 then
    return 0;
  end if;
  insert into public.xp_ledger (user_id, source, ref_id, amount) values (p_user, p_source, p_ref, v_amount)
  on conflict (user_id, source, ref_id) do nothing;
  if not found then
    return 0;
  end if;
  update public.profiles set xp = xp + v_amount where id = p_user;
  return v_amount;
end $$;
revoke all on function private.grant_xp(uuid, text, text, integer) from public, anon, authenticated;

-- Mesma coisa para as Edge Functions (service role), que não enxergam o schema private pela API.
create or replace function public.svc_grant_xp(p_user uuid, p_source text, p_ref text, p_amount integer) returns integer
language sql security definer set search_path = '' as $$
  select private.grant_xp(p_user, p_source, p_ref, p_amount)
$$;
revoke all on function public.svc_grant_xp(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.svc_grant_xp(uuid, text, text, integer) to service_role;

-- XP nunca diminui (D-64): nenhuma escrita, nem do servidor, reduz profiles.xp.
create or replace function private.profiles_xp_monotonic() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.xp < old.xp then
    raise exception 'XP_DECREASE: o XP nunca diminui' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.profiles_xp_monotonic() from public, anon, authenticated;
create trigger profiles_xp_monotonic before update of xp on public.profiles
  for each row execute function private.profiles_xp_monotonic();

-- ===========================================================================
-- Notificações: tipos novos como superconjunto (o CHECK só aceita mais valores; nenhum valor antigo deixa de valer).
-- O app antigo mostra o tipo desconhecido como 'system' (notifications-repo.ts). O tipo fino vai em data.kind.
-- ===========================================================================
alter table public.notifications
  drop constraint notifications_type_check,
  add constraint notifications_type_check
    check (type in ('invasion', 'territory_lost', 'conquest', 'moderation', 'mission', 'system',
                    'raid', 'league', 'kudos', 'medal', 'reward', 'engagement'));

-- Preferência de notificação: chave ausente = ligada (as chaves novas não exigem migrar os perfis antigos).
create or replace function private.notify_pref(p_user uuid, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (pr.notification_prefs ->> p_key)::boolean from public.profiles pr where pr.id = p_user), true)
$$;
revoke all on function private.notify_pref(uuid, text) from public, anon, authenticated;
