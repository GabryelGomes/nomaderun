/* E6a (onda 2): primeira abertura no modo demonstração (?cenario=primeira-abertura), com capturas e cronômetro.
   Uso: NODE_PATH=$(npm root -g) node primeira-abertura.cjs <dist> <saida> [--reduzir] */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { serve } = require(process.env.SERVE_CJS);

const [dist, out] = process.argv.slice(2);
const reduce = process.argv.includes('--reduzir');
const PORT = Number(process.env.PORT || 8297);
const BASE = `http://127.0.0.1:${PORT}`;
const BLANK_STYLE = { version: 8, name: 'vazio', sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#0B0B0D' } }] };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  // worker do MapLibre (worktree sem public/)
  const w = path.join(dist, 'maplibre-gl-worker.mjs');
  const src = path.join(__dirname, '..', 'nm-worker.mjs');
  if (!fs.existsSync(w) && fs.existsSync(src)) fs.copyFileSync(src, w);
  const server = await serve(dist, PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: reduce ? 'reduce' : 'no-preference',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    permissions: ['geolocation'],
    geolocation: { latitude: -16.7097, longitude: -49.2388 },
  });
  const external = [];
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => {
    const u = r.request().url();
    external.push(u.slice(0, 100));
    if (/\/styles\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) });
    return r.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const id = (t) => page.locator(`[data-testid="${t}"]`).first();
  const shot = async (n, wait = 700) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(out, `${n}.png`) });
  };
  const marks = [];
  const t0 = Date.now();
  const mark = (n) => marks.push([n, ((Date.now() - t0) / 1000).toFixed(1)]);

  await page.goto(`${BASE}/?cenario=primeira-abertura`);
  await id('tela-boas-vindas').waitFor({ timeout: 60_000 });
  mark('boas-vindas');
  await shot('01-boas-vindas', 1500);
  await id('boas-vindas-comecar').click();
  await id('tela-cadastro').waitFor();
  mark('cadastro');
  await shot('02-cadastro');
  await id('cadastro-email').fill('ana@exemplo.com');
  await id('cadastro-senha').fill('Corrida@2026');
  await id('cadastro-usuario').fill('ana_corre');
  await id('cadastro-nascimento').fill('15/05/2000');
  await id('cadastro-aceite').click();
  await shot('03-cadastro-preenchido', 300);
  await id('cadastro-botao').click();
  await id('onboarding-cidade').waitFor({ timeout: 30_000 });
  mark('cidade-dividida');
  await page.locator('[data-testid="onboarding-cidade-striders"]').first().waitFor({ timeout: 10_000 });
  await shot('04-cidade-dividida', 1200);
  // passa sozinha em até 6 s
  const auto = await id('onboarding-times-striders').waitFor({ timeout: 7_500 }).then(() => true, () => false);
  if (!auto) {
    await id('onboarding-cidade-continuar').click();
    await id('onboarding-times-striders').waitFor({ timeout: 10_000 });
  }
  mark(auto ? 'times (passou sozinha)' : 'times (botão)');
  await shot('05-times', 1200);
  await id('onboarding-times-owls-lider').click();
  await id('onboarding-lider').waitFor();
  await shot('06-lider', 800);
  await id('onboarding-lider-voltar').click();
  await page.waitForTimeout(600);
  await id('onboarding-nao-sei').click();
  await id('onboarding-quiz').waitFor();
  await shot('07-quiz', 600);
  await id('onboarding-quiz-corrida-striders').click();
  await id('onboarding-quiz-fim-striders').click();
  await id('onboarding-quiz-superpoder-owls').click();
  await id('onboarding-quiz-resultado').waitFor();
  await shot('08-quiz-resultado', 600);
  await id('onboarding-quiz-ver').click();
  await page.waitForTimeout(700);
  await shot('09-time-escolhido', 300);
  mark('time escolhido');
  await id('onboarding-entrar-time').click();
  await id('onboarding-confirmacao').waitFor();
  mark('confirmação');
  await shot('10-confirmacao-inundando', 350);
  await shot('11-confirmacao', 1800);
  await id('onboarding-confirmacao-continuar').click();
  await id('onboarding-localizacao-permitir').waitFor({ timeout: 15_000 });
  mark('localização');
  await shot('12-localizacao', 800);
  await id('onboarding-localizacao-permitir').click();
  await id('mapa-status').waitFor({ timeout: 30_000 });
  mark('mapa');
  await id('mapa-missao-boas-vindas').waitFor({ timeout: 10_000 });
  await shot('13-mapa-missao', 2500);
  const seal = await page.locator('[data-testid*="demonstracao"]').count();
  // abas: Você → Atividades; Correr → Nova corrida
  await id('aba-voce').click();
  await id('tela-perfil').waitFor({ timeout: 15_000 });
  await shot('14-voce', 1000);
  await id('voce-atividades').click();
  await id('tela-atividades').waitFor({ timeout: 15_000 });
  await shot('15-voce-atividades', 1000);
  await id('aba-correr').click();
  await id('corrida-comecar').waitFor({ timeout: 15_000 });
  await shot('16-correr-abre-nova-corrida', 1000);
  await page.goto(`${BASE}/atividades`);
  await id('tela-atividades').waitFor({ timeout: 30_000 }).catch(() => {});
  const redirect = page.url();

  fs.writeFileSync(path.join(out, 'relatorio.json'), JSON.stringify({ marcas: marks, selo: seal, erros: errors, externos: external, redirecionamentoAtividades: redirect, reduzirMovimento: reduce }, null, 2));
  console.log(JSON.stringify({ marks, seal, errors, redirect }, null, 2));
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
