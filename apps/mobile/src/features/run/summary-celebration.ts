/**
 * Conquistas do resumo para o `CelebrationSequence` (E5), uma a uma (T7.2.7). Puro e testado.
 * Só o que o **servidor confirmou** vira celebração: no resumo provisório, nada é comemorado (a lista de
 * zonas fica em "Ver detalhes" com o aviso de estimativa).
 */
import type { CelebrationEvent } from '@/components/celebration';
import type { FactionId } from '@/domain/types';

import type { RunSummary } from './summary-model';

export function summaryCelebrations(summary: RunSummary, official: boolean, faction: FactionId): CelebrationEvent[] {
  if (!official) return [];
  if (summary.status !== 'valid' && summary.status !== 'partial') return [];
  const out: CelebrationEvent[] = [];
  for (const z of summary.zones) {
    if (z.outcome === 'conquered') {
      out.push({ id: `zona-${z.zoneId}`, kind: 'zone-captured', level: 'medium', label: `conquistou ${z.name}`, payload: { zone: z.name, faction, points: z.rp } });
    } else if (z.outcome === 'defended') {
      out.push({ id: `defesa-${z.zoneId}`, kind: 'zone-defended', level: 'small', label: `defendeu ${z.name}`, payload: { zone: z.name, faction } });
    }
  }
  if (summary.xp > 0) out.push({ id: 'xp', kind: 'xp', level: 'small', label: `ganhou ${summary.xp} de experiência`, payload: { gained: summary.xp, from: 0, to: summary.xp } });
  return out;
}

/** Frase de abertura do anúncio único ao leitor de tela. */
export function summaryIntro(km: string, time: string): string {
  return `Corrida concluída: ${km} km em ${time}.`;
}
