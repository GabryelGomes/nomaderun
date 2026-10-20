// T4.2 (A5) — entradas adversariais nas validações das Edge Functions: tipos trocados, números não finitos,
// coordenadas e seq inválidos, lotes enormes, JSON inválido, e a comparação da assinatura.
import assert from 'node:assert/strict';
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { timingSafeEqualHex, verifyBatchSignature } from '../_shared/hmac.ts';
import { parseBbox, parseFinish, parseIngestBody, parseModerate, parseRegisterDevice } from '../_shared/validate.ts';
import { VECTOR } from './fixtures.ts';

const NOW = 1760000100000;
const body = (over: Record<string, unknown> = {}) => ({ ...structuredClone(VECTOR.body), signature: VECTOR.signature, ...over });
const withPoint = (patch: Record<string, unknown>) => {
  const b = body();
  (b.points as Record<string, unknown>[])[1] = { ...b.points[1], ...patch };
  return b;
};

function rejects(fn: () => unknown, status = 400) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof HttpError, `esperava HttpError, veio ${e}`);
    assert.equal(e.status, status);
    assert.equal(e.code, 'VALIDATION');
    return;
  }
  assert.fail('deveria ter recusado');
}

Deno.test('ingest: tipos trocados nos campos do lote', () => {
  for (const over of [
    { fromSeq: '0' }, { fromSeq: 0.5, toSeq: 1.5 }, { toSeq: '1' }, { points: {} }, { points: 'x' }, { points: null },
    { activityId: 123 }, { deviceId: null }, { signature: 123 }, { signature: VECTOR.signature + '00' },
    { startedAt: '2026-10-20' }, { startedAt: 1.5 }, { startedAt: 10 }, { ghostPace: 'rápido' }, { ghostPace: 10 }, { ghostPace: 99999 },
    { mission: 1 },
  ]) rejects(() => parseIngestBody(body(over), NOW));
  rejects(() => parseIngestBody([body()], NOW));
  rejects(() => parseIngestBody(null, NOW));
  rejects(() => parseIngestBody('lote', NOW));
});

Deno.test('ingest: pontos com valores não finitos, fora da faixa ou do tipo errado', () => {
  for (const patch of [
    { lat: '-16.7' }, { lat: null }, { lat: Infinity }, { lat: -Infinity }, { lat: NaN }, { lat: 90.0001 }, { lat: -90.5 },
    { lng: NaN }, { lng: 180.1 }, { lng: '0' }, { t: '1760000000000' }, { t: 1760000000000.5 }, { t: NaN },
    { seq: '1' }, { seq: 1.0000001 }, { seq: -1 }, { steps: 1.5 }, { steps: '3' }, { steps: NaN },
    { accuracy: NaN }, { accuracy: -1 }, { speed: Infinity }, { altitude: 99999 }, { mocked: 1 }, { mocked: 'true' },
  ]) rejects(() => parseIngestBody(withPoint(patch), NOW));
  rejects(() => parseIngestBody(body({ points: [null, null], toSeq: 1 }), NOW));
});

Deno.test('ingest: seq negativo e lote coerente com fromSeq/toSeq', () => {
  const neg = body({ fromSeq: -2, toSeq: -1, points: VECTOR.body.points.map((p, i) => ({ ...p, seq: i - 2 })) });
  rejects(() => parseIngestBody(neg, NOW));
  rejects(() => parseIngestBody(body({ toSeq: 0 }), NOW));
  // 500 pontos é o máximo aceito
  const pts = Array.from({ length: 500 }, (_, i) => ({ seq: i, lat: -16.7, lng: -49.2, t: NOW - 600_000 + i * 1000 }));
  assert.equal(parseIngestBody(body({ points: pts, toSeq: 499 }), NOW).points.length, 500);
});

Deno.test('ingest: JSON com número gigante vira Infinity e é recusado; NaN não existe em JSON', () => {
  const raw = JSON.stringify(body()).replace('"lat":-16.7097', '"lat":1e400');
  const parsed = JSON.parse(raw);
  if (parsed.points[0].lat === Infinity) rejects(() => parseIngestBody(parsed, NOW));
  assert.throws(() => JSON.parse('{"lat": NaN}'));
});

Deno.test('readJson: corpo grande demais (413) e JSON inválido (400)', async () => {
  const big = new Request('http://x', { method: 'POST', body: 'x'.repeat(2048) });
  await assert.rejects(readJson(big, 1024), (e) => e instanceof HttpError && e.status === 413);
  const bad = new Request('http://x', { method: 'POST', body: '{"a":' });
  await assert.rejects(readJson(bad), (e) => e instanceof HttpError && e.status === 400 && e.code === 'VALIDATION');
  const proto = new Request('http://x', { method: 'POST', body: '{"__proto__": {"admin": true}}' });
  const obj = (await readJson(proto)) as Record<string, unknown>;
  assert.equal(({} as Record<string, unknown>).admin, undefined, 'JSON.parse não polui o protótipo');
  assert.ok(Object.hasOwn(obj, '__proto__'));
});

Deno.test('handler: erro inesperado vira 500 genérico, sem mensagem interna', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const h = handler(['POST'], () => {
      throw new Error('relation "public.devices" does not exist; secret=abc');
    });
    const res = await h(new Request('http://x', { method: 'POST' }));
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!/relation|secret|devices|stack/i.test(text), text);
    assert.match(text, /INTERNAL/);
    const notAllowed = await h(new Request('http://x', { method: 'DELETE' }));
    assert.equal(notAllowed.status, 405);
    await notAllowed.body?.cancel();
  } finally {
    console.error = orig;
  }
});

Deno.test('register-device: tipos trocados, chave de 31/33 bytes, modelo longo', () => {
  const ok = { deviceId: VECTOR.body.deviceId, secret: VECTOR.secret, platform: 'android' };
  const b64 = (n: number) => btoa(String.fromCharCode(...new Uint8Array(n).fill(1)));
  for (const over of [
    { deviceId: 'nao-uuid' }, { deviceId: 1 }, { secret: 123 }, { secret: b64(31) }, { secret: b64(33) }, { secret: '' },
    { platform: 'IOS' }, { platform: null }, { model: 'x'.repeat(101) }, { model: 42 },
  ]) rejects(() => parseRegisterDevice({ ...ok, ...over }));
  rejects(() => parseRegisterDevice('x'));
  assert.equal(parseRegisterDevice({ ...ok, deviceId: VECTOR.body.deviceId.toUpperCase() }).deviceId, VECTOR.body.deviceId.toLowerCase());
});

Deno.test('finish/moderate: lastSeq abaixo de -1, tipos trocados, justificativa só com espaços', () => {
  const id = VECTOR.body.activityId;
  for (const b of [{ activityId: id, lastSeq: -2 }, { activityId: id, lastSeq: '3' }, { activityId: id, lastSeq: 1.5 },
    { activityId: id, lastSeq: 1, endedAt: 'ontem' }, { activityId: id, lastSeq: 1, endedAt: 5 }, { activityId: 'x', lastSeq: 1 }]) {
    rejects(() => parseFinish(b));
  }
  rejects(() => parseModerate({ activityId: id, decision: 'approve', justification: ' '.repeat(50) }));
  rejects(() => parseModerate({ activityId: id, decision: 'approve', justification: 'x'.repeat(1001) }));
  rejects(() => parseModerate({ activityId: id, decision: 'APPROVE', justification: 'justificativa ok' }));
  rejects(() => parseModerate({ activityId: id, decision: 'approve', justification: ['justificativa ok'] }));
});

Deno.test('bbox: NaN, Infinity, texto, vazio e caixa invertida/gigante', () => {
  for (const v of ['NaN,0,1,1', 'Infinity,0,1,1', '0,0,1e400,1', 'a,b,c,d', ',,,', '', '0,0,0,0', '0,0,1.5,0.5', '0,-91,0.5,-90.5', '1,1,1,1,1']) {
    rejects(() => parseBbox(v));
  }
});

Deno.test('HMAC: assinatura de outro aparelho, truncada, vazia ou com caracteres não-hex não confere', async () => {
  const other = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
  assert.equal(await verifyBatchSignature(other, VECTOR.body, VECTOR.signature), false);
  assert.equal(await verifyBatchSignature(VECTOR.secret, VECTOR.body, VECTOR.signature.slice(0, 63)), false);
  assert.equal(await verifyBatchSignature(VECTOR.secret, VECTOR.body, ''), false);
  assert.equal(timingSafeEqualHex(VECTOR.signature, VECTOR.signature.slice(0, 63) + 'g'), false);
  // trocar deviceId ou activityId muda o canonical: assinatura antiga não vale para outra corrida/aparelho
  const moved = { ...structuredClone(VECTOR.body), activityId: crypto.randomUUID() };
  assert.equal(await verifyBatchSignature(VECTOR.secret, moved, VECTOR.signature), false);
  const dev = { ...structuredClone(VECTOR.body), deviceId: crypto.randomUUID() };
  assert.equal(await verifyBatchSignature(VECTOR.secret, dev, VECTOR.signature), false);
});
