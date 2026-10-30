// Gera os SVGs da F1 em docs/melhoria/F1/arte/ e as folhas HTML de revisão.
// Uso: node docs/melhoria/F1/arte/fonte/gerar.cjs [pasta-das-folhas-html]
const fs = require('fs');
const path = require('path');
const { C, svg } = require('./neon.cjs');
const { TEAMS, mascot, emblem } = require('./times.cjs');
let bosses = {}, items = {};
try { bosses = require('./chefoes.cjs'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
try { items = require('./itens.cjs'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }

const OUT = path.resolve(__dirname, '..');
const SHEETS = process.argv[2] || path.join(OUT, 'fonte');
const files = []; // { file, label, group, w, h }
const PT = { parado: 'parado', vitoria: 'vitória', derrota: 'derrota', golpe: 'golpe', furioso: 'furioso', derrotado: 'derrotado' };

function save(file, w, h, body, label, group) {
  fs.writeFileSync(path.join(OUT, file), svg(w, h, body, { title: label }));
  files.push({ file, label, group, w, h });
}

for (const id of Object.keys(TEAMS)) {
  for (const pose of ['parado', 'vitoria', 'derrota']) {
    save(`mascote-${id}-${pose}.svg`, 200, 220, mascot(id, pose), `${TEAMS[id].mascot} · ${PT[pose]}`, `mascotes-${pose}`);
  }
}
for (const id of Object.keys(TEAMS)) save(`emblema-${id}.svg`, 200, 200, emblem(id), `Emblema ${TEAMS[id].name}`, 'emblemas');
for (const id of Object.keys(TEAMS)) save(`emblema-${id}-compacto.svg`, 200, 200, emblem(id, { compact: true }), `Emblema compacto ${TEAMS[id].name}`, 'emblemas');

if (bosses.BOSSES) {
  for (const [id, b] of Object.entries(bosses.BOSSES)) {
    for (const st of b.states) save(`chefao-${id}-${st}.svg`, 240, 240, b.draw(st), `${b.name} · ${PT[st]}`, b.states.length > 1 ? `chefao-${id}` : 'chefoes-elenco');
  }
}
if (items.ITEMS) for (const it of items.ITEMS) save(it.file, it.w, it.h, it.body, it.label, it.group);

// Folhas HTML (uma por grupo + a folha de contato com tudo)
const TITLES = {
  'mascotes-parado': ['Times · mascotes parados', 4], 'mascotes-vitoria': ['Times · vitória', 4], 'mascotes-derrota': ['Times · derrota = cansado, ofegante e sorrindo', 4],
  emblemas: ['Times · emblemas', 4], 'chefao-mormaco': ['Chefão Mormaço · parado, golpe, furioso, derrotado', 4],
  'chefao-paredao': ['Chefão Paredão · parado, golpe, furioso, derrotado', 4], 'chefoes-elenco': ['Elenco dos chefões (parado)', 4],
  baus: ['Baús · comum, raro, lendário', 6], medalhas: ['Medalhas', 5], vazios: ['Estados vazios', 4], modos: ['Ícones dos modos', 8], tutorial: ['Cartões do tutorial', 4],
};
const groups = [...new Set(files.map((f) => f.group))];
function sheet(list, title) {
  const src = (f) => path.relative(SHEETS, path.join(OUT, f.file));
  const sections = [...new Set(list.map((f) => f.group))].map((g) => {
    const [t, cols] = TITLES[g] || [g, 4];
    const cells = list.filter((f) => f.group === g).map((f) => `<figure><img src="${src(f)}"><figcaption>${f.label}</figcaption></figure>`).join('');
    return `<section><h2>${t}</h2><div class="grid" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div></section>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${C.bg};color:${C.ink};font-family:Inter,Arial,sans-serif;padding:36px 40px}
  header{display:flex;align-items:baseline;gap:18px;border-bottom:1px solid #1B1C21;padding-bottom:14px}
  h1{font:900 30px 'Arial Black',sans-serif;letter-spacing:1px;margin:0;color:${C.ink};text-shadow:0 0 18px rgba(255,106,19,.6)}
  h1 b{color:${C.orange}} header p{margin:0;color:${C.ink2};font-size:14px}
  .cols{columns:2;column-gap:28px;margin-top:8px} section{break-inside:avoid;margin-top:22px}
  h2{font:700 12px Arial;letter-spacing:2.5px;color:${C.orange};margin:0 0 10px;text-transform:uppercase}
  .grid{display:grid;gap:10px}
  figure{margin:0;background:#0B0C0F;border:1px solid #1B1C21;border-radius:12px;padding:8px;display:flex;flex-direction:column;justify-content:space-between}
  img{width:100%;height:auto;display:block}
  figcaption{font-size:11px;color:${C.ink2};text-align:center;margin-top:4px}
  </style><header><h1>NOMADE <b>RUN</b></h1><p>${title}</p></header><div class="cols">${sections}</div>`;
}
fs.mkdirSync(SHEETS, { recursive: true });
for (const g of groups) fs.writeFileSync(path.join(SHEETS, `folha-${g}.html`), sheet(files.filter((f) => f.group === g), (TITLES[g] || [g])[0]));
fs.writeFileSync(path.join(SHEETS, 'folha.html'), sheet(files, 'Direção de arte · F1 · folha de contato · neon line-art geométrico'));
console.log(files.length, 'svgs;', groups.join(', '));
