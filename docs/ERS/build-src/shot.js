const { chromium } = require('playwright');
(async () => {
  const [,, src, out, w, h, sel] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
  await p.goto('file://' + src);
  await p.waitForTimeout(300);
  if (sel) await (await p.$(sel)).screenshot({ path: out });
  else await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
