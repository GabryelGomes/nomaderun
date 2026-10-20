/**
 * JSON canônico de um lote de pontos (D-04, `docs/API_CONTRATO.md` → ingest-points).
 * Chaves na ordem activityId, deviceId, fromSeq, toSeq, points e, em cada ponto,
 * seq, lat, lng, t, accuracy, speed, altitude, mocked, steps (ausentes como null).
 * Deve produzir exatamente o mesmo texto que `supabase/functions/_shared/hmac.ts`.
 */
import { base64ToBytes } from './base64';
import { hmacSha256Hex } from './hmac';

export type SignedPoint = {
  seq: number;
  lat: number;
  lng: number;
  t: number;
  accuracy?: number | null;
  speed?: number | null;
  altitude?: number | null;
  mocked?: boolean | null;
  steps?: number | null;
};

export type SignedBatch = {
  activityId: string;
  deviceId: string;
  fromSeq: number;
  toSeq: number;
  points: SignedPoint[];
};

const orNull = <T>(v: T | undefined | null): T | null => (v === undefined ? null : v);

export function canonicalBatch(b: SignedBatch): string {
  return JSON.stringify({
    activityId: b.activityId,
    deviceId: b.deviceId,
    fromSeq: b.fromSeq,
    toSeq: b.toSeq,
    points: b.points.map((p) => ({
      seq: p.seq,
      lat: p.lat,
      lng: p.lng,
      t: p.t,
      accuracy: orNull(p.accuracy),
      speed: orNull(p.speed),
      altitude: orNull(p.altitude),
      mocked: orNull(p.mocked),
      steps: orNull(p.steps),
    })),
  });
}

/** Assinatura hex de um lote com a chave do aparelho (base64 de 32 bytes). */
export function signBatch(secretB64: string, batch: SignedBatch): string {
  return hmacSha256Hex(base64ToBytes(secretB64), canonicalBatch(batch));
}
