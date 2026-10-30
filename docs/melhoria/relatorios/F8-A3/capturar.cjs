#!/usr/bin/env node
/**
 * F8-A3 (E6) — capturas "depois" das telas que a frente A3 tocou, a 390 px, no export web do MODO DEMONSTRAÇÃO, com
 * os mesmos nomes das capturas da auditoria (`docs/melhoria/F8/ux/capturas/`, copiadas em `antes/`).
 *
 * Uso (em apps/mobile):
 *   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo
 *   NODE_PATH="$(npm root -g)" node ../../docs/melhoria/relatorios/F8-A3/capturar.cjs /tmp/nomade-demo
 * Saída: `depois/*.png` (pngquant 85-98). As da corrida e do Resumo saem do `e2e-web/demo-mode-flow.cjs`
 * (OUT_DIR=…/depois/fluxo).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const APP = path.join(REPO, 'apps', 'mobile');
const { serve } = require(path.join(APP, 'e2e-web', 'serve.cjs'));

const DIST = path.resolve(process.argv[2] || '/tmp/nomade-demo');
const OUT = path.join(__dirname, 'depois');
const PORT = Number(process.env.PORT || 8231);
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

/** nome, rota, cenário, quente (abre o "cheio" antes, para o perfil ficar salvo), passos (testIDs a tocar), rolar (px). */
const SHOTS = [
  { nome: 'mapa__cheio', rota: '/', cenario: 'cheio' },
  { nome: 'mapa__sob-ataque', rota: '/', cenario: 'sob-ataque', espera: 7000 },
  { nome: 'zona__sob-ataque', rota: `/zona/${ZONE}`, cenario: 'sob-ataque', espera: 7000 },
  { nome: 'nova-corrida__cheio', rota: '/corrida', cenario: 'cheio' },
  { nome: 'nova-corrida__cheio--2', rota: '/corrida', cenario: 'cheio', rolar: 600 },
  { nome: 'correr-link__cheio', rota: '/correr', cenario: 'cheio' },
  { nome: 'rota-inexistente__cheio', rota: '/rota-que-nao-existe', cenario: 'cheio' },
  { nome: 'voce__carregando', rota: '/perfil', cenario: 'lento', espera: 700, semTela: true },
  { nome: 'voce-atividades__carregando', rota: '/perfil/atividades', cenario: 'lento', espera: 700, semTela: true },
  { nome: 'voce__offline-quente', rota: '/perfil', cenario: 'offline', quente: true },
  { nome: 'voce__erro-quente', rota: '/perfil', cenario: 'erro', quente: true },
  { nome: 'voce-atividades__offline-quente', rota: '/perfil/atividades', cenario: 'offline', quente: true },
  { nome: 'mapa__erro-quente', rota: '/', cenario: 'erro', quente: true },
  { nome: 'arena__erro-quente', rota: '/arena', cenario: 'erro', quente: true },
  { nome: 'recompensas__offline-quente', rota: '/recompensas', cenario: 'offline', quente: true, espera: 4000 },
  { nome: 'missoes__offline-quente', rota: '/missoes', cenario: 'offline', quente: true },
  { nome: 'clube__offline-quente', rota: '/clube', cenario: 'offline', quente: true },
  { nome: 'indisponivel__erro', rota: '/', cenario: 'erro' },
  { nome: 'voce-ajustes__cheio', rota: '/perfil/ajustes', cenario: 'cheio', rolar: 380 },
  { nome: 'voce-conta__sair', rota: '/perfil/conta', cenario: 'cheio', passos: ['conta-sair'] },
];

async function newCtx(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    permissions: ['geolocation'],
    geolocation: { latitude: -16.7097, longitude: -49.2388 },
  });
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

async function rolar(page, y) {
  await page.evaluate((dy) => {
    let best = null;
    document.querySelectorAll('div').forEach((el) => {
      const st = getComputedStyle(el);
      if (!/(auto|scroll)/.test(st.overflowY) || el.scrollHeight - el.clientHeight < 60) return;
      const r = el.getBoundingClientRect();
      if (!best || r.width * r.height > best.a) best = { el, a: r.width * r.height };
    });
    if (best) best.el.scrollTop = dy;
  }, y);
  await page.waitForTimeout(500);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  const server = await serve(DIST, PORT);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const report = {};
  try {
    for (const it of SHOTS) {
      const { ctx, page } = await newCtx(browser);
      try {
        if (it.quente) {
          await page.goto(`${BASE}/?cenario=cheio`, { waitUntil: 'load' });
          await page.waitForSelector('[data-testid="tela-mapa"]', { timeout: 20_000 }).catch(() => undefined);
          await page.waitForTimeout(1500);
        }
        await page.goto(`${BASE}${it.rota}${it.rota.includes('?') ? '&' : '?'}cenario=${it.cenario}`, { waitUntil: 'load' });
        if (!it.semTela) await page.waitForSelector('[data-testid^="tela-"]', { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(it.espera ?? 2200);
        for (const p of it.passos ?? []) {
          await page.locator(`[data-testid="${p}"]`).first().click();
          await page.waitForTimeout(900);
        }
        if (it.rolar) await rolar(page, it.rolar);
        const file = path.join(OUT, `${it.nome}.png`);
        await page.screenshot({ path: file });
        const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
        report[it.nome] = { url: page.url().replace(BASE, ''), palavras: text.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length, erros: page.__errors };
        console.log(`ok ${it.nome}`);
      } catch (e) {
        console.log(`falhou ${it.nome}: ${String(e.message).split('\n')[0]}`);
        report[it.nome] = { falha: String(e.message).slice(0, 200) };
      }
      await ctx.close();
    }
    // Carregamento da web (UX-37): o HTML estático antes do JavaScript (o script do app fica parado).
    const { ctx, page } = await newCtx(browser);
    await page.route(/\/_expo\/static\/js\//, () => undefined);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'mapa__carregando.png') });
    report['mapa__carregando'] = { fundo: await page.evaluate(() => getComputedStyle(document.body).backgroundColor) };
    console.log('ok mapa__carregando', report['mapa__carregando'].fundo);
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(report, null, 2));
  const pngs = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).map((f) => path.join(OUT, f));
  if (pngs.length) spawnSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', ...pngs], { stdio: 'inherit' });
})();
