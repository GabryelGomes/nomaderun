// F8 · A1 (E4) — evidência do sistema de emblemas v2, medalhas e ícone do Raid, renderizada a partir dos MESMOS
// módulos de geometria dos componentes (`components/art/**/*-art.ts` + `neon/core.ts` + `neon/markup.ts`).
//
// Uso (na raiz do repositório):
//   FASE=antes  NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/F8-A1/gerar-evidencia.cjs
//   FASE=depois NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/F8-A1/gerar-evidencia.cjs
// Saída: docs/melhoria/relatorios/F8-A1/<fase>-<familia>[@2x|@3x].png (pngquant depois).
// `antes` desenha o selo antigo (`team-badge.tsx` de antes da A1, reproduzido 1:1 em `F8/arte/fonte/atual.cjs`)
// e as medalhas/ícones que estiverem no código no momento; `depois` usa `team/emblem-art.ts`.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { art, ART, TEAMS } = require('../E4-onda2/gerar-evidencia.cjs');
const { oldBadge } = require('../../F8/arte/fonte/atual.cjs');

const OUT = __dirname;
const FASE = process.env.FASE || 'depois';
const BG = ART.bg;
const INK = ART.ink;
const ORANGE = ART.orange;
const T = ART.team;
const NAMES = { striders: 'Neon Striders', volt: 'Volt Runners', owls: 'Night Owls', coyotes: 'Urban Coyotes' };

const core = art('neon/core.ts');
const { primsToMarkup } = art('neon/markup.ts');

/** Nós de arte → <svg> de `w` px (viewBox da caixa), na qualidade resolvida pelo tamanho. */
function svgOf(nodes, box, w, quality) {
  const prims = core.expand(nodes, core.resolveQuality(quality, w));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.vbW} ${box.vbH}" width="${w}" height="${Math.round((w * box.vbH) / box.vbW)}" style="display:block">${primsToMarkup(prims)}</svg>`;
}

// ---------------------------------------------------------------- o emblema (antes × depois)
let E = null;
if (FASE !== 'antes') E = art('team/emblem-art.ts');

/** Emblema do time em `w` pt: `antes` = selo antigo; `depois` = TeamEmblem v2 (mesma regra `auto` do componente). */
function badge(team, w, o = {}) {
  if (FASE === 'antes') return oldBadge(team, w, !!o.attack);
  const size = Math.max(E.EMBLEM_MIN_SIZE, w);
  const variant = E.resolveEmblemVariant(o.variant ?? 'auto', size);
  const nodes = E.emblemNodes(team, { variant, size, color: o.color ?? (team ? T[team] : undefined), on: o.on ?? BG, mono: !!o.mono, attack: !!o.attack });
  return svgOf(nodes, E.EMBLEM_BOX, size, o.quality);
}

const cell = (label, inner, w) => ({ label, html: `<div class="art" style="width:${w}px">${inner}</div>` });
const FAMILIES = {};
function family(name, title, cols, build, cellW = 120, scales = [1]) {
  FAMILIES[name] = { title, cols, build, cell: cellW, scales };
}

// ---------------------------------------------------------------- 1. emblemas: tamanhos, cinza, mono, neutro
family(
  'emblemas',
  `${FASE} · emblemas · mini 18/20/24/28/34 · médio 40/48/64 · grande 96/120 · cinza 24 (só a forma distingue) · mono 40 no laranja · neutro`,
  12,
  () => {
    const out = [];
    for (const team of TEAMS) {
      for (const w of [18, 20, 24, 28, 34]) out.push(cell(`${w}`, badge(team, w), w));
      for (const w of [40, 48, 64]) out.push(cell(`${w}`, badge(team, w), w));
      for (const w of [96, 120]) out.push(cell(`${w}`, badge(team, w), w));
      out.push(cell('cinza 24', badge(team, 24, { color: '#9A9A9A' }), 24));
      out.push(cell('mono 40 · laranja', `<div style="background:${ORANGE};padding:6px;border-radius:10px">${badge(team, 40, { mono: true, color: BG, on: ORANGE })}</div>`, 52));
    }
    out.push(cell('neutro 24', badge(null, 24), 24));
    out.push(cell('neutro 40', badge(null, 40), 40));
    out.push(cell('neutro 64', badge(null, 64), 64));
    for (const team of TEAMS) out.push(cell(`sob ataque 34 (${team})`, badge(team, 34, { attack: true }), 34));
    for (const team of TEAMS) out.push(cell(`sob ataque 40 médio (${team})`, badge(team, 40, { attack: true }), 40));
    return out;
  },
  120,
  [1, 2, 3],
);

// ---------------------------------------------------------------- 2. contexto: as telas reais em mock, nas medidas reais
const row = (left, text, sub, right = '') =>
  `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#0F1013;border-radius:14px;margin-bottom:8px">${left}<div style="flex:1"><div style="font:700 15px Arial">${text}</div>${sub ? `<div style="font:12px Arial;color:${ART.ink2}">${sub}</div>` : ''}</div>${right}</div>`;
const ctx = (label, body, w = 300) => ({ label, html: `<div style="width:${w}px;line-height:normal;font-family:Inter,Arial;color:${INK};text-align:left">${body}</div>` });
const inline = (team, w, o) => `<span style="display:inline-flex;vertical-align:middle;line-height:0">${badge(team, w, o)}</span>`;

family(
  'contexto',
  `${FASE} · emblema em contexto · Mapa (34) · zona (18) · feed (20/24) · pódio (40/32) · ranking (22) · resumo (32/30) · Perfil (44/64) · card (pílula 18, selo 72)`,
  3,
  () => {
    const out = [];
    out.push(
      ctx(
        'Mapa · chip do time (34) e marcadores (34; sob ataque com anel)',
        `${row(badge('striders', 34), 'Neon Striders', '47 zonas em Goiânia · demonstração')}<div style="position:relative;height:120px;background:#121a22;border-radius:14px;overflow:hidden"><div style="position:absolute;left:40px;top:30px">${badge('coyotes', 34, { attack: true })}</div><div style="position:absolute;left:160px;top:60px">${badge('volt', 34)}</div><div style="position:absolute;left:230px;top:20px">${badge(null, 34)}</div></div>`,
      ),
    );
    out.push(
      ctx(
        'Zona · barra de disputa (18) e dono sob ataque (18)',
        `<div style="display:flex;justify-content:space-between;font:700 15px Arial;margin-bottom:6px"><span style="display:flex;gap:6px;align-items:center">${badge('striders', 18)} Striders 13</span><span style="display:flex;gap:6px;align-items:center">12 Coyotes ${badge('coyotes', 18)}</span></div><div style="display:flex;height:8px;border-radius:4px;overflow:hidden"><div style="flex:13;background:${T.striders}"></div><div style="flex:12;background:${T.coyotes}"></div></div><div style="margin-top:14px;display:flex;align-items:center;gap:6px;font:13px Arial;color:${ART.ink2}">${badge('striders', 18, { attack: true })} Dos Neon Striders · sob ataque</div>${row(badge('owls', 20), 'ana.demo', '3 corridas aqui')}`,
      ),
    );
    out.push(ctx('Feed (20) · crew (22/24)', `${row(badge('striders', 20), 'ana.demo · Hoje', '')}${row(badge('volt', 24), 'teo.demo', 'Corrida de 5,2 km')}${row(badge('coyotes', 22), 'bento.demo', 'membro')}`));
    out.push(
      ctx(
        'Clube · pódio (40 / 32) e ranking de times (22)',
        `<div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;height:150px;padding:10px;background:#0F1013;border-radius:14px"><div style="text-align:center"><div style="display:flex;justify-content:center">${badge('coyotes', 32)}</div><div style="width:60px;height:50px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div><div style="text-align:center"><div style="display:flex;justify-content:center">${badge('striders', 40)}</div><div style="width:60px;height:80px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div><div style="text-align:center"><div style="display:flex;justify-content:center">${badge('volt', 32)}</div><div style="width:60px;height:36px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div></div>${row(badge('owls', 22), '4º Night Owls', '312 zonas')}`,
      ),
    );
    out.push(ctx('Resumo · time (32) · zonas conquistadas (30)', `${row(badge('striders', 32), 'Você correu pelos Neon Striders', '+176 pontos')}${row(badge('striders', 30), 'Shopping Flamboyant', 'era dos Urban Coyotes', badge('coyotes', 20))}${row(badge(null, 30), 'Setor Bueno', 'neutra')}`));
    out.push(ctx('Perfil · trocar de time (44) e cabeçalho (64)', `${row(badge('coyotes', 44), 'Urban Coyotes', 'Correm em matilha')}${row(badge('owls', 44), 'Night Owls', 'Donos das luzes da cidade')}${row(badge('volt', 64), 'maria.demo', 'Volt Runners')}`));
    const pill = (team) =>
      `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 6px;border-radius:20px;border:1.5px solid ${T[team]};background:${T[team]}1A;font:800 11px Arial;letter-spacing:1.5px">${inline(team, 18, { on: FASE === 'antes' ? undefined : mixHex(BG, T[team], 0.1) })} ${NAMES[team].toUpperCase()}</div>`;
    out.push(ctx('Card do Stories · pílula (18) e selo (72)', `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${pill('striders')}${pill('volt')}${pill('owls')}${pill('coyotes')}</div><div style="display:flex;gap:10px">${TEAMS.map((t) => badge(t, 72, { variant: 'medio' })).join('')}</div>`));
    out.push(
      ctx(
        'Botão laranja (mono 24) e chip do time (mono 20)',
        `<div style="display:flex;gap:10px;align-items:center;padding:12px 16px;background:${ORANGE};border-radius:14px;color:${BG};font:800 14px Arial;letter-spacing:1px">${badge('volt', 24, { mono: true, color: BG, on: ORANGE })} CORRER PELOS VOLT</div><div style="margin-top:10px;display:inline-flex;gap:8px;align-items:center;padding:6px 12px;background:${T.owls};border-radius:20px;color:${BG};font:800 11px Arial">${badge('owls', 20, { mono: true, color: BG, on: T.owls })} NIGHT OWLS</div>`,
      ),
    );
    out.push(ctx('Celebração · zona conquistada (56) e toast (32)', `${row(badge('owls', 56, { quality: 'leve' }), 'Zona conquistada!', 'Setor Marista agora é dos Night Owls')}${row(badge('volt', 32), 'Zona defendida', 'Setor Bueno · +30 XP')}`));
    return out;
  },
  330,
  [1, 2, 3],
);

function mixHex(a, b, t) {
  const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const A = h(a);
  const B = h(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- 3. medalhas · 12 × níveis 1/2/3 + bloqueada
family(
  'medalhas',
  `${FASE} · medalhas · 12 tipos × nível 1, 2, 3 e bloqueada · 64 pt (e a fila de 40 pt do Perfil)`,
  8,
  () => {
    const m = art('medal/medal-art.ts');
    const out = [];
    for (const kind of m.MEDAL_KINDS) {
      for (const tier of [1, 2, 3]) out.push(cell(`${m.MEDAL_LABELS[kind]} · ${tier}`, svgOf(m.medalNodes(kind, tier, false), m.MEDAL_BOX, 64), 64));
      out.push(cell(`${m.MEDAL_LABELS[kind]} · bloq.`, svgOf(m.medalNodes(kind, 1, true), m.MEDAL_BOX, 64), 64));
    }
    for (const kind of m.MEDAL_KINDS) out.push(cell(`${kind} · 40`, svgOf(m.medalNodes(kind, 3, false), m.MEDAL_BOX, 40), 40));
    return out;
  },
  100,
);

// ---------------------------------------------------------------- 4. ícones dos modos · 44 e 28
family(
  'modos',
  `${FASE} · ícones dos modos · 44 e 28 pt (o Raid precisa ler como o vilão, não como gato)`,
  8,
  () => {
    const mi = art('mode-icons/mode-icon-art.ts');
    const out = [];
    for (const k of mi.MODE_ICON_KINDS) out.push(cell(`${mi.MODE_ICON_LABELS[k]} · 44`, svgOf(mi.modeIconNodes(k), mi.MODE_ICON_BOX, 44), 44));
    for (const k of mi.MODE_ICON_KINDS) out.push(cell(`${mi.MODE_ICON_LABELS[k]} · 28`, svgOf(mi.modeIconNodes(k), mi.MODE_ICON_BOX, 28), 28));
    return out;
  },
  90,
);

function page(name) {
  const f = FAMILIES[name];
  const cells = f
    .build()
    .map((p) => `<figure>${p.html}<figcaption>${p.label}</figcaption></figure>`)
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${BG};color:${INK};font-family:Inter,Arial,sans-serif;padding:24px 28px;width:${f.cols * f.cell}px}
  h1{font:800 12px Arial;letter-spacing:2.2px;color:${ORANGE};margin:0 0 12px;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(${f.cols},1fr);gap:8px}
  figure{margin:0;background:#0B0C0F;border:1px solid #1B1C21;border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
  .art{position:relative;line-height:0} .art svg{display:block}
  figcaption{font-size:10px;color:${ART.ink2};text-align:center;margin-top:6px}
  </style><h1>NOMADE RUN · F8-A1 · ${f.title}</h1><div class="grid">${cells}</div>`;
}

module.exports = { badge, svgOf, FAMILIES };

if (require.main === module) {
  (async () => {
    const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES);
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    for (const name of names) {
      const f = FAMILIES[name];
      for (const dsf of f.scales) {
        const c = await browser.newContext({ deviceScaleFactor: dsf });
        const tab = await c.newPage();
        await tab.setContent(page(name));
        const file = path.join(OUT, `${FASE}-${name}${dsf > 1 ? `@${dsf}x` : ''}.png`);
        await tab.screenshot({ path: file, fullPage: true });
        try {
          execFileSync('pngquant', ['--quality=80-98', '--force', '--ext', '.png', '--skip-if-larger', file]);
        } catch {
          // sem pngquant
        }
        await c.close();
        console.log('ok', path.basename(file), fs.statSync(file).size);
      }
    }
    await browser.close();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
