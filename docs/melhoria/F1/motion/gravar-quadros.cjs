/**
 * Grava os quadros PNG dos protótipos de motion (F1, E5) e uma folha de contato por cena.
 * Uso (na raiz do repositório):
 *   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/motion/gravar-quadros.cjs
 * Cada quadro é o protótipo congelado no instante `t` (Web Animations pausadas + currentTime), então
 * a sequência é determinística: o mesmo t dá sempre a mesma imagem.
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const DIR = __dirname;
const OUT = path.join(DIR, 'quadros');
const PAGE = 'file://' + path.join(DIR, 'prototipo.html');

const RUNS = [
  { id: 'zona', q: 'cena=zona', times: [0, 120, 300, 540, 720, 820, 1000, 1300, 1700] },
  { id: 'zona-reduzido', q: 'cena=zona&reduzido=1', times: [0, 75, 200] },
  { id: 'zona-corrida', q: 'cena=zona-corrida', times: [0, 120, 250, 500, 1500, 2700] },
  { id: 'bau', q: 'cena=bau&raridade=raro', times: [0, 100, 300, 500, 680, 760, 850, 950, 1100, 1300, 1600] },
  { id: 'bau-lendario', q: 'cena=bau&raridade=lendario', times: [780, 950, 1200, 1700] },
  { id: 'bau-reduzido', q: 'cena=bau&reduzido=1', times: [0, 100, 300] },
  { id: 'chefao', q: 'cena=chefao', times: [0, 320, 345, 400, 480, 600, 800, 1100] },
  { id: 'chefao-reduzido', q: 'cena=chefao&reduzido=1', times: [300, 500, 900] },
  { id: 'chefao-derrota', q: 'cena=chefao-derrota', times: [0, 200, 500, 680, 760, 950, 1200, 1500, 2100, 2500] },
  { id: 'time', q: 'cena=time', times: [0, 120, 300, 450, 600, 720, 900, 1200, 1600, 2100] },
  { id: 'time-reduzido', q: 'cena=time&reduzido=1', times: [0, 150, 500] },
  { id: 'resumo', q: 'cena=resumo', times: [0, 500, 900, 1300, 1800, 2300, 2800, 3200, 3800, 4300, 4600, 5300, 5700, 6500, 7000, 7600, 8600] },
  { id: 'resumo-pular', q: 'cena=resumo&pular=3000', times: [2900, 3000] },
  { id: 'resumo-reduzido', q: 'cena=resumo&reduzido=1', times: [0, 200, 600] },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 690, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const sheets = [];
  for (const run of RUNS) {
    await page.goto(`${PAGE}?${run.q}&t=0`);
    await page.evaluate(() => document.fonts.ready);
    const files = [];
    for (const t of run.times) {
      await page.evaluate((tt) => window.seek(tt), t);
      const name = `${run.id}-${String(t).padStart(5, '0')}ms.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      files.push({ name, t });
    }
    sheets.push({ run, files });
    console.log(run.id, files.length, 'quadros');
  }
  // folhas de contato: só o telefone (390 px de largura), 5 por linha, com o tempo embaixo
  for (const { run, files } of sheets) {
    const cols = Math.min(5, files.length);
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#000;font:600 13px Inter,sans-serif;color:#F3F1ED}
      .g{display:grid;grid-template-columns:repeat(${cols},234px);gap:10px;padding:12px}
      .f{width:234px;height:506px;overflow:hidden;border:1px solid #24252B;border-radius:10px;position:relative;background:#070708}
      .f img{width:414px;height:506px;object-fit:cover;object-position:0 0}
      .f span{position:absolute;left:6px;bottom:6px;background:#FF6A13;color:#111;padding:2px 7px;border-radius:999px;font-weight:800}
      h1{margin:12px 12px 0;font-size:16px}</style>
      <h1>${run.id} · ${run.q}</h1><div class="g">${files
        .map((f) => `<div class="f"><img src="file://${path.join(OUT, f.name)}"><span>${f.t} ms</span></div>`)
        .join('')}</div>`;
    const tmp = path.join(OUT, `_sheet-${run.id}.html`);
    fs.writeFileSync(tmp, html);
    const rows = Math.ceil(files.length / cols);
    const p2 = await ctx.newPage();
    await p2.setViewportSize({ width: cols * 244 + 24, height: rows * 516 + 60 });
    await p2.goto('file://' + tmp);
    await p2.waitForLoadState('load');
    await p2.screenshot({ path: path.join(OUT, `folha-${run.id}.png`), fullPage: true });
    await p2.close();
    fs.unlinkSync(tmp);
  }
  await browser.close();
  // Reduz o peso no repositório: paleta de 128 cores sem pontilhado (as telas são escuras e chapadas).
  try {
    require('node:child_process').execFileSync('python3', ['-I', '-c', [
      'import glob,sys', 'from PIL import Image',
      'for f in glob.glob(sys.argv[1]+"/*.png"):',
      '    Image.open(f).convert("RGB").quantize(colors=128, dither=Image.Dither.NONE).save(f, optimize=True)',
    ].join('\n'), OUT]);
  } catch (e) {
    console.warn('Sem Pillow: quadros ficam sem compressão.', e.message);
  }
})();
