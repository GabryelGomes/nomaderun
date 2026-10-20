/**
 * Verificação do sinal antes de iniciar (UC-01 passo 2 e exceção E3): se a precisão ficar pior
 * que 30 m por mais de 15 s, a tela avisa e permite "iniciar mesmo assim".
 */
import { MAX_ACCURACY_M } from '@/domain/anti-cheat';

export const WEAK_ACCURACY_M = MAX_ACCURACY_M;
export const WEAK_SIGNAL_MS = 15_000;

export type SignalState = 'searching' | 'good' | 'weak';

export function createSignalMonitor(startedAt: number, opts: { maxAccuracy?: number; weakAfterMs?: number } = {}) {
  const maxAccuracy = opts.maxAccuracy ?? WEAK_ACCURACY_M;
  const weakAfter = opts.weakAfterMs ?? WEAK_SIGNAL_MS;
  let state: SignalState = 'searching';
  let lastAccuracy: number | null = null;
  return {
    /** Um fix com a precisão informada pelo sistema (null = desconhecida). */
    feed(accuracy: number | null, t: number): SignalState {
      lastAccuracy = accuracy;
      if (accuracy !== null && accuracy <= maxAccuracy) state = 'good';
      else return this.tick(t);
      return state;
    },
    /** Chamado a cada segundo, mesmo sem fix. */
    tick(t: number): SignalState {
      if (state !== 'good' && t - startedAt > weakAfter) state = 'weak';
      return state;
    },
    get state() {
      return state;
    },
    get accuracy() {
      return lastAccuracy;
    },
  };
}
