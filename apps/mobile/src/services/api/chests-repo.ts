/**
 * Baús da missão Caça (RF-023, RN-017) — sorteados e abertos pelo servidor.
 * `rpc('daily_chests')` devolve os 5 a 8 baús do dia (sorteia na primeira chamada do dia, num raio de 3 km da
 * última corrida; sem corrida, da posição enviada). A abertura vale quando o `finish-activity` confere que um
 * ponto válido passou a até 25 m; o app só mostra a prévia ao passar perto (XP oficial vem do servidor).
 * Exceção combinada com a coordenação (A2) dentro de `services/api`.
 */
import type { Chest, ChestRarity } from '@/domain/games';
import type { LatLng } from '@/domain/types';

import { attempt, type Result } from './errors';
import { requireSupabase } from './supabase';

export type DailyChests = { day: string; chests: Chest[]; openedIds: string[] };

const RARITIES: readonly ChestRarity[] = ['comum', 'raro', 'lendario'];

/** Converte a resposta de `daily_chests` para o tipo do domain, descartando linhas inválidas. */
export function parseDailyChests(data: unknown): DailyChests {
  const body = (data ?? {}) as { day?: unknown; chests?: unknown };
  const rows = Array.isArray(body.chests) ? (body.chests as Record<string, unknown>[]) : [];
  const chests: Chest[] = [];
  const openedIds: string[] = [];
  for (const r of rows) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    const rarity = r.rarity as ChestRarity;
    if (typeof r.id !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lng) || !RARITIES.includes(rarity)) continue;
    chests.push({ id: r.id, position: { lat, lng }, rarity });
    if (r.openedAt !== null && r.openedAt !== undefined) openedIds.push(r.id);
  }
  return { day: typeof body.day === 'string' ? body.day : '', chests, openedIds };
}

/** Baús do dia do usuário logado; `near` é usado só se ele ainda não tiver corrida. */
export async function fetchDailyChests(near?: LatLng): Promise<Result<DailyChests>> {
  return attempt(async () => {
    const args = near ? { p_lat: near.lat, p_lng: near.lng } : {};
    const { data, error } = await requireSupabase().rpc('daily_chests', args);
    if (error) throw error;
    return parseDailyChests(data);
  });
}
