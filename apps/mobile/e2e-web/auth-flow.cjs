/**
 * QA-03 / QA-06 / QA-12 / cidade natal (A3) — conferência no navegador (Playwright + Chromium) sobre o export web:
 *  1. cadastro e onboarding da v2 → cidade natal em Editar perfil → `profiles.city` no servidor;
 *  2. "Reduzir movimento": o botão não encolhe ao pressionar, só fica mais transparente (sem a preferência, encolhe);
 *  3. recuperação de senha pelo fluxo PKCE: e-mail na caixa local → link → `?code=` → tela "Crie uma senha nova" → entra;
 *  4. com alguém conectado, um link de acesso pede confirmação ("Trocar de conta?"); tokens na URL são ignorados;
 *  5. excluir conta pede a senha atual: senha errada → "Senha incorreta"; certa → volta para Entrar;
 *  6. conta inativada pelo admin → o app encerra a sessão e mostra "Conta inativada" na tela Entrar.
 *
 * Uso: node e2e-web/auth-flow.cjs <export web>   (porta 8081, que está na lista de redirecionamentos do Auth local)
 * Precisa da caixa de e-mail local (`npm run mail`, http://127.0.0.1:54324) e das functions (`npm run functions:serve`).
 * Variáveis: PW_CHROMIUM, PW_MODULE, OUT_DIR, API_URL, ANON_KEY, MAIL_URL, PORT (8081).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');
const { chooseTeam, signUp } = require('./onboarding-steps.cjs');
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
const PORT = Number(process.env.PORT || 8081);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'nomade-auth-'));
const API = process.env.API_URL || 'http://127.0.0.1:54321';
const MAIL = process.env.MAIL_URL || 'http://127.0.0.1:54324';
const ANON = process.env.ANON_KEY || readEnvAnon();
const CHROMIUM = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));

function readEnvAnon() {
  try {
    return /EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

let step = 0;
const results = [];
function ok(cond, label, extra) {
  step += 1;
  results.push({ ok: !!cond });
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

async function recoveryLink(to, after) {
  for (let i = 0; i < 30; i++) {
    const body = await fetch(`${MAIL}/api/messages`).then((r) => r.json()).catch(() => ({ messages: [] }));
    const msg = body.messages.find((m) => m.to.includes(to) && Date.parse(m.date) >= after - 2000);
    const link = msg?.links.find((l) => l.includes('/auth/v1/verify'));
    if (link) return link;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`export web não encontrado em ${DIST}`);
  const { chromium } = loadPlaywright();
  const server = await serve(DIST, PORT);
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const stamp = String(Date.now()).slice(-8);
  const user = { email: `auth${stamp}@nomaderun.test`, password: `Demo@${stamp}`, newPassword: `Nova#${stamp}x`, username: `auth_${stamp}` };
  const errors = [];
  console.log(`NOMADE RUN — auth/acessibilidade no navegador (${BASE}), conta ${user.email}, capturas em ${OUT}`);
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: -16.7097, longitude: -49.2388 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const id = (t) => page.locator(`[data-testid="${t}"]`).first();
    const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

    // 1. cadastro (v2: sem cidade) → onboarding → Mapa; a cidade natal mora em Você → Editar perfil (onda 2)
    await page.goto(`${BASE}/`);
    await signUp(page, user);
    await chooseTeam(page, 'volt');
    await page.goto(`${BASE}/perfil/editar`);
    await id('perfil-cidade').waitFor({ timeout: 20_000 });
    await id('perfil-cidade').fill('G');
    await id('perfil-salvar').click();
    await page.getByText('A cidade precisa ter pelo menos 2 letras.').first().waitFor({ timeout: 5_000 });
    ok(true, 'cidade de 1 letra é recusada no próprio formulário');
    await id('perfil-cidade').fill('Anápolis');
    await shot('01-perfil-cidade');
    await id('perfil-salvar').click();
    // Salvar volta para a tela anterior (ou mostra "perfil-salvo" quando não há para onde voltar).
    await page.waitForFunction(() => !document.querySelector('[data-testid="tela-editar-perfil"]') || document.querySelector('[data-testid="perfil-salvo"]'), null, { timeout: 15_000 });
    const login = await api('POST', '/auth/v1/token?grant_type=password', null, { email: user.email, password: user.password });
    const me = await api('GET', `/rest/v1/profiles?select=city&id=eq.${login.data.user.id}`, login.data.access_token);
    ok(me.data?.[0]?.city === 'Anápolis', 'cidade natal gravada no perfil pelo Editar perfil', me.data);
    await page.goto(`${BASE}/`);
    await id('mapa-status').waitFor({ timeout: 30_000 });

    // 2. reduzir movimento: pressionar "Correr" não muda a escala, só a opacidade
    const visual = page.locator('[data-testid="mapa-correr"] > div').first();
    const box = await id('mapa-correr').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(400);
    const pressed = await visual.evaluate((el) => ({ transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity }));
    await page.mouse.move(5, 5);
    await page.mouse.up();
    ok(pressed.transform === 'none' && Number(pressed.opacity) < 1, `"Reduzir movimento": botão pressionado sem escala (transform ${pressed.transform}, opacidade ${pressed.opacity})`, pressed);
    const layerChips = await page.locator('[data-testid^="mapa-camada-"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-testid')}=${e.getAttribute('aria-label')}`));
    ok(layerChips.length === 3 && layerChips.every((c) => !c.endsWith('=null')), `filtros de camada com testID e rótulo: ${layerChips.join(', ')}`);
    await shot('02-mapa');

    // 4a. com alguém conectado: link de acesso pede confirmação; "Continuar nesta conta" não muda nada
    await page.goto(`${BASE}/nova-senha?code=00000000-0000-4000-8000-000000000000`);
    await id('link-confirmar-dialogo').waitFor({ timeout: 20_000 });
    const dialogText = await id('link-confirmar-dialogo').innerText();
    ok(/Trocar de conta\?/.test(dialogText) && dialogText.includes(user.email), 'link de acesso com sessão ativa pede confirmação mostrando a conta atual');
    await shot('03-confirmar-troca');
    await id('link-confirmar-cancelar').click();
    await id('link-confirmar-dialogo').waitFor({ state: 'detached', timeout: 10_000 });
    await id('mapa-status').waitFor({ timeout: 20_000 });
    ok(true, '"Continuar nesta conta" mantém a sessão e volta ao mapa');
    // 4b. usar um code inválido: erro, sessão continua
    await page.goto(`${BASE}/nova-senha?code=00000000-0000-4000-8000-000000000000`);
    await id('link-confirmar-trocar').click();
    await id('link-confirmar-erro').waitFor({ timeout: 20_000 });
    ok(true, `code inválido confirmado: "${(await id('link-confirmar-erro').innerText()).trim()}"`);
    await id('link-confirmar-fechar').click();
    await id('mapa-status').waitFor({ timeout: 20_000 });
    // 4c. tokens na URL (fluxo implícito) são ignorados com a sessão ativa
    await page.goto(`${BASE}/nova-senha#access_token=forjado&refresh_token=forjado&type=recovery`);
    await id('mapa-status').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    ok((await id('link-confirmar-dialogo').count()) === 0, 'link com tokens na URL é ignorado (sem diálogo, continua no mapa)');

    // 3. recuperação de senha (PKCE) neste navegador
    await page.goto(`${BASE}/perfil/conta`);
    await id('conta-sair').click();
    await id('tela-entrar').waitFor({ timeout: 20_000 });
    await page.goto(`${BASE}/recuperar-senha`);
    await id('recuperar-email').fill(user.email);
    const t0 = Date.now();
    await id('recuperar-botao').click();
    await id('recuperar-enviado').waitFor({ timeout: 20_000 });
    const verify = await recoveryLink(user.email, t0);
    ok(verify, 'e-mail de recuperação chegou na caixa local', verify);
    const hop = await fetch(verify, { redirect: 'manual' });
    const back = hop.headers.get('location') || '';
    ok(back.startsWith(`${BASE}/nova-senha?code=`) && !back.includes('access_token'), `o Auth devolve só um code: ${back.replace(/code=[^&]+/, 'code=…')}`);
    await page.goto(back);
    await id('nova-senha-senha').waitFor({ timeout: 20_000 });
    await shot('04-nova-senha');
    await id('nova-senha-senha').fill(user.newPassword);
    await id('nova-senha-confirmar').fill(user.newPassword);
    await id('nova-senha-botao').click();
    await id('mapa-status').waitFor({ timeout: 30_000 });
    const relog = await api('POST', '/auth/v1/token?grant_type=password', null, { email: user.email, password: user.newPassword });
    ok(relog.status === 200, 'senha nova salva pelo link de recuperação (PKCE) e vale no login');

    // 6. conta inativada pelo admin: o app encerra a sessão e explica na tela Entrar (P-39)
    const admin = await api('POST', '/auth/v1/token?grant_type=password', null, { email: 'admin.demo@nomaderun.app', password: 'Admin@2026demo' });
    const setStatus = (status) => api('POST', '/rest/v1/rpc/admin_set_user_status', admin.data.access_token, { p_user_id: login.data.user.id, p_status: status });
    ok((await setStatus('inactive')).status === 200, 'admin inativou a conta');
    await page.goto(`${BASE}/perfil`);
    await id('entrar-aviso-sessao').waitFor({ timeout: 30_000 });
    ok(/Conta inativada/.test(await id('entrar-aviso-sessao').innerText()), 'sessão encerrada com o aviso "Conta inativada" na tela Entrar');
    await shot('06-conta-inativada');
    ok((await setStatus('active')).status === 200, 'admin reativou a conta');
    await id('entrar-email').fill(user.email);
    await id('entrar-senha').fill(user.newPassword);
    await id('entrar-botao').click();
    await id('mapa-status').waitFor({ timeout: 30_000 });

    // 5. excluir conta com a senha atual
    await page.goto(`${BASE}/perfil/conta`);
    await id('conta-excluir').click();
    await id('conta-excluir-senha').fill('senha-errada-1');
    await id('conta-excluir-confirmacao').fill('EXCLUIR');
    await id('conta-excluir-confirmar').click();
    await page.getByText('Senha incorreta. Confira e tente de novo.').first().waitFor({ timeout: 20_000 });
    await id('conta-excluir-confirmar').scrollIntoViewIfNeeded();
    await shot('05-excluir-senha-errada');
    ok(true, 'senha errada: mensagem amigável no campo e a conta continua');
    await id('conta-excluir-senha').fill(user.newPassword);
    await id('conta-excluir-confirmar').click();
    await id('tela-entrar').waitFor({ timeout: 30_000 });
    const gone = await api('POST', '/auth/v1/token?grant_type=password', null, { email: user.email, password: user.newPassword });
    ok(gone.status !== 200, 'senha certa + EXCLUIR: conta apagada e volta para Entrar');
    await ctx.close();

    const relevant = errors.filter((e) => !/tile|maplibre|vibrate|Failed to fetch.*(openstreetmap|carto|tiles)/i.test(e));
    ok(relevant.length === 0, 'sem erros de página', relevant);
    console.log(`\n${results.filter((r) => r.ok).length}/${results.length} verificações ok`);
  } catch (e) {
    console.error('FALHOU:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
