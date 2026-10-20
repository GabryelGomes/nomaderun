// Playwright (T4.3/T4.4, RNF-012): comparação de imagem do mapa e da folha da zona sobre o export web.
// Rode de apps/mobile com o runner global:  NODE_PATH="$(npm root -g)" npx playwright test -c e2e-web/playwright.config.cjs
// (ou `node "$(npm root -g)/playwright/cli.js" test -c e2e-web/playwright.config.cjs`). Ver README.md.
const path = require('node:path');
const os = require('node:os');

const DIST = process.env.WEB_DIST || path.join(os.tmpdir(), 'nomade-web');
const PORT = Number(process.env.VISUAL_PORT || 8098);

module.exports = {
  testDir: __dirname,
  testMatch: /.*\.spec\.cjs$/,
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: path.join(os.tmpdir(), 'nomade-playwright-results'),
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' } },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PW_CHROMIUM || require('node:fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
      ? { executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }
      : {},
    timezoneId: 'America/Sao_Paulo',
    locale: 'pt-BR',
  },
  webServer: {
    command: `node ${JSON.stringify(path.join(__dirname, 'serve.cjs'))} ${JSON.stringify(DIST)} ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 20_000,
  },
};
