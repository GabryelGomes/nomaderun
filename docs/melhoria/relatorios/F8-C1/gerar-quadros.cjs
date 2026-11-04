/**
 * Quadros da E5 · F8 onda C (C1): abre a galeria `/dev/motion` no export web, toca cada animação nova e fotografa o
 * palco em instantes escolhidos; junta os quadros numa folha de contato por cena. Base: `E5-onda3/gerar-quadros.cjs`.
 *
 * Uso (em apps/mobile, com o cache do Metro isolado):
 *   TMPDIR=<pasta própria> npx expo export -p web --output-dir <dist>
 *   NODE_PATH="$(npm root -g)" node ../../docs/melhoria/relatorios/F8-C1/gerar-quadros.cjs <dist> [saída]
 * Depois: pngquant --quality=70-90 --ext .png --force <saída>/*.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { serve } = require('../../../../apps/mobile/e2e-web/serve.cjs');

const DIST = process.argv[2];
const OUT = process.argv[3] || __dirname;
const PORT = Number(process.env.PORT || 8107);

/** cena → ajustes (testIDs sem o prefixo), o que tocar para começar e os instantes (ms) a fotografar */
const SCENES = [
  { name: 'capa-toque', setup: ['time-volt', 'capa'], play: 'capas-volt', at: [0, 60, 120, 220, 360, 700] },
  { name: 'capa-confirmar', setup: ['time-volt', 'capa'], play: 'capa-confirmar', at: [0, 120, 240, 450] },
  { name: 'cerimonia-rastro', setup: ['time-volt'], play: 'cerimonia', at: [200, 700, 1200, 1600, 1900, 2200, 2700] },
  { name: 'cerimonia-reduzida', setup: ['time-volt', 'reduzido-sim'], play: 'cerimonia', at: [0, 80, 200] },
  { name: 'primeiro-trecho', setup: ['time-striders'], play: 'primeiro-trecho', at: [0, 150, 350, 480, 600, 1100, 1450] },
  { name: 'bairro-antes-depois', setup: ['time-owls'], play: 'bairro', at: [0, 400, 700, 900, 1100, 1500] },
  { name: 'chefao-abre-fase', setup: ['chefao-mormaco'], play: 'chefao-fase', at: [0, 120, 420, 600, 800, 1000, 1400] },
  { name: 'semana-do-time', setup: ['time-coyotes'], play: 'semana-time', at: [0, 100, 250, 500, 900] },
  { name: 'carimbo-bairro', setup: [], play: 'carimbo-bairro', at: [0, 80, 160, 260, 600] },
  { name: 'recorde-trechos', setup: [], play: 'recorde-trechos', at: [100, 400, 650, 800, 1000, 1300] },
  { name: 'lider-comenta', setup: ['time-striders'], play: 'lider', at: [0, 450, 900, 1250, 1500, 1800] },
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
    for (const scene of SCENES.filter((s) => !process.env.ONLY || s.name.includes(process.env.ONLY))) {
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${scene.name}: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`${scene.name}: ${m.text()}`));
      await page.goto(`http://127.0.0.1:${PORT}/dev/motion`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="galeria-motion-palco"]');
      for (const s of scene.setup) {
        await page.click(`[data-testid="galeria-motion-${s}"]`);
        await sleep(200);
      }
      const stage = page.locator('[data-testid="galeria-motion-palco"]');
      await stage.scrollIntoViewIfNeeded();
      await sleep(700); // o carrossel termina de rolar até o time
      await page.click(`[data-testid="galeria-motion-${scene.play}"]`);
      const t0 = Date.now();
      const frames = [];
      for (const at of scene.at) {
        const wait = at - (Date.now() - t0);
        if (wait > 0) await sleep(wait);
        const real = Date.now() - t0;
        frames.push({ png: await stage.screenshot(), label: `${real} ms` });
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
