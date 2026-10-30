import { weekStartBrt } from './season';

/**
 * D-67 — Raid real semanal: "Toda semana um chefão invade a cidade: cada quilômetro que você corre tira
 * 10 de vida dele."
 *
 * - Janela: segunda 06:00 → domingo 21:00 (Brasília).
 * - Vida proporcional ao volume da cidade (mediana dos km semanais das 4 últimas semanas × 0,75 × 10 × fator).
 * - Fases 100% / 67% / 33%; a fase só avança. Pontos fracos (zonas com dano ×2) a partir da fase 2.
 * - Dano 10/km; crítico de 10% (chance visível), sorteado de forma determinística pela semente (id da atividade).
 * - Tetos: 21 km por corrida e 30 km por dia (300 de dano por dia, com crítico incluído).
 * - Só cosmético: nada de vantagem de território.
 *
 * Puro: o instante vem em `now` e a sorte vem de uma semente.
 */

/** Ids iguais aos da arte da E4 e às tabelas da E9. */
export const RAID_BOSS_IDS = ['soneca', 'rei-buzina', 'fuligem', 'mormaco', 'paredao'] as const;
export type RaidBossId = (typeof RAID_BOSS_IDS)[number];

/** Nome e "fraqueza" (só sabor de texto do ponto fraco; a mecânica é sempre zona ×2). */
export const RAID_BOSSES: Readonly<Record<RaidBossId, { name: string; weakness: string }>> = Object.freeze({
  soneca: { name: 'Soneca', weakness: 'Corrida antes das 8h' },
  'rei-buzina': { name: 'Rei Buzina', weakness: 'Ruas de bairro' },
  fuligem: { name: 'Fuligem', weakness: 'Parques e praças' },
  mormaco: { name: 'Mormaço', weakness: 'Sombra das árvores' },
  paredao: { name: 'Paredão', weakness: 'Ruas que você nunca correu' },
});

export const RAID_DAMAGE_PER_KM = 10;
export const RAID_CRIT_CHANCE = 0.1;
export const RAID_CRIT_MULTIPLIER = 2;
export const RAID_WEAK_POINT_MULTIPLIER = 2;
/** Corrida em grupo (M_grupo) na fase 3. */
export const RAID_PACK_MULTIPLIER = 1.25;
export const RAID_RUN_CAP_KM = 21;
export const RAID_DAILY_CAP_KM = 30;
export const RAID_DAILY_DAMAGE_CAP = RAID_DAILY_CAP_KM * RAID_DAMAGE_PER_KM;
export const RAID_MIN_HP = 500;
export const RAID_HP_SHARE = 0.75;
export const RAID_HISTORY_WEEKS = 4;
export const RAID_FACTOR_MIN = 0.7;
export const RAID_FACTOR_MAX = 1.5;
export const RAID_FACTOR_STEP = 0.1;
/** Fase 2 quando a vida chega a 67%; fase 3 a 33%. */
export const RAID_PHASE2_AT = 0.67;
export const RAID_PHASE3_AT = 0.33;
export const RAID_WEAK_POINTS_PER_DAY = 3;
/** Dano mínimo (1 km) para receber a recompensa coletiva. */
export const RAID_MIN_REWARD_DAMAGE = 10;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export type RaidPhase = 1 | 2 | 3;
export type RaidStatus = 'upcoming' | 'active' | 'defeated' | 'escaped';

export type RaidState = {
  id: string;
  bossId: RaidBossId;
  startsAt: number;
  endsAt: number;
  hpMax: number;
  hp: number;
  phase: RaidPhase;
  status: 'active' | 'defeated' | 'escaped';
  defeatedAt: number | null;
  finalBlowBy: string | null;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const finiteOr = (v: number | undefined, fallback: number) => (v !== undefined && Number.isFinite(v) ? v : fallback);

/* ---------- calendário ---------- */

/** Janela da semana do instante: segunda 06:00 → domingo 21:00 (Brasília). */
export function raidWeekWindow(now: number): { startsAt: number; endsAt: number } {
  const monday = weekStartBrt(now);
  return { startsAt: monday + 6 * HOUR, endsAt: monday + 6 * DAY + 21 * HOUR };
}

/** Segunda 19/10/2026 06:00 (Brasília): semana 0 da rotação dos chefões. */
export const RAID_ROTATION_EPOCH = Date.UTC(2026, 9, 19, 9, 0, 0);

/**
 * D-84: meses (1 = janeiro) em que a Fuligem (fumaça) fica fora do rodízio — a época das queimadas.
 * A arte (E4) pediu para o jogo não incentivar correr na fumaça.
 */
export const RAID_FULIGEM_OFF_MONTHS: readonly number[] = Object.freeze([8, 9]);

const BRT_MS = -3 * HOUR;

/** Semana do rodízio (0 = a da época) do instante: a semana de Brasília que o contém (segunda 00:00). */
const rotationWeek = (at: number) => Math.round((weekStartBrt(at) - weekStartBrt(RAID_ROTATION_EPOCH)) / WEEK);

/** Mês (1–12, Brasília) da segunda-feira que abre a semana do instante. */
export const raidWeekMonth = (at: number) => new Date(weekStartBrt(at) - BRT_MS).getUTCMonth() + 1;

/**
 * Rodízio puro, sem a D-84: os 5 chefões em ordem fixa a partir da semana de 19/10/2026 (Soneca).
 * Vale qualquer instante da semana (de segunda 00:00 a domingo 23:59 de Brasília), como o
 * `private.raid_boss_for_week(week_start)` do servidor.
 */
export function raidRotationBossForWeek(startsAt: number): RaidBossId {
  const n = RAID_BOSS_IDS.length;
  const week = rotationWeek(startsAt);
  return RAID_BOSS_IDS[((week % n) + n) % n];
}

/**
 * Chefão da semana do instante `startsAt`: o rodízio fixo, com a D-84 — nas semanas que começam (segunda-feira,
 * Brasília) em agosto ou setembro, a Fuligem é pulada e entra o próximo chefão do rodízio (Mormaço). As outras
 * semanas não mudam. Paridade com o job do servidor (E9): `private.raid_boss_for_week`.
 */
export function raidBossForWeek(startsAt: number): RaidBossId {
  const boss = raidRotationBossForWeek(startsAt);
  if (boss !== 'fuligem' || !RAID_FULIGEM_OFF_MONTHS.includes(raidWeekMonth(startsAt))) return boss;
  const i = RAID_BOSS_IDS.indexOf(boss);
  return RAID_BOSS_IDS[(i + 1) % RAID_BOSS_IDS.length];
}

/* ---------- vida, fator e fases ---------- */

/**
 * Vida do chefão: max(500, 0,75 × mediana dos km semanais da cidade × 10 × fator).
 * Usa as 4 semanas mais recentes (fim da lista); valores inválidos são ignorados.
 */
export function raidHpFor(cityWeeklyKm: readonly number[], factor = 1): number {
  const valid = cityWeeklyKm.filter((k) => Number.isFinite(k) && k >= 0).slice(-RAID_HISTORY_WEEKS);
  if (valid.length === 0) return RAID_MIN_HP;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const f = clamp(finiteOr(factor, 1), RAID_FACTOR_MIN, RAID_FACTOR_MAX);
  return Math.max(RAID_MIN_HP, Math.round(RAID_HP_SHARE * median * RAID_DAMAGE_PER_KM * f));
}

/** Ajuste do fator para a semana seguinte: caiu antes de sábado → +10%; fugiu → −10%; limites 0,7–1,5. */
export function raidNextFactor(factor: number, defeatedAt: number | null, startsAt: number): number {
  const f = clamp(finiteOr(factor, 1), RAID_FACTOR_MIN, RAID_FACTOR_MAX);
  const saturday = weekStartBrt(startsAt) + 5 * DAY;
  const delta = defeatedAt === null ? -RAID_FACTOR_STEP : defeatedAt < saturday ? RAID_FACTOR_STEP : 0;
  return Math.round(clamp(f + delta, RAID_FACTOR_MIN, RAID_FACTOR_MAX) * 100) / 100;
}

/** Fase pela vida restante (1: > 67%; 2: > 33%; 3: o resto). */
export function raidPhase(hp: number, hpMax: number): RaidPhase {
  const pct = hpMax > 0 ? clamp(hp, 0, hpMax) / hpMax : 0;
  if (pct > RAID_PHASE2_AT) return 1;
  if (pct > RAID_PHASE3_AT) return 2;
  return 3;
}

/** A fase nunca volta: a maior entre a atual e a da vida. */
export const raidAdvancePhase = (current: RaidPhase, hp: number, hpMax: number): RaidPhase =>
  Math.max(current, raidPhase(hp, hpMax)) as RaidPhase;

/** Abre a Raid da semana do instante. */
export function newRaid(id: string, now: number, cityWeeklyKm: readonly number[], factor = 1): RaidState {
  const { startsAt, endsAt } = raidWeekWindow(now);
  const hpMax = raidHpFor(cityWeeklyKm, factor);
  return { id, bossId: raidBossForWeek(startsAt), startsAt, endsAt, hpMax, hp: hpMax, phase: 1, status: 'active', defeatedAt: null, finalBlowBy: null };
}

/** Situação no instante (o job de domingo 21:00 grava 'escaped'; antes disso a tela já pode mostrar). */
export function raidStatusAt(raid: RaidState, now: number): RaidStatus {
  if (raid.status !== 'active') return raid.status;
  if (now < raid.startsAt) return 'upcoming';
  if (now >= raid.endsAt) return 'escaped';
  return 'active';
}

/** Job de domingo 21:00: fecha a Raid que não caiu. */
export function closeRaid(raid: RaidState, now: number): RaidState {
  return raidStatusAt(raid, now) === 'escaped' && raid.status === 'active' ? { ...raid, status: 'escaped' } : raid;
}

/* ---------- sorte determinística ---------- */

/** Número em [0, 1) derivado de uma semente de texto (FNV-1a + mistura). Mesmo texto, mesmo número. */
export function raidSeededUnit(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Crítico (10%, chance visível): sorteio determinístico pela semente (o id da atividade). */
export const raidCritRoll = (seed: string, chance = RAID_CRIT_CHANCE) => raidSeededUnit(`crit:${seed}`) < chance;

/* ---------- dano ---------- */

export type RaidHitInput = {
  /** Metros válidos da corrida (corrida rejeitada ou em revisão não chama esta função). */
  validMeters: number;
  /** Metros dentro de pontos fracos (só valem da fase 2 em diante). */
  weakPointMeters?: number;
  phase: RaidPhase;
  /** Corrida em grupo da Crew (M_grupo): ×1,25 na fase 3. */
  inPack?: boolean;
  /** Semente do crítico: o id da atividade (cada atividade dá dano 1 vez). */
  seed: string;
  /** Dano e km que o corredor já deu hoje (tetos diários). */
  damageToday?: number;
  kmToday?: number;
};

export type RaidHit = {
  damage: number;
  /** Km que contaram, depois dos tetos de 21 km por corrida e 30 km por dia. */
  countedKm: number;
  weakKm: number;
  crit: boolean;
  pack: boolean;
  /** O teto diário de dano cortou parte do golpe. */
  capped: boolean;
};

/** Dano de uma corrida: sempre ≥ 0 e nunca passa o teto diário. */
export function raidDamage(input: RaidHitInput): RaidHit {
  const km = Math.max(0, finiteOr(input.validMeters, 0)) / 1000;
  const roomKm = Math.max(0, RAID_DAILY_CAP_KM - Math.max(0, finiteOr(input.kmToday, 0)));
  const countedKm = Math.min(km, RAID_RUN_CAP_KM, roomKm);
  const weakKm = input.phase >= 2 ? clamp(Math.max(0, finiteOr(input.weakPointMeters, 0)) / 1000, 0, countedKm) : 0;
  const crit = raidCritRoll(input.seed);
  const pack = input.phase === 3 && input.inPack === true;
  const raw =
    (countedKm + weakKm * (RAID_WEAK_POINT_MULTIPLIER - 1)) *
    RAID_DAMAGE_PER_KM *
    (crit ? RAID_CRIT_MULTIPLIER : 1) *
    (pack ? RAID_PACK_MULTIPLIER : 1);
  const full = Math.floor(raw + 1e-9);
  const room = Math.max(0, RAID_DAILY_DAMAGE_CAP - Math.max(0, finiteOr(input.damageToday, 0)));
  return { damage: Math.min(full, room), countedKm, weakKm, crit, pack, capped: full > room };
}

/**
 * Aplica um golpe ao chefão. Fora da janela, com o chefão já derrotado ou fugido, não muda nada.
 * A vida nunca fica negativa, a fase só avança e o golpe final fica registrado (cosmético).
 */
export function applyRaidHit(
  raid: RaidState,
  damage: number,
  now: number,
  userId: string,
): { raid: RaidState; applied: number; phaseChanged: boolean; finalBlow: boolean } {
  if (raidStatusAt(raid, now) !== 'active') return { raid, applied: 0, phaseChanged: false, finalBlow: false };
  const applied = Math.min(raid.hp, Math.max(0, Math.floor(finiteOr(damage, 0))));
  const hp = raid.hp - applied;
  const phase = raidAdvancePhase(raid.phase, hp, raid.hpMax);
  const finalBlow = hp === 0 && applied > 0;
  const next: RaidState = finalBlow
    ? { ...raid, hp, phase, status: 'defeated', defeatedAt: now, finalBlowBy: userId }
    : { ...raid, hp, phase };
  return { raid: next, applied, phaseChanged: phase !== raid.phase, finalBlow };
}

/* ---------- pontos fracos ---------- */

/**
 * Pontos fracos do dia (fase 2 em diante): 3 zonas sorteadas pela semente (cidade + raid) e pelo dia,
 * preferindo as zonas de `preferred` (parques). Determinístico e sem repetição.
 */
export function raidWeakPoints(
  zoneIds: readonly string[],
  seed: string,
  day: string,
  preferred: ReadonlySet<string> = new Set(),
  count = RAID_WEAK_POINTS_PER_DAY,
): string[] {
  const unique = [...new Set(zoneIds)];
  const score = (z: string) => (preferred.has(z) ? 0 : 1) + raidSeededUnit(`${seed}|${day}|${z}`);
  return unique
    .map((z) => ({ z, s: score(z) }))
    .sort((a, b) => a.s - b.s)
    .slice(0, Math.max(0, count))
    .map((x) => x.z);
}

/* ---------- recompensas e "Sua parte" ---------- */

export type RaidChestTier = 'lendario' | 'raro' | 'comum';

/**
 * Baú do chefão pela hora da queda (chances visíveis): até quinta 23:59 → 15% lendário / 85% raro;
 * sexta e sábado → raro; domingo → comum. Chefão que fugiu não dá baú (null).
 */
export function raidRewardTier(defeatedAt: number | null, startsAt: number): { tier: RaidChestTier; chances: Record<RaidChestTier, number> } | null {
  if (defeatedAt === null) return null;
  const monday = weekStartBrt(startsAt);
  if (defeatedAt < monday + 4 * DAY) return { tier: 'lendario', chances: { lendario: 0.15, raro: 0.85, comum: 0 } };
  if (defeatedAt < monday + 6 * DAY) return { tier: 'raro', chances: { lendario: 0, raro: 1, comum: 0 } };
  return { tier: 'comum', chances: { lendario: 0, raro: 0, comum: 1 } };
}

/** Recebe a recompensa coletiva quem deu pelo menos 10 de dano (1 km) num chefão derrotado. */
export const raidRewardEligible = (raid: RaidState, myDamage: number) => raid.status === 'defeated' && myDamage >= RAID_MIN_REWARD_DAMAGE;

/** "Sua parte" (0 a 1) do dano total da cidade. */
export const raidShare = (myDamage: number, totalDamage: number) =>
  totalDamage > 0 && Number.isFinite(myDamage) ? clamp(myDamage / totalDamage, 0, 1) : 0;

/** "Dano da cidade desde a sua última visita". */
export const raidDamageSince = (hpAtLastVisit: number, hpNow: number) => Math.max(0, hpAtLastVisit - hpNow);
