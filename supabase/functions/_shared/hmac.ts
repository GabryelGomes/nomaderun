/**
 * D-04 — assinatura HMAC-SHA256 dos lotes de pontos.
 * Canonical = JSON.stringify com chaves na ordem activityId, deviceId, fromSeq, toSeq, points e, em cada
 * ponto, seq, lat, lng, t, accuracy, speed, altitude, mocked, steps (ausentes como null). Ver API_CONTRATO.md.
 */

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

const orNull = <T>(v: T | undefined | null) => (v === undefined ? null : v);

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

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(secret: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

/** Comparação em tempo constante (não para no primeiro byte diferente). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

export async function verifyBatchSignature(secretB64: string, batch: SignedBatch, signature: string): Promise<boolean> {
  const expected = await hmacSha256Hex(base64ToBytes(secretB64), canonicalBatch(batch));
  return timingSafeEqualHex(expected, signature);
}
