// F8 · protótipo do sistema de identidade dos times: a CABEÇA do mascote dentro da FORMA do time, em 3 tamanhos.
//   mini   (20–28 pt): silhueta fechada, 2 cores (cor do time + fundo), sem detalhe;
//   medio  (40–64 pt): silhueta + feições + 1 acento laranja, contorno da forma com tinta leve;
//   grande (96+ pt):   moldura com brilho + rosto line-art dos mascotes (mascot-art.ts), opcionalmente a faixa.
// Também: versão monocromática (fundos coloridos) e neutra (zona sem time).
//
// Uso: NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F8/arte/fonte/emblema.cjs [rodada]
// Saída: docs/melhoria/F8/arte/proposta/emblemas-r<rodada>.png (+ contexto)
const path = require('path');
const { execFileSync } = require('child_process');
const { art, ART, TEAMS } = require('../../../relatorios/E4-onda2/gerar-evidencia.cjs');

const OUT = path.resolve(__dirname, '../proposta');
const ROUND = process.argv[2] || '2';
const BG = ART.bg;
const INK = ART.ink;
const ORANGE = ART.orange;
const NAMES = { striders: 'Neon Striders', volt: 'Volt Runners', owls: 'Night Owls', coyotes: 'Urban Coyotes' };
const SHAPE = { striders: 'circulo', volt: 'triangulo', owls: 'losango', coyotes: 'quadrado' };
const T = ART.team;

// ---------------------------------------------------------------- formas (viewBox 100 × 100)
// Cada forma: `d` (path), e a caixa útil onde a cabeça cabe (cx, cy, escala e deslocamento) por tamanho.
const SHAPES = {
  circulo: { d: 'M50 4 A 46 46 0 1 1 49.99 4 Z', head: { mini: [50, 52, 0.72], medio: [50, 52, 0.7], grande: [50, 52, 0.74] } },
  // triângulo com cantos arredondados (ponta para cima)
  triangulo: {
    d: 'M44 10 Q 50 2 56 10 L 95 80 Q 99 90 89 90 L 11 90 Q 1 90 5 80 Z',
    head: { mini: [50, 60, 0.62], medio: [50, 60, 0.6], grande: [50, 64, 0.52] },
  },
  losango: { d: 'M50 3 Q 53 3 56 6 L 94 44 Q 98 50 94 56 L 56 94 Q 50 98 44 94 L 6 56 Q 2 50 6 44 L 44 6 Q 47 3 50 3 Z', head: { mini: [50, 50, 0.7], medio: [50, 50, 0.68], grande: [50, 50, 0.7] } },
  quadrado: { d: 'M22 6 L 78 6 Q 94 6 94 22 L 94 78 Q 94 94 78 94 L 22 94 Q 6 94 6 78 L 6 22 Q 6 6 22 6 Z', head: { mini: [50, 52, 0.84], medio: [50, 52, 0.82], grande: [50, 52, 0.84] } },
};

// ---------------------------------------------------------------- cabeças (silhueta fechada) · viewBox 100 × 100
// sil: silhueta (cor do time) · feat: feições cortadas (cor do fundo) · acc: acento laranja (só medio) · detail: linhas finas (medio)
const M = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => `${100 - +x} ${y}`); // espelho horizontal
const mirrorPath = (d) => {
  // espelha comandos absolutos M/L/Q/C/Z em torno de x = 50
  return d.replace(/([MLQC])\s*([^MLQCZ]+)/g, (m, cmd, nums) => {
    const v = nums.trim().split(/[\s,]+/).map(Number);
    const o = [];
    for (let i = 0; i < v.length; i += 2) o.push(`${100 - v[i]} ${v[i + 1]}`);
    return `${cmd}${o.join(' ')}`;
  });
};

const HEADS = {
  // Lume · onça: cabeça redonda, orelhas redondas, olhos cerrados, manchas
  striders: {
    sil: [
      // cabeça felina: testa larga, bochechas com tufos, queixo estreito
      'M50 20 C 68 20 82 30 84 48 L 86 60 L 80 66 L 84 74 L 74 78 C 68 88 58 92 50 92 C 42 92 32 88 26 78 L 16 74 L 20 66 L 14 60 L 16 48 C 18 30 32 20 50 20 Z',
      // orelhas altas, arredondadas na ponta
      'M26 36 C 14 30 12 10 24 6 C 34 4 42 14 42 26 Z',
      'M74 36 C 86 30 88 10 76 6 C 66 4 58 14 58 26 Z',
    ],
    feat: [
      'M27 50 L 46 55 L 44 62 L 30 58 Z',
      'M73 50 L 54 55 L 56 62 L 70 58 Z',
      'M44 70 L 56 70 L 50 77 Z',
      'M38 80 Q 44 86 50 80 Q 56 86 62 80 Q 50 90 38 80 Z',
    ],
    acc: ['M24 16 C 24 10 30 10 32 16 C 33 21 30 26 28 26 Z', 'M76 16 C 76 10 70 10 68 16 C 67 21 70 26 72 26 Z'],
    dots: [
      [50, 30, 2.6],
      [40, 36, 1.8],
      [60, 36, 1.8],
      [26, 66, 1.6],
      [74, 66, 1.6],
    ],
    eyeGlow: [
      [37, 55, 2.6],
      [63, 55, 2.6],
    ],
  },
  // Faísca · lebre: rosto afilado, orelhas altas (uma com recorte de raio), sorriso com dentes
  volt: {
    sil: [
      'M22 50 Q 50 40 78 50 L 84 66 Q 78 86 50 96 Q 22 86 16 66 Z',
      'M28 58 L 16 14 Q 17 2 30 4 L 50 50 Z',
      'M72 58 L 84 14 Q 83 2 70 4 L 50 50 Z',
    ],
    feat: ['M28 58 L 47 61 L 45 70 L 30 66 Z', 'M72 58 L 53 61 L 55 70 L 70 66 Z', 'M36 78 Q 50 87 64 78 L 62 84 Q 50 92 38 84 Z'],
    acc: ['M27 12 L 37 28 L 32 30 L 43 46 L 30 32 L 35 30 Z', 'M73 12 L 63 28 L 68 30 L 57 46 L 70 32 L 65 30 Z'],
    teeth: ['M46 81 L 54 81 L 54 85 Q 50 86 46 85 Z'],
    eyeGlow: [
      [39, 65, 2.4],
      [61, 65, 2.4],
    ],
  },
  // Breu · coruja: tufos (chifres), olhos enormes, bico losango
  owls: {
    sil: ['M50 22 L 64 16 L 78 4 L 76 28 L 84 46 Q 84 76 50 94 Q 16 76 16 46 L 24 28 L 22 4 L 36 16 Z'],
    feat: [
      { tag: 'circle', cx: 36, cy: 50, r: 11 },
      { tag: 'circle', cx: 64, cy: 50, r: 11 },
      'M50 59 L 56 67 L 50 77 L 44 67 Z',
      'M22 42 L 38 36 L 40 40 L 24 46 Z',
      'M78 42 L 62 36 L 60 40 L 76 46 Z',
    ],
    acc: [],
    eyes: [
      [36, 50, 7.5],
      [64, 50, 7.5],
    ],
    pupils: [
      [37.5, 50, 3],
      [65.5, 50, 3],
    ],
  },
  // Faro · coiote: orelhas pontudas, focinho longo, bandana
  coyotes: {
    sil: ['M50 26 L 70 22 L 88 2 L 86 40 L 78 58 L 64 72 L 56 86 L 44 86 L 36 72 L 22 58 L 14 40 L 12 2 L 30 22 Z'],
    feat: ['M26 46 L 44 51 L 42 58 L 28 54 Z', 'M74 46 L 56 51 L 58 58 L 72 54 Z', { tag: 'rect', x: 43, y: 70, width: 14, height: 9, rx: 3.5 }, 'M20 12 L 30 26 L 20 30 Z', 'M80 12 L 70 26 L 80 30 Z'],
    acc: ['M30 88 L 70 88 L 50 100 Z'],
    eyeGlow: [
      [34, 53, 2.4],
      [66, 53, 2.4],
    ],
  },
};

const shp = (s, extra = '') => (typeof s === 'string' ? `<path d="${s}" ${extra}/>` : s.tag === 'circle' ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${extra}/>` : `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx || 0}" ${extra}/>`);
const dots = (list, fill) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

/**
 * A cabeça em silhueta, no viewBox 100, já transformada para a caixa da forma.
 * mode: 'mini' (2 cores), 'medio' (feições + acento), 'mono' (uma cor só, feições vazadas).
 */
function headSvg(team, mode, color, bgc, scaleOpt) {
  const h = HEADS[team];
  const [cx, cy, k] = scaleOpt;
  const tf = `transform="translate(${cx} ${cy}) scale(${k}) translate(-50 -50)"`;
  const silFill = color;
  const cut = bgc;
  let inner = h.sil.map((d) => shp(d, `fill="${silFill}"`)).join('');
  if (mode === 'medio' && h.acc.length) inner += h.acc.map((d) => shp(d, `fill="${ORANGE}"`)).join('');
  inner += h.feat.map((d) => shp(d, `fill="${cut}"`)).join('');
  if (team === 'owls') {
    const eyeFill = mode === 'medio' ? ORANGE : color;
    inner += dots(h.eyes, eyeFill) + dots(h.pupils, cut);
  }
  if (mode === 'medio') {
    if (h.dots) inner += dots(h.dots, cut);
    if (h.teeth) inner += h.teeth.map((d) => shp(d, `fill="${INK}"`)).join('');
    if (h.eyeGlow) inner += dots(h.eyeGlow, team === 'owls' ? cut : color);
  }
  if (mode === 'mini-pupilas' && h.eyeGlow) inner += dots(h.eyeGlow, color);
  return `<g ${tf}>${inner}</g>`;
}

/** mini · cheio: forma cheia na cor; cabeça cortada no escuro (olhos na cor). */
function miniCheio(team, color = T[team], bgc = BG, pupilas = false) {
  const s = SHAPES[SHAPE[team]];
  return `<path d="${s.d}" fill="${color}"/>${headSvg(team, pupilas ? 'mini-pupilas' : 'mini', bgc, color, s.head.mini)}`;
}
/** mini · contorno: forma em traço; cabeça cheia na cor com feições escuras. */
function miniContorno(team, color = T[team], bgc = BG) {
  const s = SHAPES[SHAPE[team]];
  return `<path d="${s.d}" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="6" stroke-linejoin="round"/>${headSvg(team, 'mini', color, bgc, s.head.mini)}`;
}
/** medio: contorno com tinta + halo leve + cabeça cheia com feições e acento. */
function medio(team, color = T[team], bgc = BG) {
  const s = SHAPES[SHAPE[team]];
  return `<path d="${s.d}" fill="none" stroke="${color}" stroke-opacity="0.22" stroke-width="12" stroke-linejoin="round"/><path d="${s.d}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="4.5" stroke-linejoin="round"/>${headSvg(team, 'medio', color, bgc, s.head.medio)}`;
}
/** mono: uma cor só (para fundo laranja/colorido): forma cheia na cor, cabeça vazada. */
function mono(team, color, on) {
  const s = SHAPES[SHAPE[team]];
  return `<path d="${s.d}" fill="${color}"/>${headSvg(team, 'mono', on, color, s.head.mini)}`;
}
/** neutro (zona sem time): anel tracejado + miolo apagado. */
function neutro(color = '#6E6C68') {
  return `<circle cx="50" cy="50" r="44" fill="#1A1B20" stroke="${color}" stroke-width="5" stroke-dasharray="10 8"/><circle cx="50" cy="50" r="9" fill="${color}" fill-opacity="0.5"/>`;
}

// grande: moldura com brilho (camadas) + rosto line-art do mascote via mascot-art.ts
function grande(team, width, { band = false } = {}) {
  const core = art('neon/core.ts');
  const { primsToMarkup } = art('neon/markup.ts');
  const t = art('team/mascot-art.ts');
  const color = T[team];
  const s = SHAPES[SHAPE[team]];
  const [cx, cy, k] = s.head.grande;
  // rosto do busto (viewBox 200 × 220, cabeça entre y≈6 e 165, centro ≈ (100, 95)); cabe numa caixa de ~150
  const face = t.faceNodes(team, 'parado', color);
  const prims = core.expand(face, 'completo');
  const headK = (k * 100) / 150;
  const g = `<g transform="translate(${cx} ${cy}) scale(${headK}) translate(-100 -96)">${primsToMarkup(prims)}</g>`;
  const frame = `<path d="${s.d}" fill="none" stroke="${color}" stroke-opacity="0.16" stroke-width="14" stroke-linejoin="round"/><path d="${s.d}" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="8" stroke-linejoin="round"/><path d="${s.d}" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="3.2" stroke-linejoin="round"/><path d="${s.d}" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="1" stroke-linejoin="round"/>`;
  const bandSvg = band ? `<rect x="16" y="84" width="68" height="14" rx="4" fill="${ORANGE}" fill-opacity="0.16" stroke="${ORANGE}" stroke-width="1.6"/>` : '';
  return frame + g + bandSvg;
}

const svg = (body, w, vb = 100, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${w}" height="${w}" ${extra}>${body}</svg>`;
const cell = (label, inner, w) => ({ label, html: `<div class="art" style="width:${w}px">${inner}</div>` });
const html = (label, inner, w) => ({ label, html: `<div style="width:${w}px;line-height:normal">${inner}</div>` });

const FAMILIES = {};
function family(name, title, cols, build, cellW = 150) {
  FAMILIES[name] = { title, cols, build, cell: cellW };
}

family(`emblemas-r${ROUND}`, `Rodada ${ROUND} · sistema de identidade · mini 16/20/24/28 (pupilas ≥ 24) · cinza (só a forma distingue) · mini 2× · médio 40/48/64 · grande 96/120 · mono · neutro`, 12, () => {
  const out = [];
  for (const team of TEAMS) {
    for (const w of [16, 20, 24, 28]) out.push(cell(`mini ${w}${w >= 24 ? ' (pupilas)' : ''}`, svg(miniCheio(team, T[team], BG, w >= 24), w), w));
    out.push(cell(`mini 24 · deuteranopia (cinza)`, svg(miniCheio(team, '#9A9A9A', BG, true), 24), 24));
    out.push(cell(`mini 28 · ampliado 2×`, svg(miniCheio(team, T[team], BG, true), 56), 56));
    for (const w of [40, 48, 64]) out.push(cell(`médio ${w}`, svg(medio(team), w), w));
    out.push(cell(`grande 96`, svg(grande(team, 96), 96), 96));
    out.push(cell(`grande 120`, svg(grande(team, 120), 120), 120));
    out.push(cell(`mono 40 (fundo laranja)`, `<div style="background:${ORANGE};padding:6px;border-radius:10px">${svg(mono(team, BG, ORANGE), 40)}</div>`, 52));
  }
  out.push(cell('neutro 24', svg(neutro(), 24), 24));
  out.push(cell('neutro 40', svg(neutro(), 40), 40));
  for (const team of TEAMS) out.push(cell(`ampliado · mini cheio (${team})`, svg(miniCheio(team), 110), 110));
  for (const team of TEAMS) out.push(cell(`ampliado · médio (${team})`, svg(medio(team), 110), 110));
  return out;
}, 110);

// contexto: as mesmas telas da folha "selo-antigo-contexto", agora com o emblema novo
const badge = (team, w, variant) => {
  if (team === null) return svg(neutro(), w);
  const body = variant === 'medio' || w >= 40 ? medio(team) : miniCheio(team, T[team], BG, w >= 24);
  return svg(body, w, 100, 'style="display:block"');
};
const row = (left, text, sub, right = '') =>
  `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#0F1013;border-radius:14px;margin-bottom:8px">${left}<div style="flex:1"><div style="font:700 15px Arial">${text}</div>${sub ? `<div style="font:12px Arial;color:${ART.ink2}">${sub}</div>` : ''}</div>${right}</div>`;
const ctx = (label, body, w = 300) => ({ label, html: `<div style="width:${w}px;line-height:normal;font-family:Inter,Arial;color:${INK}">${body}</div>` });

family(`contexto-r${ROUND}`, `Rodada ${ROUND} · emblema novo em contexto · Mapa (34), zona (16/20), feed (20/24), pódio (40/32), resumo (30/32), trocar de time (44/64)`, 3, () => {
  const out = [];
  out.push(ctx('Mapa · chip do time (34) e marcadores (34, sob ataque com anel)', `${row(badge('striders', 34), 'Neon Striders', '47 zonas em Goiânia · demonstração')}<div style="position:relative;height:120px;background:#121a22;border-radius:14px;overflow:hidden"><div style="position:absolute;left:40px;top:30px">${svg(`<circle cx="50" cy="50" r="47" fill="none" stroke="#FF4D45" stroke-width="5" stroke-dasharray="9 7"/><g transform="translate(50 50) scale(0.78) translate(-50 -50)">${miniCheio('coyotes')}</g>`, 40)}</div><div style="position:absolute;left:160px;top:60px">${badge('volt', 34)}</div><div style="position:absolute;left:230px;top:20px">${badge(null, 34)}</div></div>`));
  out.push(ctx('Zona · barra de disputa (16) e dono sob ataque (16)', `<div style="display:flex;justify-content:space-between;font:700 15px Arial;margin-bottom:6px"><span style="display:flex;gap:6px;align-items:center">${badge('striders', 16)} Striders 13</span><span style="display:flex;gap:6px;align-items:center">12 Coyotes ${badge('coyotes', 16)}</span></div><div style="display:flex;height:8px;border-radius:4px;overflow:hidden"><div style="flex:13;background:${T.striders}"></div><div style="flex:12;background:${T.coyotes}"></div></div><div style="margin-top:14px;display:flex;align-items:center;gap:6px;font:13px Arial;color:${ART.ink2}">${badge('striders', 16)} Dos Neon Striders · sob ataque</div>${row(badge('owls', 20), 'ana.demo', '3 corridas aqui')}`));
  out.push(ctx('Feed (20) · crew (22/24)', `${row(badge('striders', 20), 'ana.demo · Hoje', '')}${row(badge('volt', 24), 'teo.demo', 'Corrida de 5,2 km')}${row(badge('coyotes', 22), 'bento.demo', 'membro')}`));
  out.push(ctx('Clube · ranking de times (22) e pódio (40 / 32)', `<div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;height:150px;padding:10px;background:#0F1013;border-radius:14px"><div style="text-align:center"><div style="display:flex;justify-content:center">${badge('coyotes', 32)}</div><div style="width:60px;height:50px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div><div style="text-align:center"><div style="display:flex;justify-content:center">${badge('striders', 40)}</div><div style="width:60px;height:80px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div><div style="text-align:center"><div style="display:flex;justify-content:center">${badge('volt', 32)}</div><div style="width:60px;height:36px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div></div>${row(badge('owls', 22), '4º Night Owls', '312 zonas')}`));
  out.push(ctx('Resumo · zonas conquistadas (30) · time (32)', `${row(badge('striders', 32), 'Você correu pelos Neon Striders', '+176 pontos')}${row(badge('striders', 30), 'Shopping Flamboyant', 'era dos Urban Coyotes', badge('coyotes', 20))}${row(badge(null, 30), 'Setor Bueno', 'neutra')}`));
  out.push(ctx('Perfil · trocar de time (44) e cabeçalho (64)', `${row(badge('coyotes', 44), 'Urban Coyotes', 'Correm em matilha')}${row(badge('owls', 44), 'Night Owls', 'Donos das luzes da cidade')}${row(badge('volt', 64), 'maria.demo', 'Volt Runners')}`));
  // card do Stories: pílula com a mini cabeça + selo grande
  const pill = (team) => `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 6px;border-radius:20px;border:1.5px solid ${T[team]};background:${T[team]}1A;font:800 11px Arial;letter-spacing:1.5px">${badge(team, 18)} ${NAMES[team].toUpperCase()}</div>`;
  out.push(ctx('Card do Stories · pílula (TeamPill) com a mini cabeça · e o selo grande (TeamBadge r=60 → médio 72)', `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${pill('striders')}${pill('volt')}${pill('owls')}${pill('coyotes')}</div><div style="display:flex;gap:10px">${TEAMS.map((t) => badge(t, 72, 'medio')).join('')}</div>`));
  return out;
}, 330);

// antes × depois: selo antigo (team-badge.tsx) e o emblema novo nos mesmos tamanhos
family(`antes-depois`, 'Antes (selo antigo, cor sólida do token) × depois (emblema novo, cor neon) · 16, 20, 28, 34, 44, 64 · e o emblema antigo (TeamEmblem compacto) × o grande novo em 96', 13, () => {
  const { oldBadge } = require('./atual.cjs');
  const t = art('team/mascot-art.ts');
  const core = art('neon/core.ts');
  const { primsToMarkup, svgMarkup } = art('neon/markup.ts');
  const out = [];
  for (const team of TEAMS) {
    for (const w of [16, 20, 28, 34, 44, 64]) out.push(cell(`antes ${w}`, oldBadge(team, w), w));
    for (const w of [16, 20, 28, 34, 44, 64]) out.push(cell(`depois ${w}`, badge(team, w), w));
    out.push(cell('neutro', badge(null, 28), 28));
  }
  for (const team of TEAMS) out.push(cell(`antes · TeamEmblem compacto 96`, svgMarkup(200, 200, primsToMarkup(core.expand(t.emblemNodes(team, T[team], true), 'completo')), 96), 96));
  for (const team of TEAMS) out.push(cell(`depois · grande 96`, svg(grande(team, 96), 96), 96));
  return out;
}, 100);

/** Grava os SVGs do protótipo (mini/médio/grande/mono por time) para a equipe de implementação. */
function dumpSvgs() {
  const fs = require('fs');
  for (const team of TEAMS) {
    fs.writeFileSync(path.join(OUT, `emblema-${team}-mini.svg`), svg(miniCheio(team, T[team], BG, true), 28));
    fs.writeFileSync(path.join(OUT, `emblema-${team}-medio.svg`), svg(medio(team), 64));
    fs.writeFileSync(path.join(OUT, `emblema-${team}-grande.svg`), svg(grande(team, 120), 120));
    fs.writeFileSync(path.join(OUT, `emblema-${team}-mono.svg`), svg(mono(team, INK, ORANGE), 40));
  }
  fs.writeFileSync(path.join(OUT, `emblema-neutro.svg`), svg(neutro(), 28));
}

function page(name) {
  const f = FAMILIES[name];
  const cells = f
    .build()
    .map((p) => `<figure>${p.html}<figcaption>${p.label}</figcaption></figure>`)
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${BG};color:${INK};font-family:Inter,Arial,sans-serif;padding:28px 32px;width:${f.cols * f.cell}px}
  h1{font:800 13px Arial;letter-spacing:2.4px;color:${ORANGE};margin:0 0 14px;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(${f.cols},1fr);gap:10px}
  figure{margin:0;background:#0B0C0F;border:1px solid #1B1C21;border-radius:12px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
  .art{position:relative;line-height:0} .art svg{display:block}
  figcaption{font-size:10px;color:${ART.ink2};text-align:center;margin-top:6px}
  </style><h1>NOMADE RUN · F8 · PROPOSTA · ${f.title}</h1><div class="grid">${cells}</div>`;
}

module.exports = { miniCheio, miniContorno, medio, mono, neutro, grande, SHAPES, HEADS, svg };

if (require.main === module) {
  (async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const c = await browser.newContext({ deviceScaleFactor: 1 });
    const tab = await c.newPage();
    dumpSvgs();
    for (const name of Object.keys(FAMILIES)) {
      await tab.setContent(page(name));
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
