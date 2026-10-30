// Chefões da Raid. viewBox 240 × 240, chão em y = 226.
// Regra da família: contorno violeta (cor reservada aos vilões) + 1 cor de "material" por chefão
// + olhos brancos incandescentes. Estados: parado, golpe, furioso, derrotado.
const { C, mix, neon, glowFill, mirror, pivot, spark } = require('./neon.cjs');

const V = C.villain;
const HOT = '#FF4A1C'; // laranja em brasa (furioso)
const m = (d) => mirror(d, 120);

function pt(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
}
function star(cx, cy, r1, r2, n = 8, rot = 0) {
  let d = '';
  for (let i = 0; i < n * 2; i++) d += (i ? ' L' : 'M') + pt(cx, cy, i % 2 ? r2 : r1, rot + (i * 180) / n);
  return d + ' Z';
}
function zz(x, y, s) {
  return `M${x} ${y} L ${x + s} ${y} L ${x} ${y + s} L ${x + s} ${y + s}`;
}
function puff(cx, cy, r, op = 0.7) {
  return neon([{ tag: 'circle', cx, cy, r }, { tag: 'circle', cx: cx + r * 0.9, cy: cy + r * 0.2, r: r * 0.7 }, { tag: 'circle', cx: cx - r * 0.9, cy: cy + r * 0.3, r: r * 0.6 }], C.ink2, 2, { fill: true, tint: 0.05, glow: 0.4, hot: 0, opacity: op });
}
function ground(op = 0.35) {
  return neon('M30 228 L 210 228', V, 2, { hot: 0, opacity: op, dash: '2 8' });
}
/** Impacto do golpe: estrela + estilhaços, no ponto onde o "golpe" acerta. */
function impact(cx, cy) {
  return glowFill(star(cx, cy, 22, 9, 8, 10), C.ink, { w: 1.2 }) + neon(star(cx, cy, 34, 16, 8, 32), C.orange, 2.6, { hot: 0.5 }) +
    spark(cx + 40, cy - 22, 6, C.orange) + spark(cx - 10, cy + 40, 5, C.ink);
}
function xEyes(x1, x2, y, s = 8) {
  const x = (cx) => [`M${cx - s} ${y - s} L ${cx + s} ${y + s}`, `M${cx + s} ${y - s} L ${cx - s} ${y + s}`];
  return neon([...x(x1), ...x(x2)], C.ink, 3.4, { glow: 0.6 });
}
function squint(x1, x2, y) {
  return neon([`M${x1 - 10} ${y - 7} L ${x1 + 8} ${y} L ${x1 - 10} ${y + 7}`, `M${x2 + 10} ${y - 7} L ${x2 - 8} ${y} L ${x2 + 10} ${y + 7}`], C.ink, 3.6);
}
function shake(op = 0.8) {
  return neon(['M14 92 Q 8 104 14 116', 'M6 100 Q 0 112 6 124', m('M14 92 Q 8 104 14 116'), m('M6 100 Q 0 112 6 124')], C.ink, 2.4, { hot: 0, opacity: op });
}

// ---------------- Mormaço (calor) ----------------
function mormaco(state) {
  const cx = 120, cy = 112, R0 = 64;
  const fur = state === 'furioso', hit = state === 'golpe', down = state === 'derrotado';
  const accent = fur ? HOT : hit ? mix(C.orange, '#ffffff', 0.55) : C.orange;
  const body = hit ? mix(V, '#ffffff', 0.55) : V;
  const rays = [];
  for (let i = 0; i < 12; i++) {
    if (down && i % 2) continue;
    const a = -90 + i * 30;
    const R = down ? 82 : fur ? (i % 2 ? 100 : 112) : i % 2 ? 92 : 102;
    const tip = pt(cx, cy, R, a + (fur ? 12 : 8));
    rays.push(`M${pt(cx, cy, R0, a - 10)} L ${tip} L ${pt(cx, cy, R0, a + 10)}`);
  }
  let face = '';
  if (down) {
    face = xEyes(100, 140, 104, 7) + neon('M98 132 Q 109 126 120 132 Q 131 138 142 132', body, 3);
  } else if (hit) {
    face = squint(100, 140, 104) + neon('M94 132 L 102 127 L 110 134 L 118 127 L 126 134 L 134 127 L 144 132', C.ink, 2.6);
  } else {
    const eye = fur ? 'M84 95 L 113 104 L 108 117 L 88 113 Z' : 'M86 98 L 112 106 L 106 113 L 90 110 Z';
    const brow = fur ? 'M76 80 L 120 100' : 'M78 88 L 120 100';
    face = neon([brow, m(brow)], body, 5.2) +
      neon([eye, m(eye)], body, 2.6, { fill: true, tint: 0 }) +
      glowFill([eye, m(eye)], mix(C.ink, V, 0.15), { w: 0.6, glow: 0.4, opacity: 0.95 }) +
      glowFill([{ tag: 'circle', cx: 104, cy: fur ? 108 : 107, r: 3 }, { tag: 'circle', cx: 136, cy: fur ? 108 : 107, r: 3 }], V, { w: 0.8, glow: 0 });
    face += fur
      ? neon('M88 124 Q 120 172 152 124 Q 120 134 88 124 Z', body, 3, { fill: '#160a1f' }) +
        neon(['M98 128 L 102 140 L 106 129', 'M134 129 L 138 140 L 142 128'], C.ink, 2.2, { hot: 0.4 })
      : neon('M88 126 Q 120 148 152 126 Q 120 137 88 126 Z', body, 3, { fill: '#160a1f' }) +
        neon('M96 129 L 101 134 L 106 131 L 111 136 L 116 132 L 121 137 L 126 132 L 131 136 L 136 131 L 141 134 L 146 129', C.ink, 1.8, { hot: 0.4 });
  }
  const cuts = [150, 158, 165].map((y, i) => {
    const hc = Math.sqrt(R0 * R0 - (y - cy) * (y - cy)) - 6;
    return `<path d="M${cx - hc} ${y} L ${cx + hc} ${y}" stroke="${C.bg}" stroke-width="${2.2 + i * 1.4}" stroke-linecap="round"/>`;
  }).join('');
  let art =
    neon(rays, accent, 3.4, { fill: true, tint: 0.14, glow: fur ? 1.4 : 1 }) +
    neon({ tag: 'circle', cx, cy, r: R0 }, accent, 4.2, { fill: true, tint: fur ? 0.22 : 0.16, glow: fur ? 1.4 : 1 }) +
    neon({ tag: 'circle', cx, cy, r: R0 - 10 }, body, 1.8, { hot: 0, opacity: 0.5, dash: '3 7' }) +
    cuts + face;
  if (down) {
    art += neon('M150 66 L 140 84 L 152 92 L 142 110', C.bg, 4, { glow: 0, hot: 0 }) + neon('M150 66 L 140 84 L 152 92 L 142 110', body, 1.6, { glow: 0.6, hot: 0 });
    return ground() + neon(['M34 224 L 52 214 L 58 224', 'M176 226 L 196 220 L 194 228'], C.orange, 2.6, { opacity: 0.6, hot: 0 }) +
      puff(84, 30, 9, 0.5) + puff(150, 20, 7, 0.4) +
      pivot(art, { x: cx, y: 180, rotate: 14, ty: 34, scale: 0.86 }).replace('<g ', '<g opacity="0.62" ');
  }
  if (hit) return ground() + impact(48, 60) + pivot(art, { x: cx, y: 180, rotate: 7, tx: 6, ty: 2, scale: 0.92 });
  if (fur) {
    const waves = ['M44 70 Q 36 60 44 50 Q 52 40 44 30', 'M196 70 Q 188 60 196 50 Q 204 40 196 30'];
    return ground() + shake() + neon(waves, HOT, 2.4, { hot: 0, opacity: 0.7 }) + pivot(art, { x: cx, y: 118, scale: 0.92 });
  }
  return ground() + art;
}

// ---------------- Paredão (concreto) ----------------
function paredao(state) {
  const fur = state === 'furioso', hit = state === 'golpe', down = state === 'derrotado';
  const body = hit ? mix(V, '#ffffff', 0.55) : V;
  const crackC = fur ? HOT : C.orange;
  if (down) {
    const blocks = [
      { x: 40, y: 196, w: 46, h: 28, r: -8 }, { x: 92, y: 200, w: 58, h: 26, r: 3 }, { x: 156, y: 194, w: 44, h: 30, r: 10 },
      { x: 66, y: 172, w: 40, h: 26, r: 14 }, { x: 134, y: 170, w: 42, h: 26, r: -12 }, { x: 18, y: 214, w: 20, h: 12, r: 20 }, { x: 204, y: 212, w: 18, h: 14, r: -18 },
    ];
    let out = ground() + puff(60, 150, 10, 0.4) + puff(186, 140, 8, 0.35) + puff(122, 120, 6, 0.3);
    for (const b of blocks)
      out += pivot(neon({ tag: 'rect', x: b.x, y: b.y, width: b.w, height: b.h, rx: 3 }, body, 3.2, { fill: true, glow: 0.6 }), { x: b.x + b.w / 2, y: b.y + b.h / 2, rotate: b.r });
    const head = neon('M96 134 L 144 134 L 148 172 L 92 172 Z', body, 3.6, { fill: true, glow: 0.6 }) + xEyes(108, 132, 150, 6) +
      neon(['M74 172 L 66 150', 'M164 170 L 176 152'], C.orange, 2.4, { opacity: 0.6, hot: 0 });
    return out + pivot(head, { x: 120, y: 152, rotate: -16 }).replace('<g ', '<g opacity="0.7" ');
  }
  const L = (y) => 46 + ((y - 94) * 8) / 98;
  const R = (y) => 194 - ((y - 94) * 8) / 98;
  const rows = [120, 146, 170].map((y) => `M${L(y) + 3} ${y} L ${R(y) - 3} ${y}`);
  const joints = [[100, 94, 120], [140, 94, 120], [80, 120, 146], [160, 120, 146], [104, 146, 170], [136, 146, 170], [84, 170, 192], [156, 170, 192]].map(([x, a, b]) => `M${x} ${a + 3} L ${x} ${b - 3}`);
  const armUp = fur;
  const arm = armUp ? 'M50 100 L 30 88 L 22 52 L 46 46 L 54 76' : 'M48 100 L 26 112 L 20 158 L 44 162 L 50 128';
  const fist = armUp ? { tag: 'rect', x: 10, y: 18, width: 44, height: 34, rx: 5 } : { tag: 'rect', x: 8, y: 154, width: 42, height: 34, rx: 5 };
  const fistR = { ...fist, x: 240 - fist.x - fist.width };
  const eye = fur ? 'M96 70 L 116 76 L 114 86 L 96 80 Z' : 'M98 72 L 116 78 L 114 84 L 98 80 Z';
  let face;
  if (hit) face = squint(106, 134, 78);
  else face = neon([eye, m(eye)], body, 2.4, { fill: true, tint: 0 }) + glowFill([eye, m(eye)], fur ? mix(C.ink, HOT, 0.35) : C.ink, { w: 0.6, glow: fur ? 1.2 : 0.5 });
  const mouth = fur
    ? neon({ tag: 'rect', x: 104, y: 88, width: 32, height: 4, rx: 1 }, C.ink, 2, { fill: '#160a1f', glow: 0.5 })
    : neon('M106 90 L 118 90 L 122 87 L 126 91 L 134 90', body, 2.6);
  const cracks = ['M120 98 L 112 114 L 124 126 L 114 144'].concat(fur ? ['M74 130 L 86 140 L 78 156', 'M166 104 L 156 118 L 168 128', 'M140 160 L 150 176 L 142 188'] : []);
  const rebar = ['M62 94 L 52 70', 'M76 94 L 72 62'];
  const art =
    neon([{ tag: 'rect', x: 80, y: 188, width: 30, height: 36, rx: 4 }, { tag: 'rect', x: 130, y: 188, width: 30, height: 36, rx: 4 }], body, 3.4, { fill: true }) +
    neon([...rebar, ...rebar.map(m)], fur ? HOT : C.orange, 3, { glow: fur ? 1.4 : 0.9 }) +
    neon('M92 60 L 148 60 L 154 104 L 86 104 Z', body, 3.8, { fill: true, tint: 0.1 }) +
    neon('M46 94 L 194 94 L 186 192 L 54 192 Z', body, 4, { fill: true, tint: 0.1 }) +
    neon([...rows, ...joints], C.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.45 }) +
    neon(cracks, crackC, 2.6, { glow: fur ? 1.6 : 1, hot: 0.7 }) +
    neon([arm, m(arm)], body, 3.6, { fill: true }) +
    neon([fist, fistR], body, 3.6, { fill: true, tint: 0.16 }) +
    neon(['M90 66 L 120 76 L 150 66'], body, 5.4) + face + mouth;
  if (hit) {
    const chips = [[34, 44, 8, 20], [70, 26, 6, -30], [20, 84, 5, 45]].map(([x, y, s, r]) => pivot(neon({ tag: 'rect', x, y, width: s, height: s }, C.ink2, 2, { fill: true, hot: 0 }), { x, y, rotate: r })).join('');
    return ground() + impact(56, 62) + chips + pivot(art, { x: 120, y: 224, rotate: 5, tx: -4, scale: 0.94 });
  }
  if (fur) return ground() + shake() + puff(70, 40, 7, 0.55) + puff(170, 36, 7, 0.55) + art;
  return ground() + art;
}

// ---------------- Elenco (só "parado" na F1) ----------------
function soneca() {
  const cx = 120, cy = 132;
  const ticks = [];
  for (let i = 0; i < 12; i++) ticks.push(`M${pt(cx, cy, 52, i * 30)} L ${pt(cx, cy, i % 3 ? 47 : 43, i * 30)}`);
  const bell = 'M54 80 A 24 24 0 0 1 96 58 Z';
  const bellR = 'M186 80 A 24 24 0 0 0 144 58 Z';
  return ground() +
    neon(['M84 184 L 72 222 L 92 222', m('M84 184 L 72 222 L 92 222')], V, 3.4, { fill: true }) +
    neon([bell, bellR], C.ink, 3.2, { fill: true, tint: 0.12 }) +
    glowFill([{ tag: 'circle', cx: 70, cy: 52, r: 3.4 }, { tag: 'circle', cx: 170, cy: 52, r: 3.4 }], C.ink, { w: 1 }) +
    neon('M120 68 L 120 46 M104 46 L 136 46', C.ink, 3, { hot: 0.4 }) +
    neon({ tag: 'circle', cx, cy, r: 64 }, V, 4.2, { fill: true, tint: 0.12 }) +
    neon(ticks, C.ink, 2, { glow: 0.4, hot: 0, opacity: 0.6 }) +
    neon(['M86 120 Q 100 112 114 120', m('M86 120 Q 100 112 114 120')], V, 3.4) +
    neon(['M88 128 L 112 128 Q 100 138 88 128 Z', m('M88 128 L 112 128 Q 100 138 88 128 Z')], C.ink, 2.4, { fill: true, tint: 0 }) +
    glowFill([{ tag: 'circle', cx: 102, cy: 131, r: 3 }, { tag: 'circle', cx: 138, cy: 131, r: 3 }], V, { w: 0.8, glow: 0 }) +
    neon({ tag: 'ellipse', cx: 120, cy: 158, rx: 12, ry: 9 }, V, 3, { fill: '#160a1f' }) +
    neon([zz(196, 98, 13), zz(212, 74, 9), zz(222, 56, 6)], C.ink, 2.6, { hot: 0.4 });
}

function reiBuzina() {
  const cone = (x, y, s) => [`M${x} ${y} L ${x + s * 0.55} ${y + s * 1.6} L ${x - s * 0.55} ${y + s * 1.6} Z`];
  const stripe = (x, y, s) => `M${x - s * 0.33} ${y + s * 0.95} L ${x + s * 0.33} ${y + s * 0.95}`;
  const waves = ['M30 120 Q 20 134 30 148', 'M18 112 Q 4 134 18 156'];
  return ground() +
    neon([...waves, ...waves.map(m)], C.orange, 2.6, { hot: 0.4, opacity: 0.8 }) +
    neon([{ tag: 'circle', cx: 78, cy: 206, r: 16 }, { tag: 'circle', cx: 162, cy: 206, r: 16 }], V, 3.4, { fill: true }) +
    neon('M72 60 L 168 60 L 184 100 L 56 100 Z', V, 3.6, { fill: true, tint: 0.08 }) +
    neon('M50 100 L 190 100 L 198 196 L 42 196 Z', V, 4, { fill: true, tint: 0.12 }) +
    neon(['M84 72 L 156 72 L 166 94 L 74 94 Z'], C.ink2, 1.8, { glow: 0.3, hot: 0, opacity: 0.55 }) +
    neon(['M58 112 L 108 124', m('M58 112 L 108 124')], V, 5) +
    glowFill([{ tag: 'circle', cx: 84, cy: 134, r: 14 }, { tag: 'circle', cx: 156, cy: 134, r: 14 }], C.ink, { w: 1.4, glow: 1.2 }) +
    glowFill(['M70 120 L 100 128 L 100 118 L 70 116 Z', m('M70 120 L 100 128 L 100 118 L 70 116 Z')], '#160a1f', { glow: 0, w: 0.5 }) +
    neon({ tag: 'rect', x: 92, y: 156, width: 56, height: 24, rx: 4 }, V, 3, { fill: '#160a1f' }) +
    neon(['M102 158 L 102 178', 'M111 158 L 111 178', 'M120 158 L 120 178', 'M129 158 L 129 178', 'M138 158 L 138 178'], C.ink, 2, { glow: 0.4, hot: 0 }) +
    neon([...cone(92, 22, 22), ...cone(120, 10, 28), ...cone(148, 22, 22)], C.orange, 3, { fill: true, tint: 0.18 }) +
    neon([stripe(92, 22, 22), stripe(120, 10, 28), stripe(148, 22, 22)], C.ink, 2.4, { glow: 0.4, hot: 0 });
}

function fuligem() {
  const cloud = 'M64 150 Q 40 150 40 126 Q 40 104 62 102 Q 62 70 94 66 Q 108 40 138 50 Q 164 44 172 74 Q 200 78 198 108 Q 210 130 190 146 Q 186 170 160 166 Q 140 184 116 170 Q 88 182 76 164 Q 60 166 64 150 Z';
  const pipe = 'M56 148 L 28 178 L 44 192 L 72 162 Z';
  const rim = 'M22 172 L 50 198';
  return ground() +
    neon([pipe, m(pipe)], C.ink2, 3.2, { fill: true, tint: 0.06, glow: 0.6 }) +
    neon([rim, m(rim)], C.ink, 3.6, { glow: 0.5 }) +
    puff(22, 210, 11, 0.6) + puff(218, 208, 12, 0.6) +
    neon(cloud, V, 4, { fill: true, tint: 0.12 }) +
    neon(['M84 96 Q 100 80 120 92', 'M120 92 Q 140 78 160 94', 'M70 132 Q 90 146 108 140'], C.ink2, 2, { glow: 0.3, hot: 0, opacity: 0.55 }) +
    neon(['M84 104 L 116 116', m('M84 104 L 116 116')], V, 5) +
    glowFill(['M90 114 L 114 120 L 110 128 L 94 124 Z', m('M90 114 L 114 120 L 110 128 L 94 124 Z')], C.ink, { w: 0.8, glow: 0.8 }) +
    neon('M96 146 L 104 140 L 112 148 L 120 140 L 128 148 L 136 140 L 144 146', C.ink, 2.6) +
    neon(['M100 168 Q 98 180 102 188', 'M140 166 Q 144 178 140 186'], C.ink2, 2.4, { hot: 0, opacity: 0.6 });
}

const BOSSES = {
  mormaco: { name: 'Mormaço', states: ['parado', 'golpe', 'furioso', 'derrotado'], draw: mormaco },
  paredao: { name: 'Paredão', states: ['parado', 'golpe', 'furioso', 'derrotado'], draw: paredao },
  soneca: { name: 'Soneca', states: ['parado'], draw: soneca },
  'rei-buzina': { name: 'Rei Buzina', states: ['parado'], draw: reiBuzina },
  fuligem: { name: 'Fuligem', states: ['parado'], draw: fuligem },
};

module.exports = { BOSSES };
