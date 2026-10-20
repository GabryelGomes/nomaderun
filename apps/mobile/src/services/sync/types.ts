import type { CheatFlag } from '@/domain/anti-cheat';
import type { FactionId } from '@/domain/types';

/** Resposta oficial do `finish-activity` (docs/API_CONTRATO.md). */
export type OfficialStatus = 'valid' | 'partial' | 'rejected' | 'review';
export type OfficialOutcome = 'conquered' | 'defended' | 'influence' | 'none';
export type ReviewReason = 'LOW_TRUST' | 'TRUST_SUSPENDED' | 'SUSPENDED' | 'NO_PEDOMETER_LONG_RUN';

export type OfficialZone = {
  zoneId: string;
  name: string;
  meters: number;
  rp: number;
  outcome: OfficialOutcome;
  ownerBefore: FactionId | null;
  ownerAfter: FactionId | null;
};

export type InvalidSegment = { fromSeq: number; toSeq: number; code: CheatFlag; reason: string };

export type OfficialResult = {
  activityId: string;
  status: OfficialStatus;
  meters: number;
  movingSeconds: number;
  avgPace: number | null;
  rpTotal: number;
  xp: number;
  flags: CheatFlag[];
  invalidSegments: InvalidSegment[];
  zones: OfficialZone[];
  newFogCells: number;
  beatGhost: boolean | null;
  trust: number;
  review: { reason: ReviewReason; message: string } | null;
};

export type IngestResponse = { accepted: number; duplicates: number; lastSeq: number };

/** Falha de uma chamada às functions, com o código do contrato e `details.lastSeq` quando houver. */
export type ApiFailure = {
  /** Código do contrato (`OUT_OF_ORDER`...), ou `NETWORK` / `HTTP_<status>` / `NOT_CONFIGURED`. */
  code: string;
  status: number;
  message: string;
  details?: { lastSeq?: number };
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

export type IngestBody = {
  activityId: string;
  deviceId: string;
  startedAt?: number;
  mission?: string;
  ghostPace?: number;
  fromSeq: number;
  toSeq: number;
  points: {
    seq: number;
    lat: number;
    lng: number;
    t: number;
    accuracy: number | null;
    speed: number | null;
    altitude: number | null;
    mocked: boolean | null;
    steps: number | null;
  }[];
  signature: string;
};

export interface SyncTransport {
  registerDevice(body: { deviceId: string; secret: string; platform: 'ios' | 'android' | 'web'; model?: string }): Promise<ApiResult<{ deviceId: string }>>;
  ingest(body: IngestBody): Promise<ApiResult<IngestResponse>>;
  finish(body: { activityId: string; endedAt?: number; lastSeq: number }): Promise<ApiResult<OfficialResult>>;
  /** Renova a sessão do Auth (depois de um 401). `true` se conseguiu. */
  refreshSession(): Promise<boolean>;
  /** Resultado já gravado no servidor (`activities.result`), para corrida já finalizada. */
  fetchResult?(activityId: string): Promise<ApiResult<OfficialResult | null>>;
}

export const isRetryable = (e: ApiFailure) => e.code === 'NETWORK' || e.status === 0 || e.status >= 500 || e.status === 429 || e.code === 'BUSY';
