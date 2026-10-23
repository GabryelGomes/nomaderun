/**
 * T4.4 (A5) — fluxo completo de demonstração no navegador (Playwright + Chromium) sobre o export web:
 * cadastro → facção → corrida simulada → resumo OFICIAL com zona conquistada → a zona aparece no mapa/folha
 * com o novo dono → notificação "Zona conquistada" → moderador aprova uma corrida em revisão.
 *
 * Uso (ver README.md desta pasta):
 *   npx expo export -p web --output-dir /tmp/nomade-web     (em apps/mobile, com o .env do Supabase local)
 *   node e2e-web/demo-flow.cjs /tmp/nomade-web
 * Variáveis: PW_CHROMIUM (executável), PW_MODULE (caminho do pacote playwright), OUT_DIR (capturas),
 * API_URL / ANON_KEY (para conferir a zona no servidor; padrão: Supabase local), PORT (8099).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');
const { serve } = require('./serve.cjs');

function loadPlaywright() {
  const tries = [process.env.PW_MODULE, 'playwright'];
  try {
    tries.push(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch {
    /* sem npm global */
  }
  for (const t of tries.filter(Boolean)) {
    try {
      return require(t);
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error('Playwright não encontrado: npm i -g playwright ou PW_MODULE=<caminho>');
}

const DIST = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'nomade-web'));
const PORT = Number(process.env.PORT || 8099);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'nomade-e2e-'));
const API = process.env.API_URL || 'http://127.0.0.1:54321';
const ANON = process.env.ANON_KEY || readEnvAnon();
const CHROMIUM = process.env.PW_CHROMIUM || firstExisting(['/opt/pw-browsers/chromium-1194/chrome-linux/chrome']);
const SIM_TIMEOUT = Number(process.env.SIM_TIMEOUT_MS || 420_000);

function readEnvAnon() {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    return /EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(env)?.[1]?.trim();
  } catch {
    return undefined;
  }
}
function firstExisting(list) {
  return list.find((p) => fs.existsSync(p));
}

let step = 0;
const results = [];
function ok(cond, label, extra) {
  step++;
  results.push({ step, ok: !!cond, label });
  console.log(`  ${cond ? 'ok' : 'NÃO OK'} ${step} - ${label}${!cond && extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 300) : ''}`);
  if (!cond) throw new Error(`falhou: ${label}`);
}

async function api(method, url, token, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { apikey: ANON, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`export web não encontrado em ${DIST}`);
  if (!ANON) throw new Error('ANON_KEY ausente (defina ou mantenha apps/mobile/.env)');
  const { chromium } = loadPlaywright();
  const server = await serve(DIST, PORT);
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const errors = [];
  const stamp = String(Date.now()).slice(-8);
  const user = { email: `web${stamp}@nomaderun.test`, password: `Demo@${stamp}`, username: `web_${stamp}` };
  console.log(`NOMADE RUN — fluxo de demonstração no navegador (${BASE}), conta ${user.email}, capturas em ${OUT}`);
  try {
    // ---------- corredor (celular) ----------
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation', 'notifications'], geolocation: { latitude: -16.7097, longitude: -49.2388 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const id = (t) => page.locator(`[data-testid="${t}"]`).first();
    const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

    await page.goto(`${BASE}/`);
    await id('tela-entrar').waitFor({ timeout: 30_000 });
    await id('entrar-criar-conta').click();
    await id('tela-cadastro').waitFor();
    await id('cadastro-email').fill(user.email);
    await id('cadastro-senha').fill(user.password);
    await id('cadastro-usuario').fill(user.username);
    await id('cadastro-nascimento').fill('15/05/2000');
    await id('cadastro-cidade').fill('Goiânia');
    await id('cadastro-aceite-termos').click();
    await id('cadastro-aceite-privacidade').click();
    await id('cadastro-botao').click();
    await id('onboarding-escolher-time').waitFor({ timeout: 30_000 });
    ok(true, 'cadastro com 16+ e aceites abre o onboarding');
    await id('onboarding-escolher-time').click();
    await id('onboarding-faccao-striders').click();
    await id('onboarding-faccao-continuar').click();
    await id('onboarding-localizacao-continuar').click();
    await id('onboarding-notificacoes-continuar').waitFor({ timeout: 15_000 });
    await id('onboarding-notificacoes-continuar').click();
    await id('mapa-status').waitFor({ timeout: 30_000 });
    await page.getByText(/zonas em/).first().waitFor({ timeout: 30_000 }).catch(() => {});
    ok(true, 'facção Neon Striders gravada e mapa com zonas do servidor');
    await shot('01-mapa');

    await id('mapa-correr').click();
    await id('corrida-comecar').waitFor({ timeout: 15_000 });
    await id('corrida-sinal-simulacao').click();
    await id('corrida-comecar').click();
    await id('corrida-pausar').waitFor({ timeout: 20_000 });
    ok(true, 'corrida simulada começou (contagem 3-2-1)');
    const t0 = Date.now();
    await page.getByText('Conquista garantida ao terminar').first().waitFor({ timeout: SIM_TIMEOUT });
    ok(true, `simulação chegou à zona neutra (${Math.round((Date.now() - t0) / 1000)} s)`);
    await page.waitForTimeout(3000);
    await shot('02-corrida');
    const hold = id('corrida-encerrar');
    await hold.scrollIntoViewIfNeeded();
    const box = await hold.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await id('tela-resumo').waitFor({ timeout: 30_000 });
    await id('resumo-zona-conquistada').waitFor({ timeout: 30_000 });
    const celebration = await id('resumo-zona-conquistada').getAttribute('aria-label');
    ok(/Zona conquistada, mais \d+ RP em .+/.test(celebration || ''), `resumo oficial: "${celebration}"`);
    ok((await page.locator('[data-testid="resumo-status-provisional"], [data-testid="resumo-status-failed"]').count()) === 0, 'resumo não ficou provisório');
    await shot('03-resumo');
    const zoneIds = await page.locator('[data-testid^="resumo-zona-8"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('resumo-zona-', '')));

    // servidor: qual zona virou dos Striders com este corredor no topo
    const login = await api('POST', '/auth/v1/token?grant_type=password', null, { email: user.email, password: user.password });
    const me = await api('GET', `/rest/v1/profiles?select=city&id=eq.${login.data.user.id}`, login.data.access_token);
    ok(me.data?.[0]?.city === 'Goiânia', 'cidade natal do cadastro gravada no perfil (options.data.city)', me.data);
    let conquered = null;
    for (const zid of zoneIds) {
      const z = await api('GET', `/functions/v1/zone?id=${zid}`, login.data.access_token);
      if (z.data?.owner === 'striders' && z.data?.topRunners?.some((r) => r.username === user.username)) {
        conquered = z.data;
        break;
      }
    }
    ok(conquered, 'a zona conquistada está no servidor com o novo dono (Striders) e o corredor entre os maiores', zoneIds);

    await id('resumo-concluir').click();
    await id('mapa-status').waitFor({ timeout: 20_000 });
    await page.goto(`${BASE}/zona/${conquered.id}`);
    await id('tela-zona').waitFor({ timeout: 20_000 });
    await id('zona-corredores').waitFor({ timeout: 20_000 });
    // T6.3/T6.4: títulos com RevealText ficam em palavras separadas (quebras no innerText): normaliza os espaços.
    const zoneText = (await id('tela-zona').innerText()).replace(/\s+/g, ' ');
    ok(zoneText.includes(conquered.name) && /Neon Striders|Striders/.test(zoneText) && zoneText.includes(user.username), `folha da zona mostra ${conquered.name}, dono Striders e o corredor`);
    await shot('04-zona');

    await page.goto(`${BASE}/notificacoes`);
    await id('tela-notificacoes').waitFor({ timeout: 20_000 });
    await page.getByText(/Zona conquistada/).first().waitFor({ timeout: 20_000 });
    ok(true, 'notificação "Zona conquistada" na central');
    await shot('05-notificacoes');
    await ctx.close();

    // ---------- moderador (painel web) ----------
    const mctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const mpage = await mctx.newPage();
    mpage.on('pageerror', (e) => errors.push(`pageerror (moderador): ${e.message}`));
    const mid = (t) => mpage.locator(`[data-testid="${t}"]`).first();
    await mpage.goto(`${BASE}/`);
    await mid('tela-entrar').waitFor({ timeout: 30_000 });
    await mid('entrar-email').fill('moderador.demo@nomaderun.app');
    await mid('entrar-senha').fill('Moderacao@2026');
    await mid('entrar-botao').click();
    await mid('mapa-status').waitFor({ timeout: 30_000 });
    await mpage.goto(`${BASE}/moderacao`);
    await mid('tela-moderacao').waitFor({ timeout: 20_000 });
    const firstRun = mpage.locator('[data-testid^="moderacao-corrida-"]').first();
    await firstRun.waitFor({ timeout: 20_000 });
    ok(true, `fila de moderação com ${await mpage.locator('[data-testid^="moderacao-corrida-"]').count()} corrida(s) em revisão`);
    ok((await firstRun.innerText()).includes('suspeito_demo'), 'painel mostra o nome do corredor (staff_profiles, P-39)');
    await firstRun.click();
    await mid('tela-moderacao-detalhe').waitFor({ timeout: 20_000 });
    await mid('moderacao-justificativa').waitFor({ timeout: 30_000 });
    await mid('moderacao-justificativa').fill('Percurso conferido no mapa e nos gráficos: aprovado na demonstração.');
    await mid('moderacao-aprovar').click();
    await mid('moderacao-decisao-ok').waitFor({ timeout: 30_000 });
    ok(true, `moderador aprovou: "${(await mid('moderacao-decisao-ok').innerText()).replace(/\s+/g, ' ').slice(0, 80)}"`);
    await mpage.screenshot({ path: path.join(OUT, '06-moderacao.png') });
    await mctx.close();

    // limpeza: apaga a conta de teste pela própria function (LGPD)
    await api('POST', '/functions/v1/account-delete', login.data.access_token, { confirm: 'EXCLUIR', password: user.password });
    const relevant = errors.filter((e) => !/tile|maplibre|Failed to fetch.*(openstreetmap|carto|tiles)/i.test(e));
    ok(relevant.length === 0, 'sem erros de página (fora o mapa-base externo)', relevant);
    console.log(`\n${results.filter((r) => r.ok).length}/${results.length} verificações ok`);
  } catch (e) {
    console.error('FALHOU:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
