#!/usr/bin/env node
/**
 * F8 (auditoria de UX) — percorre TODAS as rotas, estados (`?cenario=`), folhas, modais e fluxos do export web do
 * MODO DEMONSTRAÇÃO a 390 px e salva as capturas em `docs/melhoria/F8/ux/capturas/`. Cada tela com rolagem sai em
 * várias capturas (`--2`, `--3`…), para a auditoria ver o conteúdo inteiro e não só a primeira dobra.
 *
 * Uso (em apps/mobile):
 *   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo
 *   NODE_PATH="$(npm root -g)" node ../../docs/melhoria/F8/ux/auditar-telas.cjs /tmp/nomade-demo [--so=fluxo,estatico,interacoes]
 *
 * Saída: PNGs (pngquant 85-98) e `textos.json` (texto visível, alvos < 44 px, interativos sem nome, erros de página
 * e o contador de toques de cada fluxo). Base: `apps/mobile/e2e-web/capturas.cjs` e `demo-mode-flow.cjs`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const APP = path.join(REPO, 'apps', 'mobile');
const { serve } = require(path.join(APP, 'e2e-web', 'serve.cjs'));

const DIST = path.resolve(process.argv[2] || '/tmp/nomade-demo');
const ONLY = (process.argv.find((a) => a.startsWith('--so=')) || '--so=fluxo,estatico,interacoes').slice(5).split(',');
/** `--filtro=quente` refaz só as capturas cujo nome contém o texto. */
const FILTRO = (process.argv.find((a) => a.startsWith('--filtro=')) || '').slice(9);
const OUT = path.join(__dirname, 'capturas');
const PORT = Number(process.env.PORT || 8211);
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

const textos = {};
const toques = {};

/** Mede no DOM: texto visível, alvos < 44 px e interativos sem nome. */
async function audit(page) {
  return page.evaluate(() => {
    const small = [];
    const unlabeled = [];
    for (const el of document.querySelectorAll('[role="button"],[role="link"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],button,a[href],input,textarea')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const name = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || '').trim();
      const id = el.getAttribute('data-testid') || el.tagName.toLowerCase();
      if (r.width < 44 || r.height < 44) small.push(`${id} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (!name) unlabeled.push(id);
    }
    const text = (document.body.innerText || '').replace(/\n{2,}/g, '\n').trim();
    const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const tela = [...document.querySelectorAll('[data-testid^="tela-"]')].map((e) => e.getAttribute('data-testid'));
    return { tela, words, small, unlabeled, text };
  });
}

/** Rolagem: o maior contêiner rolável visível (ScrollView do react-native-web). */
async function scrollables(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('div').forEach((el, i) => {
      const st = getComputedStyle(el);
      if (!/(auto|scroll)/.test(st.overflowY)) return;
      if (el.scrollHeight - el.clientHeight < 60 || el.clientHeight < 200) return;
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.bottom < 0 || r.top > innerHeight) return;
      el.setAttribute('data-f8-scroll', String(i));
      out.push({ i, area: r.width * r.height, sh: el.scrollHeight, ch: el.clientHeight });
    });
    out.sort((a, b) => b.area - a.area);
    return out.slice(0, 1);
  });
}

async function shot(page, nome, { rolar = true } = {}) {
  const file = `${nome}.png`;
  await page.waitForTimeout(250);
  const a = await audit(page);
  await page.screenshot({ path: path.join(OUT, file) });
  textos[nome] = { url: page.url().replace(BASE, ''), ...a };
  if (!rolar) return;
  const [sc] = await scrollables(page);
  if (!sc) return;
  const passos = Math.min(5, Math.ceil((sc.sh - sc.ch) / (sc.ch * 0.8)));
  for (let k = 1; k <= passos; k++) {
    await page.evaluate(({ i, y }) => {
      const el = document.querySelector(`[data-f8-scroll="${i}"]`);
      if (el) el.scrollTop = y;
    }, { i: sc.i, y: Math.round(sc.ch * 0.8 * k) });
    await page.waitForTimeout(350);
    const n2 = `${nome}--${k + 1}`;
    const a2 = await audit(page);
    await page.screenshot({ path: path.join(OUT, `${n2}.png`) });
    textos[n2] = { url: page.url().replace(BASE, ''), ...a2 };
  }
  await page.evaluate((i) => {
    const el = document.querySelector(`[data-f8-scroll="${i}"]`);
    if (el) el.scrollTop = 0;
  }, sc.i);
  await page.waitForTimeout(200);
}

async function newCtx(browser, { fixedClock = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    permissions: ['geolocation'],
    geolocation: { latitude: -16.7097, longitude: -49.2388 },
  });
  if (fixedClock) await ctx.clock.setFixedTime(CLOCK);
  const server = [];
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => {
    const u = r.request().url();
    if (/supabase|\/(rest|auth|functions|storage|realtime)\/v1\//.test(u)) server.push(u);
    if (/\/styles\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) });
    return r.abort();
  });
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e.message).slice(0, 200)));
  return { ctx, page };
}

const id = (page, t) => page.locator(`[data-testid="${t}"]`).first();
async function tap(page, t, contador) {
  await id(page, t).waitFor({ timeout: 10_000 });
  await id(page, t).click();
  if (contador) toques[contador] = (toques[contador] || 0) + 1;
  await page.waitForTimeout(700);
}
async function tela(page, t, ms = 20_000) {
  await id(page, t).waitFor({ timeout: ms });
  await page.waitForTimeout(800);
}
async function tryStep(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.log(`  falhou: ${label}: ${String(e.message).split('\n')[0].slice(0, 160)}`);
    textos[`falha--${label}`] = { erro: String(e.message).slice(0, 300) };
  }
}

/** Rotas × estados (sem interação). */
const ESTATICO = [
  ...[
    ['mapa', '/'], ['arena', '/arena'], ['clube', '/clube'], ['clube-crew', '/clube/crew'], ['correr-aba', '/correr'],
    ['voce', '/perfil'], ['voce-ajustes', '/perfil/ajustes'], ['voce-atividades', '/perfil/atividades'], ['voce-editar', '/perfil/editar'],
    ['voce-conta', '/perfil/conta'], ['voce-time', '/perfil/time'], ['atividades-raiz', '/atividades'], ['notificacoes', '/notificacoes'],
    ['contatos-seguranca', '/contatos-seguranca'], ['zonas-privacidade', '/zonas-privacidade'], ['nova-corrida', '/corrida'],
    ['resumo', '/resumo?id=demo-corrida-1'], ['zona', `/zona/${ZONE}`], ['missoes', '/missoes'], ['recompensas', '/recompensas'],
    ['compartilhar', '/compartilhar/demo-corrida-1'], ['compartilhar-semana', '/compartilhar/semana'], ['compartilhar-feed', '/compartilhar/feed'],
    ['convite', '/compartilhar/convite/DEMOFLR1'], ['termos', '/termos'], ['privacidade', '/privacidade'], ['indisponivel', '/indisponivel'],
    ['nova-senha', '/nova-senha'], ['rota-inexistente', '/nao-existe'],
  ].map(([nome, rota]) => ({ nome: `${nome}__cheio`, rota, cenario: 'cheio' })),
  ...[
    ['mapa', '/'], ['arena', '/arena'], ['clube', '/clube'], ['clube-crew', '/clube/crew'], ['voce', '/perfil'], ['voce-atividades', '/perfil/atividades'],
    ['notificacoes', '/notificacoes'], ['missoes', '/missoes'], ['recompensas', '/recompensas'], ['compartilhar-semana', '/compartilhar/semana'],
    ['compartilhar-feed', '/compartilhar/feed'], ['contatos-seguranca', '/contatos-seguranca'], ['zonas-privacidade', '/zonas-privacidade'], ['zona', `/zona/${ZONE}`],
  ].map(([nome, rota]) => ({ nome: `${nome}__vazio`, rota, cenario: 'vazio' })),
  ...[['mapa', '/'], ['arena', '/arena'], ['clube', '/clube'], ['voce', '/perfil'], ['voce-atividades', '/perfil/atividades'], ['missoes', '/missoes'], ['recompensas', '/recompensas'], ['zona', `/zona/${ZONE}`], ['compartilhar', '/compartilhar/demo-corrida-1']]
    .flatMap(([nome, rota]) => [
      { nome: `${nome}__erro`, rota, cenario: 'erro' },
      { nome: `${nome}__offline`, rota, cenario: 'offline' },
      // "Quente": o aparelho já abriu o app antes (perfil em cache), como num celular de verdade.
      { nome: `${nome}__erro-quente`, rota, cenario: 'erro', quente: true },
      { nome: `${nome}__offline-quente`, rota, cenario: 'offline', quente: true },
    ]),
  ...[['mapa', '/'], ['arena', '/arena'], ['clube', '/clube'], ['voce', '/perfil'], ['missoes', '/missoes']].map(([nome, rota]) => ({ nome: `${nome}__carregando`, rota, cenario: 'lento', espera: 3300, semTela: true, rolar: false })),
  { nome: 'mapa__sob-ataque', rota: '/', cenario: 'sob-ataque', espera: 7000 },
  { nome: 'zona__sob-ataque', rota: `/zona/${ZONE}`, cenario: 'sob-ataque', espera: 7000 },
  { nome: 'mapa__sem-time', rota: '/', cenario: 'sem-time', espera: 2500 },
  ...[['boas-vindas', '/boas-vindas'], ['entrar', '/entrar'], ['cadastro', '/cadastro'], ['recuperar-senha', '/recuperar-senha'], ['mapa-sem-sessao', '/']].map(([nome, rota]) => ({ nome: `${nome}__primeira-abertura`, rota, cenario: 'primeira-abertura' })),
  ...[['moderacao', '/moderacao'], ['moderacao-detalhe', '/moderacao/demo-revisao-1'], ['moderacao-contas', '/moderacao/contas'], ['voce-ajustes', '/perfil/ajustes']].map(([nome, rota]) => ({ nome: `${nome}__moderador`, rota, cenario: 'moderador' })),
];

async function estatico(browser) {
  for (const it of ESTATICO.filter((e) => !FILTRO || e.nome.includes(FILTRO))) {
    const { ctx, page } = await newCtx(browser);
    await tryStep(it.nome, async () => {
      if (it.quente) {
        await page.goto(`${BASE}/?cenario=cheio`, { waitUntil: 'load' });
        await page.waitForSelector('[data-testid="tela-mapa"]', { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(1500);
      }
      await page.goto(`${BASE}${it.rota}${it.rota.includes('?') ? '&' : '?'}cenario=${it.cenario}`, { waitUntil: 'load' });
      if (!it.semTela) await page.waitForSelector('[data-testid^="tela-"]', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(it.espera ?? 1800);
      await shot(page, it.nome, { rolar: it.rolar !== false });
      if (page.__errors.length) textos[it.nome].errosDaPagina = page.__errors;
      console.log(`ok ${it.nome}`);
    });
    await ctx.close();
  }
}

/** Folhas, modais, abas e botões secundários (cada um numa página nova do cenário "cheio"). */
const INTERACOES = [
  { nome: 'mapa-camadas', rota: '/', passos: ['mapa-camada'] },
  { nome: 'mapa-toque-correr', rota: '/', passos: ['mapa-correr'] },
  { nome: 'aba-correr-toque', rota: '/', passos: ['aba-correr'] },
  { nome: 'mapa-alerta-toque', rota: '/', passos: ['mapa-alerta-*'] },
  { nome: 'mapa-chip-hoje-1', rota: '/', passos: ['mapa-hoje-*'] },
  { nome: 'arena-ajuda', rota: '/arena', passos: ['arena-ajuda-abrir'] },
  { nome: 'arena-raid-toque', rota: '/arena', passos: ['arena-raid'] },
  { nome: 'arena-modo-1', rota: '/arena', passos: ['arena-modo-*'] },
  { nome: 'arena-missao-toque', rota: '/arena', passos: ['arena-missao-*'] },
  { nome: 'clube-crew-abrir', rota: '/clube', passos: ['clube-crew-abrir'] },
  { nome: 'clube-convite', rota: '/clube', passos: ['clube-convite'] },
  { nome: 'clube-feed-toque', rota: '/clube', passos: ['clube-feed'] },
  { nome: 'clube-ranking-filtro', rota: '/clube', passos: ['ranking-escopo'] },
  { nome: 'clube-crew-sair', rota: '/clube/crew', passos: ['crew-sair'] },
  { nome: 'voce-time-toque', rota: '/perfil', passos: ['perfil-time'] },
  { nome: 'voce-cartao-toque', rota: '/perfil', passos: ['perfil-cartao'] },
  { nome: 'voce-medalhas-toque', rota: '/perfil', passos: ['perfil-medalhas'] },
  { nome: 'voce-atlas-toque', rota: '/perfil', passos: ['perfil-atlas'] },
  { nome: 'voce-zonas-toque', rota: '/perfil', passos: ['perfil-zonas'] },
  { nome: 'voce-km-toque', rota: '/perfil', passos: ['perfil-km'] },
  { nome: 'voce-atividades-toque', rota: '/perfil', passos: ['voce-atividades'] },
  { nome: 'ajustes-pausa-folha', rota: '/perfil/ajustes', passos: ['ajustes-pausa'] },
  { nome: 'ajustes-sair', rota: '/perfil/ajustes', passos: ['perfil-sair'] },
  { nome: 'ajustes-convite-app', rota: '/perfil/ajustes', passos: ['convite-app'] },
  { nome: 'atividades-recap', rota: '/perfil/atividades', passos: ['atividades-recap'] },
  { nome: 'atividades-item', rota: '/perfil/atividades', passos: ['atividade-*'] },
  { nome: 'missoes-trocar', rota: '/missoes', passos: ['missao-trocar-*'] },
  { nome: 'missoes-primeira-semana-ver-mais', rota: '/missoes', passos: ['missoes-primeira-semana-ver-mais'] },
  { nome: 'recompensas-bau-abrir', rota: '/recompensas', passos: ['recompensas-bau-abrir'], espera: 3500 },
  { nome: 'recompensas-cosmeticos-todos', rota: '/recompensas', passos: ['recompensas-cosmeticos-ver-todos'] },
  { nome: 'recompensas-trilha-toda', rota: '/recompensas', passos: ['recompensas-trilha-ver-toda'] },
  { nome: 'resumo-detalhes', rota: '/resumo?id=demo-corrida-1', passos: ['resumo-detalhes'] },
  { nome: 'resumo-compartilhar', rota: '/resumo?id=demo-corrida-1', passos: ['resumo-compartilhar'], espera: 2500 },
  { nome: 'compartilhar-modelo-2', rota: '/compartilhar/demo-corrida-1', passos: ['compartilhar-modelo-1'] },
  { nome: 'compartilhar-exportar', rota: '/compartilhar/demo-corrida-1', passos: ['compartilhar-exportar'], espera: 2500 },
  { nome: 'zona-correr', rota: `/zona/${ZONE}`, passos: ['zona-correr'] },
  { nome: 'notificacoes-item', rota: '/notificacoes', passos: ['notificacao-*'] },
  { nome: 'nova-corrida-fechar', rota: '/corrida', passos: ['corrida-fechar'] },
  { nome: 'nova-corrida-escolta', rota: '/corrida', passos: ['corrida-escolta-alternar'] },
  { nome: 'voce-time-trocar', rota: '/perfil/time', passos: ['faccao-opcao-coyotes'] },
  { nome: 'entrar-demonstracao', rota: '/entrar', cenario: 'primeira-abertura', passos: ['entrar-ver-demonstracao'] },
  { nome: 'convite-abrir', rota: '/compartilhar/convite/DEMOFLR1', passos: ['convite-abrir'] },
];

async function clickPattern(page, t) {
  if (!t.endsWith('*')) return tap(page, t);
  const loc = page.locator(`[data-testid^="${t.slice(0, -1)}"]`).first();
  await loc.waitFor({ timeout: 10_000 });
  await loc.click();
  await page.waitForTimeout(700);
}

async function interacoes(browser) {
  for (const it of INTERACOES.filter((e) => !FILTRO || e.nome.includes(FILTRO))) {
    const { ctx, page } = await newCtx(browser);
    await tryStep(it.nome, async () => {
      await page.goto(`${BASE}${it.rota}${it.rota.includes('?') ? '&' : '?'}cenario=${it.cenario || 'cheio'}`, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid^="tela-"]', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      for (const p of it.passos) await clickPattern(page, p);
      await page.waitForTimeout(it.espera ?? 1200);
      await shot(page, `x-${it.nome}`);
      console.log(`ok x-${it.nome}`);
    });
    await ctx.close();
  }
}

/** Fluxos completos, contando toques até cada momento de valor. */
async function fluxo(browser) {
  const { ctx, page } = await newCtx(browser, { fixedClock: false });
  const F = 'primeira-abertura';
  const n = (k, nome) => `f1-${String(k).padStart(2, '0')}-${nome}`;
  let k = 0;
  await tryStep('fluxo-1', async () => {
    await page.goto(`${BASE}/?cenario=primeira-abertura`);
    await page.locator('[data-testid="tela-boas-vindas"],[data-testid="tela-entrar"]').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await shot(page, n(++k, 'boas-vindas'));
    if (await page.locator('[data-testid="tela-boas-vindas"]').count()) await tap(page, 'boas-vindas-comecar', F);
    else await tap(page, 'entrar-criar-conta', F);
    await tela(page, 'tela-cadastro');
    await shot(page, n(++k, 'cadastro-vazio'));
    await id(page, 'cadastro-email').fill('ana@exemplo.com');
    await id(page, 'cadastro-senha').fill('Corre@2026x');
    await id(page, 'cadastro-usuario').fill('ana_corre');
    await id(page, 'cadastro-nascimento').fill('15/05/2000');
    toques[F] += 4; // 4 campos (cada um = pelo menos 1 toque + digitação)
    await tap(page, 'cadastro-aceite', F);
    await shot(page, n(++k, 'cadastro-preenchido'));
    await tap(page, 'cadastro-botao', F);
    await tela(page, 'tela-onboarding', 30_000);
    await page.waitForTimeout(1200);
    await shot(page, n(++k, 'onboarding-1'));
    if (await page.locator('[data-testid="onboarding-nome-continuar"]').count()) {
      await tap(page, 'onboarding-nome-continuar', F);
      await shot(page, n(++k, 'onboarding-2'));
    }
    await tap(page, 'onboarding-cidade-continuar', F);
    await shot(page, n(++k, 'times'));
    await tryStep('lider', async () => {
      await clickPattern(page, 'onboarding-times-striders-lider');
      await shot(page, n(++k, 'folha-lider'), { rolar: true });
      await tap(page, 'onboarding-lider-voltar');
    });
    await tryStep('quiz', async () => {
      await tap(page, 'onboarding-nao-sei');
      await shot(page, n(++k, 'folha-quiz'));
      for (let q = 0; q < 6; q++) {
        if (await page.locator('[data-testid="onboarding-quiz-resultado"]').count()) break;
        const opt = page.locator('[data-testid^="onboarding-quiz-"]:not([data-testid="onboarding-quiz-fechar"])').filter({ hasNot: page.locator('[data-testid="onboarding-quiz"]') });
        const ids = await page.locator('[data-testid^="onboarding-quiz-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')).filter((x) => /-(striders|coyotes|volt|owls)$/.test(x)));
        if (!ids.length) break;
        await tap(page, ids[ids.length - 1]);
        void opt;
      }
      await shot(page, n(++k, 'quiz-resultado'));
      await tap(page, 'onboarding-quiz-ver');
      await shot(page, n(++k, 'times-depois-do-quiz'));
    });
    await tap(page, 'onboarding-times-volt', F);
    await shot(page, n(++k, 'time-volt-selecionado'));
    await tap(page, 'onboarding-entrar-time', F);
    await page.waitForTimeout(1500);
    await shot(page, n(++k, 'confirmacao'));
    await tap(page, 'onboarding-confirmacao-continuar', F);
    await shot(page, n(++k, 'localizacao'));
    await tap(page, 'onboarding-localizacao-permitir', F);
    await tela(page, 'tela-mapa', 30_000);
    await page.waitForTimeout(2000);
    toques['ate-mapa'] = toques[F];
    await shot(page, n(++k, 'mapa-boas-vindas'), { rolar: false });
    await tap(page, 'mapa-missao-boas-vindas', F);
    await tela(page, 'tela-nova-corrida');
    await shot(page, n(++k, 'nova-corrida'));
    await tap(page, 'corrida-sinal-simulacao', F);
    await shot(page, n(++k, 'nova-corrida-simulacao'));
    await tap(page, 'corrida-comecar', F);
    await page.waitForTimeout(1500);
    await shot(page, n(++k, 'contagem'), { rolar: false });
    await id(page, 'corrida-encerrar').waitFor({ timeout: 20_000 });
    toques['ate-correr'] = toques[F];
    await page.waitForTimeout(20_000);
    await shot(page, n(++k, 'corrida-ativa'), { rolar: false });
    const box = await id(page, 'corrida-encerrar').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1600);
    await page.mouse.up();
    toques[F]++;
    await tela(page, 'tela-resumo', 30_000);
    await page.waitForTimeout(3500);
    toques['ate-resumo'] = toques[F];
    await shot(page, n(++k, 'resumo'));
    await tap(page, 'resumo-compartilhar', F);
    await tela(page, 'tela-compartilhar');
    await page.waitForTimeout(2000);
    await shot(page, n(++k, 'compartilhar'));
    toques['ate-compartilhar'] = toques[F] + 1;
    await tryStep('exportar', async () => {
      await id(page, 'compartilhar-exportar').click({ timeout: 5000, force: true });
      await page.waitForTimeout(2000);
      await shot(page, n(++k, 'compartilhar-exportado'), { rolar: false });
    });
    await tryStep('fechar-compartilhar', async () => tap(page, 'compartilhar-fechar'));
    await tryStep('concluir', async () => {
      await tap(page, 'resumo-concluir');
      await page.waitForTimeout(2500);
      await shot(page, n(++k, 'depois-concluir'), { rolar: false });
    });
    // Dia 2 no mesmo aparelho: Missões e Recompensas pelo Mapa/Você.
    await tryStep('dia2', async () => {
      await tap(page, 'aba-voce');
      await shot(page, n(++k, 'voce-depois-da-1a-corrida'));
      await tap(page, 'perfil-missoes');
      await shot(page, n(++k, 'missoes-depois-da-1a-corrida'));
    });
    if (page.__errors.length) textos['fluxo-1-erros'] = page.__errors;
  });
  await ctx.close();
}

function compress() {
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).map((f) => path.join(OUT, f));
  for (let i = 0; i < files.length; i += 25) spawnSync('pngquant', ['--quality=85-98', '--force', '--skip-if-larger', '--strip', '--ext', '.png', ...files.slice(i, i + 25)], { stdio: 'inherit' });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const server = await serve(DIST, PORT);
  try {
    if (ONLY.includes('fluxo')) await fluxo(browser);
    if (ONLY.includes('estatico')) await estatico(browser);
    if (ONLY.includes('interacoes')) await interacoes(browser);
  } finally {
    server.close();
    await browser.close();
  }
  compress();
  const file = path.join(__dirname, 'textos.json');
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { telas: {}, toques: {} };
  fs.writeFileSync(file, JSON.stringify({ geradoEm: new Date().toISOString(), telas: { ...old.telas, ...textos }, toques: { ...old.toques, ...toques } }, null, 1));
  console.log('toques:', toques);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
