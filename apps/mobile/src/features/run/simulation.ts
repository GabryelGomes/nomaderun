/**
 * Corrida simulada (modo "Simulação"): volta no lago do Parque Flamboyant (`demoRoute`) com um
 * desvio até uma zona neutra próxima, para a demonstração mostrar a conquista (RN-002: ~300 m
 * dentro da zona). Pontos a cada 3,2 m (1 por segundo a ~11,5 km/h), ida e volta, sem saltos.
 */
import { distanceMeters, offset } from '@/domain/geo';
import { cellCenter } from '@/domain/grid';
import type { Zone } from '@/domain/territory';
import type { LatLng } from '@/domain/types';
import { demoRoute } from '@/demo/demo-data';

export const SIM_SPEED_MPS = 3.2;
/** Zona neutra do seed mais perto do parque (Estádio Serra Dourada), usada sem dados do servidor. */
export const DEFAULT_SIM_DETOUR: LatLng = { lat: -16.70726, lng: -49.23555 };
const DETOUR_MAX_M = 2500;
const DETOUR_LAPS_RADIUS_M = 55;
const DETOUR_INSIDE_M = 420;

/** Linha reta de `a` até `b` com passos de no máximo `stepM` (sem o ponto `a`, termina em `b`). */
function straight(a: LatLng, b: LatLng, stepM: number): LatLng[] {
  const n = Math.max(1, Math.ceil(distanceMeters(a, b) / stepM));
  return Array.from({ length: n }, (_, i) => ({ lat: a.lat + ((b.lat - a.lat) * (i + 1)) / n, lng: a.lng + ((b.lng - a.lng) * (i + 1)) / n }));
}

/** Reamostra uma polilinha em um ponto a cada `stepM` metros. */
export function resample(route: LatLng[], stepM: number): LatLng[] {
  const out: LatLng[] = [route[0]];
  let carry = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const seg = distanceMeters(a, b);
    if (seg === 0) continue;
    const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
    let d = stepM - carry;
    while (d <= seg) {
      out.push(offset(a, d, bearing));
      d += stepM;
    }
    carry = seg - (d - stepM);
  }
  return out;
}

/** Voltas pequenas dentro da zona (raio 55 m) até somar ~420 m. */
function laps(center: LatLng, stepM: number): LatLng[] {
  const perimeter = 2 * Math.PI * DETOUR_LAPS_RADIUS_M;
  const n = Math.ceil(DETOUR_INSIDE_M / stepM);
  const out: LatLng[] = [];
  for (let i = 0; i <= n; i++) out.push(offset(center, DETOUR_LAPS_RADIUS_M, ((i * stepM) / perimeter) * 360));
  return out;
}

/** Centro da zona neutra (não bloqueada) mais perto do parque, se houver uma a até 2,5 km. */
export function nearestNeutral(zones: Record<string, Zone>, from: LatLng = DEFAULT_SIM_DETOUR): LatLng | null {
  let best: { p: LatLng; d: number } | null = null;
  for (const z of Object.values(zones)) {
    if (z.owner !== null || z.blocked) continue;
    const p = cellCenter(z.id);
    const d = distanceMeters(from, p);
    if (d <= DETOUR_MAX_M && (!best || d < best.d)) best = { p, d };
  }
  return best?.p ?? null;
}

export function simulationRoute(detour: LatLng | null = DEFAULT_SIM_DETOUR, stepM = SIM_SPEED_MPS): LatLng[] {
  const loop = resample(demoRoute(), stepM);
  let outbound = loop;
  if (detour) {
    let k = 0;
    loop.forEach((p, i) => {
      if (distanceMeters(p, detour) < distanceMeters(loop[k], detour)) k = i;
    });
    const edge = offset(detour, DETOUR_LAPS_RADIUS_M, 0);
    const go = straight(loop[k], edge, stepM);
    const inside = laps(detour, stepM);
    const back = straight(inside[inside.length - 1], loop[k], stepM);
    outbound = [...loop.slice(0, k + 1), ...go, ...inside, ...back, ...loop.slice(k + 1)];
  }
  // Ida e volta: o corredor simulado nunca "teletransporta" ao recomeçar a rota.
  return [...outbound, ...outbound.slice(0, -1).reverse()];
}
