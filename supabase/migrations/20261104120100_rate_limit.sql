-- Fase 8, onda C, C3 (E10 + E9): limite de chamadas por pessoa nas Edge Functions (S7 de docs/melhoria/F8/04 §6, D-99).
--
-- Por que no banco e não só na memória da function: cada chamada pode cair num isolate diferente (e o isolate
-- morre depois de alguns segundos ocioso), então um contador em memória deixa passar N × o limite. O contador fica
-- numa tabela pequena em `private` (uma linha por pessoa e por balde) e é atualizado numa função `svc_*` só do
-- service role. A function cai para um contador em memória só se esta função não responder (servidor antigo,
-- banco fora): o limite fica mais frouxo, nunca bloqueia quem não devia (supabase/functions/_shared/rate-limit.ts).
--
-- Algoritmo: janela deslizante aproximada por duas janelas fixas (a anterior pesa pela fração que ainda cabe na
-- janela atual): estimativa = anteriores × (1 − decorrido/janela) + atuais. Chamada recusada não conta (quem insiste
-- não fica preso para sempre). Precisão de ~1 chamada, uma linha por pessoa/balde, sem varrer histórico.
-- Migration aditiva: não muda nada que já existe.

create table if not exists private.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket ~ '^[a-z][a-z_]{0,31}$'),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  prev_hits integer not null default 0 check (prev_hits >= 0),
  primary key (user_id, bucket)
);

comment on table private.rate_limits is
  'Contador de chamadas por pessoa e balde (geral, ingest, finish, conta) das Edge Functions. Escrito só por svc_rate_limit_hit.';

-- Defesa em profundidade: RLS ligada e nenhuma política; só a função security definer escreve.
alter table private.rate_limits enable row level security;
revoke all on table private.rate_limits from public, anon, authenticated;

create or replace function public.svc_rate_limit_hit(p_user uuid, p_bucket text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_epoch double precision := extract(epoch from clock_timestamp());
  v_start timestamptz;
  v_elapsed double precision;
  v_row private.rate_limits;
  v_prev integer;
  v_hits integer;
  v_est double precision;
  v_retry double precision;
begin
  if p_user is null then raise exception 'VALIDATION: pessoa ausente' using errcode = 'P0001'; end if;
  if p_bucket is null or p_bucket !~ '^[a-z][a-z_]{0,31}$' then
    raise exception 'VALIDATION: balde inválido' using errcode = 'P0001';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'VALIDATION: limite fora de 1..10000' using errcode = 'P0001';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'VALIDATION: janela fora de 1..3600 s' using errcode = 'P0001';
  end if;

  v_start := to_timestamp(floor(v_epoch / p_window_seconds) * p_window_seconds);
  v_elapsed := v_epoch - extract(epoch from v_start);

  insert into private.rate_limits (user_id, bucket, window_start, hits, prev_hits)
  values (p_user, p_bucket, v_start, 0, 0)
  on conflict (user_id, bucket) do nothing;

  -- trava a linha: chamadas simultâneas da mesma pessoa no mesmo balde contam uma de cada vez
  select * into v_row from private.rate_limits where user_id = p_user and bucket = p_bucket for update;

  if v_row.window_start = v_start then
    v_prev := v_row.prev_hits; v_hits := v_row.hits;
  elsif v_row.window_start = v_start - make_interval(secs => p_window_seconds) then
    v_prev := v_row.hits; v_hits := 0;
  else
    v_prev := 0; v_hits := 0;
  end if;

  v_est := v_prev * (1 - v_elapsed / p_window_seconds) + v_hits;

  if v_est + 1 > p_limit then
    update private.rate_limits set window_start = v_start, hits = v_hits, prev_hits = v_prev
     where user_id = p_user and bucket = p_bucket;
    if v_hits + 1 > p_limit then
      -- a janela atual sozinha já encheu: espera ela virar e a anterior (= estas) pesar pouco o bastante
      v_retry := (p_window_seconds - v_elapsed) + p_window_seconds * (1 - (p_limit - 1)::double precision / v_hits);
    else
      -- falta a janela anterior perder peso: anteriores × (1 − t/janela) + atuais + 1 ≤ limite
      v_retry := p_window_seconds * (1 - (p_limit - 1 - v_hits)::double precision / v_prev) - v_elapsed;
    end if;
    return jsonb_build_object('allowed', false, 'remaining', 0,
                              'retryAfter', greatest(1, least(p_window_seconds, ceil(v_retry)::integer)));
  end if;

  update private.rate_limits set window_start = v_start, hits = v_hits + 1, prev_hits = v_prev
   where user_id = p_user and bucket = p_bucket;
  return jsonb_build_object('allowed', true, 'remaining', greatest(0, floor(p_limit - v_est - 1)::integer), 'retryAfter', 0);
end $$;

comment on function public.svc_rate_limit_hit(uuid, text, integer, integer) is
  'Conta 1 chamada de p_user no balde p_bucket (janela deslizante de p_window_seconds). Devolve {allowed, remaining, retryAfter}. Só o service role.';

revoke all on function public.svc_rate_limit_hit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.svc_rate_limit_hit(uuid, text, integer, integer) to service_role;
