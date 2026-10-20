import type { Zone } from '@/domain/territory';

import type { ZoneMeta } from './zones-repo';

/** Web: mesma ideia do nativo, sobre `localStorage` (ausente na renderização estática). */
const KEY = 'nomade.zones.v1';
const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

export type ZonesSnapshot = { savedAt: number; zones: Record<string, Zone>; meta: Record<string, ZoneMeta> };

export async function readCachedZones(): Promise<ZonesSnapshot | null> {
  try {
    const raw = ls()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as ZonesSnapshot) : null;
  } catch {
    return null;
  }
}

export async function writeCachedZones(snapshot: ZonesSnapshot | null): Promise<void> {
  try {
    if (snapshot) ls()?.setItem(KEY, JSON.stringify(snapshot));
    else ls()?.removeItem(KEY);
  } catch {
    // Cache é só conveniência.
  }
}
