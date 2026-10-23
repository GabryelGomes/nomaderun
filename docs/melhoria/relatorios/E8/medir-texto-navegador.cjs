/**
 * E8 · onda 1 — referência de largura de texto medida no Chromium (Playwright) com as fontes do app.
 * Gera `apps/mobile/src/features/social/card/__tests__/browser-widths.json`, usado pelo teste de
 * `font-metrics.ts` (erro < 3%).
 *
 * Uso (na raiz do repositório):
 *   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E8/medir-texto-navegador.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../../../..');
const FONTS = path.join(ROOT, 'apps/mobile/node_modules/@expo-google-fonts');
const OUT = path.join(ROOT, 'apps/mobile/src/features/social/card/__tests__/browser-widths.json');

const FILES = {
  InterTight_800ExtraBold: 'inter-tight/800ExtraBold/InterTight_800ExtraBold.ttf',
  InterTight_600SemiBold: 'inter-tight/600SemiBold/InterTight_600SemiBold.ttf',
  Inter_700Bold: 'inter/700Bold/Inter_700Bold.ttf',
  Inter_500Medium: 'inter/500Medium/Inter_500Medium.ttf',
};

/** Strings que os cards desenham (dados de demonstração e textos fixos), na fonte em que aparecem. */
const CASES = {
  InterTight_800ExtraBold: [
    'NOMADE', 'RUN', '2,02', '12,4', '418', '10:29', '5:12', '+183', '+46', '8', '86', '14', '23',
    'Jardim Goiás', 'Setor Bueno', 'Cheguei ao nível 8', 'Mormaço de Outubro', 'DERROTADO', 'km', 'pontos',
    '6,3', '1h04', '4,1', '3,6', '4,7', 'Parque Vaca Brava', 'Vila Nova', 'Áreas Verdes',
  ],
  InterTight_600SemiBold: ['2,02 km  ·  10:29  ·  5:12 /km', '10,00 km  ·  52:10  ·  5:13 /km'],
  Inter_700Bold: [
    'NEON STRIDERS', 'URBAN COYOTES', 'NIGHT OWLS', 'VOLT RUNNERS', 'QUINTA · 23 OUT · GOIÂNIA',
    'SÁBADO · 1 NOV', 'TEMPO', 'RITMO', 'PONTOS', '/km', '1 zona conquistada · 3 reforçadas', 'ZONA CONQUISTADA',
    'Urban Coyotes', 'Neon Striders', 'NÍVEL', 'NÍVEL NOVO', 'KM NO TOTAL', 'ZONAS', 'CORRIDAS', 'CHEFÃO DA CIDADE',
    'MEU DANO', 'Flamboyant Runners · 1º lugar · 412 km', 'MINHA SEMANA', '20 – 26 OUT', 'EM MOVIMENTO',
    'Sequência de 4 semanas', 'DADOS DE DEMONSTRAÇÃO', 'CORRA A SUA CIDADE. CADA RUA CONTA.', 'CORRA A SUA CIDADE.',
    'ROTA PROTEGIDA', 'PROVISÓRIO', 'EM REVISÃO', 'S', 'T', 'Q', 'D', '@gabryel',
  ],
  Inter_500Medium: ['Faltam 1.900 XP para o nível 9', 'Goiânia correu 3.600 km em 5 dias', 'Rota protegida pela sua privacidade'],
};
const SIZE = 100;

(async () => {
  const faces = Object.entries(FILES)
    .map(([name, file]) => `@font-face{font-family:'${name}';src:url(data:font/ttf;base64,${fs.readFileSync(path.join(FONTS, file)).toString('base64')})}`)
    .join('');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<html><head><style>${faces}</style></head><body><svg id="s" width="4000" height="200"></svg></body></html>`);
  await page.evaluate(async (names) => {
    await Promise.all(names.map((n) => document.fonts.load(`100px '${n}'`)));
  }, Object.keys(FILES));
  const out = [];
  for (const [font, texts] of Object.entries(CASES)) {
    for (const text of texts) {
      const width = await page.evaluate(
        ({ font, text, size }) => {
          const svg = document.getElementById('s');
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t.setAttribute('x', '0');
          t.setAttribute('y', '150');
          t.setAttribute('font-family', font);
          t.setAttribute('font-size', String(size));
          t.textContent = text;
          svg.appendChild(t);
          const w = t.getComputedTextLength();
          svg.removeChild(t);
          return w;
        },
        { font, text, size: SIZE },
      );
      out.push({ font, size: SIZE, text, width: Math.round(width * 100) / 100 });
    }
  }
  await browser.close();
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`${out.length} medidas → ${path.relative(ROOT, OUT)}`);
})();
