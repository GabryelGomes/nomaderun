#!/usr/bin/env node
/**
 * F8 onda D (E10) — testes adversariais no export web do MODO DEMONSTRAÇÃO, sem servidor e sem rede:
 *  1. rotas com parâmetro malformado (nunca tela em branco, nunca "Unmatched Route", nunca erro de página);
 *  2. sem conta, nenhuma rota do app abre (guarda da D-91), nem com voltar/avançar no meio da primeira abertura;
 *  3. girar a tela (360 → 430 → 360) sem rolagem horizontal;
 *  4. fonte grande (texto ×1,3, como `fontScale` 1,3): texto cortado ou página mais larga que a tela;
 *  5. duas abas abertas ao mesmo tempo (a segunda não quebra a primeira).
 * Uso (em apps/mobile): NODE_PATH="$(npm root -g)" node e2e-web/adversarial.cjs /tmp/nomade-demo
 * Saída: lista "ok/NÃO OK" e `adversarial.json` em OUT_DIR (padrão: pasta temporária), com capturas da fonte grande.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { serve } = require('./serve.cjs');

const DIST = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'nomade-demo'));
const PORT = Number(process.env.PORT || 8231);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'nomade-adversarial-'));
const CLOCK = new Date('2026-10-23T09:00:00-03:00');
const BLANK_STYLE = { version: 8, name: 'vazio', sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#0B0B0D' } }] };

const results = [];
function check(cond, label, extra) {
  results.push({ ok: !!cond, label, extra: cond ? undefined : extra });
  console.log(`  ${cond ? 'ok' : 'NÃO OK'} - ${label}${!cond && extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 400) : ''}`);
}

async function newPage(browser, { width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', permissions: ['geolocation'], geolocation: { latitude: -16.7097, longitude: -49.2388 } });
  await ctx.clock.setFixedTime(CLOCK);
  const server = [];
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => {
    const u = r.request().url();
    if (/supabase|\/(rest|auth|functions|storage|realtime)\/v1\//.test(u)) server.push(u);
    if (/\/styles\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) });
    return r.abort();
  });
  const page = await ctx.newPage();
  page.__errors = [];
  page.__server = server;
  page.on('pageerror', (e) => page.__errors.push(String(e.message).slice(0, 200)));
  return { ctx, page };
}

const screens = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid^="tela-"]')].map((e) => e.getAttribute('data-testid')));

async function go(page, rota, cenario = 'cheio', ms = 1800) {
  await page.goto(`${BASE}${rota}${rota.includes('?') ? '&' : '?'}cenario=${cenario}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid^="tela-"]', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(ms);
}

/** Página mais larga que a tela (rolagem horizontal) e textos cortados (texto maior que a caixa, com corte). */
const layoutProblems = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const out = { overflowX: Math.max(doc.scrollWidth, document.body.scrollWidth) - innerWidth, clipped: [] };
    for (const el of document.querySelectorAll('div[dir="auto"], span')) {
      const st = getComputedStyle(el);
      if (!el.innerText || st.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const cut = (st.overflow === 'hidden' || st.textOverflow === 'ellipsis' || st.webkitLineClamp !== 'none') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2);
      const outside = r.right > innerWidth + 1 || r.left < -1;
      if (cut || outside) out.clipped.push({ id: el.closest('[data-testid]')?.getAttribute('data-testid') || '', text: el.innerText.trim().replace(/\s+/g, ' ').slice(0, 40), why: cut ? 'cortado' : 'fora da tela' });
    }
    out.clipped = out.clipped.slice(0, 12);
    return out;
  });

/** Simula `fontScale` 1,3: aumenta 30% a fonte (e a altura de linha) de cada texto, uma vez. */
const growText = (page, k = 1.3) =>
  page.evaluate((f) => {
    for (const el of document.querySelectorAll('div[dir="auto"], span, input, textarea')) {
      if (el.dataset.__grown) continue;
      const st = getComputedStyle(el);
      const fs = parseFloat(st.fontSize);
      if (!fs) continue;
      el.style.fontSize = `${fs * f}px`;
      const lh = parseFloat(st.lineHeight);
      if (lh) el.style.lineHeight = `${lh * f}px`;
      el.dataset.__grown = '1';
    }
  }, k);

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const server = await serve(DIST, PORT);
  const report = {};
  try {
    // 1. Parâmetros malformados
    console.log('1. rotas com parâmetro malformado');
    const bad = ['/zona/xyz', '/zona/%E0%A4%A', '/zona/89a8c0dab3bffff%27%3B--', '/resumo', '/resumo?id=nao-existe', '/resumo?id=%3Cscript%3E', '/compartilhar/nao-existe', '/compartilhar/convite/%3Cimg%20src%3Dx%3E', '/compartilhar/convite/', '/moderacao/qualquer', '/moderacao', '/perfil/nao-existe', '/clube/crew?codigo=AAAA', '/excluir-conta?x=1', '/dev/nao-existe'];
    for (const rota of bad) {
      const { ctx, page } = await newPage(browser);
      await go(page, rota);
      const s = await screens(page);
      const body = await page.locator('body').innerText();
      const ids = await page.evaluate(() => document.querySelectorAll('[data-testid]').length);
      const jargon = /Unmatched|This screen doesn't exist|Something went wrong|Par[âa]metro|H3|hexadecima|PGRST|schema|undefined|\bnull\b|NaN/i;
      check(ids > 1 && body.trim().length > 20 && !jargon.test(body) && page.__errors.length === 0, `${rota} → ${s.join(',') || 'sem tela-*'} (${page.url().replace(BASE, '')})`, { errors: page.__errors, body: body.slice(0, 160) });
      await ctx.close();
    }

    // 1b. Resumo: zonas sem número com o mesmo nome viram 1 chip com a contagem (nunca 2 chips iguais)
    {
      const { ctx, page } = await newPage(browser);
      await go(page, '/resumo?id=demo-corrida-1', 'cheio', 2500);
      const chips = await page.locator('[data-testid="resumo-conquistas-lista"] [aria-label]').evaluateAll((els) => els.map((e) => e.innerText.trim()));
      check(chips.length > 0 && new Set(chips).size === chips.length, `Resumo: chips de conquista sem repetição (${chips.join(' | ')})`, chips);
      await ctx.close();
    }

    // 2. Guarda de rotas sem conta (D-91) e voltar/avançar no meio da primeira abertura
    console.log('2. sem conta, nenhuma tela do app');
    for (const rota of ['/', '/perfil', '/arena', '/clube', '/corrida', '/resumo?id=demo-corrida-1', '/missoes', '/recompensas', '/perfil/conta', '/moderacao', '/onboarding', '/correr']) {
      const { ctx, page } = await newPage(browser);
      await go(page, rota, 'primeira-abertura');
      const s = await screens(page);
      const inApp = s.some((t) => /tela-(mapa|perfil|arena|clube|nova-corrida|resumo|missoes|recompensas|conta|moderacao|onboarding)$/.test(t));
      check(!inApp && s.length > 0, `sem conta: ${rota} → ${s.join(',')}`, s);
      await ctx.close();
    }
    {
      const { ctx, page } = await newPage(browser);
      await go(page, '/', 'primeira-abertura');
      await page.locator('[data-testid="boas-vindas-comecar"]').click();
      await page.locator('[data-testid="onboarding-cidade-continuar"]').waitFor({ timeout: 10_000 });
      await page.locator('[data-testid="onboarding-cidade-continuar"]').click();
      await page.locator('[data-testid="onboarding-times-owls"]').click();
      await page.goBack();
      await page.waitForTimeout(800);
      const back1 = await screens(page);
      await page.goForward();
      await page.waitForTimeout(800);
      const fwd = await screens(page);
      check(back1.length > 0 && fwd.length > 0 && page.__errors.length === 0, `voltar/avançar no meio da escolha: ${back1.join(',')} → ${fwd.join(',')}`, page.__errors);
      if (fwd.includes('tela-onboarding-times')) {
        await page.locator('[data-testid="onboarding-times-owls"]').click();
        await page.locator('[data-testid="onboarding-entrar-time"]').click();
        await page.locator('[data-testid="onboarding-confirmacao-continuar"]').waitFor({ timeout: 15_000 });
        await page.goBack();
        await page.waitForTimeout(800);
        const midCeremony = await screens(page);
        await page.goto(`${BASE}/perfil?cenario=primeira-abertura`);
        await page.waitForTimeout(1500);
        const deep = await screens(page);
        check(!deep.includes('tela-perfil'), `voltar no meio da cerimônia (${midCeremony.join(',')}) e pular para /perfil sem conta → ${deep.join(',')}`, deep);
        await page.goto(`${BASE}/cadastro?cenario=primeira-abertura`);
        await page.waitForTimeout(1500);
        const cad = await page.locator('[data-testid="tela-cadastro"]').innerText().catch(() => '');
        check(/Night\s+Owls/.test(cad), 'o time escolhido (Night Owls) sobrevive a recarregar a página até o cadastro', cad.slice(0, 120));
      }
      await ctx.close();
    }

    // 3. Girar a tela
    console.log('3. girar a tela (360 → 430 → 360)');
    for (const rota of ['/', '/arena', '/perfil', '/clube', '/resumo?id=demo-corrida-1']) {
      const { ctx, page } = await newPage(browser, { width: 360, height: 800 });
      await go(page, rota);
      await page.setViewportSize({ width: 430, height: 932 });
      await page.waitForTimeout(600);
      const wide = await layoutProblems(page);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.waitForTimeout(600);
      const narrow = await layoutProblems(page);
      check(wide.overflowX <= 0 && narrow.overflowX <= 0 && page.__errors.length === 0, `${rota}: sem rolagem horizontal depois de girar (430: ${wide.overflowX}, 360: ${narrow.overflowX})`, page.__errors);
      await ctx.close();
    }
    {
      const { ctx, page } = await newPage(browser, { width: 360, height: 800 });
      await go(page, '/times', 'primeira-abertura');
      await page.setViewportSize({ width: 430, height: 932 });
      await page.waitForTimeout(800);
      const l = await layoutProblems(page);
      check(l.overflowX <= 0, `escolha do time: sem rolagem horizontal depois de girar (${l.overflowX})`, l);
      await ctx.close();
    }

    // 4. Fonte grande (×1,3) nas telas de maior uso
    console.log('4. fonte grande (×1,3) a 360 px');
    report.fonteGrande = {};
    const big = [['boas-vindas', '/boas-vindas', 'primeira-abertura'], ['cidade', '/cidade', 'primeira-abertura'], ['times', '/times', 'primeira-abertura'], ['cadastro', '/cadastro', 'primeira-abertura'], ['entrar', '/entrar', 'primeira-abertura'], ['mapa', '/', 'cheio'], ['arena', '/arena', 'cheio'], ['clube', '/clube', 'cheio'], ['voce', '/perfil', 'cheio'], ['resumo', '/resumo?id=demo-corrida-1', 'cheio'], ['missoes', '/missoes', 'cheio'], ['recompensas', '/recompensas', 'cheio'], ['nova-corrida', '/corrida', 'cheio'], ['ajustes', '/perfil/ajustes', 'cheio']];
    for (const [nome, rota, cen] of big) {
      const { ctx, page } = await newPage(browser, { width: 360, height: 800 });
      await go(page, rota, cen, nome === 'cidade' ? 2500 : 1800);
      await growText(page);
      await page.waitForTimeout(400);
      const l = await layoutProblems(page);
      report.fonteGrande[nome] = l;
      await page.screenshot({ path: path.join(OUT, `fonte-130__${nome}__360.png`) });
      check(l.overflowX <= 0 && l.clipped.length === 0, `fonte ×1,3 em ${nome}: sem texto cortado (${l.clipped.length}) nem rolagem horizontal (${l.overflowX})`, l.clipped);
      await ctx.close();
    }

    // 5. Duas abas abertas
    console.log('5. duas abas abertas');
    {
      const { ctx, page } = await newPage(browser);
      await go(page, '/', 'cheio');
      const p2 = await ctx.newPage();
      p2.__errors = [];
      p2.on('pageerror', (e) => p2.__errors.push(String(e.message)));
      await p2.goto(`${BASE}/perfil?cenario=cheio`);
      await p2.waitForSelector('[data-testid="tela-perfil"]', { timeout: 10_000 }).catch(() => undefined);
      await page.bringToFront();
      await page.locator('[data-testid="aba-arena"]').click();
      await page.waitForTimeout(1200);
      const s1 = await screens(page);
      const s2 = await screens(p2);
      check(s1.includes('tela-arena') && s2.includes('tela-perfil') && page.__errors.length + p2.__errors.length === 0, `duas abas: ${s1.join(',')} | ${s2.join(',')}`, [...page.__errors, ...p2.__errors]);
      check(page.__server.length === 0, 'nenhum pedido ao Supabase', page.__server);
      await ctx.close();
    }
  } finally {
    server.close();
    await browser.close();
  }
  const bad = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, 'adversarial.json'), JSON.stringify({ geradoEm: new Date().toISOString(), ok: results.length - bad.length, total: results.length, falhas: bad, ...report }, null, 2));
  console.log(`\n${results.length - bad.length}/${results.length} ok · ${OUT}`);
  if (bad.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
