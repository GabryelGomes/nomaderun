#!/usr/bin/env node
/**
 * E10 (F1) — Auditoria de contraste dos tokens do NOMADE RUN (WCAG 2.2, fórmula de luminância relativa).
 *
 * Lê `apps/mobile/src/theme/tokens.ts` e `neon.ts` (transpila com o TypeScript do próprio app, sem
 * depender de cópia manual dos valores), monta os pares de cor que o app usa de verdade e marca:
 *   - texto normal  < 4,5:1  → FALHA (AA)
 *   - texto grande / ícone / borda de controle < 3:1 → FALHA (AA, 1.4.11)
 * Para cada falha sugere a cor mais próxima (mesmo matiz) que passa.
 *
 * Uso (na raiz do repositório):
 *   node docs/melhoria/F1/qa/contraste.cjs            → tabela Markdown no terminal
 *   node docs/melhoria/F1/qa/contraste.cjs --json     → JSON (para a CI ou para comparar antes/depois)
 *   node docs/melhoria/F1/qa/contraste.cjs --strict   → sai com código 1 se houver falha (uso futuro na CI)
 * Não altera nenhum arquivo.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const THEME = path.join(ROOT, 'apps/mobile/src/theme');
const ts = require(path.join(ROOT, 'apps/mobile/node_modules/typescript'));

function loadTs(file) {
  const src = fs.readFileSync(path.join(THEME, file), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  // Os dois arquivos só importam tipos (removidos na transpilação); qualquer require real falha de propósito.
  new Function('module', 'exports', 'require', out)(mod, mod.exports, (m) => {
    throw new Error(`import inesperado em ${file}: ${m}`);
  });
  return mod.exports;
}

const tokens = loadTs('tokens.ts');
const { neon, neonTeam } = loadTs('neon.ts');
const { dark, light, factions, palette } = tokens;

// ---------- cor ----------
function parse(c) {
  c = c.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  }
  throw new Error(`cor não reconhecida: ${c}`);
}
const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
/** Compõe uma cor translúcida sobre um fundo opaco. */
function over(fg, bg) {
  const f = parse(fg);
  const b = parse(bg);
  return hex({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a) });
}
function lum(c) {
  const { r, g, b } = parse(c);
  const ch = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** Clareia (fundo escuro) ou escurece (fundo claro) a cor no mesmo matiz até passar no alvo. */
function suggest(fg, bg, target) {
  const f = parse(fg);
  const lighten = lum(bg) < 0.18;
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const to = lighten ? 255 : 0;
    const c = hex({ r: f.r + (to - f.r) * t, g: f.g + (to - f.g) * t, b: f.b + (to - f.b) * t });
    if (ratio(c, bg) >= target) return c;
  }
  return null;
}

// ---------- pares usados pelo app ----------
// tipo: 'texto' (4,5:1), 'grande' (texto ≥ 24 px ou ≥ 18,66 px negrito: 3:1), 'ui' (ícone, borda de controle: 3:1)
const BG = {
  'dark.background': dark.background,
  'dark.surface': dark.surface,
  'dark.surfaceSunken': dark.surfaceSunken,
  'neon.bgDeep': neon.bgDeep,
  'neon.glowBg': neon.glowBg,
  'neon.activeFill/bg': over(neon.activeFill, dark.background),
  'neon.activeFill/surface': over(neon.activeFill, dark.surface),
};
const pairs = [];
const add = (fgName, fg, bgName, bg, kind, where) => pairs.push({ fgName, fg, bgName, bg, kind, where });

for (const [bn, bv] of Object.entries(BG)) {
  add('dark.text', dark.text, bn, bv, 'texto', 'Text (padrão)');
  add('dark.textSecondary', dark.textSecondary, bn, bv, 'texto', 'Text muted');
  add('dark.accentText', dark.accentText, bn, bv, 'texto', 'Text accent / links');
  add('dark.danger', dark.danger, bn, bv, 'texto', 'mensagens de erro');
}
// Botões (components/button.tsx:30-35): primário = colors.action com colors.onAction.
add('dark.onAction', dark.onAction, 'dark.action', dark.action, 'texto', 'Button primary md (bodyBold 16 px) — button.tsx:31');
add('dark.onAction', dark.onAction, 'dark.action', dark.action, 'grande', 'Button primary lg (variant title, 20 px negrito = texto grande) — button.tsx:71');
add('neon.bg (proposta)', neon.bg, 'dark.action', dark.action, 'texto', 'proposta P8: texto escuro no laranja');
add('#FFFFFF', '#FFFFFF', 'dark.danger', dark.danger, 'texto', 'Button danger — button.tsx:34');
add('#FFFFFF', '#FFFFFF', 'dark.danger', dark.danger, 'grande', 'Button danger lg');
add('dark.action', dark.action, 'dark.background', dark.background, 'ui', 'IconButton action / anel de foco');
// Bordas de controles (1.4.11): secondary button, cartões, campos.
add('dark.line', dark.line, 'dark.background', dark.background, 'ui', 'borda do Button secondary / Surface — button.tsx:60');
add('dark.line', dark.line, 'dark.surface', dark.surface, 'ui', 'borda de campo sobre superfície');
// Times (tokens.factions + neonTeam) sobre o fundo e as superfícies.
for (const [id, f] of Object.entries(factions)) {
  add(`factions.${id}.color`, f.color, 'dark.background', dark.background, 'texto', 'cor do time como texto');
  add(`factions.${id}.color`, f.color, 'dark.background', dark.background, 'ui', 'selo / forma do time / região no mapa');
  add(`factions.${id}.color`, f.color, 'dark.surface', dark.surface, 'ui', 'selo do time sobre cartão');
  add(`factions.${id}.onColor`, f.onColor, `factions.${id}.color`, f.color, 'texto', 'texto sobre o selo do time');
  add(`neonTeam.${id}`, neonTeam[id], 'dark.background', dark.background, 'texto', 'brilho/rotulo neon do time');
  add(`neonTeam.${id}`, neonTeam[id], 'dark.surface', dark.surface, 'texto', 'rotulo neon do time sobre cartão');
}
// Tema claro (mantido em tokens.ts, hoje sem uso: APP_SCHEME = 'dark').
add('light.onAction', light.onAction, 'light.action', light.action, 'texto', '(tema claro, sem uso) botão primário');
add('light.textSecondary', light.textSecondary, 'light.background', light.background, 'texto', '(tema claro, sem uso)');
add('palette.ink3', palette.ink3, 'palette.white', palette.white, 'texto', '(tema claro, sem uso) ink3');

// ---------- relatório ----------
const need = (k) => (k === 'texto' ? 4.5 : 3);
const rows = pairs.map((p) => {
  const r = ratio(p.fg, p.bg);
  const pass = r >= need(p.kind);
  return { ...p, ratio: Math.round(r * 100) / 100, need: need(p.kind), pass, suggestion: pass ? null : suggest(p.fg, p.bg, need(p.kind)) };
});

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + '\n');
} else {
  const fails = rows.filter((r) => !r.pass);
  console.log(`# Contraste dos tokens — ${rows.length} pares, ${fails.length} abaixo do mínimo\n`);
  console.log('| Frente | Cor | Fundo | Fundo (hex) | Tipo | Razão | Mínimo | Resultado | Sugestão (mesmo matiz) | Onde |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of [...fails, ...rows.filter((x) => x.pass)]) {
    console.log(
      `| ${r.fgName} | \`${r.fg}\` | ${r.bgName} | \`${r.bg}\` | ${r.kind} | ${r.ratio.toFixed(2)}:1 | ${r.need}:1 | ${r.pass ? 'passa' : '**FALHA**'} | ${r.suggestion ? '`' + r.suggestion + '`' : '—'} | ${r.where} |`,
    );
  }
}
if (process.argv.includes('--strict') && rows.some((r) => !r.pass && !r.where.startsWith('(tema claro'))) process.exit(1);
