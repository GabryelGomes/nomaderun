/**
 * Mapa de calor (RF-013): `rpc('zone_heat_json')` devolve, por zona da área visível, quantas corridas passaram
 * (`runs`, só com 2 ou mais corredores) e quantas vezes ela trocou de dono (`flips`) no período. Sem a function
 * (servidor antigo), a camada avisa que ainda não está disponível em vez de falhar.
 */
import type { Result } from './errors';
import { callFeatureRpc, type Unavailable } from './raid-repo';
import { requireSupabase } from './supabase';

/** Área visível em graus (a mesma forma do `MapBounds` do mapa). */
export type HeatBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type HeatPeriod = '24h' | '7d' | 'season';
export type ZoneHeat = { id: string; runs: number; flips: number };

/** Descarta linhas inválidas (id de zona H3 e contagens inteiras não negativas). */
export function parseZoneHeat(data: unknown): ZoneHeat[] {
  if (!Array.isArray(data)) return [];
  const out: ZoneHeat[] = [];
  for (const r of data as Record<string, unknown>[]) {
    const runs = Number(r?.runs);
    const flips = Number(r?.flips);
    if (typeof r?.id !== 'string' || !/^[0-9a-f]{15}$/.test(r.id)) continue;
    if (!Number.isInteger(runs) || !Number.isInteger(flips) || runs < 0 || flips < 0) continue;
    out.push({ id: r.id, runs, flips });
  }
  return out;
}

export async function fetchZoneHeat(bounds: HeatBounds, period: HeatPeriod): Promise<Result<ZoneHeat[] | Unavailable>> {
  return callFeatureRpc(
    () =>
      requireSupabase().rpc('zone_heat_json', {
        min_lng: bounds.minLng,
        min_lat: bounds.minLat,
        max_lng: bounds.maxLng,
        max_lat: bounds.maxLat,
        p_period: period,
      }),
    parseZoneHeat,
  );
}
