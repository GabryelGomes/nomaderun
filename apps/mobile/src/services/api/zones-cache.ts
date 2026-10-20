import Storage from 'expo-sqlite/kv-store';

import type { Zone } from '@/domain/territory';

import type { ZoneMeta } from './zones-repo';

/**
 * Última cópia das zonas vistas no mapa, para abrir sem internet (RF-007, estado offline).
 * Dados públicos (todo usuário logado lê `zones`); nada pessoal.
 */
const KEY = 'nomade.zones.v1';

export type ZonesSnapshot = { savedAt: number; zones: Record<string, Zone>; meta: Record<string, ZoneMeta> };

export async function readCachedZones(): Promise<ZonesSnapshot | null> {
  try {
    const raw = await Storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ZonesSnapshot) : null;
  } catch {
    return null;
  }
}

export async function writeCachedZones(snapshot: ZonesSnapshot | null): Promise<void> {
  try {
    if (snapshot) await Storage.setItem(KEY, JSON.stringify(snapshot));
    else await Storage.removeItem(KEY);
  } catch {
    // Cache é só conveniência.
  }
}
