/**
 * E8 · onda 1 — transforma os SVGs gerados pelos componentes (`gerar-svgs.web.tsx`) em PNG no Chromium,
 * com as 4 fontes do app embutidas (sem elas o card sai em Times: ver a prova técnica da F1).
 * Grava `<saida>/<nome>.png` (tamanho real) e `<saida>/visao-geral.png` (todos lado a lado, reduzidos).
 *
 * Uso (na raiz): NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E8/rasterizar-cards.cjs <pasta-dos-svgs>
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../../../..');
const FONTS = path.join(ROOT, 'apps/mobile/node_modules/@expo-google-fonts');
const FILES = {
  InterTight_800ExtraBold: 'inter-tight/800ExtraBold/InterTight_800ExtraBold.ttf',
  InterTight_600SemiBold: 'inter-tight/600SemiBold/InterTight_600SemiBold.ttf',
  Inter_700Bold: 'inter/700Bold/Inter_700Bold.ttf',
  Inter_500Medium: 'inter/500Medium/Inter_500Medium.ttf',
};

const dir = process.argv[2];
if (!dir) throw new Error('informe a pasta dos SVGs');

(async () => {
  const faces = Object.entries(FILES)
    .map(([n, f]) => `@font-face{font-family:'${n}';src:url(data:font/ttf;base64,${fs.readFileSync(path.join(FONTS, f)).toString('base64')})}`)
    .join('');
  const svgs = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const load = async (body, bg) => {
    await page.setContent(`<html><head><style>${faces} body{margin:0;background:${bg}} svg{display:block}</style></head><body>${body}</body></html>`);
    await page.evaluate(async (names) => Promise.all(names.map((n) => document.fonts.load(`40px '${n}'`))), Object.keys(FILES));
  };
  for (const f of svgs) {
    const svg = fs.readFileSync(path.join(dir, f), 'utf8');
    await load(svg, 'transparent');
    await page.locator('svg').first().screenshot({ path: path.join(dir, f.replace(/\.svg$/, '.png')), omitBackground: true });
  }
  // visão geral: os Stories lado a lado (reduzidos) + o adesivo sobre um fundo claro de "foto".
  // Usa os PNGs já gerados: SVGs renderizados em separado repetem ids e não podem dividir a mesma página.
  const pick = svgs.filter((f) => f.includes('-stories') || f === 'adesivo.svg');
  const tiles = pick
    .map((f) => {
      const png = fs.readFileSync(path.join(dir, f.replace(/\.svg$/, '.png'))).toString('base64');
      const sticker = f === 'adesivo.svg';
      const bg = sticker ? 'background:linear-gradient(160deg,#d9c7a8,#8fb3c9);' : '';
      return `<figure style="margin:0;display:flex;flex-direction:column;gap:8px"><div style="${bg}border-radius:12px;overflow:hidden;width:270px"><img src="data:image/png;base64,${png}" style="display:block;width:270px"/></div><figcaption style="font:500 14px 'Inter_500Medium';color:#A8A6A1">${f.replace('.svg', '')}</figcaption></figure>`;
    })
    .join('');
  await load(`<div id="g" style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px;padding:24px;width:${5 * 270 + 6 * 24}px;background:#050506">${tiles}</div>`, '#050506');
  await page.locator('#g').screenshot({ path: path.join(dir, 'visao-geral.png') });
  await browser.close();
  console.log(`${svgs.length} PNGs + visão geral em ${dir}`);
})();
