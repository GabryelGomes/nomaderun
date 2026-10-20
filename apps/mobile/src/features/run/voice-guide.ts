/**
 * Guia por voz (RF-025): quilômetro com ritmo, território rival, fantasma a cada 100 m de diferença
 * e baú aberto. Puro: recebe `say` e decide quando falar (sem repetir o mesmo aviso).
 */
import { formatPace } from '@/domain/geo';
import type { FactionId } from '@/domain/types';

export const GHOST_ANNOUNCE_STEP_M = 100;

export type VoiceGuide = ReturnType<typeof createVoiceGuide>;

export function createVoiceGuide(say: (text: string) => void, factionName: (f: FactionId) => string) {
  let lastKm = 0;
  let lastZone: string | null = null;
  let ghostBand: number | null = null;
  return {
    distance(meters: number, paceSecPerKm: number) {
      const km = Math.floor(meters / 1000);
      if (km <= lastKm) return;
      lastKm = km;
      const pace = Number.isFinite(paceSecPerKm) ? ` Ritmo ${formatPace(paceSecPerKm).replace(':', ' e ')}.` : '';
      say(`${km} quilômetro${km > 1 ? 's' : ''}.${pace}`);
    },
    /** Avisa ao entrar numa zona de outra facção (uma vez por entrada). */
    zone(zoneId: string | null, owner: FactionId | null, mine: FactionId) {
      if (zoneId === lastZone) return;
      lastZone = zoneId;
      if (zoneId && owner && owner !== mine) say(`Território dos ${factionName(owner)}.`);
    },
    /** gap > 0: você está à frente do fantasma (metros). Fala a cada 100 m de diferença. */
    ghost(gap: number) {
      const band = Math.trunc(gap / GHOST_ANNOUNCE_STEP_M);
      if (ghostBand === null) {
        ghostBand = band;
        return;
      }
      if (band === ghostBand) return;
      const approaching = Math.abs(band) < Math.abs(ghostBand) || Math.sign(band) !== Math.sign(ghostBand);
      ghostBand = band;
      const m = Math.abs(band) * GHOST_ANNOUNCE_STEP_M;
      if (band === 0) say(approaching && gap > 0 ? 'O fantasma está chegando: menos de 100 metros.' : 'Lado a lado com o fantasma.');
      else if (gap > 0) say(approaching ? `O fantasma está se aproximando: ${m} metros atrás.` : `${m} metros à frente do fantasma.`);
      else say(`O fantasma está ${m} metros à frente.`);
    },
    chest(rarity: 'comum' | 'raro' | 'lendario') {
      say(rarity === 'lendario' ? 'Baú lendário aberto!' : `Baú ${rarity} aberto.`);
    },
  };
}
