#!/usr/bin/env node
/**
 * E10 (onda 4, F5) — fluxo completo no MODO DEMONSTRAÇÃO (D-77), sem servidor e sem rede:
 * primeira abertura → cadastro → cidade dividida → escolher time → confirmação → localização → Mapa (missão de
 * boas-vindas) → Nova corrida → simulação → segurar para encerrar → Resumo (recompensas) → Compartilhar (card) →
 * Arena → Clube → Você → Ajustes → Missões → Recompensas.
 *
 * Em cada tela confere: o selo "Demonstração" na tela e sem texto por baixo dele, nenhum erro de página e nenhum
 * pedido ao Supabase (o modo demonstração não usa rede).
 *
 * Uso (em apps/mobile):
 *   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo   # --clear é obrigatório
 *   NODE_PATH="$(npm root -g)" node e2e-web/demo-mode-flow.cjs /tmp/nomade-demo
 * Variáveis: OUT_DIR (capturas; padrão: pasta temporária), PORT (8197), PW_CHROMIUM, SIM_MS (tempo de corrida, 20000).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { chooseTeam, signUp } = require('./onboarding-steps.cjs');
const { serve } = require('./serve.cjs');

const DIST = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'nomade-demo'));
const PORT = Number(process.env.PORT || 8197);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'nomade-demo-flow-'));
const SIM_MS = Number(process.env.SIM_MS || 20_000);

let step = 0;
const results = [];
function ok(cond, label, extra) {
  step++;
  results.push({ step, ok: !!cond, label });
  console.log(`  ${cond ? 'ok' : 'NÃO OK'} ${step} - ${label}${!cond && extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 300) : ''}`);
  if (!cond) throw new Error(`falhou: ${label}`);
}

/** Textos da tela por baixo do selo fixo (mesma regra do `capturas.cjs`). */
function sealOverlap() {
  const seal = document.querySelector('[data-testid="selo-demonstracao"]');
  if (!seal) return null;
  const s = seal.getBoundingClientRect();
  const hits = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || !/[\p{L}\p{N}]/u.test(n.nodeValue || '') || seal.contains(el) || el.closest('[aria-hidden="true"]')) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      const w = Math.min(r.right, s.right) - Math.max(r.left, s.left);
      const h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
      if (w > 2 && h > 2) {
        hits.push(n.nodeValue.trim().slice(0, 30));
        break;
      }
    }
  }
  return hits;
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`export web não encontrado em ${DIST}`);
  const entryDir = path.join(DIST, '_expo', 'static', 'js', 'web');
  const entry = fs.readdirSync(entryDir).find((f) => f.startsWith('entry-'));
  if (!fs.readFileSync(path.join(entryDir, entry), 'utf8').includes('demonstracao@nomaderun.invalid')) {
    throw new Error('este export não está no modo demonstração: refaça com EXPO_PUBLIC_DEMO=1 e --clear');
  }
  const { chromium } = require('playwright');
  const server = await serve(DIST, PORT);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const errors = [];
  const server_ = [];
  console.log(`NOMADE RUN — fluxo do modo demonstração (${BASE}), capturas em ${OUT}`);
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      permissions: ['geolocation'],
      geolocation: { latitude: -16.7097, longitude: -49.2388 },
    });
    await ctx.route((u) => !u.toString().startsWith(BASE), (r) => {
      const u = r.request().url();
      if (/supabase|\/(rest|auth|functions|storage|realtime)\/v1\//.test(u)) server_.push(u.slice(0, 120));
      return r.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
    const id = (t) => page.locator(`[data-testid="${t}"]`).first();
    const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
    /** Tela aberta, selo presente e nada escondido por baixo dele. */
    const screen = async (testID, label) => {
      await id(testID).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);
      const under = await page.evaluate(sealOverlap);
      ok(under !== null && under.length === 0, `${label}: selo "Demonstração" na tela e sem texto por baixo`, under);
    };

    // 1. Primeira abertura e cadastro
    await page.goto(`${BASE}/?cenario=primeira-abertura`);
    await screen('tela-boas-vindas', 'primeira abertura (boas-vindas)');
    await shot('01-boas-vindas');
    await signUp(page, { email: 'ana@exemplo.com', password: 'Corre@2026x', username: 'ana_corre' });

    // 2. Onboarding: cidade dividida → time (Volt Runners) → confirmação → localização → Mapa
    await screen('onboarding-cidade', 'onboarding: a cidade dividida');
    await chooseTeam(page, 'volt');

    // 3. Mapa com a missão de boas-vindas (sem o card de missão do Mapa por baixo)
    await screen('tela-mapa', 'Mapa');
    ok((await page.locator('[data-testid="tela-mapa"]').innerText()).includes('Volt Runners'), 'Mapa mostra o time escolhido (Volt Runners)');
    await id('mapa-missao-boas-vindas').waitFor({ timeout: 10_000 });
    ok((await page.locator('[data-testid="mapa-missao"]').count()) === 0, 'missão de boas-vindas sozinha (sem o card de missão do Mapa empilhado embaixo)');
    await shot('03-mapa-boas-vindas');

    // 4. Corrida simulada
    await id('mapa-missao-boas-vindas').click();
    await screen('tela-nova-corrida', 'Nova corrida');
    await id('corrida-sinal-simulacao').click();
    await id('corrida-comecar').click();
    await id('corrida-encerrar').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(SIM_MS);
    const km = await id('corrida-metrica-km').innerText();
    ok(/[1-9]|0,[1-9]/.test(km), `corrida simulada andou (${km.replace(/\s+/g, ' ')})`);
    await screen('tela-corrida', 'corrida ativa');
    await shot('04-corrida');
    const box = await id('corrida-encerrar').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1600);
    await page.mouse.up();

    // 5. Resumo
    await screen('tela-resumo', 'Resumo');
    await id('resumo-recompensas').waitFor({ timeout: 15_000 });
    ok(await id('resumo-recompensas-demonstracao').isVisible(), 'Resumo: bloco de recompensas identificado como demonstração');
    await shot('05-resumo');

    // 6. Compartilhar
    await id('resumo-compartilhar').click();
    await screen('tela-compartilhar', 'Compartilhar');
    await id('compartilhar-exportar').waitFor({ timeout: 15_000 });
    ok(/DEMONSTRA/i.test(await id('tela-compartilhar').innerText()) || (await page.locator('svg text').filter({ hasText: /DEMONSTRA/i }).count()) > 0, 'card de compartilhar marcado como demonstração');
    await shot('06-compartilhar');
    await id('compartilhar-fechar').click();
    await id('resumo-concluir').waitFor({ timeout: 15_000 });
    await id('resumo-concluir').click();

    // 7. Abas: Arena → Clube → Você → Ajustes
    await screen('tela-mapa', 'Mapa depois da corrida');
    await id('aba-arena').click();
    await screen('tela-arena', 'Arena');
    await shot('07-arena');
    await id('aba-clube').click();
    await screen('tela-clube', 'Clube');
    await shot('08-clube');
    await id('aba-voce').click();
    await screen('tela-perfil', 'Você');
    await shot('09-voce');
    await id('voce-ajustes').click();
    await screen('tela-ajustes', 'Ajustes');
    await shot('10-ajustes');

    // 8. Missões e Recompensas (atalhos de "Você")
    await page.goBack();
    await id('perfil-missoes').click();
    await screen('tela-missoes', 'Missões');
    await page.goBack();
    await id('perfil-recompensas').click();
    await screen('tela-recompensas', 'Recompensas');
    await shot('11-recompensas');

    ok(server_.length === 0, 'nenhum pedido ao Supabase (modo demonstração sem rede)', server_);
    ok(errors.length === 0, 'sem erros de página', errors);
    await ctx.close();
    console.log(`\n${results.filter((r) => r.ok).length}/${results.length} verificações ok`);
  } catch (e) {
    console.error('FALHOU:', e.message);
    if (errors.length) console.error('erros da página:', errors);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
