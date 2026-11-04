// Gera o PDF do guia de teste a partir de guia-teste.html.
// Uso (nesta pasta), com o Playwright e o Chromium instalados:
//   NODE_PATH=<pasta node_modules com o playwright> node gerar-pdf.cjs
// Para revisar as páginas como imagem (opcional):
//   pdftoppm -png -r 60 "NOMADE RUN - Como testar o app.pdf" /tmp/guia
const path = require('path');
const { chromium } = require('playwright');

const html = path.join(__dirname, 'guia-teste.html');
const pdf = path.join(__dirname, 'NOMADE RUN - Como testar o app.pdf');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + html, { waitUntil: 'load' });
  await page.pdf({ path: pdf, format: 'A4', preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('PDF:', pdf);
})();
