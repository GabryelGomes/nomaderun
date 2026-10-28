/**
 * Medição da E5 · onda 3 (T7.3.5): quadros por segundo dos momentos pesados no export web, com Playwright e
 * `performance.now()` em cada `requestAnimationFrame`, sem e com a CPU desacelerada (CDP
 * `Emulation.setCPUThrottlingRate`: 4× ≈ Android médio, 6× ≈ Android de entrada; aproximação, não aparelho).
 *
 * Uso (em apps/mobile, com o cache do Metro isolado):
 *   TMPDIR=<pasta própria> npx expo export -p web --clear --output-dir <dist>
 *   NODE_PATH="$(npm root -g)" node ../../docs/melhoria/relatorios/E5-onda3/medir-fps.cjs <dist> [saída.json]
 * Variáveis: RATES=1,4,6 · REPS=3 · ONLY=<trecho do nome da cena>
 */
const fs = require('node:fs');
const { chromium } = require('playwright');
const { serve } = require('../../../../apps/mobile/e2e-web/serve.cjs');

const DIST = process.argv[2];
const OUT = process.argv[3];
const PORT = Number(process.env.PORT || 8131);
const RATES = (process.env.RATES || '1,4,6').split(',').map(Number);
const REPS = Number(process.env.REPS || 3);

/** cena → rota, ajustes (testIDs), gatilho e janela medida (ms) */
const SCENES = [
  { name: 'galeria parada (referência)', route: '/dev/motion', setup: [], chip: null, windowMs: 1500 },
  { name: 'confete 60 (sozinho)', route: '/dev/motion', setup: [], chip: 'galeria-motion-confete-60', windowMs: 2200 },
  { name: 'baú lendário (5 Svg + 60 confetes + item)', route: '/dev/motion', setup: ['galeria-motion-raridade-lendario'], chip: 'galeria-motion-bau', windowMs: 2200 },
  { name: 'golpe no chefão (3 Svg + silhueta)', route: '/dev/motion', setup: ['galeria-motion-chefao-mormaco'], chip: 'galeria-motion-chefao-golpe', windowMs: 1200 },
  { name: 'nível novo (raios + mascote + 60 confetes)', route: '/dev/motion', setup: [], chip: 'galeria-motion-nivel', windowMs: 2200 },
  { name: 'baú lendário, movimento reduzido', route: '/dev/motion', setup: ['galeria-motion-reduzido-sim', 'galeria-motion-raridade-lendario'], chip: 'galeria-motion-bau', windowMs: 1200 },
  { name: 'onboarding: 4 MascotRunner leve + 1 LeaderBust, vivos', route: '/dev/motion', setup: [], chip: 'galeria-motion-onboarding-arte', windowMs: 2500 },
  // limite de cima do onboarding: a galeria de arte "viva" anima 8 bustos de líder, 4 corredores e mais
  { name: 'arte viva (8 LeaderBust + 4 MascotRunner + outros)', route: '/dev/arte', setup: [], vivo: true, windowMs: 2500 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Grava os instantes de cada quadro numa janela e devolve as métricas. */
const RECORD = `(windowMs) => new Promise((resolve) => {
  const t = [];
  const start = performance.now();
  const tick = (now) => { t.push(now); if (now - start < windowMs) requestAnimationFrame(tick); else resolve(t); };
  requestAnimationFrame(tick);
})`;

function metrics(t) {
  const d = [];
  for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
  const sorted = [...d].sort((a, b) => a - b);
  const span = t[t.length - 1] - t[0];
  return {
    fps: Math.round(((t.length - 1) / span) * 1000 * 10) / 10,
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    jank: Math.round((d.filter((x) => x > 25).length / d.length) * 1000) / 10, // % de quadros > 25 ms
  };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

(async () => {
  const server = await serve(DIST, PORT);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const rows = [];
  const errors = [];
  try {
    const only = process.env.ONLY;
    for (const scene of SCENES.filter((x) => !only || x.name.includes(only))) {
      for (const rate of RATES) {
        const runs = [];
        for (let rep = 0; rep < REPS; rep++) {
          const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
          const page = await ctx.newPage();
          page.on('pageerror', (e) => errors.push(`${scene.name}: ${e.message}`));
          await page.goto(`http://127.0.0.1:${PORT}${scene.route}`, { waitUntil: 'networkidle' });
          await page.waitForSelector(scene.route === '/dev/arte' ? '[data-testid="dev-arte"]' : '[data-testid="galeria-motion-palco"]');
          for (const s of scene.setup) await page.click(`[data-testid="${s}"]`);
          if (scene.chip) await page.locator('[data-testid="galeria-motion-palco"]').scrollIntoViewIfNeeded();
          const cdp = await ctx.newCDPSession(page);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate });
          await sleep(400);
          const rec = page.evaluate(`(${RECORD})(${scene.windowMs})`);
          if (scene.chip) await page.click(`[data-testid="${scene.chip}"]`);
          if (scene.vivo) {
            await page.click('[data-testid="dev-arte-movimento-vivo"]');
            // mede com os corredores à vista (o carrossel do onboarding mostra os 4 de uma vez)
            await page.getByText('Mascotes em corrida · escolha de time').first().scrollIntoViewIfNeeded();
          }
          runs.push(metrics(await rec));
          await ctx.close();
        }
        const row = { cena: scene.name, cpu: `${rate}×`, fps: median(runs.map((r) => r.fps)), p95: median(runs.map((r) => r.p95)), max: median(runs.map((r) => r.max)), jank: median(runs.map((r) => r.jank)) };
        rows.push(row);
        console.log(JSON.stringify(row));
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ rates: RATES, reps: REPS, rows, errors }, null, 2));
  console.log(errors.length ? `ERROS:\n${errors.join('\n')}` : 'sem erros no console');
})();
