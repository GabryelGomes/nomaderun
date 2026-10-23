/**
 * Retrato da pintura em volta (D-62): `rpc('zone_paint_near', { p_lat, p_lng, p_radius_m })` → o `LiveSnapshot`
 * que o `createLiveTracker` (src/domain/live-events.ts) usa para prever, ao vivo, "faltam X m" e a conquista.
 *
 * Contrato da E3 (`docs/melhoria/relatorios/E3-contrato-v2.md` §3.3), enquanto a E9 não publica a RPC no
 * `API_CONTRATO.md`: trechos com camadas EFETIVAS, sem autor, sem hora e sem nada dentro de zonas de privacidade;
 * zonas com dono, nome, herança, bloqueio e "sob ataque"; e os trechos que a própria pessoa já pintou hoje.
 * Aceita as chaves em camelCase ou snake_case.
 *
 * Servidor antigo (`PGRST202`) ou regra v1 com a RPC desligada (`FEATURE_DISABLED`) viram `{ available: false }`:
 * o HUD cai no modo atual, sem erro na tela. Equipe E3 (T7.2.3).
 */
import type { LiveSnapshot } from '@/domain/live-events';
import { PAINT_MAX_LAYERS } from '@/domain/paint';
import type { LatLng } from '@/domain/types';

import { AppError, fail, MESSAGES, type Result } from './errors';
import { callFeatureRpc, factionOrNull, type Unavailable } from './raid-repo';
import { requireSupabase } from './supabase';

/** Raio padrão do retrato (m): cobre a corrida de quem está parado no início; o app pede de novo ao se afastar. */
export const PAINT_NEAR_RADIUS_M = 1500;
export const PAINT_NEAR_MAX_RADIUS_M = 3000;

export type PaintNear = {
  available: true;
  snapshot: LiveSnapshot;
  /** Trechos que a pessoa já pintou hoje (1 camada por trecho por dia): vão em `paintedToday` do tracker. */
  paintedToday: string[];
  /** Centro e raio pedidos (para saber quando pedir de novo). */
  center: LatLng;
  radiusM: number;
};

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === 'object') : []);
const pick = (o: Obj, camel: string, snake: string) => (o[camel] !== undefined ? o[camel] : o[snake]);

/** Converte a resposta da RPC no retrato do domain. Trecho sem time válido ou sem camada viva é descartado. */
export function parsePaintNear(data: unknown, center: LatLng, radiusM: number): PaintNear {
  const body = data && typeof data === 'object' && !Array.isArray(data) ? (data as Obj) : {};
  const cells: Record<string, { faction: NonNullable<ReturnType<typeof factionOrNull>>; layers: number }> = {};
  for (const c of arr(body.cells)) {
    const faction = factionOrNull(c.faction);
    const layers = Math.min(PAINT_MAX_LAYERS, Math.floor(Number(c.layers)));
    if (typeof c.cell === 'string' && faction && layers >= 1) cells[c.cell] = { faction, layers };
  }
  const zones: LiveSnapshot['zones'] = {};
  for (const z of arr(body.zones)) {
    const id = pick(z, 'zoneId', 'zone_id');
    if (typeof id !== 'string') continue;
    const inherited = Math.max(0, Math.floor(Number(z.inherited) || 0));
    const name = z.name;
    (zones as Record<string, LiveSnapshot['zones'][string]>)[id] = {
      owner: factionOrNull(z.owner),
      name: typeof name === 'string' && name ? name : null,
      ...(inherited ? { inherited } : {}),
      ...(z.blocked === true ? { blocked: true } : {}),
      ...(pick(z, 'underAttack', 'under_attack') === true ? { underAttack: true } : {}),
    };
  }
  const today = pick(body, 'paintedToday', 'painted_today');
  return {
    available: true,
    snapshot: { cells, zones },
    paintedToday: Array.isArray(today) ? today.filter((c): c is string => typeof c === 'string') : [],
    center,
    radiusM,
  };
}

/** Retrato da pintura num raio em volta de `center` (padrão 1,5 km; máximo 3 km). */
export async function fetchPaintNear(center: LatLng, radiusM = PAINT_NEAR_RADIUS_M): Promise<Result<PaintNear | Unavailable>> {
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng) || Math.abs(center.lat) > 90 || Math.abs(center.lng) > 180) {
    return fail(new AppError('VALIDATION', MESSAGES.validation, { detail: 'VALIDATION' }));
  }
  const radius = Math.round(Math.min(PAINT_NEAR_MAX_RADIUS_M, Math.max(100, Number.isFinite(radiusM) ? radiusM : PAINT_NEAR_RADIUS_M)));
  return callFeatureRpc(
    () => requireSupabase().rpc('zone_paint_near', { p_lat: center.lat, p_lng: center.lng, p_radius_m: radius }),
    (data) => parsePaintNear(data, center, radius),
  );
}
