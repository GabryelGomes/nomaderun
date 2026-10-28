// Assets da E4 (onda 3): gera, a partir da MESMA geometria dos componentes, os PNGs e SVGs de
// `apps/mobile/assets/art/`:
//   - ícone da aba Correr (`tab-icon/run-tab-art.ts`): 28 px em 1×, 2× e 3×, padrão (contorno) e selecionado
//     (cheio), sempre laranja, mais os SVGs;
//   - splash (`logo/logo-art.ts`, símbolo): mestre de 1024 px transparente e as 5 densidades do Android para
//     `imageWidth` 180 (mdpi 180, hdpi 270, xhdpi 360, xxhdpi 540, xxxhdpi 720), mais a prévia do relatório.
// O `app.json` NÃO é alterado aqui: o coordenador liga os arquivos (trecho no relatório E4-onda3).
//
// Uso (na raiz do repositório):
//   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E4-onda3/gerar-assets.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { art, ART } = require('../E4-onda2/gerar-evidencia.cjs');

const ROOT = path.resolve(__dirname, '../../../..');
const OUT = path.join(ROOT, 'apps/mobile/assets/art');
const { expand } = art('neon/core.ts');
const { primsToMarkup, svgMarkup } = art('neon/markup.ts');
const tab = art('tab-icon/run-tab-art.ts');
const lg = art('logo/logo-art.ts');

const tabSvg = (variant, width) => svgMarkup(tab.RUN_TAB_BOX.vbW, tab.RUN_TAB_BOX.vbH, primsToMarkup(expand(tab.runTabNodes(variant), 'plano')), width);
const logoSvg = (width, quality) => svgMarkup(200, 200, primsToMarkup(expand(lg.logoNodes('simbolo'), quality)), width);

/** Página transparente W × W com o SVG no centro. No splash grande, o brilho ganha a cópia desfocada por baixo
 *  (só na rasterização offline, como no ícone da onda 2: o componente e os SVGs continuam sem filtro). */
function pageFor(W, svg, under = '') {
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${W}px;height:${W}px;background:transparent}
  .l{position:absolute;inset:0;display:flex;align-items:center;justify-content:center} svg{display:block}</style>${under}<div class="l">${svg}</div>`;
}
function splashPage(W) {
  const soft = W >= 256 ? `<div class="l" style="filter:blur(${Math.round(W * 0.028)}px);opacity:0.95">${logoSvg(W, 'completo')}</div>` : '';
  return pageFor(W, logoSvg(W, 'completo'), soft);
}

const FILES = [];
for (const [variant, suffix] of [
  ['padrao', ''],
  ['selecionado', '-selecionado'],
]) {
  for (const [scale, tag] of [
    [1, ''],
    [2, '@2x'],
    [3, '@3x'],
  ])
    FILES.push({ file: `aba-correr${suffix}${tag}.png`, W: 28 * scale, html: pageFor(28 * scale, tabSvg(variant, 28 * scale)) });
}
FILES.push({ file: 'splash-simbolo.png', W: 1024, html: splashPage(1024) });
for (const [dpi, m] of [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
])
  FILES.push({ file: `splash-simbolo-${dpi}.png`, W: 180 * m, html: splashPage(180 * m) });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'aba-correr.svg'), tabSvg('padrao', 28));
  fs.writeFileSync(path.join(OUT, 'aba-correr-selecionado.svg'), tabSvg('selecionado', 28));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const f of FILES) {
    const ctx = await browser.newContext({ viewport: { width: f.W, height: f.W }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.setContent(f.html);
    const file = path.join(OUT, f.file);
    await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: f.W, height: f.W } });
    await ctx.close();
    try {
      execFileSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', file]);
    } catch {
      // sem pngquant ou sem ganho: fica o original
    }
    console.log('ok', f.file);
  }

  // Prévia para o relatório: splash como o sistema mostra (iOS sem máscara; Android 12+ com o círculo de
  // 192 dp num quadro de 288 dp) e o ícone da aba numa barra escura de 5 abas, nos 3 tamanhos.
  const uri = (f) => `data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}`;
  const phone = (inner, label) =>
    `<figure><div style="position:relative;width:240px;height:480px;border-radius:28px;background:${ART.bg};border:2px solid #2b2e35;overflow:hidden;display:flex;align-items:center;justify-content:center">${inner}</div><figcaption>${label}</figcaption></figure>`;
  const android12 = `<div style="width:216px;height:216px;position:relative;display:flex;align-items:center;justify-content:center"><div style="position:absolute;width:144px;height:144px;border-radius:50%;border:1px dashed #FF6A13"></div><img src="${uri('splash-simbolo-xhdpi.png')}" style="width:135px;height:135px"></div>`;
  const slot = (inner, label, on) => `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:64px;color:${on ? '#FF6A13' : '#8b8a87'};font:600 10px Arial">${inner}<span>${label}</span></div>`;
  const gray = (d) => `<svg width="24" height="24" viewBox="0 0 24 24"><path d="${d}" fill="#8b8a87"/></svg>`;
  const bar = (sel) =>
    `<div style="display:flex;justify-content:space-around;align-items:flex-end;padding:8px 6px 10px;background:#0F1013;border-top:1px solid #24252B;width:340px">
    ${slot(gray('M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z'), 'Mapa')}${slot(gray('M4 8h16v8H4z'), 'Arena')}
    ${slot(`<img src="${uri(sel ? 'aba-correr-selecionado@3x.png' : 'aba-correr@3x.png')}" style="width:28px;height:28px">`, 'Correr', sel)}
    ${slot(gray('M8 8a3 3 0 1 0 0.1 0M16 8a3 3 0 1 0 0.1 0M3 18c0-4 10-4 10 0M11 18c0-4 10-4 10 0'), 'Clube')}${slot(gray('M12 4a4 4 0 1 0 0.1 0M4 20c0-6 16-6 16 0'), 'Você')}</div>`;
  const preview = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1d1f24;font:12px Arial;color:#ccc;padding:24px;width:1180px}
  h1{font:800 13px Arial;letter-spacing:2.4px;color:${ART.orange};text-transform:uppercase;margin:0 0 14px}
  .g{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start} figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}</style>
  <h1>NOMADE RUN · E4 · Splash (fundo #070708, símbolo do logo) e ícone laranja da aba Correr</h1><div class="g">
  ${phone(`<img src="${uri('splash-simbolo.png')}" style="width:180px;height:180px">`, 'iOS · imageWidth 180')}
  ${phone(android12, 'Android 12+ · círculo de 192 dp (tracejado)')}
  <figure><div style="display:flex;flex-direction:column;gap:14px">${bar(false)}${bar(true)}
  <div style="display:flex;gap:16px;align-items:center;background:#0F1013;padding:12px;border-radius:12px">${['aba-correr.png', 'aba-correr@2x.png', 'aba-correr@3x.png', 'aba-correr-selecionado.png', 'aba-correr-selecionado@2x.png', 'aba-correr-selecionado@3x.png'].map((f) => `<img src="${uri(f)}" title="${f}">`).join('')}</div></div>
  <figcaption>barra de abas: Correr não selecionada (contorno) e selecionada (cheio), sempre laranja · os 6 PNGs em tamanho real (1×, 2×, 3×)</figcaption></figure>
  </div>`;
  const pv = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  await pv.setContent(preview);
  const out = path.join(process.env.OUT_DIR || __dirname, 'splash-e-aba.png');
  await pv.screenshot({ path: out, fullPage: true });
  try {
    execFileSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', out]);
  } catch {
    // idem
  }
  console.log('ok splash-e-aba.png (prévia)');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
