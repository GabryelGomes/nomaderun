// Correções da Fase 4 (A2) sobre os achados do QA (docs/QA.md): QA-02 (ghostPace só na Fuga, 150–900 s/km),
// QA-06 (exclusão de conta com reautenticação), QA-08 (corpo grande recusado pelo Content-Length) e
// QA-09 (endedAt entre o início da corrida e agora + 5 min).
import assert from 'node:assert/strict';
import { cellCenter, offset, zoneOf } from '../_shared/domain.ts';
import { HttpError, readJson } from '../_shared/http.ts';
import { parseAccountDelete, verifyPassword } from '../_shared/account.ts';
import { computeOfficialResult, type ScoringInput, type StoredPoint } from '../_shared/scoring.ts';
import {
  checkEndedAt,
  ENDED_AT_TOLERANCE_MS,
  GHOST_PACE_MAX,
  GHOST_PACE_MIN,
  parseIngestBody,
} from '../_shared/validate.ts';
import { VECTOR } from './fixtures.ts';

const NOW = 1760000100000;
const body = (over: Record<string, unknown> = {}) => ({ ...structuredClone(VECTOR.body), signature: VECTOR.signature, ...over });

function rejects(fn: () => unknown, status = 400, code = 'VALIDATION') {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof HttpError, `esperava HttpError, veio ${e}`);
    assert.equal(e.status, status);
    assert.equal(e.code, code);
    return;
  }
  assert.fail('deveria ter recusado');
}

// ---------------------------------------------------------------- QA-02
Deno.test('QA-02: ghostPace só vale na missão fuga; nas outras é ignorado', () => {
  assert.equal(parseIngestBody(body({ mission: 'fuga', ghostPace: 330 }), NOW).ghostPace, 330);
  assert.equal(parseIngestBody(body({ mission: 'livre', ghostPace: 330 }), NOW).ghostPace, null);
  assert.equal(parseIngestBody(body({ mission: 'caca', ghostPace: 330 }), NOW).ghostPace, null);
  assert.equal(parseIngestBody(body({ ghostPace: 330 }), NOW).ghostPace, null, 'sem missão = livre');
});

Deno.test('QA-02: ghostPace fora de 150–900 s/km é recusado', () => {
  assert.equal(GHOST_PACE_MIN, 150);
  assert.equal(GHOST_PACE_MAX, 900);
  assert.equal(parseIngestBody(body({ mission: 'fuga', ghostPace: 150 }), NOW).ghostPace, 150);
  assert.equal(parseIngestBody(body({ mission: 'fuga', ghostPace: 900 }), NOW).ghostPace, 900);
  for (const ghostPace of [149, 901, 3600, 60, 0, -300]) rejects(() => parseIngestBody(body({ mission: 'fuga', ghostPace }), NOW));
  rejects(() => parseIngestBody(body({ mission: 'livre', ghostPace: 3600 }), NOW));
});

const CENTER = cellCenter(zoneOf({ lat: -16.5, lng: -49.5 }));
const T0 = 1_760_000_000_000;
const loop = (): StoredPoint[] => {
  const circumference = 2 * Math.PI * 60;
  const n = Math.floor((2 * circumference) / 3);
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = offset(CENTER, 60, ((i * 3) / circumference) * 360);
    return { seq: i, lat: p.lat, lng: p.lng, t: T0 + i * 1000, accuracy: 5, speed: 3, altitude: 750, mocked: false, steps: i === 0 ? 0 : 3 };
  });
};
const input = (over: Partial<ScoringInput>): ScoringInput => ({
  mode: 'finish', activityId: VECTOR.body.activityId, points: loop(), startedAt: T0, faction: 'striders', trust: 100,
  profileStatus: 'active', suspendedUntil: null, streakWeeks: 0, recentPaces: [], zones: [], earnedToday: {}, revealedFog: [],
  ghostPace: null, now: T0 + 3_600_000, ...over,
});

Deno.test('QA-02: cálculo oficial ignora o fantasma fora da Fuga (mesmo que um valor antigo esteja gravado)', () => {
  const livre = computeOfficialResult(input({ mission: 'livre', ghostPace: 3600 }));
  assert.equal(livre.response.beatGhost, null);
  const semFantasma = computeOfficialResult(input({ mission: 'livre', ghostPace: null }));
  assert.equal(livre.response.rpTotal, semFantasma.response.rpTotal, 'sem M_fantasma 1,5');
  assert.equal(livre.response.xp, semFantasma.response.xp, 'sem +50 XP');
  const fuga = computeOfficialResult(input({ mission: 'fuga', ghostPace: 900 }));
  assert.equal(fuga.response.beatGhost, true, 'na Fuga o fantasma continua valendo');
  const fugaForaDaFaixa = computeOfficialResult(input({ mission: 'fuga', ghostPace: 3600 }));
  assert.equal(fugaForaDaFaixa.response.beatGhost, null, 'valor fora de 150–900 gravado antes da correção também é ignorado');
});

// ---------------------------------------------------------------- QA-09
Deno.test('QA-09: endedAt entre o início da corrida e agora + 5 min', () => {
  const started = NOW - 3_600_000;
  assert.equal(ENDED_AT_TOLERANCE_MS, 5 * 60_000);
  assert.equal(checkEndedAt(null, started, NOW), null);
  assert.equal(checkEndedAt(started, started, NOW), started);
  assert.equal(checkEndedAt(NOW + ENDED_AT_TOLERANCE_MS, started, NOW), NOW + ENDED_AT_TOLERANCE_MS);
  rejects(() => checkEndedAt(started - 1, started, NOW));
  rejects(() => checkEndedAt(NOW + ENDED_AT_TOLERANCE_MS + 1, started, NOW));
  rejects(() => checkEndedAt(32_503_680_000_000, started, NOW), 400); // ano 3000
});

// ---------------------------------------------------------------- QA-08
Deno.test('QA-08: corpo com Content-Length acima do limite é recusado antes de ser lido', async () => {
  let read = false;
  const stream = new ReadableStream({
    pull(c) {
      read = true;
      c.enqueue(new TextEncoder().encode('{}'));
      c.close();
    },
  });
  const req = new Request('http://x/ingest-points', { method: 'POST', body: stream, headers: { 'Content-Length': String(2 * 1024 * 1024) } });
  await assert.rejects(() => readJson(req, 1024 * 1024), (e: unknown) => e instanceof HttpError && e.status === 413);
  assert.equal(read, false, 'o corpo não foi lido');
});

// ---------------------------------------------------------------- QA-06
Deno.test('QA-06: exclusão exige { confirm: "EXCLUIR", password }', () => {
  assert.deepEqual(parseAccountDelete({ confirm: 'EXCLUIR', password: 'Senha@2026' }), { password: 'Senha@2026' });
  rejects(() => parseAccountDelete({ confirm: 'EXCLUIR' }));
  rejects(() => parseAccountDelete({ confirm: 'EXCLUIR', password: '' }));
  rejects(() => parseAccountDelete({ confirm: 'EXCLUIR', password: 123 }));
  rejects(() => parseAccountDelete({ confirm: 'EXCLUIR', password: 'x'.repeat(201) }));
  rejects(() => parseAccountDelete({ confirm: 'sim', password: 'Senha@2026' }));
  rejects(() => parseAccountDelete(null));
});

Deno.test('QA-06: senha conferida no Auth (grant_type=password com o e-mail do usuário)', async () => {
  const calls: { url: string; body: unknown }[] = [];
  const fake = (status: number) => (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response(status === 200 ? '{"access_token":"x"}' : '{"error":"invalid_grant"}', { status }));
  };
  await verifyPassword('ana@t.com', 'certa', { baseUrl: 'http://auth', apikey: 'k', fetch: fake(200) });
  assert.match(calls[0].url, /\/auth\/v1\/token\?grant_type=password$/);
  assert.deepEqual(calls[0].body, { email: 'ana@t.com', password: 'certa' });
  await assert.rejects(() => verifyPassword('ana@t.com', 'errada', { baseUrl: 'http://auth', apikey: 'k', fetch: fake(400) }),
    (e: unknown) => e instanceof HttpError && e.status === 403 && e.code === 'INVALID_PASSWORD');
  await assert.rejects(() => verifyPassword('ana@t.com', 'x', { baseUrl: 'http://auth', apikey: 'k', fetch: fake(429) }),
    (e: unknown) => e instanceof HttpError && e.status === 429 && e.code === 'RATE_LIMITED');
  await assert.rejects(() => verifyPassword(undefined, 'x', { baseUrl: 'http://auth', apikey: 'k', fetch: fake(200) }),
    (e: unknown) => e instanceof HttpError && e.status === 409 && e.code === 'REAUTH_UNAVAILABLE');
});
