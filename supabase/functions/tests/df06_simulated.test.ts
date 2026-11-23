// DF06 (testes externos): a marca de corrida do modo Simulação chega ao servidor pelo ingest-points.
import assert from 'node:assert/strict';
import { HttpError } from '../_shared/http.ts';
import { parseIngestBody } from '../_shared/validate.ts';
import { VECTOR } from './fixtures.ts';

const NOW = 1760000100000;
const body = (over: Record<string, unknown> = {}) => ({ ...structuredClone(VECTOR.body), signature: VECTOR.signature, ...over });

Deno.test('DF06: simulated true liga a marca; ausente, null ou false não liga', () => {
  assert.equal(parseIngestBody(body({ simulated: true }), NOW).simulated, true);
  assert.equal(parseIngestBody(body(), NOW).simulated, false);
  assert.equal(parseIngestBody(body({ simulated: null }), NOW).simulated, false);
  assert.equal(parseIngestBody(body({ simulated: false }), NOW).simulated, false);
});

Deno.test('DF06: simulated que não é booleano é recusado', () => {
  for (const v of ['sim', 1, {}]) {
    try {
      parseIngestBody(body({ simulated: v }), NOW);
      assert.fail('deveria ter recusado');
    } catch (e) {
      assert.ok(e instanceof HttpError);
      assert.equal(e.status, 400);
    }
  }
});
