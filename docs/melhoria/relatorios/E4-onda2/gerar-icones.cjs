// Ícones e arquivos do logo oficial (E4, onda 2): gera, a partir da MESMA geometria do componente `Logo`
// (`apps/mobile/src/components/art/logo/logo-art.ts`), os PNGs do ícone e os SVGs do logo em
// `apps/mobile/assets/art/`. O `app.json` NÃO é alterado aqui: o coordenador liga os arquivos.
//
// Uso (na raiz do repositório):
//   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E4-onda2/gerar-icones.cjs
// Depois: pngquant --quality=85-98 nos PNGs (o script já chama, se o pngquant existir).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { art, ART } = require('./gerar-evidencia.cjs');

const ROOT = path.resolve(__dirname, '../../../..');
const OUT = path.join(ROOT, 'apps/mobile/assets/art');
const { expand, recolorPrims } = art('neon/core.ts');
const { primsToMarkup, svgMarkup } = art('neon/markup.ts');
const lg = art('logo/logo-art.ts');

/** SVG do logo (transparente), na qualidade pedida; `mono` = uma cor só, sem brilho. */
function logoSvg(variant, width, { mono, quality = 'completo' } = {}) {
  const box = lg.LOGO_BOX[variant];
  let prims = expand(lg.logoNodes(variant, mono), mono ? 'plano' : quality);
  if (mono) prims = recolorPrims(prims, mono);
  return svgMarkup(box.vbW, box.vbH, primsToMarkup(prims), width);
}

/**
 * Página de W × H com o fundo pedido e o símbolo centrado em `symbol` px. No raster grande, o brilho ganha
 * uma cópia desfocada por baixo (só aqui, na rasterização offline do PNG: o componente e os SVGs continuam
 * sem filtro). Em tamanhos pequenos e no monocromático, fica só o traço em camadas.
 */
function iconPage(W, H, symbol, { bg = 'transparent', mono } = {}) {
  const glow = bg === 'transparent' ? '' : `background:radial-gradient(circle at 50% 50%, #1C1009 0%, #0D0A09 38%, ${ART.bg} 70%);`;
  const soft = !mono && symbol >= 256;
  const under = soft ? `<div class="l" style="filter:blur(${Math.round(symbol * 0.028)}px);opacity:0.95">${logoSvg('simbolo', symbol)}</div>` : '';
  const top = logoSvg('simbolo', symbol, { mono, quality: symbol >= 96 ? 'completo' : 'leve' });
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${W}px;height:${H}px;background:${bg};${glow}}
  .c{position:relative;width:${W}px;height:${H}px} .l{position:absolute;inset:0;display:flex;align-items:center;justify-content:center} svg{display:block}</style>
  <div class="c">${under}<div class="l">${top}</div></div>`;
}

const ICONS = [
  // iOS e loja: quadrado opaco (o sistema arredonda os cantos). Símbolo a 74% do lado.
  { file: 'icone-1024.png', W: 1024, H: 1024, symbol: 760, bg: ART.bg },
  // Android adaptativo: frente transparente com o símbolo dentro da zona segura (círculo de 66% = 676 px).
  { file: 'android-icone-frente.png', W: 1024, H: 1024, symbol: 540 },
  { file: 'android-icone-fundo.png', W: 1024, H: 1024, symbol: 0, bg: ART.bg },
  { file: 'android-icone-monocromatico.png', W: 1024, H: 1024, symbol: 540, mono: '#FFFFFF' },
  // Web (favicon) e uma prévia pequena para conferir a leitura em 48 px.
  { file: 'favicon-48.png', W: 48, H: 48, symbol: 46, bg: ART.bg },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'logo-simbolo.svg'), logoSvg('simbolo', 512));
  fs.writeFileSync(path.join(OUT, 'logo-logotipo.svg'), logoSvg('logotipo', 800));
  fs.writeFileSync(path.join(OUT, 'logo-horizontal.svg'), logoSvg('horizontal', 960));
  fs.writeFileSync(path.join(OUT, 'logo-simbolo-mono.svg'), logoSvg('simbolo', 512, { mono: '#FFFFFF' }));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const ic of ICONS) {
    const ctx = await browser.newContext({ viewport: { width: ic.W, height: ic.H }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const html = ic.symbol ? iconPage(ic.W, ic.H, ic.symbol, { bg: ic.bg, mono: ic.mono }) : iconPage(ic.W, ic.H, 1, { bg: ic.bg }).replace(/<svg[\s\S]*<\/svg>/, '');
    await tab.setContent(html);
    const file = path.join(OUT, ic.file);
    await tab.screenshot({ path: file, omitBackground: !ic.bg, clip: { x: 0, y: 0, width: ic.W, height: ic.H } });
    await ctx.close();
    try {
      execFileSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', file]);
    } catch {
      // pngquant ausente ou sem ganho: fica o PNG original.
    }
    console.log('ok', ic.file);
  }
  // Prévia para o relatório: os PNGs como o sistema mostra (máscara do iOS, círculo e "squircle" do Android,
  // monocromático com o tema do sistema) e em tamanho real.
  const uri = (f) => `data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}`;
  const cell = (label, inner, cls = '') => `<figure><div class="box ${cls}">${inner}</div><figcaption>${label}</figcaption></figure>`;
  const layer = (f, extra = '') => `<img src="${uri(f)}" style="position:absolute;inset:0;width:100%;height:100%;${extra}">`;
  const adaptive = (radius) =>
    `<div style="position:relative;width:220px;height:220px;border-radius:${radius};overflow:hidden">${layer('android-icone-fundo.png', 'transform:scale(1.5)')}${layer('android-icone-frente.png', 'transform:scale(1.5)')}</div>`;
  const preview = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1d1f24;font:12px Arial;color:#ccc;padding:24px;width:1180px}
  h1{font:800 13px Arial;letter-spacing:2.4px;color:${ART.orange};text-transform:uppercase;margin:0 0 14px}
  .g{display:flex;flex-wrap:wrap;gap:14px} figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
  .box{display:flex;align-items:center;justify-content:center;width:240px;height:240px;background:#2b2e35;border-radius:12px;gap:10px} .wide{width:auto;padding:0 14px}
  .chk{background:repeating-conic-gradient(#3a3d44 0 25%,#2b2e35 0 50%) 0 0/24px 24px}</style>
  <h1>NOMADE RUN · E4 · Ícone do app (apps/mobile/assets/art) · máscaras do sistema e tamanho real</h1><div class="g">
  ${cell('iOS · icone-1024.png (máscara do sistema)', `<img src="${uri('icone-1024.png')}" style="width:220px;height:220px;border-radius:48px">`)}
  ${cell('Android adaptativo · círculo', adaptive('50%'))}
  ${cell('Android adaptativo · squircle', adaptive('34%'))}
  ${cell('frente (transparente) e a zona segura de 66%', `<div class="chk" style="position:relative;width:220px;height:220px">${layer('android-icone-frente.png')}<div style="position:absolute;left:37px;top:37px;width:146px;height:146px;border:1px dashed #FF6A13;border-radius:50%"></div></div>`)}
  ${cell('monocromático (tema do sistema, Android 13+)', `<div style="position:relative;width:220px;height:220px;border-radius:50%;background:#3d4a5c;overflow:hidden">${layer('android-icone-monocromatico.png', 'transform:scale(1.5);opacity:0.85')}</div>`)}
  ${cell('tamanho real · 120, 60 e 40 pt e o favicon de 48', `<img src="${uri('icone-1024.png')}" style="width:120px;border-radius:26px"><img src="${uri('icone-1024.png')}" style="width:60px;border-radius:13px"><img src="${uri('icone-1024.png')}" style="width:40px;border-radius:9px"><img src="${uri('favicon-48.png')}" style="width:48px">`, 'wide')}
  </div>`;
  const pv = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  await pv.setContent(preview);
  await pv.screenshot({ path: path.join(__dirname, 'icones.png'), fullPage: true });
  console.log('ok icones.png (prévia)');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
