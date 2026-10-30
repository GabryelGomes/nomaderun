/**
 * Quadros da E5 · onda 3 (T7.3.5): abre a galeria `/dev/motion` no export web, toca cada momento com a arte
 * da E4 e fotografa o palco em instantes escolhidos; junta os quadros numa folha de contato por cena.
 *
 * Uso (em apps/mobile, com o cache do Metro isolado — risco R1 da onda 1):
 *   TMPDIR=<pasta própria> npx expo export -p web --output-dir <dist>
 *   NODE_PATH="$(npm root -g)" node ../../docs/melhoria/relatorios/E5-onda3/gerar-quadros.cjs <dist> [saída]
 * Depois: pngquant --quality=70-90 --ext .png --force <saída>/*.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { serve } = require('../../../../apps/mobile/e2e-web/serve.cjs');

const DIST = process.argv[2];
const OUT = process.argv[3] || __dirname;
const PORT = Number(process.env.PORT || 8097);

/** cena → ajustes, chip e instantes (ms) a fotografar */
const SCENES = [
  { name: 'bau-lendario', setup: ['raridade-lendario'], chip: 'bau', at: [0, 700, 800, 900, 1050, 1300, 1800] },
  { name: 'bau-raro', setup: ['raridade-raro'], chip: 'bau', at: [0, 780, 900, 1100, 1600] },
  { name: 'chefao-golpe', setup: ['chefao-mormaco'], chip: 'chefao-golpe', at: [0, 40, 80, 140, 260, 900] },
  { name: 'sequencia', setup: [], chip: 'sequencia', at: [0, 120, 300, 700] },
  { name: 'congelamento', setup: [], chip: 'congelamento', at: [0, 150, 260, 420, 800] },
  { name: 'congelamento-reduzido', setup: ['reduzido-sim'], chip: 'congelamento', at: [0, 100, 300] },
  // web: o leitor de tela não é mais "sempre ligado" (o roteiro toca, com "Pular")
  { name: 'resumo-web', setup: ['raridade-lendario', 'chefao-paredao'], chip: 'resumo', at: [300, 1200, 2400, 3600, 5000] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sheet(browser, title, frames) {
  const page = await browser.newPage({ viewport: { width: 200 * frames.length + 40, height: 400 }, deviceScaleFactor: 1 });
  const cells = frames
    .map((f) => `<figure><img src="data:image/png;base64,${f.png.toString('base64')}"/><figcaption>${f.label}</figcaption></figure>`)
    .join('');
  await page.setContent(`<html><body style="margin:0;background:#070708;color:#A8A6A1;font:13px system-ui;padding:12px 20px">
    <div id="folha" style="display:inline-block;padding:4px"><div style="color:#F3F1ED;font-weight:700;margin-bottom:8px">${title}</div>
    <div style="display:flex;gap:8px">${cells}</div></div>
    <style>figure{margin:0;text-align:center}img{width:192px;border:1px solid #24252B;border-radius:10px;display:block}</style></body></html>`);
  const buf = await page.locator('#folha').screenshot();
  await page.close();
  return buf;
}

(async () => {
  const server = await serve(DIST, PORT);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const errors = [];
  try {
    for (const scene of SCENES) {
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: scene.zoom ? 2 : 1 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${scene.name}: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`${scene.name}: ${m.text()}`));
      await page.goto(`http://127.0.0.1:${PORT}/dev/motion`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="galeria-motion-palco"]');
      for (const s of scene.setup) await page.click(`[data-testid="galeria-motion-${s}"]`);
      const stage = page.locator('[data-testid="galeria-motion-palco"]');
      await stage.scrollIntoViewIfNeeded();
      await page.click(`[data-testid="galeria-motion-${scene.chip}"]`);
      if (scene.press) {
        await page.waitForSelector(`[data-testid="galeria-motion-${scene.press}"]`);
        await sleep(300);
        await page.click(`[data-testid="galeria-motion-${scene.press}"]`);
      }
      const t0 = Date.now();
      const frames = [];
      // "Bora!" é pequeno: fotografa só o botão, de perto
      const target = scene.zoom ? page.locator(`[data-testid="galeria-motion-${scene.press}"]`) : stage;
      const box = scene.zoom ? await target.boundingBox() : null;
      const shot = () => (box ? page.screenshot({ clip: { x: box.x - 36, y: box.y - 36, width: box.width + 72, height: box.height + 72 } }) : stage.screenshot());
      for (const at of scene.at) {
        const wait = at - (Date.now() - t0);
        if (wait > 0) await sleep(wait);
        const real = Date.now() - t0;
        frames.push({ png: await shot(), label: `${real} ms` });
      }
      fs.writeFileSync(path.join(OUT, `folha-${scene.name}.png`), await sheet(browser, scene.name, frames));
      console.log('ok', scene.name);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(errors.length ? `ERROS NO CONSOLE:\n${errors.join('\n')}` : 'sem erros no console');
})();
