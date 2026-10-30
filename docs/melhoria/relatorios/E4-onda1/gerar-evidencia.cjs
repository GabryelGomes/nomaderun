// Evidência da E4 (onda 1): renderiza em PNG cada família de `apps/mobile/src/components/art/` usando
// os MESMOS módulos de geometria e a mesma expansão em camadas dos componentes (`neon/core.ts`), serializados
// por `neon/markup.ts`. Os .ts são transpilados na hora pelo TypeScript do app (sem bundler).
//
// Uso (na raiz do repositório):
//   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E4-onda1/gerar-evidencia.cjs [familia...]
// Saída: docs/melhoria/relatorios/E4-onda1/<familia>.png (comprimir depois com pngquant --quality=85-98).
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../../../..');
const APP = path.join(ROOT, 'apps/mobile');
const SRC = path.join(APP, 'src');
const OUT = __dirname;
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
const { expand, resolveQuality, countPrims, usesPrism } = art('neon/core.ts');
const { primsToMarkup, prismDefsMarkup, svgMarkup } = art('neon/markup.ts');
const { ART } = art('neon/palette.ts');

let gid = 0;
/** Uma peça: nós da arte → <svg> com as camadas da qualidade pedida. */
function piece(nodes, box, width, { quality, label, overlay = '', opacity = 1, bg } = {}) {
  const q = resolveQuality(quality, width);
  const id = `prisma${++gid}`;
  const prims = expand(nodes, q, id);
  const defs = usesPrism(nodes) ? prismDefsMarkup(id) : '';
  const svg = svgMarkup(box.vbW, box.vbH, defs + primsToMarkup(prims), width, opacity);
  return { label, html: `<div class="art" style="width:${width}px${bg ? `;background:${bg}` : ''}">${svg}${overlay}</div>`, count: countPrims(prims), q };
}

const FAMILIES = {};
function family(name, title, cols, build) {
  FAMILIES[name] = { title, cols, build };
}

// ---------------------------------------------------------------- famílias
const TEAMS = ['striders', 'volt', 'owls', 'coyotes'];

family('mascotes', 'Mascotes · 4 times × 4 poses (parado, vitória, derrota, dormindo) · qualidade completa', 4, () => {
  const t = art('team/mascot-art.ts');
  const out = [];
  for (const pose of t.MASCOT_POSES)
    for (const team of TEAMS) out.push(piece(t.mascotNodes(team, pose, ART.team[team]), t.MASCOT_BOX, 190, { label: `${t.MASCOT_NAMES[team]} · ${pose}` }));
  return out;
});

family('mascotes-qualidade', 'Mascote Lume · completo, leve e plano (e o tamanho real de 40 e 28 pt)', 5, () => {
  const t = art('team/mascot-art.ts');
  const n = t.mascotNodes('striders', 'parado', ART.team.striders);
  return [
    piece(n, t.MASCOT_BOX, 190, { quality: 'completo', label: 'completo' }),
    piece(n, t.MASCOT_BOX, 190, { quality: 'leve', label: 'leve' }),
    piece(n, t.MASCOT_BOX, 190, { quality: 'plano', label: 'plano' }),
    piece(n, t.MASCOT_BOX, 40, { label: '40 pt (auto = leve)' }),
    piece(n, t.MASCOT_BOX, 28, { label: '28 pt (auto = plano)' }),
  ].map((p) => ({ ...p, label: `${p.label} · ${p.count} elementos` }));
});

family('emblemas', 'Emblemas · completo (nome por Text, fora do SVG) e compacto', 4, () => {
  const t = art('team/mascot-art.ts');
  const { factions } = require(path.join(SRC, 'theme/tokens.ts'));
  const out = [];
  for (const compact of [false, true])
    for (const team of TEAMS) {
      const w = 190;
      const k = w / 200;
      const name = factions[team].name.toUpperCase();
      const overlay = compact
        ? ''
        : `<div class="band" style="left:${t.EMBLEM_BAND.x * k}px;top:${t.EMBLEM_BAND.y * k}px;width:${t.EMBLEM_BAND.width * k}px;height:${t.EMBLEM_BAND.height * k}px;font-size:${(name.length > 12 ? 11.5 : 13) * k}px;letter-spacing:${1.2 * k}px">${name}</div>`;
      out.push(piece(t.emblemNodes(team, ART.team[team], compact), t.EMBLEM_BOX, w, { label: `${factions[team].name}${compact ? ' · compacto' : ''}`, overlay }));
    }
  for (const team of TEAMS) out.push(piece(t.emblemNodes(team, ART.team[team], true), t.EMBLEM_BOX, 32, { label: `32 pt` }));
  return out;
});

// ---------------------------------------------------------------- página e captura
family('chefoes', 'Chefões · 5 × 4 estados (parado, golpe, furioso, derrotado) · dano 0', 4, () => {
  const b = art('boss/boss-art.ts');
  const out = [];
  for (const id of b.BOSS_IDS)
    for (const st of b.BOSS_STATES) out.push(piece(b.bossNodes(id, st, 0, ART.villain), b.BOSS_BOX, 190, { label: `${b.BOSS_NAMES[id]} · ${st}` }));
  return out;
});

family('chefoes-dano', 'Chefões · dano 0, 1 e 2 (parado) e furioso com dano 2', 4, () => {
  const b = art('boss/boss-art.ts');
  const out = [];
  for (const id of b.BOSS_IDS) {
    for (const d of [0, 1, 2]) out.push(piece(b.bossNodes(id, 'parado', d, ART.villain), b.BOSS_BOX, 190, { label: `${b.BOSS_NAMES[id]} · dano ${d}` }));
    out.push(piece(b.bossNodes(id, 'furioso', 2, ART.villain), b.BOSS_BOX, 190, { label: `${b.BOSS_NAMES[id]} · furioso · dano 2` }));
  }
  return out;
});

family('baus', 'Baús · 3 raridades × 3 estados (fechado, abrindo, aberto)', 3, () => {
  const c = art('chest/chest-art.ts');
  const out = [];
  for (const r of c.CHEST_RARITIES) for (const st of c.CHEST_STATES) out.push(piece(c.chestNodes(r, st), c.CHEST_BOX, 180, { label: `${c.CHEST_LABELS[r]} · ${st}` }));
  return out;
});

family('medalhas', 'Medalhas · 12 tipos (nível 3) · níveis 1, 2 e 3 por estrelas e brilho · bloqueada', 6, () => {
  const md = art('medal/medal-art.ts');
  const out = [];
  for (const k of md.MEDAL_KINDS) out.push(piece(md.medalNodes(k, 3, false), md.MEDAL_BOX, 150, { label: md.MEDAL_LABELS[k] }));
  for (const k of ['explorador', 'sequencia', 'defensor']) for (const t of [1, 2, 3]) out.push(piece(md.medalNodes(k, t, false), md.MEDAL_BOX, 150, { label: `${md.MEDAL_LABELS[k]} · nível ${t}` }));
  for (const k of ['primeiros-passos', 'conquistador', 'chefao', 'temporada', 'liga', 'desafio-mes']) out.push(piece(md.medalNodes(k, 1, true), md.MEDAL_BOX, 150, { label: `${md.MEDAL_LABELS[k]} · bloqueada` }));
  for (const k of ['explorador', 'sequencia', 'chefao']) out.push(piece(md.medalNodes(k, 3, false), md.MEDAL_BOX, 64, { label: '64 pt' }));
  for (const k of ['explorador', 'sequencia', 'chefao']) out.push(piece(md.medalNodes(k, 2, true), md.MEDAL_BOX, 64, { label: '64 pt · bloqueada' }));
  return out;
});

family('icones-modos', 'Ícones dos modos · 64, 40 e 28 pt', 8, () => {
  const mi = art('mode-icons/mode-icon-art.ts');
  const out = [];
  for (const w of [64, 40, 28]) for (const k of mi.MODE_ICON_KINDS) out.push(piece(mi.modeIconNodes(k), mi.MODE_ICON_BOX, w, { label: `${mi.MODE_ICON_LABELS[k]} · ${w}` }));
  return out;
});

family('vazios', 'Estados vazios · 8 (o mascote do time nos que usam a prop team)', 4, () => {
  const e = art('empty/empty-art.ts');
  return e.EMPTY_KINDS.map((k) => piece(e.emptyNodes(k, ART.orange, k === 'sem-localizacao' ? 'coyotes' : k === 'sem-notificacoes' ? 'owls' : undefined), e.EMPTY_BOX, 200, { label: e.EMPTY_LABELS[k] }));
});

family('tutorial', 'Cartões do tutorial · corra, pinte (regra v2: as ruas ganham a cor), defenda · Striders e Volt', 3, () => {
  const tu = art('tutorial/tutorial-art.ts');
  const out = [];
  for (const [team, shape, rival] of [
    ['striders', 'circulo', 'coyotes'],
    ['volt', 'triangulo', 'owls'],
  ])
    for (const s of tu.TUTORIAL_STEPS) out.push(piece(tu.tutorialNodes(s, ART.team[team], ART.team[rival], shape), tu.TUTORIAL_BOX, 200, { label: `${tu.TUTORIAL_LABELS[s]} · ${team}` }));
  return out;
});

family('fundos', 'Fundos das abas · na opacidade real (≤ 6%) e, embaixo, a 100% só para revisão', 4, () => {
  const bg = art('backgrounds/background-art.ts');
  const out = [];
  for (const k of bg.TAB_BACKGROUND_KINDS)
    out.push(piece(bg.backgroundNodes(k, 'owls'), bg.BACKGROUND_BOX, 180, { quality: 'plano', opacity: bg.BACKGROUND_OPACITY[k], bg: ART.bg, label: `${bg.TAB_BACKGROUND_LABELS[k]} · ${Math.round(bg.BACKGROUND_OPACITY[k] * 1000) / 10}%` }));
  for (const k of bg.TAB_BACKGROUND_KINDS) out.push(piece(bg.backgroundNodes(k, 'owls'), bg.BACKGROUND_BOX, 180, { quality: 'plano', bg: ART.bg, label: `${bg.TAB_BACKGROUND_LABELS[k]} · 100% (revisão)` }));
  return out;
});

family('comparacao-f1', 'Conferência · arte aprovada da F1 (esquerda) × componente da F3 (direita)', 4, () => {
  const F1 = path.join(ROOT, 'docs/melhoria/F1/arte');
  const t = art('team/mascot-art.ts');
  const b = art('boss/boss-art.ts');
  const c = art('chest/chest-art.ts');
  const e = art('empty/empty-art.ts');
  const tu = art('tutorial/tutorial-art.ts');
  const f1 = (file, w, label) => {
    const svg = fs.readFileSync(path.join(F1, file));
    return { label: `F1 · ${label}`, html: `<div class="art" style="width:${w}px"><img style="width:${w}px;display:block" src="data:image/svg+xml;base64,${svg.toString('base64')}"></div>` };
  };
  const pairs = [
    [f1('mascote-striders-parado.svg', 180, 'Lume parado'), piece(t.mascotNodes('striders', 'parado', ART.team.striders), t.MASCOT_BOX, 180, { label: 'F3 · Lume parado' })],
    [f1('mascote-volt-vitoria.svg', 180, 'Faísca vitória'), piece(t.mascotNodes('volt', 'vitoria', ART.team.volt), t.MASCOT_BOX, 180, { label: 'F3 · Faísca vitória' })],
    [f1('chefao-mormaco-furioso.svg', 180, 'Mormaço furioso'), piece(b.bossNodes('mormaco', 'furioso', 0, ART.villain), b.BOSS_BOX, 180, { label: 'F3 · Mormaço furioso' })],
    [f1('chefao-paredao-golpe.svg', 180, 'Paredão golpe'), piece(b.bossNodes('paredao', 'golpe', 0, ART.villain), b.BOSS_BOX, 180, { label: 'F3 · Paredão golpe' })],
    [f1('bau-lendario-aberto.svg', 180, 'baú lendário aberto'), piece(c.chestNodes('lendario', 'aberto'), c.CHEST_BOX, 180, { label: 'F3 · baú lendário aberto' })],
    [f1('vazio-sem-crew.svg', 180, 'vazio sem crew'), piece(e.emptyNodes('sem-crew'), e.EMPTY_BOX, 180, { label: 'F3 · vazio sem crew' })],
    [f1('tutorial-defenda.svg', 180, 'tutorial defenda'), piece(tu.tutorialNodes('defenda', ART.team.striders, ART.team.coyotes, 'circulo'), tu.TUTORIAL_BOX, 180, { label: 'F3 · tutorial defenda' })],
    [f1('chefao-rei-buzina-parado.svg', 180, 'Rei Buzina parado'), piece(b.bossNodes('rei-buzina', 'parado', 0, ART.villain), b.BOSS_BOX, 180, { label: 'F3 · Rei Buzina parado' })],
  ];
  return pairs.flat();
});

function page(name) {
  const f = FAMILIES[name];
  const cells = f.build().map((p) => `<figure>${p.html}<figcaption>${p.label}</figcaption></figure>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${ART.bg};color:${ART.ink};font-family:Inter,Arial,sans-serif;padding:28px 32px;width:${f.cols * 214}px}
  h1{font:800 13px Arial;letter-spacing:2.4px;color:${ART.orange};margin:0 0 14px;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(${f.cols},1fr);gap:12px}
  figure{margin:0;background:#0B0C0F;border:1px solid #1B1C21;border-radius:12px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
  .art{position:relative;line-height:0} .art svg{display:block}
  .band{position:absolute;display:flex;align-items:center;justify-content:center;font-family:'Inter Tight','Arial Black',sans-serif;font-weight:900;color:${ART.ink};line-height:1}
  figcaption{font-size:11px;color:${ART.ink2};text-align:center;margin-top:6px}
  </style><h1>NOMADE RUN · E4 · ${f.title}</h1><div class="grid">${cells}</div>`;
}

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  for (const name of names) {
    const html = page(name);
    await tab.setContent(html);
    await tab.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    console.log('ok', name);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
