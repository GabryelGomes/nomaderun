// Evidência da E4 (onda 2): renderiza em PNG as famílias novas de `apps/mobile/src/components/art/` com os
// MESMOS módulos de geometria e a mesma expansão em camadas dos componentes (`neon/core.ts`), serializados
// por `neon/markup.ts`. Os .ts são transpilados na hora pelo TypeScript do app (sem bundler).
//
// Uso (na raiz do repositório):
//   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E4-onda2/gerar-evidencia.cjs [familia...]
// Saída: docs/melhoria/relatorios/E4-onda2/<familia>.png (comprimir depois com pngquant --quality=85-98).
// OUT_DIR=<pasta> troca a saída (rascunhos de revisão).
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../../../..');
const APP = path.join(ROOT, 'apps/mobile');
const SRC = path.join(APP, 'src');
const OUT = process.env.OUT_DIR || __dirname;
const ts = require(path.join(APP, 'node_modules/typescript'));

// ---- carregador de .ts com o alias "@/"
const resolve0 = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req.startsWith('@/')) req = path.join(SRC, req.slice(2));
  return resolve0.call(this, req, parent, ...rest);
};
require.extensions['.ts'] = (m, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  m._compile(out.outputText, filename);
};

const art = (p) => require(path.join(SRC, 'components/art', p));
const { expand, resolveQuality, countPrims, usesPrism, recolorPrims } = art('neon/core.ts');
const { primsToMarkup, prismDefsMarkup, svgMarkup } = art('neon/markup.ts');
const { ART } = art('neon/palette.ts');

let gid = 0;
/** Uma peça: nós da arte → <svg> com as camadas da qualidade pedida. */
function piece(nodes, box, width, { quality, label, overlay = '', opacity = 1, bg, recolor } = {}) {
  const q = resolveQuality(quality, width);
  const id = `prisma${++gid}`;
  let prims = expand(nodes, q, id);
  if (recolor) prims = recolorPrims(prims, recolor);
  const defs = usesPrism(nodes) ? prismDefsMarkup(id) : '';
  const svg = svgMarkup(box.vbW, box.vbH, defs + primsToMarkup(prims), width, opacity);
  return { label, html: `<div class="art" style="width:${width}px${bg ? `;background:${bg}` : ''}">${svg}${overlay}</div>`, count: countPrims(prims), q };
}
/** Várias camadas empilhadas na mesma caixa (para mostrar as partes separadas da E5). */
function stack(layers, box, width, label, bg) {
  const h = Math.round((width * box.vbH) / box.vbW);
  const inner = layers
    .map(({ nodes, opacity = 1, transform = 'none', origin = '50% 50%', quality, recolor }) => {
      const q = resolveQuality(quality, width);
      const id = `prisma${++gid}`;
      const defs = usesPrism(nodes) ? prismDefsMarkup(id) : '';
      let prims = expand(nodes, q, id);
      if (recolor) prims = recolorPrims(prims, recolor);
      const svg = svgMarkup(box.vbW, box.vbH, defs + primsToMarkup(prims), width, opacity);
      return `<div style="position:absolute;inset:0;transform:${transform};transform-origin:${origin}">${svg}</div>`;
    })
    .join('');
  return { label, html: `<div class="art" style="width:${width}px;height:${h}px${bg ? `;background:${bg}` : ''}">${inner}</div>` };
}

const FAMILIES = {};
function family(name, title, cols, build, cell = 214) {
  FAMILIES[name] = { title, cols, build, cell };
}
const TEAMS = ['striders', 'volt', 'owls', 'coyotes'];

// ---------------------------------------------------------------- chefões
family('chefoes', 'Chefões · 5 × 4 estados (parado, golpe, furioso, derrotado) · dano 0', 4, () => {
  const b = art('boss/boss-art.ts');
  const out = [];
  for (const id of b.BOSS_IDS) for (const st of b.BOSS_STATES) out.push(piece(b.bossNodes(id, st, 0, ART.villain), b.BOSS_BOX, 190, { label: `${b.BOSS_NAMES[id]} · ${st}` }));
  return out;
});

family(
  'chefoes-dano',
  'Soneca, Rei Buzina e Fuligem · parado, golpe e furioso × dano 0, 1 e 2',
  9,
  () => {
    const b = art('boss/boss-art.ts');
    const out = [];
    for (const id of ['soneca', 'rei-buzina', 'fuligem'])
      for (const st of ['parado', 'golpe', 'furioso']) for (const d of [0, 1, 2]) out.push(piece(b.bossNodes(id, st, d, ART.villain), b.BOSS_BOX, 150, { label: `${b.BOSS_NAMES[id]} · ${st} · ${d}` }));
    return out;
  },
  172,
);

family(
  'chefoes-revisao',
  'Revisão do elenco · Soneca e Mormaço redesenhados · 4 estados em 240 pt e o parado em 96 e 56 pt',
  6,
  () => {
    const b = art('boss/boss-art.ts');
    const out = [];
    for (const id of ['soneca', 'mormaco']) {
      for (const st of b.BOSS_STATES) out.push(piece(b.bossNodes(id, st, 0, ART.villain), b.BOSS_BOX, 240, { label: `${b.BOSS_NAMES[id]} · ${st}` }));
      for (const w of [96, 56]) out.push(piece(b.bossNodes(id, 'parado', 0, ART.villain), b.BOSS_BOX, w, { label: `${w} pt` }));
    }
    return out;
  },
  264,
);

// ---------------------------------------------------------------- líderes
family('lideres', 'Líderes · Íris Valente, Téo Faria, Nara Lis e Bento Rocha · parado e falando · qualidade completa', 4, () => {
  const l = art('leader/leader-art.ts');
  const out = [];
  for (const pose of l.LEADER_POSES) for (const team of TEAMS) out.push(piece(l.leaderNodes(team, pose, ART.team[team]), l.LEADER_BOX, 190, { label: `${l.LEADER_NAMES[team]} · ${pose}` }));
  return out;
});

family('lideres-tamanhos', 'Líderes · tamanho real (120, 72 e 40 pt) e o custo de cada qualidade', 6, () => {
  const l = art('leader/leader-art.ts');
  const out = [];
  for (const team of TEAMS) {
    const n = l.leaderNodes(team, 'parado', ART.team[team]);
    for (const w of [120, 72, 40]) {
      const p = piece(n, l.LEADER_BOX, w, { label: `${w} pt` });
      out.push({ ...p, label: `${l.LEADER_NAMES[team]} · ${w} pt · ${p.count} el.` });
    }
  }
  return out;
}, 150);

// ---------------------------------------------------------------- mascotes em corrida
family('corrida', 'Mascotes em corrida (escolha de time) · Lume, Faísca, Breu e Faro · qualidade completa', 2, () => {
  const r = art('team/runner-art.ts');
  const t = art('team/mascot-art.ts');
  return TEAMS.map((team) => piece(r.runnerNodes(team, ART.team[team]), r.RUNNER_BOX, 400, { label: `${t.MASCOT_NAMES[team]} · corrida` }));
}, 430);

family('corrida-qualidade', 'Mascotes em corrida · tamanho de card (170 pt), completo × leve × plano e o custo em elementos', 4, () => {
  const r = art('team/runner-art.ts');
  const t = art('team/mascot-art.ts');
  const out = [];
  for (const team of TEAMS) out.push(piece(r.runnerNodes(team, ART.team[team]), r.RUNNER_BOX, 170, { label: `${t.MASCOT_NAMES[team]} · 170 pt` }));
  const n = r.runnerNodes('owls', ART.team.owls);
  for (const q of ['completo', 'leve', 'plano']) {
    const p = piece(n, r.RUNNER_BOX, 170, { quality: q });
    out.push({ ...p, label: `Breu · ${q} · ${p.count} elementos` });
  }
  const s = piece(n, r.RUNNER_BOX, 72, {});
  out.push({ ...s, label: `72 pt (auto = leve)` });
  return out;
});

// ---------------------------------------------------------------- logo
family('logo', 'Logo oficial · símbolo (240, 96, 48 e 24 pt), logotipo, horizontal e a versão monocromática', 4, () => {
  const lg = art('logo/logo-art.ts');
  const out = [];
  for (const w of [240, 96, 48, 24]) out.push(piece(lg.logoNodes('simbolo'), lg.LOGO_BOX.simbolo, w, { label: `símbolo · ${w} pt` }));
  out.push(piece(lg.logoNodes('logotipo'), lg.LOGO_BOX.logotipo, 400, { label: 'logotipo · 400 pt' }));
  out.push(piece(lg.logoNodes('logotipo'), lg.LOGO_BOX.logotipo, 180, { label: 'logotipo · 180 pt' }));
  out.push(piece(lg.logoNodes('simbolo', '#FFFFFF'), lg.LOGO_BOX.simbolo, 96, { label: 'monocromático', quality: 'plano' }));
  out.push(piece(lg.logoNodes('logotipo', '#FFFFFF'), lg.LOGO_BOX.logotipo, 180, { label: 'logotipo monocromático', quality: 'plano' }));
  return out;
}, 440);

family('logo-horizontal', 'Logo oficial · horizontal (símbolo + logotipo) em 640 e 320 pt', 1, () => {
  const lg = art('logo/logo-art.ts');
  return [piece(lg.logoNodes('horizontal'), lg.LOGO_BOX.horizontal, 640, { label: 'horizontal · 640 pt' }), piece(lg.logoNodes('horizontal'), lg.LOGO_BOX.horizontal, 320, { label: 'horizontal · 320 pt' })];
}, 700);

// ---------------------------------------------------------------- partes para a E5
family('partes', 'Partes para a E5 · baú em 3 camadas (corpo, tampa, item) e montado · chefão + silhueta do clarão · mascote do TeamConfirm', 4, () => {
  const c = art('chest/chest-art.ts');
  const b = art('boss/boss-art.ts');
  const t = art('team/mascot-art.ts');
  const r = art('team/runner-art.ts');
  const out = [];
  const pct = (box, p) => `${(p.x / box.vbW) * 100}% ${(p.y / box.vbH) * 100}%`;
  for (const rar of ['raro', 'lendario']) {
    for (const layer of c.CHEST_LAYERS) out.push(piece(c.chestLayerNodes(rar, 'fechado', layer), c.CHEST_BOX, 180, { label: `baú ${c.CHEST_LABELS[rar]} · layer="${layer}"` }));
    out.push(
      stack(
        [
          { nodes: c.chestLayerNodes(rar, 'fechado', 'corpo') },
          { nodes: c.chestLayerNodes(rar, 'fechado', 'tampa'), transform: 'rotate(-28deg)', origin: pct(c.CHEST_BOX, c.CHEST_PIVOTS.tampa) },
          { nodes: c.chestLayerNodes(rar, 'fechado', 'item'), transform: 'translateY(-6%) scale(0.9)', origin: pct(c.CHEST_BOX, c.CHEST_PIVOTS.item) },
        ],
        c.CHEST_BOX,
        180,
        'montado (tampa a -28°, item subindo)',
      ),
    );
  }
  for (const [id, st] of [
    ['paredao', 'golpe'],
    ['mormaco', 'parado'],
  ]) {
    out.push(piece(b.bossNodes(id, st, 1, ART.villain), b.BOSS_BOX, 180, { label: `${b.BOSS_NAMES[id]} · ${st}` }));
    out.push(piece(b.bossBodyNodes(id, st, 1, ART.villain), b.BOSS_BOX, 180, { label: 'silhouette (clarão)', recolor: '#FFFFFF' }));
  }
  out.push(stack([{ nodes: b.bossNodes('soneca', 'golpe', 2, ART.villain) }, { nodes: b.bossBodyNodes('soneca', 'golpe', 2, ART.villain), recolor: '#FFFFFF', opacity: 0.55 }], b.BOSS_BOX, 180, 'golpe + clarão a 55%'));
  out.push(piece(t.mascotNodes('volt', 'vitoria', ART.team.volt), t.MASCOT_BOX, 180, { label: 'TeamConfirm · Mascot pose="vitoria"' }));
  out.push(piece(r.runnerNodes('striders', ART.team.striders), r.RUNNER_BOX, 180, { label: 'ou MascotRunner' }));
  return out;
});

// ---------------------------------------------------------------- contrato { cx, cy, size } da E8
family('cartao', 'Contrato { cx, cy, size } da E8 · a arte desenhada dentro do SVG do card (1080 × 1920, reduzido), sem Image', 3, () => {
  const core = art('neon/core.ts');
  const t = art('team/mascot-art.ts');
  const b = art('boss/boss-art.ts');
  const lg = art('logo/logo-art.ts');
  const { primsToMarkup } = art('neon/markup.ts');
  const inSvg = (nodes, vb, box, recolor) => {
    const { scale, x, y } = core.fitTransform(vb, box);
    let prims = expand(nodes, resolveQuality('auto', box.size));
    if (recolor) prims = recolorPrims(prims, recolor);
    return `<g transform="translate(${x} ${y}) scale(${scale})">${primsToMarkup(prims)}</g>`;
  };
  const frame = (box) => `<rect x="${box.cx - box.size / 2}" y="${box.cy - box.size / 2}" width="${box.size}" height="${box.size}" fill="none" stroke="#FF6A13" stroke-opacity="0.5" stroke-width="3" stroke-dasharray="14 12"/><circle cx="${box.cx}" cy="${box.cy}" r="8" fill="#FF6A13"/>`;
  const card = (body, label) => ({
    label,
    html: `<div class="art" style="width:300px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="300" height="533"><rect width="1080" height="1920" fill="${ART.bg}"/>${body}</svg></div>`,
  });
  const logo = (cy) => inSvg(lg.logoNodes('horizontal'), lg.LOGO_BOX.horizontal, { cx: 540, cy, size: 640 });
  const mBox = { cx: 540, cy: 860, size: 640 };
  const bBox = { cx: 540, cy: 820, size: 700 };
  const sBox = { cx: 540, cy: 960, size: 300 };
  return [
    card(frame(mBox) + inSvg(t.mascotNodes('owls', 'vitoria', ART.team.owls), t.MASCOT_BOX, mBox) + logo(1640), 'mascote (vitória) em { cx: 540, cy: 860, size: 640 }'),
    card(frame(bBox) + inSvg(b.bossNodes('mormaco', 'derrotado', 0, ART.villain), b.BOSS_BOX, bBox) + logo(1640), 'chefão (derrotado) em { cx: 540, cy: 820, size: 700 }'),
    card(frame(sBox) + inSvg(t.mascotNodes('coyotes', 'parado', ART.team.coyotes), t.MASCOT_BOX, sBox) + logo(1640) + inSvg(lg.logoNodes('simbolo'), lg.LOGO_BOX.simbolo, { cx: 120, cy: 120, size: 140 }), 'mascote pequeno + logo (símbolo e horizontal)'),
  ];
}, 340);

function page(name) {
  const f = FAMILIES[name];
  const cells = f
    .build()
    .map((p) => `<figure>${p.html}<figcaption>${p.label}</figcaption></figure>`)
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${ART.bg};color:${ART.ink};font-family:Inter,Arial,sans-serif;padding:28px 32px;width:${f.cols * f.cell}px}
  h1{font:800 13px Arial;letter-spacing:2.4px;color:${ART.orange};margin:0 0 14px;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(${f.cols},1fr);gap:12px}
  figure{margin:0;background:#0B0C0F;border:1px solid #1B1C21;border-radius:12px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
  .art{position:relative;line-height:0} .art svg{display:block}
  figcaption{font-size:11px;color:${ART.ink2};text-align:center;margin-top:6px}
  </style><h1>NOMADE RUN · E4 · ${f.title}</h1><div class="grid">${cells}</div>`;
}

module.exports = { FAMILIES, art, piece, stack, ART, TEAMS };

if (require.main === module) {
  (async () => {
    const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES);
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    for (const name of names) {
      await tab.setContent(page(name));
      await tab.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
      console.log('ok', name);
    }
    await browser.close();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
