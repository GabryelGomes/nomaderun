/**
 * Baús da missão Caça (RF-023): do servidor (`daily_chests`, sorteio diário da RN-017) quando há internet;
 * sem internet ou sem baús no servidor, cai nos baús locais de demonstração (`seedChests`) para a missão
 * continuar jogável. Só os do servidor contam XP oficial (o `finish-activity` abre e soma).
 */
import type { Chest } from '@/domain/games';
import type { LatLng } from '@/domain/types';
import { seedChests } from '@/demo/demo-data';
import { fetchDailyChests, type DailyChests } from '@/services/api/chests-repo';
import type { Result } from '@/services/api/errors';

export type HuntChests = { chests: Chest[]; openedIds: string[]; source: 'server' | 'local' };

export async function loadHuntChests(
  near: LatLng,
  fetcher: (p: LatLng) => Promise<Result<DailyChests>> = fetchDailyChests,
): Promise<HuntChests> {
  try {
    const r = await fetcher(near);
    if (r.ok && r.data.chests.length > 0) return { chests: r.data.chests, openedIds: r.data.openedIds, source: 'server' };
  } catch {
    // segue para os baús locais
  }
  return { chests: seedChests(near), openedIds: [], source: 'local' };
}
