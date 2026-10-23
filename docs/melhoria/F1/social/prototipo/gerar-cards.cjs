/**
 * Protótipo F1 dos cards de compartilhamento do NOMADE RUN (E8).
 *
 * Gera SVG puro (só elementos que o react-native-svg 15 desenha: path, circle, rect, line, polygon,
 * text/tspan, g, linearGradient, radialGradient, clipPath) e renderiza em PNG com Playwright.
 * Nada de filtro CSS nem `filter=`: o brilho neon é feito com traços empilhados da mesma cor,
 * o mesmo truque que vai funcionar no app e no `Svg.toDataURL`.
 *
 * Uso (na raiz do repositório):
 *   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/social/prototipo/gerar-cards.cjs [pasta-temp]
 *
 * Dados: rota real de `docs/apresentacao/mockup/build/mapa.json` (volta de 2,02 km no entorno do
 * Parque Flamboyant) e números do modo demonstração (`apps/mobile/src/demo/demo-data.ts`).
 * Todo card leva o selo "DADOS DE DEMONSTRAÇÃO".
 */
const fs = require('fs');
const path = require('path');
const { clipForSharing, noPointInsideZones, rng, length } = require('./privacidade.cjs');

const ROOT = path.resolve(__dirname, '../../../../..');
const OUT = path.resolve(__dirname, '..');
const TMP = process.argv[2] || path.join(OUT, '.tmp');
const FONTS = path.join(ROOT, 'apps/mobile/node_modules/@expo-google-fonts');
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/apresentacao/mockup/build/mapa.json'), 'utf8'));
const METRICS = require('./font-metrics.json');

// ---------------------------------------------------------------------------------------------
// Tokens (cópia de src/theme/neon.ts e tokens.ts — Pit Lane Neon)
// ---------------------------------------------------------------------------------------------
const C = {
  bg: '#070708',
  bgDeep: '#050506',
  surface: '#0F1013',
  surface2: '#1A1B20',
  line: '#24252B',
  ink: '#F3F1ED',
  ink2: '#A8A6A1',
  ink3: '#8A8883',
  orange: '#FF6A13',
  orangeText: '#FF7A2A',
  orangeCore: '#FFD9BF',
  glowBg: '#2B1407',
};
const TEAMS = {
  striders: { name: 'Neon Striders', color: '#2FA8FF', shape: 'circulo' },
  volt: { name: 'Volt Runners', color: '#19E6A8', shape: 'triangulo' },
  owls: { name: 'Night Owls', color: '#FF2D55', shape: 'losango' },
  coyotes: { name: 'Urban Coyotes', color: '#FFD60A', shape: 'quadrado' },
};
const F = {
  display: 'InterTight_800ExtraBold',
  displayMedium: 'InterTight_600SemiBold',
  bold: 'Inter_700Bold',
  medium: 'Inter_500Medium',
};

// ---------------------------------------------------------------------------------------------
// Dados de demonstração
// ---------------------------------------------------------------------------------------------
const DEMO = {
  user: '@gabryel',
  faction: 'striders',
  dateLabel: 'QUINTA · 23 OUT · GOIÂNIA',
  km: '2,02',
  time: '10:29',
  pace: '5:12',
  points: '+183',
  zonesConquered: 1,
  zonesReinforced: 3,
  zone: { name: 'Jardim Goiás', points: '+46', from: 'coyotes', to: 'striders' },
  level: { n: 8, xpTotal: '8.000 XP', next: 'Faltam 1.900 XP para o nível 9', totals: [['86', 'km no total'], ['14', 'zonas'], ['23', 'corridas']] },
  boss: { name: 'Mormaço de Outubro', myDamage: '6,3', cityKm: '3.600 km', days: '5 dias', crew: 'Flamboyant Runners', crewKm: '412 km', crewRank: '1º' },
  week: { range: '20 – 26 OUT', km: '12,4', runs: 3, time: '1h04', zones: 4, streak: 4, days: [0, 4.1, 0, 3.6, 0, 4.7, 0] },
  year: { y: '2026', km: '418', runs: 96, zones: 37, hood: 'Jardim Goiás', bestPace: '4:48' },
};

// Rota real (metros, x leste / y para baixo) e zona de privacidade "Casa" a 60 m do início (raio padrão 200 m).
const ROUTE = mapa.routePts;
const HOME = { c: [ROUTE[0][0] + 45, ROUTE[0][1] + 40], r: 200 };

// Outras rotas da semana (forma da volta do lago do demo-data.ts, em metros)
function demoRouteMeters() {
  const pts = [];
  const off = (p, m, b) => [p[0] + m * Math.sin((b * Math.PI) / 180), p[1] - m * Math.cos((b * Math.PI) / 180)];
  for (let a = 200; a <= 560; a += 12) pts.push(off([0, 0], 330, a));
  let p = pts[pts.length - 1];
  for (let i = 0; i < 26; i++) pts.push((p = off(p, 32, 95)));
  for (let i = 0; i < 12; i++) pts.push((p = off(p, 32, 10)));
  for (let i = 0; i < 24; i++) pts.push((p = off(p, 32, 265)));
  return pts;
}
const ROUTE_B = ROUTE.map(([x, y]) => [-y * 0.9, -x * 1.1]);
void demoRouteMeters;
const ROUTE_C = (() => {
  const base = ROUTE.slice(8, 40);
  return [...base, ...[...base].reverse().map(([x, y]) => [x + 14, y + 6])];
})();

// ---------------------------------------------------------------------------------------------
// Medida de texto sem DOM (mesma técnica proposta para o app: tabela de avanços da fonte)
// ---------------------------------------------------------------------------------------------
function measure(text, font, size, ls = 0) {
  const m = METRICS[font];
  let w = 0;
  for (const ch of text) w += m.adv[ch] ?? m.fallback;
  return (w / 1000) * size + ls * Math.max(0, [...text].length - 1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function text(x, y, str, o = {}) {
  const a = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${o.font ?? F.bold}"`,
    `font-size="${o.size ?? 32}"`,
    `fill="${o.fill ?? C.ink}"`,
    o.anchor ? `text-anchor="${o.anchor}"` : '',
    o.ls ? `letter-spacing="${o.ls}"` : '',
    o.opacity != null ? `opacity="${o.opacity}"` : '',
    o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw}" stroke-linejoin="round"` : '',
  ].join(' ');
  return `<text ${a}>${o.raw ?? esc(str)}</text>`;
}

/**
 * Texto de destaque. Contorno empilhado em texto vira "letra com borda marrom" (testado na 1ª rodada e
 * descartado): o brilho do texto vem de `lightPool` atrás dele, e o texto fica limpo.
 */
function glowText(x, y, str, o) {
  const { glow: _g, ...rest } = o;
  return text(x, y, str, rest);
}

/** Poça de luz: elipse com degradê radial (substitui o text-shadow do CSS, que o SVG nativo não tem). */
function lightPool(cx, cy, rx, ry, color, op = 0.3) {
  const id = `lp${uid++}`;
  return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="0.55" stop-color="${color}" stop-opacity="${op * 0.35}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})"/>`;
}

// ---------------------------------------------------------------------------------------------
// Peças visuais
// ---------------------------------------------------------------------------------------------
function teamGlyph(shape, cx, cy, r, fill) {
  switch (shape) {
    case 'circulo':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
    case 'triangulo':
      return `<polygon points="${cx},${cy - r * 1.15} ${cx + r * 1.1},${cy + r * 0.8} ${cx - r * 1.1},${cy + r * 0.8}" fill="${fill}"/>`;
    case 'losango':
      return `<polygon points="${cx},${cy - r * 1.25} ${cx + r * 1.05},${cy} ${cx},${cy + r * 1.25} ${cx - r * 1.05},${cy}" fill="${fill}"/>`;
    default:
      return `<rect x="${cx - r * 0.9}" y="${cy - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="${r * 0.25}" fill="${fill}"/>`;
  }
}

/** Selo do time: forma + anel com brilho (a forma sempre acompanha a cor, para daltônicos). */
function teamBadge(faction, cx, cy, r) {
  const t = TEAMS[faction];
  return [
    `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="${t.color}" opacity="0.12"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.bg}" stroke="${t.color}" stroke-width="${Math.max(3, r * 0.12)}"/>`,
    teamGlyph(t.shape, cx, cy, r * 0.46, t.color),
  ].join('');
}

/** Pílula do time (selo + nome), alinhada à direita em `right`. */
function teamPill(faction, right, cy, scale = 1) {
  const t = TEAMS[faction];
  const size = 28 * scale;
  const label = t.name.toUpperCase();
  const tw = measure(label, F.bold, size, 3 * scale);
  const h = 64 * scale;
  const w = tw + 96 * scale;
  const x = right - w;
  return [
    `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${t.color}" fill-opacity="0.1" stroke="${t.color}" stroke-opacity="0.7" stroke-width="2"/>`,
    teamGlyph(t.shape, x + 34 * scale, cy, 11 * scale, t.color),
    text(x + 60 * scale, cy + size * 0.36, label, { font: F.bold, size, fill: C.ink, ls: 3 * scale }),
  ].join('');
}

/** Logotipo "NOMADE RUN": NOMADE claro, RUN laranja com brilho (mesmo do hero-wordmark do app). */
function wordmark(x, y, size, anchor = 'start') {
  const ls = size * 0.06;
  const w1 = measure('NOMADE', F.display, size, ls);
  const gap = size * 0.28;
  const w2 = measure('RUN', F.display, size, ls);
  const total = w1 + gap + w2;
  const x0 = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  return (
    text(x0, y, 'NOMADE', { font: F.display, size, fill: C.ink, ls }) +
    glowText(x0 + w1 + gap, y, 'RUN', { font: F.display, size, fill: C.orange, ls })
  );
}

function demoTag(x, y, anchor = 'middle', size = 22) {
  return text(x, y, 'DADOS DE DEMONSTRAÇÃO', { font: F.bold, size, fill: C.ink3, ls: 4, anchor });
}

function chip(cx, cy, label, color, opts = {}) {
  const size = opts.size ?? 30;
  const tw = measure(label, F.bold, size, 0);
  const h = opts.h ?? 72;
  const w = tw + 110;
  const x = opts.anchor === 'start' ? cx : cx - w / 2;
  return [
    `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2.5"/>`,
    teamGlyph(opts.shape ?? 'circulo', x + 44, cy, 11, color),
    text(x + 74, cy + size * 0.36, label, { font: F.bold, size, fill: C.ink }),
  ].join('');
}

/** Rota neon: 5 traços empilhados (halo largo → núcleo claro). */
function neonPath(d, s = 1, o = {}) {
  const c = o.color ?? C.orange;
  const k = (o.width ?? 1) / s;
  const layers = [
    [46, 0.05],
    [26, 0.1],
    [14, 0.26],
    [8, 1],
  ];
  return (
    layers.map(([w, op]) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w * k}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') +
    `<path d="${d}" fill="none" stroke="${o.core ?? C.orangeCore}" stroke-width="${2.6 * k}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

const toD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');

function bbox(pieces) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of pieces) for (const [x, y] of p) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

let uid = 0;
/**
 * Mapa do card: fundo escuro sem tiles, pontos de grade bem leves, regiões dos times (suavizadas,
 * nunca hexágonos), rota neon. `fit` = pedaços usados no enquadramento.
 */
function mapPanel(box, o) {
  const id = `m${uid++}`;
  const fit = bbox(o.fit);
  const pad = o.pad ?? 90;
  const fb = o.fitBox ?? box; // área onde a rota precisa caber (o mapa pode sangrar além dela)
  const s = Math.min((fb.w - pad * 2) / fit.w, (fb.h - pad * 2) / fit.h) * (o.zoom ?? 1);
  const cx = fit.x0 + fit.w / 2;
  const cy = fit.y0 + fit.h / 2;
  const tx = fb.x + fb.w / 2 - cx * s;
  const ty = fb.y + fb.h / 2 - cy * s;
  const parts = [];
  parts.push(`<defs><clipPath id="${id}c"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${box.rx ?? 0}"/></clipPath>`);
  parts.push(
    `<linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.bg ?? C.bg}" stop-opacity="1"/><stop offset="1" stop-color="${o.bg ?? C.bg}" stop-opacity="0"/></linearGradient>`,
  );
  parts.push(
    `<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.bg ?? C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${o.bg ?? C.bg}" stop-opacity="1"/></linearGradient></defs>`,
  );
  if (o.fade !== false) {
    const f = o.fadeStops ?? [[0, 0.45], [0.16, 1], [0.74, 1], [1, 0]];
    parts.push(`<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${f.map(([k, v]) => `<stop offset="${k}" stop-color="#fff" stop-opacity="${v}"/>`).join('')}</linearGradient><mask id="${id}k" maskUnits="userSpaceOnUse" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${id}g)"/></mask></defs>`);
  }
  parts.push(`<g clip-path="url(#${id}c)"${o.fade !== false ? ` mask="url(#${id}k)"` : ''}>`);
  if (o.panelFill) parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${o.panelFill}"/>`);
  // grade de pontos (textura de "mapa técnico"; quadrada e leve, nunca hexágonos)
  if (o.dots !== false) {
    const step = o.dotStep ?? 36;
    let dots = '';
    for (let y = box.y + step / 2; y < box.y + box.h; y += step) for (let x = box.x + step / 2; x < box.x + box.w; x += step) dots += `M${x.toFixed(1)} ${y.toFixed(1)}h0.01`;
    parts.push(`<path d="${dots}" stroke="${C.ink}" stroke-opacity="0.07" stroke-width="3.2" stroke-linecap="round"/>`);
  }
  parts.push(`<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">`);
  for (const r of o.regions ?? []) {
    const hl = o.highlight === r.owner;
    const col = TEAMS[r.owner]?.color ?? r.color;
    parts.push(`<path d="${r.d}" fill="${col}" fill-opacity="${hl ? 0.3 : 0.11}"/>`);
    parts.push(`<path d="${r.d}" fill="none" stroke="${col}" stroke-opacity="${hl ? 0.22 : 0.1}" stroke-width="${(hl ? 22 : 14) / s}" stroke-linejoin="round"/>`);
    parts.push(`<path d="${r.d}" fill="none" stroke="${col}" stroke-opacity="${hl ? 1 : 0.55}" stroke-width="${(hl ? 4 : 2.5) / s}" stroke-linejoin="round"/>`);
  }
  for (const p of o.routes ?? []) parts.push(neonPath(toD(p), s, o.routeStyle));
  if (o.privacyCircle) {
    const z = o.privacyCircle;
    parts.push(`<circle cx="${z.c[0]}" cy="${z.c[1]}" r="${z.r}" fill="${C.ink}" fill-opacity="0.05" stroke="${C.ink}" stroke-opacity="0.6" stroke-width="${3 / s}" stroke-dasharray="${12 / s} ${10 / s}"/>`);
  }
  parts.push('</g>');
  parts.push('</g>');
  if (o.border) parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${box.rx ?? 0}" fill="none" stroke="${C.line}" stroke-width="2"/>`);
  return parts.join('');
}

function background(W, H, o = {}) {
  const id = `bg${uid++}`;
  const team = TEAMS[o.faction ?? DEMO.faction].color;
  return [
    `<defs>`,
    `<radialGradient id="${id}a" cx="0.5" cy="${o.teamY ?? 0.32}" r="${o.teamR ?? 0.62}"><stop offset="0" stop-color="${team}" stop-opacity="${o.teamOp ?? 0.16}"/><stop offset="1" stop-color="${team}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id}b" cx="0.5" cy="1.02" r="0.6"><stop offset="0" stop-color="${C.orange}" stop-opacity="${o.orangeOp ?? 0.22}"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${H}" fill="${C.bg}"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}a)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}b)"/>`,
  ].join('');
}

/** Raios de luz (como na celebração de conquista do mockup). */
function rays(cx, cy, r0, r1, n, color, op = 0.1) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const a2 = a + (Math.PI * 2) / n / 2.4;
    d += `M${cx + Math.cos(a) * r0} ${cy + Math.sin(a) * r0}L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a2) * r1} ${cy + Math.sin(a2) * r1}Z`;
  }
  const id = `r${uid++}`;
  return `<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r1}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><path d="${d}" fill="url(#${id})"/>`;
}

/** Bloco de estatística (rótulo pequeno + valor grande + unidade). */
function stat(x, y, label, value, unit, o = {}) {
  const vs = o.size ?? 66;
  const anchor = o.anchor ?? 'start';
  const vw = measure(value, F.display, vs) + (unit ? measure(unit, F.bold, vs * 0.42) + 10 : 0);
  const x0 = anchor === 'middle' ? x - vw / 2 : x;
  return [
    text(anchor === 'middle' ? x : x0, y, label, { font: F.bold, size: o.labelSize ?? 24, fill: C.ink2, ls: 5, anchor: anchor === 'middle' ? 'middle' : undefined }),
    text(x0, y + vs + 6, value, { font: F.display, size: vs, fill: o.fill ?? C.ink }),
    unit ? text(x0 + measure(value, F.display, vs) + 10, y + vs + 6, unit, { font: F.bold, size: vs * 0.42, fill: C.ink2 }) : '',
  ].join('');
}

/** Número herói com unidade (ex.: "2,02 km"), centralizado. */
function hero(cx, y, value, unit, size, o = {}) {
  const us = size * 0.3;
  const gap = size * 0.06;
  const w = measure(value, F.display, size, -size * 0.02) + (unit ? gap + measure(unit, F.display, us) : 0);
  const x0 = o.anchor === 'start' ? cx : cx - w / 2;
  return (
    (o.pool === false ? '' : lightPool(x0 + w / 2, y - size * 0.36, w * 0.62, size * 0.62, o.fill ?? C.orange, 0.26)) +
    glowText(x0, y, value, { font: F.display, size, fill: o.fill ?? C.orange, ls: -size * 0.02 }) +
    (unit ? text(x0 + measure(value, F.display, size, -size * 0.02) + gap, y, unit, { font: F.display, size: us, fill: C.ink }) : '')
  );
}

function svgDoc(W, H, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

// ---------------------------------------------------------------------------------------------
// Privacidade: rota do card = rota cortada
// ---------------------------------------------------------------------------------------------
const clipped = clipForSharing(ROUTE, [HOME], { random: rng(7) });
if (!noPointInsideZones(clipped.pieces, [HOME])) throw new Error('vazou ponto dentro da zona de privacidade');
const REGIONS = mapa.regions;
// Rota dos cards: a casa do exemplo não fica no caminho desta corrida; ainda assim o início e o fim
// (150–250 m sorteados) somem por padrão.
const CARD_ROUTE = clipForSharing(ROUTE, [], { random: rng(7) });

// ---------------------------------------------------------------------------------------------
// Layout por formato
// ---------------------------------------------------------------------------------------------
const FMT = {
  stories: { W: 1080, H: 1920, top: 300, safeBottom: 1670 },
  feed: { W: 1080, H: 1350, top: 116, safeBottom: 1300 },
};

function frame(fmt, inner, o = {}) {
  const { W, H, top } = FMT[fmt];
  const parts = [background(W, H, o.bg)];
  parts.push(inner);
  parts.push(wordmark(72, top, fmt === 'stories' ? 44 : 40));
  parts.push(teamPill(o.faction ?? DEMO.faction, W - 72, top - 15, fmt === 'stories' ? 1 : 0.9));
  if (fmt === 'stories') {
    parts.push(text(W / 2, 1780, 'CORRA A SUA CIDADE. CADA RUA CONTA.', { font: F.bold, size: 24, fill: C.ink2, ls: 5, anchor: 'middle' }));
    parts.push(demoTag(W / 2, 1830));
  } else {
    parts.push(text(72, H - 50, 'CORRA A SUA CIDADE.', { font: F.bold, size: 22, fill: C.ink2, ls: 5 }));
    parts.push(demoTag(W - 72, H - 50, 'end', 20));
  }
  return svgDoc(W, H, parts.join(''));
}

// 1. Corrida --------------------------------------------------------------------------------
function cardCorrida(fmt, o = {}) {
  const { W } = FMT[fmt];
  const st = fmt === 'stories';
  const p = [];
  // mapa sangrado até o topo (o cabeçalho fica por cima); some suave antes dos números
  const map = st ? { x: 0, y: 0, w: W, h: 1200 } : { x: 0, y: 0, w: W, h: 820 };
  if (!o.noRoute) {
    p.push(mapPanel(map, { fit: CARD_ROUTE.pieces, routes: CARD_ROUTE.pieces, regions: REGIONS, pad: 40, fitBox: st ? { x: 60, y: 370, w: W - 120, h: 760 } : { x: 60, y: 160, w: W - 120, h: 600 }, fadeStops: [[0, 0.35], [0.2, 1], [0.84, 1], [1, 0]] }));
  } else {
    p.push(noRouteArt(st ? { x: 0, y: 330, w: W, h: 820 } : { x: 0, y: 150, w: W, h: 620 }));
  }
  const yLabel = st ? 1215 : 850;
  p.push(text(W / 2, yLabel, DEMO.dateLabel, { font: F.bold, size: st ? 28 : 24, fill: C.orangeText, ls: 6, anchor: 'middle' }));
  p.push(hero(W / 2, st ? 1420 : 1030, DEMO.km, 'km', st ? 230 : 190));
  const ys = st ? 1500 : 1088;
  const vs = st ? 64 : 54;
  const cols = [W / 2 - 330, W / 2, W / 2 + 330];
  p.push(stat(cols[0], ys, 'TEMPO', DEMO.time, '', { anchor: 'middle', size: vs }));
  p.push(stat(cols[1], ys, 'RITMO', DEMO.pace, '/km', { anchor: 'middle', size: vs }));
  p.push(stat(cols[2], ys, 'PONTOS', DEMO.points, '', { anchor: 'middle', size: vs, fill: C.orange }));
  for (const dx of [-165, 165]) p.push(`<line x1="${W / 2 + dx}" y1="${ys - 24}" x2="${W / 2 + dx}" y2="${ys + vs + 12}" stroke="${C.line}" stroke-width="2"/>`);
  const t = TEAMS[DEMO.faction];
  p.push(chip(W / 2, st ? 1655 : 1232, `1 zona conquistada · 3 reforçadas`, t.color, { shape: t.shape, size: st ? 30 : 26, h: st ? 72 : 62 }));
  return frame(fmt, p.join(''));
}

/** Arte da versão "sem rota" (privacidade total): pista oval genérica + raios do time; nada de geografia. */
function noRouteArt(box) {
  const t = TEAMS[DEMO.faction];
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const p = [rays(cx, cy, 60, box.h * 0.75, 28, t.color, 0.16)];
  const r = box.h * 0.3;
  for (const k of [1.35, 1.18]) p.push(`<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.55 * k}" ry="${r * k}" fill="none" stroke="${C.line}" stroke-width="3"/>`);
  const oval = `M${cx - r * 1.55} ${cy}a${r * 1.55} ${r} 0 1 0 ${r * 3.1} 0a${r * 1.55} ${r} 0 1 0 ${-r * 3.1} 0`;
  p.push(neonPath(oval, 1));
  p.push(teamBadge(DEMO.faction, cx, cy - 18, 62));
  p.push(text(cx, cy + 92, 'ROTA PROTEGIDA', { font: F.bold, size: 22, fill: C.ink2, ls: 6, anchor: 'middle' }));
  return p.join('');
}

// 2. Conquista de zona ------------------------------------------------------------------------
function cardConquista(fmt, o = {}) {
  const { W } = FMT[fmt];
  const st = fmt === 'stories';
  const t = TEAMS[DEMO.zone.to];
  const from = TEAMS[DEMO.zone.from];
  const p = [];
  const map = st ? { x: 0, y: 0, w: W, h: 1150 } : { x: 0, y: 0, w: W, h: 760 };
  if (!o.noRoute) {
    p.push(mapPanel(map, { fit: CARD_ROUTE.pieces, routes: CARD_ROUTE.pieces, regions: REGIONS, highlight: DEMO.zone.to, pad: 40, fitBox: st ? { x: 60, y: 360, w: W - 120, h: 700 } : { x: 60, y: 160, w: W - 120, h: 540 }, fadeStops: [[0, 0.35], [0.2, 1], [0.84, 1], [1, 0]] }));
  } else {
    const cy = st ? 740 : 440;
    const R = st ? 210 : 160;
    p.push(rays(W / 2, cy, R * 0.6, R * 3, 30, t.color, 0.2));
    p.push(lightPool(W / 2, cy, R * 1.8, R * 1.8, t.color, 0.22));
    p.push(`<circle cx="${W / 2}" cy="${cy}" r="${R + 30}" fill="none" stroke="${t.color}" stroke-opacity="0.18" stroke-width="34"/>`);
    p.push(`<circle cx="${W / 2}" cy="${cy}" r="${R}" fill="${C.bg}" stroke="${t.color}" stroke-width="10"/>`);
    p.push(teamGlyph(t.shape, W / 2, cy, R * 0.45, t.color));
  }
  let y = st ? 1160 : 770;
  p.push(text(W / 2, y, 'ZONA CONQUISTADA', { font: F.bold, size: st ? 32 : 28, fill: C.orangeText, ls: 10, anchor: 'middle' }));
  y += st ? 138 : 108;
  p.push(lightPool(W / 2, y - 45, 520, 130, t.color, 0.22));
  p.push(text(W / 2, y, DEMO.zone.name, { font: F.display, size: st ? 128 : 104, fill: C.ink, anchor: 'middle', ls: -2 }));
  y += st ? 96 : 76;
  // de → para
  const fs1 = st ? 30 : 27;
  const lw = 38 + measure(from.name, F.bold, fs1) + 24 + 100 + 38 + measure(t.name, F.bold, fs1);
  let x = W / 2 - lw / 2;
  p.push(teamGlyph(from.shape, x + 14, y - 10, 12, from.color));
  p.push(text(x + 38, y, from.name, { font: F.bold, size: fs1, fill: C.ink2 }));
  x += 38 + measure(from.name, F.bold, fs1) + 24;
  p.push(`<path d="M${x} ${y - 10}h70m-18 -14l18 14l-18 14" fill="none" stroke="${C.orange}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
  x += 100;
  p.push(teamGlyph(t.shape, x + 14, y - 10, 12, t.color));
  p.push(text(x + 38, y, t.name, { font: F.bold, size: fs1, fill: C.ink }));
  y += st ? 178 : 140;
  p.push(hero(W / 2, y, DEMO.zone.points, 'pontos', st ? 150 : 118));
  y += st ? 92 : 70;
  p.push(text(W / 2, y, `${DEMO.km} km  ·  ${DEMO.time}  ·  ${DEMO.pace} /km`, { font: F.displayMedium, size: st ? 38 : 32, fill: C.ink2, anchor: 'middle' }));
  return frame(fmt, p.join(''), { bg: { teamOp: 0.2, teamY: 0.7, teamR: 0.5 } });
}

// 3. Nível novo -------------------------------------------------------------------------------
function cardNivel(fmt) {
  const { W } = FMT[fmt];
  const st = fmt === 'stories';
  const t = TEAMS[DEMO.faction];
  const p = [];
  const cy = st ? 790 : 480;
  const R = st ? 300 : 230;
  p.push(rays(W / 2, cy, R * 0.5, R * 2.3, 36, C.orange, 0.2));
  p.push(lightPool(W / 2, cy, R * 1.5, R * 1.5, C.orange, 0.18));
  p.push(`<circle cx="${W / 2}" cy="${cy}" r="${R}" fill="${C.bg}" stroke="${C.surface2}" stroke-width="30"/>`);
  for (const [w, op] of [[74, 0.06], [48, 0.14], [30, 1]]) p.push(`<circle cx="${W / 2}" cy="${cy}" r="${R}" fill="none" stroke="${C.orange}" stroke-width="${w}" stroke-opacity="${op}"/>`);
  p.push(`<circle cx="${W / 2}" cy="${cy}" r="${R}" fill="none" stroke="${C.orangeCore}" stroke-width="5"/>`);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r0 = R - 50;
    const r1 = R - (i % 5 === 0 ? 78 : 62);
    p.push(`<line x1="${W / 2 + Math.cos(a) * r0}" y1="${cy + Math.sin(a) * r0}" x2="${W / 2 + Math.cos(a) * r1}" y2="${cy + Math.sin(a) * r1}" stroke="${C.ink}" stroke-opacity="${i % 5 === 0 ? 0.4 : 0.14}" stroke-width="4" stroke-linecap="round"/>`);
  }
  p.push(text(W / 2, cy - R * 0.4, 'NÍVEL', { font: F.bold, size: st ? 32 : 26, fill: C.ink2, ls: 10, anchor: 'middle' }));
  p.push(text(W / 2, cy + R * 0.4, String(DEMO.level.n), { font: F.display, size: st ? 310 : 240, fill: C.ink, anchor: 'middle' }));
  // vaga do mascote do time (E4): por enquanto, o selo do time preso ao anel
  p.push(teamBadge(DEMO.faction, W / 2 + R * 0.71, cy + R * 0.71, st ? 62 : 50));
  let y = cy + R + (st ? 165 : 120);
  p.push(text(W / 2, y, 'NÍVEL NOVO', { font: F.bold, size: st ? 32 : 26, fill: C.orangeText, ls: 10, anchor: 'middle' }));
  y += st ? 104 : 80;
  p.push(text(W / 2, y, 'Cheguei ao nível 8', { font: F.display, size: st ? 84 : 66, fill: C.ink, anchor: 'middle', ls: -1 }));
  // barra do próximo nível já começa andando (progresso dotado)
  y += st ? 62 : 46;
  const bw = st ? 700 : 620;
  p.push(`<rect x="${W / 2 - bw / 2}" y="${y}" width="${bw}" height="20" rx="10" fill="${C.surface2}"/>`);
  p.push(`<rect x="${W / 2 - bw / 2}" y="${y}" width="${bw * 0.05}" height="20" rx="10" fill="${C.orange}"/>`);
  p.push(text(W / 2, y + 62, DEMO.level.next, { font: F.medium, size: st ? 28 : 24, fill: C.ink2, anchor: 'middle' }));
  y += st ? 190 : 140;
  const cols = [W / 2 - 300, W / 2, W / 2 + 300];
  DEMO.level.totals.forEach(([v, l], i) => {
    p.push(text(cols[i], y, v, { font: F.display, size: st ? 72 : 56, fill: i === 1 ? t.color : C.ink, anchor: 'middle' }));
    p.push(text(cols[i], y + (st ? 48 : 38), l.toUpperCase(), { font: F.bold, size: st ? 22 : 19, fill: C.ink2, ls: 4, anchor: 'middle' }));
  });
  return frame(fmt, p.join(''), { bg: { teamOp: 0.06, orangeOp: 0.3 } });
}

// 4. Chefão derrotado -------------------------------------------------------------------------
/** Emblema provisório do chefão (a ilustração final é da E4): sol de mormaço partido ao meio. */
function bossEmblem(cx, cy, R) {
  const p = [];
  const id = `boss${uid++}`;
  p.push(`<defs><radialGradient id="${id}" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#FFC08F"/><stop offset="0.4" stop-color="${C.orange}"/><stop offset="1" stop-color="#E5301F"/></radialGradient></defs>`);
  // coroa de calor: 3 anéis finos que "vazam" para fora
  for (const [k, op] of [[1.55, 0.12], [1.35, 0.22], [1.17, 0.5]]) p.push(`<circle cx="${cx}" cy="${cy}" r="${R * k}" fill="none" stroke="${C.orange}" stroke-opacity="${op}" stroke-width="${k > 1.4 ? 3 : 4}" stroke-dasharray="${k > 1.4 ? '6 18' : k > 1.2 ? '2 14' : 'none'}"/>`);
  p.push(lightPool(cx, cy, R * 2.2, R * 2.2, C.orange, 0.35));
  // as duas metades, afastadas pela rachadura
  const crack = [[0.18, -1.2], [-0.06, -0.62], [0.2, -0.3], [-0.16, 0.12], [0.08, 0.46], [-0.1, 1.2]];
  const pts = (side) => crack.map(([x, y]) => `${cx + x * R + side * R * 0.06} ${cy + y * R}`).join(' L');
  const gap = R * 0.15;
  p.push(`<clipPath id="${id}l"><path d="M${cx - R * 2} ${cy - R * 2} L${pts(0)} L${cx - R * 2} ${cy + R * 2}Z"/></clipPath>`);
  p.push(`<clipPath id="${id}r"><path d="M${cx + R * 2} ${cy - R * 2} L${pts(0)} L${cx + R * 2} ${cy + R * 2}Z"/></clipPath>`);
  p.push(`<g clip-path="url(#${id}l)"><g transform="translate(${-gap} ${gap * 0.3}) rotate(-5 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id})"/></g></g>`);
  p.push(`<g clip-path="url(#${id}r)"><g transform="translate(${gap} ${-gap * 0.2}) rotate(6 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id})"/></g></g>`);
  // rachadura incandescente (luz saindo de dentro)
  const crackD = `M${pts(0)}`;
  p.push(`<path d="${crackD}" fill="none" stroke="${C.orange}" stroke-opacity="0.35" stroke-width="${R * 0.22}" stroke-linejoin="round" stroke-linecap="round"/>`);
  p.push(`<path d="${crackD}" fill="none" stroke="#FFE3CF" stroke-width="${R * 0.035}" stroke-linejoin="round" stroke-linecap="round"/>`);
  // estilhaços
  const shards = [[1.25, -0.55, 0.11], [1.05, 0.75, 0.08], [-1.2, 0.45, 0.1], [-0.95, -0.95, 0.07], [0.45, -1.35, 0.06], [-0.3, 1.4, 0.07]];
  for (const [sx, sy, sz] of shards) {
    const x = cx + sx * R;
    const y = cy + sy * R;
    const k = sz * R;
    p.push(`<polygon points="${x},${y - k} ${x + k * 0.8},${y + k * 0.6} ${x - k * 0.7},${y + k * 0.4}" fill="${C.orange}" opacity="0.85"/>`);
  }
  return p.join('');
}

function cardChefao(fmt) {
  const { W } = FMT[fmt];
  const st = fmt === 'stories';
  const p = [];
  const cy = st ? 720 : 430;
  const R = st ? 200 : 150;
  p.push(rays(W / 2, cy, R * 0.8, R * 3.6, 32, C.orange, 0.14));
  p.push(bossEmblem(W / 2, cy, R));
  // carimbo
  const sw = st ? 470 : 400;
  const sh = st ? 104 : 88;
  const sy = cy + R * 1.12;
  p.push(`<g transform="rotate(-6 ${W / 2} ${sy})">`);
  p.push(`<rect x="${W / 2 - sw / 2}" y="${sy - sh / 2}" width="${sw}" height="${sh}" rx="16" fill="${C.bg}" stroke="${C.ink}" stroke-width="5"/>`);
  p.push(text(W / 2, sy + sh * 0.24, 'DERROTADO', { font: F.display, size: st ? 62 : 52, fill: C.ink, anchor: 'middle', ls: 8 }));
  p.push('</g>');
  let y = cy + R + (st ? 250 : 185);
  p.push(text(W / 2, y, 'CHEFÃO DA CIDADE', { font: F.bold, size: st ? 30 : 26, fill: C.orangeText, ls: 10, anchor: 'middle' }));
  y += st ? 100 : 80;
  p.push(text(W / 2, y, DEMO.boss.name, { font: F.display, size: st ? 86 : 70, fill: C.ink, anchor: 'middle', ls: -1 }));
  y += st ? 54 : 42;
  p.push(text(W / 2, y, `Goiânia correu ${DEMO.boss.cityKm} em ${DEMO.boss.days}`, { font: F.medium, size: st ? 30 : 26, fill: C.ink2, anchor: 'middle' }));
  y += st ? 250 : 196;
  p.push(text(W / 2, y - (st ? 170 : 132), 'MEU DANO', { font: F.bold, size: 24, fill: C.ink2, ls: 6, anchor: 'middle' }));
  p.push(hero(W / 2, y, DEMO.boss.myDamage, 'km', st ? 160 : 124));
  y += st ? 86 : 62;
  const t = TEAMS[DEMO.faction];
  p.push(chip(W / 2, y, `${DEMO.boss.crew} · ${DEMO.boss.crewRank} lugar · ${DEMO.boss.crewKm}`, t.color, { shape: t.shape, size: st ? 28 : 24, h: st ? 68 : 58 }));
  return frame(fmt, p.join(''), { bg: { teamOp: 0.05, orangeOp: 0.3 } });
}

// 5. Recap semanal ----------------------------------------------------------------------------
function cardSemana(fmt, o = {}) {
  const { W } = FMT[fmt];
  const st = fmt === 'stories';
  const t = TEAMS[DEMO.faction];
  const p = [];
  let y = st ? 430 : 222;
  p.push(text(72, y, 'MINHA SEMANA', { font: F.bold, size: st ? 32 : 26, fill: C.orangeText, ls: 10 }));
  p.push(text(W - 72, y, DEMO.week.range, { font: F.bold, size: st ? 28 : 24, fill: C.ink2, ls: 4, anchor: 'end' }));
  y += st ? 228 : 170;
  p.push(hero(72, y, DEMO.week.km, 'km', st ? 220 : 160, { anchor: 'start' }));
  // gráfico da semana, abaixo do herói com folga para a vírgula
  y += st ? 110 : 70;
  const ch = st ? (o.noRoute ? 420 : 170) : o.noRoute ? 150 : 96;
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const max = Math.max(...DEMO.week.days);
  const bw = st ? 44 : 38;
  const gap = (W - 144 - bw * 7) / 6;
  DEMO.week.days.forEach((v, i) => {
    const x = 72 + i * (bw + gap);
    const h = v ? (v / max) * ch : 8;
    if (v) {
      p.push(lightPool(x + bw / 2, y + ch - h / 2, bw * 2.2, h * 0.75 + 30, C.orange, 0.2));
      p.push(`<rect x="${x}" y="${y + ch - h}" width="${bw}" height="${h}" rx="12" fill="${C.orange}"/>`);
      p.push(`<rect x="${x + bw / 2 - 3}" y="${y + ch - h + 10}" width="6" height="${Math.max(0, h - 20)}" rx="3" fill="${C.orangeCore}" opacity="0.55"/>`);
      p.push(text(x + bw / 2, y + ch - h - 18, v.toFixed(1).replace('.', ','), { font: F.display, size: st ? 30 : 24, fill: C.ink, anchor: 'middle' }));
    } else p.push(`<rect x="${x}" y="${y + ch - 8}" width="${bw}" height="8" rx="4" fill="${C.surface2}"/>`);
    p.push(text(x + bw / 2, y + ch + (st ? 46 : 36), days[i], { font: F.bold, size: st ? 24 : 20, fill: v ? C.ink : C.ink3, anchor: 'middle' }));
  });
  y += ch + (st ? 90 : 66);
  if (!o.noRoute) {
    const routes = [CARD_ROUTE.pieces, clipForSharing(ROUTE_B, [], { random: rng(3) }).pieces, clipForSharing(ROUTE_C, [], { random: rng(5) }).pieces];
    const tw = (W - 144 - 2 * 24) / 3;
    const th = st ? 340 : 220;
    routes.forEach((r, i) => {
      const box = { x: 72 + i * (tw + 24), y, w: tw, h: th, rx: 28 };
      p.push(mapPanel(box, { fit: r, routes: r, regions: REGIONS, pad: 38, dotStep: 26, fade: false, panelFill: C.surface, border: true, routeStyle: { width: 0.7 } }));
    });
    y += th + (st ? 100 : 70);
  } else y += st ? 90 : 30;
  const items = [
    [String(DEMO.week.runs), 'corridas'],
    [DEMO.week.time, 'em movimento'],
    [String(DEMO.week.zones), 'zonas'],
  ];
  const cols = [72, 72 + (W - 144) / 3, 72 + ((W - 144) * 2) / 3];
  items.forEach(([v, l], i) => {
    p.push(text(cols[i], y, v, { font: F.display, size: st ? 72 : 54, fill: i === 2 ? t.color : C.ink }));
    p.push(text(cols[i], y + (st ? 46 : 34), l.toUpperCase(), { font: F.bold, size: st ? 22 : 18, fill: C.ink2, ls: 4 }));
  });
  y += st ? 128 : 90;
  if (st || o.noRoute) p.push(chip(72, y, `Sequência de ${DEMO.week.streak} semanas`, C.orange, { anchor: 'start', size: st ? 28 : 24, h: st ? 68 : 58, shape: 'circulo' }));
  return frame(fmt, p.join(''), { bg: { teamOp: 0.1, teamY: 0.55 } });
}

// 6. Seu ano (futuro) -------------------------------------------------------------------------
function cardAno(fmt) {
  const { W } = FMT[fmt];
  const st = fmt === 'stories';
  const p = [];
  const map = st ? { x: 0, y: 330, w: W, h: 860 } : { x: 0, y: 140, w: W, h: 620 };
  // "Ruas que corri no ano": trechos de rua reais do entorno (camadas do mapa.json), com intensidade
  // sorteada (demonstração), já cortados pela zona de privacidade da casa. Sem fundo de mapa.
  const r = rng(11);
  const center = [40, -40];
  const streets = [];
  for (const layer of ['sec', 'ter', 'res', 'pri']) {
    for (const sub of mapa.layers[layer].split('M').filter(Boolean)) {
      const pts = sub
        .replace(/Z/g, '')
        .split('L')
        .map((q) => q.trim().split(/\s+/).map(Number))
        .filter((q) => q.length === 2 && q.every(Number.isFinite));
      if (pts.length < 2) continue;
      const mid = pts[Math.floor(pts.length / 2)];
      const d = Math.hypot(mid[0] - center[0], mid[1] - center[1]);
      if (d > 760) continue;
      const chance = 1.15 - d / 900; // mais perto do "bairro de sempre", mais corrido
      if (r() > chance) continue;
      const heat = Math.min(1, (1 - d / 760) * (0.5 + r() * 0.9));
      for (const piece of clipForSharing(pts, [HOME], { random: r, hideEnds: false, minPiece: 30 }).pieces) streets.push([piece, heat]);
    }
  }
  const all = streets.map(([piece]) => piece);
  const fit = bbox(all);
  const s = Math.min((map.w - 80) / fit.w, (map.h - 80) / fit.h);
  const tx = map.x + map.w / 2 - (fit.x0 + fit.w / 2) * s;
  const ty = map.y + map.h / 2 - (fit.y0 + fit.h / 2) * s;
  const mk = `ano${uid++}`;
  p.push(`<defs><radialGradient id="${mk}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0.6" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="${mk}" maskUnits="userSpaceOnUse" x="${map.x}" y="${map.y}" width="${map.w}" height="${map.h}"><rect x="${map.x}" y="${map.y}" width="${map.w}" height="${map.h}" fill="url(#${mk}g)"/></mask></defs>`);
  p.push(`<g mask="url(#${mk})"><g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">`);
  for (const [piece, h] of streets) p.push(`<path d="${toD(piece)}" fill="none" stroke="${C.orange}" stroke-opacity="${(0.05 + h * 0.18).toFixed(2)}" stroke-width="${(10 + h * 14) / s}" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const [piece, h] of streets) p.push(`<path d="${toD(piece)}" fill="none" stroke="${h > 0.55 ? C.orangeCore : C.orange}" stroke-opacity="${(0.35 + h * 0.65).toFixed(2)}" stroke-width="${(1.6 + h * 2.6) / s}" stroke-linecap="round" stroke-linejoin="round"/>`);
  p.push('</g></g>');
  let y = st ? 1260 : 830;
  p.push(glowText(W / 2, y, `MEU ${DEMO.year.y} NO NOMADE`, { font: F.bold, size: st ? 34 : 28, fill: C.orangeText, glow: C.orange, ls: 10, anchor: 'middle' }));
  y += st ? 230 : 180;
  p.push(hero(W / 2, y, DEMO.year.km, 'km', st ? 240 : 180));
  y += st ? 120 : 90;
  const items = [
    [String(DEMO.year.runs), 'corridas'],
    [String(DEMO.year.zones), 'zonas'],
    [DEMO.year.bestPace, 'melhor ritmo'],
  ];
  const cols = [W / 2 - 320, W / 2, W / 2 + 320];
  items.forEach(([v, l], i) => {
    p.push(text(cols[i], y, v, { font: F.display, size: st ? 70 : 56, fill: i === 1 ? TEAMS[DEMO.faction].color : C.ink, anchor: 'middle' }));
    p.push(text(cols[i], y + (st ? 46 : 36), l.toUpperCase(), { font: F.bold, size: st ? 22 : 19, fill: C.ink2, ls: 4, anchor: 'middle' }));
  });
  return frame(fmt, p.join(''), { bg: { teamOp: 0.08 } });
}

// 7. Adesivo transparente (paridade com o "Stats Sticker" do Strava) --------------------------
/** Sem fundo: a pessoa cola por cima da própria foto nos Stories. Texto com "sombra" escura leve para ler em foto clara. */
function stickerCorrida() {
  const W = 1080;
  const H = 1080;
  const p = [];
  const box = { x: 140, y: 40, w: 800, h: 560 };
  p.push(mapPanel(box, { fit: CARD_ROUTE.pieces, routes: CARD_ROUTE.pieces, regions: [], dots: false, fade: false, pad: 30 }));
  const shade = (x, y, str, o) => text(x, y + 4, str, { ...o, fill: '#000', opacity: 0.35 }) + text(x, y, str, o);
  p.push(shade(W / 2, 800, `${DEMO.km} km`, { font: F.display, size: 170, fill: C.orange, anchor: 'middle', ls: -3 }));
  p.push(shade(W / 2, 900, `${DEMO.time}  ·  ${DEMO.pace} /km  ·  ${DEMO.points} pontos`, { font: F.display, size: 50, fill: '#FFFFFF', anchor: 'middle' }));
  p.push(shade(W / 2, 1000, 'NOMADE RUN', { font: F.display, size: 40, fill: '#FFFFFF', anchor: 'middle', ls: 6 }));
  p.push(shade(W / 2, 1050, 'DADOS DE DEMONSTRAÇÃO', { font: F.bold, size: 22, fill: '#FFFFFF', anchor: 'middle', ls: 4 }));
  return svgDoc(W, H, p.join(''));
}

// Prova de privacidade (comparação) ------------------------------------------------------------
function provaPrivacidade() {
  const W = 1600;
  const H = 1000;
  const p = [`<rect width="${W}" height="${H}" fill="${C.bg}"/>`];
  const boxA = { x: 60, y: 160, w: 700, h: 760, rx: 32 };
  const boxB = { x: 840, y: 160, w: 700, h: 760, rx: 32 };
  p.push(text(60, 90, 'O QUE SÓ VOCÊ VÊ', { font: F.bold, size: 30, fill: C.ink2, ls: 6 }));
  p.push(text(840, 90, 'O QUE O CARD E O FEED MOSTRAM', { font: F.bold, size: 30, fill: C.orangeText, ls: 6 }));
  p.push(text(60, 132, 'Rota completa + zona "Casa" (raio 200 m)', { font: F.medium, size: 26, fill: C.ink3 }));
  p.push(text(840, 132, `Zona + folga sorteada + pontas: ${clipped.hiddenMeters} m escondidos`, { font: F.medium, size: 26, fill: C.ink3 }));
  p.push(mapPanel(boxA, { fit: [ROUTE], routes: [ROUTE], regions: REGIONS, pad: 70, privacyCircle: HOME, fade: false, panelFill: C.surface, border: true }));
  p.push(mapPanel(boxB, { fit: [ROUTE], routes: clipped.pieces, regions: REGIONS, pad: 70, fade: false, panelFill: C.surface, border: true }));
  p.push(demoTag(W / 2, H - 30));
  return svgDoc(W, H, p.join(''));
}

// ---------------------------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------------------------
function fontFace(name, file) {
  return `@font-face{font-family:'${name}';src:url('file://${file}') format('truetype');}`;
}
const CSS = [
  fontFace(F.display, `${FONTS}/inter-tight/800ExtraBold/InterTight_800ExtraBold.ttf`),
  fontFace(F.displayMedium, `${FONTS}/inter-tight/600SemiBold/InterTight_600SemiBold.ttf`),
  fontFace(F.bold, `${FONTS}/inter/700Bold/Inter_700Bold.ttf`),
  fontFace(F.medium, `${FONTS}/inter/500Medium/Inter_500Medium.ttf`),
  'html,body{margin:0;background:#000}svg{display:block}',
].join('');

const CARDS = [
  ['01-corrida', cardCorrida],
  ['02-conquista-zona', cardConquista],
  ['03-nivel-novo', cardNivel],
  ['04-chefao-derrotado', cardChefao],
  ['05-recap-semanal', cardSemana],
  ['06-seu-ano-futuro', cardAno],
];

async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(TMP, { recursive: true });
  const jobs = [];
  for (const [name, fn] of CARDS) {
    for (const fmt of ['stories', 'feed']) jobs.push([`card-${name}-${fmt}`, fn(fmt), FMT[fmt]]);
  }
  for (const [name, fn] of [
    ['01-corrida', cardCorrida],
    ['02-conquista-zona', cardConquista],
    ['05-recap-semanal', cardSemana],
  ])
    jobs.push([`card-${name}-stories-sem-rota`, fn('stories', { noRoute: true }), FMT.stories]);
  jobs.push(['privacidade-antes-depois', provaPrivacidade(), { W: 1600, H: 1000 }]);
  jobs.push(['adesivo-transparente-corrida', stickerCorrida(), { W: 1080, H: 1080, transparent: true }]);

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, svg, { W, H, transparent }] of jobs) {
    const html = path.join(TMP, `${name}.html`);
    fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${CSS}${transparent ? 'html,body{background:transparent}' : ''}</style>${svg}`);
    fs.writeFileSync(path.join(TMP, `${name}.svg`), svg);
    await page.setViewportSize({ width: W, height: H });
    await page.goto(`file://${html}`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('svg').first().screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: !!transparent });
    console.log('ok', name, `${(svg.length / 1024).toFixed(0)} KB de SVG`);
  }
  await browser.close();
  console.log('rota original', Math.round(length(ROUTE)), 'm; escondidos', clipped.hiddenMeters, 'm; pedaços', clipped.pieces.length);
}

if (require.main === module) main().catch((e) => (console.error(e), process.exit(1)));
module.exports = { cardCorrida, cardConquista, cardNivel, cardChefao, cardSemana, cardAno, CSS };
