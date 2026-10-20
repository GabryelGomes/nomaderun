// Validação das entradas das functions (mensagens em pt-BR, código VALIDATION).
import assert from 'node:assert/strict';
import { HttpError } from '../_shared/http.ts';
import { parseBbox, parseFinish, parseIngestBody, parseModerate, parseRegisterDevice } from '../_shared/validate.ts';
import { VECTOR } from './fixtures.ts';

const NOW = 1760000100000;
const body = (over: Record<string, unknown> = {}) => ({ ...structuredClone(VECTOR.body), signature: VECTOR.signature, ...over });

function rejects(fn: () => unknown, pattern: RegExp) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof HttpError, 'esperava HttpError');
    assert.equal(e.status, 400);
    assert.equal(e.code, 'VALIDATION');
    assert.match(e.message, pattern);
    return;
  }
  assert.fail('deveria ter recusado');
}

Deno.test('ingest: corpo válido é aceito e campos ausentes viram null', () => {
  const b = parseIngestBody(body(), NOW);
  assert.equal(b.points.length, 2);
  assert.equal(b.points[1].speed, null);
  assert.equal(b.points[1].steps, null);
  assert.equal(b.mission, null);
});

Deno.test('ingest: limites e coerência do lote', () => {
  const many = Array.from({ length: 501 }, (_, i) => ({ seq: i, lat: 0, lng: 0, t: NOW - 1000 + i }));
  rejects(() => parseIngestBody(body({ points: many, toSeq: 500 }), NOW), /No máximo 500 pontos/);
  rejects(() => parseIngestBody(body({ points: [] }), NOW), /ao menos um ponto/);
  rejects(() => parseIngestBody(body({ toSeq: 5 }), NOW), /não batem/);
  rejects(() => parseIngestBody(body({ activityId: 'abc' }), NOW), /activityId/);
  rejects(() => parseIngestBody(body({ signature: 'zz' }), NOW), /Assinatura/);
  rejects(() => parseIngestBody(body({ fromSeq: -1, toSeq: 0 }), NOW), /fromSeq/);
});

Deno.test('ingest: valida cada ponto', () => {
  const pts = (patch: Record<string, unknown>) => {
    const b = body();
    b.points[1] = { ...b.points[1], ...patch } as typeof b.points[1];
    return b;
  };
  rejects(() => parseIngestBody(pts({ lat: 91 }), NOW), /Latitude/);
  rejects(() => parseIngestBody(pts({ lng: -181 }), NOW), /Longitude/);
  rejects(() => parseIngestBody(pts({ seq: 5 }), NOW), /sequência/);
  rejects(() => parseIngestBody(pts({ t: 1000 }), NOW), /Horário/);
  rejects(() => parseIngestBody(pts({ t: NOW + 3 * 86_400_000 }), NOW), /Horário/);
  rejects(() => parseIngestBody(pts({ t: VECTOR.body.points[0].t - 1 }), NOW), /fora de ordem/);
  rejects(() => parseIngestBody(pts({ steps: -1 }), NOW), /steps/);
  rejects(() => parseIngestBody(pts({ mocked: 'sim' }), NOW), /mocked/);
  rejects(() => parseIngestBody(pts({ accuracy: 'x' }), NOW), /accuracy/);
  rejects(() => parseIngestBody(body({ mission: 'maratona' }), NOW), /Missão/);
});

Deno.test('register-device: chave de 32 bytes em base64 e plataforma', () => {
  const ok = parseRegisterDevice({ deviceId: VECTOR.body.deviceId, secret: VECTOR.secret, platform: 'ios' });
  assert.equal(ok.platform, 'ios');
  rejects(() => parseRegisterDevice({ deviceId: VECTOR.body.deviceId, secret: btoa('curta'), platform: 'ios' }), /32 bytes/);
  rejects(() => parseRegisterDevice({ deviceId: VECTOR.body.deviceId, secret: '***', platform: 'ios' }), /base64/);
  rejects(() => parseRegisterDevice({ deviceId: VECTOR.body.deviceId, secret: VECTOR.secret, platform: 'symbian' }), /Plataforma/);
});

Deno.test('finish-activity e moderate-activity', () => {
  assert.deepEqual(parseFinish({ activityId: VECTOR.body.activityId, lastSeq: 10 }), { activityId: VECTOR.body.activityId, endedAt: null, lastSeq: 10 });
  rejects(() => parseFinish({ activityId: VECTOR.body.activityId }), /lastSeq/);
  rejects(() => parseModerate({ activityId: VECTOR.body.activityId, decision: 'approve', justification: 'curta' }), /justificativa/);
  rejects(() => parseModerate({ activityId: VECTOR.body.activityId, decision: 'talvez', justification: 'longa o suficiente' }), /Decisão/);
});

Deno.test('bbox', () => {
  assert.deepEqual(parseBbox('-49.3,-16.8,-49.2,-16.7'), { minLng: -49.3, minLat: -16.8, maxLng: -49.2, maxLat: -16.7 });
  rejects(() => parseBbox(null), /obrigatório/);
  rejects(() => parseBbox('1,2,3'), /4 números/);
  rejects(() => parseBbox('-49.2,-16.8,-49.3,-16.7'), /mínimo/);
  rejects(() => parseBbox('-50,-17,-48,-16'), /muito grande/);
  rejects(() => parseBbox('-181,0,0,0.1'), /limites/);
});
