#!/usr/bin/env node
/**
 * E10 (F1) — Capturas "antes" da reformulação, sem servidor real.
 *
 * Protótipo do futuro `apps/mobile/e2e-web/capturas.cjs` (F3). Duas fontes:
 *   1. export web SEM `.env`  → o app cai na tela "Backend não configurado" (estado real de quem abre sem servidor);
 *   2. export web com EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 (porta onde NADA escuta) → o Playwright
 *      intercepta cada chamada (Auth, PostgREST, RPC, Edge Functions) e responde com dados vazios ou mínimos,
 *      rotulados "demonstracao". É a mesma lista de chamadas que o modo demonstração (X3) vai imitar.
 *
 * Nada aqui toca código de produção. Uso (na raiz):
 *   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/qa/capturas-antes.cjs <dist-sem-env> <dist-fake> <saida>
 * Saída: PNGs `<rota>__<estado>__<largura>.png` e `relatorio.json` (alvos de toque < 44 px e interativos sem rótulo,
 * medidos no DOM do react-native-web).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require(path.resolve(__dirname, '../../../../apps/mobile/e2e-web/serve.cjs'));

const [DIST_NOENV, DIST_FAKE, OUT] = process.argv.slice(2).map((p) => path.resolve(p));
const SIZES = [
  { w: 360, h: 800 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
];
const API = 'http://127.0.0.1:54399';
const UID = '00000000-0000-4000-8000-00000000d3e0';
fs.mkdirSync(OUT, { recursive: true });

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const NOW = Math.floor(Date.now() / 1000);
const JWT = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: NOW + 86400, email: 'demonstracao@exemplo.invalid' })}.assinatura-falsa`;
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'demonstracao@exemplo.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-01T12:00:00Z' };
const SESSION = { access_token: JWT, token_type: 'bearer', expires_in: 86400, expires_at: NOW + 86400, refresh_token: 'refresh-falso', user: USER };

function profileRow(faction) {
  return {
    id: UID, username: 'demonstracao', birthdate: '1999-01-01', faction, city: 'Goiânia', units: 'km',
    notification_prefs: { invasion: true, conquest: true, missions: true, moderation: true },
    xp: 1250, trust: 100, role: 'runner', status: 'active', avatar_url: null, faction_changed_season: null,
  };
}

/** Responde às chamadas do supabase-js. `scenario`: signedOut | onboarding | app | profileError */
function handler(scenario, calls) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    calls.push(`${req.method()} ${p}${url.search ? '?' + url.searchParams.toString().slice(0, 80) : ''}`);
    const json = (status, body, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-range': '0-0/0', ...headers }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return json(200, {});
    if (p.startsWith('/auth/v1/user')) return scenario === 'signedOut' ? json(401, { message: 'no session' }) : json(200, USER);
    if (p.startsWith('/auth/v1/token')) return scenario === 'signedOut' ? json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }) : json(200, SESSION);
    if (p.startsWith('/auth/v1/logout')) return json(204, {});
    if (p.startsWith('/auth/v1/')) return json(200, {});
    if (p.startsWith('/rest/v1/profiles')) {
      if (scenario === 'profileError') return json(503, { message: 'Service Unavailable' });
      const row = profileRow(scenario === 'onboarding' ? null : 'striders');
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      return json(200, single ? row : [row]);
    }
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn === 'username_available') return json(200, true);
      if (fn === 'district_label') return json(200, 'Setor Bueno');
      if (fn === 'daily_chests') return json(200, { chests: [] });
      return json(200, []);
    }
    if (p.startsWith('/rest/v1/')) {
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      return single ? json(406, { code: 'PGRST116', message: 'no rows' }) : json(200, []);
    }
    if (p.startsWith('/functions/v1/zones')) return json(200, { zones: [] });
    if (p.startsWith('/functions/v1/zone')) return json(404, { error: { code: 'NOT_FOUND', message: 'Zona não encontrada.' } });
    if (p.startsWith('/functions/v1/')) return json(200, {});
    if (p.startsWith('/storage/v1/')) return json(200, {});
    return json(404, {});
  };
}

/** Mede no DOM do react-native-web: interativos com área < 44×44 e sem nome acessível. */
async function audit(page) {
  return page.evaluate(() => {
    const out = { small: [], unlabeled: [], interactive: 0 };
    const els = document.querySelectorAll('[role="button"],[role="link"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],button,a[href],input,[tabindex="0"]');
    const seen = new Set();
    for (const el of els) {
      if (seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      out.interactive++;
      const name = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || '').trim().replace(/\s+/g, ' ');
      const id = el.getAttribute('data-testid') || el.id || el.tagName.toLowerCase();
      if (r.width < 44 || r.height < 44) out.small.push({ id, w: Math.round(r.width), h: Math.round(r.height), name: name.slice(0, 60) });
      if (!name) out.unlabeled.push({ id, w: Math.round(r.width), h: Math.round(r.height) });
    }
    out.words = (document.body.innerText || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    return out;
  });
}

async function shoot(browser, base, { route, state, scenario, sizes = SIZES, reduced = false, settle = 2500 }, report) {
  for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const calls = [];
    const errors = [];
    // Mapa-base externo e qualquer rede fora do localhost: bloqueados (capturas determinísticas).
    await ctx.route((u) => !/^http:\/\/127\.0\.0\.1/.test(u.toString()), (r) => r.abort());
    if (scenario) {
      await ctx.route(`${API}/**`, handler(scenario, calls));
      if (scenario !== 'signedOut') await ctx.addInitScript((sess) => localStorage.setItem('sb-127-auth-token', JSON.stringify(sess)), SESSION);
    }
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    const t0 = Date.now();
    await page.goto(base + route, { waitUntil: 'load' });
    await page.waitForTimeout(settle);
    const perf = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return { fcpMs: fcp ? Math.round(fcp.startTime) : null };
    });
    const name = `${route === '/' ? 'inicio' : route.replace(/^\//, '').replace(/[/[\]?=&]/g, '_')}__${state}__${s.w}.png`;
    await page.screenshot({ path: path.join(OUT, name) });
    const a = s.w === 390 ? await audit(page) : null;
    const testids = s.w === 390 ? await page.evaluate(() => [...document.querySelectorAll('[data-testid^="tela-"]')].map((e) => e.getAttribute('data-testid'))) : null;
    report.push({ file: name, route, state, width: s.w, finalUrl: page.url().replace(base, ''), loadMs: Date.now() - t0, ...perf, screens: testids, audit: a, errors, calls: [...new Set(calls)].slice(0, 40) });
    console.log(`ok ${name} -> ${page.url().replace(base, '')}`);
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  const s1 = await serve(DIST_NOENV, 8191);
  await shoot(browser, 'http://127.0.0.1:8191', { route: '/', state: 'sem-servidor' }, report);
  await shoot(browser, 'http://127.0.0.1:8191', { route: '/', state: 'sem-servidor-reduzir-movimento', sizes: [SIZES[1]], reduced: true }, report);
  s1.close();

  const s2 = await serve(DIST_FAKE, 8192);
  const B = 'http://127.0.0.1:8192';
  for (const r of ['/entrar', '/cadastro', '/recuperar-senha']) await shoot(browser, B, { route: r, state: 'deslogado', scenario: 'signedOut' }, report);
  await shoot(browser, B, { route: '/onboarding', state: 'sem-time', scenario: 'onboarding' }, report);
  await shoot(browser, B, { route: '/', state: 'erro-perfil', scenario: 'profileError', sizes: [SIZES[1]] }, report);
  const app = ['/', '/arena', '/atividades', '/clube', '/clube/crew', '/perfil', '/perfil/editar', '/perfil/conta', '/perfil/time', '/notificacoes', '/contatos-seguranca', '/zonas-privacidade', '/corrida', '/resumo?id=inexistente', '/zona/89a8100c6b7ffff', '/termos', '/privacidade'];
  for (const r of app) await shoot(browser, B, { route: r, state: 'vazio', scenario: 'app', settle: r === '/' || r === '/corrida' ? 4000 : 2500 }, report);
  await shoot(browser, B, { route: '/', state: 'vazio-reduzir-movimento', scenario: 'app', sizes: [SIZES[1]], reduced: true }, report);
  s2.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(report, null, 2));
  console.log(`capturas: ${report.length}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
