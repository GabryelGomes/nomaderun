// F8 · "capa" do time: arte hero por time para a escolha de time e para "Meu time".
// Composição: mascote corpo inteiro correndo (runner-art.ts) + cenário mínimo da cidade neon (prédios em traço,
// pista em perspectiva) + brilho na cor do time + nome, lema (3 palavras) e biografia (3 linhas) por HTML (no app: Text).
//
// Uso: NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F8/arte/fonte/capa.cjs
// Saída: docs/melhoria/F8/arte/proposta/capas.png e capa-meu-time.png
const path = require('path');
const { execFileSync } = require('child_process');
const { art, ART, TEAMS } = require('../../../relatorios/E4-onda2/gerar-evidencia.cjs');

const OUT = path.resolve(__dirname, '../proposta');
const T = ART.team;
const NAMES = { striders: 'Neon Striders', volt: 'Volt Runners', owls: 'Night Owls', coyotes: 'Urban Coyotes' };
const MASCOT = { striders: 'Lume', volt: 'Faísca', owls: 'Breu', coyotes: 'Faro' };
const LEMA = { striders: 'Ritmo vira luz', volt: 'Energia não acaba', owls: 'A noite é nossa', coyotes: 'A matilha avança' };
const BIO = {
  striders: ['A onça que corre no compasso.', 'Cada passada no tempo certo,', 'cada rua acesa de azul.'],
  volt: ['A lebre que não desliga.', 'Tiro curto ou longo, tanto faz:', 'sempre sobra faísca.'],
  owls: ['A coruja que enxerga tudo.', 'Quando a cidade apaga,', 'os Owls acendem.'],
  coyotes: ['O coiote que fareja a rota.', 'Um corre, todos correm:', 'a matilha pinta a cidade.'],
};
// cenário por time: skyline diferente (silhueta da cidade varia, a composição é a mesma)
const SKYLINE = {
  striders: [
    [250, 60, 26],
    [282, 40, 30],
    [318, 74, 22],
    [346, 52, 28],
    [380, 86, 20],
  ],
  volt: [
    [250, 80, 24],
    [280, 30, 22],
    [308, 64, 30],
    [344, 46, 24],
    [374, 90, 26],
  ],
  owls: [
    [246, 50, 30],
    [282, 24, 24],
    [312, 70, 26],
    [344, 40, 30],
    [380, 80, 20],
  ],
  coyotes: [
    [250, 90, 28],
    [284, 56, 26],
    [316, 36, 24],
    [346, 70, 30],
    [382, 60, 18],
  ],
};

function runnerMarkup(team, box) {
  const core = art('neon/core.ts');
  const { primsToMarkup } = art('neon/markup.ts');
  const r = art('team/runner-art.ts');
  const prims = core.expand(r.runnerNodes(team, T[team]), 'completo');
  const { scale, x, y } = core.fitTransform(r.RUNNER_BOX, box);
  return `<g transform="translate(${x} ${y}) scale(${scale})">${primsToMarkup(prims)}</g>`;
}

/** Cena 390 × 220 (card da escolha). `hero` = true alonga para 390 × 260 (Meu time). */
function scene(team, { hero = false } = {}) {
  const c = T[team];
  const H = hero ? 260 : 220;
  const ground = H - 34;
  const sky = SKYLINE[team]
    .map(([x, top0, w]) => {
      const top = top0 + (hero ? 92 : 64);
      const win = [];
      for (let yy = top + 10; yy < ground - 8; yy += 12) for (let xx = x + 5; xx < x + w - 4; xx += 8) if ((xx * 7 + yy * 3) % 5 < 2) win.push(`<rect x="${xx}" y="${yy}" width="3" height="4" fill="${c}" opacity="0.55"/>`);
      return `<rect x="${x}" y="${top}" width="${w}" height="${ground - top}" fill="${ART.bg}" stroke="${c}" stroke-opacity="0.45" stroke-width="1.6"/>${win.join('')}`;
    })
    .join('');
  const glow = `<defs><radialGradient id="g-${team}" cx="0.42" cy="0.95" r="0.75"><stop offset="0" stop-color="${c}" stop-opacity="0.34"/><stop offset="0.55" stop-color="${c}" stop-opacity="0.08"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><linearGradient id="road-${team}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${ART.orange}" stop-opacity="0"/><stop offset="0.5" stop-color="${ART.orange}" stop-opacity="0.9"/><stop offset="1" stop-color="${ART.orange}" stop-opacity="0"/></linearGradient></defs>`;
  const road = `<line x1="0" y1="${ground}" x2="390" y2="${ground}" stroke="${c}" stroke-opacity="0.7" stroke-width="1.5"/><line x1="0" y1="${ground + 12}" x2="390" y2="${ground + 12}" stroke="${c}" stroke-opacity="0.25" stroke-width="1"/><line x1="0" y1="${ground + 24}" x2="390" y2="${ground + 24}" stroke="${c}" stroke-opacity="0.12" stroke-width="1"/>${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${i * 76 - 30}" y1="${ground + 6}" x2="${i * 76 + 10}" y2="${ground + 6}" stroke="url(#road-${team})" stroke-width="2.5" stroke-linecap="round"/>`).join('')}`;
  const dot = (x, y, r, op) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op}"/>`;
  const stars = dot(300, 18, 1.2, 0.6) + dot(360, 30, 1.6, 0.5) + dot(330, 12, 1, 0.4) + dot(270, 28, 1, 0.5);
  const runnerBox = hero ? { cx: 136, cy: 124, size: 250 } : { cx: 136, cy: 112, size: 215 };
  const fade = `<defs><linearGradient id="fade-${team}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${ART.bg}" stop-opacity="0"/><stop offset="1" stop-color="${ART.bg}" stop-opacity="0.92"/></linearGradient><linearGradient id="fadeb-${team}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ART.bg}" stop-opacity="0"/><stop offset="1" stop-color="${ART.bg}" stop-opacity="0.85"/></linearGradient></defs><rect x="190" y="0" width="200" height="${hero ? 150 : 110}" fill="url(#fade-${team})"/>` + (hero ? '' : `<rect x="0" y="${H - 40}" width="390" height="40" fill="url(#fadeb-${team})"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 ${H}" width="390" height="${H}" style="display:block">${glow}<rect width="390" height="${H}" fill="${ART.bg}"/><rect width="390" height="${H}" fill="url(#g-${team})"/>${stars}${sky}${road}${fade}${runnerMarkup(team, runnerBox)}</svg>`;
}

function cardEscolha(team) {
  const c = T[team];
  return `<div style="position:relative;width:390px;border-radius:22px;overflow:hidden;border:1.5px solid ${c}55;box-shadow:0 0 28px ${c}33;font-family:Inter,Arial">${scene(team)}
  <div style="position:absolute;right:18px;top:16px;text-align:right">
    <div style="font:900 22px Arial;letter-spacing:1px;color:${ART.ink};text-shadow:0 0 14px ${c}99">${NAMES[team].toUpperCase()}</div>
    <div style="font:800 11px Arial;letter-spacing:3px;color:${c};margin-top:4px">${LEMA[team].toUpperCase()}</div>
  </div>
  <div style="position:absolute;right:18px;bottom:14px;font:12px Arial;color:${ART.ink2}">${MASCOT[team]} · ${BIO[team][0]}</div>
  </div>`;
}

function cardMeuTime(team) {
  const c = T[team];
  return `<div style="position:relative;width:390px;border-radius:22px;overflow:hidden;border:1.5px solid ${c}55;font-family:Inter,Arial">${scene(team, { hero: true })}
  <div style="position:absolute;right:18px;top:16px;text-align:right;max-width:176px">
    <div style="font:11px Arial;letter-spacing:2px;color:${ART.ink2}">SEU TIME</div>
    <div style="font:900 24px Arial;line-height:26px;letter-spacing:0.5px;color:${ART.ink};text-shadow:0 0 14px ${c}99;margin-top:2px">${NAMES[team].toUpperCase()}</div>
    <div style="font:800 11px Arial;letter-spacing:3px;color:${c};margin-top:6px">${LEMA[team].toUpperCase()}</div>
    <div style="font:12.5px/17px Arial;color:${ART.ink};margin-top:12px;opacity:0.9">${BIO[team].join('<br>')}</div>
  </div>
  </div>`;
}

function page(title, cells, cols, cellW) {
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${ART.bg};color:${ART.ink};font-family:Inter,Arial,sans-serif;padding:28px 32px;width:${cols * cellW}px}
  h1{font:800 13px Arial;letter-spacing:2.4px;color:${ART.orange};margin:0 0 14px;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px}
  figure{margin:0;display:flex;flex-direction:column;align-items:center}
  figcaption{font-size:11px;color:${ART.ink2};text-align:center;margin-top:8px}
  </style><h1>NOMADE RUN · F8 · PROPOSTA · ${title}</h1><div class="grid">${cells.map((c) => `<figure>${c.html}<figcaption>${c.label}</figcaption></figure>`).join('')}</div>`;
}

module.exports = { scene, cardEscolha, cardMeuTime, LEMA, BIO };

if (require.main === module) {
  (async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const c = await browser.newContext({ deviceScaleFactor: 1 });
    const tab = await c.newPage();
    const pages = [
      ['capas', 'Capa do time na escolha (390 × 220) · mascote correndo + cidade neon + nome, lema e 1ª linha da bio', TEAMS.map((t) => ({ label: `${NAMES[t]} · escolha`, html: cardEscolha(t) })), 2, 430],
      ['capa-meu-time', 'Capa em "Meu time" (390 × 260) · com a biografia de 3 linhas', TEAMS.map((t) => ({ label: `${NAMES[t]} · Meu time`, html: cardMeuTime(t) })), 2, 430],
    ];
    for (const [name, title, cells, cols, w] of pages) {
      await tab.setContent(page(title, cells, cols, w));
      const file = path.join(OUT, `${name}.png`);
      await tab.screenshot({ path: file, fullPage: true });
      try {
        execFileSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', file]);
      } catch {
        // sem pngquant
      }
      console.log('ok', name);
    }
    await browser.close();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
