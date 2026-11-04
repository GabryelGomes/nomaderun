/**
 * Projeção do "Antes e depois do bairro" (F8 · C1): a rota e o centro das zonas na mesma caixa, com a projeção
 * plana local do mini-mapa (equirretangular com o cosseno da latitude). Sem mapa-base e sem grade: cada zona vira
 * uma mancha redonda e suave (o mapa nunca mostra hexágonos). Puro.
 */
import { thinRoute } from '@/components/route-path';
import type { FactionId, LatLng } from '@/domain/types';

export type NeighborhoodZone = { id: string; center: LatLng; before: FactionId | null; after: FactionId | null };
export type ProjectedZone = NeighborhoodZone & { x: number; y: number };
export type NeighborhoodScene = { route: string; zones: ProjectedZone[]; radius: number };

/** Raio de uma zona (H3 res. 9, ~175 m de lado) e os limites da mancha em pt. */
export const ZONE_RADIUS_M = 175;
export const BLOB_RADIUS = { min: 12, max: 34 } as const;
const M_PER_DEG = 111_320;
const H3_ID = /^[0-9a-f]{15}$/i;

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Zonas do resultado oficial para a cena, com o centro de cada uma (`centerOf`, ex.: `cellCenter`). Zona com id que
 * não vira centro é ignorada. `null` quando nenhuma mudou de dono (a cena não aparece: nada de "antes e depois" igual).
 */
export function neighborhoodZonesFrom(
  zones: readonly { zoneId: string; ownerBefore: FactionId | null; ownerAfter: FactionId | null }[],
  centerOf: (id: string) => LatLng,
): NeighborhoodZone[] | null {
  const out: NeighborhoodZone[] = [];
  for (const z of zones) {
    // célula H3 em texto: 15 dígitos hexadecimais (o h3-js não recusa todo texto inválido)
    if (!H3_ID.test(z.zoneId)) continue;
    try {
      const c = centerOf(z.zoneId);
      if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) out.push({ id: z.zoneId, center: c, before: z.ownerBefore, after: z.ownerAfter });
    } catch {
      // id que não é célula (dado antigo): fica fora da cena
    }
  }
  return out.some((z) => z.after !== null && z.after !== z.before) ? out : null;
}

/** Rota (`d` do SVG) e zonas projetadas numa caixa `width × height` com `pad` de folga. Vazio se não houver pontos. */
export function projectNeighborhood(path: readonly LatLng[], zones: readonly NeighborhoodZone[], width: number, height: number, pad = 20): NeighborhoodScene {
  const route = thinRoute(path, 240);
  const all = [...route, ...zones.map((z) => z.center)].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (all.length === 0 || !(width > 0) || !(height > 0)) return { route: '', zones: [], radius: BLOB_RADIUS.min };
  const lat0 = (all.reduce((s, p) => s + p.lat, 0) / all.length) * (Math.PI / 180);
  const k = Math.cos(lat0);
  const X = (p: LatLng) => p.lng * k;
  const Y = (p: LatLng) => -p.lat;
  const xs = all.map(X);
  const ys = all.map(Y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  // uma zona sozinha (ou rota parada) ganha uma caixa mínima de ~2 zonas para não virar escala infinita
  const minSpan = (ZONE_RADIUS_M * 4) / M_PER_DEG;
  const sx = Math.max(spanX, minSpan);
  const sy = Math.max(spanY, minSpan);
  const scale = Math.min((width - pad * 2) / sx, (height - pad * 2) / sy);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const px = (p: LatLng) => ({ x: r1(offX + (X(p) - minX) * scale), y: r1(offY + (Y(p) - minY) * scale) });
  const d = route.length >= 2 ? route.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p).x} ${px(p).y}`).join(' ') : '';
  const radius = Math.min(BLOB_RADIUS.max, Math.max(BLOB_RADIUS.min, r1((ZONE_RADIUS_M / M_PER_DEG) * scale)));
  return { route: d, zones: zones.map((z) => ({ ...z, ...px(z.center) })), radius };
}
