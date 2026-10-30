#!/usr/bin/env node
/**
 * F8-B3 (E6+E8) — capturas "antes" e "depois" das telas que a frente B3 tocou, a 390 px, no export web do MODO DEMONSTRAÇÃO, com
 * os mesmos nomes das capturas da auditoria (`docs/melhoria/F8/ux/capturas/`, copiadas em `antes/`).
 *
 * Uso (em apps/mobile):
 *   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo
 *   NODE_PATH="$(npm root -g)" SAIDA=antes node ../../docs/melhoria/relatorios/F8-B3/capturar.cjs /tmp/nomade-demo
 * Saída: `$SAIDA/*.png` (antes|depois, pngquant 85-98). Rotas que só existem depois (Ajustes em 4 telas) falham no
 * "antes" e ficam registradas em `relatorio.json`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const APP = path.join(REPO, 'apps', 'mobile');
const { serve } = require(path.join(APP, 'e2e-web', 'serve.cjs'));

const DIST = path.resolve(process.argv[2] || '/tmp/nomade-demo');
const OUT = path.join(__dirname, process.env.SAIDA || 'depois');
const PORT = Number(process.env.PORT || 8233);
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
const ONLY = (process.argv.find((a) => a.startsWith('--so=')) || '').slice(5).split(',').filter(Boolean);
const ALL_SHOTS = [
  { nome: 'mapa__cheio', rota: '/', cenario: 'cheio' },
  { nome: 'arena__cheio', rota: '/arena', cenario: 'cheio' },
  { nome: 'arena__cheio--2', rota: '/arena', cenario: 'cheio', rolar: 700 },
  { nome: 'arena-liga__cheio', rota: '/arena', cenario: 'cheio', rolar: 1400, passos: ['arena-liga'] },
  { nome: 'arena-chefao__toque', rota: '/arena', cenario: 'cheio', passos: ['arena-raid-correr'] },
  { nome: 'clube__cheio', rota: '/clube', cenario: 'cheio' },
  { nome: 'clube__cheio--2', rota: '/clube', cenario: 'cheio', rolar: 700 },
  { nome: 'clube-ranking__cheio', rota: '/clube', cenario: 'cheio', passos: ['clube-secao-ranking'] },
  { nome: 'clube__vazio', rota: '/clube', cenario: 'vazio' },
  { nome: 'clube-crew__cheio', rota: '/clube/crew', cenario: 'cheio' },
  { nome: 'clube-crew__cheio--2', rota: '/clube/crew', cenario: 'cheio', rolar: 700 },
  { nome: 'compartilhar-feed__cheio', rota: '/compartilhar/feed', cenario: 'cheio' },
  { nome: 'voce__cheio', rota: '/perfil', cenario: 'cheio' },
  { nome: 'voce-atividades__cheio', rota: '/perfil/atividades', cenario: 'cheio' },
  { nome: 'voce-atividades__cheio--2', rota: '/perfil/atividades', cenario: 'cheio', rolar: 700 },
  { nome: 'voce-atividades__vazio', rota: '/perfil/atividades', cenario: 'vazio' },
  { nome: 'voce-ajustes__cheio', rota: '/perfil/ajustes', cenario: 'cheio' },
  { nome: 'voce-ajustes__cheio--2', rota: '/perfil/ajustes', cenario: 'cheio', rolar: 700 },
  { nome: 'voce-ajustes__cheio--3', rota: '/perfil/ajustes', cenario: 'cheio', rolar: 1400 },
  { nome: 'ajustes-seguranca__cheio', rota: '/perfil/ajustes/seguranca', cenario: 'cheio' },
  { nome: 'ajustes-privacidade__cheio', rota: '/perfil/ajustes/privacidade', cenario: 'cheio' },
  { nome: 'ajustes-privacidade__cheio--2', rota: '/perfil/ajustes/privacidade', cenario: 'cheio', rolar: 700 },
  { nome: 'ajustes-lembretes__cheio', rota: '/perfil/ajustes/lembretes', cenario: 'cheio' },
  { nome: 'ajustes-lembretes__cheio--2', rota: '/perfil/ajustes/lembretes', cenario: 'cheio', rolar: 700 },
  { nome: 'voce-conta__cheio', rota: '/perfil/conta', cenario: 'cheio' },
  { nome: 'voce-conta__cheio--2', rota: '/perfil/conta', cenario: 'cheio', rolar: 700 },
  { nome: 'voce-editar__cheio--2', rota: '/perfil/editar', cenario: 'cheio', rolar: 700 },
  { nome: 'contatos-seguranca__cheio', rota: '/contatos-seguranca', cenario: 'cheio' },
  { nome: 'zonas-privacidade__cheio', rota: '/zonas-privacidade', cenario: 'cheio' },
  { nome: 'compartilhar__cheio', rota: '/compartilhar/demo-corrida-1', cenario: 'cheio' },
  { nome: 'compartilhar-semana__cheio', rota: '/compartilhar/semana', cenario: 'cheio' },
  { nome: 'compartilhar-semana__vazio', rota: '/compartilhar/semana', cenario: 'vazio' },
  { nome: 'resumo__cheio', rota: '/resumo?id=demo-corrida-1', cenario: 'cheio' },
  { nome: 'moderacao__moderador', rota: '/moderacao', cenario: 'moderador' },
  { nome: 'clube__offline-quente', rota: '/clube', cenario: 'offline', quente: true },
  { nome: 'clube-crew__offline-quente', rota: '/clube/crew', cenario: 'offline', quente: true },
  { nome: 'compartilhar-feed__offline-quente', rota: '/compartilhar/feed', cenario: 'offline', quente: true },
];
const SHOTS = ONLY.length ? ALL_SHOTS.filter((s) => ONLY.includes(s.nome)) : ALL_SHOTS;

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
          await page.locator(`[data-testid="${p}"]`).first().click({ timeout: 4000 });
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
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(report, null, 2));
  const pngs = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).map((f) => path.join(OUT, f));
  if (pngs.length) spawnSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', ...pngs], { stdio: 'inherit' });
})();
