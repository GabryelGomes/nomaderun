-- DF06 (testes externos, baterias 3 a 5): corrida feita no modo Simulação aparecia como corrida de verdade em outro
-- aparelho, porque a marca ficava só na fila do celular. Aditiva: coluna nova com padrão `false` (o app antigo
-- continua funcionando) e uma function só do `service_role`, chamada pelo `ingest-points`.
alter table public.activities add column if not exists simulated boolean not null default false;

-- Só liga a marca (nunca desliga): quem manda `simulated` só pode rebaixar a própria corrida, nunca promovê-la.
create or replace function public.svc_mark_simulated(p_user uuid, p_activity uuid) returns boolean
language sql security definer set search_path = '' as $$
  with u as (
    update public.activities set simulated = true
     where id = p_activity and user_id = p_user and not simulated
    returning 1
  )
  select exists (select 1 from u)
$$;
revoke all on function public.svc_mark_simulated(uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_mark_simulated(uuid, uuid) to service_role;
