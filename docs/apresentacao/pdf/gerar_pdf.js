// Gera o PDF (e uma prévia PNG por slide) a partir do HTML de impressão.
const { chromium } = require('playwright');
const [IN, PDF, PREV] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + IN, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.pdf({ path: PDF, width: '1920px', height: '1080px', printBackground: true, pageRanges: '1-10' });
  if (PREV) {
    const secs = await p.$$('section');
    for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: `${PREV}/s${String(i + 1).padStart(2, '0')}.png` });
  }
  await b.close();
})();
