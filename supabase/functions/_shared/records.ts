/**
 * Recordes pessoais e parciais (T7.2.2; F1 09-backend §4.6). Puro (sem I/O).
 *
 * Só os trechos válidos da validação oficial contam: o tempo e a distância de um trecho inválido (salto de GPS,
 * velocidade de carro, pausa longa) ficam de fora, como em `finishRun`. Os números saem em segundos inteiros.
 * - `splits`: tempo de cada quilômetro completo (até 100);
 * - melhores esforços de 1, 5, 10 e 21,0975 km: menor tempo entre dois pontos da corrida com a distância pedida
 *   (o fim do intervalo é interpolado dentro do trecho);
 * - `paceSeries`: até 200 valores de ritmo (s/km) em fatias de distância iguais, para o gráfico.
 *
 * Pedido para a E3/E8: mover para o domain (`src/domain/records.ts`) quando o app precisar da mesma conta.
 */
import { distanceMeters, type GeoPoint, type validateActivity } from './domain.ts';

export const RECORD_DISTANCES = { '1k': 1000, '5k': 5000, '10k': 10000, '21k': 21097.5 } as const;
export type RecordKind = keyof typeof RECORD_DISTANCES | 'longest';
export const MAX_SPLITS = 100;
export const MAX_PACE_SERIES = 200;

export type RunStats = {
  meters: number;
  movingSeconds: number;
  splits: number[];
  paceSeries: number[];
  best1k: number | null;
  best5k: number | null;
  best10k: number | null;
  best21k: number | null;
};

type Validation = ReturnType<typeof validateActivity>;

/** Distância e tempo acumulados só nos trechos válidos (cada trecho válido vira um segmento contínuo). */
function cumulative(points: readonly GeoPoint[], validation: Validation): { d: number[]; t: number[] } {
  const d: number[] = [0];
  const t: number[] = [0];
  for (const s of validation.steps) {
    if (!s.valid) continue;
    const a = points[s.from];
    const b = points[s.to];
    if (!a || !b) continue;
    const dm = distanceMeters(a, b);
    const ds = Math.max(0, (b.t - a.t) / 1000);
    if (!Number.isFinite(dm) || !Number.isFinite(ds) || dm <= 0) continue;
    d.push(d[d.length - 1] + dm);
    t.push(t[t.length - 1] + ds);
  }
  return { d, t };
}

/** Tempo acumulado quando a distância acumulada vale `x` (interpolado; `j` é o primeiro índice com d[j] ≥ x). */
function timeAt(d: number[], t: number[], x: number, j: number): number {
  if (j <= 0) return t[0];
  const span = d[j] - d[j - 1];
  const f = span > 0 ? (x - d[j - 1]) / span : 1;
  return t[j - 1] + f * (t[j] - t[j - 1]);
}

/** Menor tempo para cobrir `dist` metros (janela deslizante O(n)); null se a corrida for mais curta. */
export function bestEffort(d: number[], t: number[], dist: number): number | null {
  const total = d[d.length - 1];
  if (!(dist > 0) || total + 1e-9 < dist) return null;
  let best = Infinity;
  let j = 1;
  for (let i = 0; i < d.length - 1; i++) {
    const target = d[i] + dist;
    if (target > total + 1e-9) break;
    if (j <= i) j = i + 1;
    while (j < d.length - 1 && d[j] < target) j++;
    const elapsed = timeAt(d, t, target, j) - t[i];
    if (elapsed < best) best = elapsed;
  }
  // janelas que terminam num ponto (começo interpolado): com as de cima, cobrem todos os vértices da função
  // tempo(distância), que é linear por partes — o mínimo exato está num deles.
  let k = 1;
  for (let e = 1; e < d.length; e++) {
    const from = d[e] - dist;
    if (from < 0) continue;
    while (k < e && d[k] < from) k++;
    const elapsed = t[e] - timeAt(d, t, from, k);
    if (elapsed < best) best = elapsed;
  }
  return Number.isFinite(best) && best > 0 ? Math.round(best) : null;
}

export function computeRunStats(points: readonly GeoPoint[], validation: Validation): RunStats {
  const { d, t } = cumulative(points, validation);
  const meters = d[d.length - 1];
  const movingSeconds = t[t.length - 1];

  const splits: number[] = [];
  let j = 1;
  let prev = 0;
  for (let k = 1; k * 1000 <= meters + 1e-9 && splits.length < MAX_SPLITS; k++) {
    while (j < d.length - 1 && d[j] < k * 1000) j++;
    const at = timeAt(d, t, k * 1000, j);
    splits.push(Math.max(1, Math.round(at - prev)));
    prev = at;
  }

  const paceSeries: number[] = [];
  if (meters >= 100) {
    const n = Math.min(MAX_PACE_SERIES, Math.max(1, Math.floor(meters / 50)));
    const slice = meters / n;
    let k = 1;
    let last = 0;
    for (let i = 1; i <= n; i++) {
      const x = Math.min(meters, i * slice);
      while (k < d.length - 1 && d[k] < x) k++;
      const at = timeAt(d, t, x, k);
      paceSeries.push(Math.max(1, Math.round(((at - last) / slice) * 1000)));
      last = at;
    }
  }

  return {
    meters: Math.round(meters),
    movingSeconds: Math.round(movingSeconds),
    splits,
    paceSeries,
    best1k: bestEffort(d, t, RECORD_DISTANCES['1k']),
    best5k: bestEffort(d, t, RECORD_DISTANCES['5k']),
    best10k: bestEffort(d, t, RECORD_DISTANCES['10k']),
    best21k: bestEffort(d, t, RECORD_DISTANCES['21k']),
  };
}
