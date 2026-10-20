/**
 * Tarefa de GPS em segundo plano (D-10, D-20). Precisa ser definida no escopo global, no início
 * do app (importada por `features/run/use-offline-sync`, que o layout raiz monta).
 * Grava cada fix direto na fila SQLite, para nenhum ponto se perder com a tela bloqueada.
 */
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { Platform } from 'react-native';

import { getQueueStore } from '@/services/offline/queue';
import type { NewPoint, QueueStore } from '@/services/offline/types';
import { stepCounter } from '@/services/sensors/step-counter';

import { BACKGROUND_LOCATION_TASK, toFix } from './tracker';

/** Corrida em gravação (definida pela tela de corrida; se o app reiniciou, procura na fila). */
let activeRunId: string | null = null;
export const setBackgroundRun = (id: string | null) => {
  activeRunId = id;
};

/** Reparte os passos de um lote entre os fixes, proporcional ao tempo (o último leva o resto). */
export function splitSteps(total: number | null, times: number[]): (number | null)[] {
  if (total === null) return times.map(() => null);
  if (times.length <= 1) return [total];
  const span = times[times.length - 1] - times[0];
  const out: number[] = [];
  let used = 0;
  for (let i = 0; i < times.length; i++) {
    if (i === times.length - 1) out.push(total - used);
    else {
      const dt = i === 0 ? 0 : times[i] - times[i - 1];
      const n = span > 0 ? Math.floor((total * dt) / span) : 0;
      out.push(n);
      used += n;
    }
  }
  return out;
}

export async function handleBackgroundLocations(locations: LocationObject[], store: QueueStore = getQueueStore(), takeSteps: () => number | null = () => stepCounter.take()): Promise<number[]> {
  if (!locations.length) return [];
  let runId = activeRunId;
  if (!runId) {
    const recording = (await store.listRuns()).find((r) => r.state === 'recording');
    runId = recording?.id ?? null;
  }
  if (!runId) return [];
  const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  const steps = splitSteps(takeSteps(), sorted.map((l) => l.timestamp));
  const points: NewPoint[] = sorted.map((loc, i) => ({ ...toFix(loc), steps: steps[i] }));
  return store.appendPoints(runId, points, { onlyIfRecording: true });
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: LocationObject[] }>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    try {
      await handleBackgroundLocations(data.locations);
    } catch {
      // Nunca derruba a tarefa: o próximo lote tenta de novo.
    }
  });
}
