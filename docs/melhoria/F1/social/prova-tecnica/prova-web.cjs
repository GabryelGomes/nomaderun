/**
 * Prova técnica do caminho WEB (react-native-web): o `Svg.toDataURL` do react-native-svg na web
 * serializa o <svg> do DOM, carrega como <img> (data:image/svg+xml) e desenha num <canvas>.
 * SVG carregado como imagem roda isolado: NÃO enxerga as fontes da página. Esta prova mede isso
 * e testa a correção (embutir a fonte em base64 num <style> dentro do SVG antes de rasterizar).
 *
 * Uso: NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/social/prova-tecnica/prova-web.cjs [pasta-temp]
 * Resultado registrado: web-comparacao-fontes.png (em cima sem a fonte embutida, embaixo com).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { cardCorrida, CSS } = require('../prototipo/gerar-cards.cjs');

const ROOT = path.resolve(__dirname, '../../../../..');
const FONTS = path.join(ROOT, 'apps/mobile/node_modules/@expo-google-fonts');
const b64 = (f) => fs.readFileSync(f).toString('base64');
const EMBED = [
  ['InterTight_800ExtraBold', `${FONTS}/inter-tight/800ExtraBold/InterTight_800ExtraBold.ttf`],
  ['InterTight_600SemiBold', `${FONTS}/inter-tight/600SemiBold/InterTight_600SemiBold.ttf`],
  ['Inter_700Bold', `${FONTS}/inter/700Bold/Inter_700Bold.ttf`],
  ['Inter_500Medium', `${FONTS}/inter/500Medium/Inter_500Medium.ttf`],
]
  .map(([n, f]) => `@font-face{font-family:'${n}';src:url(data:font/ttf;base64,${b64(f)}) format('truetype');}`)
  .join('');

async function main() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const svg = cardCorrida('stories');
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style><div id="card" style="width:270px;height:480px">${svg.replace('width="1080" height="1920"', 'width="270" height="480"')}</div>`);
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(async (embedCss) => {
    // mesmo algoritmo de react-native-svg/src/elements.web.ts (Svg.toDataURL), com a fonte opcional
    async function rasterize(svgEl, width, height, css) {
      const clone = svgEl.cloneNode(true);
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      if (css) {
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = css;
        clone.insertBefore(style, clone.firstChild);
      }
      const xml = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      return { dataUrl: canvas.toDataURL('image/png'), bytes: blob.size, ms: 0 };
    }
    const el = document.querySelector('#card svg');
    const t0 = performance.now();
    const sem = await rasterize(el, 1080, 1920, '');
    const t1 = performance.now();
    const com = await rasterize(el, 1080, 1920, embedCss);
    const t2 = performance.now();
    const file = new File([new Uint8Array([1])], 'nomade.png', { type: 'image/png' });
    return {
      sem: { ...sem, ms: Math.round(t1 - t0) },
      com: { ...com, ms: Math.round(t2 - t1) },
      webShare: typeof navigator.share === 'function',
      canShareFiles: typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : 'sem canShare',
    };
  }, EMBED);
  for (const k of ['sem', 'com']) {
    const out = path.join(process.argv[2] || os.tmpdir(), `web-${k}-fonte-embutida.png`); // recorte comparativo: web-comparacao-fontes.png
    fs.writeFileSync(out, Buffer.from(result[k].dataUrl.split(',')[1], 'base64'));
    console.log(k, 'fonte embutida:', `${(result[k].bytes / 1024).toFixed(0)} KB`, `${result[k].ms} ms`, '->', out);
  }
  console.log('navigator.share:', result.webShare, '| canShare({files}):', result.canShareFiles, '(Chromium headless de desktop)');
  await browser.close();
}
main().catch((e) => (console.error(e), process.exit(1)));
