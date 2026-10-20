import type { FactionId } from '@/domain/types';

import { attempt, type Result } from './errors';
import { requireSupabase } from './supabase';
import { isFaction } from './types';

/** Rankings da temporada (RF-015) e placar entre cidades (RF-020, RN-013): views `leaderboard_*`. */
export type IndividualRow = { position: number; userId: string; username: string; faction: FactionId | null; city: string | null; crewTag: string | null; rp: number; meters: number; runs: number };
export type CrewRow = { position: number; crewId: string; name: string; tag: string; faction: FactionId | null; rp: number; members: number };
export type FactionRow = { position: number; faction: FactionId; rp: number; runners: number; zones: number };
export type CityRow = { position: number; city: string; rp: number; activeRunners: number; eligible: boolean; score: number | null };

export type IndividualFilter = { city?: string | null; faction?: FactionId | null; crewTag?: string | null; limit?: number };

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);

export const toIndividual = (r: Row): IndividualRow => ({
  position: n(r.position),
  userId: String(r.user_id ?? ''),
  username: String(r.username ?? ''),
  faction: isFaction(r.faction) ? r.faction : null,
  city: s(r.city),
  crewTag: s(r.crew_tag),
  rp: n(r.rp),
  meters: n(r.meters),
  runs: n(r.runs),
});

export const toCrewRow = (r: Row): CrewRow => ({
  position: n(r.position),
  crewId: String(r.crew_id ?? ''),
  name: String(r.name ?? ''),
  tag: String(r.tag ?? ''),
  faction: isFaction(r.faction) ? r.faction : null,
  rp: n(r.rp),
  members: n(r.members),
});

export const toCityRow = (r: Row): CityRow => ({
  position: n(r.position),
  city: String(r.city ?? ''),
  rp: n(r.rp),
  activeRunners: n(r.active_runners),
  eligible: r.eligible === true,
  score: r.score === null || r.score === undefined ? null : n(r.score),
});

export async function getIndividualRanking(filter: IndividualFilter = {}): Promise<Result<IndividualRow[]>> {
  return attempt(async () => {
    let q = requireSupabase().from('leaderboard_individual').select('*');
    if (filter.city) q = q.eq('city', filter.city);
    if (filter.faction) q = q.eq('faction', filter.faction);
    if (filter.crewTag) q = q.eq('crew_tag', filter.crewTag);
    const { data, error } = await q.order('rp', { ascending: false }).limit(filter.limit ?? 50);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(toIndividual);
  });
}

export async function getCrewRanking(limit = 50): Promise<Result<CrewRow[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('leaderboard_crews').select('*').order('position').limit(limit);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(toCrewRow);
  });
}

export async function getFactionRanking(): Promise<Result<FactionRow[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('leaderboard_factions').select('*').order('position');
    if (error) throw error;
    return ((data ?? []) as Row[])
      .filter((r) => isFaction(r.faction))
      .map((r) => ({ position: n(r.position), faction: r.faction as FactionId, rp: n(r.rp), runners: n(r.runners), zones: n(r.zones) }));
  });
}

export async function getCityRanking(limit = 30): Promise<Result<CityRow[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('leaderboard_cities').select('*').order('position').limit(limit);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(toCityRow);
  });
}
