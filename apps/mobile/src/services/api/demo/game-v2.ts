/**
 * Pares de demonstração das RPCs v2 da E3 (T7.2.3): `raid_current` (D-67), `league_current` (D-68) e
 * `zone_paint_near` (D-62). Mesmas regras do servidor, calculadas com o `src/domain` sobre o banco de
 * demonstração; todo dado é de demonstração (corredores `*.demo`, `isDemo: true`).
 *
 * - Raid: o chefão da semana pelo rodízio real (com a D-84), vida pelo volume de uma cidade fictícia, dano da
 *   cidade que cresce ao longo da semana e a "Sua parte" calculada pelas corridas pontuadas do próprio corredor
 *   (`raidDamage`, com os tetos). A vida cai, a fase só avança e, se a cidade zerar a vida, o chefão cai.
 * - Liga: o grupo da semana com 30 pessoas (o corredor + os corredores de demonstração + quem faltar para 30),
 *   pontos da semana do próprio ranking semanal, subida e descida por `leagueStandingsV2`.
 * - Pintura: trechos sintéticos coerentes com o dono e a influência das zonas (o dono sempre lidera com ≥ 3
 *   trechos; zona neutra nunca tem líder com 3), sem trechos dentro de zonas de privacidade.
 */
import { distanceMeters, offset } from '@/domain/geo';
import { cellCenter } from '@/domain/grid';
import { leagueMovesFor, leagueStandingsV2, leagueWeek, LEAGUE_V2_SMALL_GROUP } from '@/domain/league';
import { LEAGUE_DIVISIONS } from '@/domain/games';
import { PAINT_ATTACK_WINDOW_MS, PAINT_MAX_LAYERS, paintCellOf, paintZoneOf } from '@/domain/paint';
import {
  RAID_BOSSES,
  RAID_CRIT_CHANCE,
  RAID_CRIT_MULTIPLIER,
  RAID_DAILY_CAP_KM,
  RAID_DAILY_DAMAGE_CAP,
  RAID_DAMAGE_PER_KM,
  RAID_MIN_REWARD_DAMAGE,
  RAID_PACK_MULTIPLIER,
  RAID_RUN_CAP_KM,
  RAID_WEAK_POINT_MULTIPLIER,
  RAID_WEAK_POINTS_PER_DAY,
  raidBossForWeek,
  raidDamage,
  raidHpFor,
  raidPhase,
  raidRewardTier,
  raidSeededUnit,
  raidWeakPoints,
  raidWeekWindow,
  type RaidBossId,
} from '@/domain/raid';
import { weekStartBrt } from '@/domain/season';
import { FACTION_IDS, type FactionId } from '@/domain/types';

import { msOf, raise, type DemoDb, type Row } from './db';

type RpcHandler = (db: DemoDb, userId: string | null, args: Row) => unknown;

const DAY = 86_400_000;
const WEEK = 7 * DAY;

function requireActive(db: DemoDb, userId: string | null): Row {
  const p = db.profile(userId);
  if (!userId || !p) throw raise('UNAUTHORIZED: faça login novamente');
  if (p.status === 'inactive') throw raise('ACCOUNT_INACTIVE: conta inativa');
  return p;
}

/** 'AAAA-MM-DD' da segunda-feira (Brasília) da semana do instante. */
const mondayOf = (at: number) => new Date(weekStartBrt(at) + 3 * 3600_000).toISOString().slice(0, 10);
/** Dia de Brasília do instante. */
const brDay = (at: number) => new Date(at - 3 * 3600_000).toISOString().slice(0, 10);

/** Atividades pontuadas de um usuário num intervalo, em ordem. */
function scoredRuns(db: DemoDb, userId: string, from: number, to: number) {
  return db.tables.activities
    .filter((a) => a.user_id === userId && a.scored === true)
    .map((a) => ({ id: String(a.id), at: msOf(a.started_at) ?? 0, meters: Number(a.meters) || 0 }))
    .filter((a) => a.at >= from && a.at < to)
    .sort((a, b) => a.at - b.at);
}

/** Corredores de demonstração que aparecem nas listas (ativos e com time). */
function demoRunners(db: DemoDb, me: string) {
  return db.tables.profiles.filter((p) => p.id !== me && p.status !== 'inactive' && p.faction) as (Row & { id: string; username: string; faction: FactionId })[];
}

/* ================================================================== Raid (D-67) */

/** Falas e tema dos chefões (as mesmas linhas de `raid_bosses` na migration da E9; arte da E4). */
const BOSS_LINES: Record<RaidBossId, { theme: string; introLine: string; defeatLine: string }> = {
  soneca: { theme: 'preguiça, "só amanhã"', introLine: 'Só mais cinco minutinhos... a semana inteira.', defeatLine: 'Tá bom, tá bom... levantei.' },
  'rei-buzina': { theme: 'trânsito, carro em cima da faixa', introLine: 'Aqui quem manda é o engarrafamento. Buzina pra mim!', defeatLine: 'Tá... abre o sinal.' },
  fuligem: { theme: 'fumaça, poluição', introLine: 'Respira fundo... se tiver coragem.', defeatLine: 'Ventou... e eu sumi.' },
  mormaco: { theme: 'calor, ar parado', introLine: 'Quarenta graus e ar parado. Só me vence quem corre cedo.', defeatLine: 'Isso é... chuva?' },
  paredao: { theme: 'concreto, muro, ladeira', introLine: 'Cimento, muro e ladeira. Por aqui ninguém passa.', defeatLine: '...desmoronei.' },
};

/** Km semanais da cidade fictícia nas 4 últimas semanas (vida ≈ 14,8 mil). */
const DEMO_CITY_WEEKLY_KM = [1850, 2050, 1900, 2150];
/** Ritmo do dano da cidade fictícia: no fim da janela ela teria dado 108% da vida (cai no domingo). */
const CITY_PACE = 1.08;
const CITY_CURVE = 1.15;

const RAID_PARAMS = {
  damagePerKm: RAID_DAMAGE_PER_KM,
  critChance: RAID_CRIT_CHANCE,
  critMultiplier: RAID_CRIT_MULTIPLIER,
  runCapKm: RAID_RUN_CAP_KM,
  dayCapKm: RAID_DAILY_CAP_KM,
  dayDamageCap: RAID_DAILY_DAMAGE_CAP,
  phases: [0.67, 0.33],
  weakPointsPerDay: RAID_WEAK_POINTS_PER_DAY,
  weakPointMultiplier: RAID_WEAK_POINT_MULTIPLIER,
  packMultiplier: RAID_PACK_MULTIPLIER,
  rewardMinDamage: RAID_MIN_REWARD_DAMAGE,
  opensAt: '06:00',
  closesAt: '21:00',
};

/** "Desde a sua última visita": a última vida vista por raid (por banco de demonstração). */
const visits = new WeakMap<DemoDb, Map<string, { hp: number; at: number }>>();

function raidCurrent(db: DemoDb, userId: string | null) {
  requireActive(db, userId);
  const now = db.now();
  let { startsAt, endsAt } = raidWeekWindow(now);
  // Segunda antes das 06:00: a tela ainda mostra o chefão da semana passada (como o servidor).
  if (now < startsAt) {
    startsAt -= WEEK;
    endsAt -= WEEK;
  }
  const weekStart = mondayOf(startsAt);
  const id = `demo-raid-${weekStart}`;
  const bossId = raidBossForWeek(startsAt);
  const hpMax = raidHpFor(DEMO_CITY_WEEKLY_KM);
  const span = endsAt - startsAt;
  const cityAt = (t: number) => {
    const f = Math.min(1, Math.max(0, (t - startsAt) / span));
    return Math.round(hpMax * CITY_PACE * f ** CITY_CURVE);
  };

  // Golpes do próprio corredor: cada corrida pontuada da janela, com os tetos diários (raidDamage).
  const perDay = new Map<string, { km: number; dmg: number }>();
  let myDamage = 0;
  let myMeters = 0;
  let hits = 0;
  for (const run of scoredRuns(db, userId!, startsAt, Math.min(now, endsAt))) {
    const day = brDay(run.at);
    const today = perDay.get(day) ?? { km: 0, dmg: 0 };
    const phase = raidPhase(Math.max(0, hpMax - cityAt(run.at) - myDamage), hpMax);
    const hit = raidDamage({ validMeters: run.meters, phase, seed: run.id, damageToday: today.dmg, kmToday: today.km });
    perDay.set(day, { km: today.km + hit.countedKm, dmg: today.dmg + hit.damage });
    myDamage += hit.damage;
    myMeters += Math.round(hit.countedKm * 1000);
    hits += 1;
  }

  // A cidade derruba o chefão quando o dano dela + o seu passa a vida.
  const cityNeeded = Math.max(0, hpMax - myDamage);
  const fallF = (cityNeeded / (hpMax * CITY_PACE)) ** (1 / CITY_CURVE);
  const fallAt = startsAt + Math.ceil(fallF * span);
  const defeated = fallF <= 1 && fallAt <= now && fallAt < endsAt;
  const hp = defeated ? 0 : Math.max(0, hpMax - cityAt(now) - myDamage);
  const status: 'active' | 'defeated' | 'escaped' = defeated ? 'defeated' : now >= endsAt ? 'escaped' : 'active';
  const phase = raidPhase(hp, hpMax);
  const f = Math.min(1, Math.max(0, (now - startsAt) / span));

  const zones = [...db.zones.values()].filter((z) => !z.blocked);
  const weak =
    phase >= 2 && status === 'active'
      ? raidWeakPoints(
          zones.map((z) => z.id),
          `global:${id}`,
          db.brToday(),
        )
      : [];
  const zoneName = new Map(zones.map((z) => [z.id, z.name]));

  // Ranking da Raid: os corredores de demonstração com parte determinística do dano da cidade.
  const cityDamage = hpMax - hp - myDamage;
  const others = demoRunners(db, userId!).map((p) => ({ p, damage: Math.round(cityDamage * 0.03 * (0.4 + 1.6 * raidSeededUnit(`${p.id}|${weekStart}`))) }));
  const board = [...others.map((o) => ({ id: o.p.id, username: o.p.username, faction: o.p.faction, damage: o.damage, you: false }))];
  const meRow = db.profile(userId);
  if (myDamage > 0) board.push({ id: userId!, username: String(meRow?.username ?? ''), faction: (meRow?.faction ?? null) as FactionId, damage: myDamage, you: true });
  board.sort((a, b) => b.damage - a.damage || a.username.localeCompare(b.username));
  const rankOf = (i: number) => board.findIndex((x) => x.damage === board[i].damage) + 1;
  const myIndex = board.findIndex((x) => x.you);
  const myRank = myIndex >= 0 ? rankOf(myIndex) : null;

  const crewDamage = db.tables.crews.map((c) => {
    const members = new Set(db.tables.crew_members.filter((m) => m.crew_id === c.id).map((m) => String(m.user_id)));
    return { name: String(c.name), tag: String(c.tag), faction: c.faction, damage: board.filter((b) => members.has(b.id)).reduce((s, b) => s + b.damage, 0) };
  });

  const rewards: Row[] = [];
  if (status !== 'active' && myDamage > 0) {
    rewards.push({ kind: 'participacao', xp: Math.min(300, Math.floor(myDamage / 2)), chestRarity: null, cosmeticId: null, medalTier: null });
    const tier = raidRewardTier(defeated ? fallAt : null, startsAt);
    if (defeated && tier && myDamage >= RAID_MIN_REWARD_DAMAGE) {
      const chest = tier.tier === 'lendario' && raidSeededUnit(`${id}|${userId}`) >= tier.chances.lendario ? 'raro' : tier.tier;
      rewards.push({ kind: 'derrota', xp: 200, chestRarity: chest, cosmeticId: null, medalTier: myRank !== null && myRank <= 10 ? 'prata' : 'bronze' });
    }
  }

  const seen = visits.get(db) ?? new Map<string, { hp: number; at: number }>();
  visits.set(db, seen);
  const last = seen.get(`${userId}|${id}`);
  seen.set(`${userId}|${id}`, { hp, at: now });

  return {
    raid: {
      id,
      bossId,
      name: RAID_BOSSES[bossId].name,
      theme: BOSS_LINES[bossId].theme,
      weakness: RAID_BOSSES[bossId].weakness,
      introLine: BOSS_LINES[bossId].introLine,
      defeatLine: BOSS_LINES[bossId].defeatLine,
      artKey: `chefao-${bossId}`,
      city: null,
      weekStart,
      startsAt,
      endsAt,
      hp,
      hpMax,
      phase,
      status,
      participants: others.length + (myDamage > 0 ? 1 : 0) + Math.round(160 * f),
      defeatedAt: defeated ? fallAt : null,
      isDemo: true,
      weakPoints: weak.map((z) => {
        const c = cellCenter(z);
        return { zoneId: z, name: zoneName.get(z) ?? null, center: [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))] };
      }),
    },
    me: { damage: myDamage, meters: myMeters, hits, todayMeters: Math.round((perDay.get(db.brToday())?.km ?? 0) * 1000), rank: myRank, rewards },
    sinceLastVisit: last ? { damage: Math.max(0, last.hp - hp), since: last.at } : null,
    topRunners: board.slice(0, 10).map((b, i) => ({ position: rankOf(i), username: b.username, faction: b.faction, avatarUrl: null, damage: b.damage, you: b.you })),
    topCrews: crewDamage.filter((c) => c.damage > 0).sort((a, b) => b.damage - a.damage || a.tag.localeCompare(b.tag)).slice(0, 5),
    params: RAID_PARAMS,
  };
}

/* ================================================================== Liga (D-68) */

const LEAGUE_GROUP = 30;
/** Nomes de quem completa o grupo de 30 (todos de demonstração). */
const FILL_NAMES = ['passada', 'ladeira', 'garoa', 'trote', 'sereno', 'pique', 'folego', 'cadencia', 'largada', 'sprint'];

function leagueCurrent(db: DemoDb, userId: string | null) {
  const me = requireActive(db, userId);
  const now = db.now();
  const { startsAt, closesAt } = leagueWeek(now);
  const weekStart = mondayOf(startsAt);
  const joined = scoredRuns(db, userId!, startsAt, now + 1).length > 0;
  const lastWeekRuns = scoredRuns(db, userId!, startsAt - WEEK, startsAt);
  const lastResult = lastWeekRuns.length
    ? { weekStart: mondayOf(startsAt - WEEK), division: 0, divisionName: LEAGUE_DIVISIONS[0], finalRank: 4, outcome: 'promoted' }
    : null;
  const division = lastResult ? 1 : 0;

  let members: Row[] = [];
  if (joined) {
    const people = [
      { userId: userId!, username: String(me.username), faction: me.faction as FactionId | null, points: db.stats(userId!, 'week').rp },
      ...demoRunners(db, userId!).map((p) => ({ userId: p.id, username: p.username, faction: p.faction, points: db.stats(p.id, 'week').rp })),
    ].slice(0, LEAGUE_GROUP);
    for (let i = 0; people.length < LEAGUE_GROUP; i++) {
      const name = `${FILL_NAMES[i % FILL_NAMES.length]}${i >= FILL_NAMES.length ? Math.floor(i / FILL_NAMES.length) + 1 : ''}.demo`;
      people.push({ userId: `demo-liga-${i}`, username: name, faction: FACTION_IDS[i % FACTION_IDS.length], points: Math.round(320 * raidSeededUnit(`${name}|${weekStart}`)) });
    }
    const byId = new Map(people.map((p) => [p.userId, p]));
    members = leagueStandingsV2(
      people.map((p) => ({ userId: p.userId, points: p.points })),
      division,
    ).map((s) => {
      const p = byId.get(s.userId)!;
      return {
        position: s.rank,
        username: p.username,
        faction: p.faction,
        avatarUrl: null,
        points: s.points,
        you: s.userId === userId,
        zone: s.result === 'promoted' ? 'promote' : s.result === 'relegated' ? 'relegate' : null,
      };
    });
  }
  const size = members.length;
  const small = size < LEAGUE_V2_SMALL_GROUP;
  const moves = leagueMovesFor(size);
  return {
    weekStart,
    closesAt,
    division,
    divisionName: LEAGUE_DIVISIONS[division],
    joined,
    groupSize: size,
    smallGroup: small,
    promoteSlots: division >= LEAGUE_DIVISIONS.length - 1 ? 0 : small ? 1 : moves,
    relegateSlots: division <= 0 || small ? 0 : moves,
    members,
    lastResult,
  };
}

/* ================================================================== Pintura (D-62) */

const zoneCellsCache = new WeakMap<DemoDb, Map<string, string[]>>();

/** Trechos (res 11) de uma zona, em ordem determinística: amostra em volta do centro e fica com os da zona. */
function cellsOfZone(db: DemoDb, zoneId: string): string[] {
  const cache = zoneCellsCache.get(db) ?? new Map<string, string[]>();
  zoneCellsCache.set(db, cache);
  let cells = cache.get(zoneId);
  if (!cells) {
    const center = cellCenter(zoneId);
    const set = new Set<string>();
    for (let ring = 0; ring <= 8; ring++) {
      const n = Math.max(1, ring * 6);
      for (let k = 0; k < n; k++) {
        const c = paintCellOf(offset(center, ring * 25, (360 * k) / n));
        if (paintZoneOf(c) === zoneId) set.add(c);
      }
    }
    cells = [...set].sort((a, b) => raidSeededUnit(`${zoneId}|${a}`) - raidSeededUnit(`${zoneId}|${b}`));
    cache.set(zoneId, cells);
  }
  return cells;
}

function zonePaintNear(db: DemoDb, userId: string | null, args: Row) {
  requireActive(db, userId);
  const lat = Number(args.p_lat);
  const lng = Number(args.p_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw raise('VALIDATION: posição inválida');
  const radius = Math.min(3000, Math.max(50, Number(args.p_radius_m) || 1500));
  const here = { lat, lng };
  const now = db.now();
  const privacy = db.tables.privacy_zones.map((p) => ({ c: { lat: Number(p.lat), lng: Number(p.lng) }, r: Number(p.radius_m) || 200 }));
  const hidden = (cell: string) => privacy.some((p) => distanceMeters(cellCenter(cell), p.c) <= p.r);

  // Mesmo formato do servidor real (`zone_paint_near`, migration 20261023120700_paint): mapas por id.
  const cells: Record<string, Row> = {};
  const zones: Record<string, Row> = {};
  for (const z of db.zones.values()) {
    if (distanceMeters(cellCenter(z.id), here) > radius + 200) continue;
    const attackAt = msOf(z.attack_started_at);
    zones[z.id] = {
      owner: z.owner,
      name: z.name,
      inherited: 0,
      blocked: z.blocked,
      underAttack: !!(z.owner && z.attacker && attackAt !== null && now - attackAt <= PAINT_ATTACK_WINDOW_MS),
    };
    if (z.blocked) continue;
    // Placar coerente com a influência: ~1 trecho a cada 10 pontos; o dono lidera com ≥ 3; zona neutra sem líder.
    const counts = Object.fromEntries(FACTION_IDS.map((f) => [f, Math.min(12, Math.round((z.influence[f] ?? 0) / 10))])) as Record<FactionId, number>;
    if (z.owner) {
      const top = Math.max(...FACTION_IDS.filter((f) => f !== z.owner).map((f) => counts[f]));
      counts[z.owner] = Math.max(counts[z.owner], top + 1, 3);
    } else for (const f of FACTION_IDS) counts[f] = Math.min(counts[f], 2);
    const pool = cellsOfZone(db, z.id);
    let i = 0;
    for (const f of FACTION_IDS) {
      for (let k = 0; k < counts[f] && i < pool.length; k++, i++) {
        const cell = pool[i];
        if (hidden(cell)) continue;
        cells[cell] = { faction: f, layers: 1 + Math.floor(raidSeededUnit(`camadas|${cell}`) * PAINT_MAX_LAYERS) };
      }
    }
  }
  return { rule: 'v2', cells, zones, paintedToday: [] };
}

/** As RPCs da E3 no servidor de demonstração (o índice fica em `rpc.ts`). */
export const DEMO_GAME_V2_RPC_HANDLERS: Record<string, RpcHandler> = {
  raid_current: (db, userId) => raidCurrent(db, userId),
  league_current: (db, userId) => leagueCurrent(db, userId),
  zone_paint_near: zonePaintNear,
};
