/**
 * D-96 — corredores ativos por time nos últimos 7 dias: `rpc('faction_activity')` (migration 20261031120000).
 * Só contagens (nenhum id, nome ou lugar). O selo "Precisa de reforço" sai de `factionNeedingBoost`
 * (`src/domain/faction-activity.ts`), nunca de um número inventado: servidor antigo (`PGRST202`) vira
 * `{ available: false }` e a tela não mostra selo. Na demonstração, `isDemo = true` (a tela marca "demonstração").
 *
 * B1 (migration 20261104120300): sem sessão o servidor devolve só `{ needsBoost, isDemo }` (de um cache de 5 min),
 * sem contagens: aí `counts` e `total` vêm `null` e o selo é o `needsBoost` do servidor (validado). Com contagens
 * (sessão, ou servidor antigo sem sessão), o selo continua saindo das contagens pela regra do domain.
 */
import { asBoostFaction, factionNeedingBoost } from '@/domain/faction-activity';
import { FACTION_IDS, type FactionId } from '@/domain/types';

import { callFeatureRpc, type Unavailable } from './raid-repo';
import type { Result } from './errors';
import { requireSupabase } from './supabase';

export type FactionActivity = {
  available: true;
  windowDays: number;
  /** Início da janela (epoch ms). */
  since: number;
  /** `null` sem sessão (B1: o servidor não manda as contagens a quem não tem conta). */
  counts: Record<FactionId, number> | null;
  total: number | null;
  /** O time com menos ativos (selo cosmético) ou `null` (empate, pouca gente). */
  needsBoost: FactionId | null;
  isDemo: boolean;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const count = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export function parseFactionActivity(data: unknown): FactionActivity {
  const b = obj(data);
  const hasCounts = !!b.counts && typeof b.counts === 'object' && !Array.isArray(b.counts);
  const raw = obj(b.counts);
  const counts = hasCounts
    ? (Object.fromEntries(FACTION_IDS.map((f) => [f, count(raw[f])])) as Record<FactionId, number>)
    : null;
  return {
    available: true,
    windowDays: count(b.windowDays) || 7,
    since: count(b.since),
    counts,
    total: counts ? FACTION_IDS.reduce((s, f) => s + counts[f], 0) : null,
    needsBoost: counts ? factionNeedingBoost(counts) : asBoostFaction(b.needsBoost),
    isDemo: b.isDemo === true,
  };
}

export async function getFactionActivity(): Promise<Result<FactionActivity | Unavailable>> {
  return callFeatureRpc(() => requireSupabase().rpc('faction_activity'), parseFactionActivity);
}
