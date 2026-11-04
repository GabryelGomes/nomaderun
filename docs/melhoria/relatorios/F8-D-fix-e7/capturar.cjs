#!/usr/bin/env node
/**
 * F8-D · última rodada E7 + E6 — capturas "antes" e "depois" no export web do MODO DEMONSTRAÇÃO:
 *  - preenchimentos sólidos ao lado do emblema (avatar do Você, "A semana do time" na galeria de motion, Night Owls);
 *  - folha da zona aberta por link sem rede, depois de abrir o mapa (cópia salva);
 *  - fonte ×1,3 a 360 px (mesma simulação do `e2e-web/adversarial.cjs`): lista o que fica cortado.
 *
 * Uso (em apps/mobile):
 *   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo
 *   NODE_PATH="$(npm root -g)" SAIDA=antes node ../../docs/melhoria/relatorios/F8-D-fix-e7/capturar.cjs /tmp/nomade-demo
 * Saída: `$SAIDA/*.png` e `$SAIDA/relatorio.json` (textos cortados por tela).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const APP = path.join(REPO, 'apps', 'mobile');
const { serve } = require(path.join(APP, 'e2e-web', 'serve.cjs'));

const DIST = path.resolve(process.argv[2] || '/tmp/nomade-demo');
const OUT = path.join(__dirname, process.env.SAIDA || 'depois');
const PORT = Number(process.env.PORT || 8237);
const BASE = `http://127.0.0.1:${PORT}`;
const CLOCK = new Date('2026-10-23T09:00:00-03:00');
const BLANK_STYLE = { version: 8, name: 'vazio', sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#0B0B0D' } }] };

function parkZone() {
  try {
    const { latLngToCell } = require(path.join(APP, 'node_modules', 'h3-js'));
    return latLngToCell(-16.7097, -49.2388, 9);
  } catch {
    return '89a8c0dab3bffff';
  }
}
const ZONE = parkZone();

const SHOTS = [
  { nome: 'voce__cheio', rota: '/perfil', cenario: 'cheio' },
  { nome: 'semana-do-time__owls', rota: '/dev/motion', cenario: 'cheio', passos: ['galeria-motion-time-owls', 'galeria-motion-semana-time'], espera: 2500, depois: 1500 },
  { nome: 'zona__offline-quente', rota: `/zona/${ZONE}`, cenario: 'offline', quente: true },
  { nome: 'zona__offline-frio', rota: `/zona/${ZONE}`, cenario: 'offline' },
];
const BIG = [
  ['cidade', '/cidade', 'primeira-abertura', 2500],
  ['times', '/times', 'primeira-abertura', 1800],
  ['mapa', '/', 'cheio', 1800],
  ['arena', '/arena', 'cheio', 1800],
  ['clube', '/clube', 'cheio', 1800],
  ['voce', '/perfil', 'cheio', 1800],
  ['resumo', '/resumo?id=demo-corrida-1', 'cheio', 1800],
  ['missoes', '/missoes', 'cheio', 1800],
];

async function newCtx(browser, { width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', permissions: ['geolocation'], geolocation: { latitude: -16.7097, longitude: -49.2388 } });
  await ctx.clock.setFixedTime(CLOCK);
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => {
    if (/\/styles\//.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) });
    return r.abort();
  });
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e.message).slice(0, 200)));
  return { ctx, page };
}

/** Igual ao `adversarial.cjs`: aumenta 30% a fonte e a altura de linha de cada texto, uma vez. */
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

/** Igual ao `adversarial.cjs` (sem o limite de 12): texto com corte maior que a caixa, ou fora da tela. */
const clipped = (page) =>
  page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('div[dir="auto"], span')) {
      const st = getComputedStyle(el);
      if (!el.innerText || st.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const cut = (st.overflow === 'hidden' || st.textOverflow === 'ellipsis' || st.webkitLineClamp !== 'none') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2);
      const outside = r.right > innerWidth + 1 || r.left < -1;
      const label = el.closest('[aria-label]')?.getAttribute('aria-label') || '';
      if (cut || outside) out.push({ id: el.closest('[data-testid]')?.getAttribute('data-testid') || '', text: el.innerText.trim().replace(/\s+/g, ' ').slice(0, 48), why: cut ? 'cortado' : 'fora da tela', rotuloCompleto: label.includes(el.innerText.trim().replace(/\s+/g, ' ').slice(0, 24)) });
    }
    return out;
  });

async function go(page, it) {
  if (it.quente) {
    await page.goto(`${BASE}/?cenario=cheio`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="tela-mapa"]', { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(1800);
  }
  await page.goto(`${BASE}${it.rota}${it.rota.includes('?') ? '&' : '?'}cenario=${it.cenario}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid^="tela-"], [data-testid^="zona-"]', { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(it.espera ?? 2200);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  const server = await serve(DIST, PORT);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const report = { capturas: {}, fonte130: {} };
  try {
    for (const it of SHOTS) {
      const { ctx, page } = await newCtx(browser);
      try {
        await go(page, it);
        for (const p of it.passos ?? []) {
          await page.locator(`[data-testid="${p}"]`).first().click({ timeout: 5000 });
          await page.waitForTimeout(700);
        }
        if (it.depois) await page.waitForTimeout(it.depois);
        await page.screenshot({ path: path.join(OUT, `${it.nome}.png`) });
        const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
        report.capturas[it.nome] = { url: page.url().replace(BASE, ''), texto: text.slice(0, 280), erros: page.__errors };
        console.log(`ok ${it.nome}`);
      } catch (e) {
        console.log(`falhou ${it.nome}: ${String(e.message).split('\n')[0]}`);
        report.capturas[it.nome] = { falha: String(e.message).slice(0, 200) };
      }
      await ctx.close();
    }
    for (const [nome, rota, cenario, espera] of BIG) {
      const { ctx, page } = await newCtx(browser, { width: 360, height: 800 });
      await go(page, { rota, cenario, espera });
      await growText(page);
      await page.waitForTimeout(400);
      const list = await clipped(page);
      report.fonte130[nome] = list;
      await page.screenshot({ path: path.join(OUT, `fonte-130__${nome}__360.png`) });
      console.log(`fonte ×1,3 ${nome}: ${list.filter((c) => c.why === 'cortado').length} cortados, ${list.filter((c) => c.why !== 'cortado').length} fora da tela`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(report, null, 2));
  const pngs = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).map((f) => path.join(OUT, f));
  if (pngs.length) spawnSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', ...pngs], { stdio: 'inherit' });
})();
