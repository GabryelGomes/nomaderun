/**
 * E8 (onda 2, T7.2.5) — evidência: o PNG que o PRÓPRIO APP gera na web, no modo demonstração.
 *
 * Abre `/compartilhar/<corrida>` no export web (`EXPO_PUBLIC_DEMO=1`, `--clear`), escolhe cada modelo do
 * carrossel e cada formato e toca no botão principal. No Chromium de desktop não há Web Share com arquivo,
 * então o app BAIXA o PNG (caminho `share-image.web.ts`: fonte embutida → canvas → Blob); o script salva o
 * download. Também tira capturas da tela (390 px) e da página do convite.
 *
 * Uso (na raiz do repositório):
 *   cd apps/mobile && EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dist>
 *   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E8/capturar-onda2.cjs <dist> <saida>
 *   pngquant --quality=85-98 --ext .png --force <saida>/*.png
 */
const fs = require('node:fs');
const path = require('node:path');

const { serve } = require(path.join(__dirname, '../../../../apps/mobile/e2e-web/serve.cjs'));

const [dist, out] = process.argv.slice(2);
if (!dist || !out) {
  console.error('uso: node capturar-onda2.cjs <dist> <saida>');
  process.exit(2);
}
const PORT = 8131;
const CLOCK = new Date('2026-10-23T09:00:00-03:00');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const server = await serve(dist, PORT);
  const base = `http://127.0.0.1:${PORT}`;
  const report = { downloads: [], errors: [], external: [] };
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true });
    await ctx.clock.setFixedTime(CLOCK);
    await ctx.route((u) => !u.toString().startsWith(base), (r) => {
      report.external.push(r.request().url().slice(0, 120));
      return r.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(String(e).slice(0, 300)));

    const tid = (id) => page.locator(`[data-testid="${id}"]`).first();
    const open = async (url) => {
      await page.goto(`${base}${url}`, { waitUntil: 'networkidle' });
      await tid('compartilhar-formato-stories').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);
    };
    const download = async (name) => {
      const btn = (await tid('compartilhar-enviar').count()) ? tid('compartilhar-enviar') : tid('compartilhar-baixar');
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), btn.click()]);
      const file = path.join(out, `${name}.png`);
      await dl.saveAs(file);
      report.downloads.push({ name, suggested: dl.suggestedFilename(), bytes: fs.statSync(file).size });
      await tid('compartilhar-pronto').waitFor({ timeout: 10_000 });
    };

    // 1) Corrida mais recente com os momentos de demonstração (chefão, nível, zona, corrida).
    await open('/compartilhar/demo-corrida-1?momentos=1');
    await page.screenshot({ path: path.join(out, 'tela-compartilhar-390.png'), fullPage: true });
    const models = await page.locator('[data-testid^="compartilhar-modelo-"]').count();
    const labels = [];
    for (let i = 0; i < Math.max(1, models); i++) {
      if (models) await tid(`compartilhar-modelo-${i}`).click();
      await page.waitForTimeout(400);
      const label = models ? await tid(`compartilhar-modelo-${i}`).getAttribute('aria-label') : 'Modelo Corrida';
      const slug = (label ?? `modelo-${i}`).replace(/^Modelo /, '').replace(/, .*$/, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
      labels.push(slug);
      await download(`app-${String(i + 1).padStart(2, '0')}-${slug}-stories`);
    }
    // Feed e adesivo do modelo "Corrida" (o último do carrossel).
    await tid('compartilhar-formato-feed').click();
    await page.waitForTimeout(400);
    const feedModels = await page.locator('[data-testid^="compartilhar-modelo-"]').count();
    if (feedModels) await tid(`compartilhar-modelo-${feedModels - 1}`).click();
    await page.waitForTimeout(300);
    await download('app-corrida-feed');
    if (feedModels > 1) {
      await tid('compartilhar-modelo-0').click();
      await page.waitForTimeout(300);
      await download(`app-${labels[0]}-feed`);
    }
    await tid('compartilhar-formato-adesivo').click();
    await page.waitForTimeout(400);
    await download('app-adesivo');

    // 2) Versão sem rota: "Mostrar rota" desligado.
    await open('/compartilhar/demo-corrida-2');
    await tid('compartilhar-rota').click();
    await page.waitForTimeout(400);
    const n2 = await page.locator('[data-testid^="compartilhar-modelo-"]').count();
    if (n2) await tid(`compartilhar-modelo-${n2 - 1}`).click();
    await page.waitForTimeout(300);
    await download('app-corrida-sem-rota-stories');
    await page.screenshot({ path: path.join(out, 'tela-compartilhar-sem-rota-390.png') });

    // 3) Página do convite (link da crew).
    await page.goto(`${base}/compartilhar/convite/DEMOFLR1`, { waitUntil: 'networkidle' });
    await tid('convite-copiar').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, 'tela-convite-390.png') });

    // 4) Feed da crew de demonstração (6 corridas) e um "Bora!" num colega.
    await page.goto(`${base}/compartilhar/feed`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid^="feed-item-"]').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    report.feedItems = await page.locator('[data-testid^="feed-item-"]').count();
    await page.screenshot({ path: path.join(out, 'tela-feed-crew-390.png'), fullPage: true });
    const bora = tid('feed-feed-demo-colega-1-bora');
    report.boraBefore = await bora.getAttribute('aria-label');
    await bora.click();
    await page.waitForTimeout(600);
    report.boraAfter = await bora.getAttribute('aria-label');
    await page.locator('[data-testid="feed-item-feed-demo-colega-1"]').screenshot({ path: path.join(out, 'feed-bora-390.png') });
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
