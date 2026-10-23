// Renderiza docs/melhoria/F1/ux/wireframes.html em PNG (um por tela + visão geral).
// Uso: NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/ux/renderizar-wireframes.cjs
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const dir = __dirname;
  const out = path.join(dir, 'wireframes');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2200, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(dir, 'wireframes.html'));
  await page.evaluate(() => document.fonts.ready);
  const frames = await page.$$('.frame');
  for (const f of frames) {
    const id = await f.getAttribute('id');
    const cap = await f.$eval('.cap', (e) => e.textContent);
    const slug = cap.split('·')[1].trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await f.screenshot({ path: path.join(out, `${id.slice(1)}-${slug}.png`) });
  }
  await page.screenshot({ path: path.join(out, '00-visao-geral.png'), fullPage: true });
  await browser.close();
  console.log(`${frames.length} telas renderizadas em ${out}`);
})();
