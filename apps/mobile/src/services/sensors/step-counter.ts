/**
 * Passos entre fixes de GPS (RN-008). O pedômetro do expo-sensors entrega a contagem acumulada
 * desde a assinatura; `take()` devolve quantos passos houve desde a última chamada.
 * Aparelho sem pedômetro (ou sem permissão de movimento): `take()` devolve null e o ponto vai
 * sem `steps` — o servidor manda corridas > 10 km desse aparelho para revisão.
 */
import { Pedometer } from 'expo-sensors';

export type PedometerApi = Pick<typeof Pedometer, 'isAvailableAsync' | 'getPermissionsAsync' | 'requestPermissionsAsync' | 'watchStepCount'>;

export function createStepCounter(api: PedometerApi = Pedometer) {
  let sub: { remove: () => void } | null = null;
  let available = false;
  let total = 0;
  let taken = 0;

  return {
    /** Liga o pedômetro. `false` = aparelho sem sensor ou sem permissão. */
    async start(): Promise<boolean> {
      if (sub) return available;
      try {
        if (!(await api.isAvailableAsync())) return (available = false);
        let perm = await api.getPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await api.requestPermissionsAsync();
        if (!perm.granted) return (available = false);
        total = 0;
        taken = 0;
        sub = api.watchStepCount((r) => {
          total = Math.max(total, r.steps);
        });
        return (available = true);
      } catch {
        return (available = false);
      }
    },
    /** Passos desde a última chamada (inteiro ≥ 0), ou null sem pedômetro. */
    take(): number | null {
      if (!available) return null;
      const n = Math.max(0, Math.round(total - taken));
      taken = total;
      return n;
    },
    stop() {
      sub?.remove();
      sub = null;
      available = false;
    },
    get available() {
      return available;
    },
  };
}

export type StepCounter = ReturnType<typeof createStepCounter>;

/** Contador único (usado pela corrida em primeiro plano e pela tarefa de segundo plano). */
export const stepCounter = createStepCounter();

/**
 * Cadência sintética da simulação: passos inteiros por segundo simulado, carregando a fração
 * (168 passos/min → 2, 3, 3, 3, 3, 2, ...).
 */
export function createCadence(stepsPerMinute: number) {
  // Conta em "passos × 60" para não acumular erro de ponto flutuante.
  let acc = 0;
  const spm = Math.round(stepsPerMinute);
  return () => {
    acc += spm;
    const n = Math.floor(acc / 60);
    acc -= n * 60;
    return n;
  };
}
