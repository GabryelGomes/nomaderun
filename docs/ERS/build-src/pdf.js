const { chromium } = require('playwright');
(async () => {
  const [,, src, out] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + src, { waitUntil: 'load' });
  await p.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:7pt;color:#8a93a8;width:100%;padding:0 18mm;font-family:Arial">NOMADE RUN — Especificação de Requisitos de Software · v1.0</div>',
    footerTemplate: '<div style="font-size:7pt;color:#8a93a8;width:100%;padding:0 18mm;text-align:right;font-family:Arial">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
    margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' } });
  await b.close();
})();
