// T7.2.1 — paridade: toda constante que o SQL repete do domain (D-02) tem de ser igual à do domain.
// Lê as migrations como texto (sem banco): private.domain_constants(), as linhas de game_config, a função
// raid_seeded_unit (sorteio do crítico e dos pontos fracos), o rodízio dos chefões com a D-84 (Fuligem fora de
// agosto e setembro), as fases, os alvos das missões e a curva de XP. Se alguém mudar o domain e esquecer o SQL
// (ou o contrário), este teste fica vermelho.
import assert from 'node:assert/strict';
import {
  DAILY_CHEST,
  FACTION_IDS,
  LEAGUE_V2_CLOSE_OFFSET_MS,
  LEAGUE_V2_GROUP_MAX,
  LEAGUE_V2_MOVE_EVERY,
  LEAGUE_V2_MOVES_MAX,
  LEAGUE_V2_SMALL_GROUP,
  MAX_LEVEL,
  MISSION_TARGETS,
  PAINT_ATTACK_FLIPS,
  PAINT_ATTACK_RATIO,
  PAINT_ATTACK_WINDOW_MS,
  PAINT_CELL_RES,
  PAINT_FADE_MS,
  PAINT_INHERIT_CELLS,
  PAINT_INHERIT_MS,
  PAINT_MAX_LAYERS,
  RAID_BOSS_IDS,
  RAID_CRIT_CHANCE,
  RAID_CRIT_MULTIPLIER,
  RAID_DAILY_CAP_KM,
  RAID_DAILY_DAMAGE_CAP,
  RAID_DAMAGE_PER_KM,
  RAID_FACTOR_MAX,
  RAID_FACTOR_MIN,
  RAID_FACTOR_STEP,
  RAID_HP_SHARE,
  RAID_MIN_HP,
  RAID_MIN_REWARD_DAMAGE,
  RAID_PACK_MULTIPLIER,
  RAID_PHASE2_AT,
  RAID_PHASE3_AT,
  RAID_ROTATION_EPOCH,
  RAID_RUN_CAP_KM,
  RAID_WEAK_POINT_MULTIPLIER,
  RAID_WEAK_POINTS_PER_DAY,
  raidBossForWeek,
  raidSeededUnit,
  raidWeekWindow,
  RUNNER_BANDS,
  RUNNER_TITLES,
  SEASON_TRACK,
  SHARE_MIN_PIECE_M,
  STREAK_RUNS_PER_WEEK,
  xpToNextLevel,
  ZONE_MIN_CELLS,
  ZONE_RES,
} from '../_shared/domain.ts';

const MIGRATIONS = new URL('../../migrations/', import.meta.url);
const sql = (name: string) => Deno.readTextFileSync(new URL(name, MIGRATIONS));
const ALL = [...Deno.readDirSync(MIGRATIONS)].map((e) => e.name).filter((n) => n.endsWith('.sql')).sort();
const allSql = ALL.map(sql).join('\n');

/** Última definição de uma função SQL (a migration mais nova vence, como no banco). */
function lastFunction(name: string): string {
  const re = new RegExp(`create or replace function ${name.replace('.', '\\.')}\\(([\\s\\S]*?)\\n(?:\\$\\$;|end \\$\\$;)`, 'g');
  const all = [...allSql.matchAll(re)];
  assert.ok(all.length > 0, `função ${name} não encontrada nas migrations`);
  return all[all.length - 1][0];
}

const DC = (() => {
  const m = sql('20261023120700_paint.sql').match(/-- domain-constants:begin\n'([\s\S]*?)'\n-- domain-constants:end/);
  assert.ok(m, 'bloco domain-constants não encontrado');
  return JSON.parse(m[1]) as Record<string, unknown>;
})();

const GC: Record<string, Record<string, unknown>> = (() => {
  const out: Record<string, Record<string, unknown>> = {};
  for (const m of sql('20261023120000_v2_contract.sql').matchAll(/\('([a-z_]+)',\s*'(\{[\s\S]*?\})'\)/g)) {
    out[m[1]] = JSON.parse(m[2]);
  }
  return out;
})();

Deno.test('domain_constants(): pintura (D-62), zona, times e progressão iguais ao domain', () => {
  assert.equal(DC.PAINT_CELL_RES, PAINT_CELL_RES);
  assert.equal(DC.PAINT_MAX_LAYERS, PAINT_MAX_LAYERS);
  assert.equal(DC.PAINT_FADE_MS, PAINT_FADE_MS);
  assert.equal(DC.ZONE_MIN_CELLS, ZONE_MIN_CELLS);
  assert.equal(DC.PAINT_INHERIT_CELLS, PAINT_INHERIT_CELLS);
  assert.equal(DC.PAINT_INHERIT_MS, PAINT_INHERIT_MS);
  assert.equal(DC.PAINT_ATTACK_RATIO, PAINT_ATTACK_RATIO);
  assert.equal(DC.PAINT_ATTACK_FLIPS, PAINT_ATTACK_FLIPS);
  assert.equal(DC.PAINT_ATTACK_WINDOW_MS, PAINT_ATTACK_WINDOW_MS);
  assert.equal(DC.ZONE_RES, ZONE_RES);
  assert.deepEqual(DC.FACTION_IDS, [...FACTION_IDS]);
  assert.equal(DC.MAX_LEVEL, MAX_LEVEL);
  assert.deepEqual(DC.RUNNER_TITLES, RUNNER_TITLES.map(({ id, name, minLevel }) => ({ id, name, minLevel })));
  assert.deepEqual(DC.RUNNER_BANDS, RUNNER_BANDS.map(({ id, name, minKm }) => ({ id, name, minKm })));
  assert.deepEqual(DC.SEASON_TRACK, { ...SEASON_TRACK });
  assert.equal(DC.STREAK_RUNS_PER_WEEK, STREAK_RUNS_PER_WEEK);
  assert.equal(DC.DAILY_CHEST_PITY, DAILY_CHEST.pity);
  assert.equal(DC.DAILY_CHEST_MAX_STORED, DAILY_CHEST.maxStored);
  assert.equal(DC.SHARE_MIN_PIECE_M, SHARE_MIN_PIECE_M);
  // a zona do check de zone_cells (h3_parent(cell, 9)) é a ZONE_RES
  assert.match(sql('20261023120700_paint.sql'), new RegExp(`private\\.h3_parent\\(cell, ${ZONE_RES}\\) = zone_id`));
  assert.match(sql('20261023120700_paint.sql'), new RegExp(`layers between 1 and ${PAINT_MAX_LAYERS}`));
});

Deno.test('curva de XP do SQL (LEVEL_CURVE) = xpToNextLevel do domain em todos os níveis', () => {
  const c = DC.LEVEL_CURVE as { base: number; exponent: number; round: number; plus: number };
  // mesma conta de private.xp_to_next_level: round(base · n^exp / round) · round + plus
  for (let n = 1; n <= 60; n++) {
    assert.equal(Math.round((c.base * n ** c.exponent) / c.round) * c.round + c.plus, xpToNextLevel(n), `nível ${n}`);
  }
});

Deno.test('raid: domain_constants e game_config.raid iguais ao raid.ts (D-67)', () => {
  assert.deepEqual(DC.RAID_BOSS_IDS, [...RAID_BOSS_IDS]);
  assert.equal(DC.RAID_ROTATION_EPOCH, RAID_ROTATION_EPOCH);
  assert.equal(DC.RAID_PHASE2_AT, RAID_PHASE2_AT);
  assert.equal(DC.RAID_PHASE3_AT, RAID_PHASE3_AT);
  const r = GC.raid;
  assert.equal(r.damagePerKm, RAID_DAMAGE_PER_KM);
  assert.equal(r.critChance, RAID_CRIT_CHANCE);
  assert.equal(r.critMultiplier, RAID_CRIT_MULTIPLIER);
  assert.equal(r.weakPointMultiplier, RAID_WEAK_POINT_MULTIPLIER);
  assert.equal(r.packMultiplier, RAID_PACK_MULTIPLIER);
  assert.equal(r.runCapKm, RAID_RUN_CAP_KM);
  assert.equal(r.dayCapKm, RAID_DAILY_CAP_KM);
  assert.equal(r.dayDamageCap, RAID_DAILY_DAMAGE_CAP);
  assert.equal(r.hpMin, RAID_MIN_HP);
  assert.equal(r.hpShare, RAID_HP_SHARE);
  assert.equal(r.factorMin, RAID_FACTOR_MIN);
  assert.equal(r.factorMax, RAID_FACTOR_MAX);
  assert.equal(r.factorStep, RAID_FACTOR_STEP);
  assert.equal(r.weakPointsPerDay, RAID_WEAK_POINTS_PER_DAY);
  assert.equal(r.rewardMinDamage, RAID_MIN_REWARD_DAMAGE);
  assert.deepEqual(r.phases, [RAID_PHASE2_AT, RAID_PHASE3_AT]);
  assert.deepEqual(r.bosses, [...RAID_BOSS_IDS]);
  assert.equal(Date.parse(String(r.rotationEpoch)), RAID_ROTATION_EPOCH);
  // fases em private.raid_phase_of
  const phase = lastFunction('private.raid_phase_of');
  assert.match(phase, new RegExp(`> ${RAID_PHASE2_AT} then 1`));
  assert.match(phase, new RegExp(`> ${RAID_PHASE3_AT} then 2`));
  // ordem do rodízio = coluna sort de raid_bosses
  const sorts = [...sql('20261023120300_raids.sql').matchAll(/\('([a-z-]+)', '[^']+', '[^']+', '[^']+',\s*'[^']*', '[^']*', '[^']+', (\d)\)/g)]
    .map((m) => [m[1], Number(m[2])] as const);
  assert.deepEqual(sorts.sort((a, b) => a[1] - b[1]).map((s) => s[0]), [...RAID_BOSS_IDS]);
});

/** Porta para TS de private.raid_seeded_unit, com as constantes LIDAS do SQL (e não copiadas daqui). */
function sqlSeededUnit(): (seed: string) => number {
  const body = lastFunction('private.raid_seeded_unit');
  const nums = (re: RegExp) => {
    const m = body.match(re);
    assert.ok(m, `constante não encontrada: ${re}`);
    return BigInt(m[1]);
  };
  const offset = nums(/h bigint := (\d+);/);
  const prime = nums(/private\.imul32\(h, (\d+)\);\s*\n\s*end loop/);
  const m1 = nums(/h := h # \(h >> 16\);\s*\n\s*h := private\.imul32\(h, (\d+)\)/);
  const m2 = nums(/h := h # \(h >> 13\);\s*\n\s*h := private\.imul32\(h, (\d+)\)/);
  const imul32 = (a: bigint, b: bigint) => ((a * (b & 65535n)) + (((a * (b >> 16n)) & 65535n) << 16n)) & 4294967295n;
  return (seed: string) => {
    let h = offset;
    for (const ch of seed) {
      // ascii(substr(...)) no SQL = código do caractere; o domain usa charCodeAt (UTF-16): iguais fora do plano astral
      h = h ^ BigInt(ch.charCodeAt(0));
      h = imul32(h, prime);
    }
    h = h ^ (h >> 16n);
    h = imul32(h, m1);
    h = h ^ (h >> 13n);
    h = imul32(h, m2);
    h = h ^ (h >> 16n);
    return Number(h) / 4294967296;
  };
}

Deno.test('raid: o sorteio do SQL (raid_seeded_unit) dá o mesmo número que raidSeededUnit em 2.000 sementes', () => {
  const port = sqlSeededUnit();
  const seeds = ['', 'abc', 'crit:x', 'Goiânia:raid|2026-10-22|891f1d48110ffff'];
  for (let i = 0; i < 2000; i++) seeds.push(`crit:${crypto.randomUUID()}`, `global:${i}|2026-10-${(i % 28) + 1}|89a8${i.toString(16)}`);
  for (const s of seeds) assert.equal(port(s), raidSeededUnit(s), s);
  // crítico e pontos fracos usam as mesmas sementes do domain
  assert.match(lastFunction('private.apply_raid_hit'), /private\.raid_seeded_unit\('crit:' \|\| a\.id\)/);
  assert.match(lastFunction('public.job_raid_tick'), /coalesce\(w\.city, 'global'\) \|\| ':' \|\| w\.id \|\| '\|' \|\| v_day \|\| '\|' \|\| z\.id/);
});

/** Porta para TS de private.raid_boss_for_week (D-84), com a época, o módulo e os meses LIDOS do SQL. */
function sqlBossForWeek(): (weekStart: string) => string {
  const body = lastFunction('private.raid_boss_for_week');
  const epoch = body.match(/p_week_start - date '(\d{4}-\d{2}-\d{2})'\) \/ 7\) % (\d+)\) \+ \2\) % \2/);
  assert.ok(epoch, 'época/módulo do rodízio não encontrados');
  assert.match(body, /RAID_SMOKE_BOSS/);
  assert.match(body, /RAID_SMOKE_MONTHS/);
  assert.match(body, /\(base\.i \+ 1\) % 5/);
  const mod = Number(epoch[2]);
  const epochDay = Date.parse(`${epoch[1]}T00:00:00Z`);
  const smoke = DC.RAID_SMOKE_BOSS as string;
  const months = DC.RAID_SMOKE_MONTHS as number[];
  return (weekStart: string) => {
    const days = Math.round((Date.parse(`${weekStart}T00:00:00Z`) - epochDay) / 86_400_000);
    // divisão inteira do Postgres trunca em direção a zero
    const i = (((Math.trunc(days / 7) % mod) + mod) % mod);
    const month = Number(weekStart.slice(5, 7));
    const pick = RAID_BOSS_IDS[i] === smoke && months.includes(month) ? (i + 1) % mod : i;
    return RAID_BOSS_IDS[pick];
  };
}

Deno.test('raid: rodízio do SQL = raidBossForWeek do domain, com a Fuligem fora de agosto e setembro (D-84)', () => {
  const port = sqlBossForWeek();
  assert.equal(DC.RAID_SMOKE_BOSS, 'fuligem');
  assert.deepEqual(DC.RAID_SMOKE_MONTHS, [8, 9]);
  const WEEK = 7 * 86_400_000;
  let smokeWeeks = 0;
  // 12 anos de semanas, a partir de 2 anos antes da época
  for (let w = -104; w < 520; w++) {
    const startsAt = RAID_ROTATION_EPOCH + w * WEEK;
    assert.equal(raidWeekWindow(startsAt).startsAt, startsAt);
    const weekStart = new Date(startsAt - 3 * 3_600_000).toISOString().slice(0, 10); // segunda (Brasília)
    const month = Number(weekStart.slice(5, 7));
    const sqlBoss = port(weekStart);
    const domainBoss = raidBossForWeek(startsAt);
    const baseBoss = RAID_BOSS_IDS[((w % RAID_BOSS_IDS.length) + RAID_BOSS_IDS.length) % RAID_BOSS_IDS.length];
    if (baseBoss === 'fuligem' && (month === 8 || month === 9)) {
      // semana da D-84: o SQL pula a Fuligem e põe o próximo chefão do rodízio
      smokeWeeks++;
      assert.equal(sqlBoss, RAID_BOSS_IDS[(RAID_BOSS_IDS.indexOf('fuligem') + 1) % RAID_BOSS_IDS.length], weekStart);
      // domain já com a D-84 (raid.ts da E3): tem de concordar; domain antigo: ainda devolve a Fuligem
      if (domainBoss !== 'fuligem') assert.equal(sqlBoss, domainBoss, `${weekStart}: SQL ${sqlBoss} × domain ${domainBoss}`);
    } else {
      assert.equal(sqlBoss, domainBoss, `${weekStart}: SQL ${sqlBoss} × domain ${domainBoss}`);
    }
    if (month === 8 || month === 9) assert.notEqual(sqlBoss, 'fuligem', `${weekStart}: Fuligem em agosto/setembro`);
  }
  assert.ok(smokeWeeks > 0, 'o período testado precisa ter semanas da D-84');
});

Deno.test('liga, baú do dia e trilha: game_config igual ao domain (D-66, D-68)', () => {
  const l = GC.league;
  assert.equal(l.groupSize, LEAGUE_V2_GROUP_MAX);
  assert.equal(l.movesMax, LEAGUE_V2_MOVES_MAX);
  assert.equal(l.moveEvery, LEAGUE_V2_MOVE_EVERY);
  assert.equal(l.smallGroup, LEAGUE_V2_SMALL_GROUP);
  const [h, m] = String(l.closesAt).split(':').map(Number);
  assert.equal((h * 60 + m) * 60_000, LEAGUE_V2_CLOSE_OFFSET_MS);
  // cron do fechamento: segunda 03:20 BRT = 06:20 UTC
  assert.match(sql('20261023120400_league.sql'), new RegExp(`'${m} ${h + 3} \\* \\* 1'`));

  const d = GC.daily_chest;
  assert.equal(d.maxStored, DAILY_CHEST.maxStored);
  assert.equal(d.pityAt, DAILY_CHEST.pity);
  assert.equal(d.minMeters, DAILY_CHEST.minMeters);
  assert.equal(d.minTrust, DAILY_CHEST.minTrust);
  assert.deepEqual(d.odds, { ...DAILY_CHEST.odds });
  assert.deepEqual(d.xp, { ...DAILY_CHEST.xp });
  assert.deepEqual(d.cosmeticChance, { ...DAILY_CHEST.cosmeticChance });
  assert.equal(d.duplicateCosmeticXp, DAILY_CHEST.duplicateCosmeticXp);

  const t = GC.track;
  assert.equal(t.steps, SEASON_TRACK.steps);
  assert.equal(t.stepXp, SEASON_TRACK.stepXp);
  assert.deepEqual(t.medalSteps, { bronze: SEASON_TRACK.bronze, prata: SEASON_TRACK.prata, ouro: SEASON_TRACK.ouro });
});

Deno.test('missões: alvos adaptativos do SQL (private.mission_target) = MISSION_TARGETS', () => {
  const body = lastFunction('private.mission_target');
  const { dailyKm, weeklyKm, raidKm } = MISSION_TARGETS;
  assert.match(body, new RegExp(`least\\(${dailyKm.max}, greatest\\(${dailyKm.min}, round\\(v_median / 1000 \\* 2\\) / 2\\)\\)`));
  assert.match(body, new RegExp(`limit ${dailyKm.recentRuns}\\)`));
  assert.match(body, new RegExp(`if v_median is null then return ${dailyKm.min * 1000}; end if;`));
  assert.match(body, new RegExp(`generate_series\\(1, ${weeklyKm.recentWeeks}\\)`));
  assert.match(body, new RegExp(`least\\(${weeklyKm.max}, greatest\\(${weeklyKm.min}, round\\(least\\(v_median \\* ${weeklyKm.share}, v_max \\* ${weeklyKm.maxGrowth}\\)`));
  assert.match(body, new RegExp(`least\\(${raidKm.max}, greatest\\(${raidKm.min}, round\\(v_km \\* ${raidKm.share} \\* 2\\) / 2\\)\\)`));
});

Deno.test('pintura: o job e o retrato usam as constantes (nada de número solto no SQL)', () => {
  const fade = lastFunction('public.job_fade_cells');
  assert.match(fade, /private\.dc\('PAINT_FADE_MS'\)/);
  const eff = lastFunction('private.paint_effective_layers');
  assert.match(eff, /private\.dc\('PAINT_MAX_LAYERS'\)/);
  assert.match(eff, /private\.dc\('PAINT_FADE_MS'\)/);
  const owner = lastFunction('private.paint_owner');
  assert.match(owner, /private\.dc\('ZONE_MIN_CELLS'\)/);
  const attack = lastFunction('private.paint_under_attack');
  for (const k of ['PAINT_ATTACK_WINDOW_MS', 'PAINT_ATTACK_RATIO', 'PAINT_ATTACK_FLIPS']) assert.match(attack, new RegExp(k));
  const sw = lastFunction('private.paint_switch_to_v2');
  for (const k of ['PAINT_INHERIT_CELLS', 'PAINT_INHERIT_MS']) assert.match(sw, new RegExp(k));
});
