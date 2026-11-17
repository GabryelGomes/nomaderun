/**
 * Unidade de distância escolhida no perfil (Editar perfil → km ou milhas). Antes a escolha era salva, mas as telas
 * mostravam sempre km (DF04 dos testes externos). As contas continuam em metros e s/km; só a exibição muda.
 */
import { formatKm, formatPace } from '@/domain/geo';
import type { DistanceUnit } from '@/services/api/types';

export const METERS_PER_MILE = 1609.344;

/** Distância na unidade (vírgula decimal), sem o rótulo: 5620 m → "5,62" (km) ou "3,49" (mi). */
export function formatDistance(meters: number, unit: DistanceUnit, decimals = 2): string {
  return unit === 'mi' ? formatKm((meters / METERS_PER_MILE) * 1000, decimals) : formatKm(meters, decimals);
}

/** Ritmo m:ss por km ou por milha. */
export function formatPaceIn(secPerKm: number, unit: DistanceUnit): string {
  return formatPace(unit === 'mi' ? (secPerKm * METERS_PER_MILE) / 1000 : secPerKm);
}

/** "km" ou "mi". */
export const distanceLabel = (unit: DistanceUnit) => (unit === 'mi' ? 'mi' : 'km');

/** "/km" ou "/mi". */
export const paceLabel = (unit: DistanceUnit) => (unit === 'mi' ? '/mi' : '/km');

/** Por extenso, para leitores de tela: "quilômetros" ou "milhas". */
export const distanceSpoken = (unit: DistanceUnit) => (unit === 'mi' ? 'milhas' : 'quilômetros');

/** Comprimento da parcial (1 km ou 1 milha) em metros. */
export const splitMeters = (unit: DistanceUnit) => (unit === 'mi' ? METERS_PER_MILE : 1000);
