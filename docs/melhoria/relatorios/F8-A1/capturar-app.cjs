#!/usr/bin/env node
/**
 * F8 · A1 (E4) — capturas do app de verdade (export web do modo demonstração) com o emblema v2 em contexto:
 * Mapa, zona (normal e sob ataque), Clube (pódio, ranking, feed), crew, Perfil, resumo e a galeria `/dev/arte`,
 * a 390 px, em 1×, 2× e 3× de densidade. Base: `docs/melhoria/F8/ux/auditar-telas.cjs` (mesmo export, mesmo servidor).
 *
 * Uso (em apps/mobile):
 *   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo
 *   NODE_PATH=/opt/node22/lib/node_modules node ../../docs/melhoria/relatorios/F8-A1/capturar-app.cjs /tmp/nomade-demo
 * Saída: docs/melhoria/relatorios/F8-A1/app-<tela>[@2x|@3x].png (pngquant).
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const APP = path.join(REPO, 'apps', 'mobile');
const { serve } = require(path.join(APP, 'e2e-web', 'serve.cjs'));

const DIST = path.resolve(process.argv[2] || '/tmp/nomade-demo');
const OUT = __dirname;
const PORT = Number(process.env.PORT || 8213);
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

/** [nome, rota, cenário, espera ms, escalas] */
const TELAS = [
  ['mapa', '/', 'cheio', 2500, [1, 2, 3]],
  ['mapa-sob-ataque', '/', 'sob-ataque', 7000, [1]],
  ['zona', `/zona/${ZONE}`, 'cheio', 2000, [1, 2, 3]],
  ['zona-sob-ataque', `/zona/${ZONE}`, 'sob-ataque', 7000, [1, 2]],
  ['clube', '/clube', 'cheio', 2000, [1, 2, 3]],
  ['clube-crew', '/clube/crew', 'cheio', 2000, [1]],
  ['perfil', '/perfil', 'cheio', 2000, [1, 2]],
  ['perfil-time', '/perfil/time', 'cheio', 2000, [1]],
  ['resumo', '/resumo?id=demo-corrida-1', 'cheio', 2500, [1]],
  ['galeria-emblemas', '/dev/arte', 'cheio', 2500, [1, 2]],
];

async function newCtx(browser, dsf) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: dsf,
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    permissions: ['geolocation'],
    geolocation: { latitude: -16.7097, longitude: -49.2388 },
  });
  await ctx.addInitScript((style) => {
    // sem rede de tiles: estilo vazio do mapa, e relógio fixo
    window.__NOMADE_MAP_STYLE__ = style;
  }, BLANK_STYLE);
  await ctx.route(/tiles|maptiler|openfreemap|mapbox|basemaps/i, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) }));
  const page = await ctx.newPage();
  await page.clock.install({ time: CLOCK });
  return { ctx, page };
}

async function scrollTo(page, text) {
  // rola a galeria até a seção pedida
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('div,span')].find((e) => e.textContent && e.textContent.trim().toUpperCase().startsWith(t.toUpperCase()) && e.children.length === 0);
    if (el) el.scrollIntoView({ block: 'start' });
  }, text);
  await page.waitForTimeout(400);
}

function compress(file) {
  try {
    execFileSync('pngquant', ['--quality=80-98', '--force', '--ext', '.png', '--skip-if-larger', file]);
  } catch {
    // sem pngquant
  }
}

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const server = await serve(DIST, PORT);
  const only = (process.argv.find((a) => a.startsWith('--so=')) || '').slice(5);
  try {
    for (const [nome, rota, cenario, espera, escalas] of TELAS) {
      if (only && !nome.includes(only)) continue;
      for (const dsf of escalas) {
        const { ctx, page } = await newCtx(browser, dsf);
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
          await page.goto(`${BASE}${rota}${rota.includes('?') ? '&' : '?'}cenario=${cenario}`, { waitUntil: 'load' });
          await page.waitForSelector('[data-testid^="tela-"], [data-testid="dev-arte"]', { timeout: 12_000 }).catch(() => undefined);
          await page.waitForTimeout(espera);
          if (nome === 'galeria-emblemas') await scrollTo(page, 'Emblemas v2 · mini');
          const file = path.join(OUT, `app-${nome}${dsf > 1 ? `@${dsf}x` : ''}.png`);
          await page.screenshot({ path: file });
          compress(file);
          console.log(`ok ${path.basename(file)}${errors.length ? ` · erros: ${errors.length}` : ''}`);
        } catch (e) {
          console.error(`falhou ${nome}@${dsf}x: ${e.message}`);
        }
        await ctx.close();
      }
    }
  } finally {
    server.close();
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
