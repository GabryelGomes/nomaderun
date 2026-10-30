/**
 * Resumo (T7.3.2, E6b) — contas puras para os encaixes do resumo: o nível novo (E7) e o chefão derrotado
 * (E3/E9) que o card de compartilhar (E8) mostra. Só com dado verdadeiro: sem ele, `null` (o card sai sem).
 */
import type { CardBoss, CardLevel } from '@/features/social/card';
import { levelProgress } from '@/domain/progression';
import { RAID_DAMAGE_PER_KM } from '@/domain/raid';
import type { ActivitySummary } from '@/services/api/activities-repo';
import type { RunEngagement } from '@/services/api/engagement-repo';
import type { RaidCurrent } from '@/services/api/raid-repo';

const DAY_MS = 86_400_000;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export type RunTotals = CardLevel['totals'];
type RunRow = { id: string; status: string; meters: number; result?: { zones?: { outcome: string }[] } | null };

/** Totais da carreira para o card de nível: corridas válidas do histórico, com esta corrida contada uma vez. */
export function careerTotals(rows: readonly RunRow[], current: { id: string; meters: number; conquered: number } | null): RunTotals {
  const valid = rows.filter((r) => r.status === 'valid' || r.status === 'partial');
  let meters = valid.reduce((n, r) => n + r.meters, 0);
  let zones = valid.reduce((n, r) => n + (r.result?.zones?.filter((z) => z.outcome === 'conquered').length ?? 0), 0);
  let runs = valid.length;
  if (current && !rows.some((r) => r.id === current.id)) {
    meters += current.meters;
    zones += current.conquered;
    runs += 1;
  }
  return { meters, zones, runs: Math.max(1, runs) };
}

/** Nível novo nesta corrida (bloco da E7): só quando subiu de verdade. */
export function shareLevelFrom(block: RunEngagement | null, xpTotal: number, totals: RunTotals): CardLevel | null {
  if (!block || block.level.after <= block.level.before) return null;
  const p = levelProgress(xpTotal);
  // O XP do aparelho pode ainda não ter o desta corrida: o nível do card é o do servidor.
  const sameLevel = p.level === block.level.after;
  return {
    reached: block.level.after,
    xpToNext: sameLevel ? Math.max(0, p.needed - p.intoLevel) : 0,
    progressToNext: sameLevel && p.needed > 0 ? p.intoLevel / p.needed : 0,
    totals,
  };
}

/**
 * Resposta oficial remontada de uma corrida antiga (`activities.result` + `activities.v2_extras`), no formato
 * que o `useRunRewards` (E7) e o card (E8) leem. Sem `v2_extras` (servidor v1): `null`.
 */
export function officialFromActivity(a: Pick<ActivitySummary, 'id' | 'result' | 'extras'> | null | undefined): Record<string, unknown> | null {
  if (!a?.extras) return null;
  return { ...(a.result ?? {}), activityId: a.id, extras: a.extras };
}

export type SummaryXp = { gained: number; level: number; intoLevel: number; needed: number };

/**
 * Um número só de XP no resumo (pendência da onda 3): o total do bloco da E7 (o que o servidor credita no
 * `xp_ledger`: corrida, semana, baús e missões), não o `xp` da resposta v1 (só a corrida). Nível do servidor.
 */
export function summaryXpFrom(block: RunEngagement | null, xpTotal: number): SummaryXp | null {
  if (!block) return null;
  const p = levelProgress(xpTotal);
  const same = p.level === block.level.after;
  return { gained: block.xp.total, level: block.level.after, intoLevel: same ? p.intoLevel : 0, needed: same ? p.needed : 0 };
}

export type RaidExtra = { raidId: string; defeated: boolean; countedKm: number; hpMax: number };

/** `extras.raid` da resposta oficial (contrato v2), ou `null` sem chefão. */
export function raidExtraOf(official: unknown): RaidExtra | null {
  const r = obj(obj(obj(official).extras).raid);
  if (typeof r.raidId !== 'string') return null;
  return { raidId: r.raidId, defeated: r.defeated === true, countedKm: Math.max(0, num(r.countedKm)), hpMax: Math.max(0, num(r.hpMax)) };
}

/**
 * Chefão derrotado com a ajuda desta corrida: precisa do `extras.raid` (derrotado) e do Raid atual (nome,
 * cidade e dias). Qualquer peça faltando → `null`.
 */
export function shareBossFrom(extra: RaidExtra | null, current: RaidCurrent | null, cityFallback: string | null): CardBoss | null {
  const b = current?.raid;
  if (!extra?.defeated || !b || b.id !== extra.raidId || b.defeatedAt === null) return null;
  const cityName = b.city ?? cityFallback;
  if (!cityName) return null;
  const hpMax = extra.hpMax || b.hpMax;
  return {
    name: b.name,
    defeated: true,
    myDamageMeters: Math.round(extra.countedKm * 1000),
    cityName,
    cityMeters: Math.round((hpMax / RAID_DAMAGE_PER_KM) * 1000),
    days: Math.max(1, Math.ceil((b.defeatedAt - b.startsAt) / DAY_MS)),
  };
}
