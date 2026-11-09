/**
 * Medição da E5 · F8 onda C (C1): quadros por segundo das animações da fase no export web, com Playwright e
 * `performance.now()` em cada `requestAnimationFrame`, sem e com a CPU desacelerada (CDP
 * `Emulation.setCPUThrottlingRate`: 4× ≈ Android médio, 6× ≈ Android de entrada; aproximação, não aparelho).
 * Base: `docs/melhoria/relatorios/E5-onda3/medir-fps.cjs` (mesma métrica, mesmas janelas).
 *
 * Uso (em apps/mobile, com o cache do Metro isolado):
 *   TMPDIR=<pasta própria> npx expo export -p web --clear --output-dir <dist>
 *   NODE_PATH="$(npm root -g)" node ../../docs/melhoria/relatorios/F8-C1/medir-fps.cjs <dist> [saída.json]
 * Variáveis: RATES=1,4,6 · REPS=3 · ONLY=<trecho do nome da cena> · PW_CHROMIUM=<chrome>
 */
const fs = require('node:fs');
const { chromium } = require('playwright');
const { serve } = require('../../../../apps/mobile/e2e-web/serve.cjs');

const DIST = process.argv[2];
const OUT = process.argv[3];
const PORT = Number(process.env.PORT || 8141);
const RATES = (process.env.RATES || '1,4,6').split(',').map(Number);
const REPS = Number(process.env.REPS || 3);

const g = (id) => `galeria-motion-${id}`;
/**
 * cena → ajustes antes da janela (`setup`), o toque que abre a janela (`chip`), toques logo depois (`then`, com
 * espera em ms) e o tamanho da janela medida (ms). O time padrão da galeria é Owls.
 */
const SCENES = [
  { name: 'galeria parada (referência)', setup: [], chip: null, windowMs: 1500 },
  { name: 'capa: carrossel com a capa em foco (idle 1,6 s)', setup: [g('capa')], chip: null, windowMs: 2400 },
  { name: 'capa: toque (mola + lema + pulo)', setup: [g('capa')], chip: g('capas-owls'), windowMs: 1200 },
  { name: 'capa: confirmar (cresce e some)', setup: [g('capa')], chip: g('capa-confirmar'), windowMs: 900 },
  { name: 'cerimônia "Seu rastro" (cor + mascote + rota + moldura + 24 confetes)', setup: [], chip: g('cerimonia'), windowMs: 3000 },
  { name: 'cerimônia, movimento reduzido', setup: [g('reduzido-sim')], chip: g('cerimonia'), windowMs: 1500 },
  { name: 'primeiro trecho (selo + brilho na linha)', setup: [], chip: g('primeiro-trecho'), windowMs: 1600 },
  { name: 'antes e depois do bairro (3 Svg + 5 anéis)', setup: [], chip: g('bairro'), windowMs: 1600 },
  { name: 'golpe que abre fase (chefão + tarja + 3 pontos)', setup: [g('chefao-mormaco')], chip: g('chefao-fase'), windowMs: 1500 },
  { name: 'a semana do time (faixa + mascote vivo)', setup: [], chip: g('semana-time'), windowMs: 1500 },
  { name: 'carimbo de bairro novo', setup: [], chip: g('carimbo-bairro'), windowMs: 1000 },
  { name: 'recorde de trechos (contagem + 2 pulsos)', setup: [], chip: g('recorde-trechos'), windowMs: 1600 },
  { name: 'líder comenta (contagem + balão + busto vivo)', setup: [], chip: g('lider'), windowMs: 1800 },
  { name: 'confete 60 (teto, referência)', setup: [], chip: g('confete-60'), windowMs: 2200 },
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
          await page.goto(`http://127.0.0.1:${PORT}/dev/motion`, { waitUntil: 'networkidle' });
          await page.waitForSelector('[data-testid="galeria-motion-palco"]');
          for (const s of scene.setup) {
            await page.click(`[data-testid="${s}"]`);
            await sleep(150);
          }
          await page.locator('[data-testid="galeria-motion-palco"]').scrollIntoViewIfNeeded();
          const cdp = await ctx.newCDPSession(page);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate });
          await sleep(500);
          const rec = page.evaluate(`(${RECORD})(${scene.windowMs})`);
          if (scene.chip) await page.click(`[data-testid="${scene.chip}"]`);
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
