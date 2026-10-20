// D-04 — assinatura dos lotes. O vetor abaixo está em API_CONTRATO.md e foi conferido com Python (hmac/hashlib).
import assert from 'node:assert/strict';
import { base64ToBytes, canonicalBatch, hmacSha256Hex, timingSafeEqualHex, verifyBatchSignature } from '../_shared/hmac.ts';
import { VECTOR } from './fixtures.ts';


Deno.test('canonical: ordem fixa das chaves e campos ausentes como null', () => {
  assert.equal(canonicalBatch(VECTOR.body), VECTOR.canonical);
});

Deno.test('canonical: ignora a ordem das chaves e campos extras do corpo (startedAt, mission, signature)', () => {
  const shuffled = {
    points: VECTOR.body.points.map((p) => Object.fromEntries(Object.entries(p).reverse())),
    toSeq: 1, fromSeq: 0, deviceId: VECTOR.body.deviceId, activityId: VECTOR.body.activityId,
    startedAt: 1, mission: 'livre', signature: 'x',
  } as unknown as typeof VECTOR.body;
  assert.equal(canonicalBatch(shuffled), VECTOR.canonical);
});

Deno.test('HMAC-SHA256 do vetor de teste', async () => {
  assert.equal(await hmacSha256Hex(base64ToBytes(VECTOR.secret), VECTOR.canonical), VECTOR.signature);
  assert.equal(await verifyBatchSignature(VECTOR.secret, VECTOR.body, VECTOR.signature), true);
  assert.equal(await verifyBatchSignature(VECTOR.secret, VECTOR.body, VECTOR.signature.toUpperCase()), true);
});

Deno.test('assinatura não confere se um ponto muda ou a chave é outra', async () => {
  const tampered = structuredClone(VECTOR.body);
  tampered.points[1].lat = -16.70976;
  assert.equal(await verifyBatchSignature(VECTOR.secret, tampered, VECTOR.signature), false);
  const other = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  assert.equal(await verifyBatchSignature(other, VECTOR.body, VECTOR.signature), false);
});

Deno.test('comparação em tempo constante', () => {
  assert.equal(timingSafeEqualHex('abcd', 'abcd'), true);
  assert.equal(timingSafeEqualHex('abcd', 'abce'), false);
  assert.equal(timingSafeEqualHex('abcd', 'abcdef'), false);
  assert.equal(timingSafeEqualHex('', ''), true);
});
