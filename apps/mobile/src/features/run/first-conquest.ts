/**
 * "Sua 1ª zona!" (T7.3.2, E6b): ponto de encaixe do `firstConquestEver` da E7 (T7.3.6, onda 3).
 *
 * O tracker ao vivo só trata a 1ª conquista como épica quando sabe, de verdade, que a pessoa nunca conquistou
 * uma zona. Enquanto o dado da E7 não chega nesta base, a resposta é `false`: sem o dado, o aviso é o normal
 * ("Zona conquistada"), nunca um "1ª zona" inventado (D-76).
 *
 * Para ligar: trocar o corpo por `return firstConquestEver(…) === true` com o seletor/hook da E7, lido na
 * largada (fora da renderização). Nada mais muda: o `createPaintedLiveTracker` já repassa ao domain e o aviso
 * vira "Sua 1ª zona!" pelo nível épico do evento.
 */
export function firstConquestEverNow(): boolean {
  return false;
}
