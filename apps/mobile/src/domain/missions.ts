/**
 * Missões v2 (Fase 7, E7; D-65): catálogo tipado, sorteio determinístico por semente (3 diárias e 3
 * semanais, sempre 1 leve, troca de 1 por dia), progresso a partir do resultado oficial das atividades,
 * conclusão no máximo 1 vez, primeira semana com 7 passos sem prazo e missão de volta.
 *
 * Os ids são os de `docs/melhoria/F1/engajamento/catalogo.ts` (a E9 grava esses ids no banco): não renomear.
 * Textos seguem o glossário da D-74 ("Atlas", não "Neblina"). Cada texto tem no máximo 40 caracteres com o
 * maior valor possível de `{x}` (conferido por teste).
 */
import type { ActivityValidation } from './anti-cheat';
import type { ChestRarity } from './games';
import { brtCalendar, engagementRng, type XpSource } from './progression';

export const MISSION_TEXT_MAX = 40;

export type MissionCadence = 'diaria' | 'semanal' | 'ftue' | 'volta';
export type MissionTier = 'leve' | 'padrao' | 'desafio';

/** O que a missão mede. Somas usam o resultado oficial; "distintos" contam ids diferentes no período. */
export type MissionMetric =
  | 'movingSeconds'
  | 'meters'
  | 'atlasCells'
  | 'zonesPainted'
  | 'districts'
  | 'huntChests'
  | 'ghostWins'
  | 'conquered'
  | 'defended'
  | 'groupActivities'
  | 'activities'
  | 'raidMeters'
  | 'paintedActivities'
  | 'crewMember'
  | 'leaguePoints'
  | 'rankingOpened'
  | 'shares';

/** Alvo fixo ou adaptativo ao volume da pessoa (em metros quando a métrica é distância). */
export type MissionTarget = number | 'dailyKm' | 'weeklyKm' | 'raidKm';

/** Só é sorteada quando faz sentido: quem não tem crew não recebe missão de crew. */
export type MissionRequirement = 'crew' | 'zoneUnderAttack' | 'raid';

export type MissionDef = {
  id: string;
  cadence: MissionCadence;
  tier: MissionTier;
  /** Texto final (≤ 40). `{x}` = alvo em km. */
  text: string;
  metric: MissionMetric;
  target: MissionTarget;
  /** Filtro por atividade (ex.: Fuga de pelo menos 1 km). */
  minMeters?: number;
  xp: number;
  requires?: MissionRequirement;
  /** Primeira semana: troca quando o modo real ainda não existe (Raid e Liga). */
  fallback?: { when: 'noRaid' | 'noLeague'; text: string; metric: MissionMetric; target: number };
  bonus?: { dailyChest?: ChestRarity; cosmetic?: string; streakRestart?: boolean };
};

const KM = 1000;

export const MISSION_CATALOG: readonly MissionDef[] = [
  // ---------- Diárias (1 leve + 1 padrão + 1 desafio por dia; 20/30/40 XP) ----------
  { id: 'd-mover-15', cadence: 'diaria', tier: 'leve', text: 'Mova-se 15 min (caminhar vale)', metric: 'movingSeconds', target: 900, xp: 20 },
  { id: 'd-1500m', cadence: 'diaria', tier: 'leve', text: 'Caminhe ou corra 1,5 km', metric: 'meters', target: 1500, xp: 20 },
  { id: 'd-neblina-5', cadence: 'diaria', tier: 'leve', text: 'Revele 5 trechos novos do Atlas', metric: 'atlasCells', target: 5, xp: 20 },
  { id: 'd-km', cadence: 'diaria', tier: 'padrao', text: 'Corra {x} km hoje', metric: 'meters', target: 'dailyKm', xp: 30 },
  { id: 'd-pintar-3', cadence: 'diaria', tier: 'padrao', text: 'Pinte 3 zonas com a cor do time', metric: 'zonesPainted', target: 3, xp: 30 },
  { id: 'd-caca-2', cadence: 'diaria', tier: 'padrao', text: 'Abra 2 baús na Caça', metric: 'huntChests', target: 2, xp: 30 },
  { id: 'd-fantasma', cadence: 'diaria', tier: 'padrao', text: 'Termine à frente do fantasma', metric: 'ghostWins', target: 1, xp: 30 },
  { id: 'd-conquistar', cadence: 'diaria', tier: 'desafio', text: 'Conquiste uma zona', metric: 'conquered', target: 1, xp: 40 },
  { id: 'd-defender', cadence: 'diaria', tier: 'desafio', text: 'Defenda uma zona sob ataque', metric: 'defended', target: 1, xp: 40, requires: 'zoneUnderAttack' },
  { id: 'd-crew', cadence: 'diaria', tier: 'desafio', text: 'Corra junto com alguém da crew', metric: 'groupActivities', target: 1, xp: 40, requires: 'crew' },
  { id: 'd-neblina-20', cadence: 'diaria', tier: 'desafio', text: 'Revele 20 trechos novos da cidade', metric: 'atlasCells', target: 20, xp: 40 },

  // ---------- Semanais (segunda 00:00 a domingo 23:59 BRT; 100/150/200 XP) ----------
  { id: 's-2-atividades', cadence: 'semanal', tier: 'leve', text: 'Faça 2 atividades na semana', metric: 'activities', target: 2, xp: 100 },
  { id: 's-60-min', cadence: 'semanal', tier: 'leve', text: 'Some 60 minutos de movimento', metric: 'movingSeconds', target: 3600, xp: 100 },
  { id: 's-km', cadence: 'semanal', tier: 'padrao', text: 'Some {x} km na semana', metric: 'meters', target: 'weeklyKm', xp: 150 },
  { id: 's-pintar-10', cadence: 'semanal', tier: 'padrao', text: 'Pinte 10 zonas diferentes', metric: 'zonesPainted', target: 10, xp: 150 },
  { id: 's-bairros-2', cadence: 'semanal', tier: 'padrao', text: 'Corra em 2 bairros diferentes', metric: 'districts', target: 2, xp: 150 },
  { id: 's-conquistar-3', cadence: 'semanal', tier: 'desafio', text: 'Conquiste 3 zonas na semana', metric: 'conquered', target: 3, xp: 200 },
  { id: 's-chefao', cadence: 'semanal', tier: 'desafio', text: 'Cause {x} km de dano no chefão', metric: 'raidMeters', target: 'raidKm', xp: 200, requires: 'raid' },
  { id: 's-crew-2', cadence: 'semanal', tier: 'desafio', text: 'Corra 2 vezes com a sua crew', metric: 'groupActivities', target: 2, xp: 200, requires: 'crew' },

  // ---------- Primeira semana: um passo libera por dia, nunca expira (400 XP no total) ----------
  { id: 'f1-dominio', cadence: 'ftue', tier: 'leve', text: 'Corra 500 m e pinte sua 1ª zona', metric: 'paintedActivities', target: 1, minMeters: 500, xp: 100, bonus: { dailyChest: 'raro' } },
  { id: 'f2-caca', cadence: 'ftue', tier: 'leve', text: 'Abra seu primeiro baú na Caça', metric: 'huntChests', target: 1, xp: 40 },
  { id: 'f3-fuga', cadence: 'ftue', tier: 'leve', text: 'Vença o fantasma em 1 km', metric: 'ghostWins', target: 1, minMeters: KM, xp: 40 },
  {
    id: 'f4-raid', cadence: 'ftue', tier: 'leve', text: 'Cause 1 km de dano no chefão', metric: 'raidMeters', target: KM, xp: 40,
    fallback: { when: 'noRaid', text: 'Revele 10 trechos do Atlas', metric: 'atlasCells', target: 10 },
  },
  { id: 'f5-crew', cadence: 'ftue', tier: 'leve', text: 'Entre numa crew ou crie a sua', metric: 'crewMember', target: 1, xp: 60 },
  {
    id: 'f6-liga', cadence: 'ftue', tier: 'leve', text: 'Some seus primeiros pontos na liga', metric: 'leaguePoints', target: 1, xp: 60,
    fallback: { when: 'noLeague', text: 'Veja o ranking do seu time', metric: 'rankingOpened', target: 1 },
  },
  { id: 'f7-compartilhar', cadence: 'ftue', tier: 'leve', text: 'Compartilhe o card de uma corrida', metric: 'shares', target: 1, xp: 60, bonus: { cosmetic: 'moldura-primeira-semana' } },

  // ---------- Volta depois de sumir (7, 14 e 30 dias sem atividade) ----------
  { id: 'v-7', cadence: 'volta', tier: 'leve', text: 'Volta leve: 10 minutos já contam', metric: 'movingSeconds', target: 600, xp: 50, bonus: { dailyChest: 'raro' } },
  { id: 'v-14', cadence: 'volta', tier: 'leve', text: 'Caminhe 1 km no seu ritmo', metric: 'meters', target: KM, xp: 60, bonus: { dailyChest: 'raro' } },
  { id: 'v-30', cadence: 'volta', tier: 'leve', text: 'Recomece: 10 minutos, sem pressa', metric: 'movingSeconds', target: 600, xp: 80, bonus: { dailyChest: 'lendario', streakRestart: true } },
];

const BY_ID = new Map(MISSION_CATALOG.map((m) => [m.id, m]));

export function missionById(id: string): MissionDef | undefined {
  return BY_ID.get(id);
}

/** Fonte do `xp_ledger` para a recompensa da missão. */
export function missionXpSource(def: MissionDef): XpSource {
  if (def.cadence === 'ftue') return 'ftue';
  if (def.cadence === 'volta') return 'comeback';
  return 'mission';
}

/* ---------- Alvos adaptativos (o esforço relativo da E3 aplicado às missões) ---------- */

export const MISSION_TARGETS = {
  dailyKm: { min: 2, max: 8, recentRuns: 10 },
  weeklyKm: { min: 6, max: 40, recentWeeks: 4, share: 0.9, maxGrowth: 1.1 },
  raidKm: { min: 1, max: 15, share: 0.5 },
} as const;

const roundHalfKm = (km: number) => Math.round(km * 2) / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** `d-km`: mediana das últimas 10 atividades, arredondada a 0,5 km, entre 2 e 8 km (em metros). */
export function dailyKmTarget(recentRunMeters: readonly number[]): number {
  const recent = recentRunMeters.filter((m) => Number.isFinite(m) && m > 0).slice(0, MISSION_TARGETS.dailyKm.recentRuns);
  if (recent.length === 0) return MISSION_TARGETS.dailyKm.min * KM;
  return clamp(roundHalfKm(median(recent) / KM), MISSION_TARGETS.dailyKm.min, MISSION_TARGETS.dailyKm.max) * KM;
}

/**
 * `s-km`: 90% da mediana das últimas 4 semanas, nunca acima de +10% da maior delas, entre 6 e 40 km.
 * Semanas zeradas contam (quem descansou recebe um alvo menor, nunca maior).
 */
export function weeklyKmTarget(recentWeekMeters: readonly number[]): number {
  const weeks = recentWeekMeters.filter((m) => Number.isFinite(m) && m >= 0).slice(0, MISSION_TARGETS.weeklyKm.recentWeeks);
  if (weeks.length === 0) return MISSION_TARGETS.weeklyKm.min * KM;
  const km = Math.min(median(weeks) * MISSION_TARGETS.weeklyKm.share, Math.max(...weeks) * MISSION_TARGETS.weeklyKm.maxGrowth) / KM;
  return clamp(roundHalfKm(km), MISSION_TARGETS.weeklyKm.min, MISSION_TARGETS.weeklyKm.max) * KM;
}

/** `s-chefao`: metade do alvo semanal de km, entre 1 e 15 km. */
export function raidKmTarget(weeklyTargetMeters: number): number {
  return clamp(roundHalfKm((weeklyTargetMeters * MISSION_TARGETS.raidKm.share) / KM), MISSION_TARGETS.raidKm.min, MISSION_TARGETS.raidKm.max) * KM;
}

/** Km no padrão brasileiro: 8 → "8", 8,5 → "8,5". */
export function formatMissionKm(meters: number): string {
  return String(Math.round((meters / KM) * 10) / 10).replace('.', ',');
}

/** Texto final da missão, com `{x}` trocado pelo alvo (sempre em km). */
export function missionText(def: MissionDef, target: number, variant: MissionVariant = 'base'): string {
  const text = variant === 'fallback' && def.fallback ? def.fallback.text : def.text;
  return text.replace('{x}', formatMissionKm(target));
}

/* ---------- Atribuições e sorteio ---------- */

export type MissionVariant = 'base' | 'fallback';

export type MissionAssignment = {
  missionId: string;
  cadence: MissionCadence;
  /** '2026-10-23' (diária), '2026-W43' (semanal), 'ftue' ou 'volta-2026-10-23'. */
  period: string;
  /** Diárias e semanais: 0 leve, 1 padrão, 2 desafio. Primeira semana: 1..7. Volta: 0. */
  slot: number;
  /** Alvo gravado na atribuição (em metros, segundos ou contagem). */
  target: number;
  variant: MissionVariant;
  /** Janela em ms: atividades fora dela não contam. `availableUntil` nulo = sem prazo. */
  availableFrom: number;
  availableUntil: number | null;
  progress: number;
  completedAt: number | null;
  rerolled: boolean;
};

export type MissionContext = {
  userId: string;
  hasCrew: boolean;
  /** Zona do time sob ataque a até 3 km (servidor). */
  zoneUnderAttackNearby: boolean;
  raidActive: boolean;
  leagueActive: boolean;
  /** Metros das últimas atividades pontuadas, da mais nova para a mais antiga. */
  recentRunMeters: readonly number[];
  /** Metros das últimas semanas completas, da mais nova para a mais antiga. */
  recentWeekMeters: readonly number[];
};

const TIERS: readonly MissionTier[] = ['leve', 'padrao', 'desafio'];

function eligible(def: MissionDef, ctx: MissionContext): boolean {
  if (def.requires === 'crew') return ctx.hasCrew;
  if (def.requires === 'zoneUnderAttack') return ctx.zoneUnderAttackNearby;
  if (def.requires === 'raid') return ctx.raidActive;
  return true;
}

/** Alvo concreto da missão para esta pessoa agora. */
export function resolveMissionTarget(def: MissionDef, ctx: Pick<MissionContext, 'recentRunMeters' | 'recentWeekMeters'>): number {
  if (def.target === 'dailyKm') return dailyKmTarget(ctx.recentRunMeters);
  if (def.target === 'weeklyKm') return weeklyKmTarget(ctx.recentWeekMeters);
  if (def.target === 'raidKm') return raidKmTarget(weeklyKmTarget(ctx.recentWeekMeters));
  return def.target;
}

function periodWindow(cadence: 'diaria' | 'semanal', dayId: string): { period: string; from: number; until: number } {
  if (cadence === 'diaria') {
    return { period: dayId, from: brtCalendar.at(dayId), until: brtCalendar.at(brtCalendar.addDays(dayId, 1)) };
  }
  const monday = brtCalendar.weekMonday(dayId);
  return { period: brtCalendar.weekIdOf(dayId), from: brtCalendar.at(monday), until: brtCalendar.at(brtCalendar.addDays(monday, 7)) };
}

function assign(def: MissionDef, ctx: MissionContext, w: { period: string; from: number; until: number | null }, slot: number): MissionAssignment {
  return {
    missionId: def.id,
    cadence: def.cadence,
    period: w.period,
    slot,
    target: resolveMissionTarget(def, ctx),
    variant: 'base',
    availableFrom: w.from,
    availableUntil: w.until,
    progress: 0,
    completedAt: null,
    rerolled: false,
  };
}

/**
 * Sorteia as 3 missões do dia (`cadence = 'diaria'`) ou da semana (`'semanal'`, qualquer dia da semana serve):
 * 1 leve + 1 padrão + 1 desafio, só entre as possíveis para a pessoa. Mesma pessoa e mesmo período → mesmo
 * resultado (semente `userId|período`).
 */
export function drawMissions(ctx: MissionContext, cadence: 'diaria' | 'semanal', dayId: string): MissionAssignment[] {
  const w = periodWindow(cadence, dayId);
  const next = engagementRng(`${ctx.userId}|${w.period}`);
  const out: MissionAssignment[] = [];
  TIERS.forEach((tier, slot) => {
    const pool = MISSION_CATALOG.filter((m) => m.cadence === cadence && m.tier === tier && eligible(m, ctx));
    const r = next();
    if (pool.length > 0) out.push(assign(pool[Math.floor(r * pool.length)], ctx, w, slot));
  });
  return out;
}

export const MISSION_REROLLS_PER_DAY = 1;

export type RerollRefusal = 'cadence' | 'completed' | 'limit' | 'no_option' | 'slot';

/**
 * Troca 1 missão diária por dia por outra do mesmo nível que ainda não está na lista (autonomia).
 * Determinística: semente `userId|período|troca|slot`.
 */
export function rerollMission(
  ctx: MissionContext,
  current: readonly MissionAssignment[],
  slot: number,
  rerollsToday: number,
): { ok: true; assignment: MissionAssignment } | { ok: false; reason: RerollRefusal } {
  const old = current.find((a) => a.slot === slot && a.cadence === 'diaria');
  if (!old) return { ok: false, reason: current.some((a) => a.slot === slot) ? 'cadence' : 'slot' };
  if (old.completedAt !== null) return { ok: false, reason: 'completed' };
  if (rerollsToday >= MISSION_REROLLS_PER_DAY) return { ok: false, reason: 'limit' };
  const def = missionById(old.missionId);
  const taken = new Set(current.map((a) => a.missionId));
  const pool = MISSION_CATALOG.filter((m) => m.cadence === 'diaria' && m.tier === def?.tier && !taken.has(m.id) && eligible(m, ctx));
  if (pool.length === 0) return { ok: false, reason: 'no_option' };
  const pick = pool[Math.floor(engagementRng(`${ctx.userId}|${old.period}|troca|${slot}`)() * pool.length)];
  const fresh = assign(pick, ctx, { period: old.period, from: old.availableFrom, until: old.availableUntil }, slot);
  return { ok: true, assignment: { ...fresh, rerolled: true } };
}

/* ---------- Progresso e conclusão ---------- */

/** Recorte do resultado oficial de uma atividade que as missões usam. */
export type MissionActivity = {
  id: string;
  /** Fim da atividade (ms). */
  endedAt: number;
  status: ActivityValidation['status'];
  meters: number;
  movingSeconds: number;
  atlasCells: number;
  /** Zonas com pontos > 0 nesta atividade. */
  zonesPainted: readonly string[];
  /** Bairros (H3 res. 7) dessas zonas. */
  districts: readonly string[];
  conquered: number;
  defended: number;
  huntChests: number;
  beatGhost: boolean | null;
  /** Correu com bônus de grupo (crew). */
  group: boolean;
  /** Dano no chefão em metros (raid real). */
  raidMeters: number;
};

/** Tudo o que pode fazer uma missão andar: atividades e fatos que não exigem correr. */
export type MissionEvidence = {
  activities: readonly MissionActivity[];
  inCrew?: boolean;
  /** Pontos de liga da semana atual. */
  leaguePoints?: number;
  /** Quando a pessoa abriu o ranking do time (ms). */
  rankingOpenedAt?: readonly number[];
  /** Compartilhamentos concluídos (ms; `record_share`). */
  sharedAt?: readonly number[];
};

const SCORED = new Set<ActivityValidation['status']>(['valid', 'partially_valid']);

function inWindow(t: number, a: Pick<MissionAssignment, 'availableFrom' | 'availableUntil'>): boolean {
  return t >= a.availableFrom && (a.availableUntil === null || t < a.availableUntil);
}

function metricValue(metric: MissionMetric, minMeters: number, acts: readonly MissionActivity[], ev: MissionEvidence, a: MissionAssignment): number {
  const sum = (f: (x: MissionActivity) => number) => acts.reduce((s, x) => s + Math.max(0, f(x)), 0);
  const count = (f: (x: MissionActivity) => boolean) => acts.filter(f).length;
  const distinct = (f: (x: MissionActivity) => readonly string[]) => new Set(acts.flatMap(f)).size;
  switch (metric) {
    case 'movingSeconds': return sum((x) => x.movingSeconds);
    case 'meters': return sum((x) => x.meters);
    case 'atlasCells': return sum((x) => x.atlasCells);
    case 'zonesPainted': return distinct((x) => x.zonesPainted);
    case 'districts': return distinct((x) => x.districts);
    case 'huntChests': return sum((x) => x.huntChests);
    case 'ghostWins': return count((x) => x.beatGhost === true && x.meters >= minMeters);
    case 'conquered': return sum((x) => x.conquered);
    case 'defended': return sum((x) => x.defended);
    case 'groupActivities': return count((x) => x.group);
    case 'activities': return acts.length;
    case 'raidMeters': return sum((x) => x.raidMeters);
    case 'paintedActivities': return count((x) => x.meters >= minMeters && x.zonesPainted.length > 0);
    case 'crewMember': return ev.inCrew ? 1 : 0;
    case 'leaguePoints': return (ev.leaguePoints ?? 0) > 0 ? 1 : 0;
    case 'rankingOpened': return (ev.rankingOpenedAt ?? []).some((t) => inWindow(t, a)) ? 1 : 0;
    case 'shares': return (ev.sharedAt ?? []).filter((t) => inWindow(t, a)).length;
  }
}

/**
 * Progresso (0..alvo) recalculado do zero a partir das evidências: só atividades pontuadas dentro da janela,
 * cada id contado uma vez. Recalcular é idempotente e serve para a aprovação tardia de uma atividade.
 */
export function missionProgress(a: MissionAssignment, ev: MissionEvidence): number {
  const def = missionById(a.missionId);
  if (!def) return 0;
  const seen = new Set<string>();
  const acts = ev.activities.filter((x) => {
    if (seen.has(x.id) || !SCORED.has(x.status) || !inWindow(x.endedAt, a)) return false;
    seen.add(x.id);
    return true;
  });
  const fb = a.variant === 'fallback' && def.fallback;
  const metric = fb ? fb.metric : def.metric;
  return Math.min(a.target, metricValue(metric, def.minMeters ?? 0, acts, ev, a));
}

/**
 * Atualiza a atribuição. Conclui no máximo 1 vez: depois de `completedAt`, nada muda e `xp` é 0.
 * O progresso nunca volta para trás (atividade reprovada depois não apaga o que a pessoa viu).
 */
export function settleMission(
  a: MissionAssignment,
  ev: MissionEvidence,
  now: number,
): { assignment: MissionAssignment; completedNow: boolean; xp: number } {
  if (a.completedAt !== null) return { assignment: a, completedNow: false, xp: 0 };
  const progress = Math.max(a.progress, missionProgress(a, ev));
  if (progress < a.target) return { assignment: { ...a, progress }, completedNow: false, xp: 0 };
  return { assignment: { ...a, progress, completedAt: now }, completedNow: true, xp: missionById(a.missionId)?.xp ?? 0 };
}

/* ---------- Primeira semana (7 passos, um por dia, sem prazo) ---------- */

export const FTUE_STEP_IDS = ['f1-dominio', 'f2-caca', 'f3-fuga', 'f4-raid', 'f5-crew', 'f6-liga', 'f7-compartilhar'] as const;

/** Barra começa em 20% ("conta criada + time escolhido": progresso dotado). */
export const FTUE_ENDOWED_PROGRESS = 0.2;

export type FtueStepStatus = 'done' | 'open' | 'locked';

export type FtueStep = { id: string; step: number; status: FtueStepStatus; unlocksAt: number | null; completedAt: number | null };

/**
 * Estado dos 7 passos. O passo 1 abre na criação; o passo k+1 abre às 00:00 (Brasília) do dia seguinte
 * à conclusão do passo k. Nada expira.
 */
export function ftueSteps(input: { startedAt: number; completedAt: Readonly<Record<string, number | null | undefined>>; now: number }): FtueStep[] {
  const steps: FtueStep[] = [];
  let unlocksAt: number | null = input.startedAt;
  FTUE_STEP_IDS.forEach((id, i) => {
    const doneAt = unlocksAt !== null ? input.completedAt[id] ?? null : null;
    const status: FtueStepStatus = doneAt !== null ? 'done' : unlocksAt !== null && unlocksAt <= input.now ? 'open' : 'locked';
    steps.push({ id, step: i + 1, status, unlocksAt, completedAt: doneAt });
    unlocksAt = doneAt !== null ? brtCalendar.at(brtCalendar.addDays(brtCalendar.clock(doneAt).dayId, 1)) : null;
  });
  return steps;
}

/** Fração da barra "Primeiros passos" (0,2 a 1). */
export function ftueBarProgress(steps: readonly FtueStep[]): number {
  const done = steps.filter((s) => s.status === 'done').length;
  return FTUE_ENDOWED_PROGRESS + ((1 - FTUE_ENDOWED_PROGRESS) * done) / FTUE_STEP_IDS.length;
}

/** Atribuição de um passo liberado; Raid e Liga usam a versão alternativa enquanto não existem de verdade. */
export function ftueAssignment(stepId: string, unlocksAt: number, ctx: Pick<MissionContext, 'raidActive' | 'leagueActive'>): MissionAssignment | null {
  const def = missionById(stepId);
  if (!def || def.cadence !== 'ftue') return null;
  const fallback =
    (def.fallback?.when === 'noRaid' && !ctx.raidActive) || (def.fallback?.when === 'noLeague' && !ctx.leagueActive);
  return {
    missionId: def.id,
    cadence: 'ftue',
    period: 'ftue',
    slot: FTUE_STEP_IDS.indexOf(def.id as (typeof FTUE_STEP_IDS)[number]) + 1,
    target: fallback && def.fallback ? def.fallback.target : (def.target as number),
    variant: fallback ? 'fallback' : 'base',
    availableFrom: unlocksAt,
    availableUntil: null,
    progress: 0,
    completedAt: null,
    rerolled: false,
  };
}

/* ---------- Volta depois de sumir ---------- */

/** Missão de volta para quem está há `daysAway` dias sem atividade (prêmio fixo, nunca sorteado). */
export function comebackMissionId(daysAway: number): 'v-7' | 'v-14' | 'v-30' | null {
  if (daysAway >= 30) return 'v-30';
  if (daysAway >= 14) return 'v-14';
  if (daysAway >= 7) return 'v-7';
  return null;
}

export function comebackAssignment(lastActivityDay: string, now: number): MissionAssignment | null {
  const today = brtCalendar.clock(now).dayId;
  const id = comebackMissionId(brtCalendar.daysBetween(lastActivityDay, today));
  const def = id ? missionById(id) : undefined;
  if (!def) return null;
  return {
    missionId: def.id,
    cadence: 'volta',
    period: `volta-${today}`,
    slot: 0,
    target: def.target as number,
    variant: 'base',
    availableFrom: now,
    availableUntil: null,
    progress: 0,
    completedAt: null,
    rerolled: false,
  };
}
