/**
 * E8 (onda 3, T7.3.7) — evidência: o PNG que o PRÓPRIO APP gera na web, no modo demonstração, agora com a arte
 * da E4 (logo, mascote, chefão), o recap semanal e o "Bora!" ao vivo no feed.
 *
 * Uso (na raiz do repositório):
 *   cd apps/mobile && EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dist>
 *   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E8/capturar-onda3.cjs <dist> <saida>
 *   pngquant --quality=85-98 --ext .png --force <saida>/*.png
 */
const fs = require('node:fs');
const path = require('node:path');

const { serve } = require(path.join(__dirname, '../../../../apps/mobile/e2e-web/serve.cjs'));

const [dist, out] = process.argv.slice(2);
if (!dist || !out) {
  console.error('uso: node capturar-onda3.cjs <dist> <saida>');
  process.exit(2);
}
const PORT = 8133;
const CLOCK = new Date('2026-10-23T09:00:00-03:00');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const server = await serve(dist, PORT);
  const base = `http://127.0.0.1:${PORT}`;
  const report = { downloads: [], errors: [], external: [] };
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'no-preference', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true });
    await ctx.clock.setFixedTime(CLOCK);
    await ctx.route((u) => !u.toString().startsWith(base), (r) => {
      report.external.push(r.request().url().slice(0, 120));
      return r.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(String(e).slice(0, 300)));
    const tid = (id) => page.locator(`[data-testid="${id}"]`).first();
    const download = async (name, prefix = 'compartilhar') => {
      const btn = (await tid(`${prefix}-enviar`).count()) ? tid(`${prefix}-enviar`) : tid(`${prefix}-baixar`);
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), btn.click()]);
      const file = path.join(out, `${name}.png`);
      await dl.saveAs(file);
      report.downloads.push({ name, suggested: dl.suggestedFilename(), bytes: fs.statSync(file).size });
      await tid(`${prefix}-pronto`).waitFor({ timeout: 10_000 });
    };
    const open = async (url, ready) => {
      await page.goto(`${base}${url}`, { waitUntil: 'networkidle' });
      await tid(ready).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);
    };

    // 1) Os 4 modelos da corrida (momentos de demonstração), Stories.
    await open('/compartilhar/demo-corrida-1?momentos=1', 'compartilhar-formato-stories');
    const models = await page.locator('[data-testid^="compartilhar-modelo-"]').count();
    const slugs = [];
    for (let i = 0; i < Math.max(1, models); i++) {
      if (models) await tid(`compartilhar-modelo-${i}`).click();
      await page.waitForTimeout(400);
      const label = models ? await tid(`compartilhar-modelo-${i}`).getAttribute('aria-label') : 'Modelo Corrida';
      const slug = (label ?? `modelo-${i}`).replace(/^Modelo /, '').replace(/, .*$/, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
      slugs.push(slug);
      await download(`app-${String(i + 1).padStart(2, '0')}-${slug}-stories`);
    }
    // Feed do chefão e da corrida, com o @ ligado (o @ fica sob o logotipo).
    await tid('compartilhar-formato-feed').click();
    await page.waitForTimeout(400);
    await tid('compartilhar-modelo-0').click();
    await page.waitForTimeout(300);
    await download(`app-${slugs[0]}-feed`);
    await tid('compartilhar-formato-adesivo').click();
    await page.waitForTimeout(400);
    await download('app-adesivo');

    // 2) Sem rota (mascote no centro da "rota protegida").
    await open('/compartilhar/demo-corrida-2', 'compartilhar-formato-stories');
    await tid('compartilhar-rota').click();
    await page.waitForTimeout(400);
    const n2 = await page.locator('[data-testid^="compartilhar-modelo-"]').count();
    if (n2) await tid(`compartilhar-modelo-${n2 - 1}`).click();
    await page.waitForTimeout(300);
    await download('app-corrida-sem-rota-stories');

    // 3) Recap semanal (modelo 5): Stories, Feed e sem rotas.
    await open('/compartilhar/semana', 'semana-formato-stories');
    await page.screenshot({ path: path.join(out, 'tela-semana-390.png'), fullPage: true });
    await download('app-05-minha-semana-stories', 'semana');
    await tid('semana-formato-feed').click();
    await page.waitForTimeout(400);
    await download('app-05-minha-semana-feed', 'semana');
    await tid('semana-formato-stories').click();
    await tid('semana-rota').click();
    await page.waitForTimeout(400);
    await download('app-05-minha-semana-sem-rotas-stories', 'semana');

    // 4) Feed: "Bora!" da E5 num colega e o aplauso ao vivo (Realtime de demonstração, ~4 s).
    await page.goto(`${base}/compartilhar/feed`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid^="feed-item-"]').first().waitFor({ timeout: 30_000 });
    // a corrida mais recente do corredor de demonstração (só o próprio item tem "Tirar do feed")
    const mineId = (await page.locator('[data-testid$="-tirar"]').first().getAttribute('data-testid')).replace(/^feed-/, '').replace(/-tirar$/, '');
    const first = tid(`feed-item-${mineId}`);
    const total = tid(`feed-${mineId}-bora-total`);
    await first.screenshot({ path: path.join(out, 'feed-antes-ao-vivo-390.png') });
    report.liveBefore = (await total.count()) ? await total.getAttribute('aria-label') : null;
    await page.waitForTimeout(5200);
    report.liveAfter = (await total.count()) ? await total.getAttribute('aria-label') : null;
    await first.screenshot({ path: path.join(out, 'feed-ao-vivo-390.png') });
    const bora = tid('feed-feed-demo-colega-1-bora');
    report.boraBefore = await bora.getAttribute('aria-label');
    await bora.click();
    await page.waitForTimeout(120); // no meio do pulo e das faíscas
    await page.locator('[data-testid="feed-item-feed-demo-colega-1"]').screenshot({ path: path.join(out, 'feed-bora-e5-390.png') });
    await page.waitForTimeout(600);
    report.boraAfter = await bora.getAttribute('aria-label');
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(out, 'relatorio.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
