-- NOMADE RUN — Fase 7, onda 1 (T7.1.23, D-64/D-65): catálogo de recompensas cosméticas e medalhas.
-- Só cosmético e XP: nada se compra e nada dá vantagem no jogo (D-66, ECA Digital).
--   * cosmetic_defs / user_cosmetics / user_equipped + equip_cosmetic() e unequip_cosmetic();
--   * medal_defs / user_medals + private.award_medal() (idempotente; o nível só sobe: bronze → prata → ouro);
--   * private.grant_cosmetic() (idempotente; repetido vira +20 XP quando vem de baú, E7 §4.5).
-- Os ids são estáveis (arte da E4 em components/art usa os mesmos). O cliente não escreve em nenhuma tabela.

-- ===========================================================================
-- Cosméticos
-- ===========================================================================
create table public.cosmetic_defs (
  id text primary key check (id ~ '^[a-z0-9-]{3,48}$'),
  slot text not null check (slot in ('trail', 'frame', 'effect', 'title', 'emblem')),
  name text not null check (char_length(name) between 2 and 40),
  rarity text not null default 'comum' check (rarity in ('comum', 'raro', 'lendario')),
  source text not null check (source in ('titulo', 'faixa', 'trilha', 'bau', 'ftue', 'raid', 'liga', 'evento')),
  in_chest_pool boolean not null default false,
  sort smallint not null default 0,
  active boolean not null default true,
  is_demo boolean not null default false
);
comment on table public.cosmetic_defs is 'E7 §4.5: rastros, molduras, efeitos, títulos e emblemas. Ganha-se jogando; nunca se vende.';

create table public.user_cosmetics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id text not null references public.cosmetic_defs (id),
  -- variante: temporada (AAAA-MM) para os itens do mês, chefão para "Caçador do <chefão>"; '' quando não há
  variant text not null default '' check (variant ~ '^[a-z0-9-]{0,40}$'),
  source text not null check (char_length(source) between 1 and 120),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id, variant)
);

create table public.user_equipped (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null check (slot in ('trail', 'frame', 'effect', 'title', 'emblem')),
  cosmetic_id text not null,
  variant text not null default '',
  equipped_at timestamptz not null default now(),
  primary key (user_id, slot),
  -- só equipa o que possui (a FK garante; se o item sumir, o equipado some junto)
  foreign key (user_id, cosmetic_id, variant) references public.user_cosmetics (user_id, cosmetic_id, variant) on delete cascade
);
create index user_equipped_cosmetic_idx on public.user_equipped (user_id, cosmetic_id, variant);

alter table public.cosmetic_defs enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.user_equipped enable row level security;
revoke all on public.cosmetic_defs, public.user_cosmetics, public.user_equipped from anon, authenticated;
grant select on public.cosmetic_defs, public.user_cosmetics, public.user_equipped to authenticated;
create policy cosmetic_defs_read on public.cosmetic_defs for select to authenticated using (active);
create policy user_cosmetics_select on public.user_cosmetics for select to authenticated using (user_id = (select auth.uid()));
-- o que a pessoa equipou é público (moldura, título e rastro aparecem para os outros, como a foto)
create policy user_equipped_read on public.user_equipped for select to authenticated using (true);
create policy user_cosmetics_active_account on public.user_cosmetics as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));
create policy user_equipped_active_account on public.user_equipped as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

insert into public.cosmetic_defs (id, slot, name, rarity, source, in_chest_pool, sort) values
  -- rastros (10)
  ('rastro-faisca', 'trail', 'Faísca', 'comum', 'titulo', false, 10),
  ('rastro-cometa', 'trail', 'Cometa', 'raro', 'titulo', false, 11),
  ('rastro-temporada', 'trail', 'Rastro do mês', 'comum', 'trilha', false, 12),
  ('rastro-temporada-brilho', 'trail', 'Rastro do mês brilhante', 'raro', 'trilha', false, 13),
  ('rastro-temporada-animado', 'trail', 'Rastro do mês animado', 'lendario', 'trilha', false, 14),
  ('rastro-aurora', 'trail', 'Aurora', 'raro', 'bau', true, 15),
  ('rastro-lava', 'trail', 'Lava', 'raro', 'bau', true, 16),
  ('rastro-gelo', 'trail', 'Gelo', 'raro', 'bau', true, 17),
  ('rastro-oceano', 'trail', 'Oceano', 'lendario', 'bau', true, 18),
  ('rastro-neon', 'trail', 'Neon', 'lendario', 'bau', true, 19),
  -- molduras (16: 8 faixas de corredor por material, primeira semana, títulos, trilha e golpe final do chefão)
  ('moldura-asfalto', 'frame', 'Asfalto', 'comum', 'faixa', false, 30),
  ('moldura-bronze', 'frame', 'Bronze', 'comum', 'faixa', false, 31),
  ('moldura-prata', 'frame', 'Prata', 'comum', 'faixa', false, 32),
  ('moldura-ouro', 'frame', 'Ouro', 'raro', 'faixa', false, 33),
  ('moldura-neon', 'frame', 'Neon', 'raro', 'faixa', false, 34),
  ('moldura-holografica', 'frame', 'Holográfica', 'lendario', 'faixa', false, 35),
  ('moldura-lenda', 'frame', 'Lenda', 'lendario', 'faixa', false, 36),
  ('moldura-nomade', 'frame', 'Nômade', 'lendario', 'faixa', false, 37),
  ('moldura-primeira-semana', 'frame', 'Primeira Semana', 'raro', 'ftue', false, 38),
  ('moldura-bairro', 'frame', 'Bairro', 'comum', 'titulo', false, 39),
  ('moldura-holofote', 'frame', 'Holofote', 'raro', 'titulo', false, 40),
  ('moldura-nomade-animada', 'frame', 'Nômade animada', 'lendario', 'titulo', false, 41),
  ('moldura-temporada', 'frame', 'Moldura do mês', 'comum', 'trilha', false, 42),
  ('moldura-temporada-rara', 'frame', 'Moldura do mês rara', 'raro', 'trilha', false, 43),
  ('moldura-temporada-animada', 'frame', 'Moldura do mês animada', 'lendario', 'trilha', false, 44),
  ('moldura-golpe-final', 'frame', 'Golpe final', 'lendario', 'raid', false, 45),
  -- efeitos de conquista (6)
  ('efeito-pulso', 'effect', 'Pulso', 'comum', 'titulo', false, 60),
  ('efeito-onda', 'effect', 'Onda', 'raro', 'titulo', false, 61),
  ('efeito-faisca-mes', 'effect', 'Faísca do mês', 'raro', 'trilha', false, 62),
  ('efeito-pulso-mes', 'effect', 'Pulso do mês', 'raro', 'trilha', false, 63),
  ('efeito-confete', 'effect', 'Confete', 'raro', 'bau', true, 64),
  ('efeito-relampago', 'effect', 'Relâmpago', 'lendario', 'bau', true, 65),
  -- título e emblema com variante
  ('titulo-cacador', 'title', 'Caçador do chefão', 'raro', 'raid', false, 80),
  ('emblema-temporada', 'emblem', 'Emblema do mês', 'comum', 'trilha', false, 90);

-- Dá um cosmético (idempotente pela PK). Devolve true se a pessoa ganhou agora.
create or replace function private.grant_cosmetic(p_user uuid, p_cosmetic text, p_variant text, p_source text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_cosmetics (user_id, cosmetic_id, variant, source)
  values (p_user, p_cosmetic, coalesce(p_variant, ''), left(p_source, 120))
  on conflict (user_id, cosmetic_id, variant) do nothing;
  return found;
end $$;
revoke all on function private.grant_cosmetic(uuid, text, text, text) from public, anon, authenticated;

-- Equipar: só o que a pessoa possui (FK) e no slot do item.
create or replace function public.equip_cosmetic(p_cosmetic text, p_variant text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_slot text;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select d.slot into v_slot from public.cosmetic_defs d where d.id = p_cosmetic and d.active;
  if v_slot is null or not exists (select 1 from public.user_cosmetics c where c.user_id = v_uid and c.cosmetic_id = p_cosmetic
                                                                          and c.variant = coalesce(p_variant, '')) then
    raise exception 'COSMETIC_NOT_OWNED: você ainda não tem esse item' using errcode = 'P0001';
  end if;
  insert into public.user_equipped (user_id, slot, cosmetic_id, variant) values (v_uid, v_slot, p_cosmetic, coalesce(p_variant, ''))
  on conflict (user_id, slot) do update set cosmetic_id = excluded.cosmetic_id, variant = excluded.variant, equipped_at = now();
  return jsonb_build_object('slot', v_slot, 'cosmeticId', p_cosmetic, 'variant', coalesce(p_variant, ''));
end $$;
revoke all on function public.equip_cosmetic(text, text) from public, anon;
grant execute on function public.equip_cosmetic(text, text) to authenticated;

create or replace function public.unequip_cosmetic(p_slot text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if p_slot is null or p_slot not in ('trail', 'frame', 'effect', 'title', 'emblem') then
    raise exception 'INVALID_SLOT: espaço inválido' using errcode = 'P0001';
  end if;
  delete from public.user_equipped where user_id = v_uid and slot = p_slot;
  return jsonb_build_object('slot', p_slot, 'cosmeticId', null);
end $$;
revoke all on function public.unequip_cosmetic(text) from public, anon;
grant execute on function public.unequip_cosmetic(text) to authenticated;

-- ===========================================================================
-- Medalhas (E4 §6: 12 medalhas em 3 níveis; a estante mostra as bloqueadas)
-- ===========================================================================
create table public.medal_defs (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 30),
  description text not null check (char_length(description) between 3 and 90),
  art_key text not null check (char_length(art_key) between 2 and 40),
  secret boolean not null default false,
  sort smallint not null default 0,
  active boolean not null default true
);
comment on table public.medal_defs is 'Critérios provisórios (E4 §6); E3/E7 fecham na onda 2. A medalha nunca é perdida.';

create table public.user_medals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  medal_id text not null references public.medal_defs (id),
  -- período: '' (única), AAAA-MM (temporada, desafio do mês) ou o id do chefão (uma por espécie)
  period text not null default '' check (period ~ '^[a-z0-9-]{0,40}$'),
  tier text not null check (tier in ('bronze', 'prata', 'ouro')),
  activity_id uuid references public.activities (id) on delete set null,
  awarded_at timestamptz not null default now(),
  upgraded_at timestamptz,
  primary key (user_id, medal_id, period)
);
create index user_medals_user_idx on public.user_medals (user_id, awarded_at desc);

alter table public.medal_defs enable row level security;
alter table public.user_medals enable row level security;
revoke all on public.medal_defs, public.user_medals from anon, authenticated;
grant select on public.medal_defs, public.user_medals to authenticated;
create policy medal_defs_read on public.medal_defs for select to authenticated using (active and not secret);
create policy user_medals_select on public.user_medals for select to authenticated using (user_id = (select auth.uid()));
create policy user_medals_active_account on public.user_medals as restrictive for all to authenticated
  using ((select private.is_active())) with check ((select private.is_active()));

insert into public.medal_defs (id, name, description, art_key, sort) values
  ('primeiros-passos', 'Primeiros passos', 'Termine sua primeira corrida', 'medalha-primeiros-passos', 1),
  ('explorador', 'Explorador', 'Revele um bairro no Atlas', 'medalha-explorador', 2),
  ('conquistador', 'Conquistador', 'Conquiste sua primeira zona', 'medalha-conquistador', 3),
  ('defensor', 'Defensor', 'Defenda uma zona sob ataque', 'medalha-defensor', 4),
  ('sequencia', 'Sequência', 'Garanta 4 semanas seguidas', 'medalha-sequencia', 5),
  ('cacador', 'Caçador', 'Abra 10 baús na Caça', 'medalha-cacador', 6),
  ('chefao', 'Chefão', 'Ajude a cidade a derrotar um chefão', 'medalha-chefao', 7),
  ('fuga', 'Fuga', 'Vença o fantasma 5 vezes', 'medalha-fuga', 8),
  ('liga', 'Liga', 'Suba de divisão na liga', 'medalha-liga', 9),
  ('crew', 'Crew', 'Bata a meta semanal da crew', 'medalha-crew', 10),
  ('temporada', 'Temporada', 'Suba os degraus da trilha do mês', 'medalha-temporada', 11),
  ('desafio-mes', 'Desafio do mês', 'Complete o desafio do mês', 'medalha-desafio-mes', 12);

create or replace function private.tier_rank(p_tier text) returns smallint
language sql immutable set search_path = '' as $$
  select case p_tier when 'bronze' then 1 when 'prata' then 2 when 'ouro' then 3 else 0 end::smallint
$$;
revoke all on function private.tier_rank(text) from public, anon, authenticated;

-- Dá ou melhora uma medalha. Idempotente: repetir não muda nada; nível menor nunca rebaixa.
-- Devolve { medalId, period, tier, previousTier } quando ganhou ou subiu; null quando nada mudou.
create or replace function private.award_medal(p_user uuid, p_medal text, p_tier text, p_period text, p_activity uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
begin
  if private.tier_rank(p_tier) = 0 then
    raise exception 'INVALID_TIER: nível de medalha inválido' using errcode = 'P0001';
  end if;
  select um.tier into v_old from public.user_medals um
   where um.user_id = p_user and um.medal_id = p_medal and um.period = coalesce(p_period, '') for update;
  if v_old is not null and private.tier_rank(v_old) >= private.tier_rank(p_tier) then
    return null;
  end if;
  insert into public.user_medals (user_id, medal_id, period, tier, activity_id)
  values (p_user, p_medal, coalesce(p_period, ''), p_tier, p_activity)
  on conflict (user_id, medal_id, period) do update set tier = excluded.tier, upgraded_at = now();
  return jsonb_build_object('medalId', p_medal, 'period', coalesce(p_period, ''), 'tier', p_tier, 'previousTier', v_old);
end $$;
revoke all on function private.award_medal(uuid, text, text, text, uuid) from public, anon, authenticated;
