import type { Zone } from '@/domain/territory';

import type { ZoneMeta } from './zones-repo';
import { isDemoMode } from './env';

/**
 * Web: mesma ideia do nativo, sobre `localStorage` (ausente na renderização estática).
 * Chave separada no modo demonstração (D-77): os dados de demonstração nunca aparecem na conta real.
 */
export const cacheKey = (demo = isDemoMode()) => (demo ? 'nomade.demo.zones.v1' : 'nomade.zones.v1');
const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

export type ZonesSnapshot = { savedAt: number; zones: Record<string, Zone>; meta: Record<string, ZoneMeta> };

export async function readCachedZones(): Promise<ZonesSnapshot | null> {
  try {
    const raw = ls()?.getItem(cacheKey());
    return raw ? (JSON.parse(raw) as ZonesSnapshot) : null;
  } catch {
    return null;
  }
}

export async function writeCachedZones(snapshot: ZonesSnapshot | null): Promise<void> {
  try {
    if (snapshot) ls()?.setItem(cacheKey(), JSON.stringify(snapshot));
    else ls()?.removeItem(cacheKey());
  } catch {
    // Cache é só conveniência.
  }
}
