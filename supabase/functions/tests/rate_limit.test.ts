// F8 C3 (D-99) — limite de chamadas por pessoa nas Edge Functions: algoritmo da janela deslizante (em memória, o
// mesmo do SQL), caminho pelo banco, fallback sem banco, resposta 429 com Retry-After e todas as functions de
// usuário chamando o limite logo depois de conferir a sessão. F8-D (B2): balde `mapa` próprio e Retry-After exposto.
import assert from 'node:assert/strict';
import { handler } from '../_shared/http.ts';
import {
  checkRateLimit,
  enforceRateLimit,
  MemoryRateLimiter,
  RATE_LIMITED_MESSAGE,
  RATE_LIMITS,
  type RateBucket,
} from '../_shared/rate-limit.ts';

const T0 = Date.UTC(2026, 10, 4, 12, 0, 0); // início exato de uma janela de 60 s
const quiet = () => {};

Deno.test('limites do contrato: 60/min geral, 180/min no mapa, 10/min no finish-activity', () => {
  assert.deepEqual(RATE_LIMITS.geral, { limit: 60, windowSeconds: 60 });
  assert.deepEqual(RATE_LIMITS.mapa, { limit: 180, windowSeconds: 60 });
  // F8-D B2: 1 minuto arrastando o mapa (1 pedido a cada ~600 ms depois que a câmera para) cabe no balde do mapa
  assert.ok(RATE_LIMITS.mapa.limit >= Math.ceil(60 / 0.6) + 20, 'o mapa não pode dar 429 a quem só arrasta');
  for (const b of Object.keys(RATE_LIMITS)) assert.match(b, /^[a-z][a-z_]{0,31}$/, `balde ${b} precisa passar no CHECK do SQL`);
  assert.deepEqual(RATE_LIMITS.finish, { limit: 10, windowSeconds: 60 });
  assert.ok(RATE_LIMITS.ingest.limit >= RATE_LIMITS.geral.limit, 'a fila offline do GPS não pode ficar mais apertada que o geral');
  assert.ok(RATE_LIMITS.conta.limit <= RATE_LIMITS.finish.limit, 'exportar/excluir conta é o balde mais apertado');
});

Deno.test('memória: passa até o limite, recusa o seguinte e não conta a recusa', () => {
  const m = new MemoryRateLimiter();
  for (let i = 0; i < 10; i++) assert.equal(m.hit('u:finish', 10, 60, T0 + i).allowed, true, `chamada ${i + 1}`);
  const no = m.hit('u:finish', 10, 60, T0 + 20);
  assert.equal(no.allowed, false);
  assert.ok(no.retryAfter >= 1 && no.retryAfter <= 60);
  // insistir não piora: depois de 2 janelas inteiras volta a passar
  for (let i = 0; i < 50; i++) m.hit('u:finish', 10, 60, T0 + 1000 + i);
  assert.equal(m.hit('u:finish', 10, 60, T0 + 120_000).allowed, true);
});

Deno.test('memória: janela deslizante — não dá para dobrar o limite na virada da janela', () => {
  const m = new MemoryRateLimiter();
  for (let i = 0; i < 10; i++) m.hit('u:finish', 10, 60, T0 + 59_000 + i); // 10 no último segundo da janela 1
  // 1 s depois (janela 2, a anterior ainda pesa ~98%): recusa
  assert.equal(m.hit('u:finish', 10, 60, T0 + 60_500).allowed, false);
  // na metade da janela 2 a anterior pesa 50% (~5): cabem mais 5
  let ok = 0;
  for (let i = 0; i < 10; i++) if (m.hit('u:finish', 10, 60, T0 + 90_000 + i).allowed) ok++;
  assert.equal(ok, 5);
});

Deno.test('memória: retryAfter cobre o tempo até a próxima chamada passar', () => {
  const m = new MemoryRateLimiter();
  for (let i = 0; i < 3; i++) m.hit('k', 3, 60, T0 + 30_000);
  const no = m.hit('k', 3, 60, T0 + 30_000);
  assert.equal(no.allowed, false);
  assert.equal(m.hit('k', 3, 60, T0 + 30_000 + (no.retryAfter - 2) * 1000).allowed, false, 'antes do prazo continua recusado');
  assert.equal(m.hit('k', 3, 60, T0 + 30_000 + no.retryAfter * 1000).allowed, true, 'no prazo passa');
});

Deno.test('memória: pessoas e baldes independentes; tamanho limitado', () => {
  const m = new MemoryRateLimiter(3);
  assert.equal(m.hit('a:finish', 1, 60, T0).allowed, true);
  assert.equal(m.hit('a:finish', 1, 60, T0).allowed, false);
  assert.equal(m.hit('a:geral', 1, 60, T0).allowed, true);
  assert.equal(m.hit('b:finish', 1, 60, T0).allowed, true);
  m.hit('c:finish', 1, 60, T0);
  m.hit('d:finish', 1, 60, T0);
  assert.equal(m.size, 3, 'guarda no máximo maxKeys chaves (as mais antigas saem)');
});

Deno.test('banco: usa svc_rate_limit_hit com o balde e o limite certos', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const hit = await checkRateLimit('user-1', 'finish', {
    rpc: (name, args) => {
      calls.push({ name, args });
      return Promise.resolve({ allowed: true, remaining: 9, retryAfter: 0 });
    },
    onFallback: quiet,
  });
  assert.deepEqual(calls, [{ name: 'svc_rate_limit_hit', args: { p_user: 'user-1', p_bucket: 'finish', p_limit: 10, p_window_seconds: 60 } }]);
  assert.deepEqual(hit, { allowed: true, remaining: 9, retryAfter: 0, source: 'db' });
});

Deno.test('banco fora (servidor v1 sem a migration): cai para a memória e não bloqueia à toa', async () => {
  const memory = new MemoryRateLimiter();
  let fallbacks = 0;
  const deps = {
    rpc: () => Promise.reject(new Error('PGRST202: function not found')),
    memory,
    now: () => T0,
    onFallback: () => fallbacks++,
  };
  const results = [];
  for (let i = 0; i < 11; i++) results.push(await checkRateLimit('user-2', 'finish', deps));
  assert.equal(fallbacks, 11);
  assert.ok(results.slice(0, 10).every((r) => r.allowed && r.source === 'memory'));
  assert.equal(results[10].allowed, false, 'o contador do isolate ainda segura a 11ª');
});

Deno.test('banco com resposta estranha também cai para a memória', async () => {
  const hit = await checkRateLimit('user-3', 'geral', { rpc: () => Promise.resolve('ok'), memory: new MemoryRateLimiter(), onFallback: quiet });
  assert.equal(hit.source, 'memory');
  assert.equal(hit.allowed, true);
});

Deno.test('acima do limite: 429 RATE_LIMITED com retryAfter no corpo e Retry-After no cabeçalho', async () => {
  const fn = handler(['POST'], async () => {
    await enforceRateLimit('user-4', 'finish', {
      rpc: () => Promise.resolve({ allowed: false, remaining: 0, retryAfter: 17 }),
      onFallback: quiet,
    });
    return new Response('nunca');
  });
  const res = await fn(new Request('http://x/finish-activity', { method: 'POST' }));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('Retry-After'), '17');
  // F8-D B2: na web o navegador só deixa o app ler o Retry-After se ele estiver exposto no CORS
  assert.match(res.headers.get('Access-Control-Expose-Headers') ?? '', /(^|,\s*)Retry-After(\s*,|$)/i);
  const preflight = await fn(new Request('http://x/finish-activity', { method: 'OPTIONS' }));
  assert.match(preflight.headers.get('Access-Control-Expose-Headers') ?? '', /Retry-After/);
  assert.deepEqual(await res.json(), { error: { code: 'RATE_LIMITED', message: RATE_LIMITED_MESSAGE, details: { retryAfter: 17 } } });
});

Deno.test('toda function de usuário chama o limite logo depois de conferir a sessão, no balde certo', async () => {
  const expected: Record<string, RateBucket> = {
    'register-device': 'geral',
    'ingest-points': 'ingest',
    'finish-activity': 'finish',
    zones: 'mapa',
    zone: 'mapa',
    'moderate-activity': 'geral',
    'account-export': 'conta',
    'account-delete': 'conta',
    'weekly-recap': 'geral',
  };
  const root = new URL('../', import.meta.url);
  const dirs: string[] = [];
  for await (const e of Deno.readDir(root)) {
    if (!e.isDirectory || e.name.startsWith('_') || e.name === 'tests') continue;
    try {
      await Deno.stat(new URL(`${e.name}/index.ts`, root));
      dirs.push(e.name);
    } catch {
      /* pasta sem function */
    }
  }
  assert.deepEqual(dirs.sort(), Object.keys(expected).sort(), 'function nova precisa entrar nesta lista (e chamar enforceRateLimit)');
  for (const name of dirs) {
    const src = await Deno.readTextFile(new URL(`${name}/index.ts`, root));
    const re = new RegExp(`const user = await requireUser\\(req\\);\\s*\\n\\s*await enforceRateLimit\\(user\\.id, '${expected[name]}'\\);`);
    assert.match(src, re, `${name}: enforceRateLimit(user.id, '${expected[name]}') logo depois de requireUser`);
  }
});
