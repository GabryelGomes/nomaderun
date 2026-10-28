-- NOMADE RUN — Fase 7, onda 3 (T7.3.8): pedidos da E3 e da E7 sobre RPCs que já existem. Só aditivo:
--   * zone_paint_near(): campo novo `paintedToday` (E3-onda2 §7.5) — os trechos que a PRÓPRIA pessoa já pintou hoje
--     (Brasília), para o tracker ao vivo não prever uma 2ª camada no mesmo dia. Sem autor de ninguém, sem hora, no
--     mesmo raio e com o mesmo corte de zonas de privacidade de `cells`. O resto da resposta não muda;
--   * my_engagement(): `streak.pauseAvailable` (E7-onda2 §6a) — a pausa de saúde ainda pode ser usada nesta
--     temporada (null com a sequência v2 desligada, porque start_health_pause responde FEATURE_DISABLED);
--   * notification_prefs só com valores booleanos (achado desta onda): `(prefs ->> chave)::boolean` com um valor
--     como "abc" levantava erro DENTRO da transação de OUTRA pessoa (invasão no finish do atacante, aplauso de quem
--     reage, job da sequência para todo mundo). Os valores não booleanos existentes são removidos (= ligado, como
--     chave ausente) e um CHECK impede novos; notify_pref passa a ler só booleano.

-- ===========================================================================
-- notification_prefs: só booleanos
-- ===========================================================================
update public.profiles pr
   set notification_prefs = coalesce((select jsonb_object_agg(e.key, e.value)
                                         from jsonb_each(pr.notification_prefs) e
                                        where jsonb_typeof(e.value) = 'boolean'), '{}'::jsonb)
 where jsonb_path_exists(pr.notification_prefs, '$.* ? (@.type() != "boolean")');

alter table public.profiles add constraint profiles_notification_prefs_boolean
  check (not jsonb_path_exists(notification_prefs, '$.* ? (@.type() != "boolean")'));

-- Chave ausente ou valor que não é booleano = ligada (nunca levanta erro).
create or replace function private.notify_pref(p_user uuid, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when jsonb_typeof(pr.notification_prefs -> p_key) = 'boolean'
                               then (pr.notification_prefs -> p_key)::boolean end
                     from public.profiles pr where pr.id = p_user), true)
$$;
revoke all on function private.notify_pref(uuid, text) from public, anon, authenticated;

-- ===========================================================================
-- zone_paint_near(): + paintedToday
-- ===========================================================================
-- Mesmo corte de privacidade de `cells` (qualquer zona de privacidade a até o raio dela esconde o trecho).
create or replace function private.cell_in_privacy_zone(p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.privacy_zones pz
     where pz.lat between p_lat - 0.0095 and p_lat + 0.0095
       and abs(pz.lng - p_lng) <= 0.0095 / greatest(cos(radians(p_lat)), 0.2)
       and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
                                 extensions.st_setsrid(extensions.st_makepoint(pz.lng, pz.lat), 4326)::extensions.geography,
                                 pz.radius_m))
$$;
revoke all on function private.cell_in_privacy_zone(double precision, double precision) from public, anon, authenticated;

create or replace function public.zone_paint_near(p_lat double precision, p_lng double precision, p_radius_m integer default 1500)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_radius integer;
  v_pt extensions.geography;
  v_dlat double precision;
  v_dlng double precision;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  if p_lat is null or p_lng is null or p_lat not between -85 and 85 or p_lng not between -180 and 180 then
    raise exception 'VALIDATION: coordenada inválida' using errcode = 'P0001';
  end if;
  v_radius := least(greatest(coalesce(p_radius_m, 1500), 100), 3000);
  v_pt := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_dlat := v_radius / 111000.0;
  v_dlng := v_radius / (111000.0 * greatest(cos(radians(p_lat)), 0.2));
  return jsonb_build_object(
    'rule', private.territory_rule(),
    'cells', coalesce((
      select jsonb_object_agg(c.cell, jsonb_build_object('faction', c.faction,
                                                         'layers', private.paint_effective_layers(c.layers, c.painted_at, v_now)))
        from public.zone_cells c
       where c.lat between p_lat - v_dlat and p_lat + v_dlat and c.lng between p_lng - v_dlng and p_lng + v_dlng
         and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography,
                                   v_pt, v_radius)
         and private.paint_effective_layers(c.layers, c.painted_at, v_now) > 0
         and not private.cell_in_privacy_zone(c.lat, c.lng)), '{}'::jsonb),
    'zones', coalesce((
      select jsonb_object_agg(x.id, jsonb_build_object(
               'owner', x.owner, 'name', private.zone_label(x.id, x.name),
               'inherited', case when x.inherit_until is not null and v_now < x.inherit_until then x.inherit_cells else 0 end,
               'blocked', x.blocked,
               'underAttack', private.paint_under_attack(x, private.paint_counts(x.id, v_now), v_now)))
        from public.zones x
       where x.geom operator(extensions.&&) extensions.st_makeenvelope(p_lng - v_dlng, p_lat - v_dlat, p_lng + v_dlng, p_lat + v_dlat, 4326)
         and extensions.st_dwithin(x.geom::extensions.geography, v_pt, v_radius)), '{}'::jsonb),
    -- T7.3.8 (E3): só os trechos da própria pessoa hoje (Brasília), só os ids, ordenados (nada de hora nem de ordem
    -- de passagem). Trecho que já não existe em zone_cells (desbotou de vez) não tem posição e fica de fora.
    'paintedToday', coalesce((
      select jsonb_agg(m.cell order by m.cell)
        from public.paint_marks m
        join public.zone_cells c on c.cell = m.cell
       where m.user_id = v_uid and m.day = public.br_today()
         and c.lat between p_lat - v_dlat and p_lat + v_dlat and c.lng between p_lng - v_dlng and p_lng + v_dlng
         and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography,
                                   v_pt, v_radius)
         and not private.cell_in_privacy_zone(c.lat, c.lng)), '[]'::jsonb));
end $$;
revoke all on function public.zone_paint_near(double precision, double precision, integer) from public, anon;
grant execute on function public.zone_paint_near(double precision, double precision, integer) to authenticated;

-- ===========================================================================
-- my_engagement(): + streak.pauseAvailable (o resto igual à onda 2)
-- ===========================================================================
create or replace function public.my_engagement() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  pr public.profiles;
  v_keys text[] := private.mission_periods(now());
  v_season text := public.current_season_id();
  v_week date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  v_today date := public.br_today();
  v_level jsonb;
  v_season_xp integer;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED: faça login novamente' using errcode = 'P0001'; end if;
  perform private.require_active();
  select * into pr from public.profiles where id = v_uid;
  v_level := private.level_progress(pr.xp);
  if private.feature_on('missions') then
    perform private.ensure_missions(v_uid, now());
  end if;
  v_season_xp := private.season_xp(v_uid, v_season);
  return jsonb_build_object(
    'level', v_level -> 'level', 'xp', pr.xp, 'intoLevel', v_level -> 'intoLevel', 'needed', v_level -> 'needed',
    'isMax', v_level -> 'isMax', 'title', v_level -> 'title',
    'band', private.runner_band(pr.lifetime_meters),
    'lifetimeMeters', pr.lifetime_meters,
    'streak', jsonb_build_object(
      'weeks', pr.streak_weeks, 'best', pr.best_streak_weeks, 'freezesLeft', pr.freezes_left,
      'activitiesThisWeek', (select count(*) from public.activities a
                              where a.user_id = v_uid and a.scored and a.status in ('valid', 'partial')
                                and coalesce(a.ended_at, a.finished_at) >= (v_week + time '00:00') at time zone 'America/Sao_Paulo'),
      'pause', case when pr.pause_from is null then null
                    else jsonb_build_object('from', pr.pause_from, 'until', pr.pause_until) end,
      -- mesmas condições de start_health_pause: sem pausa valendo e sem pausa usada nesta temporada
      'pauseAvailable', case when not private.feature_on('streakV2') then null
                             else not (pr.pause_from is not null and pr.pause_from <= v_today and v_today <= pr.pause_until)
                                  and pr.pause_used_season is distinct from v_season end),
    'dailyChest', case when not private.feature_on('dailyChest') then null else jsonb_build_object(
      'stored', case when exists (select 1 from public.daily_rewards d where d.user_id = v_uid and d.day = public.br_today())
                     then 0 else private.daily_chests_stored(v_uid) end,
      'openedToday', exists (select 1 from public.daily_rewards d where d.user_id = v_uid and d.day = public.br_today()),
      'pityLeft', greatest(1, private.param_num('daily_chest', 'pityAt', 20)::integer - pr.daily_chest_pity),
      'odds', (select g.value -> 'odds' from public.game_config g where g.key = 'daily_chest')) end,
    'missions', case when not private.feature_on('missions') then null else jsonb_build_object(
      'daily', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                          where um.user_id = v_uid and um.period_key = v_keys[1]), '[]'::jsonb),
      'weekly', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                           where um.user_id = v_uid and um.period_key = v_keys[2]), '[]'::jsonb),
      'ftue', coalesce((select jsonb_agg(private.mission_json(um) order by um.slot) from public.user_missions um
                         where um.user_id = v_uid and um.period_key = 'ftue'), '[]'::jsonb),
      'comeback', (select private.mission_json(um) from public.user_missions um
                    where um.user_id = v_uid and um.kind = 'volta' and um.completed_at is null
                    order by um.created_at desc limit 1)) end,
    'season', case when not private.feature_on('track') then null
                   else jsonb_build_object('id', v_season, 'xp', v_season_xp) || private.season_track_step(v_season_xp) end);
end $$;
revoke all on function public.my_engagement() from public, anon;
grant execute on function public.my_engagement() to authenticated;
