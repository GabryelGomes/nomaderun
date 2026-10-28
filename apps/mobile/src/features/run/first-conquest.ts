/**
 * "Sua 1ª zona!" (T7.3.2, E6b): o `firstConquestEver` da E7 (T7.3.6), lido na largada (fora da renderização).
 *
 * O tracker ao vivo só trata a 1ª conquista como épica quando a E7 sabe, de verdade, que a pessoa nunca
 * conquistou uma zona. Sem o dado (servidor v1 ou engajamento ainda não carregado), a E7 responde `false` e o
 * aviso é o normal ("Zona conquistada"), nunca um "1ª zona" inventado (D-76).
 */
import { getFirstConquestEver } from '@/features/engagement';

export function firstConquestEverNow(): boolean {
  return getFirstConquestEver() === true;
}
