/**
 * "Sua 1ª zona!" (T7.3.2, E6b): o `firstConquestEver` da E7 (T7.3.6), lido na largada (fora da renderização).
 *
 * O tracker ao vivo só trata a 1ª conquista como épica quando a E7 sabe, de verdade, que a pessoa nunca
 * conquistou uma zona. Sem o dado (servidor v1 ou engajamento ainda não carregado), a E7 responde `false` e o
 * aviso é o normal ("Zona conquistada"), nunca um "1ª zona" inventado (D-76).
 */
import type { FactionId } from '@/domain/types';
import { firstPaintLiveEligible, getFirstConquestEver } from '@/features/engagement';
import { useEngagement } from '@/store/engagement-store';
import { useGame } from '@/store/game-store';

import type { RunToast } from './live-hud';

export function firstConquestEverNow(): boolean {
  return getFirstConquestEver() === true;
}

/**
 * "Primeiro trecho!" ao vivo (E7, F8 · ideia 5.1), lido na largada: o servidor diz que a pessoa nunca teve
 * atividade (`lastActivityAt = null`) e não há corrida guardada no aparelho. Sem o dado, `false` (nada inventado);
 * o resumo confirma com o marco oficial do servidor (`extras.milestones.firstPaint`).
 */
export function firstPaintLiveNow(): boolean {
  const status = useEngagement.getState().status.data;
  return firstPaintLiveEligible({ statusKnown: status !== null, lastActivityAt: status?.lastActivityAt, localRuns: useGame.getState().localRuns.length, celebrated: false });
}

/** O aviso do HUD (médio, sem vibração própria: o ritmo de 10 s da E3 continua valendo). */
export function firstPaintToast(faction: FactionId): RunToast {
  return { id: 'primeiro-trecho', size: 'medium', haptics: false, edgeGlow: true, title: 'Primeiro trecho!', subtitle: 'Seu rastro já pinta a cidade', faction };
}
