// Baús, medalhas, estados vazios e ícones dos modos, no mesmo traço dos mascotes.
const { C, neon, glowFill, mirror, pivot, spark } = require('./neon.cjs');
const { mascot } = require('./times.cjs');

function pt(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
}
function star(cx, cy, r1, r2, n, rot = -90) {
  let d = '';
  for (let i = 0; i < n * 2; i++) d += (i ? ' L' : 'M') + pt(cx, cy, i % 2 ? r2 : r1, rot + (i * 180) / n);
  return d + ' Z';
}
function rays(cx, cy, r1, r2, n, from = 0, span = 360) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = from + (span * (i + 0.5)) / n;
    out.push(`M${pt(cx, cy, r1, a)} L ${pt(cx, cy, i % 2 ? r2 * 0.86 : r2, a)}`);
  }
  return out;
}

const PRISM = `<defs><linearGradient id="prisma" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${C.team.striders}"/><stop offset="0.36" stop-color="${C.team.volt}"/>
<stop offset="0.68" stop-color="${C.team.coyotes}"/><stop offset="1" stop-color="${C.team.owls}"/></linearGradient></defs>`;

// ---------------- Baús (160 × 160) ----------------
// Raridade = cor + forma (comum: liso; raro: cantoneiras e rebites; lendário: coroa de cristal e prisma).
function chest(rarity, state = 'fechado') {
  const col = rarity === 'lendario' ? 'url(#prisma)' : rarity === 'raro' ? C.orange : C.ink;
  const detail = rarity === 'comum' ? C.ink2 : C.ink;
  const body = 'M28 86 L 132 86 L 126 138 L 34 138 Z';
  const lid = 'M26 86 L 134 86 L 130 62 Q 80 42 30 62 Z';
  const open = state === 'aberto', opening = state === 'abrindo';
  let lidArt =
    neon(lid, col, 3.6, { fill: true, tint: 0.1 }) +
    neon(['M54 86 L 54 54', 'M106 86 L 106 54'], detail, 2.2, { glow: 0.4, hot: 0, opacity: 0.7 });
  if (rarity !== 'comum') lidArt += neon('M36 74 Q 80 58 124 74', detail, 1.6, { glow: 0.3, hot: 0, opacity: 0.6 });
  if (rarity === 'lendario') {
    lidArt += neon(['M66 50 L 72 36 L 80 46 L 88 36 L 94 50'], col, 3, { hot: 0.6 }) +
      glowFill('M80 30 L 87 40 L 80 50 L 73 40 Z', C.ink, { w: 1.2, glow: 1.2 });
  }
  let out = rarity === 'lendario' ? PRISM : '';
  if (rarity === 'lendario' || open) out += neon(rays(80, open ? 84 : 92, open ? 30 : 64, open ? 78 : 76, open ? 9 : 12, open ? 200 : 0, open ? 140 : 360), open && rarity !== 'lendario' ? col : C.ink, 2, { hot: 0, opacity: open ? 0.85 : 0.3, glow: 0.8 });
  if (open) {
    out += neon('M30 86 Q 80 76 130 86 Q 80 96 30 86 Z', col, 2.4, { fill: rarity === 'comum' ? '#1d1c1a' : '#2b1407', glow: 1.6 });
    out += glowFill(star(80, 62, 14, 5, 4), C.ink, { w: 1.2, glow: 1.4 }) + spark(52, 44, 5, C.ink) + spark(112, 38, 6, rarity === 'comum' ? C.ink : C.orange);
  }
  out += neon(body, col, 3.6, { fill: true, tint: 0.12 }) +
    neon(['M54 88 L 56 138', 'M106 88 L 104 138'], detail, 2.2, { glow: 0.4, hot: 0, opacity: 0.7 });
  if (rarity !== 'comum') {
    const corner = ['M28 100 L 28 86 L 42 86', 'M132 100 L 132 86 L 118 86', 'M34 124 L 34 138 L 48 138', 'M126 124 L 126 138 L 112 138'];
    out += neon(corner, C.ink, 3, { glow: 0.6 }) +
      glowFill([[40, 96], [120, 96], [44, 128], [116, 128]].map(([cx, cy]) => ({ tag: 'circle', cx, cy, r: 2 })), C.ink, { w: 0.6, glow: 0.5 });
  }
  if (open) {
    out += pivot(lidArt, { x: 30, y: 86, rotate: -14, ty: -26 });
  } else {
    if (opening) out += neon('M32 86 L 128 86', C.ink, 2.6, { glow: 2.2, hot: 0.9 });
    out += opening ? pivot(lidArt, { x: 30, y: 86, rotate: -4, ty: -6 }) : lidArt;
    out += neon({ tag: 'rect', x: 70, y: 80, width: 20, height: 22, rx: 4 }, col, 2.6, { fill: true, tint: 0.2 }) +
      glowFill('M80 86 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 M78.5 88 L 77.5 96 L 82.5 96 L 81.5 88 Z', C.ink, { w: 0.5, glow: 0.6 });
  }
  if (opening) out += neon(['M10 80 Q 4 92 10 104', 'M150 80 Q 156 92 150 104'], C.ink, 2.2, { hot: 0, opacity: 0.8 });
  out += neon('M30 148 L 130 148', col, 2, { hot: 0, opacity: 0.25, dash: '2 7' });
  return open ? pivot(out, { x: 80, y: 148, scale: 0.84, ty: 8 }) : out;
}

// ---------------- Medalhas (120 × 150) ----------------
function medal(icon, { locked = false, color = C.orange } = {}) {
  const col = locked ? C.ink2 : color;
  const strap = 'M30 2 L 48 60 L 62 60 L 44 2 Z';
  let out =
    neon([strap, mirror(strap, 60)], col, 2.4, { fill: true, tint: 0.14, glow: locked ? 0.2 : 0.6, hot: 0, opacity: locked ? 0.5 : 1 }) +
    neon(['M37 4 L 54 58', mirror('M37 4 L 54 58', 60)], C.ink, 1.4, { glow: 0, hot: 0, opacity: locked ? 0.3 : 0.6 }) +
    neon(star(60, 98, 44, 40, 24), col, 3, { fill: true, tint: 0.1, glow: locked ? 0.2 : 1, dash: locked ? '4 5' : undefined }) +
    neon({ tag: 'circle', cx: 60, cy: 98, r: 33 }, col, 1.6, { glow: 0, hot: 0, opacity: 0.55 });
  const ic = {
    explorador: neon({ tag: 'circle', cx: 60, cy: 98, r: 21 }, C.ink, 1.6, { glow: 0.3, hot: 0, opacity: 0.6 }) +
      glowFill(star(60, 98, 20, 5, 4), C.ink, { w: 1, glow: 0.8 }) + glowFill(star(60, 98, 9, 3, 4, -45), col, { w: 0.6, glow: 0.4 }),
    conquistador: neon(['M50 120 L 50 76'], C.ink, 3) + neon('M50 77 L 78 84 L 50 94 Z', col, 2.6, { fill: true, tint: 0.3 }) +
      neon('M38 120 Q 60 110 82 120', C.ink, 2.4, { hot: 0 }),
    sequencia: neon('M60 72 Q 80 92 74 108 Q 70 120 60 120 Q 48 120 45 108 Q 43 96 53 87 Q 53 98 60 101 Q 57 86 60 72 Z', col, 2.8, { fill: true, tint: 0.2 }) +
      glowFill('M60 96 Q 68 104 66 111 Q 64 116 60 116 Q 55 116 54 111 Q 53 104 60 96 Z', C.ink, { w: 0.6, glow: 0.8 }),
    chefao: neon('M42 86 L 46 70 L 55 82 L 65 82 L 74 70 L 78 86 L 76 104 L 66 116 L 54 116 L 44 104 Z', C.villain, 2.6, { fill: true, tint: 0.2 }) +
      glowFill(['M49 92 L 57 95 L 55 100 L 50 98 Z', mirror('M49 92 L 57 95 L 55 100 L 50 98 Z', 60)], C.ink, { w: 0.5, glow: 0.6 }) +
      neon(['M64 74 L 58 90 L 64 98 L 58 114'], C.ink, 1.8, { hot: 0 }),
    bloqueada: neon({ tag: 'rect', x: 47, y: 96, width: 26, height: 20, rx: 4 }, C.ink2, 2.4, { fill: true, glow: 0.3, hot: 0 }) +
      neon('M52 96 L 52 88 Q 52 80 60 80 Q 68 80 68 88 L 68 96', C.ink2, 2.4, { glow: 0.3, hot: 0 }),
  }[icon];
  return out + ic + (locked ? '' : spark(96, 60, 4, C.ink, 1.6));
}

// ---------------- Estados vazios (240 × 160) ----------------
function emptyRuns() {
  const shoe = 'M38 120 L 44 100 Q 60 98 72 86 L 84 88 Q 100 104 134 108 Q 160 112 162 122 L 162 126 L 38 126 Z';
  return neon('M168 122 Q 196 116 198 88 Q 200 62 216 54', C.ink2, 2.2, { hot: 0, dash: '1 8', glow: 0.3 }) +
    neon({ tag: 'circle', cx: 216, cy: 50, r: 10 }, C.orange, 2, { hot: 0, opacity: 0.45 }) +
    glowFill({ tag: 'circle', cx: 216, cy: 50, r: 4.5 }, C.orange, { w: 1 }) +
    neon(['M8 96 L 30 96', 'M14 108 L 34 108'], C.orange, 2.2, { hot: 0, opacity: 0.6 }) +
    neon(shoe, C.orange, 3.4, { fill: true, tint: 0.1 }) +
    neon(['M38 126 L 162 126', 'M50 134 L 158 134'], C.ink, 2.2, { glow: 0.4, hot: 0, opacity: 0.8 }) +
    neon(['M82 94 L 90 89', 'M89 100 L 97 94', 'M96 105 L 104 99'], C.ink, 2.2, { glow: 0.3, hot: 0 }) +
    neon('M46 112 Q 90 110 120 118 L 150 120', C.orange, 2, { hot: 0, opacity: 0.7 });
}
function emptyCrew() {
  const person = (x, y, s) => [{ tag: 'circle', cx: x, cy: y, r: 13 * s }, `M${x - 24 * s} ${y + 46 * s} Q ${x - 24 * s} ${y + 18 * s} ${x} ${y + 18 * s} Q ${x + 24 * s} ${y + 18 * s} ${x + 24 * s} ${y + 46 * s}`];
  return neon(person(66, 60, 0.85), C.ink2, 2.4, { dash: '3 6', glow: 0.2, hot: 0 }) +
    neon(person(174, 60, 0.85), C.ink2, 2.4, { dash: '3 6', glow: 0.2, hot: 0 }) +
    neon(person(120, 46, 1.1), C.orange, 3.4, { fill: true, tint: 0.1 }) +
    neon(['M66 52 L 66 68', 'M58 60 L 74 60', 'M174 52 L 174 68', 'M166 60 L 182 60'], C.orange, 2.4, { hot: 0.4 }) +
    neon('M40 132 Q 120 120 200 132', C.ink2, 1.8, { glow: 0, hot: 0, dash: '2 7' });
}
function emptyOffline() {
  const arc = (r) => `M${pt(120, 118, r, 225)} A ${r} ${r} 0 0 1 ${pt(120, 118, r, 315)}`;
  return glowFill({ tag: 'circle', cx: 120, cy: 118, r: 6 }, C.orange, { w: 1.2 }) +
    neon(arc(26), C.orange, 3.4) + neon(arc(48), C.orange, 3.4, { opacity: 0.55, dash: '22 10' }) +
    neon(arc(70), C.ink2, 2.6, { dash: '4 10', glow: 0.2, hot: 0 }) +
    neon(['M178 34 L 194 50', 'M194 34 L 178 50'], C.ink, 3) +
    neon('M40 140 L 200 140', C.ink2, 1.8, { glow: 0, hot: 0, dash: '2 7' });
}
function emptyNotif() {
  // Mascote do próprio time dormindo (aqui com o Breu): o vazio vira personalidade.
  return pivot(mascot('owls', 'dormindo'), { x: 0, y: 0, scale: 0.66, tx: 54, ty: 8 }) +
    neon(['M176 42 L 188 42 L 176 54 L 188 54', 'M196 22 L 204 22 L 196 30 L 204 30'], C.ink, 2.4, { hot: 0.4 });
}

// ---------------- Ícones dos modos (64 × 64) ----------------
const I = (d, col = C.ink, w = 3) => neon(d, col, w, { glow: 0.7, hot: 0.35 });
const MODE_ICONS = {
  dominio: neon('M14 40 Q 10 22 26 16 Q 30 15 33 15 Q 30 34 34 52 Q 22 54 14 40 Z', C.orange, 2.4, { fill: C.orange, glow: 0.6, hot: 0, opacity: 0.35 }) +
    I('M14 40 Q 10 22 26 16 Q 42 10 50 24 Q 58 40 44 50 Q 26 58 14 40 Z', C.ink) + I('M33 15 Q 30 34 34 52', C.orange, 3.4) + glowFill({ tag: 'circle', cx: 33, cy: 15, r: 3.6 }, C.orange, { w: 1 }),
  atlas: I('M10 18 L 24 12 L 40 18 L 54 12 L 54 46 L 40 52 L 24 46 L 10 52 Z') + I(['M24 12 L 24 46', 'M40 18 L 40 52'], C.ink, 2) + I('M14 34 Q 22 28 30 34 Q 38 40 50 32', C.orange, 3),
  fuga: neon([{ tag: 'circle', cx: 20, cy: 18, r: 5 }, 'M20 24 L 16 38 L 8 46 M16 38 L 24 44 L 24 54 M18 28 L 10 32'], C.ink2, 2.4, { dash: '3 4', glow: 0.3, hot: 0 }) +
    I([{ tag: 'circle', cx: 42, cy: 14, r: 5 }, 'M42 20 L 38 34 L 30 42 M38 34 L 46 40 L 46 52 M40 24 L 32 30 M40 24 L 52 26'], C.orange),
  caca: I(['M14 40 L 50 40 L 48 54 L 16 54 Z', 'M14 40 L 16 32 Q 32 26 48 32 L 50 40'], C.orange) + I(['M22 22 Q 32 14 42 22', 'M16 14 Q 32 2 48 14'], C.ink, 2.4),
  raid: I('M14 26 L 18 12 L 26 22 L 38 22 L 46 12 L 50 26 L 48 44 L 38 54 L 26 54 L 16 44 Z', C.villain) + I('M34 24 L 26 38 L 34 38 L 28 50', C.orange, 2.6),
  liga: I(['M8 52 L 8 38 L 22 38 L 22 52', 'M24 52 L 24 26 L 40 26 L 40 52', 'M42 52 L 42 32 L 56 32 L 56 52', 'M4 52 L 60 52']) + I('M32 6 L 35 13 L 42 13 L 36 18 L 38 24 L 32 20 L 26 24 L 28 18 L 22 13 L 29 13 Z', C.orange, 2.2),
  cidades: I(['M6 54 L 6 30 L 16 24 L 16 54', 'M16 54 L 16 36 L 26 36 L 26 54']) + I(['M58 54 L 58 22 L 48 28 L 48 54', 'M48 54 L 48 38 L 38 38 L 38 54'], C.ink) + I(['M28 14 L 36 22', 'M36 14 L 28 22'], C.orange, 3),
  crews: I([{ tag: 'circle', cx: 32, cy: 18, r: 7 }, 'M18 46 Q 18 30 32 30 Q 46 30 46 46'], C.orange) + I([{ tag: 'circle', cx: 12, cy: 26, r: 5 }, 'M2 50 Q 2 38 12 38 Q 18 38 20 42', { tag: 'circle', cx: 52, cy: 26, r: 5 }, 'M62 50 Q 62 38 52 38 Q 46 38 44 42'], C.ink, 2.4),
};

// ---------------- Cartões do tutorial (240 × 180) ----------------
const STREETS = ['M0 40 L 240 56', 'M0 128 L 240 112', 'M60 0 L 76 180', 'M170 0 L 158 180'];
function streets() { return neon(STREETS, C.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.22 }); }
function tutorial(step, team = 'striders') {
  const tc = C.team[team];
  const zone = 'M70 52 Q 110 30 158 58 Q 176 92 156 122 Q 112 142 74 120 Q 52 88 70 52 Z';
  if (step === 'corra') {
    return streets() +
      neon('M20 150 Q 60 150 74 116 Q 88 80 124 84 Q 164 88 176 54 Q 184 32 214 26', C.orange, 4, { glow: 1.2 }) +
      neon(['M10 150 L 18 150'], C.orange, 3, { hot: 0, opacity: 0.4 }) +
      glowFill({ tag: 'circle', cx: 214, cy: 26, r: 8 }, C.orange, { w: 1.4 }) +
      neon({ tag: 'circle', cx: 214, cy: 26, r: 16 }, C.orange, 2, { hot: 0, opacity: 0.4 }) +
      glowFill({ tag: 'circle', cx: 214, cy: 26, r: 3 }, C.ink, { glow: 0, w: 0.5 });
  }
  if (step === 'pinte') {
    return streets() +
      neon(zone, tc, 3, { fill: tc, glow: 0.8, hot: 0, opacity: 0.22 }) +
      neon(zone, tc, 3.4, { glow: 1.2 }) +
      neon('M30 160 Q 50 130 70 120 Q 112 142 156 122 Q 176 92 158 58', C.orange, 3.6, { glow: 1, hot: 0.5 }) +
      glowFill({ tag: 'circle', cx: 158, cy: 58, r: 7 }, C.orange, { w: 1.2 }) +
      neon(require('./neon.cjs').glyph('circulo', 114, 88, 12), tc, 3, { fill: true, tint: 0.3 }) +
      spark(196, 40, 7, C.ink) + spark(40, 46, 5, tc);
  }
  // defenda: zona do time com escudo, anel tracejado do rival (mesmo sinal do mapa)
  return streets() +
    neon({ tag: 'ellipse', cx: 116, cy: 90, rx: 92, ry: 66 }, C.team.coyotes, 2.6, { dash: '8 8', glow: 0.8, hot: 0, opacity: 0.9 }) +
    neon(zone, tc, 3, { fill: tc, glow: 0.8, hot: 0, opacity: 0.22 }) + neon(zone, tc, 3.4, { glow: 1.2 }) +
    neon('M116 58 L 140 66 Q 140 104 116 118 Q 92 104 92 66 Z', C.ink, 3.2, { fill: true, tint: 0.06, glow: 1 }) +
    neon('M104 86 L 113 96 L 130 76', C.orange, 3.4) +
    neon(['M206 40 L 192 52', 'M214 64 L 196 70', 'M22 132 L 38 124'], C.team.coyotes, 2.4, { hot: 0, opacity: 0.8 });
}

const NOME = { comum: 'comum', raro: 'raro', lendario: 'lendário', explorador: 'Explorador', conquistador: 'Conquistador', sequencia: 'Sequência', chefao: 'Chefão', dominio: 'Domínio', atlas: 'Atlas', fuga: 'Fuga', caca: 'Caça', raid: 'Raid', liga: 'Liga', cidades: 'Cidade × Cidade', crews: 'Crews' };
const ITEMS = [];
for (const st of ['corra', 'pinte', 'defenda']) ITEMS.push({ file: `tutorial-${st}.svg`, w: 240, h: 180, body: tutorial(st), label: `Tutorial · ${st}`, group: 'tutorial' });
for (const r of ['comum', 'raro', 'lendario']) ITEMS.push({ file: `bau-${r}-fechado.svg`, w: 160, h: 160, body: chest(r), label: `Baú ${NOME[r]} · fechado`, group: 'baus' });
ITEMS.push({ file: 'bau-raro-abrindo.svg', w: 160, h: 160, body: chest('raro', 'abrindo'), label: 'Baú raro · abrindo', group: 'baus' });
ITEMS.push({ file: 'bau-raro-aberto.svg', w: 160, h: 160, body: chest('raro', 'aberto'), label: 'Baú raro · aberto', group: 'baus' });
ITEMS.push({ file: 'bau-lendario-aberto.svg', w: 160, h: 160, body: chest('lendario', 'aberto'), label: 'Baú lendário · aberto', group: 'baus' });
for (const k of ['explorador', 'conquistador', 'sequencia', 'chefao']) ITEMS.push({ file: `medalha-${k}.svg`, w: 120, h: 150, body: medal(k), label: `Medalha ${NOME[k]}`, group: 'medalhas' });
ITEMS.push({ file: 'medalha-bloqueada.svg', w: 120, h: 150, body: medal('bloqueada', { locked: true }), label: 'Medalha bloqueada', group: 'medalhas' });
ITEMS.push({ file: 'vazio-sem-corridas.svg', w: 240, h: 160, body: emptyRuns(), label: 'Vazio · sem corridas', group: 'vazios' });
ITEMS.push({ file: 'vazio-sem-crew.svg', w: 240, h: 160, body: emptyCrew(), label: 'Vazio · sem crew', group: 'vazios' });
ITEMS.push({ file: 'vazio-sem-conexao.svg', w: 240, h: 160, body: emptyOffline(), label: 'Vazio · sem conexão', group: 'vazios' });
ITEMS.push({ file: 'vazio-sem-notificacoes.svg', w: 240, h: 160, body: emptyNotif(), label: 'Vazio · sem notificações', group: 'vazios' });
for (const [k, body] of Object.entries(MODE_ICONS)) ITEMS.push({ file: `modo-${k}.svg`, w: 64, h: 64, body, label: NOME[k], group: 'modos' });

module.exports = { ITEMS, chest, medal, MODE_ICONS };
