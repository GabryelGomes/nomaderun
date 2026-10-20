/**
 * Fila offline de corridas (D-03, RF-005, RNF-005). Toda corrida vai primeiro para o aparelho;
 * o sync envia em lotes assinados e o servidor ignora duplicados por (activityId, seq).
 *
 * Estados da corrida na fila:
 *  - `recording`: corrida em andamento (os lotes já vão sendo enviados);
 *  - `pending`:   terminou e ainda falta enviar pontos e/ou finalizar no servidor;
 *  - `syncing`:   envio em andamento (ao reabrir o app volta a valer como `pending`);
 *  - `synced`:    resultado oficial recebido (pontos locais podem ser apagados);
 *  - `failed`:    erro definitivo (assinatura recusada, corrida de outra conta etc.).
 */
export type QueueRunState = 'recording' | 'pending' | 'syncing' | 'synced' | 'failed';

export type ServerMission = 'livre' | 'fuga' | 'caca';

export type QueuedPoint = {
  seq: number;
  lat: number;
  lng: number;
  t: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
  mocked: boolean | null;
  /** Passos desde o ponto anterior; null = aparelho sem pedômetro (RN-008). */
  steps: number | null;
};

export type NewPoint = Omit<QueuedPoint, 'seq'>;

export type QueuedRun = {
  id: string;
  userId: string;
  mission: ServerMission;
  ghostPace: number | null;
  startedAt: number;
  endedAt: number | null;
  /** Maior `seq` gravado no aparelho (-1 = nenhum ponto). */
  lastSeq: number;
  /** Maior `seq` confirmado pelo servidor (-1 = nenhum). */
  ackedSeq: number;
  state: QueueRunState;
  simulated: boolean;
  /** Pausa manual: a tarefa de segundo plano não grava pontos enquanto estiver pausada. */
  paused: boolean;
  /** Resumo provisório (JSON de `RunSummary`), calculado no aparelho ao terminar. */
  provisional: string | null;
  /** Resposta oficial do `finish-activity` (JSON). */
  official: string | null;
  /** Percurso simplificado para o mapa do resumo (JSON de `[lat, lng][]`). */
  path: string | null;
  error: string | null;
  errorCode: string | null;
  attempts: number;
  nextAttemptAt: number;
  updatedAt: number;
};

export type NewRun = Pick<QueuedRun, 'id' | 'userId' | 'mission' | 'ghostPace' | 'startedAt' | 'simulated'>;

export type RunPatch = Partial<Omit<QueuedRun, 'id' | 'userId' | 'lastSeq'>>;

export interface QueueStore {
  createRun(run: NewRun, now?: number): Promise<QueuedRun>;
  /**
   * Grava pontos com `seq` contínuo (lastSeq + 1, + 2, ...) numa transação.
   * `onlyIfRecording` (tarefa de segundo plano): só grava se a corrida está `recording` e não pausada.
   * Devolve os `seq` atribuídos (vazio se nada foi gravado).
   */
  appendPoints(runId: string, points: NewPoint[], opts?: { onlyIfRecording?: boolean }): Promise<number[]>;
  getRun(id: string): Promise<QueuedRun | null>;
  listRuns(userId?: string): Promise<QueuedRun[]>;
  /** Pontos com seq ≥ fromSeq, em ordem, no máximo `limit`. */
  readPoints(runId: string, fromSeq: number, limit: number): Promise<QueuedPoint[]>;
  updateRun(id: string, patch: RunPatch): Promise<QueuedRun | null>;
  deletePoints(runId: string): Promise<void>;
  deleteRun(id: string): Promise<void>;
}

/** Corrida "viva" na fila: ainda precisa do servidor. */
export const needsSync = (r: QueuedRun) => r.state === 'pending' || r.state === 'syncing' || (r.state === 'recording' && r.ackedSeq < r.lastSeq);
