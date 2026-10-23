#!/usr/bin/env node
/**
 * T7.1.19 (E10) — capturas automáticas: rota × estado × resolução, no export web do MODO DEMONSTRAÇÃO
 * (D-77), sem servidor e sem rede. Cada estado é um roteiro do servidor de demonstração (`?cenario=`).
 *
 * Uso (em apps/mobile):
 *   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo   # --clear é obrigatório
 *   NODE_PATH=$(npm root -g) node e2e-web/capturas.cjs /tmp/nomade-demo antes-cheio
 *   (ou: node e2e-web/capturas.cjs --build /tmp/nomade-demo antes-cheio, que faz o export com --clear)
 * Filtros: --rotas=inicio,arena  --estados=cheio,vazio  --larguras=390  --sem-pngquant
 *
 * Saída: docs/melhoria/capturas/<pasta>/<nome>__<estado>__<largura>.png (comprimidas com
 * `pngquant --quality=85-98`) e `relatorio.json` (FCP, telas, palavras visíveis, alvos < 44 px, interativos
 * sem nome, erros da página e pedidos de rede para fora do servidor local, que devem ser zero).
 * Relógio fixo (2026-10-23 09:00, Brasília), "Reduzir movimento" ligado e mapa-base externo bloqueado:
 * capturas repetíveis. Toda captura sai com o selo "Demonstração" (do app, quando existir; senão, do script).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { serve } = require('./serve.cjs');

const APP = path.resolve(__dirname, '..');
const REPO = path.resolve(APP, '..', '..');
const SIZES = { 360: { w: 360, h: 800 }, 390: { w: 390, h: 844 }, 430: { w: 430, h: 932 } };
const CLOCK = new Date('2026-10-23T09:00:00-03:00');
const PORT = Number(process.env.PORT || 8193);
/** Estilo de mapa sem nada externo: só o fundo escuro do app. */
const BLANK_STYLE = { version: 8, name: 'demonstracao-sem-mapa-base', sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#0B0B0D' } }] };

/** Zona do Parque Flamboyant (H3 res. 9), a mesma de `zoneOf(DEMO_CENTER)` do app. */
function parkZone() {
  try {
    const { latLngToCell } = require(path.join(APP, 'node_modules', 'h3-js'));
    return latLngToCell(-16.7097, -49.2388, 9);
  } catch {
    return '89a8c0dab3bffff';
  }
}

const ZONE = parkZone();
const LOGGED = [
  ['inicio', '/'],
  ['arena', '/arena'],
  ['atividades', '/atividades'],
  ['clube', '/clube'],
  ['clube-crew', '/clube/crew'],
  ['perfil', '/perfil'],
  ['perfil-editar', '/perfil/editar'],
  ['perfil-conta', '/perfil/conta'],
  ['perfil-time', '/perfil/time'],
  ['notificacoes', '/notificacoes'],
  ['contatos-seguranca', '/contatos-seguranca'],
  ['zonas-privacidade', '/zonas-privacidade'],
  ['corrida', '/corrida'],
  ['resumo', '/resumo?id=demo-corrida-1'],
  ['zona-parque', `/zona/${ZONE}`],
  ['termos', '/termos'],
  ['privacidade', '/privacidade'],
];

/** Matriz rota × estado (docs/melhoria/F1/10-qualidade.md §3.2), no que as telas atuais alcançam. */
const MATRIX = [
  ...LOGGED.map(([nome, rota]) => ({ nome, rota, estado: 'cheio' })),
  ...['inicio', 'arena', 'atividades', 'clube', 'perfil', 'notificacoes', 'contatos-seguranca', 'zonas-privacidade'].map((nome) => ({ nome, rota: LOGGED.find((r) => r[0] === nome)[1], estado: 'vazio' })),
  ...['inicio', 'atividades', 'notificacoes'].map((nome) => ({ nome, rota: LOGGED.find((r) => r[0] === nome)[1], estado: 'carregando', cenario: 'lento', espera: 700, semTela: true })),
  ...['inicio', 'atividades', 'notificacoes'].map((nome) => ({ nome, rota: LOGGED.find((r) => r[0] === nome)[1], estado: 'erro' })),
  ...['inicio', 'atividades'].map((nome) => ({ nome, rota: LOGGED.find((r) => r[0] === nome)[1], estado: 'offline' })),
  { nome: 'inicio', rota: '/', estado: 'sob-ataque', espera: 7000 },
  { nome: 'notificacoes', rota: '/notificacoes', estado: 'sob-ataque', espera: 7000 },
  { nome: 'onboarding', rota: '/onboarding', estado: 'sem-time' },
  { nome: 'entrar', rota: '/entrar', estado: 'primeira-abertura' },
  { nome: 'cadastro', rota: '/cadastro', estado: 'primeira-abertura' },
  { nome: 'recuperar-senha', rota: '/recuperar-senha', estado: 'primeira-abertura' },
  { nome: 'moderacao', rota: '/moderacao', estado: 'moderador' },
  { nome: 'moderacao-detalhe', rota: '/moderacao/demo-revisao-1', estado: 'moderador' },
];

function parseArgs(argv) {
  const opts = { build: false, pngquant: true, rotas: null, estados: null, larguras: [360, 390, 430] };
  const pos = [];
  for (const a of argv) {
    if (a === '--build') opts.build = true;
    else if (a === '--sem-pngquant') opts.pngquant = false;
    else if (a.startsWith('--rotas=')) opts.rotas = a.slice(8).split(',');
    else if (a.startsWith('--estados=')) opts.estados = a.slice(10).split(',');
    else if (a.startsWith('--larguras=')) opts.larguras = a.slice(11).split(',').map(Number);
    else pos.push(a);
  }
  if (pos.length < 2) {
    console.error('uso: node e2e-web/capturas.cjs [--build] <pasta-do-export> <pasta-de-saida> [--rotas=..] [--estados=..] [--larguras=..]');
    process.exit(2);
  }
  opts.dist = path.resolve(pos[0]);
  opts.out = path.join(REPO, 'docs', 'melhoria', 'capturas', pos[1]);
  return opts;
}

/**
 * O worker do MapLibre vem de `public/` (o `postinstall` copia). Numa worktree sem `npm install` a pasta não
 * existe e o mapa não desenha nada: o script põe o worker no export a partir do node_modules.
 */
function ensureMapWorker(dist) {
  const dest = path.join(dist, 'maplibre-gl-worker.mjs');
  if (fs.existsSync(dest)) return;
  const src = path.join(APP, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('worker do MapLibre copiado para o export (faltava public/maplibre-gl-worker.mjs)');
  }
}

function exportDemo(dist) {
  spawnSync('node', ['scripts/copy-maplibre-worker.js'], { cwd: APP, stdio: 'inherit' });
  console.log(`export web do modo demonstração em ${dist} (com --clear)…`);
  const r = spawnSync('npx', ['expo', 'export', '-p', 'web', '--clear', '--output-dir', dist], {
    cwd: APP,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_DEMO: '1', EXPO_OFFLINE: '1', CI: '1' },
  });
  if (r.status !== 0) throw new Error('o export web falhou');
}

/** O cache do Metro ignora mudança de EXPO_PUBLIC_* (linha de base da E10): confere que o export é o da demonstração. */
function assertDemoExport(dist) {
  const dir = path.join(dist, '_expo', 'static', 'js', 'web');
  const entry = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => f.startsWith('entry-')) : null;
  if (!entry) throw new Error(`export web não encontrado em ${dist}`);
  if (!fs.readFileSync(path.join(dir, entry), 'utf8').includes('demonstracao@nomaderun.invalid')) {
    throw new Error('este export não está no modo demonstração: refaça com EXPO_PUBLIC_DEMO=1 e --clear');
  }
}

/** Mede no DOM do react-native-web: interativos < 44×44, sem nome acessível e palavras visíveis. */
async function audit(page) {
  return page.evaluate(() => {
    const out = { interactive: 0, small: [], unlabeled: [], words: 0 };
    const seen = new Set();
    for (const el of document.querySelectorAll('[role="button"],[role="link"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],button,a[href],input,textarea,[tabindex="0"]')) {
      if (seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || st.display === 'none') continue;
      out.interactive++;
      const name = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || '').trim().replace(/\s+/g, ' ');
      const id = el.getAttribute('data-testid') || el.id || el.tagName.toLowerCase();
      if (r.width < 44 || r.height < 44) out.small.push({ id, w: Math.round(r.width), h: Math.round(r.height) });
      if (!name) out.unlabeled.push(id);
    }
    out.words = (document.body.innerText || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    return out;
  });
}

/** Selo "Demonstração" na captura, se a tela ainda não tiver o do app (DemoBadge da E6, onda 2). */
async function stamp(page) {
  await page.evaluate(() => {
    if (document.querySelector('[data-testid*="demonstracao"],[data-testid*="demo-badge"]')) return;
    const s = document.createElement('div');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = 'Demonstração';
    Object.assign(s.style, {
      position: 'fixed', top: '6px', right: '6px', zIndex: '2147483647', pointerEvents: 'none', padding: '3px 8px',
      borderRadius: '999px', background: 'rgba(7,7,8,0.82)', color: '#FFB27A', border: '1px solid #FF6A13',
      font: '600 11px/1.2 system-ui, sans-serif', letterSpacing: '0.02em',
    });
    document.body.appendChild(s);
  });
}

async function shoot(browser, base, item, width, out, report) {
  const size = SIZES[width];
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  // FCP medido com o `performance` verdadeiro (o relógio falso do Playwright esconde as entradas de pintura).
  await ctx.addInitScript(() => {
    window.__fcp = null;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__fcp = Math.round(e.startTime);
      }).observe({ type: 'paint', buffered: true });
    } catch {
      // navegador sem PerformanceObserver de pintura
    }
  });
  await ctx.clock.setFixedTime(CLOCK);
  const external = [];
  const server = [];
  await ctx.route((u) => !u.toString().startsWith(base), (r) => {
    const u = r.request().url();
    // Nada pode ir a um Supabase: o modo demonstração não usa rede.
    if (/supabase|\/(rest|auth|functions|storage|realtime)\/v1\//.test(u)) server.push(u.slice(0, 120));
    else external.push(u.slice(0, 120));
    // Mapa-base: estilo vazio (fundo liso), para as regiões aparecerem sem internet e sempre iguais.
    if (/\/styles\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) });
    return r.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  const sep = item.rota.includes('?') ? '&' : '?';
  const url = `${base}${item.rota}${sep}cenario=${item.cenario || item.estado}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  if (!item.semTela) await page.waitForSelector('[data-testid^="tela-"]', { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(item.espera ?? 1500);
  const perf = await page.evaluate(() => ({ fcpMs: window.__fcp ?? null, screens: [...document.querySelectorAll('[data-testid^="tela-"]')].map((e) => e.getAttribute('data-testid')) }));
  const a = await audit(page);
  await stamp(page);
  const file = `${item.nome}__${item.estado}__${width}.png`;
  await page.screenshot({ path: path.join(out, file) });
  report.push({ file, route: item.rota, state: item.estado, scenario: item.cenario || item.estado, width, finalUrl: page.url().replace(base, ''), loadMs: Date.now() - t0, ...perf, audit: a, errors, serverRequests: [...new Set(server)], blockedExternal: [...new Set(external)] });
  console.log(`ok ${file} -> ${page.url().replace(base, '')}${errors.length ? ` (${errors.length} erro(s) na página)` : ''}`);
  await ctx.close();
}

function compress(out, files) {
  const before = files.reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
  for (let i = 0; i < files.length; i += 25) {
    const batch = files.slice(i, i + 25).map((f) => path.join(out, f));
    // 98 = ficaria maior, 99 = abaixo da qualidade mínima: nesses casos o PNG original fica.
    const r = spawnSync('pngquant', ['--quality=85-98', '--force', '--skip-if-larger', '--strip', '--ext', '.png', ...batch], { stdio: 'inherit' });
    if (r.error) throw new Error(`pngquant não encontrado: ${r.error.message}`);
  }
  const after = files.reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
  return { before, after };
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.build) exportDemo(opts.dist);
  assertDemoExport(opts.dist);
  ensureMapWorker(opts.dist);
  fs.mkdirSync(opts.out, { recursive: true });
  const items = MATRIX.filter((m) => (!opts.rotas || opts.rotas.includes(m.nome)) && (!opts.estados || opts.estados.includes(m.estado)));
  const { chromium } = require('playwright');
  // WebGL por software (SwiftShader): o mapa desenha as regiões também no Chromium sem GPU (CI).
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await chromium.launch({ args, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const server = await serve(opts.dist, PORT);
  const base = `http://127.0.0.1:${PORT}`;
  const report = [];
  const started = Date.now();
  try {
    for (const item of items) for (const w of opts.larguras) await shoot(browser, base, item, w, opts.out, report);
  } finally {
    server.close();
    await browser.close();
  }
  const files = report.map((r) => r.file);
  const sizes = opts.pngquant ? compress(opts.out, files) : null;
  // Com filtro, as capturas refeitas substituem as antigas no relatório da pasta (o resto fica).
  const reportFile = path.join(opts.out, 'relatorio.json');
  const filtered = opts.rotas || opts.estados || opts.larguras.length < 3;
  if (filtered && fs.existsSync(reportFile)) {
    const old = JSON.parse(fs.readFileSync(reportFile, 'utf8')).capturas ?? [];
    const redone = new Set(files);
    report.unshift(...old.filter((r) => !redone.has(r.file)));
  }
  const summary = {
    geradoEm: new Date().toISOString(),
    relogioDaDemonstracao: CLOCK.toISOString(),
    export: opts.dist,
    capturas: report.length,
    refeitasNestaExecucao: files.length,
    minutos: Math.round((Date.now() - started) / 6000) / 10,
    bytesDestaExecucao: sizes,
    bytesNaPasta: fs.readdirSync(opts.out).filter((f) => f.endsWith('.png')).reduce((s, f) => s + fs.statSync(path.join(opts.out, f)).size, 0),
    paginasComErro: report.filter((r) => r.errors.length).map((r) => r.file),
    /** Tem de ser 0: nenhum pedido ao Supabase no modo demonstração. */
    pedidosAoServidor: report.reduce((s, r) => s + r.serverRequests.length, 0),
    /** Mapa-base externo (respondido com estilo vazio ou bloqueado). */
    pedidosExternosBloqueados: [...new Set(report.flatMap((r) => r.blockedExternal))],
  };
  if (summary.pedidosAoServidor > 0) process.exitCode = 1;
  fs.writeFileSync(path.join(opts.out, 'relatorio.json'), JSON.stringify({ resumo: summary, capturas: report }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
