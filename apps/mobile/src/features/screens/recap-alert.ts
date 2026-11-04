/**
 * F8-B3 (§4.3 de `F8/03`): o recap da semana deixa de ficar escondido em Atividades. De sexta a domingo
 * (Brasília), com pelo menos 1 km na semana, o Mapa pode mostrar "Sua semana: 12,2 km · Compartilhar".
 *
 * Só o card (puro). Quem decide se ele ganha a vaga única de alerta do Mapa é a B2 (prioridade: ataque > missão >
 * baú > chefão > sequência > recap), passando `onPress: () => router.push(recapHref())` ao `AlertSlot`.
 */
import type { SlotAlert } from '@/components/alert-slot';
import { formatKm } from '@/domain/geo';

const BRT_OFFSET = 3 * 3_600_000;
/** Sexta, sábado e domingo (0 = domingo no `getUTCDay`). */
const RECAP_DAYS = new Set([5, 6, 0]);
/** Menos que isso não vira card (0,3 km na semana seria um card vazio de propósito). */
export const RECAP_MIN_METERS = 1000;

export type RecapAlert = Omit<SlotAlert, 'onPress' | 'onDismiss' | 'art'>;

/** O alerta do recap, ou `null` fora de sexta–domingo ou com menos de 1 km na semana. */
export function recapAlert(now: number, weekMeters: number): RecapAlert | null {
  if (!Number.isFinite(weekMeters) || weekMeters < RECAP_MIN_METERS) return null;
  const weekday = new Date(now - BRT_OFFSET).getUTCDay();
  if (!RECAP_DAYS.has(weekday)) return null;
  return { id: 'recap-semana', kind: 'recap', title: `Sua semana: ${formatKm(weekMeters, 1)} km`, body: 'Compartilhar o card da semana' };
}
