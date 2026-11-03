/**
 * RNF-012 — comparação de imagem (tolerância 0,2%) nos estados do mapa/painel web: zona neutra, zona dominada,
 * zona sob ataque e mapa de calor. Dados = seed de demonstração (rode `npm run db:reset` antes); o mapa-base
 * externo é bloqueado no teste para a imagem não depender da internet. Textos que mudam com o relógio
 * (eventos "há N min", prazo do ataque) ficam mascarados.
 * Primeira execução (ou mudança visual aprovada): acrescente `--update-snapshots`.
 */
const { test, expect } = require('playwright/test');

const API = process.env.API_URL || 'http://127.0.0.1:54321';
const ANON = process.env.ANON_KEY || readAnon();
function readAnon() {
  try {
    return /EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '.env'), 'utf8'))[1].trim();
  } catch {
    return '';
  }
}

let zones;
test.beforeAll(async () => {
  const login = await (await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'corredor.demo@nomaderun.app', password: 'Corrida@2026' }),
  })).json();
  const rows = await (await fetch(`${API}/rest/v1/zones?select=id,owner,attacker,blocked&is_demo=eq.true&order=id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${login.access_token}` },
  })).json();
  zones = {
    neutral: rows.find((z) => !z.owner && !z.blocked),
    owned: rows.find((z) => z.owner && !z.attacker),
    attacked: rows.find((z) => z.owner && z.attacker),
  };
});

async function login(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  await page.goto('/');
  const id = (t) => page.locator(`[data-testid="${t}"]`).first();
  await id('tela-entrar').waitFor({ timeout: 30_000 });
  await id('entrar-email').fill('corredor.demo@nomaderun.app');
  await id('entrar-senha').fill('Corrida@2026');
  await id('entrar-botao').click();
  await id('mapa-status').waitFor({ timeout: 30_000 });
  await page.getByText(/Seu time: /).first().waitFor({ timeout: 30_000 });
  return id;
}

test('mapa: zonas dominadas e zona sob ataque (contorno)', async ({ page }) => {
  await login(page);
  await page.waitForTimeout(2500); // tiles bloqueados; espera o desenho das regiões
  await expect(page).toHaveScreenshot('mapa-dominado-ataque.png', { fullPage: false });
});

for (const state of ['neutral', 'owned', 'attacked']) {
  test(`folha da zona: ${state === 'neutral' ? 'neutra' : state === 'owned' ? 'dominada' : 'sob ataque'}`, async ({ page }) => {
    test.skip(!zones[state], `seed sem zona no estado ${state}`);
    const id = await login(page);
    await page.goto(`/zona/${zones[state].id}`);
    await id('tela-zona').waitFor({ timeout: 20_000 });
    if (state !== 'neutral') await id('zona-corredores').waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`zona-${state}.png`, {
      mask: [page.locator('[data-testid="zona-eventos"]'), page.locator('[data-testid="zona-ataque"]'), page.locator('[data-testid="zona-prazo-encerrado"]')],
    });
  });
}

test.fixme('mapa de calor ativo (RF-013 não implementado no MVP)', async () => {});
